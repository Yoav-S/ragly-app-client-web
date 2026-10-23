"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { BranchCard, branchHref } from "../components/branch-card";
import { BusinessDetails } from "../components/business-details";
import { BusinessEditor } from "../components/business-editor";
import { LogoBadge } from "../components/business-logo";
import { ConfirmModal } from "../components/confirm-modal";
import { Card, dangerButton, inputClass, primaryButton, secondaryButton } from "../components/form-controls";
import { NameGate } from "../components/name-gate";
import { OnboardingForm } from "../components/onboarding-form";
import { OwnerHeader, type OwnerNotice } from "../components/owner-header";
import { BusinessPillView } from "../components/status-pill";
import { apiDelete, apiGet, apiPost, type UserProfile } from "@/lib/api";
import { auth } from "@/lib/firebase";
import {
  fieldLabelKey,
  type Branch,
  type Business,
  type BusinessEvent,
  type BusinessMembership,
  type BusinessSession,
  type Invitation,
  type MemberRole,
} from "@/lib/business";
import { errorMessage } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";

type OwnerReview = {
  id: string;
  author_name: string;
  author_photo?: string | null;
  rating: number;
  comment?: string | null;
  created_at: string;
};

function roleLabel(role: string): string {
  if (role === "branch_owner") return "admin.role_branch_owner";
  if (role === "lead") return "admin.role_lead";
  if (role === "worker") return "admin.role_worker";
  return "admin.role_owner";
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10" />}>
      <Dashboard />
    </Suspense>
  );
}

function Dashboard() {
  const router = useRouter();
  const search = useSearchParams();
  const { t } = useI18n();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [memberships, setMemberships] = useState<BusinessMembership[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(search.get("business"));
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [notices, setNotices] = useState<BusinessEvent[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [onboarding, setOnboarding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sentBanner, setSentBanner] = useState(search.get("sent") === "1");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<MemberRole>("worker");
  const [inviteLocation, setInviteLocation] = useState("");
  const [teamNotice, setTeamNotice] = useState("");
  const [reviews, setReviews] = useState<OwnerReview[] | null>(null);

  const load = useCallback(
    async (token: string) => {
      const [me, session] = await Promise.all([
        apiGet<UserProfile>("/users/me", token),
        apiGet<BusinessSession>("/businesses/mine", token),
      ]);
      if (session.is_ragly_admin) {
        router.replace("/admin");
        return;
      }
      setProfile(me);
      setMemberships(session.businesses);
      setInvitations(session.invitations);
      setNotices(session.notices);
      setSelectedId((current) =>
        current && session.businesses.some((item) => item.business.id === current) ? current : (session.businesses[0]?.business.id ?? null),
      );
      setReady(true);
    },
    [router],
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      try {
        await load(await user.getIdToken());
      } catch (err: unknown) {
        setError(errorMessage(err, t));
        setReady(true);
      }
    });
    return unsubscribe;
  }, [router, load, t]);

  useEffect(() => {
    if (!sentBanner) return;
    const handle = window.setTimeout(() => setSentBanner(false), 8000);
    return () => window.clearTimeout(handle);
  }, [sentBanner]);

  const membership = memberships.find((item) => item.business.id === selectedId) ?? null;
  const business = membership?.business ?? null;
  const role = membership?.role ?? null;

  useEffect(() => {
    setReviews(null);
    if (!business || business.status !== "published") return;
    let cancelled = false;
    void (async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const rows = await apiGet<OwnerReview[]>(`/businesses/${business.id}/reviews`, await user.getIdToken());
        if (!cancelled) setReviews(rows);
      } catch {
        if (!cancelled) setReviews([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [business?.id, business?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  function replaceBusiness(next: Business) {
    setMemberships((current) => current.map((item) => (item.business.id === next.id ? { ...item, business: next } : item)));
  }

  function replaceBranch(next: Branch) {
    setMemberships((current) =>
      current.map((item) =>
        item.business.id === next.business_id
          ? {
              ...item,
              business: {
                ...item.business,
                locations: item.business.locations.some((row) => row.id === next.id)
                  ? item.business.locations.map((row) => (row.id === next.id ? next : row))
                  : [...item.business.locations, next],
              },
            }
          : item,
      ),
    );
    void refresh();
  }

  async function refresh() {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await load(await user.getIdToken());
    } catch {
      // The optimistic state already shows the change.
    }
  }

  async function respond(invitation: Invitation, action: "approve" | "decline") {
    const user = auth.currentUser;
    if (!user) return;
    setError("");
    try {
      const token = await user.getIdToken();
      await apiPost(`/businesses/invitations/${invitation.id}/${action}`, token, {});
      await load(token);
    } catch (err: unknown) {
      setError(errorMessage(err, t));
    }
  }

  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user || !business || !memberEmail.trim()) return;
    setError("");
    setTeamNotice("");
    try {
      const token = await user.getIdToken();
      const invitation = await apiPost<Invitation>(`/businesses/${business.id}/invitations`, token, {
        email: memberEmail.trim().toLowerCase(),
        role: memberRole,
        location_id: memberRole === "owner" ? null : inviteLocation || null,
      });
      replaceBusiness({ ...business, invitations: [invitation, ...business.invitations] });
      setMemberEmail("");
      setTeamNotice(t("admin.invite_sent"));
    } catch (err: unknown) {
      setError(errorMessage(err, t));
    }
  }

  async function removeBusiness() {
    const user = auth.currentUser;
    if (!user || !business || deleting) return;
    setDeleting(true);
    setError("");
    try {
      await apiDelete(`/businesses/${business.id}`, await user.getIdToken());
      const rest = memberships.filter((item) => item.business.id !== business.id);
      setMemberships(rest);
      setSelectedId(rest[0]?.business.id ?? null);
      setDeleteOpen(false);
      setEditing(false);
    } catch (err: unknown) {
      setError(errorMessage(err, t));
    } finally {
      setDeleting(false);
    }
  }

  async function openNotice(id: string) {
    const notice = notices.find((item) => item.id === id);
    if (notice) {
      setSelectedId(notice.business_id);
      setOnboarding(false);
    }
    setNotices([]);
    const user = auth.currentUser;
    if (user) {
      try {
        await apiPost("/businesses/seen", await user.getIdToken(), {});
      } catch {
        // Not worth an error banner; they show again next load.
      }
    }
  }

  if (!ready) {
    return <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10" />;
  }

  if (!profile) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">
        {error ? (
          <p className="text-sm text-[#EF4444]" role="alert">
            {error}
          </p>
        ) : null}
      </main>
    );
  }

  if (!profile.name?.trim()) {
    return <NameGate onSaved={setProfile} />;
  }

  const headerNotices: OwnerNotice[] = notices.map((event) => ({
    id: event.id,
    name: event.business_name,
    detail: t(`events.${event.kind}`, {
      name: event.business_name,
      address: event.address ?? "",
      message: event.message ?? "",
    }),
  }));

  const showOnboarding = onboarding || memberships.length === 0;
  const isOwner = role === "owner";
  const canManageBranches = isOwner;
  const branches = business?.locations ?? [];
  const businessNotes = business ? (business.status === "rejected" ? business.field_errors : business.admin_notes) : {};

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-10">
      <OwnerHeader profile={profile} notices={headerNotices} onOpen={(id) => void openNotice(id)} />
      {error ? (
        <p className="mt-8 text-sm text-[#EF4444]" role="alert">
          {error}
        </p>
      ) : null}

      {invitations.map((invitation) => (
        <Card key={invitation.id} className="mt-6">
          <h2 className="text-lg font-medium text-foreground">{t("dashboard.invite_title", { name: invitation.business_name })}</h2>
          <p className="mt-2 text-sm text-muted">{t("dashboard.invite_body", { role: t(roleLabel(invitation.role)) })}</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={() => void respond(invitation, "approve")} className={primaryButton}>
              {t("dashboard.approve")}
            </button>
            <button type="button" onClick={() => void respond(invitation, "decline")} className={secondaryButton}>
              {t("dashboard.decline")}
            </button>
          </div>
        </Card>
      ))}

      {showOnboarding ? (
        <div className="mt-10">
          <OnboardingForm
            onCancel={memberships.length ? () => setOnboarding(false) : undefined}
            onCreated={(created) => {
              setMemberships((current) => [...current, { business: created, role: "owner", location_id: null }]);
              setSelectedId(created.id);
              setOnboarding(false);
              router.push(branchHref(created));
            }}
          />
        </div>
      ) : null}

      {!showOnboarding && business ? (
        <>
          {memberships.length > 1 ? (
            <div className="mt-8 flex flex-wrap items-center gap-2">
              {memberships.map((item) => (
                <button
                  key={item.business.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(item.business.id);
                    setEditing(false);
                  }}
                  className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm ${
                    item.business.id === business.id ? "border-brand bg-[#EEF3F2] text-brand" : "border-line bg-surface text-foreground"
                  }`}
                >
                  <LogoBadge business={item.business} size="h-6 w-6 text-xs" />
                  {item.business.name}
                </button>
              ))}
              <button type="button" onClick={() => setOnboarding(true)} className="text-sm font-medium text-brand">
                + {t("dashboard.add_business")}
              </button>
            </div>
          ) : null}

          {sentBanner ? (
            <div className="mt-8 flex items-start gap-3 rounded-2xl bg-[#EEF3F2] px-5 py-4">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs text-white">✓</span>
              <div>
                <p className="text-sm font-medium text-foreground">{t("dashboard.sent_title")}</p>
                <p className="mt-1 text-sm text-muted">{t("dashboard.sent_body")}</p>
              </div>
            </div>
          ) : null}

          <Card className="mt-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <LogoBadge business={business} size="h-16 w-16" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-xl font-medium text-foreground">{business.name}</h1>
                    <BusinessPillView status={business.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {business.categories.length
                      ? business.categories.map((category) => t(`categories.${category}`)).join(" · ")
                      : t("business.no_services_yet")}
                    {role ? ` · ${t(roleLabel(role))}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {isOwner ? (
                  <button type="button" onClick={() => setEditing((value) => !value)} className={secondaryButton}>
                    {editing ? t("done") : t("dashboard.edit_business")}
                  </button>
                ) : null}
                {memberships.length === 1 && isOwner ? (
                  <button type="button" onClick={() => setOnboarding(true)} className="text-sm font-medium text-brand">
                    + {t("dashboard.add_business")}
                  </button>
                ) : null}
              </div>
            </div>
            <StatusBanner business={business} />
            {!editing && Object.keys(businessNotes).length > 0 ? (
              <div className={`mt-4 rounded-2xl p-4 ${business.status === "rejected" ? "bg-[#FEF2F2]" : "bg-[#EEF3F2]"}`}>
                <p className={`text-sm font-medium ${business.status === "rejected" ? "text-[#B91C1C]" : "text-foreground"}`}>
                  {business.status === "rejected" ? t("dashboard.fix_these") : t("dashboard.notes_title")}
                </p>
                <ul className="mt-2 grid gap-2">
                  {Object.entries(businessNotes).map(([field, message]) => (
                    <li key={field} className="text-sm text-foreground">
                      <span className="font-medium">{t(fieldLabelKey(field))}</span>
                      <span className="mt-0.5 block">{message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {role === "worker" ? <p className="mt-4 text-sm text-muted">{t("dashboard.worker_notice")}</p> : null}
            <div className="mt-6 border-t border-line pt-6">
              {editing && isOwner ? (
                <BusinessEditor business={business} scope="owner" onChanged={replaceBusiness} onClose={() => setEditing(false)} />
              ) : (
                <BusinessDetails business={business} showBranches={false} />
              )}
            </div>
          </Card>

          <section className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium text-foreground">{t("dashboard.branches")}</h2>
                <p className="mt-1 text-sm text-muted">{t("dashboard.branches_body")}</p>
              </div>
              {canManageBranches && branches.length > 0 ? (
                <Link href={branchHref(business)} className={secondaryButton}>
                  + {t("dashboard.add_branch")}
                </Link>
              ) : null}
            </div>
            {branches.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF3F2] text-brand">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
                    <circle cx="12" cy="10" r="2.5" />
                  </svg>
                </span>
                <h3 className="mt-4 text-lg font-medium text-foreground">{t("dashboard.no_branches")}</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
                  {canManageBranches ? t("dashboard.no_branches_body") : t("dashboard.no_branches_member")}
                </p>
                {canManageBranches ? (
                  <Link href={branchHref(business)} className={`${primaryButton} mt-6`}>
                    {t("dashboard.create_first_branch")}
                  </Link>
                ) : null}
              </div>
            ) : (
              <ul className="mt-4 grid gap-3">
                {branches.map((branch) => (
                  <li key={branch.id}>
                    <BranchCard
                      business={business}
                      branch={branch}
                      canManage={canManageBranches}
                      onChanged={replaceBranch}
                      onDeleted={(removed) => {
                        replaceBusiness({ ...business, locations: business.locations.filter((row) => row.id !== removed.id) });
                        void refresh();
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {isOwner || role === "branch_owner" || role === "lead" ? (
            <Card className="mt-8">
              <form onSubmit={inviteMember} className="grid gap-3">
                <h2 className="text-lg font-medium text-foreground">{t("dashboard.team")}</h2>
                <p className="text-sm text-muted">{t("dashboard.team_hint")}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-foreground">
                    {t("admin.invite_email")}
                    <input type="email" required value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} className={inputClass} />
                  </label>
                  <label className="block text-sm font-medium text-foreground">
                    {t("dashboard.role")}
                    <select value={memberRole} onChange={(event) => setMemberRole(event.target.value as MemberRole)} className={inputClass}>
                      {isOwner ? <option value="owner">{t("admin.role_owner")}</option> : null}
                      {isOwner ? <option value="branch_owner">{t("admin.role_branch_owner")}</option> : null}
                      <option value="lead">{t("admin.role_lead")}</option>
                      <option value="worker">{t("admin.role_worker")}</option>
                    </select>
                  </label>
                </div>
                {memberRole !== "owner" ? (
                  <label className="block text-sm font-medium text-foreground">
                    {t("dashboard.branch")}
                    <select required value={inviteLocation} onChange={(event) => setInviteLocation(event.target.value)} className={inputClass}>
                      <option value="">{t("dashboard.pick_branch")}</option>
                      {branches
                        .filter((branch) => branch.status === "published")
                        .map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.address}
                          </option>
                        ))}
                    </select>
                  </label>
                ) : null}
                {teamNotice ? <p className="text-sm text-brand">{teamNotice}</p> : null}
                <div>
                  <button type="submit" className={secondaryButton}>
                    {t("dashboard.add_member")}
                  </button>
                </div>
                {business.invitations.length > 0 ? (
                  <ul className="mt-2 grid gap-2 border-t border-line pt-4">
                    {business.invitations.map((invitation) => (
                      <li key={invitation.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-foreground">
                          {invitation.email} · {t(roleLabel(invitation.role))}
                        </span>
                        <span className="text-muted">{t(`admin.${invitation.status}`)}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </form>
            </Card>
          ) : null}

          {business.status === "published" ? (
            <Card className="mt-8">
              <h2 className="text-lg font-medium text-foreground">{t("dashboard.tab_reviews")}</h2>
              {reviews === null ? (
                <p className="mt-3 text-sm text-muted">{t("loading")}</p>
              ) : reviews.length === 0 ? (
                <p className="mt-3 text-sm text-muted">{t("dashboard.reviews_empty")}</p>
              ) : (
                <ul className="mt-4 grid gap-3">
                  {reviews.map((review) => (
                    <li key={review.id} className="rounded-2xl bg-background p-4">
                      <div className="flex items-center gap-3">
                        {review.author_photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={review.author_photo} alt="" className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EEF3F2] text-sm font-medium text-brand">
                            {review.author_name.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <div>
                          <p className="text-sm font-medium text-foreground">{review.author_name}</p>
                          <p className="text-sm text-brand">{"★".repeat(review.rating)}</p>
                        </div>
                      </div>
                      {review.comment ? <p className="mt-3 text-sm leading-6 text-foreground">{review.comment}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}

          {isOwner ? (
            <div className="mt-8 flex justify-end">
              <button type="button" onClick={() => setDeleteOpen(true)} className={dangerButton}>
                {t("dashboard.delete")}
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      <ConfirmModal
        open={deleteOpen}
        title={t("dashboard.delete_title")}
        body={t("dashboard.delete_body")}
        confirmLabel={t("dashboard.delete")}
        cancelLabel={t("dashboard.keep")}
        danger
        pending={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => void removeBusiness()}
      />
    </main>
  );
}

function StatusBanner({ business }: { business: Business }) {
  const { t } = useI18n();
  const branches = business.locations;
  let text: string | null = null;
  if (business.status === "draft") text = branches.length ? t("dashboard.state_draft_branch") : t("dashboard.state_draft");
  else if (business.status === "pending_review") text = t("dashboard.state_waiting");
  else if (business.status === "rejected") text = t("dashboard.state_changes");
  else if (business.status === "suspended") text = t("dashboard.state_suspended");
  else text = t("dashboard.state_live");
  return <p className="mt-4 text-sm leading-6 text-muted">{text}</p>;
}

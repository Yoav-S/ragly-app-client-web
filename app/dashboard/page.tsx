"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { BusinessDetails } from "../components/business-details";
import { BusinessForm } from "../components/business-form";
import { BusinessEditor } from "../components/business-editor";
import { ConfirmModal } from "../components/confirm-modal";
import { NameGate } from "../components/name-gate";
import { OwnerHeader } from "../components/owner-header";
import { StoreList } from "../components/store-list";
import { apiDelete, apiGet, apiPost, type UserProfile } from "@/lib/api";
import { auth } from "@/lib/firebase";
import {
  type Business,
  type BusinessMembership,
  type BusinessSession,
  type Invitation,
  type MemberRole,
} from "@/lib/business";
import { errorMessage } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";

const FIELD_LABEL: Record<string, string> = {
  name: "business.name",
  phone: "business.phones",
  email: "business.email",
  description: "business.description",
  category: "business.category",
  city: "business.city",
  address: "business.address",
  timezone: "business.timezone",
  hours: "business.hours",
  website: "business.website",
  location: "admin.review_location",
  photo: "business.photo",
  instagram: "business.instagram",
};

function fieldLabel(field: string): string {
  return FIELD_LABEL[field] ?? field;
}

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
  const router = useRouter();
  const { t } = useI18n();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [memberships, setMemberships] = useState<BusinessMembership[]>([]);
  const [addingBusiness, setAddingBusiness] = useState(false);
  const [role, setRole] = useState<MemberRole | null>(null);
  const [inviteLocation, setInviteLocation] = useState("");
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<MemberRole>("worker");
  const [teamNotice, setTeamNotice] = useState("");
  const [tab, setTab] = useState<"business" | "reviews">("business");
  const [reviews, setReviews] = useState<OwnerReview[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function load(token: string) {
    const [me, session] = await Promise.all([
      apiGet<UserProfile>("/users/me", token),
      apiGet<BusinessSession>("/businesses/mine", token),
    ]);
    if (session.is_ragly_admin) {
      router.replace("/admin");
      return;
    }
    const rows = session.businesses?.length
      ? session.businesses
      : session.business
        ? [{ business: session.business, role: session.role ?? "owner", location_id: null }]
        : [];
    setProfile(me);
    setMemberships(rows);
    setBusiness(rows[0]?.business ?? null);
    setRole(rows[0]?.role ?? null);
    setInvitations(session.invitations ?? []);
    setReady(true);
  }

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
  }, [router, t]);

  useEffect(() => {
    if (tab !== "reviews" || !business || business.status !== "published") {
      setReviews([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const rows = await apiGet<OwnerReview[]>(
          `/businesses/${business.id}/reviews`,
          await user.getIdToken(),
        );
        if (!cancelled) setReviews(rows);
      } catch (err: unknown) {
        if (!cancelled) setError(errorMessage(err, t));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, business, t]);

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
      const invitation = await apiPost<Invitation>(
        `/businesses/${business.id}/invitations`,
        token,
        {
          email: memberEmail.trim().toLowerCase(),
          role: memberRole,
          location_id: memberRole === "owner" ? null : inviteLocation || null,
        },
      );
      setBusiness({
        ...business,
        invitations: [invitation, ...(business.invitations ?? [])],
      });
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
      const token = await user.getIdToken();
      await apiDelete(`/businesses/${business.id}`, token);
      const rest = memberships.filter((item) => item.business.id !== business.id);
      setMemberships(rest);
      setBusiness(rest[0]?.business ?? null);
      setRole(rest[0]?.role ?? null);
      setDeleteOpen(false);
    } catch (err: unknown) {
      setError(errorMessage(err, t));
    } finally {
      setDeleting(false);
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

  const canAddStore = role === "owner" && business?.status === "published";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-10">
      {profile ? <OwnerHeader profile={profile} /> : null}
      {error ? (
        <p className="mt-8 text-sm text-[#EF4444]" role="alert">
          {error}
        </p>
      ) : null}
      {invitations.map((invitation) => (
        <section key={invitation.id} className="mt-6 rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-lg font-medium text-foreground">
            {t("dashboard.invite_title", { name: invitation.business_name })}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {t("dashboard.invite_body", {
              role: t(roleLabel(invitation.role)),
            })}
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => respond(invitation, "approve")}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-brand px-4 text-sm font-medium text-white"
            >
              {t("dashboard.approve")}
            </button>
            <button
              type="button"
              onClick={() => respond(invitation, "decline")}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-line px-4 text-sm font-medium text-foreground"
            >
              {t("dashboard.decline")}
            </button>
          </div>
        </section>
      ))}
      <div className="mt-8 flex gap-6 border-b border-line">
        {(
          [
            ["business", "dashboard.tab_business"],
            ["reviews", "dashboard.tab_reviews"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`border-b-2 pb-3 text-sm font-medium ${
              tab === id ? "border-brand text-brand" : "border-transparent text-muted"
            }`}
          >
            {t(label)}
          </button>
        ))}
      </div>
      {tab === "business" && memberships.length === 0 && !addingBusiness ? (
        <section className="mt-8 rounded-2xl border border-line bg-surface px-6 py-10">
          <h2 className="text-xl font-medium text-foreground">{t("dashboard.empty_title")}</h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-muted">{t("dashboard.empty")}</p>
          <button
            type="button"
            onClick={() => setAddingBusiness(true)}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-2xl bg-brand px-5 text-sm font-medium text-white"
          >
            {t("dashboard.empty_action")}
          </button>
        </section>
      ) : null}
      {tab === "business" && memberships.length === 0 && addingBusiness ? (
        <>
          <button
            type="button"
            onClick={() => setAddingBusiness(false)}
            className="mt-6 text-sm font-medium text-brand"
          >
            {t("back")}
          </button>
          <BusinessForm
            onSubmitted={(created) => {
              setMemberships([{ business: created, role: "owner", location_id: null }]);
              setBusiness(created);
              setRole("owner");
              setAddingBusiness(false);
            }}
          />
        </>
      ) : null}
      {tab === "business" && memberships.length > 0 ? (
        <section className="mt-8 grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-medium text-foreground">{t("dashboard.your_businesses")}</h2>
            <button
              type="button"
              onClick={() => setAddingBusiness((value) => !value)}
              className="text-sm font-medium text-brand"
            >
              {t("dashboard.add_business")}
            </button>
          </div>
          <ul className="grid gap-2">
            {memberships.map((item) => (
              <li key={item.business.id}>
                <button
                  type="button"
                  onClick={() => {
                    setBusiness(item.business);
                    setRole(item.role);
                  }}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left ${
                    business?.id === item.business.id ? "border-brand bg-surface" : "border-line bg-background"
                  }`}
                >
                  <span>
                    <span className="block text-sm font-medium text-foreground">{item.business.name}</span>
                    <span className="mt-1 block text-sm text-muted">
                      {t("dashboard.store_count", { n: String(item.business.locations?.length || 1) })}
                      {" · "}
                      {item.role ? t(roleLabel(item.role)) : t("business.pending")}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {tab === "business" && memberships.length > 0 && addingBusiness ? (
        <BusinessForm
          onSubmitted={(created) => {
            const next = { business: created, role: "owner" as const, location_id: null };
            setMemberships((current) => [...current, next]);
            setBusiness(created);
            setRole("owner");
            setAddingBusiness(false);
          }}
        />
      ) : null}
      {tab === "business" && business ? (
        <section className="mt-8 rounded-2xl border border-line bg-surface p-6">
          <p className="text-sm font-medium text-brand">
            {t(`business.${business.status === "pending_review" ? "pending" : business.status}`)}
          </p>
          {role ? (
            <p className="mt-2 text-sm text-muted">
              {t("dashboard.your_role")}: {t(roleLabel(role))}
            </p>
          ) : null}
          {business.status === "pending_review" ? (
            <p className="mt-3 rounded-2xl bg-[#EEF3F2] px-4 py-3 text-sm text-foreground">
              {t("business.pending")}
            </p>
          ) : null}
          {role === "worker" ? (
            <p className="mt-3 text-sm text-muted">{t("dashboard.worker_notice")}</p>
          ) : null}
          {business.status === "rejected" && Object.keys(business.field_errors ?? {}).length > 0 ? (
            <div className="mt-4 rounded-2xl bg-[#FEF2F2] p-4">
              <p className="text-sm font-medium text-[#EF4444]">{t("dashboard.fix_these")}</p>
              <ul className="mt-3 grid gap-2">
                {Object.entries(business.field_errors).map(([field, message]) => (
                  <li key={field} className="text-sm text-foreground">
                    <span className="font-medium">{t(fieldLabel(field))}</span>
                    <span className="mt-1 block text-[#EF4444]">{message}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mt-6">
            {role === "owner" && business.status !== "pending_review" ? (
              <BusinessEditor
                business={business}
                scope="owner"
                onChanged={(next) => {
                  setBusiness(next);
                  setMemberships((current) =>
                    current.map((item) => (item.business.id === next.id ? { ...item, business: next } : item)),
                  );
                }}
              />
            ) : (
              <BusinessDetails business={business} />
            )}
          </div>
          {(canAddStore || (business.locations?.length ?? 0) > 0) &&
          (role === "owner" || role === "branch_owner" || role === "lead" || role === null) ? (
            <StoreList
              business={business}
              canAdd={canAddStore}
              token={async () => (await auth.currentUser?.getIdToken()) ?? ""}
              onChanged={(next) => {
                setBusiness(next);
                setMemberships((current) =>
                  current.map((item) => (item.business.id === next.id ? { ...item, business: next } : item)),
                );
              }}
            />
          ) : null}
          {role === "owner" && business.status !== "pending_review" ? (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-line px-4 text-sm font-medium text-[#EF4444]"
              >
                {t("dashboard.delete")}
              </button>
            </div>
          ) : null}
          {(role === "owner" && business.status !== "pending_review") || role === "branch_owner" || role === "lead" ? (
            <form onSubmit={inviteMember} className="mt-8 grid gap-3 border-t border-line pt-6">
              <h2 className="text-lg font-medium text-foreground">{t("dashboard.team")}</h2>
              <p className="text-sm text-muted">{t("dashboard.team_hint")}</p>
              <label className="block text-sm text-muted">
                {t("admin.invite_email")}
                <input
                  type="email"
                  required
                  value={memberEmail}
                  onChange={(event) => setMemberEmail(event.target.value)}
                  className="mt-2 h-11 w-full rounded-2xl border border-line bg-background px-4 text-sm text-foreground outline-none focus:border-brand"
                />
              </label>
              <label className="block text-sm text-muted">
                {t("dashboard.your_role")}
                <select
                  value={memberRole}
                  onChange={(event) => setMemberRole(event.target.value as "owner" | "worker")}
                  className="mt-2 h-11 w-full rounded-2xl border border-line bg-background px-3 text-sm text-foreground outline-none focus:border-brand"
                >
                  {role === "owner" ? <option value="owner">{t("admin.role_owner")}</option> : null}
                  {role === "owner" ? (
                    <option value="branch_owner">{t("admin.role_branch_owner")}</option>
                  ) : null}
                  <option value="lead">{t("admin.role_lead")}</option>
                  <option value="worker">{t("admin.role_worker")}</option>
                </select>
              </label>
              {memberRole !== "owner" ? (
                <label className="block text-sm text-muted">
                  {t("dashboard.store")}
                  <select
                    required
                    value={inviteLocation}
                    onChange={(event) => setInviteLocation(event.target.value)}
                    className="mt-2 h-11 w-full rounded-2xl border border-line bg-background px-3 text-sm text-foreground outline-none focus:border-brand"
                  >
                    <option value="">{t("dashboard.pick_store")}</option>
                    {(business.locations ?? [])
                      .filter((store) => !store.status || store.status === "published")
                      .map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.address}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {teamNotice ? <p className="text-sm text-brand">{teamNotice}</p> : null}
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-line px-4 text-sm font-medium text-foreground"
              >
                {t("dashboard.add_member")}
              </button>
              <ul className="grid gap-2">
                {(business.invitations ?? []).map((invitation) => (
                  <li key={invitation.id} className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      {invitation.email} · {t(roleLabel(invitation.role))}
                    </span>
                    <span className="text-muted">{t(`admin.${invitation.status}`)}</span>
                  </li>
                ))}
              </ul>
            </form>
          ) : null}
        </section>
      ) : null}
      {tab === "reviews" ? (
        <section className="mt-8">
          {!business || business.status !== "published" || reviews.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface px-6 py-10">
              <h2 className="text-xl font-medium text-foreground">{t("dashboard.tab_reviews")}</h2>
              <p className="mt-3 max-w-lg text-sm leading-6 text-muted">
                {!business
                  ? t("dashboard.reviews_need_business")
                  : business.status !== "published"
                    ? t("dashboard.reviews_after_publish")
                    : t("dashboard.reviews_empty")}
              </p>
            </div>
          ) : (
            <ul className="grid gap-3">
              {reviews.map((review) => (
                <li key={review.id} className="rounded-2xl border border-line bg-surface p-4">
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
                  {review.comment ? (
                    <p className="mt-3 text-sm leading-6 text-foreground">{review.comment}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
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

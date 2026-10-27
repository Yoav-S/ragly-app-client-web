"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ActionMenu, menuItemClass } from "../../../components/action-menu";
import { AdminShell, useAdminSession, type AdminTab } from "../../../components/admin-shell";
import { branchHref } from "../../../components/branch-card";
import { PhoneLinks } from "../../../components/business-details";
import { BusinessEditor } from "../../../components/business-editor";
import { LogoBadge } from "../../../components/business-logo";
import { ConfirmModal } from "../../../components/confirm-modal";
import { dangerButton, inputClass, secondaryButton, textareaClass } from "../../../components/form-controls";
import { HoursSummary } from "../../../components/hours-editor";
import { BranchPillView, BusinessPillView } from "../../../components/status-pill";
import { VisibilityControl } from "../../../components/visibility-control";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { businessImages, type Branch, type Business, type BusinessEvent, type Invitation } from "@/lib/business";
import { signedInThisTab } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { auth } from "@/lib/firebase";
import { useI18n } from "@/lib/i18n";

type PlaceReview = {
  id: string;
  author_name: string;
  author_photo?: string | null;
  rating: number;
  comment?: string | null;
  created_at: string;
};

export default function AdminBusinessPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useI18n();
  const { ready, error: sessionError } = useAdminSession();
  const [business, setBusiness] = useState<Business | null>(null);
  const [reviews, setReviews] = useState<PlaceReview[] | null>(null);
  const [events, setEvents] = useState<BusinessEvent[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteNotice, setInviteNotice] = useState("");
  const [inviting, setInviting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [deciding, setDeciding] = useState(false);

  const load = useCallback(async () => {
    const user = auth.currentUser;
    if (!user || !params.id) return;
    const token = await user.getIdToken();
    const row = await apiGet<Business>(`/admin/businesses/${params.id}`, token);
    setBusiness(row);
    const extras = await Promise.allSettled([
      apiGet<PlaceReview[]>(`/admin/businesses/${row.id}/reviews`, token),
      apiGet<BusinessEvent[]>(`/businesses/${row.id}/events`, token),
    ]);
    setReviews(extras[0].status === "fulfilled" ? extras[0].value : []);
    setEvents(extras[1].status === "fulfilled" ? extras[1].value : []);
  }, [params.id]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void (async () => {
      try {
        await load();
      } catch (err: unknown) {
        if (!cancelled) setError(errorMessage(err, t));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, load, t]);

  if (!ready || !signedInThisTab()) {
    return (
      <main className="min-h-full bg-[#F7F8FA] px-4 py-10">
        {sessionError ? (
          <p className="text-sm text-[#EF4444]" role="alert">
            {sessionError}
          </p>
        ) : null}
      </main>
    );
  }

  function go(tab: AdminTab) {
    router.push(tab === "businesses" ? "/admin" : `/admin?tab=${tab}`);
  }

  async function sendInvite() {
    if (!business || inviting || !inviteEmail.trim()) return;
    const user = auth.currentUser;
    if (!user) return;
    setInviting(true);
    setError("");
    setInviteNotice("");
    try {
      const invitation = await apiPost<Invitation>(`/admin/businesses/${business.id}/invitations`, await user.getIdToken(), {
        email: inviteEmail.trim().toLowerCase(),
      });
      setBusiness({ ...business, invitations: [invitation, ...business.invitations] });
      setInviteEmail("");
      setInviteNotice(t("admin.invite_sent"));
    } catch (err: unknown) {
      setError(errorMessage(err, t));
    } finally {
      setInviting(false);
    }
  }

  async function removeBusiness() {
    if (!business || deleting) return;
    const user = auth.currentUser;
    if (!user) return;
    setDeleting(true);
    try {
      await apiDelete(`/admin/businesses/${business.id}`, await user.getIdToken());
      router.replace("/admin");
    } catch (err: unknown) {
      setError(errorMessage(err, t));
      setDeleting(false);
    }
  }

  async function approve() {
    if (!business || deciding) return;
    const user = auth.currentUser;
    if (!user) return;
    setDeciding(true);
    setError("");
    try {
      setBusiness(await apiPost<Business>(`/admin/businesses/${business.id}/approve`, await user.getIdToken(), {}));
    } catch (err: unknown) {
      setError(errorMessage(err, t));
    } finally {
      setDeciding(false);
    }
  }

  async function reject() {
    if (!business || deciding || !rejectNote.trim()) return;
    const user = auth.currentUser;
    if (!user) return;
    setDeciding(true);
    setError("");
    try {
      setBusiness(
        await apiPost<Business>(`/admin/businesses/${business.id}/reject`, await user.getIdToken(), {
          field_errors: { general: rejectNote.trim() },
        }),
      );
      setRejectOpen(false);
      setRejectNote("");
    } catch (err: unknown) {
      setError(errorMessage(err, t));
    } finally {
      setDeciding(false);
    }
  }

  if (!business) {
    return (
      <AdminShell tab="businesses" onTab={go}>
        {error ? (
          <p className="text-sm text-[#EF4444]" role="alert">
            {error}
          </p>
        ) : (
          <p className="text-sm text-muted">{t("loading")}</p>
        )}
      </AdminShell>
    );
  }

  const contact = business.email || business.owner_email || "";
  const photos = businessImages(business);
  const waiting = business.status === "pending_review" || business.locations.some((branch) => branch.status === "pending_review");
  const stamp = (value: string | null) => formatWhen(value, locale);
  const rating =
    reviews && reviews.length ? Math.round((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length) * 10) / 10 : null;

  return (
    <AdminShell tab="businesses" onTab={go}>
      <Link href="/admin" className="text-sm font-medium text-brand">
        ← {t("admin.back_to_list")}
      </Link>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <LogoBadge business={business} size="h-16 w-16" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-medium text-foreground sm:text-[32px]">{business.name}</h1>
              <BusinessPillView status={business.status} visible={business.visible !== false} />
            </div>
            <p className="mt-2 text-sm text-muted">
              {t("admin.branch_count", { n: business.locations.length })}
              {rating != null ? ` · ${rating}/5` : ""}
              {reviews && reviews.length ? ` · ${t("admin.review_count", { n: reviews.length })}` : ""}
            </p>
          </div>
        </div>
        <ActionMenu label={t("admin.more_actions")}>
          {(close) => (
            <>
              <VisibilityControl business={business} onChanged={setBusiness} variant="menuItem" onDone={close} />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setEditing((value) => !value);
                  close();
                }}
                className={menuItemClass}
              >
                {editing ? t("done") : t("dashboard.edit_business")}
              </button>
              <Link href={branchHref(business)} role="menuitem" onClick={close} className={menuItemClass}>
                {t("dashboard.add_branch")}
              </Link>
              {business.locations.map((branch) => (
                <Link key={branch.id} href={branchHref(business, branch)} role="menuitem" onClick={close} className={menuItemClass}>
                  {t("branch.edit")}
                  {branch.address ? ` · ${branch.address}` : ""}
                </Link>
              ))}
              {contact ? (
                <a href={`mailto:${contact}?subject=${encodeURIComponent(business.name)}`} role="menuitem" onClick={close} className={menuItemClass}>
                  {t("admin.email_owner")}
                </a>
              ) : null}
            </>
          )}
        </ActionMenu>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-[#EF4444]" role="alert">
          {error}
        </p>
      ) : null}

      {waiting ? (
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" disabled={deciding} onClick={() => void approve()} className={secondaryButton}>
            {t("admin.approve")}
          </button>
          <button type="button" disabled={deciding} onClick={() => setRejectOpen(true)} className={dangerButton}>
            {t("admin.reject")}
          </button>
        </div>
      ) : null}

      {editing ? (
        <section className="mt-6 rounded-3xl border border-line bg-surface p-5 sm:p-6">
          <BusinessEditor business={business} scope="admin" onChanged={setBusiness} onClose={() => setEditing(false)} />
        </section>
      ) : null}

      <section className="mt-6 rounded-3xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="text-lg font-medium text-foreground">{t("admin.record")}</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Fact label={t("admin.field_id")}>{business.id}</Fact>
          <Fact label={t("business.name")}>{business.name}</Fact>
          <Fact label={t("admin.status_filter")}>
            <BusinessPillView status={business.status} visible={business.visible !== false} />
          </Fact>
          <Fact label={t("admin.in_app")}>{business.visible === false ? t("admin.hidden_from_app") : t("admin.visible_in_app")}</Fact>
          <Fact label={t("admin.owner")}>{business.owned ? business.owner_email || t("admin.owned") : t("admin.not_owned")}</Fact>
          <Fact label={t("admin.owner_uid")}>{business.owner_uid || "—"}</Fact>
          <Fact label={t("business.email")}>{business.email || "—"}</Fact>
          <Fact label={t("business.phones")}>
            <PhoneLinks phones={business.phone} />
          </Fact>
          <Fact label={t("business.website")}>
            {business.website ? (
              <a href={business.website} target="_blank" rel="noreferrer" className="break-all text-brand">
                {business.website}
              </a>
            ) : (
              "—"
            )}
          </Fact>
          <Fact label={t("business.instagram")}>{business.instagram || "—"}</Fact>
          <Fact label={t("business.city")}>{business.city || "—"}</Fact>
          <Fact label={t("business.address")}>{business.address || "—"}</Fact>
          <Fact label={t("business.timezone")}>{business.timezone}</Fact>
          <Fact label={t("business.language")}>{t(`languages.${business.locale}`)}</Fact>
          <Fact label={t("business.category")}>
            {business.categories.length
              ? business.categories.map((item) => t(`categories.${item}`)).join(" · ")
              : business.category
                ? t(`categories.${business.category}`)
                : t("business.no_services_yet")}
          </Fact>
          <Fact label={t("admin.onboarding_step")}>{business.onboarding_step}</Fact>
          <Fact label={t("admin.created_at")}>{stamp(business.created_at)}</Fact>
          <Fact label={t("admin.updated_at")}>{stamp(business.updated_at)}</Fact>
          <Fact label={t("admin.submitted_at")}>{stamp(business.submitted_at)}</Fact>
          <Fact label={t("admin.reviewed_at")}>{stamp(business.reviewed_at)}</Fact>
          <Fact label={t("admin.coordinates")}>
            {business.location
              ? `${business.location.coordinates[1].toFixed(6)}, ${business.location.coordinates[0].toFixed(6)}`
              : "—"}
          </Fact>
          <Fact label={t("admin.avg_rating")}>{rating != null ? `${rating} / 5` : "—"}</Fact>
          <Fact label={t("dashboard.tab_reviews")}>{reviews ? String(reviews.length) : t("loading")}</Fact>
          <Fact label={t("business.logo")}>{business.photo || "—"}</Fact>
          {business.rejection_reason ? (
            <div className="sm:col-span-2">
              <Fact label={t("admin.reason")}>{business.rejection_reason}</Fact>
            </div>
          ) : null}
          {business.description ? (
            <div className="sm:col-span-2">
              <Fact label={t("business.description")}>
                <span className="whitespace-pre-line">{business.description}</span>
              </Fact>
            </div>
          ) : null}
          <Fact label={t("business.hours")}>
            <HoursSummary hours={business.opening_hours} />
          </Fact>
        </dl>
        {Object.keys(business.field_errors).length ? (
          <NoteList title={t("dashboard.fix_these")} items={business.field_errors} danger />
        ) : null}
        {Object.keys(business.admin_notes).length ? (
          <NoteList title={t("admin.business_notes")} items={business.admin_notes} />
        ) : null}
      </section>

      <section className="mt-6 rounded-3xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="text-lg font-medium text-foreground">{t("business.photos")}</h2>
        {photos.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{t("admin.no_photos")}</p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {photos.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt="" className="h-28 w-full rounded-2xl object-cover sm:h-36" />
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="text-lg font-medium text-foreground">
          {t("dashboard.branches")} · {t("admin.branch_count", { n: business.locations.length })}
        </h2>
        {business.locations.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{t("dashboard.no_branches")}</p>
        ) : (
          <ul className="mt-4 grid gap-4">
            {business.locations.map((branch) => (
              <li key={branch.id}>
                <BranchRecord branch={branch} href={branchHref(business, branch)} stamp={stamp} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="text-lg font-medium text-foreground">{t("dashboard.tab_reviews")}</h2>
        {reviews === null ? (
          <p className="mt-3 text-sm text-muted">{t("loading")}</p>
        ) : reviews.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{t("dashboard.reviews_empty")}</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {reviews.map((review) => (
              <li key={review.id} className="rounded-2xl border border-line bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{review.author_name || t("admin.owner")}</p>
                  <p className="text-sm text-muted">
                    {review.rating}/5 · {stamp(review.created_at)}
                  </p>
                </div>
                {review.comment ? <p className="mt-2 whitespace-pre-line text-sm text-foreground">{review.comment}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="text-lg font-medium text-foreground">{t("admin.invite_owner")}</h2>
        <form
          className="mt-4 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void sendInvite();
          }}
        >
          <label className="block text-sm text-muted">
            {t("admin.invite_email")}
            <input type="email" required value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} className={inputClass} />
          </label>
          {inviteNotice ? <p className="text-sm text-brand">{inviteNotice}</p> : null}
          <div>
            <button type="submit" disabled={inviting} className={secondaryButton}>
              {t("admin.send_invite")}
            </button>
          </div>
        </form>
        {business.invitations.length > 0 ? (
          <ul className="mt-4 grid gap-2">
            {business.invitations.map((invitation) => (
              <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-foreground">
                  {invitation.email} · {t(`admin.role_${invitation.role}`)}
                  {invitation.location_id ? ` · ${invitation.location_id}` : ""}
                </span>
                <span className="text-muted">{t(`admin.${invitation.status}`)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="mt-6 rounded-3xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="text-lg font-medium text-foreground">{t("admin.tab_history")}</h2>
        {events === null ? (
          <p className="mt-3 text-sm text-muted">{t("loading")}</p>
        ) : events.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{t("admin.no_events")}</p>
        ) : (
          <ul className="mt-4 grid gap-2">
            {events.map((event) => (
              <li key={event.id} className="rounded-2xl border border-line bg-background px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-foreground">{event.kind.replace(/_/g, " ")}</p>
                  <p className="text-muted">{stamp(event.created_at)}</p>
                </div>
                <p className="mt-1 text-muted">
                  {[event.actor_email, event.address, event.message].filter(Boolean).join(" · ") || "—"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6 flex justify-end">
        <button type="button" onClick={() => setDeleteOpen(true)} disabled={deleting} className={dangerButton}>
          {t("dashboard.delete")}
        </button>
      </div>
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
      <ConfirmModal
        open={rejectOpen}
        title={t("admin.reject")}
        body={t("admin.reason")}
        confirmLabel={t("admin.reject")}
        cancelLabel={t("dashboard.keep")}
        danger
        pending={deciding}
        onCancel={() => {
          setRejectOpen(false);
          setRejectNote("");
        }}
        onConfirm={() => void reject()}
      >
        <label className="mt-4 block text-sm text-muted">
          {t("admin.reason")}
          <textarea value={rejectNote} onChange={(event) => setRejectNote(event.target.value)} className={textareaClass} />
        </label>
      </ConfirmModal>
    </AdminShell>
  );
}

function BranchRecord({
  branch,
  href,
  stamp,
}: {
  branch: Branch;
  href: string;
  stamp: (value: string | null) => string;
}) {
  const { t } = useI18n();
  const notes = branch.status === "rejected" ? branch.field_errors : branch.admin_notes;
  return (
    <article className="rounded-2xl border border-line bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{branch.address || t("branch.no_address")}</p>
          <p className="mt-0.5 text-xs text-muted">
            {branch.is_main ? `${t("branch.main")} · ` : ""}
            {branch.id}
          </p>
        </div>
        <BranchPillView branch={branch} />
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <Fact label={t("business.city")}>{branch.city || "—"}</Fact>
        <Fact label={t("business.timezone")}>{branch.timezone}</Fact>
        <Fact label={t("admin.in_app")}>{branch.visible ? t("admin.visible_in_app") : t("admin.hidden_from_app")}</Fact>
        <Fact label={t("admin.hidden_by")}>{branch.hidden_by || "—"}</Fact>
        <Fact label={t("admin.hidden_reason")}>{branch.hidden_reason || "—"}</Fact>
        <Fact label={t("admin.place_ref")}>
          {branch.place_ref ? `${branch.place_ref.provider} · ${branch.place_ref.id}` : "—"}
        </Fact>
        <Fact label={t("admin.coordinates")}>
          {branch.location ? `${branch.location.coordinates[1].toFixed(6)}, ${branch.location.coordinates[0].toFixed(6)}` : "—"}
        </Fact>
        <Fact label={t("business.phones")}>
          <PhoneLinks phones={branch.phone} />
        </Fact>
        <Fact label={t("business.website")}>{branch.website || "—"}</Fact>
        <Fact label={t("business.instagram")}>{branch.instagram || "—"}</Fact>
        <Fact label={t("admin.created_at")}>{stamp(branch.created_at)}</Fact>
        <Fact label={t("admin.updated_at")}>{stamp(branch.updated_at)}</Fact>
        <Fact label={t("admin.submitted_at")}>{stamp(branch.submitted_at)}</Fact>
        <Fact label={t("admin.reviewed_at")}>{stamp(branch.reviewed_at)}</Fact>
      </dl>
      {branch.rejection_reason ? <p className="mt-3 text-sm text-[#B91C1C]">{branch.rejection_reason}</p> : null}
      <div className="mt-4">
        <p className="text-xs text-muted">{t("business.hours")}</p>
        <div className="mt-1 text-sm text-foreground">
          <HoursSummary hours={branch.opening_hours} />
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {branch.services.length === 0 ? (
          <p className="text-sm text-muted">{t("branch.no_services")}</p>
        ) : (
          branch.services.map((service) => (
            <div key={service.id} className="rounded-xl bg-surface p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">{t(`categories.${service.category}`)}</span>
                <span className="text-xs text-muted">
                  {service.status}
                  {service.visible ? "" : ` · ${t("admin.hidden_from_app")}`}
                </span>
              </div>
              <p className="mt-1 break-all text-xs text-muted">{service.id}</p>
              <div className="mt-2 text-xs text-foreground">
                <HoursSummary hours={service.opening_hours} />
              </div>
              {service.phone.length ? (
                <p className="mt-2 text-xs text-muted">
                  <PhoneLinks phones={service.phone} />
                </p>
              ) : null}
            </div>
          ))
        )}
      </div>
      {branch.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={branch.photo} alt="" className="mt-3 h-28 w-full rounded-xl object-cover" />
      ) : null}
      {Object.keys(notes).length ? <NoteList title={t("admin.branch_notes")} items={notes} danger={branch.status === "rejected"} /> : null}
      <Link href={href} className="mt-4 inline-flex text-sm font-medium text-brand">
        {t("branch.edit")}
      </Link>
    </article>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

function NoteList({ title, items, danger }: { title: string; items: Record<string, string>; danger?: boolean }) {
  return (
    <div className={`mt-5 rounded-2xl p-4 ${danger ? "bg-[#FEF2F2]" : "bg-[#EEF3F2]"}`}>
      <p className={`text-sm font-medium ${danger ? "text-[#B91C1C]" : "text-foreground"}`}>{title}</p>
      <ul className="mt-2 grid gap-2">
        {Object.entries(items).map(([field, message]) => (
          <li key={field} className="text-sm text-foreground">
            <span className="font-medium">{field}</span>
            <span className="mt-0.5 block">{message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatWhen(value: string | null, locale: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}

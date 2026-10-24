"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { branchHref } from "./branch-card";
import { BranchSummary } from "./business-details";
import { BusinessEditor } from "./business-editor";
import { LogoBadge } from "./business-logo";
import { ConfirmModal } from "./confirm-modal";
import { dangerButton, inputClass, secondaryButton } from "./form-controls";
import { VisibilityControl } from "./visibility-control";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { auth } from "@/lib/firebase";
import { errorMessage } from "@/lib/errors";
import { CATEGORIES, type Business, type BusinessCategory, type BusinessPage, type Invitation } from "@/lib/business";
import { useI18n } from "@/lib/i18n";

type Ownership = "all" | "owned" | "unowned";
type StatusFilter = Business["status"] | "all";

export function BusinessDirectory({
  status,
  onStatusChange,
  reloadKey,
  initialId,
  onDeleted,
}: {
  status: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  reloadKey: number;
  /** Open this business first, e.g. coming back from the branch editor. */
  initialId?: string | null;
  onDeleted: (businessId: string) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<BusinessCategory | "all">("all");
  const [ownership, setOwnership] = useState<Ownership>("all");
  const [items, setItems] = useState<Business[]>([]);
  const [extra, setExtra] = useState<Business | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(initialId ?? null);
  const [listOnly, setListOnly] = useState(false);
  const [editing, setEditing] = useState(false);
  const skipRef = useRef(0);
  const loadingRef = useRef(false);
  const requestRef = useRef(0);
  const sentinelRef = useRef<HTMLLIElement>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteNotice, setInviteNotice] = useState("");
  const [inviting, setInviting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const selected = listOnly
    ? null
    : (items.find((business) => business.id === selectedId) ?? (extra?.id === selectedId ? extra : null) ?? items[0] ?? null);

  async function loadPage(reset: boolean) {
    const user = auth.currentUser;
    if (!user) return;
    if (!reset && loadingRef.current) return;
    const requestId = ++requestRef.current;
    loadingRef.current = true;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const nextSkip = reset ? 0 : skipRef.current;
      const params = new URLSearchParams({ skip: String(nextSkip), limit: "20", sort: "name", ownership });
      if (status !== "all") params.set("status", status);
      if (category !== "all") params.set("category", category);
      if (query.trim()) params.set("q", query.trim());
      const page = await apiGet<BusinessPage>(`/admin/businesses/page?${params}`, token);
      if (requestId !== requestRef.current) return;
      skipRef.current = nextSkip + page.items.length;
      setHasMore(page.has_more);
      setItems((current) => (reset ? page.items : [...current, ...page.items]));
    } catch (err: unknown) {
      if (requestId === requestRef.current) setInviteError(errorMessage(err, t));
    } finally {
      if (requestId === requestRef.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    skipRef.current = 0;
    const handle = window.setTimeout(() => {
      void loadPage(true);
    }, query.trim() ? 250 : 0);
    return () => window.clearTimeout(handle);
    // loadPage closes over the filters that this effect lists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, category, ownership, query, reloadKey]);

  useEffect(() => {
    if (!initialId) return;
    let cancelled = false;
    void (async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const business = await apiGet<Business>(`/admin/businesses/${initialId}`, await user.getIdToken());
        if (!cancelled) {
          setExtra(business);
          setSelectedId(business.id);
        }
      } catch {
        // Not found any more; the list is enough.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialId, reloadKey]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadPage(false);
    });
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, items.length]);

  const contact = selected?.email || selected?.owner_email || "";

  function open(id: string) {
    setListOnly(false);
    setSelectedId(id);
    setEditing(false);
    setInviteEmail("");
    setInviteError("");
    setInviteNotice("");
  }

  function replace(business: Business) {
    setItems((current) => current.map((item) => (item.id === business.id ? business : item)));
    if (extra?.id === business.id) setExtra(business);
  }

  async function removeBusiness() {
    if (!selected || deleting) return;
    const user = auth.currentUser;
    if (!user) return;
    setDeleting(true);
    setInviteError("");
    try {
      await apiDelete(`/admin/businesses/${selected.id}`, await user.getIdToken());
      onDeleted(selected.id);
      setItems((current) => current.filter((item) => item.id !== selected.id));
      if (extra?.id === selected.id) setExtra(null);
      setSelectedId(null);
      setDeleteOpen(false);
    } catch (err: unknown) {
      setInviteError(errorMessage(err, t));
    } finally {
      setDeleting(false);
    }
  }

  async function sendInvite() {
    if (!selected || inviting || !inviteEmail.trim()) return;
    const user = auth.currentUser;
    if (!user) return;
    setInviting(true);
    setInviteError("");
    setInviteNotice("");
    try {
      const invitation = await apiPost<Invitation>(`/admin/businesses/${selected.id}/invitations`, await user.getIdToken(), {
        email: inviteEmail.trim().toLowerCase(),
      });
      replace({ ...selected, invitations: [invitation, ...selected.invitations] });
      setInviteEmail("");
      setInviteNotice(t("admin.invite_sent"));
    } catch (err: unknown) {
      setInviteError(errorMessage(err, t));
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
      <section className={selected ? "hidden lg:block" : "block"}>
        <div className="grid gap-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("admin.search")}
            className="h-11 w-full rounded-2xl border border-line bg-surface px-4 text-sm text-foreground outline-none focus:border-brand"
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Select label={t("business.category")} value={category} onChange={(value) => setCategory(value as BusinessCategory | "all")}>
              <option value="all">{t("admin.filter_all")}</option>
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {t(`categories.${item}`)}
                </option>
              ))}
            </Select>
            <Select label={t("admin.status_filter")} value={status} onChange={(value) => onStatusChange(value as StatusFilter)}>
              <option value="published">{t("admin.published")}</option>
              <option value="all">{t("admin.filter_all")}</option>
              <option value="pending_review">{t("admin.pending_review")}</option>
              <option value="rejected">{t("admin.rejected")}</option>
              <option value="draft">{t("status.draft")}</option>
              <option value="suspended">{t("admin.suspended")}</option>
            </Select>
            <Select label={t("admin.owner")} value={ownership} onChange={(value) => setOwnership(value as Ownership)}>
              <option value="all">{t("admin.filter_all")}</option>
              <option value="owned">{t("admin.owned")}</option>
              <option value="unowned">{t("admin.not_owned")}</option>
            </Select>
          </div>
        </div>
        {!loading && items.length === 0 ? (
          <p className="mt-4 text-sm text-muted">{t("admin.directory_empty")}</p>
        ) : (
          <ul className="mt-4 grid gap-2">
            {items.map((business) => {
              const active = business.id === selected?.id;
              return (
                <li key={business.id}>
                  <button
                    type="button"
                    onClick={() => open(business.id)}
                    className={
                      active
                        ? "flex w-full items-center gap-3 rounded-2xl border border-brand bg-surface px-4 py-3 text-start"
                        : "flex w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-start hover:border-brand"
                    }
                  >
                    <LogoBadge business={business} size="h-12 w-12" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{business.name}</span>
                      <span className="mt-1 block truncate text-sm text-muted">
                        {business.categories.length ? business.categories.map((item) => t(`categories.${item}`)).join(" · ") : t("business.no_services_yet")}
                        {business.city ? ` · ${business.city}` : ""}
                      </span>
                      <span className="mt-2 inline-flex rounded-full bg-[#EEF3F2] px-2 py-0.5 text-xs font-medium text-brand">
                        {business.owned ? t("admin.owned") : t("admin.not_owned")}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            <li ref={sentinelRef} className="h-1" />
          </ul>
        )}
      </section>
      <section className={selected ? "rounded-3xl border border-line bg-surface p-5 sm:p-6" : "hidden"}>
        {selected ? (
          <div>
            <button type="button" onClick={() => setListOnly(true)} className="text-sm font-medium text-brand lg:hidden">
              {t("admin.back_to_list")}
            </button>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-4 lg:mt-0">
              <div className="flex min-w-0 items-center gap-4">
                <LogoBadge business={selected} size="h-16 w-16" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-xl font-medium text-foreground">{selected.name}</h2>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {selected.owned ? selected.owner_email || t("admin.owned") : t("admin.not_owned")}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <VisibilityControl business={selected} onChanged={replace} />
                <button type="button" onClick={() => setEditing((value) => !value)} className={secondaryButton}>
                  {editing ? t("done") : t("dashboard.edit_business")}
                </button>
                {contact ? (
                  <a href={`mailto:${contact}?subject=${encodeURIComponent(selected.name)}`} className={secondaryButton}>
                    {t("admin.email_owner")}
                  </a>
                ) : null}
              </div>
            </div>

            {editing ? (
              <div className="mt-6 border-t border-line pt-6">
                <BusinessEditor business={selected} scope="admin" onChanged={replace} onClose={() => setEditing(false)} />
              </div>
            ) : null}

            <div className="mt-6 border-t border-line pt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-medium text-foreground">{t("dashboard.branches")}</h3>
                <Link href={branchHref(selected)} className={secondaryButton}>
                  + {t("dashboard.add_branch")}
                </Link>
              </div>
              {selected.locations.length === 0 ? (
                <p className="mt-3 text-sm text-muted">{t("dashboard.no_branches")}</p>
              ) : (
                <ul className="mt-3 grid gap-3">
                  {selected.locations.map((branch) => (
                    <li key={branch.id}>
                      <BranchSummary branch={branch} />
                      <div className="mt-2 flex justify-end">
                        <Link href={branchHref(selected, branch)} className="text-sm font-medium text-brand">
                          {t("branch.edit")}
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <form
              className="mt-6 grid gap-3 rounded-2xl bg-background p-4"
              onSubmit={(event) => {
                event.preventDefault();
                void sendInvite();
              }}
            >
              <p className="text-sm font-medium text-foreground">{t("admin.invite_owner")}</p>
              <label className="block text-sm text-muted">
                {t("admin.invite_email")}
                <input type="email" required value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} className={`${inputClass} bg-surface`} />
              </label>
              {inviteError ? (
                <p className="text-sm text-[#EF4444]" role="alert">
                  {inviteError}
                </p>
              ) : null}
              {inviteNotice ? <p className="text-sm text-brand">{inviteNotice}</p> : null}
              <div>
                <button type="submit" disabled={inviting} className={secondaryButton}>
                  {t("admin.send_invite")}
                </button>
              </div>
              {selected.invitations.length > 0 ? (
                <ul className="grid gap-2">
                  {selected.invitations.map((invitation) => (
                    <li key={invitation.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-foreground">
                        {invitation.email} · {t(`admin.role_${invitation.role}`)}
                      </span>
                      <span className="text-muted">{t(`admin.${invitation.status}`)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </form>

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
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <label className="block text-xs text-muted">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-11 w-full rounded-2xl border border-line bg-surface px-3 text-sm text-foreground outline-none focus:border-brand"
      >
        {children}
      </select>
    </label>
  );
}

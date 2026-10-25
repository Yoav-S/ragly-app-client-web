"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ActionMenu, menuItemClass } from "./action-menu";
import { branchHref } from "./branch-card";
import { BranchSummary } from "./business-details";
import { BusinessEditor } from "./business-editor";
import { FadeIn } from "./fade-in";
import { LogoBadge } from "./business-logo";
import { ConfirmModal } from "./confirm-modal";
import { dangerButton, inputClass, secondaryButton } from "./form-controls";
import { BusinessPillView } from "./status-pill";
import { VisibilityControl } from "./visibility-control";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { auth } from "@/lib/firebase";
import { errorMessage } from "@/lib/errors";
import { CATEGORIES, type Business, type BusinessCategory, type BusinessPage, type Invitation } from "@/lib/business";
import { useI18n } from "@/lib/i18n";

type Ownership = "all" | "owned" | "unowned";
type StatusFilter = Business["status"] | "all";

const PAGE_SIZE = 10;

type CachedPage = { items: Business[]; total: number };

export function BusinessDirectory({
  status,
  onStatusChange,
  query,
  reloadKey,
  initialId,
  onDeleted,
}: {
  status: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  query: string;
  reloadKey: number;
  /** Open this business first, e.g. coming back from the branch editor. */
  initialId?: string | null;
  onDeleted: (businessId: string) => void;
}) {
  const { t } = useI18n();
  const [category, setCategory] = useState<BusinessCategory | "all">("all");
  const [ownership, setOwnership] = useState<Ownership>("all");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Business[]>([]);
  const [total, setTotal] = useState(0);
  const [extra, setExtra] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(initialId ?? null);
  const [editing, setEditing] = useState(false);
  const cacheRef = useRef(new Map<string, CachedPage>());
  const requestRef = useRef(0);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteNotice, setInviteNotice] = useState("");
  const [inviting, setInviting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const selected = items.find((business) => business.id === selectedId) ?? (extra?.id === selectedId ? extra : null);

  function cacheKey(nextPage: number) {
    return JSON.stringify({ status, category, ownership, q: query.trim(), page: nextPage, reloadKey });
  }

  async function loadPage(nextPage: number) {
    const user = auth.currentUser;
    if (!user) return;
    const key = cacheKey(nextPage);
    const hit = cacheRef.current.get(key);
    if (hit) {
      setItems(hit.items);
      setTotal(hit.total);
      setLoading(false);
      return;
    }
    const requestId = ++requestRef.current;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const params = new URLSearchParams({
        skip: String((nextPage - 1) * PAGE_SIZE),
        limit: String(PAGE_SIZE),
        sort: "name",
        ownership,
      });
      if (status !== "all") params.set("status", status);
      if (category !== "all") params.set("category", category);
      if (query.trim()) params.set("q", query.trim());
      const body = await apiGet<BusinessPage>(`/admin/businesses/page?${params}`, token);
      if (requestId !== requestRef.current) return;
      cacheRef.current.set(key, { items: body.items, total: body.total });
      setItems(body.items);
      setTotal(body.total);
    } catch (err: unknown) {
      if (requestId === requestRef.current) setInviteError(errorMessage(err, t));
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    setPage(1);
  }, [status, category, ownership, query]);

  useEffect(() => {
    cacheRef.current.clear();
  }, [reloadKey]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadPage(page);
    }, query.trim() ? 250 : 0);
    return () => window.clearTimeout(handle);
    // loadPage closes over the filters that this effect lists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, category, ownership, query, page, reloadKey]);

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

  const contact = selected?.email || selected?.owner_email || "";
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function open(id: string) {
    setSelectedId((current) => (current === id ? null : id));
    setEditing(false);
    setInviteEmail("");
    setInviteError("");
    setInviteNotice("");
  }

  function replace(business: Business) {
    setItems((current) => current.map((item) => (item.id === business.id ? business : item)));
    if (extra?.id === business.id) setExtra(business);
    cacheRef.current.clear();
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
      cacheRef.current.clear();
      setItems((current) => current.filter((item) => item.id !== selected.id));
      setTotal((current) => Math.max(0, current - 1));
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
    <div className="mt-6">
      <div className="overflow-hidden rounded-[28px] border border-line bg-surface">
        <div className="flex flex-wrap items-end justify-between gap-3 px-5 py-4 sm:px-6">
          <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-3">
            <Select label={t("business.category")} value={category} onChange={(value) => setCategory(value as BusinessCategory | "all")}>
              <option value="all">{t("admin.filter_all")}</option>
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {t(`categories.${item}`)}
                </option>
              ))}
            </Select>
            <Select label={t("admin.status_filter")} value={status} onChange={(value) => onStatusChange(value as StatusFilter)}>
              <option value="all">{t("admin.filter_all")}</option>
              <option value="published">{t("admin.published")}</option>
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
          <Pager page={page} pages={pageCount} disabled={loading} onPage={setPage} />
        </div>

        {loading && items.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted">{t("loading")}</p>
        ) : items.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted">{t("admin.directory_empty")}</p>
        ) : (
          <div className="overflow-x-auto px-5 pb-5 sm:px-6">
            <div className="min-w-[44rem]">
              <div className={`${ROW_GRID} px-4 pb-3 text-xs font-medium text-muted`}>
                <p>{t("admin.column_business")}</p>
                <p>{t("admin.column_services")}</p>
                <p>{t("admin.column_status")}</p>
                <p>{t("admin.column_city")}</p>
              </div>
              <ul key={`${reloadKey}-${page}-${status}-${category}-${ownership}-${query}`} className="grid gap-2">
                {items.map((business, index) => {
                  const active = business.id === selected?.id;
                  return (
                    <li key={business.id}>
                      <FadeIn delay={index * 45}>
                        <button
                          type="button"
                          onClick={() => open(business.id)}
                          className={
                            active
                              ? `${ROW_GRID} w-full rounded-2xl border border-brand bg-[#EEF3F2] px-4 py-3 text-start`
                              : `${ROW_GRID} w-full rounded-2xl border border-line bg-surface px-4 py-3 text-start hover:border-brand/40 hover:bg-[#F7F8FA]`
                          }
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <LogoBadge business={business} size="h-11 w-11" rounded="rounded-full" />
                            <span className="truncate font-medium text-foreground">{business.name}</span>
                          </span>
                          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                            {business.categories.length ? (
                              business.categories.map((item) => (
                                <span
                                  key={item}
                                  className="inline-flex h-7 items-center rounded-full bg-[#F3F4F6] px-2.5 text-xs text-muted"
                                >
                                  {t(`categories.${item}`)}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-muted">{t("business.no_services_yet")}</span>
                            )}
                          </span>
                          <span>
                            <BusinessPillView status={business.status} visible={business.visible !== false} />
                          </span>
                          <span className="truncate text-sm text-muted">{business.city || "—"}</span>
                        </button>
                      </FadeIn>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </div>

      {selected ? (
        <section className="mt-5 rounded-3xl border border-line bg-surface p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <LogoBadge business={selected} size="h-16 w-16" />
              <div className="min-w-0">
                <h2 className="truncate text-xl font-medium text-foreground">{selected.name}</h2>
                <p className="mt-1 text-sm text-muted">
                  {selected.owned ? selected.owner_email || t("admin.owned") : t("admin.not_owned")}
                </p>
              </div>
            </div>
            <ActionMenu label={t("admin.more_actions")}>
              {(close) => (
                <>
                  <VisibilityControl business={selected} onChanged={replace} variant="menuItem" onDone={close} />
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
                  <Link href={branchHref(selected)} role="menuitem" onClick={close} className={menuItemClass}>
                    {t("dashboard.add_branch")}
                  </Link>
                  {selected.locations.map((branch) => (
                    <Link
                      key={branch.id}
                      href={branchHref(selected, branch)}
                      role="menuitem"
                      onClick={close}
                      className={menuItemClass}
                    >
                      {t("branch.edit")}
                      {branch.address ? ` · ${branch.address}` : ""}
                    </Link>
                  ))}
                  {contact ? (
                    <a
                      href={`mailto:${contact}?subject=${encodeURIComponent(selected.name)}`}
                      role="menuitem"
                      onClick={close}
                      className={menuItemClass}
                    >
                      {t("admin.email_owner")}
                    </a>
                  ) : null}
                </>
              )}
            </ActionMenu>
          </div>

          {editing ? (
            <div className="mt-6 border-t border-line pt-6">
              <BusinessEditor business={selected} scope="admin" onChanged={replace} onClose={() => setEditing(false)} />
            </div>
          ) : null}

          <div className="mt-6 border-t border-line pt-6">
            <h3 className="text-lg font-medium text-foreground">{t("dashboard.branches")}</h3>
            {selected.locations.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{t("dashboard.no_branches")}</p>
            ) : (
              <ul className="mt-3 grid gap-3">
                {selected.locations.map((branch) => (
                  <li key={branch.id}>
                    <BranchSummary branch={branch} />
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
        </section>
      ) : null}
    </div>
  );
}

const ROW_GRID = "grid grid-cols-[minmax(14rem,1.4fr)_minmax(12rem,1fr)_8.5rem_7rem] items-center gap-4";

function Pager({
  page,
  pages,
  disabled,
  onPage,
}: {
  page: number;
  pages: number;
  disabled?: boolean;
  onPage: (page: number) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex shrink-0 items-center gap-2">
      <p className="text-sm text-muted" aria-live="polite">
        {t("admin.page_short", { page, pages })}
      </p>
      <IconButton
        label={t("admin.prev_page")}
        disabled={disabled || page <= 1}
        onClick={() => onPage(page - 1)}
      >
        <Chevron direction="left" />
      </IconButton>
      <IconButton
        label={t("admin.next_page")}
        disabled={disabled || page >= pages}
        onClick={() => onPage(page + 1)}
      >
        <Chevron direction="right" />
      </IconButton>
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-foreground hover:border-brand disabled:cursor-not-allowed disabled:text-muted disabled:hover:border-line"
    >
      {children}
    </button>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2">
      {direction === "left" ? (
        <path d="M14.5 6.5 9 12l5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M9.5 6.5 15 12l-5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <label className="block text-xs text-muted">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-full border border-line bg-background px-3 text-sm text-foreground outline-none focus:border-brand"
      >
        {children}
      </select>
    </label>
  );
}

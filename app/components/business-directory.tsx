"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ActionMenu, menuItemClass } from "./action-menu";
import { branchHref } from "./branch-card";
import { BranchSummary } from "./business-details";
import { BusinessEditor } from "./business-editor";
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
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
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

      <div className="overflow-hidden rounded-3xl border border-line bg-surface">
        {loading && items.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted">{t("loading")}</p>
        ) : items.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted">{t("admin.directory_empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th className="px-5 py-4 font-medium">{t("admin.column_business")}</th>
                  <th className="px-5 py-4 font-medium">{t("admin.column_services")}</th>
                  <th className="px-5 py-4 font-medium">{t("admin.column_status")}</th>
                  <th className="px-5 py-4 font-medium">{t("admin.column_city")}</th>
                  <th className="px-5 py-4 font-medium">{t("admin.owner")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((business) => {
                  const active = business.id === selected?.id;
                  return (
                    <tr
                      key={business.id}
                      onClick={() => open(business.id)}
                      className={active ? "cursor-pointer bg-[#EEF3F2]" : "cursor-pointer hover:bg-[#F7F8FA]"}
                    >
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-3">
                          <LogoBadge business={business} size="h-10 w-10" />
                          <span className="font-medium text-foreground">{business.name}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3 text-muted">
                        {business.categories.length
                          ? business.categories.map((item) => t(`categories.${item}`)).join(" · ")
                          : t("business.no_services_yet")}
                      </td>
                      <td className="px-5 py-3">
                        <BusinessPillView status={business.status} visible={business.visible !== false} />
                      </td>
                      <td className="px-5 py-3 text-muted">{business.city || "—"}</td>
                      <td className="px-5 py-3 text-muted">{business.owned ? business.owner_email || t("admin.owned") : t("admin.not_owned")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {total > PAGE_SIZE ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
            <p className="text-sm text-muted">{t("admin.page_of", { page, pages: pageCount })}</p>
            <div className="flex flex-wrap gap-1">
              {pageNumbers(page, pageCount).map((number) => (
                <button
                  key={number}
                  type="button"
                  onClick={() => setPage(number)}
                  className={
                    number === page
                      ? "inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-[#111827] px-3 text-sm font-medium text-white"
                      : "inline-flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm font-medium text-muted hover:bg-[#EEF3F2]"
                  }
                >
                  {number}
                </button>
              ))}
            </div>
          </div>
        ) : null}
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

function pageNumbers(current: number, count: number) {
  const windowSize = 7;
  const start = Math.max(1, Math.min(current - 3, count - windowSize + 1));
  const end = Math.min(count, start + windowSize - 1);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
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

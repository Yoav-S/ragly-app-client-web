"use client";

import { useMemo, useState, type ReactNode } from "react";
import { BusinessDetails } from "./business-details";
import { BusinessForm } from "./business-form";
import { apiDelete, apiPost } from "@/lib/api";
import { auth } from "@/lib/firebase";
import { errorMessage } from "@/lib/errors";
import {
  CATEGORIES,
  type Business,
  type BusinessCategory,
  type Invitation,
} from "@/lib/business";
import { useI18n } from "@/lib/i18n";

const CATEGORY_ORDER: BusinessCategory[] = [
  "veterinarian",
  "groomer",
  "pharmacy",
  "pet_friendly",
  "pet_store",
];

type SortKey = "category" | "name" | "city";
type Ownership = "all" | "owned" | "unowned";

export function BusinessDirectory({
  items,
  onUpdated,
  onInvited,
  onDeleted,
}: {
  items: Business[];
  onUpdated: (business: Business) => void;
  onInvited: (businessId: string, invitation: Invitation) => void;
  onDeleted: (businessId: string) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<BusinessCategory | "all">("all");
  const [ownership, setOwnership] = useState<Ownership>("all");
  const [sort, setSort] = useState<SortKey>("category");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteNotice, setInviteNotice] = useState("");
  const [inviting, setInviting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = items.filter((business) => {
      if (category !== "all" && business.category !== category) return false;
      if (ownership === "owned" && !business.owned) return false;
      if (ownership === "unowned" && business.owned) return false;
      if (!needle) return true;
      return [business.name, business.city, business.address]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
    return filtered.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "city") return a.city.localeCompare(b.city) || a.name.localeCompare(b.name);
      const categoryDelta =
        CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
      return categoryDelta || a.name.localeCompare(b.name);
    });
  }, [items, query, category, ownership, sort]);

  const selected = items.find((business) => business.id === selectedId) ?? null;
  const contact = selected?.email || selected?.owner_email || "";

  function open(id: string) {
    setSelectedId(id);
    setEditing(false);
    setInviteEmail("");
    setInviteError("");
    setInviteNotice("");
  }

  async function removeBusiness() {
    if (!selected || deleting) return;
    const user = auth.currentUser;
    if (!user) return;
    setDeleting(true);
    setInviteError("");
    try {
      const token = await user.getIdToken();
      await apiDelete(`/admin/businesses/${selected.id}`, token);
      onDeleted(selected.id);
      setSelectedId(null);
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
      const token = await user.getIdToken();
      const invitation = await apiPost<Invitation>(
        `/admin/businesses/${selected.id}/invitations`,
        token,
        { email: inviteEmail.trim().toLowerCase() },
      );
      onInvited(selected.id, invitation);
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
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <Select
              label={t("business.category")}
              value={category}
              onChange={(value) => setCategory(value as BusinessCategory | "all")}
            >
              <option value="all">{t("admin.filter_all")}</option>
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {t(`business.${item}`)}
                </option>
              ))}
            </Select>
            <Select
              label={t("admin.owner")}
              value={ownership}
              onChange={(value) => setOwnership(value as Ownership)}
            >
              <option value="all">{t("admin.filter_all")}</option>
              <option value="owned">{t("admin.owned")}</option>
              <option value="unowned">{t("admin.not_owned")}</option>
            </Select>
            <Select label={t("admin.sort")} value={sort} onChange={(value) => setSort(value as SortKey)}>
              <option value="category">{t("admin.sort_category")}</option>
              <option value="name">{t("admin.sort_name")}</option>
              <option value="city">{t("admin.sort_city")}</option>
            </Select>
          </div>
        </div>
        {visible.length === 0 ? (
          <p className="mt-4 text-sm text-muted">{t("admin.directory_empty")}</p>
        ) : (
          <ul className="mt-4 grid gap-2">
            {visible.map((business) => {
              const active = business.id === selectedId;
              return (
                <li key={business.id}>
                  <button
                    type="button"
                    onClick={() => open(business.id)}
                    className={
                      active
                        ? "w-full rounded-2xl border border-brand bg-surface px-4 py-3 text-start"
                        : "w-full rounded-2xl border border-line bg-surface px-4 py-3 text-start hover:border-brand"
                    }
                  >
                    <span className="block text-sm font-medium text-foreground">{business.name}</span>
                    <span className="mt-1 block text-sm text-muted">
                      {t(`business.${business.category}`)} · {business.city}
                    </span>
                    <span className="mt-2 inline-flex rounded-full bg-[#EEF3F2] px-2 py-0.5 text-xs font-medium text-brand">
                      {business.owned ? t("admin.owned") : t("admin.not_owned")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section
        className={
          selected
            ? "rounded-3xl border border-line bg-surface p-5 sm:p-6"
            : "hidden rounded-3xl border border-dashed border-line bg-surface p-8 text-sm text-muted lg:block"
        }
      >
        {selected ? (
          <div>
            <button
              type="button"
              onClick={() => {
                setSelectedId(null);
                setEditing(false);
              }}
              className="text-sm font-medium text-brand lg:hidden"
            >
              {t("admin.back_to_list")}
            </button>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row lg:mt-0">
              <button
                type="button"
                onClick={() => setEditing((current) => !current)}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-brand px-4 text-sm font-medium text-white"
              >
                {editing ? t("admin.view") : t("admin.update")}
              </button>
              <button
                type="button"
                onClick={() => void removeBusiness()}
                disabled={deleting}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-line px-4 text-sm font-medium text-[#EF4444] disabled:text-muted"
              >
                {t("dashboard.delete")}
              </button>
              {contact ? (
                <a
                  href={`mailto:${contact}?subject=${encodeURIComponent(selected.name)}`}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-line px-4 text-sm font-medium text-foreground"
                >
                  {t("admin.email_owner")}
                </a>
              ) : null}
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
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  className="mt-2 h-11 w-full rounded-2xl border border-line bg-surface px-4 text-sm text-foreground outline-none focus:border-brand"
                />
              </label>
              {inviteError ? (
                <p className="text-sm text-[#EF4444]" role="alert">
                  {inviteError}
                </p>
              ) : null}
              {inviteNotice ? <p className="text-sm text-brand">{inviteNotice}</p> : null}
              <button
                type="submit"
                disabled={inviting}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-line px-4 text-sm font-medium text-foreground disabled:text-muted"
              >
                {t("admin.send_invite")}
              </button>
              {(selected.invitations ?? []).length > 0 ? (
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
            {editing ? (
              <div className="mt-6">
                <BusinessForm
                  key={selected.id}
                  mode="edit"
                  initial={selected}
                  onSubmitted={(business) => {
                    onUpdated(business);
                    setEditing(false);
                  }}
                />
              </div>
            ) : (
              <div className="mt-6">
                <BusinessDetails business={selected} />
              </div>
            )}
          </div>
        ) : (
          t("admin.pick_business")
        )}
      </section>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
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

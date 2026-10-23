"use client";

import { useState } from "react";
import { BranchSummary, BusinessDetails } from "./business-details";
import { inputClass, primaryButton, secondaryButton } from "./form-controls";
import { apiPost } from "@/lib/api";
import {
  BRANCH_NOTE_FIELDS,
  BUSINESS_NOTE_FIELDS,
  fieldLabelKey,
  type Branch,
  type Business,
  type ReviewBranch,
  type ReviewGroup,
} from "@/lib/business";
import { auth } from "@/lib/firebase";
import { errorMessage } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";

function since(iso: string | null, locale: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}

/** Everything waiting for a decision, one card per business. */
export function AdminReview({
  groups,
  onDecided,
}: {
  groups: ReviewGroup[];
  /** Called with the updated branch/business after approve or reject. */
  onDecided: (businessId: string) => void;
}) {
  const { t } = useI18n();
  if (groups.length === 0) {
    return <p className="mt-4 rounded-2xl bg-surface px-4 py-10 text-center text-sm text-muted">{t("admin.empty_pending")}</p>;
  }
  return (
    <ul className="mt-4 grid gap-5">
      {groups.map((group) => (
        <li key={group.business.id}>
          <ReviewCard group={group} onDecided={() => onDecided(group.business.id)} />
        </li>
      ))}
    </ul>
  );
}

function ReviewCard({ group, onDecided }: { group: ReviewGroup; onDecided: () => void }) {
  const { t, locale } = useI18n();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const business = group.business;
  const waiting = group.branches;
  const multi = waiting.length > 1;

  function noteFor(key: string): string {
    return notes[key] ?? "";
  }

  function collect(prefix: string | null, keys: readonly string[]): Record<string, string> {
    const out: Record<string, string> = {};
    for (const key of keys) {
      const full = prefix ? `${prefix}|${key}` : key;
      const text = noteFor(full).trim();
      if (text) out[key] = text;
    }
    return out;
  }

  function businessNotes(): Record<string, string> {
    return collect("business", BUSINESS_NOTE_FIELDS);
  }

  function branchNotes(item: ReviewBranch): Record<string, string> {
    const keys = [...BRANCH_NOTE_FIELDS, ...item.branch.services.map((service) => `service:${service.category}`)];
    return collect(item.branch.id, keys);
  }

  async function decideBranch(item: ReviewBranch, action: "approve" | "reject") {
    const user = auth.currentUser;
    if (!user || busy) return;
    const perBranch = branchNotes(item);
    const perBusiness = group.first_request ? businessNotes() : {};
    const all = { ...perBusiness, ...perBranch };
    if (action === "reject" && Object.keys(all).length === 0) {
      setError(t("admin.reject_needs_note"));
      return;
    }
    setBusy(item.branch.id + action);
    setError("");
    try {
      const token = await user.getIdToken();
      if (group.first_request || Object.keys(perBusiness).length) {
        // Business-level notes travel with the business decision so they land on the business.
        await apiPost<Business>(
          `/admin/businesses/${business.id}/${action}`,
          token,
          action === "reject" ? { field_errors: all } : { field_notes: all },
        );
      } else {
        await apiPost<Branch>(
          `/admin/locations/${item.branch.id}/${action}`,
          token,
          action === "reject" ? { field_errors: perBranch } : { field_notes: perBranch },
        );
      }
      onDecided();
    } catch (err: unknown) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(null);
    }
  }

  async function decideAll(action: "approve" | "reject") {
    const user = auth.currentUser;
    if (!user || busy) return;
    const all: Record<string, string> = { ...businessNotes() };
    for (const item of waiting) Object.assign(all, branchNotes(item));
    if (action === "reject" && Object.keys(all).length === 0) {
      setError(t("admin.reject_needs_note"));
      return;
    }
    setBusy(`all${action}`);
    setError("");
    try {
      await apiPost<Business>(
        `/admin/businesses/${business.id}/${action}`,
        await user.getIdToken(),
        action === "reject" ? { field_errors: all } : { field_notes: all },
      );
      onDecided();
    } catch (err: unknown) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        {group.first_request ? (
          <span className="rounded-full bg-[#FEF3C7] px-2.5 py-1 text-xs font-medium text-[#92400E]">{t("admin.first_request")}</span>
        ) : (
          <span className="rounded-full bg-[#EEF3F2] px-2.5 py-1 text-xs font-medium text-brand">{t("admin.existing_business")}</span>
        )}
        {group.waiting_since ? (
          <span className="text-xs text-muted">{t("admin.waiting_since", { when: since(group.waiting_since, locale) })}</span>
        ) : null}
        {group.owner_email ? (
          <a href={`mailto:${group.owner_email}`} className="ms-auto text-xs font-medium text-brand">
            {group.owner_email}
          </a>
        ) : null}
      </div>

      <div className="mt-5">
        <BusinessDetails business={business} showBranches={false} />
      </div>

      {group.first_request ? (
        <details className="mt-5 rounded-2xl bg-background p-4">
          <summary className="cursor-pointer text-sm font-medium text-foreground">{t("admin.business_notes")}</summary>
          <p className="mt-1 text-xs text-muted">{t("admin.business_notes_hint")}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {BUSINESS_NOTE_FIELDS.map((field) => (
              <NoteInput
                key={field}
                label={t(fieldLabelKey(field))}
                value={noteFor(`business|${field}`)}
                onChange={(value) => setNotes((current) => ({ ...current, [`business|${field}`]: value }))}
              />
            ))}
          </div>
        </details>
      ) : null}

      <div className="mt-6 grid gap-5">
        {waiting.map((item) => (
          <div key={item.branch.id} className="rounded-2xl border border-line p-4">
            <BranchSummary branch={item.branch} />
            {item.conflicts.length > 0 ? (
              <div className="mt-3 rounded-xl bg-[#FEF3C7] px-3 py-2 text-sm text-[#92400E]">
                <p className="font-medium">{t("admin.conflict_title")}</p>
                <ul className="mt-1 grid gap-1">
                  {item.conflicts.map((conflict) => (
                    <li key={conflict.business_id + conflict.address}>
                      {conflict.business_name} · {conflict.address} ·{" "}
                      {conflict.same_place_ref ? t("admin.conflict_same_place") : t("admin.conflict_distance", { m: Math.round(conflict.distance_m) })}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <details className="mt-3 rounded-2xl bg-background p-4">
              <summary className="cursor-pointer text-sm font-medium text-foreground">{t("admin.branch_notes")}</summary>
              <p className="mt-1 text-xs text-muted">{t("admin.branch_notes_hint")}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {BRANCH_NOTE_FIELDS.map((field) => (
                  <NoteInput
                    key={field}
                    label={t(fieldLabelKey(field))}
                    value={noteFor(`${item.branch.id}|${field}`)}
                    onChange={(value) => setNotes((current) => ({ ...current, [`${item.branch.id}|${field}`]: value }))}
                    wide={field === "general"}
                  />
                ))}
                {item.branch.services.map((service) => (
                  <NoteInput
                    key={service.id}
                    label={`${t("branch.service")}: ${t(`categories.${service.category}`)}`}
                    value={noteFor(`${item.branch.id}|service:${service.category}`)}
                    onChange={(value) => setNotes((current) => ({ ...current, [`${item.branch.id}|service:${service.category}`]: value }))}
                  />
                ))}
              </div>
            </details>
            {!multi || !group.first_request ? (
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void decideBranch(item, "approve")}
                  className={primaryButton}
                >
                  {busy === item.branch.id + "approve" ? t("saving") : t("admin.approve")}
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void decideBranch(item, "reject")}
                  className={`${secondaryButton} text-[#EF4444]`}
                >
                  {busy === item.branch.id + "reject" ? t("saving") : t("admin.reject")}
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {multi && group.first_request ? (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button type="button" disabled={busy !== null} onClick={() => void decideAll("approve")} className={primaryButton}>
            {busy === "allapprove" ? t("saving") : t("admin.approve_all", { n: waiting.length })}
          </button>
          <button type="button" disabled={busy !== null} onClick={() => void decideAll("reject")} className={`${secondaryButton} text-[#EF4444]`}>
            {busy === "allreject" ? t("saving") : t("admin.reject_all")}
          </button>
        </div>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-[#EF4444]" role="alert">
          {error}
        </p>
      ) : null}
    </article>
  );
}

function NoteInput({
  label,
  value,
  onChange,
  wide = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  wide?: boolean;
}) {
  return (
    <label className={`block text-xs text-muted ${wide ? "sm:col-span-2" : ""}`}>
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} maxLength={500} className={`${inputClass} mt-1 bg-surface`} />
    </label>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { ConfirmModal } from "./confirm-modal";
import { secondaryButton } from "./form-controls";
import { HoursSummary } from "./hours-editor";
import { BranchPillView } from "./status-pill";
import { ApiError, apiDelete, apiPatch, apiPost } from "@/lib/api";
import { fieldLabelKey, type Branch, type Business } from "@/lib/business";
import { auth } from "@/lib/firebase";
import { errorMessage } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";

export function branchHref(business: Business, branch?: Branch): string {
  return `/dashboard/branches/${branch ? branch.id : "new"}?business=${business.id}`;
}

export function BranchCard({
  business,
  branch,
  canManage,
  onChanged,
  onDeleted,
}: {
  business: Business;
  branch: Branch;
  canManage: boolean;
  onChanged: (branch: Branch) => void;
  onDeleted: (branch: Branch) => void;
}) {
  const { t } = useI18n();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const base = `/businesses/${business.id}/locations/${branch.id}`;
  const notes = branch.status === "rejected" ? branch.field_errors : branch.admin_notes;
  const pendingServices = branch.services.filter((service) => service.status === "pending_review");

  async function run(action: () => Promise<void>) {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await action();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === "branch_incomplete" && err.fields.length) {
        setError(
          t("branch.incomplete", {
            fields: err.fields.map((field) => t(fieldLabelKey(field))).join(", "),
          }),
        );
      } else {
        setError(errorMessage(err, t));
      }
    } finally {
      setPending(false);
    }
  }

  async function token(): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new ApiError(401, null, "unauthorized");
    return user.getIdToken();
  }

  const send = () => run(async () => onChanged(await apiPost<Branch>(`${base}/send`, await token(), {})));
  const withdraw = () => run(async () => onChanged(await apiPost<Branch>(`${base}/withdraw`, await token(), {})));
  const setVisible = (visible: boolean) =>
    run(async () => onChanged(await apiPatch<Branch>(`${base}/visibility`, await token(), { visible, reason: null })));
  const remove = () =>
    run(async () => {
      await apiDelete(base, await token());
      setDeleteOpen(false);
      onDeleted(branch);
    });

  return (
    <article className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-medium text-foreground">{branch.address || t("branch.no_address")}</h3>
            {branch.is_main && business.locations.length > 1 ? (
              <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted">{t("branch.main")}</span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted">
            {branch.services.length
              ? branch.services.map((service) => t(`categories.${service.category}`)).join(" · ")
              : t("branch.no_services")}
            {branch.city ? ` · ${branch.city}` : ""}
          </p>
        </div>
        <BranchPillView branch={branch} />
      </div>

      <StatusLine branch={branch} pendingServices={pendingServices.map((service) => t(`categories.${service.category}`))} />

      {Object.keys(notes).length > 0 ? (
        <div className={`mt-4 rounded-2xl p-4 ${branch.status === "rejected" ? "bg-[#FEF2F2]" : "bg-[#EEF3F2]"}`}>
          <p className={`text-sm font-medium ${branch.status === "rejected" ? "text-[#B91C1C]" : "text-foreground"}`}>
            {branch.status === "rejected" ? t("dashboard.fix_these") : t("dashboard.notes_title")}
          </p>
          <ul className="mt-2 grid gap-2">
            {Object.entries(notes).map(([field, message]) => (
              <li key={field} className="text-sm text-foreground">
                <span className="font-medium">{field.startsWith("service:") ? t(`categories.${field.slice(8)}`) : t(fieldLabelKey(field))}</span>
                <span className="mt-0.5 block">{message}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {open ? (
        <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
          {branch.services.map((service) => (
            <div key={service.id} className="rounded-xl bg-background p-3 text-sm">
              <p className="font-medium text-foreground">{t(`categories.${service.category}`)}</p>
              <div className="mt-2 text-xs text-foreground">
                <HoursSummary hours={service.opening_hours} />
              </div>
              {service.phone.length ? <p className="mt-2 text-xs text-muted">{service.phone.join(", ")}</p> : null}
            </div>
          ))}
          {branch.phone.length || branch.website || branch.instagram ? (
            <p className="text-xs text-muted sm:col-span-2">
              {[branch.phone.join(", "), branch.website, branch.instagram].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-[#EF4444]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {branch.services.length ? (
          <button type="button" onClick={() => setOpen((value) => !value)} className="text-sm font-medium text-muted hover:text-foreground">
            {open ? t("branch.hide_details") : t("branch.show_details")}
          </button>
        ) : null}
        {canManage ? (
          <div className="ms-auto flex flex-wrap gap-2">
            {branch.status === "pending_review" ? (
              <button type="button" disabled={pending} onClick={() => void withdraw()} className={secondaryButton}>
                {t("branch.withdraw")}
              </button>
            ) : null}
            {branch.status === "published" && (branch.visible || branch.hidden_by !== "admin") ? (
              <button type="button" disabled={pending} onClick={() => void setVisible(!branch.visible)} className={secondaryButton}>
                {branch.visible ? t("branch.pause") : t("branch.resume")}
              </button>
            ) : null}
            {branch.status !== "published" ? (
              <button type="button" disabled={pending} onClick={() => setDeleteOpen(true)} className={`${secondaryButton} text-[#EF4444]`}>
                {t("dashboard.delete")}
              </button>
            ) : null}
            {branch.status !== "pending_review" ? (
              <Link href={branchHref(business, branch)} className={secondaryButton}>
                {t("branch.edit")}
              </Link>
            ) : null}
            {branch.status === "draft" || branch.status === "rejected" ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => void send()}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-brand px-5 text-sm font-medium text-white hover:bg-[#003a35] disabled:bg-[#8DB0AA]"
              >
                {branch.status === "rejected" ? t("branch.resend") : t("branch.send")}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <ConfirmModal
        open={deleteOpen}
        title={t("branch.delete_title")}
        body={t("branch.delete_body", { address: branch.address || t("branch.no_address") })}
        confirmLabel={t("dashboard.delete")}
        cancelLabel={t("dashboard.keep")}
        danger
        pending={pending}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => void remove()}
      />
    </article>
  );
}

function StatusLine({ branch, pendingServices }: { branch: Branch; pendingServices: string[] }) {
  const { t } = useI18n();
  let text: string | null = null;
  if (branch.status === "draft") text = t("branch.state_draft");
  else if (branch.status === "pending_review") text = t("branch.state_waiting");
  else if (branch.status === "rejected") text = t("branch.state_changes");
  else if (!branch.visible) text = branch.hidden_by === "admin" ? t("branch.state_paused_admin") : t("branch.state_paused");
  else if (pendingServices.length) text = t("branch.state_service_waiting", { services: pendingServices.join(", ") });
  else text = t("branch.state_active");
  return <p className="mt-3 text-sm leading-6 text-muted">{text}</p>;
}

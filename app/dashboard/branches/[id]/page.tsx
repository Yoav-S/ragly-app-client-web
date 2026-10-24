"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  BranchFields,
  branchDraftFrom,
  branchDraftHasProgress,
  cleanBranch,
  emptyBranchDraft,
  type BranchDraft,
  type BranchErrors,
} from "../../../components/branch-fields";
import { ConfirmModal } from "../../../components/confirm-modal";
import { Card, dangerButton, primaryButton, secondaryButton } from "../../../components/form-controls";
import { BranchPillView } from "../../../components/status-pill";
import { ApiError, apiDelete, apiGet, apiPatch, apiPost, apiUpload } from "@/lib/api";
import {
  BUSINESS_IMAGE_ACCEPT,
  businessLogo,
  fieldLabelKey,
  isBusinessImage,
  type Branch,
  type Business,
  type BusinessSession,
} from "@/lib/business";
import { auth } from "@/lib/firebase";
import { errorMessage } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";

export default function BranchPage() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10" />}>
      <BranchEditor />
    </Suspense>
  );
}

function BranchEditor() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const { t } = useI18n();
  const businessId = search.get("business") ?? "";
  const branchId = params.id === "new" ? null : params.id;

  const [admin, setAdmin] = useState(false);
  const [business, setBusiness] = useState<Business | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [draft, setDraft] = useState<BranchDraft>(emptyBranchDraft);
  const [errors, setErrors] = useState<BranchErrors>({ hours: {} });
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState<"save" | "send" | "photo" | "delete" | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      if (!businessId) {
        router.replace("/dashboard");
        return;
      }
      try {
        const token = await user.getIdToken();
        const session = await apiGet<BusinessSession>("/businesses/mine", token);
        let found: Business | null = null;
        if (session.is_ragly_admin) {
          found = await apiGet<Business>(`/admin/businesses/${businessId}`, token);
          setAdmin(true);
          setCanManage(true);
        } else {
          const membership = session.businesses.find((item) => item.business.id === businessId);
          found = membership?.business ?? null;
          setCanManage(membership?.role === "owner" || (membership?.role === "branch_owner" && membership.location_id === branchId));
        }
        if (!found) {
          router.replace(session.is_ragly_admin ? "/admin" : "/dashboard");
          return;
        }
        setBusiness(found);
        const row = branchId ? (found.locations.find((item) => item.id === branchId) ?? null) : null;
        if (branchId && !row) {
          router.replace("/dashboard");
          return;
        }
        setBranch(row);
        setDraft(row ? branchDraftFrom(row) : emptyBranchDraft());
        setReady(true);
      } catch (err: unknown) {
        setError(errorMessage(err, t));
        setReady(true);
      }
    });
    return unsubscribe;
  }, [router, businessId, branchId, t]);

  const lockPlace = useMemo(() => Boolean(branch && branch.status === "published" && !admin), [branch, admin]);
  const lockedServiceIds = useMemo(
    () => (branch && !admin ? branch.services.filter((service) => service.status === "published").map((service) => service.id) : []),
    [branch, admin],
  );
  const backHref = admin ? "/admin" : "/dashboard";

  function showError(err: unknown) {
    if (err instanceof ApiError && err.code === "branch_incomplete" && err.fields.length) {
      setError(t("branch.incomplete", { fields: err.fields.map((field) => t(fieldLabelKey(field))).join(", ") }));
      return;
    }
    setError(errorMessage(err, t));
  }

  /** Save the draft. Returns the saved branch, or null when the form has problems. */
  async function save(complete: boolean): Promise<Branch | null> {
    const user = auth.currentUser;
    if (!user || !business) return null;
    const result = cleanBranch(draft, t, complete || admin);
    if (result.errors) {
      setErrors(result.errors);
      setError(t("branch.fix_form"));
      return null;
    }
    setErrors({ hours: {} });
    const token = await user.getIdToken();
    const base = `/businesses/${business.id}/locations`;
    const row = branch
      ? await apiPatch<Branch>(`${base}/${branch.id}`, token, result.body)
      : await apiPost<Branch>(base, token, result.body);
    setBranch(row);
    setDraft(branchDraftFrom(row));
    return row;
  }

  async function onSave() {
    if (pending) return;
    if (!branchDraftHasProgress(draft)) {
      setError(t("branch.empty_save"));
      return;
    }
    setPending("save");
    setError("");
    setSaved(false);
    try {
      let row = await save(false);
      if (row && pendingPhoto) {
        row = await uploadPhoto(row, pendingPhoto);
        setBranch(row);
        setPendingPhoto(null);
        if (pendingPreview) URL.revokeObjectURL(pendingPreview);
        setPendingPreview("");
      }
      if (row) {
        setSaved(true);
        if (!branch) router.replace(`/dashboard/branches/${row.id}?business=${business?.id}`);
      }
    } catch (err: unknown) {
      showError(err);
    } finally {
      setPending(null);
    }
  }

  async function uploadPhoto(row: Branch, file: File): Promise<Branch> {
    const user = auth.currentUser;
    if (!user || !business) return row;
    const token = await user.getIdToken();
    return apiUpload<Branch>(`/businesses/${business.id}/locations/${row.id}/photo`, token, file);
  }

  async function onSend() {
    const user = auth.currentUser;
    if (pending || !user || !business) return;
    const hasLogo = Boolean(businessLogo(business));
    const hasPhoto = Boolean(branch?.photo || pendingPhoto);
    if (!hasLogo && !hasPhoto) {
      setError(t("branch.photo_required"));
      return;
    }
    setPending("send");
    setError("");
    try {
      let row = await save(true);
      if (!row) return;
      if (pendingPhoto) {
        row = await uploadPhoto(row, pendingPhoto);
        setBranch(row);
        setPendingPhoto(null);
      }
      await apiPost<Branch>(`/businesses/${business.id}/locations/${row.id}/send`, await user.getIdToken(), {});
      router.replace(`/dashboard?business=${business.id}&sent=1`);
    } catch (err: unknown) {
      showError(err);
    } finally {
      setPending(null);
    }
  }

  async function onPhoto(file: File | null) {
    if (pending) return;
    if (file && !isBusinessImage(file)) {
      setError(t("business.photo_type"));
      return;
    }
    if (!branch) {
      if (pendingPreview) URL.revokeObjectURL(pendingPreview);
      setPendingPhoto(file);
      setPendingPreview(file ? URL.createObjectURL(file) : "");
      setError("");
      return;
    }
    const user = auth.currentUser;
    if (!user || !business) return;
    setPending("photo");
    setError("");
    try {
      const token = await user.getIdToken();
      const path = `/businesses/${business.id}/locations/${branch.id}/photo`;
      if (file) {
        setBranch(await apiUpload<Branch>(path, token, file));
      } else {
        await apiDelete(path, token);
        setBranch({ ...branch, photo: null });
      }
    } catch (err: unknown) {
      showError(err);
    } finally {
      setPending(null);
    }
  }

  async function onDelete() {
    const user = auth.currentUser;
    if (!user || !business || !branch || pending) return;
    setPending("delete");
    try {
      await apiDelete(`/businesses/${business.id}/locations/${branch.id}`, await user.getIdToken());
      router.replace(`${backHref}?business=${business.id}`);
    } catch (err: unknown) {
      showError(err);
      setPending(null);
      setDeleteOpen(false);
    }
  }

  if (!ready) {
    return <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10" />;
  }

  if (!business) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
        <p className="text-sm text-[#EF4444]" role="alert">
          {error}
        </p>
      </main>
    );
  }

  const notes = branch ? (branch.status === "rejected" ? branch.field_errors : branch.admin_notes) : undefined;
  const canSend = canManage && (!branch || branch.status === "draft" || branch.status === "rejected");
  const readOnly = !canManage || branch?.status === "pending_review";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-10">
      <Link href={`${backHref}?business=${business.id}`} className="text-sm font-medium text-brand">
        ← {t("branch.back_to_dashboard")}
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{business.name}</p>
          <h1 className="mt-1 text-2xl font-medium text-foreground">
            {branch ? t("branch.edit_title") : business.locations.length ? t("branch.new_title") : t("branch.first_title")}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            {branch ? (readOnly ? t("branch.waiting_body") : t("branch.edit_body")) : t("branch.new_body")}
          </p>
        </div>
        {branch ? <BranchPillView branch={branch} /> : null}
      </div>

      {notes && Object.keys(notes).length > 0 && branch?.status === "rejected" ? (
        <div className="mt-6 rounded-2xl bg-[#FEF2F2] p-4">
          <p className="text-sm font-medium text-[#B91C1C]">{t("dashboard.fix_these")}</p>
          <p className="mt-1 text-xs text-[#B91C1C]">{t("branch.notes_inline")}</p>
          {notes.general ? <p className="mt-2 text-sm text-foreground">{notes.general}</p> : null}
        </div>
      ) : null}

      <div className="mt-8">
        <fieldset disabled={readOnly} className="grid gap-8 disabled:opacity-70">
          <Card>
            <BranchFields
              draft={draft}
              onChange={setDraft}
              errors={errors}
              notes={notes}
              lockPlace={lockPlace}
              lockedServiceIds={lockedServiceIds}
            />
          </Card>
        </fieldset>

        {canManage ? (
          <Card className="mt-6">
            <h2 className="text-lg font-medium text-foreground">{t("branch.photo_title")}</h2>
            <p className="mt-1 text-sm text-muted">
              {businessLogo(business) ? t("branch.photo_body") : t("branch.photo_required_body")}
            </p>
            {notes?.photo ? <p className="mt-2 rounded-xl bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]">{notes.photo}</p> : null}
            <div className="mt-4 flex flex-wrap items-center gap-4">
              {branch?.photo || pendingPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branch?.photo || pendingPreview} alt="" className="h-28 w-40 rounded-2xl object-cover" />
              ) : businessLogo(business) ? (
                <div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={businessLogo(business) ?? ""} alt="" className="h-20 w-20 rounded-2xl object-cover" />
                  <p className="mt-2 text-xs text-muted">{t("branch.photo_uses_logo")}</p>
                </div>
              ) : null}
              <label className={`${secondaryButton} cursor-pointer`}>
                {pending === "photo"
                  ? t("business.saving_photos")
                  : branch?.photo || pendingPreview
                    ? t("branch.change_photo")
                    : t("branch.add_photo")}
                <input
                  type="file"
                  accept={BUSINESS_IMAGE_ACCEPT}
                  className="sr-only"
                  disabled={pending !== null}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    event.target.value = "";
                    if (file) void onPhoto(file);
                  }}
                />
              </label>
              {branch?.photo || pendingPreview ? (
                <button type="button" disabled={pending !== null} onClick={() => void onPhoto(null)} className="text-sm font-medium text-[#EF4444]">
                  {t("business.remove_photo")}
                </button>
              ) : null}
            </div>
          </Card>
        ) : null}

        {error ? (
          <p className="mt-6 text-sm text-[#EF4444]" role="alert">
            {error}
          </p>
        ) : null}

        {!readOnly ? (
          <div className="sticky bottom-0 mt-8 -mx-5 border-t border-line bg-background/95 px-5 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {canSend ? (
                <button type="button" disabled={pending !== null} onClick={() => void onSend()} className={primaryButton}>
                  {pending === "send" ? t("saving") : branch?.status === "rejected" ? t("branch.resend") : t("branch.send")}
                </button>
              ) : null}
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => void onSave()}
                className={canSend ? secondaryButton : primaryButton}
              >
                {pending === "save" ? t("saving") : canSend ? t("branch.save_draft") : t("admin.save")}
              </button>
              {saved ? <span className="text-sm text-brand">{t("business.saved")}</span> : null}
              {branch && (branch.status !== "published" || admin) ? (
                <button type="button" disabled={pending !== null} onClick={() => setDeleteOpen(true)} className={`${dangerButton} sm:ms-auto`}>
                  {t("dashboard.delete")}
                </button>
              ) : null}
            </div>
            {canSend ? <p className="mt-3 text-xs leading-5 text-muted">{t("branch.send_hint")}</p> : null}
          </div>
        ) : null}
      </div>
      <ConfirmModal
        open={deleteOpen}
        title={t("branch.delete_title")}
        body={t("branch.delete_body", { address: branch?.address || t("branch.no_address") })}
        confirmLabel={t("dashboard.delete")}
        cancelLabel={t("dashboard.keep")}
        danger
        pending={pending === "delete"}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => void onDelete()}
      />
    </main>
  );
}

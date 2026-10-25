"use client";

import { FormEvent, useState } from "react";
import { BranchFields, cleanBranch, emptyBranchDraft, type BranchDraft, type BranchErrors } from "./branch-fields";
import { BusinessDetailsFields, cleanDetails, emptyDetails, type DetailsDraft, type DetailsErrors } from "./business-details-fields";
import { Card, Field, inputClass, primaryButton } from "./form-controls";
import { ApiError, apiPost, apiUpload } from "@/lib/api";
import { BUSINESS_IMAGE_ACCEPT, fieldLabelKey, isBusinessImage, type Business } from "@/lib/business";
import { cleanEmail } from "@/lib/contact";
import { auth } from "@/lib/firebase";
import { errorMessage } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";

/**
 * The admin one-form: business, first branch, optional owner.
 * Goes live at once and is stored exactly like an owner's approved request.
 */
export function AdminCreateForm({ onCreated }: { onCreated: (business: Business) => void }) {
  const { t, locale } = useI18n();
  const [details, setDetails] = useState<DetailsDraft>(emptyDetails);
  const [detailErrors, setDetailErrors] = useState<DetailsErrors>({});
  const [branch, setBranch] = useState<BranchDraft>(emptyBranchDraft);
  const [branchErrors, setBranchErrors] = useState<BranchErrors>({ hours: {} });
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerError, setOwnerError] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [logoError, setLogoError] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [nameBlocked, setNameBlocked] = useState(false);

  function pickLogo(file: File | null) {
    if (logoPreview.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    if (!file) {
      setLogoFile(null);
      setLogoPreview("");
      setLogoError("");
      return;
    }
    if (!isBusinessImage(file)) {
      setLogoError(t("business.photo_type"));
      return;
    }
    setLogoError("");
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user || pending || nameBlocked) return;
    const detailsResult = cleanDetails(details, t);
    const branchResult = cleanBranch(branch, t, true);
    const ownerText = ownerEmail.trim();
    const owner = ownerText ? cleanEmail(ownerText) : null;
    setDetailErrors(detailsResult.errors ?? {});
    setBranchErrors(branchResult.errors ?? { hours: {} });
    setOwnerError(ownerText && !owner ? t("business.fix_email") : "");
    setLogoError(logoFile ? "" : t("business.fix_logo"));
    if (detailsResult.errors || branchResult.errors || (ownerText && !owner) || !logoFile) {
      setError(t("branch.fix_form"));
      return;
    }
    setPending(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const created = await apiPost<Business>("/admin/businesses", token, {
        business: { ...detailsResult.body, locale },
        branch: branchResult.body,
        owner_email: owner,
      });
      try {
        onCreated(await apiUpload<Business>(`/admin/businesses/${created.id}/logo`, token, logoFile));
      } catch (err: unknown) {
        onCreated(created);
        throw err;
      }
      pickLogo(null);
      setDetails(emptyDetails());
      setBranch(emptyBranchDraft());
      setOwnerEmail("");
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === "branch_incomplete" && err.fields.length) {
        setError(t("branch.incomplete", { fields: err.fields.map((field) => t(fieldLabelKey(field))).join(", ") }));
      } else {
        setError(errorMessage(err, t));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6">
      <div>
        <h2 className="text-xl font-medium text-foreground">{t("admin.add_title")}</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted">{t("admin.add_body")}</p>
      </div>
      <Card>
        <h3 className="text-lg font-medium text-foreground">{t("business.details_title")}</h3>
        <div className="mt-4 grid gap-5">
          <div>
            <p className="text-sm font-medium text-foreground">{t("business.logo")}</p>
            <div className="mt-2 flex items-center gap-4">
              {logoPreview ? (
                // Local object URL for the file the admin just picked.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview} alt="" className="h-20 w-20 shrink-0 rounded-2xl object-cover" />
              ) : (
                <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[#EEF3F2] text-2xl text-brand">
                  +
                </span>
              )}
              <div className="grid gap-2">
                <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-2xl border border-line bg-surface px-4 text-sm font-medium text-foreground hover:border-brand">
                  {logoPreview ? t("business.change_logo") : t("business.add_logo")}
                  <input
                    type="file"
                    accept={BUSINESS_IMAGE_ACCEPT}
                    className="sr-only"
                    onChange={(event) => {
                      pickLogo(event.target.files?.[0] ?? null);
                      event.target.value = "";
                    }}
                  />
                </label>
                <p className="text-xs leading-5 text-muted">{t("business.logo_hint")}</p>
                {logoError ? (
                  <p className="text-xs text-[#EF4444]" role="alert">
                    {logoError}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
          <BusinessDetailsFields draft={details} onChange={setDetails} errors={detailErrors} onNameBlocked={setNameBlocked} />
        </div>
      </Card>
      <Card>
        <BranchFields draft={branch} onChange={setBranch} errors={branchErrors} />
      </Card>
      <Card>
        <h3 className="text-lg font-medium text-foreground">{t("admin.invite_owner")}</h3>
        <p className="mt-1 text-sm text-muted">{t("admin.owner_optional_hint")}</p>
        <div className="mt-4">
          <Field label={t("admin.invite_email")} optional={t("business.optional")} error={ownerError}>
            <input type="email" value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} className={inputClass} placeholder="owner@email.com" />
          </Field>
        </div>
      </Card>
      {error ? (
        <p className="text-sm text-[#EF4444]" role="alert">
          {error}
        </p>
      ) : null}
      <div>
        <button type="submit" disabled={pending || nameBlocked} className={primaryButton}>
          {pending ? t("saving") : t("admin.publish_now")}
        </button>
      </div>
    </form>
  );
}

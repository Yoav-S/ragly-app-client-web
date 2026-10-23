"use client";

import { useState } from "react";
import { BusinessDetailsFields, cleanDetails, detailsFromBody, type DetailsDraft, type DetailsErrors } from "./business-details-fields";
import { BusinessLogo } from "./business-logo";
import { BusinessPhotos } from "./business-photos";
import { primaryButton, secondaryButton } from "./form-controls";
import { apiPatch } from "@/lib/api";
import { detailsBody, type Business } from "@/lib/business";
import { auth } from "@/lib/firebase";
import { errorMessage } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";

/**
 * Edit the business itself: logo, details, gallery.
 * Branches (address, hours, services) are edited on their own page.
 */
export function BusinessEditor({
  business,
  scope,
  onChanged,
  onClose,
}: {
  business: Business;
  scope: "admin" | "owner";
  onChanged: (business: Business) => void;
  onClose?: () => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<DetailsDraft>(() => detailsFromBody(detailsBody(business)));
  const [errors, setErrors] = useState<DetailsErrors>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function save() {
    const user = auth.currentUser;
    if (!user || pending) return;
    const result = cleanDetails(draft, t);
    if (result.errors) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setPending(true);
    setError("");
    setSaved(false);
    try {
      const path = scope === "admin" ? `/admin/businesses/${business.id}` : `/businesses/${business.id}`;
      const updated = await apiPatch<Business>(path, await user.getIdToken(), { ...result.body, locale: business.locale });
      onChanged(updated);
      setSaved(true);
    } catch (err: unknown) {
      setError(errorMessage(err, t));
    } finally {
      setPending(false);
    }
  }

  const notes = business.status === "rejected" ? business.field_errors : business.admin_notes;

  return (
    <div className="grid gap-8">
      <section className="grid gap-3">
        <h3 className="text-sm font-medium text-foreground">{t("business.logo")}</h3>
        <BusinessLogo business={business} onChanged={onChanged} canEdit />
      </section>
      <section className="grid gap-4">
        <h3 className="text-sm font-medium text-foreground">{t("business.details_title")}</h3>
        <BusinessDetailsFields draft={draft} onChange={setDraft} errors={errors} notes={notes} businessId={business.id} />
        {error ? (
          <p className="text-sm text-[#EF4444]" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button type="button" disabled={pending} onClick={() => void save()} className={primaryButton}>
            {pending ? t("saving") : t("admin.save")}
          </button>
          {onClose ? (
            <button type="button" onClick={onClose} className={secondaryButton}>
              {t("done")}
            </button>
          ) : null}
          {saved ? <span className="text-sm text-brand">{t("business.saved")}</span> : null}
        </div>
      </section>
      <section className="grid gap-3">
        <h3 className="text-sm font-medium text-foreground">{t("business.photos")}</h3>
        <p className="text-xs text-muted">{t("business.photos_hint")}</p>
        <BusinessPhotos business={business} scope={scope} onChanged={onChanged} />
      </section>
    </div>
  );
}

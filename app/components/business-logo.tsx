"use client";

import { useState } from "react";
import { apiDelete, apiUpload } from "@/lib/api";
import { BUSINESS_IMAGE_ACCEPT, businessLogo, isBusinessImage, type Business } from "@/lib/business";
import { auth } from "@/lib/firebase";
import { errorMessage } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";

export function LogoBadge({
  business,
  size = "h-14 w-14",
  rounded = "rounded-2xl",
}: {
  business: Pick<Business, "name" | "photo"> & Partial<Pick<Business, "photos" | "locations">>;
  size?: string;
  rounded?: string;
}) {
  const logo = businessLogo(business);
  if (logo) {
    // Firebase download URLs are not known to the image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" className={`${size} shrink-0 ${rounded} object-cover`} />;
  }
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center ${rounded} bg-[#EEF3F2] text-lg font-medium text-brand`}>
      {business.name.trim().slice(0, 1).toUpperCase() || "•"}
    </span>
  );
}

export function BusinessLogo({
  business,
  onChanged,
  canEdit,
  scope = "owner",
}: {
  business: Business;
  onChanged: (business: Business) => void;
  canEdit: boolean;
  scope?: "admin" | "owner";
}) {
  const { t } = useI18n();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    const user = auth.currentUser;
    if (!user || pending) return;
    if (!isBusinessImage(file)) {
      setError(t("business.photo_type"));
      return;
    }
    setPending(true);
    setError("");
    try {
      const path = scope === "admin" ? `/admin/businesses/${business.id}/logo` : `/businesses/${business.id}/logo`;
      onChanged(await apiUpload<Business>(path, await user.getIdToken(), file));
    } catch (err: unknown) {
      setError(errorMessage(err, t));
    } finally {
      setPending(false);
    }
  }

  async function clear() {
    const user = auth.currentUser;
    if (!user || pending) return;
    setPending(true);
    setError("");
    try {
      const path = scope === "admin" ? `/admin/businesses/${business.id}/logo` : `/businesses/${business.id}/logo`;
      await apiDelete(path, await user.getIdToken());
      onChanged({ ...business, photo: null });
    } catch (err: unknown) {
      setError(errorMessage(err, t));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <LogoBadge business={business} size="h-20 w-20" />
      {canEdit ? (
        <div className="grid gap-2">
          <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-2xl border border-line bg-surface px-4 text-sm font-medium text-foreground hover:border-brand">
            {pending ? t("business.saving_photos") : businessLogo(business) ? t("business.change_logo") : t("business.add_logo")}
            <input
              type="file"
              accept={BUSINESS_IMAGE_ACCEPT}
              className="sr-only"
              disabled={pending}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void upload(file);
              }}
            />
          </label>
          {businessLogo(business) ? (
            <button type="button" disabled={pending} onClick={() => void clear()} className="text-start text-xs font-medium text-[#EF4444]">
              {t("business.remove_logo")}
            </button>
          ) : (
            <p className="text-xs text-muted">{t("business.logo_hint")}</p>
          )}
          {error ? (
            <p className="text-xs text-[#EF4444]" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

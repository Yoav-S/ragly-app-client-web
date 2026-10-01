"use client";

import { useState } from "react";
import { apiDeleteJson, apiUpload } from "@/lib/api";
import { businessImages, type Business } from "@/lib/business";
import { auth } from "@/lib/firebase";
import { errorMessage } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";

export function BusinessPhotos({
  business,
  scope,
  onChanged,
}: {
  business: Business;
  scope: "admin" | "owner";
  onChanged: (business: Business) => void;
}) {
  const { t } = useI18n();
  const images = businessImages(business);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const base =
    scope === "admin"
      ? `/admin/businesses/${business.id}/photos`
      : `/businesses/${business.id}/photos`;

  async function addPhotos(files: File[]) {
    const user = auth.currentUser;
    if (!user || files.length === 0 || pending) return;
    setPending(true);
    setError("");
    try {
      const token = await user.getIdToken();
      let updated = business;
      for (const file of Array.from(files)) {
        updated = await apiUpload<Business>(base, token, file);
        onChanged(updated);
      }
    } catch (err: unknown) {
      setError(errorMessage(err, t));
    } finally {
      setPending(false);
    }
  }

  async function removePhoto(url: string) {
    const user = auth.currentUser;
    if (!user || pending) return;
    setPending(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const updated = await apiDeleteJson<Business>(base, token, { url });
      onChanged(updated);
    } catch (err: unknown) {
      setError(errorMessage(err, t));
    } finally {
      setPending(false);
    }
  }

  return (
    <section>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((url) => (
          <div key={url} className="relative">
            {/* Firebase download URLs are not known to the image optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-28 w-full rounded-2xl object-cover" />
            <button
              type="button"
              disabled={pending}
              onClick={() => void removePhoto(url)}
              className="absolute end-2 top-2 rounded-full bg-white px-2 py-1 text-xs font-medium text-[#EF4444]"
            >
              {t("business.remove_photo")}
            </button>
          </div>
        ))}
      </div>
      {images.length < 6 ? (
        <label className="mt-3 inline-flex h-11 cursor-pointer items-center justify-center rounded-2xl border border-line px-4 text-sm font-medium text-foreground">
          {pending ? t("business.saving_photos") : t("business.add_photos")}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="sr-only"
            disabled={pending}
            onChange={(event) => {
              const picked = Array.from(event.target.files ?? []);
              event.target.value = "";
              void addPhotos(picked);
            }}
          />
        </label>
      ) : (
        <p className="mt-3 text-sm text-muted">{t("business.photo_limit")}</p>
      )}
      {error ? (
        <p className="mt-3 text-sm text-[#EF4444]" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

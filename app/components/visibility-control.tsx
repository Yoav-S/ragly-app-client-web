"use client";

import { useState } from "react";
import { apiPatch } from "@/lib/api";
import type { Business } from "@/lib/business";
import { errorMessage } from "@/lib/errors";
import { auth } from "@/lib/firebase";
import { useI18n } from "@/lib/i18n";

/**
 * Hide or show a published business in the app. Writes `visible` on the
 * business document; nearby and the business page drop it immediately.
 */
export function VisibilityControl({
  business,
  onChanged,
  variant = "button",
  onDone,
}: {
  business: Business;
  onChanged: (business: Business) => void;
  variant?: "button" | "menuItem";
  onDone?: () => void;
}) {
  const { t } = useI18n();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  if (business.status !== "published") return null;
  const hidden = business.visible === false;

  async function toggle() {
    const user = auth.currentUser;
    if (!user || pending) return;
    setPending(true);
    setError("");
    try {
      onChanged(await apiPatch<Business>(`/businesses/${business.id}/visibility`, await user.getIdToken(), { visible: hidden }));
      onDone?.();
    } catch (err: unknown) {
      setError(errorMessage(err, t));
    } finally {
      setPending(false);
    }
  }

  const label = pending ? t("saving") : hidden ? t("dashboard.force_active") : t("dashboard.force_inactive");

  if (variant === "menuItem") {
    return (
      <div>
        <button
          type="button"
          role="menuitem"
          disabled={pending}
          title={t("dashboard.force_hint")}
          onClick={() => void toggle()}
          className={
            hidden
              ? "flex w-full items-center px-4 py-2.5 text-start text-sm text-brand hover:bg-[#EEF3F2]"
              : "flex w-full items-center px-4 py-2.5 text-start text-sm text-[#EF4444] hover:bg-[#FEF2F2]"
          }
        >
          {label}
        </button>
        {error ? (
          <p className="px-4 pb-2 text-xs text-[#EF4444]" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        title={t("dashboard.force_hint")}
        onClick={() => void toggle()}
        className={
          hidden
            ? "inline-flex h-11 items-center justify-center rounded-2xl bg-brand px-5 text-sm font-medium text-white hover:bg-[#003a35] disabled:bg-[#8DB0AA]"
            : "inline-flex h-11 items-center justify-center rounded-2xl bg-[#EF4444] px-5 text-sm font-medium text-white hover:bg-[#DC2626] disabled:bg-[#F5A3A3]"
        }
      >
        {label}
      </button>
      {error ? (
        <p className="mt-2 text-sm text-[#EF4444]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

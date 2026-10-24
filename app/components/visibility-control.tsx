"use client";

import { useEffect, useId, useRef, useState } from "react";
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
}: {
  business: Business;
  onChanged: (business: Business) => void;
}) {
  const { t } = useI18n();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [hintOpen, setHintOpen] = useState(false);
  const hintId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hintOpen) return;
    function onPointer(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setHintOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [hintOpen]);

  if (business.status !== "published") return null;
  const hidden = business.visible === false;

  async function toggle() {
    const user = auth.currentUser;
    if (!user || pending) return;
    setPending(true);
    setError("");
    try {
      onChanged(await apiPatch<Business>(`/businesses/${business.id}/visibility`, await user.getIdToken(), { visible: hidden }));
    } catch (err: unknown) {
      setError(errorMessage(err, t));
    } finally {
      setPending(false);
    }
  }

  return (
    <div ref={wrapRef} className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => void toggle()}
        className={
          hidden
            ? "inline-flex h-11 items-center justify-center rounded-2xl bg-brand px-5 text-sm font-medium text-white hover:bg-[#003a35] disabled:bg-[#8DB0AA]"
            : "inline-flex h-11 items-center justify-center rounded-2xl bg-[#EF4444] px-5 text-sm font-medium text-white hover:bg-[#DC2626] disabled:bg-[#F5A3A3]"
        }
      >
        {pending ? t("saving") : hidden ? t("dashboard.force_active") : t("dashboard.force_inactive")}
      </button>
      <div className="relative">
        <button
          type="button"
          aria-expanded={hintOpen}
          aria-controls={hintId}
          onClick={() => setHintOpen((value) => !value)}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-line text-xs font-medium text-muted hover:border-brand hover:text-foreground"
        >
          i
          <span className="sr-only">{t("dashboard.force_hint_label")}</span>
        </button>
        {hintOpen ? (
          <p
            id={hintId}
            role="tooltip"
            className="absolute end-0 z-20 mt-2 w-64 rounded-2xl border border-line bg-surface px-4 py-3 text-sm leading-6 text-foreground shadow-sm"
          >
            {t("dashboard.force_hint")}
          </p>
        ) : null}
      </div>
      {error ? (
        <p className="basis-full text-sm text-[#EF4444]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

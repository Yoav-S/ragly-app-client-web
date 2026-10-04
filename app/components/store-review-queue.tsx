"use client";

import { useState } from "react";
import type { StoreReview } from "@/lib/business";
import { useI18n } from "@/lib/i18n";

export function StoreReviewQueue({
  stores,
  busyId,
  onDecide,
}: {
  stores: StoreReview[];
  busyId: string;
  onDecide: (id: string, action: "approve" | "reject", reason: string) => void;
}) {
  const { t } = useI18n();
  const [reasons, setReasons] = useState<Record<string, string>>({});

  if (stores.length === 0) {
    return <p className="mt-4 text-sm text-muted">{t("admin.stores_empty")}</p>;
  }

  return (
    <ul className="mt-4 grid gap-3">
      {stores.map((store) => {
        const hours = store.opening_hours.mon[0];
        const reason = reasons[store.id] ?? "";
        const busy = busyId === store.id;
        return (
          <li key={store.id} className="rounded-2xl border border-line bg-background p-4">
            <p className="text-sm font-medium text-foreground">{store.business_name}</p>
            <p className="mt-1 text-sm text-muted">{t("admin.store_for", { name: store.business_name })}</p>
            <p className="mt-3 text-sm text-foreground">
              {store.address}, {store.city}
            </p>
            <p className="mt-1 text-sm text-muted">
              {store.phone.length ? store.phone.join(", ") : t("dashboard.shared_phone")}
              {hours ? ` · ${hours.open}–${hours.close}` : ""}
            </p>
            <label className="mt-4 block text-sm text-muted">
              {t("admin.store_reason")}
              <textarea
                value={reason}
                onChange={(event) =>
                  setReasons((current) => ({ ...current, [store.id]: event.target.value }))
                }
                className="mt-2 min-h-20 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-foreground outline-none focus:border-brand"
              />
            </label>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={busy}
                onClick={() => onDecide(store.id, "approve", reason)}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-brand px-4 text-sm font-medium text-white"
              >
                {t("admin.approve_store")}
              </button>
              <button
                type="button"
                disabled={busy || !reason.trim()}
                onClick={() => onDecide(store.id, "reject", reason.trim())}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-line px-4 text-sm font-medium text-foreground disabled:text-muted"
              >
                {t("admin.reject_store")}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { DAYS, type Business } from "@/lib/business";
import { useI18n } from "@/lib/i18n";

const REVIEW_FIELDS = [
  "name",
  "phone",
  "email",
  "description",
  "category",
  "city",
  "address",
  "timezone",
  "hours",
  "website",
  "location",
  "photo",
  "instagram",
] as const;

type ReviewField = (typeof REVIEW_FIELDS)[number];

const LABEL: Record<ReviewField, string> = {
  name: "business.name",
  phone: "business.phones",
  email: "business.email",
  description: "business.description",
  category: "business.category",
  city: "business.city",
  address: "business.address",
  timezone: "business.timezone",
  hours: "business.hours",
  website: "business.website",
  location: "admin.review_location",
  photo: "business.photo",
  instagram: "business.instagram",
};

function fieldValue(business: Business, field: ReviewField, closed: string, always: string, dayLabel: (day: (typeof DAYS)[number]) => string): string {
  if (field === "name") return business.name;
  if (field === "phone") return business.phone.join(", ");
  if (field === "email") return business.email ?? "";
  if (field === "description") return business.description ?? "";
  if (field === "category") return business.category;
  if (field === "city") return business.city;
  if (field === "address") return business.address;
  if (field === "timezone") return business.timezone;
  if (field === "website") return business.website ?? "";
  if (field === "photo") return business.photo ?? "";
  if (field === "instagram") return business.instagram ?? "";
  if (field === "location") {
    return business.location
      ? `${business.location.coordinates[1]}, ${business.location.coordinates[0]}`
      : "";
  }
  if (business.opening_hours.always_open) return always;
  return DAYS.map((day) => {
    const slots = business.opening_hours[day];
    const value = slots.length ? slots.map((slot) => `${slot.open}–${slot.close}`).join(", ") : closed;
    return `${dayLabel(day)} ${value}`;
  }).join("\n");
}

export function ReviewQueue({
  pending,
  unreadIds,
  busyId,
  hasMore = false,
  onLoadMore,
  onDecide,
}: {
  pending: Business[];
  unreadIds: string[];
  busyId: string;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onDecide: (id: string, action: "approve" | "reject", fieldErrors: Record<string, string>) => void;
}) {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || !onLoadMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) onLoadMore();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore, pending.length]);
  const [notes, setNotes] = useState<Record<string, Record<string, string>>>({});
  const selected = pending.find((business) => business.id === selectedId) ?? null;
  const selectedNotes = selected ? notes[selected.id] ?? {} : {};
  const hasNote = Object.values(selectedNotes).some((note) => note.trim());

  if (pending.length === 0) {
    return <p className="mt-6 text-sm text-muted">{t("admin.empty_pending")}</p>;
  }

  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)]">
      <ul className={selected ? "hidden gap-2 lg:grid" : "grid gap-2"}>
        {pending.map((business) => (
          <li key={business.id}>
            <button
              type="button"
              onClick={() => setSelectedId(business.id)}
              className={
                business.id === selectedId
                  ? "w-full rounded-2xl border border-brand bg-surface px-4 py-3 text-start"
                  : "w-full rounded-2xl border border-line bg-surface px-4 py-3 text-start"
              }
            >
              <span className="block text-sm font-medium text-foreground">{business.name}</span>
              <span className="mt-1 block text-sm text-muted">
                {t(`business.${business.category}`)} · {business.city}
              </span>
              {unreadIds.includes(business.id) ? (
                <span className="mt-2 inline-flex rounded-full bg-[#EEF3F2] px-2 py-0.5 text-xs font-medium text-brand">
                  {t("admin.new")}
                </span>
              ) : null}
            </button>
          </li>
        ))}
        <li ref={sentinelRef} className="h-1" />
      </ul>
      {selected ? (
        <section className="rounded-3xl border border-line bg-surface p-5">
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="text-sm font-medium text-brand lg:hidden"
          >
            {t("admin.back_to_requests")}
          </button>
          <h2 className="mt-3 text-lg font-medium text-foreground lg:mt-0">{selected.name}</h2>
          <p className="mt-1 text-sm text-muted">{t("admin.review_hint")}</p>
          <div className="mt-5 grid gap-4">
            {REVIEW_FIELDS.map((field) => {
              const value = field === "category"
                ? t(`business.${selected.category}`)
                : fieldValue(selected, field, t("business.closed"), t("business.always_open"), (day) => t(`business.${day}`));
              return (
                <div key={field} className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted">{t(LABEL[field])}</p>
                    <p className="mt-1 whitespace-pre-line text-sm text-foreground">{value || "—"}</p>
                  </div>
                  <label className="block text-xs text-muted">
                    {t("admin.field_note")}
                    <textarea
                      value={selectedNotes[field] ?? ""}
                      onChange={(event) =>
                        setNotes({
                          ...notes,
                          [selected.id]: { ...selectedNotes, [field]: event.target.value },
                        })
                      }
                      className="mt-1 min-h-16 w-full rounded-2xl border border-line bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
                    />
                  </label>
                </div>
              );
            })}
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              disabled={busyId === selected.id}
              onClick={() => onDecide(selected.id, "approve", {})}
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-brand px-5 text-sm font-medium text-white disabled:bg-[#8DB0AA]"
            >
              {t("admin.approve")}
            </button>
            <button
              type="button"
              disabled={busyId === selected.id || !hasNote}
              onClick={() => onDecide(selected.id, "reject", selectedNotes)}
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-line px-5 text-sm font-medium text-foreground disabled:text-muted"
            >
              {t("admin.reject")}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

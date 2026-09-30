"use client";

import { DAYS, type Business } from "@/lib/business";
import { useI18n } from "@/lib/i18n";

function hoursText(
  business: Business,
  closedLabel: string,
  dayLabel: (day: (typeof DAYS)[number]) => string,
): string {
  if (business.opening_hours.always_open) return "";
  return DAYS.map((day) => {
    const slots = business.opening_hours[day];
    const value = slots.length
      ? slots.map((slot) => `${slot.open}–${slot.close}`).join(", ")
      : closedLabel;
    return `${dayLabel(day)}: ${value}`;
  }).join("\n");
}

export function BusinessDetails({ business }: { business: Business }) {
  const { t } = useI18n();
  const rows: Array<[string, string]> = [
    [t("admin.owner"), business.owner_email],
    [t("business.name"), business.name],
    [t("business.phones"), business.phones.join(", ")],
    [t("business.category"), t(`business.${business.category}`)],
    [t("business.city"), business.city],
    [t("business.address"), business.address],
    [t("business.timezone"), business.timezone],
    [
      t("business.hours"),
      business.opening_hours.always_open
        ? t("business.always_open")
        : hoursText(business, t("business.closed"), (day) => t(`business.${day}`)),
    ],
    [t("business.latitude"), String(business.latitude)],
    [t("business.longitude"), String(business.longitude)],
  ];
  if (business.description) rows.push([t("business.description"), business.description]);
  if (business.email) rows.push([t("business.email"), business.email]);
  if (business.website) rows.push([t("business.website"), business.website]);
  if (business.instagram) rows.push([t("business.instagram"), business.instagram]);
  if (business.rejection_reason) rows.push([t("admin.reason"), business.rejection_reason]);

  return (
    <div className="grid gap-3">
      {business.photo_url ? (
        // Remote Firebase download URLs are not known to the image optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={business.photo_url}
          alt={business.name}
          className="h-40 w-full rounded-2xl object-cover"
        />
      ) : null}
      <dl className="grid gap-3">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="whitespace-pre-line text-sm text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

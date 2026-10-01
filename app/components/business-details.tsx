"use client";

import type { ReactNode } from "react";
import { businessImages, DAYS, type Business } from "@/lib/business";
import { useI18n } from "@/lib/i18n";

export function BusinessDetails({
  business,
  showImages = true,
}: {
  business: Business;
  showImages?: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className="grid gap-4">
      {showImages && businessImages(business).length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {businessImages(business).map((url) => (
            // Remote Firebase download URLs are not known to the image optimizer.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt={business.name}
              className="h-40 w-full rounded-2xl object-cover"
            />
          ))}
        </div>
      ) : showImages && business.photo ? (
        <p className="text-sm text-muted">
          {t("business.photo")}: {business.photo}
        </p>
      ) : null}
      <div>
        <h3 className="text-xl font-medium text-foreground">{business.name}</h3>
        <p className="mt-1 text-sm text-muted">
          {t(`business.${business.category}`)} · {business.city}
        </p>
      </div>
      <dl className="grid gap-4 sm:grid-cols-2">
        <Fact label={t("admin.owner")}>
          {business.owned
            ? business.owner_email || business.email || t("admin.owned")
            : t("admin.not_owned")}
        </Fact>
        <Fact label={t("business.phones")}>
          <span className="grid gap-1">
            {business.phone.map((phone) => (
              <a key={phone} href={`tel:${phone.replace(/\s/g, "")}`} className="text-brand">
                {phone}
              </a>
            ))}
          </span>
        </Fact>
        <Fact label={t("business.address")}>
          {business.address}
          {business.location ? (
            <span className="mt-1 block text-muted">
              {business.location.coordinates[1]}, {business.location.coordinates[0]}
            </span>
          ) : null}
        </Fact>
        <Fact label={t("business.timezone")}>{business.timezone}</Fact>
        {business.email ? <Fact label={t("business.email")}>{business.email}</Fact> : null}
        {business.website ? (
          <Fact label={t("business.website")}>
            <a href={business.website} target="_blank" rel="noreferrer" className="break-all text-brand">
              {business.website}
            </a>
          </Fact>
        ) : null}
        {business.instagram ? (
          <Fact label={t("business.instagram")}>{business.instagram}</Fact>
        ) : null}
        {business.description ? (
          <div className="sm:col-span-2">
            <Fact label={t("business.description")}>{business.description}</Fact>
          </div>
        ) : null}
      </dl>
      <div>
        <p className="text-xs text-muted">{t("business.hours")}</p>
        {business.opening_hours.always_open ? (
          <p className="mt-1 text-sm text-foreground">{t("business.always_open")}</p>
        ) : (
          <ul className="mt-2 grid gap-1">
            {DAYS.map((day) => {
              const slots = business.opening_hours[day];
              const value = slots.length
                ? slots.map((slot) => `${slot.open}–${slot.close}`).join(", ")
                : t("business.closed");
              return (
                <li key={day} className="flex justify-between gap-4 text-sm">
                  <span className="text-muted">{t(`business.${day}`)}</span>
                  <span className="text-foreground">{value}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {business.rejection_reason ? (
        <p className="rounded-2xl bg-[#FEF2F2] px-4 py-3 text-sm text-[#EF4444]">
          {business.rejection_reason}
        </p>
      ) : null}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{children}</dd>
    </div>
  );
}

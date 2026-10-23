"use client";

import type { ReactNode } from "react";
import { LogoBadge } from "./business-logo";
import { HoursSummary } from "./hours-editor";
import { BranchPillView } from "./status-pill";
import { businessImages, type Branch, type Business } from "@/lib/business";
import { useI18n } from "@/lib/i18n";

/** Read-only view of a business and its branches, as admins and team members see it. */
export function BusinessDetails({
  business,
  showImages = true,
  showBranches = true,
}: {
  business: Business;
  showImages?: boolean;
  showBranches?: boolean;
}) {
  const { t } = useI18n();
  const images = businessImages(business).filter((url) => url !== business.photo);

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-4">
        <LogoBadge business={business} />
        <div className="min-w-0">
          <h3 className="truncate text-xl font-medium text-foreground">{business.name}</h3>
          <p className="mt-0.5 text-sm text-muted">
            {business.categories.length
              ? business.categories.map((category) => t(`categories.${category}`)).join(" · ")
              : t("business.no_services_yet")}
            {business.city ? ` · ${business.city}` : ""}
          </p>
        </div>
      </div>
      {showImages && images.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {images.map((url) => (
            // Firebase download URLs are not known to the image optimizer.
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt="" className="h-24 w-full rounded-2xl object-cover" />
          ))}
        </div>
      ) : null}
      <dl className="grid gap-4 sm:grid-cols-2">
        <Fact label={t("admin.owner")}>
          {business.owned ? business.owner_email || business.email || t("admin.owned") : t("admin.not_owned")}
        </Fact>
        <Fact label={t("business.phones")}>
          <PhoneLinks phones={business.phone} />
        </Fact>
        {business.email ? <Fact label={t("business.email")}>{business.email}</Fact> : null}
        {business.website ? (
          <Fact label={t("business.website")}>
            <a href={business.website} target="_blank" rel="noreferrer" className="break-all text-brand">
              {business.website}
            </a>
          </Fact>
        ) : null}
        {business.instagram ? <Fact label={t("business.instagram")}>{business.instagram}</Fact> : null}
        <Fact label={t("business.language")}>{t(`languages.${business.locale}`)}</Fact>
        {business.description ? (
          <div className="sm:col-span-2">
            <Fact label={t("business.description")}>
              <span className="whitespace-pre-line">{business.description}</span>
            </Fact>
          </div>
        ) : null}
      </dl>
      {showBranches ? (
        <div className="grid gap-3">
          <p className="text-xs text-muted">{t("dashboard.branches")}</p>
          {business.locations.length === 0 ? (
            <p className="text-sm text-muted">{t("dashboard.no_branches")}</p>
          ) : (
            business.locations.map((branch) => <BranchSummary key={branch.id} branch={branch} />)
          )}
        </div>
      ) : null}
    </div>
  );
}

export function BranchSummary({ branch, notes }: { branch: Branch; notes?: Record<string, string> }) {
  const { t } = useI18n();
  return (
    <div className="rounded-2xl border border-line bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{branch.address || t("branch.no_address")}</p>
          <p className="mt-0.5 text-xs text-muted">
            {[branch.city, branch.timezone].filter(Boolean).join(" · ")}
            {branch.location ? ` · ${branch.location.coordinates[1].toFixed(5)}, ${branch.location.coordinates[0].toFixed(5)}` : ""}
          </p>
        </div>
        <BranchPillView branch={branch} />
      </div>
      {notes?.address || notes?.location ? (
        <p className="mt-2 rounded-xl bg-[#FEF2F2] px-3 py-2 text-xs text-[#B91C1C]">{notes.address ?? notes.location}</p>
      ) : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {branch.services.length === 0 ? (
          <p className="text-sm text-muted">{t("branch.no_services")}</p>
        ) : (
          branch.services.map((service) => (
            <div key={service.id} className="rounded-xl bg-surface p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">{t(`categories.${service.category}`)}</span>
                {service.status !== "published" ? <span className="text-xs text-muted">{t(`status.${service.status === "pending_review" ? "waiting" : service.status === "rejected" ? "changes" : "draft"}`)}</span> : null}
              </div>
              <div className="mt-2 text-xs text-foreground">
                <HoursSummary hours={service.opening_hours} />
              </div>
              {service.phone.length ? <p className="mt-2 text-xs text-muted">{service.phone.join(", ")}</p> : null}
              {notes?.[`service:${service.category}`] ? (
                <p className="mt-2 rounded-xl bg-[#FEF2F2] px-3 py-2 text-xs text-[#B91C1C]">{notes[`service:${service.category}`]}</p>
              ) : null}
            </div>
          ))
        )}
      </div>
      {branch.phone.length || branch.website || branch.instagram ? (
        <p className="mt-3 text-xs text-muted">
          {[branch.phone.join(", "), branch.website, branch.instagram].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      {branch.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={branch.photo} alt="" className="mt-3 h-28 w-full rounded-xl object-cover" />
      ) : null}
    </div>
  );
}

export function PhoneLinks({ phones }: { phones: string[] }) {
  if (!phones.length) return <span>—</span>;
  return (
    <span className="grid gap-1">
      {phones.map((phone) => {
        const compact = phone.replace(/[^\d+]/g, "");
        const href = /^\+?\d{7,15}$/.test(compact) ? `tel:${compact}` : null;
        return href ? (
          <a key={phone} href={href} className="text-brand">
            {phone}
          </a>
        ) : (
          <span key={phone}>{phone}</span>
        );
      })}
    </span>
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

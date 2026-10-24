"use client";

import { useRef, useState } from "react";
import { BranchMapClient } from "./branch-map-loader";
import type { MapPoint } from "./branch-map";
import { Field, PhoneList, inputClass, secondaryButton } from "./form-controls";
import { HoursEditor, hoursError } from "./hours-editor";
import { apiGet } from "@/lib/api";
import {
  CATEGORIES,
  weekdayHours,
  type Branch,
  type BranchBody,
  type BusinessCategory,
  type GeoPlace,
  type OpeningHours,
  type PlaceRef,
} from "@/lib/business";
import { cleanInstagram, cleanPhone, cleanWebsite } from "@/lib/contact";
import { auth } from "@/lib/firebase";
import { useI18n } from "@/lib/i18n";

export type ServiceDraft = {
  id: string | null;
  /** Client-side key, stable while editing. */
  key: string;
  category: BusinessCategory;
  hours: OpeningHours;
  phones: string[];
};

export type BranchDraft = {
  address: string;
  city: string;
  point: MapPoint | null;
  place_ref: PlaceRef | null;
  timezone: string | null;
  services: ServiceDraft[];
  phones: string[];
  website: string;
  instagram: string;
};

export type BranchErrors = {
  address?: string;
  location?: string;
  services?: string;
  phones?: string;
  website?: string;
  instagram?: string;
  /** Keyed by service key. */
  hours: Record<string, string>;
};

type Translate = (key: string, vars?: Record<string, string | number>) => string;

let keyCounter = 0;
function nextKey(): string {
  keyCounter += 1;
  return `s${Date.now().toString(36)}${keyCounter}`;
}

export function branchDraftHasProgress(draft: BranchDraft): boolean {
  return Boolean(
    draft.address.trim() ||
      draft.city.trim() ||
      draft.point ||
      draft.place_ref ||
      draft.services.length ||
      draft.phones.some((phone) => phone.trim()) ||
      draft.website.trim() ||
      draft.instagram.trim(),
  );
}

export function emptyBranchDraft(): BranchDraft {
  return {
    address: "",
    city: "",
    point: null,
    place_ref: null,
    timezone: null,
    services: [],
    phones: [],
    website: "",
    instagram: "",
  };
}

export function branchDraftFrom(branch: Branch): BranchDraft {
  const coordinates = branch.location?.coordinates;
  return {
    address: branch.address,
    city: branch.city,
    point: coordinates ? { lat: coordinates[1], lng: coordinates[0] } : null,
    place_ref: branch.place_ref,
    timezone: branch.timezone || null,
    services: branch.services.map((service) => ({
      id: service.id,
      key: service.id,
      category: service.category,
      hours: { ...service.opening_hours, special_dates: service.opening_hours.special_dates ?? [] },
      phones: service.phone,
    })),
    phones: branch.phone,
    website: branch.website ?? "",
    instagram: branch.instagram ?? "",
  };
}

/**
 * Turn the draft into a request body. Format problems are always errors;
 * missing pieces are only errors when `complete` is asked for (send for review).
 */
export function cleanBranch(
  draft: BranchDraft,
  t: Translate,
  complete: boolean,
): { body: BranchBody; errors: null } | { body: null; errors: BranchErrors } {
  const errors: BranchErrors = { hours: {} };
  if (complete && !draft.address.trim()) errors.address = t("branch.fix_address");
  if (complete && !draft.point) errors.location = t("branch.fix_location");
  if (complete && !draft.services.length) errors.services = t("branch.fix_services");
  const seen = new Set<string>();
  for (const service of draft.services) {
    if (seen.has(service.category)) errors.services = t("branch.fix_service_twice");
    seen.add(service.category);
    const problem = hoursError(service.hours, t);
    if (problem) errors.hours[service.key] = problem;
    if (service.phones.some((phone) => phone.trim() && !cleanPhone(phone))) {
      errors.hours[service.key] = t("business.fix_phone_format");
    }
  }
  const phoneTexts = draft.phones.map((phone) => phone.trim()).filter(Boolean);
  const phones = phoneTexts.map((phone) => cleanPhone(phone));
  if (phones.some((phone) => !phone)) errors.phones = t("business.fix_phone_format");
  const websiteText = draft.website.trim();
  const website = websiteText ? cleanWebsite(websiteText) : null;
  if (websiteText && !website) errors.website = t("business.fix_website");
  const instagramText = draft.instagram.trim();
  const instagram = instagramText ? cleanInstagram(instagramText) : null;
  if (instagramText && !instagram) errors.instagram = t("business.fix_instagram");
  if (Object.keys(errors).length > 1 || Object.keys(errors.hours).length) return { body: null, errors };
  return {
    body: {
      address: draft.address.trim(),
      city: draft.city.trim(),
      location: draft.point ? { type: "Point", coordinates: [draft.point.lng, draft.point.lat] } : null,
      place_ref: draft.place_ref,
      services: draft.services.map((service) => ({
        id: service.id,
        category: service.category,
        opening_hours: service.hours,
        phone: service.phones.map((phone) => cleanPhone(phone)).filter((phone): phone is string => Boolean(phone)),
      })),
      phone: phones.filter((phone): phone is string => Boolean(phone)),
      website,
      instagram,
      timezone: draft.timezone,
    },
    errors: null,
  };
}

export function BranchFields({
  draft,
  onChange,
  errors,
  notes,
  lockPlace = false,
  lockedServiceIds = [],
}: {
  draft: BranchDraft;
  onChange: (next: BranchDraft) => void;
  errors: BranchErrors;
  notes?: Record<string, string>;
  /** A live branch keeps its address and pin; a new branch is the way to move. */
  lockPlace?: boolean;
  /** Services already live: category cannot change, only hours and phones. */
  lockedServiceIds?: string[];
}) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [geoDown, setGeoDown] = useState(false);
  const searchRef = useRef(0);

  async function searchAddress() {
    const text = query.trim();
    if (text.length < 3 || searching) return;
    const user = auth.currentUser;
    if (!user) return;
    const id = ++searchRef.current;
    setSearching(true);
    try {
      const params = new URLSearchParams({ q: text, locale });
      if (draft.point) {
        params.set("latitude", String(draft.point.lat));
        params.set("longitude", String(draft.point.lng));
      }
      const out = await apiGet<{ items: GeoPlace[] }>(`/geo/search?${params}`, await user.getIdToken());
      if (id === searchRef.current) {
        setResults(out.items);
        setGeoDown(false);
      }
    } catch {
      if (id === searchRef.current) setGeoDown(true);
    } finally {
      if (id === searchRef.current) setSearching(false);
    }
  }

  function pickPlace(place: GeoPlace) {
    onChange({
      ...draft,
      address: place.address || place.label,
      city: place.city,
      point: { lat: place.latitude, lng: place.longitude },
      place_ref: place.place_ref,
      timezone: place.timezone ?? draft.timezone,
    });
    setQuery("");
    setResults([]);
  }

  async function movePin(point: MapPoint) {
    const next: BranchDraft = { ...draft, point, place_ref: null };
    onChange(next);
    const user = auth.currentUser;
    if (!user) return;
    try {
      const params = new URLSearchParams({ latitude: String(point.lat), longitude: String(point.lng), locale });
      const out = await apiGet<{ place: GeoPlace | null; timezone: string | null }>(`/geo/point?${params}`, await user.getIdToken());
      onChange({
        ...next,
        timezone: out.timezone ?? next.timezone,
        place_ref: out.place?.place_ref ?? null,
        address: next.address.trim() ? next.address : out.place?.address ?? "",
        city: next.city.trim() ? next.city : out.place?.city ?? "",
      });
    } catch {
      // The pin itself is what matters; the server fills the timezone from it.
    }
  }

  function addService() {
    const used = new Set(draft.services.map((service) => service.category));
    const category = CATEGORIES.find((item) => !used.has(item));
    if (!category) return;
    const previous = draft.services[draft.services.length - 1];
    onChange({
      ...draft,
      services: [
        ...draft.services,
        {
          id: null,
          key: nextKey(),
          category,
          hours: previous ? { ...previous.hours } : weekdayHours(),
          phones: [],
        },
      ],
    });
  }

  function updateService(key: string, patch: Partial<ServiceDraft>) {
    onChange({ ...draft, services: draft.services.map((service) => (service.key === key ? { ...service, ...patch } : service)) });
  }

  const usedCategories = new Set(draft.services.map((service) => service.category));

  return (
    <div className="grid gap-8">
      <section className="grid gap-4">
        <div>
          <h2 className="text-lg font-medium text-foreground">{t("branch.where_title")}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">{lockPlace ? t("branch.where_locked") : t("branch.where_body")}</p>
        </div>
        {!lockPlace ? (
          <div className="relative">
            <Field label={t("branch.search")} hint={geoDown ? t("errors.geo_unavailable") : t("branch.search_hint")}>
              <div className="flex gap-2">
                <input
                  className={inputClass}
                  value={query}
                  placeholder={t("branch.search_placeholder")}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void searchAddress();
                    }
                  }}
                  autoComplete="off"
                />
                <button type="button" onClick={() => void searchAddress()} className={secondaryButton} disabled={searching}>
                  {searching ? t("branch.searching") : t("branch.search")}
                </button>
              </div>
            </Field>
            {results.length > 0 || searching ? (
              <ul className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-line bg-surface shadow-lg">
                {searching && !results.length ? <li className="px-4 py-3 text-sm text-muted">{t("branch.searching")}</li> : null}
                {results.map((place, index) => (
                  <li key={`${place.latitude},${place.longitude},${index}`}>
                    <button
                      type="button"
                      onClick={() => pickPlace(place)}
                      className="block w-full px-4 py-3 text-start text-sm text-foreground hover:bg-background"
                    >
                      <span className="block font-medium">{place.address || place.label}</span>
                      <span className="mt-0.5 block text-xs text-muted">{place.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <BranchMapClient point={draft.point} onChange={lockPlace ? undefined : movePin} editable={!lockPlace} className="h-[320px]" />
        {errors.location ? (
          <p className="text-sm text-[#EF4444]" role="alert">
            {errors.location}
          </p>
        ) : notes?.location ? (
          <p className="rounded-xl bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]">{notes.location}</p>
        ) : (
          <p className="text-xs text-muted">{lockPlace ? "" : t("branch.map_hint")}</p>
        )}
        <div className="grid gap-5 sm:grid-cols-[1fr_200px]">
          <Field label={t("business.address")} error={errors.address} note={notes?.address}>
            <input
              className={inputClass}
              value={draft.address}
              disabled={lockPlace}
              maxLength={300}
              placeholder={t("branch.address_placeholder")}
              onChange={(event) => onChange({ ...draft, address: event.target.value })}
            />
          </Field>
          <Field label={t("business.city")} note={notes?.city}>
            <input
              className={inputClass}
              value={draft.city}
              disabled={lockPlace}
              maxLength={120}
              onChange={(event) => onChange({ ...draft, city: event.target.value })}
            />
          </Field>
        </div>
        {draft.timezone ? (
          <p className="text-xs text-muted">
            {t("business.timezone")}: {draft.timezone}
          </p>
        ) : null}
      </section>

      <section className="grid gap-4">
        <div>
          <h2 className="text-lg font-medium text-foreground">{t("branch.services_title")}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">{t("branch.services_body")}</p>
        </div>
        {notes?.services ? <p className="rounded-xl bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]">{notes.services}</p> : null}
        {notes?.hours ? <p className="rounded-xl bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]">{notes.hours}</p> : null}
        {draft.services.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-background px-5 py-8 text-center">
            <p className="text-sm text-muted">{t("branch.no_services")}</p>
          </div>
        ) : null}
        {draft.services.map((service, index) => {
          const locked = service.id ? lockedServiceIds.includes(service.id) : false;
          const note = notes?.[`service:${service.category}`];
          return (
            <div key={service.key} className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="block min-w-48 flex-1">
                  <span className="text-sm font-medium text-foreground">{t("business.category")}</span>
                  <select
                    className={`${inputClass}`}
                    value={service.category}
                    disabled={locked}
                    onChange={(event) => updateService(service.key, { category: event.target.value as BusinessCategory })}
                  >
                    {CATEGORIES.map((category) => (
                      <option key={category} value={category} disabled={usedCategories.has(category) && category !== service.category}>
                        {t(`categories.${category}`)}
                      </option>
                    ))}
                  </select>
                </label>
                {!locked ? (
                  <button
                    type="button"
                    onClick={() => onChange({ ...draft, services: draft.services.filter((item) => item.key !== service.key) })}
                    className="mt-6 text-sm font-medium text-[#EF4444]"
                  >
                    {t("branch.remove_service")}
                  </button>
                ) : (
                  <span className="mt-6 text-xs text-muted">{t("branch.service_live")}</span>
                )}
              </div>
              {note ? <p className="mt-3 rounded-xl bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]">{note}</p> : null}
              <div className="mt-4">
                <p className="text-sm font-medium text-foreground">{t("business.hours")}</p>
                <div className="mt-2">
                  <HoursEditor
                    hours={service.hours}
                    onChange={(hours) => updateService(service.key, { hours })}
                    copyOptions={draft.services
                      .filter((other) => other.key !== service.key && other.hours.provided)
                      .map((other) => ({ id: other.key, label: t(`categories.${other.category}`) }))}
                    onCopyFrom={(key) => {
                      const source = draft.services.find((other) => other.key === key);
                      if (source) updateService(service.key, { hours: JSON.parse(JSON.stringify(source.hours)) as OpeningHours });
                    }}
                  />
                </div>
                {errors.hours[service.key] ? (
                  <p className="mt-2 text-sm text-[#EF4444]" role="alert">
                    {errors.hours[service.key]}
                  </p>
                ) : null}
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium text-foreground">
                  {t("branch.service_phone")} <span className="text-xs font-normal text-muted">{t("business.optional")}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted">{t("branch.service_phone_hint")}</p>
                <div className="mt-2">
                  {service.phones.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => updateService(service.key, { phones: [""] })}
                      className="text-sm font-medium text-brand"
                    >
                      + {t("business.add_phone")}
                    </button>
                  ) : (
                    <PhoneList
                      phones={service.phones}
                      onChange={(phones) => updateService(service.key, { phones: phones.filter((phone, i, all) => phone.trim() || all.length === 1) })}
                      addLabel={t("business.add_phone")}
                      removeLabel={t("business.remove_phone")}
                      placeholder="+373 ..."
                    />
                  )}
                </div>
              </div>
              {index === draft.services.length - 1 && draft.services.length === 1 && !service.hours.provided ? (
                <p className="mt-3 text-xs text-muted">{t("branch.hours_unlisted_hint")}</p>
              ) : null}
            </div>
          );
        })}
        {errors.services ? (
          <p className="text-sm text-[#EF4444]" role="alert">
            {errors.services}
          </p>
        ) : null}
        {draft.services.length < CATEGORIES.length ? (
          <button
            type="button"
            onClick={addService}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-line bg-surface px-5 text-sm font-medium text-brand hover:border-brand"
          >
            + {draft.services.length ? t("branch.add_service") : t("branch.add_first_service")}
          </button>
        ) : null}
      </section>

      <section className="grid gap-4">
        <div>
          <h2 className="text-lg font-medium text-foreground">{t("branch.contact_title")}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">{t("branch.contact_body")}</p>
        </div>
        <Field label={t("business.phones")} optional={t("business.optional")} error={errors.phones} note={notes?.phone}>
          <div className="mt-2">
            {draft.phones.length === 0 ? (
              <button type="button" onClick={() => onChange({ ...draft, phones: [""] })} className="text-sm font-medium text-brand">
                + {t("branch.own_phone")}
              </button>
            ) : (
              <PhoneList
                phones={draft.phones}
                onChange={(phones) => onChange({ ...draft, phones })}
                addLabel={t("business.add_phone")}
                removeLabel={t("business.remove_phone")}
                placeholder="+373 ..."
              />
            )}
          </div>
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t("business.website")} optional={t("business.optional")} error={errors.website} note={notes?.website}>
            <input
              className={inputClass}
              value={draft.website}
              placeholder="example.com"
              onChange={(event) => onChange({ ...draft, website: event.target.value })}
            />
          </Field>
          <Field label={t("business.instagram")} optional={t("business.optional")} error={errors.instagram} note={notes?.instagram}>
            <input
              className={inputClass}
              value={draft.instagram}
              placeholder="@name"
              onChange={(event) => onChange({ ...draft, instagram: event.target.value })}
            />
          </Field>
        </div>
      </section>
    </div>
  );
}
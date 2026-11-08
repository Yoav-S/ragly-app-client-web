"use client";

import { useEffect, useRef, useState } from "react";
import { BranchMapClient } from "./branch-map-loader";
import type { MapPoint } from "./branch-map";
import { Field, InstagramInput, PhoneList, inputClass, secondaryButton } from "./form-controls";
import { HoursEditor, hoursError } from "./hours-editor";
import { apiGet } from "@/lib/api";
import {
  weekdayHours,
  type Branch,
  type BranchBody,
  type BusinessCategory,
  type GeoPlace,
  type OpeningHours,
  type PlaceRef,
} from "@/lib/business";
import { cleanInstagram, cleanPhone, cleanWebsite, isBlankInstagram } from "@/lib/contact";
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

export type DetailsMode = "shared" | "separate";

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
  /** Shared = one hours + contacts block. Separate = each service has its own. */
  detailsMode: DetailsMode;
  sharedHours: OpeningHours;
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
      !isBlankInstagram(draft.instagram),
  );
}

function cloneHours(hours: OpeningHours): OpeningHours {
  return JSON.parse(JSON.stringify(hours)) as OpeningHours;
}

function hoursKey(hours: OpeningHours): string {
  return JSON.stringify({
    provided: hours.provided,
    always_open: hours.always_open,
    mon: hours.mon,
    tue: hours.tue,
    wed: hours.wed,
    thu: hours.thu,
    fri: hours.fri,
    sat: hours.sat,
    sun: hours.sun,
    special_dates: hours.special_dates ?? [],
  });
}

const SERVICE_CHIPS: BusinessCategory[] = [
  "veterinarian",
  "groomer",
  "pharmacy",
  "pet_store",
  "pet_friendly",
];

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
    detailsMode: "shared",
    sharedHours: weekdayHours(),
  };
}

/** A new branch copies services and hours from the first location. Address stays empty. */
export function newBranchDraft(existing: Branch[] = []): BranchDraft {
  const source = existing.find((row) => row.is_main) ?? existing[0];
  if (!source) return emptyBranchDraft();
  const template = branchDraftFrom(source);
  return {
    ...emptyBranchDraft(),
    services: template.services.map((service) => ({
      id: null,
      key: nextKey(),
      category: service.category,
      hours: cloneHours(service.hours),
      phones: [],
    })),
    detailsMode: template.detailsMode,
    sharedHours: cloneHours(template.sharedHours),
  };
}

export function branchDraftFrom(branch: Branch): BranchDraft {
  const coordinates = branch.location?.coordinates;
  const services = branch.services.map((service) => ({
    id: service.id,
    key: service.id,
    category: service.category,
    hours: { ...service.opening_hours, special_dates: service.opening_hours.special_dates ?? [] },
    phones: service.phone,
  }));
  const hourKeys = new Set(services.map((service) => hoursKey(service.hours)));
  const separate = services.some((service) => service.phones.length > 0) || hourKeys.size > 1;
  return {
    address: branch.address,
    city: branch.city,
    point: coordinates ? { lat: coordinates[1], lng: coordinates[0] } : null,
    place_ref: branch.place_ref,
    timezone: branch.timezone || null,
    services,
    phones: branch.phone,
    website: branch.website ?? "",
    instagram: branch.instagram ?? "",
    detailsMode: separate ? "separate" : "shared",
    sharedHours: services[0] ? cloneHours(services[0].hours) : weekdayHours(),
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
  const separate = draft.detailsMode === "separate";
  const seen = new Set<string>();
  if (!separate) {
    const problem = hoursError(draft.sharedHours, t);
    if (problem) errors.hours.shared = problem;
  }
  for (const service of draft.services) {
    if (seen.has(service.category)) errors.services = t("branch.fix_service_twice");
    seen.add(service.category);
    if (separate) {
      const problem = hoursError(service.hours, t);
      if (problem) errors.hours[service.key] = problem;
      if (service.phones.some((phone) => phone.trim() && !cleanPhone(phone))) {
        errors.hours[service.key] = t("business.fix_phone_format");
      }
    }
  }
  const phoneTexts = separate ? [] : draft.phones.map((phone) => phone.trim()).filter(Boolean);
  const phones = phoneTexts.map((phone) => cleanPhone(phone));
  if (phones.some((phone) => !phone)) errors.phones = t("business.fix_phone_format");
  const websiteText = draft.website.trim();
  const website = websiteText ? cleanWebsite(websiteText) : null;
  if (websiteText && !website) errors.website = t("business.fix_website");
  const instagramText = draft.instagram.trim();
  const instagram = isBlankInstagram(instagramText) ? null : cleanInstagram(instagramText);
  if (!isBlankInstagram(instagramText) && !instagram) errors.instagram = t("business.fix_instagram");
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
        opening_hours: separate ? service.hours : cloneHours(draft.sharedHours),
        phone: separate
          ? service.phones.map((phone) => cleanPhone(phone)).filter((phone): phone is string => Boolean(phone))
          : [],
      })),
      phone: phones.filter((phone): phone is string => Boolean(phone)),
      website,
      instagram,
      timezone: draft.timezone,
    },
    errors: null,
  };
}

export type BranchSection = "location" | "services" | "contact";

export function stepForBranchErrors(errors: BranchErrors): BranchSection | null {
  if (errors.location || errors.address) return "location";
  if (errors.services) return "services";
  const hourKeys = Object.keys(errors.hours);
  if (hourKeys.includes("shared")) return "contact";
  if (hourKeys.length) return "services";
  if (errors.phones || errors.website || errors.instagram) return "contact";
  return null;
}

function samePoint(point: MapPoint | null, place: GeoPlace): boolean {
  if (!point) return false;
  return Math.abs(point.lat - place.latitude) < 1e-5 && Math.abs(point.lng - place.longitude) < 1e-5;
}

export function BranchFields({
  draft,
  onChange,
  errors,
  notes,
  lockPlace = false,
  lockedServiceIds = [],
  show,
}: {
  draft: BranchDraft;
  onChange: (next: BranchDraft) => void;
  errors: BranchErrors;
  notes?: Record<string, string>;
  /** A live branch keeps its address and pin; a new branch is the way to move. */
  lockPlace?: boolean;
  /** Services already live: category cannot change, only hours and phones. */
  lockedServiceIds?: string[];
  /** When set, only these blocks render. Used by the step-by-step branch form. */
  show?: BranchSection[];
}) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [lookedUp, setLookedUp] = useState("");
  const [geoDown, setGeoDown] = useState(false);
  const searchRef = useRef(0);
  const draftRef = useRef(draft);
  const pickedAddress = useRef("");
  const skipInitialAddress = useRef(Boolean(draft.point));
  draftRef.current = draft;

  function applyPlace(place: GeoPlace, fillAddress: boolean) {
    const address = place.address || place.label;
    if (fillAddress) pickedAddress.current = address;
    const current = draftRef.current;
    onChange({
      ...current,
      address: fillAddress ? address : current.address,
      city: place.city || current.city,
      point: { lat: place.latitude, lng: place.longitude },
      place_ref: place.place_ref,
      timezone: place.timezone ?? current.timezone,
    });
  }

  async function searchAddress(text: string, preview: "search" | "address" | "none") {
    const q = text.trim();
    if (q.length < 3) {
      setResults([]);
      return;
    }
    const user = auth.currentUser;
    if (!user) return;
    const id = ++searchRef.current;
    setSearching(true);
    try {
      const params = new URLSearchParams({ q, locale });
      const pin = draftRef.current.point;
      if (pin) {
        params.set("latitude", String(pin.lat));
        params.set("longitude", String(pin.lng));
      }
      const out = await apiGet<{ items: GeoPlace[] }>(`/geo/search?${params}`, await user.getIdToken());
      if (id !== searchRef.current) return;
      setResults(out.items);
      setLookedUp(q);
      setGeoDown(false);
      if (preview !== "none" && out.items[0]) applyPlace(out.items[0], preview === "search" && out.items.length === 1);
    } catch {
      if (id === searchRef.current) setGeoDown(true);
    } finally {
      if (id === searchRef.current) setSearching(false);
    }
  }

  useEffect(() => {
    if (lockPlace) return;
    const text = query.trim();
    if (text.length < 3) {
      setResults([]);
      return;
    }
    const handle = window.setTimeout(() => {
      void searchAddress(text, "search");
    }, 400);
    return () => window.clearTimeout(handle);
    // searchAddress reads live refs; query/locale/lockPlace are the triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, locale, lockPlace]);

  useEffect(() => {
    if (lockPlace) return;
    const text = draft.address.trim();
    if (text.length < 3) return;
    if (pickedAddress.current === text) return;
    if (skipInitialAddress.current) {
      skipInitialAddress.current = false;
      pickedAddress.current = text;
      return;
    }
    const handle = window.setTimeout(() => {
      void searchAddress(text, "address");
    }, 500);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.address, locale, lockPlace]);

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

  function toggleCategory(category: BusinessCategory) {
    const existing = draft.services.find((service) => service.category === category);
    if (existing) {
      if (existing.id && lockedServiceIds.includes(existing.id)) return;
      onChange({ ...draft, services: draft.services.filter((service) => service.category !== category) });
      return;
    }
    const previous = draft.services[0];
    onChange({
      ...draft,
      services: [
        ...draft.services,
        {
          id: null,
          key: nextKey(),
          category,
          hours: cloneHours(draft.detailsMode === "shared" ? draft.sharedHours : previous ? previous.hours : weekdayHours()),
          phones: [],
        },
      ],
    });
  }

  function setDetailsMode(detailsMode: DetailsMode) {
    if (detailsMode === draft.detailsMode) return;
    if (detailsMode === "separate") {
      onChange({
        ...draft,
        detailsMode,
        services: draft.services.map((service) => ({ ...service, hours: cloneHours(draft.sharedHours) })),
      });
      return;
    }
    onChange({
      ...draft,
      detailsMode,
      sharedHours: draft.services[0] ? cloneHours(draft.services[0].hours) : draft.sharedHours,
      services: draft.services.map((service) => ({ ...service, phones: [] })),
    });
  }

  function updateService(key: string, patch: Partial<ServiceDraft>) {
    onChange({ ...draft, services: draft.services.map((service) => (service.key === key ? { ...service, ...patch } : service)) });
  }

  const visible = (section: BranchSection) => !show || show.includes(section);
  const stepped = Boolean(show);
  const showMatches =
    !lockPlace &&
    query.trim().length >= 3 &&
    (results.length > 0 || searching || (lookedUp === query.trim() && !geoDown));

  return (
    <div className="grid gap-8">
      {visible("location") ? (
      <section className="grid gap-4">
        {stepped ? (
          <p className="text-sm leading-6 text-muted">{lockPlace ? t("branch.where_locked") : t("branch.where_body")}</p>
        ) : (
          <div>
            <h2 className="text-lg font-medium text-foreground">{t("branch.where_title")}</h2>
            <p className="mt-1 text-sm leading-6 text-muted">{lockPlace ? t("branch.where_locked") : t("branch.where_body")}</p>
          </div>
        )}
        {!lockPlace ? (
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
                    void searchAddress(query, "search");
                  }
                }}
                autoComplete="off"
              />
              <button type="button" onClick={() => void searchAddress(query, "search")} className={secondaryButton} disabled={searching}>
                {searching ? t("branch.searching") : t("branch.search")}
              </button>
            </div>
          </Field>
        ) : null}
        <BranchMapClient point={draft.point} onChange={lockPlace ? undefined : movePin} editable={!lockPlace} className="h-[320px]" />
        {showMatches ? (
          <div className="rounded-2xl border border-line bg-background">
            <div className="border-b border-line px-4 py-3">
              <p className="text-sm font-medium text-foreground">{t("branch.matches_title")}</p>
              <p className="mt-0.5 text-xs leading-5 text-muted">{t("branch.matches_hint")}</p>
            </div>
            <ul className="max-h-64 overflow-y-auto">
              {searching && !results.length ? <li className="px-4 py-3 text-sm text-muted">{t("branch.searching")}</li> : null}
              {!searching && !results.length && lookedUp === query.trim() ? (
                <li className="px-4 py-3 text-sm text-muted">{t("branch.search_empty")}</li>
              ) : null}
              {results.map((place, index) => {
                const selected = samePoint(draft.point, place);
                return (
                  <li key={`${place.latitude},${place.longitude},${index}`} className="border-t border-line first:border-t-0">
                    <button
                      type="button"
                      onClick={() => applyPlace(place, true)}
                      className={`block w-full px-4 py-3 text-start text-sm ${
                        selected ? "bg-[#EEF3F2] text-foreground" : "text-foreground hover:bg-surface"
                      }`}
                    >
                      <span className="block font-medium">{place.address || place.label}</span>
                      <span className="mt-0.5 block text-xs text-muted">{place.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
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
      ) : null}

      {visible("services") ? (
      <section className={`flex w-full flex-col items-start gap-4 ${stepped ? "" : "rounded-2xl bg-background p-4 sm:p-5"}`}>
        <h2 className="text-[24px] font-normal leading-[29px] text-black">{t("branch.services")}</h2>
        <div
          role="group"
          aria-label={t("branch.services")}
          className="flex w-full max-w-full gap-[11px] overflow-x-auto sm:max-w-[437px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {SERVICE_CHIPS.map((category) => {
            const service = draft.services.find((item) => item.category === category);
            const selected = Boolean(service);
            const locked = Boolean(service?.id && lockedServiceIds.includes(service.id));
            return (
              <button
                key={category}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleCategory(category)}
                className={`inline-flex h-[35px] shrink-0 items-center justify-center rounded-xl px-2.5 text-xs leading-[15px] font-normal whitespace-nowrap ${
                  selected ? "bg-brand text-[#F6F7F9]" : "bg-white text-black"
                } ${locked ? "cursor-not-allowed" : ""}`}
              >
                {t(`categories.${category}`)}
              </button>
            );
          })}
        </div>
        {draft.services.some((service) => service.id && lockedServiceIds.includes(service.id)) ? (
          <p className="text-xs leading-5 text-muted">{t("branch.service_live")}</p>
        ) : null}
        {notes?.services ? <p className="rounded-xl bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]">{notes.services}</p> : null}
        {SERVICE_CHIPS.map((category) => {
          const note = notes?.[`service:${category}`];
          return note ? (
            <p key={category} className="rounded-xl bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]">
              {note}
            </p>
          ) : null;
        })}
        {errors.services ? (
          <p className="text-sm text-[#EF4444]" role="alert">
            {errors.services}
          </p>
        ) : null}
      </section>
      ) : null}

      {visible("contact") ? (
      draft.detailsMode === "shared" ? (
        <section className="grid gap-4">
          {stepped ? (
            <p className="text-sm leading-6 text-muted">{t("branch.shared_body")}</p>
          ) : (
            <div>
              <h2 className="text-lg font-medium text-foreground">{t("branch.shared_title")}</h2>
              <p className="mt-1 text-sm leading-6 text-muted">{t("branch.shared_body")}</p>
            </div>
          )}
          {notes?.hours ? <p className="rounded-xl bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]">{notes.hours}</p> : null}
          <div>
            <p className="text-sm font-medium text-foreground">{t("business.hours")}</p>
            <div className="mt-2">
              <HoursEditor hours={draft.sharedHours} onChange={(sharedHours) => onChange({ ...draft, sharedHours })} />
            </div>
            {errors.hours.shared ? (
              <p className="mt-2 text-sm text-[#EF4444]" role="alert">
                {errors.hours.shared}
              </p>
            ) : null}
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
              <InstagramInput value={draft.instagram} onChange={(instagram) => onChange({ ...draft, instagram })} />
            </Field>
          </div>
        </section>
      ) : (
        <section className="grid gap-4">
          {stepped ? (
            <p className="text-sm leading-6 text-muted">{t("branch.contact_body_separate")}</p>
          ) : (
            <div>
              <h2 className="text-lg font-medium text-foreground">{t("branch.contact_title")}</h2>
              <p className="mt-1 text-sm leading-6 text-muted">{t("branch.contact_body_separate")}</p>
            </div>
          )}
          {notes?.hours ? <p className="rounded-xl bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]">{notes.hours}</p> : null}
          {draft.services.length === 0 ? <p className="text-sm text-muted">{t("branch.no_services")}</p> : null}
          {draft.services.map((service) => {
            const locked = service.id ? lockedServiceIds.includes(service.id) : false;
            return (
              <div key={service.key} className="rounded-2xl border border-line bg-background p-4 sm:p-5">
                <p className="text-sm font-medium text-foreground">{t(`categories.${service.category}`)}</p>
                {locked ? <p className="mt-1 text-xs text-muted">{t("branch.service_live")}</p> : null}
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
                        if (source) updateService(service.key, { hours: cloneHours(source.hours) });
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
              </div>
            );
          })}
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
              <InstagramInput value={draft.instagram} onChange={(instagram) => onChange({ ...draft, instagram })} />
            </Field>
          </div>
        </section>
      )
      ) : null}
      {visible("contact") && draft.services.length > 0 ? (
        <button type="button" onClick={() => setDetailsMode(draft.detailsMode === "shared" ? "separate" : "shared")} className="text-sm font-medium text-brand">
          {draft.detailsMode === "shared" ? t("branch.use_separate") : t("branch.use_shared")}
        </button>
      ) : null}
    </div>
  );
}
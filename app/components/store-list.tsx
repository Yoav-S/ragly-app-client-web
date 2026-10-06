"use client";

import { FormEvent, useState } from "react";
import { ConfirmModal } from "./confirm-modal";
import { apiDelete, apiPost } from "@/lib/api";
import { cleanPhone, parseCoordinate } from "@/lib/contact";
import type { Business, OpeningHours, StoreLocation } from "@/lib/business";
import { useI18n } from "@/lib/i18n";

const fieldClass =
  "mt-2 h-11 w-full rounded-2xl border border-line bg-background px-4 text-sm text-foreground outline-none focus:border-brand";

function hours(open: string, close: string, weekendOpen: string, weekendClose: string): OpeningHours {
  const weekday = open && close ? [{ open, close }] : [];
  const saturday = weekendOpen && weekendClose ? [{ open: weekendOpen, close: weekendClose }] : [];
  return {
    always_open: false,
    mon: weekday,
    tue: weekday,
    wed: weekday,
    thu: weekday,
    fri: weekday,
    sat: saturday,
    sun: [],
  };
}

function phoneLine(store: StoreLocation): string {
  return store.phone.length ? store.phone.join(", ") : "";
}

export function StoreList({
  business,
  canAdd,
  partOfReview = false,
  token,
  onChanged,
}: {
  business: Business;
  canAdd: boolean;
  partOfReview?: boolean;
  token: () => Promise<string>;
  onChanged: (business: Business) => void;
}) {
  const { t } = useI18n();
  const stores = business.locations ?? [];
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState(business.city);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [phone, setPhone] = useState("");
  const [weekdayOpen, setWeekdayOpen] = useState("09:00");
  const [weekdayClose, setWeekdayClose] = useState("19:00");
  const [saturdayOpen, setSaturdayOpen] = useState("");
  const [saturdayClose, setSaturdayClose] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  function requestAdd(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (phone.trim() && !cleanPhone(phone)) {
      setError(t("business.fix_phone_format"));
      return;
    }
    const latitudeNumber = parseCoordinate(latitude);
    const longitudeNumber = parseCoordinate(longitude);
    if (
      !Number.isFinite(latitudeNumber) ||
      latitudeNumber < -90 ||
      latitudeNumber > 90 ||
      !Number.isFinite(longitudeNumber) ||
      longitudeNumber < -180 ||
      longitudeNumber > 180
    ) {
      setError(t("business.fix_location_range"));
      return;
    }
    setError("");
    setConfirming(true);
  }

  async function addStore() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const saved = await apiPost<StoreLocation>(
        `/businesses/${business.id}/locations`,
        await token(),
        {
          address: address.trim(),
          city: city.trim(),
          timezone: business.timezone || "Europe/Chisinau",
          opening_hours: hours(weekdayOpen, weekdayClose, saturdayOpen, saturdayClose),
          location: {
            type: "Point",
            coordinates: [parseCoordinate(longitude), parseCoordinate(latitude)],
          },
          phone: cleanPhone(phone) ? [cleanPhone(phone) as string] : [],
        },
      );
      onChanged({ ...business, locations: [...stores, saved] });
      setAddress("");
      setPhone("");
      setOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  async function removeStore(store: StoreLocation) {
    setError("");
    try {
      await apiDelete(`/businesses/${business.id}/locations/${store.id}`, await token());
      onChanged({ ...business, locations: stores.filter((item) => item.id !== store.id) });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.error"));
    }
  }

  return (
    <section className="mt-6 grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium text-foreground">{t("dashboard.stores")}</h2>
        {canAdd && !open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-brand px-4 text-sm font-medium text-white"
          >
            {t("dashboard.add_store")}
          </button>
        ) : null}
      </div>
      {canAdd ? <p className="text-sm leading-6 text-muted">{t("dashboard.stores_hint")}</p> : null}
      {stores.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface px-4 py-8 text-sm text-muted">{t("dashboard.stores_none")}</p>
      ) : (
      <ul className="grid gap-3">
        {stores.map((store) => (
          <li key={store.id} className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-medium text-foreground">{store.address}</p>
                <p className="mt-1 text-sm text-muted">{store.city}</p>
              </div>
              <span className="shrink-0 rounded-full bg-[#EEF3F2] px-3 py-1 text-xs font-medium text-brand">
                {partOfReview
                  ? t("dashboard.store_badge_review")
                  : store.status === "pending_review"
                    ? t("dashboard.store_badge_pending")
                    : store.status === "rejected"
                      ? t("dashboard.store_badge_rejected")
                      : t("dashboard.store_badge_live")}
              </span>
            </div>
            <p className="mt-3 text-sm text-foreground">
              {phoneLine(store) || t("dashboard.shared_phone")}
            </p>
            {store.status === "rejected" && store.rejection_reason ? (
              <p className="mt-2 text-sm text-[#EF4444]">{store.rejection_reason}</p>
            ) : null}
            {canAdd && stores.length > 1 ? (
              <button
                type="button"
                onClick={() => void removeStore(store)}
                className="mt-3 text-sm font-medium text-[#EF4444]"
              >
                {t("dashboard.remove_store")}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      )}
      {error ? <p className="text-sm text-[#EF4444]">{error}</p> : null}
      {canAdd ? (
        open ? (
          <form onSubmit={requestAdd} className="grid gap-3 rounded-2xl border border-line p-4">
            <label className="text-sm text-muted">
              {t("business.address")}
              <input className={fieldClass} required value={address} onChange={(event) => setAddress(event.target.value)} />
            </label>
            <label className="text-sm text-muted">
              {t("business.city")}
              <input className={fieldClass} required value={city} onChange={(event) => setCity(event.target.value)} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-muted">
                {t("business.latitude")}
                <input className={fieldClass} required inputMode="decimal" value={latitude} onChange={(event) => setLatitude(event.target.value)} />
              </label>
              <label className="text-sm text-muted">
                {t("business.longitude")}
                <input className={fieldClass} required inputMode="decimal" value={longitude} onChange={(event) => setLongitude(event.target.value)} />
              </label>
            </div>
            <p className="text-sm text-muted">{t("dashboard.map_hint")}</p>
            <label className="text-sm text-muted">
              {t("dashboard.store_phone")}
              <input className={fieldClass} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+1 555 010 0199" />
              <span className="mt-2 block">{t("business.phone_hint")}</span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-muted">
                {t("dashboard.weekday_open")}
                <input className={fieldClass} type="time" value={weekdayOpen} onChange={(event) => setWeekdayOpen(event.target.value)} />
              </label>
              <label className="text-sm text-muted">
                {t("dashboard.weekday_close")}
                <input className={fieldClass} type="time" value={weekdayClose} onChange={(event) => setWeekdayClose(event.target.value)} />
              </label>
              <label className="text-sm text-muted">
                {t("dashboard.saturday_open")}
                <input className={fieldClass} type="time" value={saturdayOpen} onChange={(event) => setSaturdayOpen(event.target.value)} />
              </label>
              <label className="text-sm text-muted">
                {t("dashboard.saturday_close")}
                <input className={fieldClass} type="time" value={saturdayClose} onChange={(event) => setSaturdayClose(event.target.value)} />
              </label>
            </div>
            <p className="text-sm text-muted">{t("dashboard.saturday_hint")}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-brand px-4 text-sm font-medium text-white"
              >
                {t("dashboard.add_store")}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-line px-4 text-sm font-medium text-foreground"
              >
                {t("back")}
              </button>
            </div>
          </form>
        ) : null
      ) : null}
      <ConfirmModal
        open={confirming}
        title={t("dashboard.store_submit_title")}
        body={t("dashboard.store_submit_body")}
        confirmLabel={t("dashboard.add_store")}
        cancelLabel={t("dashboard.keep_editing")}
        pending={saving}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void addStore();
        }}
      />
    </section>
  );
}

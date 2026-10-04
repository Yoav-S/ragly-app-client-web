"use client";

import { FormEvent, useState } from "react";
import { apiDelete, apiPost } from "@/lib/api";
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
  token,
  onChanged,
}: {
  business: Business;
  canAdd: boolean;
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

  async function addStore(event: FormEvent) {
    event.preventDefault();
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
            coordinates: [Number(longitude), Number(latitude)],
          },
          phone: phone.trim() ? [phone.trim()] : [],
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
    <section className="mt-8 grid gap-3 border-t border-line pt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium text-foreground">{t("dashboard.stores")}</h2>
        <p className="text-sm text-muted">{t("dashboard.store_count", { n: String(stores.length) })}</p>
      </div>
      <p className="text-sm text-muted">{t("dashboard.stores_hint")}</p>
      <ul className="grid gap-3">
        {stores.map((store) => (
          <li key={store.id} className="rounded-2xl border border-line bg-background p-4">
            <p className="text-sm font-medium text-foreground">{store.address}</p>
            <p className="mt-1 text-sm text-muted">{store.city}</p>
            <p className="mt-2 text-sm text-foreground">
              {phoneLine(store) || t("dashboard.shared_phone")}
            </p>
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
      {error ? <p className="text-sm text-[#EF4444]">{error}</p> : null}
      {canAdd ? (
        open ? (
          <form onSubmit={(event) => void addStore(event)} className="grid gap-3 rounded-2xl border border-line p-4">
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
            <label className="text-sm text-muted">
              {t("dashboard.store_phone")}
              <input className={fieldClass} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder={t("dashboard.store_phone_hint")} />
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
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-brand px-4 text-sm font-medium text-white"
            >
              {t("dashboard.add_store")}
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-line px-4 text-sm font-medium text-foreground"
          >
            {t("dashboard.add_store")}
          </button>
        )
      ) : null}
    </section>
  );
}

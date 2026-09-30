"use client";

import { FormEvent, useState } from "react";
import { apiPost } from "@/lib/api";
import { auth } from "@/lib/firebase";
import {
  CATEGORIES,
  DAYS,
  type Business,
  type BusinessCategory,
  type OpeningHours,
  type Weekday,
} from "@/lib/business";
import { errorMessage } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";
import { uploadBusinessPhoto } from "@/lib/storage";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type DayState = { closed: boolean; open: string; close: string };

const WEEKDAY_DEFAULT: DayState = { closed: false, open: "09:00", close: "17:00" };

function emptyDays(): Record<Weekday, DayState> {
  return {
    mon: { ...WEEKDAY_DEFAULT },
    tue: { ...WEEKDAY_DEFAULT },
    wed: { ...WEEKDAY_DEFAULT },
    thu: { ...WEEKDAY_DEFAULT },
    fri: { ...WEEKDAY_DEFAULT },
    sat: { closed: false, open: "09:00", close: "13:00" },
    sun: { closed: true, open: "09:00", close: "13:00" },
  };
}

function daysFromBusiness(business: Business): Record<Weekday, DayState> {
  const days = emptyDays();
  if (business.opening_hours.always_open) return days;
  for (const day of DAYS) {
    const slot = business.opening_hours[day][0];
    days[day] = slot
      ? { closed: false, open: slot.open, close: slot.close }
      : { closed: true, open: "09:00", close: "13:00" };
  }
  return days;
}

function hoursFromForm(
  alwaysOpen: boolean,
  days: Record<Weekday, DayState>,
): OpeningHours {
  const hours = { always_open: alwaysOpen } as OpeningHours;
  for (const day of DAYS) {
    const row = days[day];
    hours[day] = alwaysOpen || row.closed ? [] : [{ open: row.open, close: row.close }];
  }
  return hours;
}

function formIsValid(input: {
  name: string;
  phones: string[];
  email: string;
  city: string;
  address: string;
  timezone: string;
  website: string;
  latitude: string;
  longitude: string;
  alwaysOpen: boolean;
  days: Record<Weekday, DayState>;
}): boolean {
  if (!input.name.trim() || !input.city.trim() || !input.address.trim()) return false;
  if (!input.timezone.trim()) return false;
  if (!input.phones.some((phone) => phone.trim())) return false;
  if (input.email.trim() && !EMAIL_PATTERN.test(input.email.trim())) return false;
  if (input.website.trim() && !/^https?:\/\//.test(input.website.trim())) return false;
  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return false;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return false;
  if (input.alwaysOpen) return true;
  return DAYS.every((day) => {
    const row = input.days[day];
    if (row.closed) return true;
    return Boolean(row.open && row.close && row.open < row.close);
  });
}

const fieldClass =
  "mt-2 h-12 w-full rounded-2xl border border-line bg-surface px-4 text-base text-foreground outline-none focus:border-brand";

export function BusinessForm({
  initial,
  onSubmitted,
}: {
  initial?: Business;
  onSubmitted: (business: Business) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(initial?.name ?? "");
  const [phones, setPhones] = useState(initial?.phones.length ? initial.phones : [""]);
  const [email, setEmail] = useState(initial?.email ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState<BusinessCategory>(
    initial?.category ?? "veterinarian",
  );
  const [city, setCity] = useState(initial?.city ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [timezone, setTimezone] = useState(initial?.timezone ?? "Europe/Chisinau");
  const [alwaysOpen, setAlwaysOpen] = useState(initial?.opening_hours.always_open ?? false);
  const [days, setDays] = useState(initial ? daysFromBusiness(initial) : emptyDays);
  const [website, setWebsite] = useState(initial?.website ?? "");
  const [latitude, setLatitude] = useState(
    initial ? String(initial.latitude) : "",
  );
  const [longitude, setLongitude] = useState(
    initial ? String(initial.longitude) : "",
  );
  const [instagram, setInstagram] = useState(initial?.instagram ?? "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const valid = formIsValid({
    name,
    phones,
    email,
    city,
    address,
    timezone,
    website,
    latitude,
    longitude,
    alwaysOpen,
    days,
  });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || pending) return;
    const user = auth.currentUser;
    if (!user) return;
    setPending(true);
    setError("");
    try {
      const photoUrl = photo ? await uploadBusinessPhoto(photo) : null;
      const token = await user.getIdToken();
      const created = await apiPost<Business>("/businesses", token, {
        name: name.trim(),
        phones: phones.map((phone) => phone.trim()).filter(Boolean),
        email: email.trim() || null,
        description: description.trim() || null,
        category,
        city: city.trim(),
        address: address.trim(),
        timezone: timezone.trim(),
        opening_hours: hoursFromForm(alwaysOpen, days),
        website: website.trim() || null,
        latitude: Number(latitude),
        longitude: Number(longitude),
        photo_url: photoUrl,
        instagram: instagram.trim() || null,
      });
      onSubmitted(created);
    } catch (err: unknown) {
      setError(errorMessage(err, t));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 grid gap-5" noValidate>
      <h1 className="text-3xl font-medium text-foreground">{t("business.title")}</h1>
      <label className="block text-sm text-muted">
        {t("business.name")}
        <input className={fieldClass} value={name} required onChange={(event) => setName(event.target.value)} />
      </label>
      <fieldset className="grid gap-3">
        <legend className="text-sm text-muted">{t("business.phones")}</legend>
        {phones.map((phone, index) => (
          <input
            key={index}
            className={fieldClass}
            value={phone}
            inputMode="tel"
            autoComplete="tel"
            onChange={(event) => {
              const next = [...phones];
              next[index] = event.target.value;
              setPhones(next);
            }}
          />
        ))}
        <button
          type="button"
          className="justify-self-start text-sm font-medium text-brand"
          onClick={() => setPhones([...phones, ""])}
        >
          {t("business.add_phone")}
        </button>
      </fieldset>
      <label className="block text-sm text-muted">
        {t("business.category")}
        <select
          className={fieldClass}
          value={category}
          onChange={(event) => setCategory(event.target.value as BusinessCategory)}
        >
          {CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {t(`business.${item}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm text-muted">
        {t("business.city")}
        <input className={fieldClass} value={city} required onChange={(event) => setCity(event.target.value)} />
      </label>
      <label className="block text-sm text-muted">
        {t("business.address")}
        <input className={fieldClass} value={address} required onChange={(event) => setAddress(event.target.value)} />
      </label>
      <label className="block text-sm text-muted">
        {t("business.timezone")}
        <input className={fieldClass} value={timezone} required onChange={(event) => setTimezone(event.target.value)} />
      </label>
      <fieldset className="grid gap-3 rounded-2xl border border-line bg-surface p-4">
        <legend className="px-1 text-sm text-muted">{t("business.hours")}</legend>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={alwaysOpen}
            onChange={(event) => setAlwaysOpen(event.target.checked)}
          />
          {t("business.always_open")}
        </label>
        {alwaysOpen
          ? null
          : DAYS.map((day) => {
              const row = days[day];
              return (
                <div key={day} className="grid gap-2 sm:grid-cols-[8rem_auto_1fr_1fr] sm:items-center">
                  <span className="text-sm text-foreground">{t(`business.${day}`)}</span>
                  <label className="flex items-center gap-2 text-sm text-muted">
                    <input
                      type="checkbox"
                      checked={row.closed}
                      onChange={(event) =>
                        setDays({ ...days, [day]: { ...row, closed: event.target.checked } })
                      }
                    />
                    {t("business.closed")}
                  </label>
                  <input
                    type="time"
                    disabled={row.closed}
                    value={row.open}
                    className={fieldClass}
                    onChange={(event) =>
                      setDays({ ...days, [day]: { ...row, open: event.target.value } })
                    }
                  />
                  <input
                    type="time"
                    disabled={row.closed}
                    value={row.close}
                    className={fieldClass}
                    onChange={(event) =>
                      setDays({ ...days, [day]: { ...row, close: event.target.value } })
                    }
                  />
                </div>
              );
            })}
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm text-muted">
          {t("business.latitude")}
          <input className={fieldClass} inputMode="decimal" value={latitude} required onChange={(event) => setLatitude(event.target.value)} />
        </label>
        <label className="block text-sm text-muted">
          {t("business.longitude")}
          <input className={fieldClass} inputMode="decimal" value={longitude} required onChange={(event) => setLongitude(event.target.value)} />
        </label>
      </div>
      <label className="block text-sm text-muted">
        {t("business.description")} <span>({t("business.optional")})</span>
        <textarea
          className="mt-2 min-h-28 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-base text-foreground outline-none focus:border-brand"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <label className="block text-sm text-muted">
        {t("business.email")} <span>({t("business.optional")})</span>
        <input className={fieldClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label className="block text-sm text-muted">
        {t("business.website")} <span>({t("business.optional")})</span>
        <input className={fieldClass} type="url" value={website} onChange={(event) => setWebsite(event.target.value)} />
      </label>
      <label className="block text-sm text-muted">
        {t("business.instagram")} <span>({t("business.optional")})</span>
        <input className={fieldClass} value={instagram} onChange={(event) => setInstagram(event.target.value)} />
      </label>
      <label className="block text-sm text-muted">
        {t("business.photo")} <span>({t("business.optional")})</span>
        <input
          className="mt-2 block w-full text-sm"
          type="file"
          accept="image/*"
          onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
        />
      </label>
      {error ? (
        <p className="text-sm text-[#EF4444]" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={!valid || pending}
        className="inline-flex h-12 items-center justify-center rounded-2xl bg-brand px-5 text-sm font-medium text-white disabled:bg-[#8DB0AA]"
      >
        {t("business.submit")}
      </button>
    </form>
  );
}

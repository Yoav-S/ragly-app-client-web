"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { apiPatch, apiPost, apiUpload } from "@/lib/api";
import { auth } from "@/lib/firebase";
import {
  CATEGORIES,
  DAYS,
  type Business,
  type BusinessCategory,
  type OpeningHours,
  type Weekday,
} from "@/lib/business";
import { ConfirmModal } from "./confirm-modal";
import { cleanEmail, cleanInstagram, cleanPhone, cleanWebsite, parseCoordinate } from "@/lib/contact";
import { errorMessage } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_PHOTOS = 6;

type PickedPhoto = { file: File; url: string };

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

type FormProblem = { id: string; day?: Weekday };

function collectProblems(input: {
  name: string;
  phones: string[];
  email: string;
  city: string;
  address: string;
  timezone: string;
  website: string;
  instagram: string;
  latitude: string;
  longitude: string;
  alwaysOpen: boolean;
  days: Record<Weekday, DayState>;
  ownerEmail: string;
  checkOwnerEmail: boolean;
}): FormProblem[] {
  const problems: FormProblem[] = [];
  if (!input.name.trim()) problems.push({ id: "name" });
  const filledPhones = input.phones.map((phone) => phone.trim()).filter(Boolean);
  if (filledPhones.length === 0) problems.push({ id: "phone" });
  else if (filledPhones.some((phone) => !cleanPhone(phone))) problems.push({ id: "phone_format" });
  if (!input.city.trim()) problems.push({ id: "city" });
  if (!input.address.trim()) problems.push({ id: "address" });
  if (!input.timezone.trim()) problems.push({ id: "timezone" });
  if (!input.latitude.trim() || !input.longitude.trim()) problems.push({ id: "location" });
  else {
    const latitude = parseCoordinate(input.latitude);
    const longitude = parseCoordinate(input.longitude);
    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      problems.push({ id: "location_range" });
    }
  }
  if (!input.alwaysOpen) {
    const badDay = DAYS.find((day) => {
      const row = input.days[day];
      return !row.closed && !(row.open && row.close && row.open < row.close);
    });
    if (badDay) problems.push({ id: "hours", day: badDay });
  }
  if (input.email.trim() && !cleanEmail(input.email)) problems.push({ id: "email" });
  if (input.website.trim() && !cleanWebsite(input.website)) problems.push({ id: "website" });
  if (input.instagram.trim() && !cleanInstagram(input.instagram)) problems.push({ id: "instagram" });
  if (input.checkOwnerEmail && input.ownerEmail.trim() && !cleanEmail(input.ownerEmail)) {
    problems.push({ id: "owner_email" });
  }
  return problems;
}

const fieldClass =
  "mt-2 h-12 w-full rounded-2xl border border-line bg-surface px-4 text-base text-foreground outline-none focus:border-brand";

export function BusinessForm({
  initial,
  mode = "owner",
  onSubmitted,
}: {
  initial?: Business;
  mode?: "owner" | "admin" | "edit" | "manage";
  onSubmitted: (business: Business) => void;
}) {
  const { t } = useI18n();
  const [ownerEmail, setOwnerEmail] = useState("");
  const [name, setName] = useState(initial?.name ?? "");
  const [phones, setPhones] = useState(initial?.phone.length ? initial.phone : [""]);
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
    initial?.location ? String(initial.location.coordinates[1]) : "",
  );
  const [longitude, setLongitude] = useState(
    initial?.location ? String(initial.location.coordinates[0]) : "",
  );
  const [instagram, setInstagram] = useState(initial?.instagram ?? "");
  const [picked, setPicked] = useState<PickedPhoto[]>([]);
  const [error, setError] = useState("");
  const [problems, setProblems] = useState<FormProblem[]>([]);
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const problemRef = useRef<HTMLDivElement>(null);

  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  const createdRef = useRef<Business | null>(null);
  const uploadedRef = useRef<WeakSet<File>>(new WeakSet());
  useEffect(() => {
    return () => {
      for (const item of pickedRef.current) URL.revokeObjectURL(item.url);
    };
  }, []);
  const problemCount = useRef(0);
  useEffect(() => {
    if (problems.length > problemCount.current) {
      problemRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    problemCount.current = problems.length;
  }, [problems]);

  function currentProblems(): FormProblem[] {
    return collectProblems({
      name,
      phones,
      email,
      city,
      address,
      timezone,
      website,
      instagram,
      latitude,
      longitude,
      alwaysOpen,
      days,
      ownerEmail,
      checkOwnerEmail: mode === "admin",
    });
  }

  function clearProblem(id: string) {
    setProblems((current) =>
      current.filter((item) => {
        if (item.id === id) return false;
        if (id === "phone" && item.id === "phone_format") return false;
        if (id === "location" && item.id === "location_range") return false;
        return true;
      }),
    );
  }

  function box(id: string): string {
    const bad = problems.some(
      (item) =>
        item.id === id ||
        (id === "phone" && item.id === "phone_format") ||
        (id === "location" && item.id === "location_range"),
    );
    return bad ? fieldClass.replace("border-line", "border-[#EF4444]") : fieldClass;
  }

  async function send() {
    const found = currentProblems();
    if (found.length || pending) {
      setProblems(found);
      return;
    }
    const user = auth.currentUser;
    if (!user) return;
    setPending(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const body = {
        ...(mode === "admin" && ownerEmail.trim()
          ? { owner_email: ownerEmail.trim().toLowerCase() }
          : {}),
        name: name.trim(),
        phone: phones.map((item) => cleanPhone(item)).filter((item): item is string => Boolean(item)),
        email: cleanEmail(email),
        description: description.trim() || null,
        category,
        city: city.trim(),
        address: address.trim(),
        timezone: timezone.trim(),
        opening_hours: hoursFromForm(alwaysOpen, days),
        website: cleanWebsite(website),
        location: {
          type: "Point" as const,
          coordinates: [parseCoordinate(longitude), parseCoordinate(latitude)] as [number, number],
        },
        photo: initial?.photo ?? null,
        instagram: cleanInstagram(instagram),
      };
      const updating = (mode === "edit" || mode === "manage") && initial;
      let saved = updating ? null : createdRef.current;
      if (!saved) {
        saved = updating
          ? await apiPatch<Business>(
              mode === "manage"
                ? `/businesses/${initial.id}`
                : `/admin/businesses/${initial.id}`,
              token,
              body,
            )
          : await apiPost<Business>(
              mode === "admin" ? "/admin/businesses" : "/businesses",
              token,
              body,
            );
        if (!updating) createdRef.current = saved;
      }
      if ((mode === "admin" || mode === "owner") && picked.length > 0) {
        const photoPath =
          mode === "admin"
            ? `/admin/businesses/${saved.id}/photos`
            : `/businesses/${saved.id}/photos`;
        for (const item of picked) {
          if (uploadedRef.current.has(item.file)) continue;
          saved = await apiUpload<Business>(photoPath, token, item.file);
          uploadedRef.current.add(item.file);
          createdRef.current = saved;
        }
      }
      onSubmitted(saved);
    } catch (err: unknown) {
      setError(errorMessage(err, t));
      setPending(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const found = currentProblems();
    setProblems(found);
    if (found.length) return;
    if (mode === "owner") {
      setConfirming(true);
      return;
    }
    void send();
  }

  return (
    <>
    <form
      onSubmit={onSubmit}
      className={mode === "owner" ? "mt-8 grid gap-5" : "grid gap-5"}
      noValidate
    >
      {mode === "owner" ? (
        <h1 className="text-3xl font-medium text-foreground">{t("business.title")}</h1>
      ) : mode === "edit" || mode === "manage" ? null : (
        <label className="block text-sm text-muted">
          {t("admin.owner_account")} <span>({t("business.optional")})</span>
          <input
            className={box("owner_email")}
            type="email"
            value={ownerEmail}
            onChange={(event) => {
              setOwnerEmail(event.target.value);
              clearProblem("owner_email");
            }}
          />
          <span className="mt-2 block text-sm">{t("admin.owner_account_hint")}</span>
        </label>
      )}
      <label className="block text-sm text-muted">
        {t("business.name")} <span>({t("business.required")})</span>
        <input
          className={box("name")}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            clearProblem("name");
          }}
        />
      </label>
      <fieldset className="grid gap-3">
        <legend className="text-sm text-muted">
          {t("business.phones")} <span>({t("business.required")})</span>
        </legend>
        <p className="text-sm text-muted">{t("business.phone_hint")}</p>
        {phones.map((phone, index) => (
          <input
            key={index}
            className={box("phone")}
            value={phone}
            inputMode="tel"
            autoComplete="tel"
            placeholder="+972 522 723 686"
            onChange={(event) => {
              const next = [...phones];
              next[index] = event.target.value;
              setPhones(next);
              clearProblem("phone");
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
        {t("business.city")} <span>({t("business.required")})</span>
        <input
          className={box("city")}
          value={city}
          onChange={(event) => {
            setCity(event.target.value);
            clearProblem("city");
          }}
        />
      </label>
      <label className="block text-sm text-muted">
        {t("business.address")} <span>({t("business.required")})</span>
        <input
          className={box("address")}
          value={address}
          onChange={(event) => {
            setAddress(event.target.value);
            clearProblem("address");
          }}
        />
      </label>
      <label className="block text-sm text-muted">
        {t("business.timezone")} <span>({t("business.required")})</span>
        <input
          className={box("timezone")}
          value={timezone}
          onChange={(event) => {
            setTimezone(event.target.value);
            clearProblem("timezone");
          }}
        />
      </label>
      <fieldset className="grid gap-3 rounded-2xl border border-line bg-surface p-4">
        <legend className="px-1 text-sm text-muted">
          {t("business.hours")} <span>({t("business.required")})</span>
        </legend>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={alwaysOpen}
            onChange={(event) => {
              setAlwaysOpen(event.target.checked);
              clearProblem("hours");
            }}
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
                      onChange={(event) => {
                        setDays({ ...days, [day]: { ...row, closed: event.target.checked } });
                        clearProblem("hours");
                      }}
                    />
                    {t("business.closed")}
                  </label>
                  <input
                    type="time"
                    disabled={row.closed}
                    value={row.open}
                    className={fieldClass}
                    onChange={(event) => {
                      setDays({ ...days, [day]: { ...row, open: event.target.value } });
                      clearProblem("hours");
                    }}
                  />
                  <input
                    type="time"
                    disabled={row.closed}
                    value={row.close}
                    className={fieldClass}
                    onChange={(event) => {
                      setDays({ ...days, [day]: { ...row, close: event.target.value } });
                      clearProblem("hours");
                    }}
                  />
                </div>
              );
            })}
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm text-muted">
          {t("business.latitude")} <span>({t("business.required")})</span>
          <input
            className={box("location")}
            inputMode="decimal"
            value={latitude}
            onChange={(event) => {
              setLatitude(event.target.value);
              clearProblem("location");
            }}
          />
        </label>
        <label className="block text-sm text-muted">
          {t("business.longitude")} <span>({t("business.required")})</span>
          <input
            className={box("location")}
            inputMode="decimal"
            value={longitude}
            onChange={(event) => {
              setLongitude(event.target.value);
              clearProblem("location");
            }}
          />
        </label>
      </div>
      <p className="text-sm text-muted">{t("business.location_hint")}</p>
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
        <input
          className={box("email")}
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            clearProblem("email");
          }}
        />
      </label>
      <label className="block text-sm text-muted">
        {t("business.website")} <span>({t("business.optional")})</span>
        <input
          className={box("website")}
          value={website}
          placeholder="example.com"
          onChange={(event) => {
            setWebsite(event.target.value);
            clearProblem("website");
          }}
        />
        <span className="mt-2 block text-sm">{t("business.website_hint")}</span>
      </label>
      <label className="block text-sm text-muted">
        {t("business.instagram")} <span>({t("business.optional")})</span>
        <input
          className={box("instagram")}
          value={instagram}
          placeholder="@name"
          onChange={(event) => {
            setInstagram(event.target.value);
            clearProblem("instagram");
          }}
        />
        <span className="mt-2 block text-sm">{t("business.instagram_hint")}</span>
      </label>
      {mode === "admin" || mode === "owner" ? (
        <fieldset>
          <legend className="text-sm text-muted">
            {t("business.photos")} <span>({t("business.optional")})</span>
          </legend>
          {picked.length > 0 ? (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {picked.map((item) => (
                <div key={item.url} className="relative">
                  {/* Local previews are blob URLs, not remote images. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.url} alt="" className="h-28 w-full rounded-2xl object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(item.url);
                      setPicked((current) => current.filter((row) => row.url !== item.url));
                    }}
                    className="absolute end-2 top-2 rounded-full bg-white px-2 py-1 text-xs font-medium text-[#EF4444]"
                  >
                    {t("business.remove_photo")}
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {picked.length < MAX_PHOTOS ? (
            <label className="mt-3 inline-flex h-11 cursor-pointer items-center justify-center rounded-2xl border border-line px-4 text-sm font-medium text-foreground">
              {t("business.add_photos")}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className="sr-only"
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  const accepted = files.filter(
                    (file) => PHOTO_TYPES.has(file.type) && file.size <= MAX_PHOTO_BYTES,
                  );
                  if (accepted.length !== files.length) {
                    setError(t("business.photo_type"));
                  }
                  setPicked((current) => {
                    const room = MAX_PHOTOS - current.length;
                    const next = accepted.slice(0, room).map((file) => ({
                      file,
                      url: URL.createObjectURL(file),
                    }));
                    return [...current, ...next];
                  });
                }}
              />
            </label>
          ) : (
            <p className="mt-3 text-sm text-muted">{t("business.photo_limit")}</p>
          )}
        </fieldset>
      ) : null}
      {problems.length > 0 ? (
        <div ref={problemRef} className="rounded-2xl bg-[#FEF2F2] p-4" role="alert">
          <p className="text-sm font-medium text-[#EF4444]">{t("business.fix_title")}</p>
          <ul className="mt-2 grid gap-1">
            {problems.map((item) => (
              <li key={`${item.id}-${item.day ?? ""}`} className="text-sm text-[#EF4444]">
                {item.id === "hours"
                  ? t("business.fix_hours", { day: t(`business.${item.day ?? "mon"}`) })
                  : t(`business.fix_${item.id}`)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {error ? (
        <p className="text-sm text-[#EF4444]" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 items-center justify-center rounded-2xl bg-brand px-5 text-sm font-medium text-white disabled:bg-[#8DB0AA]"
      >
        {mode === "admin"
          ? t("admin.publish")
          : mode === "edit" || mode === "manage"
            ? t("admin.save")
            : t("business.submit")}
      </button>
    </form>
    <ConfirmModal
      open={confirming}
      title={t("dashboard.submit_title")}
      body={t("dashboard.submit_body")}
      confirmLabel={t("business.submit")}
      cancelLabel={t("dashboard.keep_editing")}
      pending={pending}
      onCancel={() => setConfirming(false)}
      onConfirm={() => {
        setConfirming(false);
        void send();
      }}
    />
    </>
  );
}

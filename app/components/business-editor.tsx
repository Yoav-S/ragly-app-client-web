"use client";

import { useState, type ReactNode } from "react";
import { BusinessPhotos } from "./business-photos";
import { apiPatch } from "@/lib/api";
import { auth } from "@/lib/firebase";
import { errorMessage } from "@/lib/errors";
import {
  CATEGORIES,
  DAYS,
  businessImages,
  type Business,
  type BusinessCategory,
  type BusinessSubmit,
  type GeoLocation,
  type OpeningHours,
  type Weekday,
} from "@/lib/business";
import { useI18n } from "@/lib/i18n";

type Field =
  | "name"
  | "category"
  | "phone"
  | "email"
  | "city"
  | "address"
  | "location"
  | "timezone"
  | "website"
  | "instagram"
  | "description"
  | "hours"
  | "photos";

type DayDraft = { closed: boolean; open: string; close: string };

const inputClass =
  "mt-2 h-11 w-full rounded-2xl border border-line bg-background px-3 text-sm text-foreground outline-none focus:border-brand";

function listingBody(business: Business, location: GeoLocation): BusinessSubmit {
  return {
    name: business.name,
    phone: business.phone,
    email: business.email,
    description: business.description,
    category: business.category,
    city: business.city,
    address: business.address,
    timezone: business.timezone,
    opening_hours: business.opening_hours,
    website: business.website,
    location,
    photo: business.photo,
    instagram: business.instagram,
  };
}

function dayDrafts(business: Business): Record<Weekday, DayDraft> {
  const drafts = {} as Record<Weekday, DayDraft>;
  for (const day of DAYS) {
    const slot = business.opening_hours[day][0];
    drafts[day] = slot
      ? { closed: false, open: slot.open, close: slot.close }
      : { closed: true, open: "09:00", close: "17:00" };
  }
  return drafts;
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function BusinessEditor({
  business,
  scope,
  onChanged,
}: {
  business: Business;
  scope: "admin" | "owner";
  onChanged: (business: Business) => void;
}) {
  const { t } = useI18n();
  const [field, setField] = useState<Field | null>(null);
  const [draft, setDraft] = useState("");
  const [phones, setPhones] = useState<string[]>([""]);
  const [category, setCategory] = useState<BusinessCategory>(business.category);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [days, setDays] = useState<Record<Weekday, DayDraft>>(() => dayDrafts(business));
  const [alwaysOpen, setAlwaysOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  function openField(next: Field) {
    setError("");
    if (field === next) {
      setField(null);
      return;
    }
    setField(next);
    if (next === "phone") setPhones(business.phone.length ? business.phone : [""]);
    if (next === "category") setCategory(business.category);
    if (next === "location") {
      setLatitude(business.location ? String(business.location.coordinates[1]) : "");
      setLongitude(business.location ? String(business.location.coordinates[0]) : "");
    }
    if (next === "hours") {
      setDays(dayDrafts(business));
      setAlwaysOpen(business.opening_hours.always_open);
    }
    if (next === "email") setDraft(business.email ?? "");
    if (next === "website") setDraft(business.website ?? "");
    if (next === "instagram") setDraft(business.instagram ?? "");
    if (next === "description") setDraft(business.description ?? "");
    if (next === "name") setDraft(business.name);
    if (next === "city") setDraft(business.city);
    if (next === "address") setDraft(business.address);
    if (next === "timezone") setDraft(business.timezone);
  }

  async function save(patch: Partial<BusinessSubmit>) {
    const user = auth.currentUser;
    const location = patch.location ?? business.location;
    if (!user || pending || !location) return;
    setPending(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const path =
        scope === "admin" ? `/admin/businesses/${business.id}` : `/businesses/${business.id}`;
      const updated = await apiPatch<Business>(path, token, {
        ...listingBody(business, location),
        ...patch,
      });
      onChanged(updated);
      setField(null);
    } catch (err: unknown) {
      setError(errorMessage(err, t));
    } finally {
      setPending(false);
    }
  }

  function saveText(key: "name" | "city" | "address" | "timezone" | "email" | "website" | "instagram" | "description") {
    const value = draft.trim();
    if ((key === "name" || key === "city" || key === "address" || key === "timezone") && !value) return;
    const optional = key === "email" || key === "website" || key === "instagram" || key === "description";
    void save({ [key]: optional ? value || null : value });
  }

  function saveHours() {
    const hours = { always_open: alwaysOpen } as OpeningHours;
    for (const day of DAYS) {
      const row = days[day];
      hours[day] = alwaysOpen || row.closed ? [] : [{ open: row.open, close: row.close }];
    }
    void save({ opening_hours: hours });
  }

  const images = businessImages(business);

  return (
    <div className="mt-6 grid">
      <h2 className="text-xl font-medium text-foreground">{business.name}</h2>
      <FieldRow
        label={t("business.photos")}
        editing={field === "photos"}
        onEdit={() => openField("photos")}
      >
        {field === "photos" ? (
          <BusinessPhotos business={business} scope={scope} onChanged={onChanged} />
        ) : images.length > 0 ? (
          <div className="mt-2 grid grid-cols-3 gap-2">
            {images.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt="" className="h-20 w-full rounded-xl object-cover" />
            ))}
          </div>
        ) : (
          <p className="mt-1 text-sm text-muted">—</p>
        )}
      </FieldRow>
      <FieldRow label={t("business.name")} editing={field === "name"} onEdit={() => openField("name")}>
        {field === "name" ? (
          <TextDraft value={draft} onChange={setDraft} onSave={() => saveText("name")} pending={pending} />
        ) : (
          <Value text={business.name} />
        )}
      </FieldRow>
      <FieldRow
        label={t("business.category")}
        editing={field === "category"}
        onEdit={() => openField("category")}
      >
        {field === "category" ? (
          <div>
            <select className={inputClass} value={category} onChange={(event) => setCategory(event.target.value as BusinessCategory)}>
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {t(`business.${item}`)}
                </option>
              ))}
            </select>
            <SaveButton pending={pending} onClick={() => void save({ category })} />
          </div>
        ) : (
          <Value text={t(`business.${business.category}`)} />
        )}
      </FieldRow>
      <FieldRow label={t("business.phones")} editing={field === "phone"} onEdit={() => openField("phone")}>
        {field === "phone" ? (
          <div className="grid gap-2">
            {phones.map((phone, index) => (
              <input
                key={index}
                className={inputClass}
                value={phone}
                onChange={(event) =>
                  setPhones(phones.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))
                }
              />
            ))}
            <button
              type="button"
              onClick={() => setPhones([...phones, ""])}
              className="text-start text-sm font-medium text-brand"
            >
              {t("business.add_phone")}
            </button>
            <SaveButton
              pending={pending}
              onClick={() => {
                const next = phones.map((phone) => phone.trim()).filter(Boolean);
                if (next.length === 0) return;
                void save({ phone: next });
              }}
            />
          </div>
        ) : (
          <Value text={business.phone.join("\n")} />
        )}
      </FieldRow>
      <FieldRow label={t("business.email")} editing={field === "email"} onEdit={() => openField("email")}>
        {field === "email" ? (
          <TextDraft value={draft} onChange={setDraft} onSave={() => saveText("email")} pending={pending} type="email" />
        ) : (
          <Value text={business.email} />
        )}
      </FieldRow>
      <FieldRow label={t("business.city")} editing={field === "city"} onEdit={() => openField("city")}>
        {field === "city" ? (
          <TextDraft value={draft} onChange={setDraft} onSave={() => saveText("city")} pending={pending} />
        ) : (
          <Value text={business.city} />
        )}
      </FieldRow>
      <FieldRow label={t("business.address")} editing={field === "address"} onEdit={() => openField("address")}>
        {field === "address" ? (
          <TextDraft value={draft} onChange={setDraft} onSave={() => saveText("address")} pending={pending} />
        ) : (
          <Value text={business.address} />
        )}
      </FieldRow>
      <FieldRow
        label={t("admin.review_location")}
        editing={field === "location"}
        onEdit={() => openField("location")}
      >
        {field === "location" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <input className={inputClass} inputMode="decimal" value={latitude} onChange={(event) => setLatitude(event.target.value)} />
            <input className={inputClass} inputMode="decimal" value={longitude} onChange={(event) => setLongitude(event.target.value)} />
            <SaveButton
              pending={pending}
              onClick={() => {
                const lat = Number(latitude);
                const lng = Number(longitude);
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
                void save({ location: { type: "Point", coordinates: [lng, lat] } });
              }}
            />
          </div>
        ) : (
          <Value
            text={
              business.location
                ? `${business.location.coordinates[1]}, ${business.location.coordinates[0]}`
                : null
            }
          />
        )}
      </FieldRow>
      <FieldRow label={t("business.timezone")} editing={field === "timezone"} onEdit={() => openField("timezone")}>
        {field === "timezone" ? (
          <TextDraft value={draft} onChange={setDraft} onSave={() => saveText("timezone")} pending={pending} />
        ) : (
          <Value text={business.timezone} />
        )}
      </FieldRow>
      <FieldRow label={t("business.website")} editing={field === "website"} onEdit={() => openField("website")}>
        {field === "website" ? (
          <TextDraft value={draft} onChange={setDraft} onSave={() => saveText("website")} pending={pending} />
        ) : (
          <Value text={business.website} />
        )}
      </FieldRow>
      <FieldRow
        label={t("business.instagram")}
        editing={field === "instagram"}
        onEdit={() => openField("instagram")}
      >
        {field === "instagram" ? (
          <TextDraft value={draft} onChange={setDraft} onSave={() => saveText("instagram")} pending={pending} />
        ) : (
          <Value text={business.instagram} />
        )}
      </FieldRow>
      <FieldRow
        label={t("business.description")}
        editing={field === "description"}
        onEdit={() => openField("description")}
      >
        {field === "description" ? (
          <div>
            <textarea
              className="mt-2 min-h-24 w-full rounded-2xl border border-line bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <SaveButton pending={pending} onClick={() => saveText("description")} />
          </div>
        ) : (
          <Value text={business.description} />
        )}
      </FieldRow>
      <FieldRow label={t("business.hours")} editing={field === "hours"} onEdit={() => openField("hours")}>
        {field === "hours" ? (
          <div className="grid gap-2">
            <label className="mt-2 flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={alwaysOpen}
                onChange={(event) => setAlwaysOpen(event.target.checked)}
              />
              {t("business.always_open")}
            </label>
            {alwaysOpen
              ? null
              : DAYS.map((day) => (
                  <div key={day} className="grid grid-cols-[6rem_1fr_1fr] items-center gap-2">
                    <label className="flex items-center gap-2 text-sm text-muted">
                      <input
                        type="checkbox"
                        checked={days[day].closed}
                        onChange={(event) =>
                          setDays({ ...days, [day]: { ...days[day], closed: event.target.checked } })
                        }
                      />
                      {t(`business.${day}`)}
                    </label>
                    <input
                      type="time"
                      disabled={days[day].closed}
                      className={inputClass}
                      value={days[day].open}
                      onChange={(event) =>
                        setDays({ ...days, [day]: { ...days[day], open: event.target.value } })
                      }
                    />
                    <input
                      type="time"
                      disabled={days[day].closed}
                      className={inputClass}
                      value={days[day].close}
                      onChange={(event) =>
                        setDays({ ...days, [day]: { ...days[day], close: event.target.value } })
                      }
                    />
                  </div>
                ))}
            <SaveButton pending={pending} onClick={saveHours} />
          </div>
        ) : business.opening_hours.always_open ? (
          <Value text={t("business.always_open")} />
        ) : (
          <ul className="mt-2 grid gap-1">
            {DAYS.map((day) => {
              const slots = business.opening_hours[day];
              return (
                <li key={day} className="flex justify-between gap-4 text-sm">
                  <span className="text-muted">{t(`business.${day}`)}</span>
                  <span className="text-foreground">
                    {slots.length ? slots.map((slot) => `${slot.open}–${slot.close}`).join(", ") : t("business.closed")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </FieldRow>
      {error ? (
        <p className="mt-3 text-sm text-[#EF4444]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function FieldRow({
  label,
  editing,
  onEdit,
  children,
}: {
  label: string;
  editing: boolean;
  onEdit: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="border-t border-line py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">{label}</p>
          {children}
        </div>
        <button
          type="button"
          onClick={onEdit}
          aria-label={t("admin.update")}
          className={
            editing
              ? "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-white"
              : "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-foreground"
          }
        >
          <PencilIcon />
        </button>
      </div>
    </div>
  );
}

function Value({ text }: { text: string | null }) {
  return <p className="mt-1 whitespace-pre-line text-sm text-foreground">{text || "—"}</p>;
}

function TextDraft({
  value,
  onChange,
  onSave,
  pending,
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  pending: boolean;
  type?: string;
}) {
  return (
    <div>
      <input className={inputClass} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
      <SaveButton pending={pending} onClick={onSave} />
    </div>
  );
}

function SaveButton({ pending, onClick }: { pending: boolean; onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      className="mt-3 inline-flex h-10 items-center justify-center rounded-2xl bg-brand px-4 text-sm font-medium text-white disabled:bg-[#8DB0AA]"
    >
      {t("admin.save")}
    </button>
  );
}

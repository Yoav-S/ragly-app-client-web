"use client";

import { useState } from "react";
import { Toggle, inputClass } from "./form-controls";
import { DAYS, type OpeningHours, type SpecialDate, type TimeSlot, type Weekday } from "@/lib/business";
import { useI18n } from "@/lib/i18n";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function minutesOf(value: string): number | null {
  if (value === "24:00") return 24 * 60;
  if (!TIME.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

type Translate = (key: string, vars?: Record<string, string | number>) => string;

function slotsError(slots: TimeSlot[], t: Translate, where: string): string | null {
  const sorted = [...slots].sort((a, b) => a.open.localeCompare(b.open));
  for (const slot of sorted) {
    const start = minutesOf(slot.open);
    const end = minutesOf(slot.close);
    if (start == null || end == null || start >= 24 * 60) return t("hours.fix_time", { day: where });
    if (end <= start) return t("hours.fix_order", { day: where });
  }
  for (let i = 1; i < sorted.length; i += 1) {
    const previousEnd = minutesOf(sorted[i - 1].close) ?? 0;
    const start = minutesOf(sorted[i].open) ?? 0;
    if (start < previousEnd) return t("hours.fix_overlap", { day: where });
  }
  return null;
}

/** The first problem in these hours, in the user's words. Null when fine. */
export function hoursError(hours: OpeningHours, t: Translate): string | null {
  if (!hours.provided || hours.always_open) return null;
  for (const day of DAYS) {
    const problem = slotsError(hours[day], t, t(`business.${day}`));
    if (problem) return problem;
  }
  const seen = new Set<string>();
  for (const item of hours.special_dates ?? []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return t("hours.fix_date");
    if (seen.has(item.date)) return t("hours.fix_date_twice");
    seen.add(item.date);
    if (!item.closed) {
      if (!item.slots.length) return t("hours.fix_date_slots");
      const problem = slotsError(item.slots, t, item.date);
      if (problem) return problem;
    }
  }
  if (!DAYS.some((day) => hours[day].length)) return t("hours.fix_empty");
  return null;
}

/** 09:00–18:00 on weekdays as a starting point for a new service. */
function seedWeek(hours: OpeningHours): OpeningHours {
  const next = { ...hours, provided: true, always_open: false };
  if (!DAYS.some((day) => hours[day].length)) {
    for (const day of ["mon", "tue", "wed", "thu", "fri"] as const) {
      next[day] = [{ open: "09:00", close: "18:00" }];
    }
  }
  return next;
}

export function HoursSummary({ hours }: { hours: OpeningHours }) {
  const { t } = useI18n();
  if (!hours.provided) return <span className="text-muted">{t("business.hours_unlisted")}</span>;
  if (hours.always_open) return <span>{t("business.always_open")}</span>;
  return (
    <ul className="grid w-fit max-w-full grid-cols-[auto_auto] items-baseline gap-x-8 gap-y-1">
      {DAYS.map((day) => (
        <li key={day} className="contents">
          <span className="text-muted">{t(`business.${day}`)}</span>
          <span className="tabular-nums">
            {hours[day].length ? hours[day].map((slot) => `${slot.open}–${slot.close}`).join(", ") : t("business.closed")}
          </span>
        </li>
      ))}
      {(hours.special_dates ?? []).map((item) => (
        <li key={item.date} className="contents">
          <span className="text-muted">{item.date}</span>
          <span className="tabular-nums">
            {item.closed ? t("business.closed") : item.slots.map((slot) => `${slot.open}–${slot.close}`).join(", ")}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function HoursEditor({
  hours,
  onChange,
  copyOptions,
  onCopyFrom,
}: {
  hours: OpeningHours;
  onChange: (hours: OpeningHours) => void;
  /** Other services whose hours can be copied here. */
  copyOptions?: { id: string; label: string }[];
  onCopyFrom?: (id: string) => void;
}) {
  const { t } = useI18n();
  const [newDate, setNewDate] = useState("");
  const special = hours.special_dates ?? [];

  function setDay(day: Weekday, slots: TimeSlot[]) {
    onChange({ ...hours, [day]: slots });
  }

  function setSpecial(next: SpecialDate[]) {
    onChange({ ...hours, special_dates: next });
  }

  function addSpecial() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate) || special.some((item) => item.date === newDate)) return;
    setSpecial([...special, { date: newDate, closed: true, slots: [] }].sort((a, b) => a.date.localeCompare(b.date)));
    setNewDate("");
  }

  return (
    <div className="grid gap-3">
      <Toggle
        checked={hours.provided}
        onChange={(provided) => onChange(provided ? seedWeek(hours) : { ...hours, provided: false, always_open: false })}
        label={t("hours.have_hours")}
        hint={t("hours.have_hours_hint")}
      />
      {hours.provided ? (
        <Toggle
          checked={hours.always_open}
          onChange={(always) => onChange({ ...hours, always_open: always })}
          label={t("business.always_open")}
          hint={t("hours.always_open_hint")}
        />
      ) : null}
      {hours.provided && !hours.always_open ? (
        <div className="grid gap-2 rounded-2xl border border-line bg-background p-3">
          {copyOptions && copyOptions.length > 0 && onCopyFrom ? (
            <label className="block text-xs text-muted">
              {t("hours.copy_from")}
              <select
                className={`${inputClass} mt-1 bg-surface`}
                defaultValue=""
                onChange={(event) => {
                  if (event.target.value) onCopyFrom(event.target.value);
                  event.target.value = "";
                }}
              >
                <option value="">{t("hours.copy_pick")}</option>
                {copyOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {DAYS.map((day) => (
            <DayRow
              key={day}
              label={t(`business.${day}`)}
              slots={hours[day]}
              onChange={(slots) => setDay(day, slots)}
              onCopyToAll={() => {
                const next = { ...hours };
                for (const other of DAYS) next[other] = hours[day].map((slot) => ({ ...slot }));
                onChange(next);
              }}
            />
          ))}
          <div className="mt-2 border-t border-line pt-3">
            <p className="text-sm font-medium text-foreground">{t("hours.special_title")}</p>
            <p className="mt-0.5 text-xs text-muted">{t("hours.special_hint")}</p>
            <ul className="mt-2 grid gap-2">
              {special.map((item) => (
                <li key={item.date} className="rounded-xl bg-surface p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{item.date}</span>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs text-muted">
                        <input
                          type="checkbox"
                          checked={item.closed}
                          onChange={(event) =>
                            setSpecial(
                              special.map((row) =>
                                row.date === item.date
                                  ? {
                                      ...row,
                                      closed: event.target.checked,
                                      slots: event.target.checked ? [] : row.slots.length ? row.slots : [{ open: "09:00", close: "13:00" }],
                                    }
                                  : row,
                              ),
                            )
                          }
                        />
                        {t("business.closed")}
                      </label>
                      <button
                        type="button"
                        onClick={() => setSpecial(special.filter((row) => row.date !== item.date))}
                        className="text-xs font-medium text-[#EF4444]"
                      >
                        {t("hours.remove_date")}
                      </button>
                    </div>
                  </div>
                  {!item.closed ? (
                    <div className="mt-2">
                      <SlotList
                        slots={item.slots}
                        onChange={(slots) => setSpecial(special.map((row) => (row.date === item.date ? { ...row, slots } : row)))}
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <input
                type="date"
                value={newDate}
                onChange={(event) => setNewDate(event.target.value)}
                className={`${inputClass} mt-0 bg-surface`}
              />
              <button
                type="button"
                onClick={addSpecial}
                disabled={!newDate}
                className="inline-flex h-11 shrink-0 items-center justify-center rounded-2xl border border-line bg-surface px-4 text-sm font-medium text-foreground disabled:text-muted"
              >
                {t("hours.add_date")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DayRow({
  label,
  slots,
  onChange,
  onCopyToAll,
}: {
  label: string;
  slots: TimeSlot[];
  onChange: (slots: TimeSlot[]) => void;
  onCopyToAll: () => void;
}) {
  const { t } = useI18n();
  const open = slots.length > 0;
  return (
    <div className="rounded-xl bg-surface p-3">
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={open}
            onChange={(event) => onChange(event.target.checked ? [{ open: "09:00", close: "18:00" }] : [])}
          />
          {label}
        </label>
        {open ? (
          <button type="button" onClick={onCopyToAll} className="text-xs font-medium text-brand">
            {t("hours.copy_to_all")}
          </button>
        ) : (
          <span className="text-xs text-muted">{t("business.closed")}</span>
        )}
      </div>
      {open ? (
        <div className="mt-2">
          <SlotList slots={slots} onChange={onChange} />
        </div>
      ) : null}
    </div>
  );
}

function SlotList({ slots, onChange }: { slots: TimeSlot[]; onChange: (slots: TimeSlot[]) => void }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-2">
      {slots.map((slot, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            type="time"
            value={slot.open}
            onChange={(event) => onChange(slots.map((item, i) => (i === index ? { ...item, open: event.target.value } : item)))}
            className={`${inputClass} mt-0`}
          />
          <span className="text-muted">–</span>
          <input
            type="time"
            value={slot.close === "24:00" ? "23:59" : slot.close}
            onChange={(event) =>
              onChange(slots.map((item, i) => (i === index ? { ...item, close: event.target.value === "23:59" ? "24:00" : event.target.value } : item)))
            }
            className={`${inputClass} mt-0`}
          />
          {slots.length > 1 ? (
            <button
              type="button"
              aria-label={t("hours.remove_break")}
              onClick={() => onChange(slots.filter((_, i) => i !== index))}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-line text-muted hover:text-[#EF4444]"
            >
              ×
            </button>
          ) : null}
        </div>
      ))}
      {slots.length < 3 ? (
        <button
          type="button"
          onClick={() => {
            const last = slots[slots.length - 1];
            const start = last ? Math.min((minutesOf(last.close) ?? 0) + 60, 23 * 60) : 14 * 60;
            const end = Math.min(start + 4 * 60, 24 * 60 - 1);
            const clock = (total: number) => `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
            onChange([...slots, { open: clock(start), close: clock(end) }]);
          }}
          className="text-start text-xs font-medium text-brand"
        >
          + {t("hours.add_break")}
        </button>
      ) : null}
    </div>
  );
}

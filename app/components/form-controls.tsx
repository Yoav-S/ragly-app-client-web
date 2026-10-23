"use client";

import type { ReactNode } from "react";

export const inputClass =
  "mt-2 h-11 w-full rounded-2xl border border-line bg-background px-4 text-sm text-foreground outline-none transition-colors focus:border-brand disabled:text-muted";

export const textareaClass =
  "mt-2 min-h-28 w-full rounded-2xl border border-line bg-background px-4 py-3 text-sm leading-6 text-foreground outline-none transition-colors focus:border-brand";

export const primaryButton =
  "inline-flex h-11 items-center justify-center rounded-2xl bg-brand px-5 text-sm font-medium text-white transition-colors hover:bg-[#003a35] disabled:cursor-not-allowed disabled:bg-[#8DB0AA]";

export const secondaryButton =
  "inline-flex h-11 items-center justify-center rounded-2xl border border-line bg-surface px-5 text-sm font-medium text-foreground transition-colors hover:border-brand disabled:cursor-not-allowed disabled:text-muted";

export const dangerButton =
  "inline-flex h-11 items-center justify-center rounded-2xl border border-line bg-surface px-5 text-sm font-medium text-[#EF4444] transition-colors hover:border-[#EF4444] disabled:cursor-not-allowed disabled:text-muted";

export function Field({
  label,
  hint,
  error,
  note,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  /** A note the admin left on this field. */
  note?: string | null;
  optional?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {optional ? <span className="text-xs text-muted">{optional}</span> : null}
      </span>
      {children}
      {note ? (
        <span className="mt-2 block rounded-xl bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]">{note}</span>
      ) : null}
      {error ? (
        <span className="mt-2 block text-sm text-[#EF4444]" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="mt-2 block text-xs leading-5 text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-surface p-5 sm:p-6 ${className}`}>{children}</section>;
}

export function SectionTitle({ title, body }: { title: string; body?: string }) {
  return (
    <div>
      <h2 className="text-lg font-medium text-foreground">{title}</h2>
      {body ? <p className="mt-1 text-sm leading-6 text-muted">{body}</p> : null}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-line bg-background px-4 py-3 text-start"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-muted">{hint}</span> : null}
      </span>
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-brand" : "bg-[#D1D5DB]"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5.5" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

export function PhoneList({
  phones,
  onChange,
  addLabel,
  removeLabel,
  placeholder,
}: {
  phones: string[];
  onChange: (phones: string[]) => void;
  addLabel: string;
  removeLabel: string;
  placeholder?: string;
}) {
  const rows = phones.length ? phones : [""];
  return (
    <div className="grid gap-2">
      {rows.map((phone, index) => (
        <div key={index} className="flex gap-2">
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            placeholder={placeholder}
            onChange={(event) => onChange(rows.map((item, i) => (i === index ? event.target.value : item)))}
            className={`${inputClass} mt-0`}
          />
          {rows.length > 1 ? (
            <button
              type="button"
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
              aria-label={removeLabel}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-line text-muted hover:text-[#EF4444]"
            >
              ×
            </button>
          ) : null}
        </div>
      ))}
      <button type="button" onClick={() => onChange([...rows, ""])} className="text-start text-sm font-medium text-brand">
        + {addLabel}
      </button>
    </div>
  );
}

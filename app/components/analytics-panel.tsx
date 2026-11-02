"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, inputClass } from "./form-controls";
import { apiGet } from "@/lib/api";
import type { AnalyticsDirectoryItem, Branch, BranchAnalytics } from "@/lib/business";
import { auth } from "@/lib/firebase";
import { useI18n } from "@/lib/i18n";

type BranchChoice = { id: string; address: string; city: string };

function branchLabel(branch: BranchChoice): string {
  const line = [branch.address, branch.city].filter(Boolean).join(", ");
  return line || branch.id;
}

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

function hourRange(hour: number): string {
  return `${hourLabel(hour)}–${hourLabel((hour + 1) % 24)}`;
}

function formatDay(date: string, locale: string): string {
  const parts = date.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return date;
  const [year, month, day] = parts;
  return new Date(year, month - 1, day).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
}

export function AnalyticsPanel({
  businessId,
  branches,
}: {
  businessId: string;
  branches: BranchChoice[];
}) {
  const { t, locale } = useI18n();
  const [locationId, setLocationId] = useState(branches[0]?.id ?? "");
  const [days, setDays] = useState<7 | 30>(30);
  const [data, setData] = useState<BranchAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!branches.some((branch) => branch.id === locationId)) {
      setLocationId(branches[0]?.id ?? "");
    }
  }, [branches, locationId]);

  useEffect(() => {
    if (!businessId || !locationId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    void (async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const row = await apiGet<BranchAnalytics>(
          `/businesses/${businessId}/analytics?location_id=${encodeURIComponent(locationId)}&days=${days}`,
          await user.getIdToken(),
        );
        if (!cancelled) setData(row);
      } catch {
        if (!cancelled) {
          setData(null);
          setError(t("dashboard.analytics_error"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId, locationId, days, t]);

  if (!branches.length) {
    return (
      <Card className="mt-6">
        <p className="text-sm leading-6 text-muted">{t("dashboard.analytics_no_branches")}</p>
      </Card>
    );
  }

  return (
    <section className="mt-6 grid gap-4">
      <Card>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="block">
            <span className="text-sm font-medium text-foreground">{t("dashboard.analytics_branch")}</span>
            <select
              value={locationId}
              onChange={(event) => setLocationId(event.target.value)}
              className={inputClass}
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branchLabel(branch)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex h-11 rounded-2xl border border-line p-1">
            {([7, 30] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDays(value)}
                className={`h-full min-w-16 rounded-xl px-3 text-sm font-medium ${
                  days === value ? "bg-brand text-white" : "text-muted hover:text-foreground"
                }`}
              >
                {t(`dashboard.analytics_range_${value}`)}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted">{t("dashboard.analytics_privacy")}</p>
      </Card>

      {error ? (
        <p className="text-sm text-[#EF4444]" role="alert">
          {error}
        </p>
      ) : null}

      {loading && !data ? (
        <p className="text-sm text-muted">{t("loading")}</p>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label={t("dashboard.analytics_views")} value={data.totals.views} locale={locale} />
            <Stat label={t("dashboard.analytics_visitors")} value={data.totals.unique_visitors} locale={locale} />
            <Stat label={t("dashboard.analytics_calls")} value={data.totals.calls} locale={locale} />
            <Stat label={t("dashboard.analytics_directions")} value={data.totals.directions} locale={locale} />
          </div>

          <Card>
            <h3 className="text-sm font-medium text-foreground">{t("dashboard.analytics_busy")}</h3>
            {data.busy_hours.length ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {data.busy_hours.map((slot) => (
                  <li
                    key={slot.hour}
                    className="rounded-full bg-[#EEF3F2] px-3 py-1.5 text-sm text-foreground"
                  >
                    {hourRange(slot.hour)}
                    <span className="ms-2 text-muted">
                      {slot.views.toLocaleString(locale)} · {Math.round(slot.share * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">{t("dashboard.analytics_busy_empty")}</p>
            )}
          </Card>

          <Card>
            <h3 className="text-sm font-medium text-foreground">{t("dashboard.analytics_by_day")}</h3>
            <BarRow
              items={data.by_day.map((row) => ({
                key: row.date,
                label: formatDay(row.date, locale),
                value: row.views,
              }))}
              empty={t("dashboard.analytics_empty")}
            />
          </Card>

          <Card>
            <h3 className="text-sm font-medium text-foreground">{t("dashboard.analytics_by_hour")}</h3>
            <BarRow
              items={data.by_hour.map((row) => ({
                key: String(row.hour),
                label: hourLabel(row.hour),
                value: row.views,
                highlight: data.busy_hours.some((slot) => slot.hour === row.hour),
              }))}
              dense
              empty={t("dashboard.analytics_empty")}
            />
          </Card>
        </>
      ) : null}
    </section>
  );
}

export function AdminAnalytics() {
  const { t } = useI18n();
  const [directory, setDirectory] = useState<AnalyticsDirectoryItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const rows = await apiGet<AnalyticsDirectoryItem[]>(
          "/admin/analytics/directory",
          await user.getIdToken(),
        );
        if (cancelled) return;
        setDirectory(rows);
        setBusinessId((current) => current || rows[0]?.id || "");
      } catch {
        if (!cancelled) setError(t("dashboard.analytics_error"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const filtered = useMemo(() => {
    const rows = directory ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => row.name.toLowerCase().includes(needle));
  }, [directory, query]);

  const selected = directory?.find((row) => row.id === businessId) ?? null;

  useEffect(() => {
    if (selected || !filtered.length) return;
    setBusinessId(filtered[0].id);
  }, [filtered, selected]);

  return (
    <section>
      <h1 className="text-2xl font-medium leading-none text-foreground sm:text-[32px]">
        {t("admin.tab_analytics")}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{t("admin.analytics_body")}</p>
      {error ? (
        <p className="mt-6 text-sm text-[#EF4444]" role="alert">
          {error}
        </p>
      ) : null}
      {directory === null && !error ? (
        <p className="mt-8 text-sm text-muted">{t("loading")}</p>
      ) : directory?.length ? (
        <>
          <Card className="mt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-foreground">{t("admin.analytics_search")}</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className={inputClass}
                  placeholder={t("admin.analytics_search_hint")}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-foreground">{t("admin.analytics_business")}</span>
                <select
                  value={businessId}
                  onChange={(event) => setBusinessId(event.target.value)}
                  className={inputClass}
                >
                  {filtered.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </Card>
          {selected ? (
            <AnalyticsPanel businessId={selected.id} branches={selected.locations} />
          ) : (
            <p className="mt-6 text-sm text-muted">{t("admin.analytics_none")}</p>
          )}
        </>
      ) : (
        <p className="mt-8 rounded-3xl border border-line bg-surface px-6 py-20 text-center text-sm text-muted">
          {t("admin.analytics_empty")}
        </p>
      )}
    </section>
  );
}

function Stat({ label, value, locale }: { label: string; value: number; locale: string }) {
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-3xl font-medium leading-none text-foreground">{value.toLocaleString(locale)}</p>
    </Card>
  );
}

function BarRow({
  items,
  empty,
  dense,
}: {
  items: { key: string; label: string; value: number; highlight?: boolean }[];
  empty: string;
  dense?: boolean;
}) {
  const max = Math.max(0, ...items.map((item) => item.value));
  if (!max) {
    return <p className="mt-3 text-sm text-muted">{empty}</p>;
  }
  return (
    <div className={`mt-4 flex items-end gap-1 ${dense ? "h-28" : "h-36"}`}>
      {items.map((item) => {
        const height = Math.max(item.value > 0 ? 6 : 2, Math.round((item.value / max) * 100));
        return (
          <div key={item.key} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <div
              title={`${item.label}: ${item.value}`}
              className={`w-full max-w-6 rounded-t-md ${item.highlight ? "bg-brand" : "bg-[#B7D4CE]"}`}
              style={{ height: `${height}%` }}
            />
            {!dense || item.key === "0" || Number(item.key) % 3 === 0 ? (
              <span className="max-w-full truncate text-[10px] text-muted">{item.label}</span>
            ) : (
              <span className="h-3" />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function analyticsBranches(branches: Branch[]): BranchChoice[] {
  return branches.map((branch) => ({
    id: branch.id,
    address: branch.address,
    city: branch.city,
  }));
}

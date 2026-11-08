"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, inputClass } from "./form-controls";
import { apiGet } from "@/lib/api";
import type {
  AnalyticsDirectoryItem,
  AnalyticsSlice,
  Branch,
  ListingAnalytics,
} from "@/lib/business";
import { auth } from "@/lib/firebase";
import { useI18n } from "@/lib/i18n";

type BranchChoice = { id: string; address: string; city: string };
type RangeDays = 7 | 30;

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

function RangeToggle({
  days,
  onDays,
}: {
  days: RangeDays;
  onDays: (value: RangeDays) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex h-11 rounded-2xl border border-line p-1">
      {([7, 30] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onDays(value)}
          className={`h-full min-w-16 rounded-xl px-3 text-sm font-medium ${
            days === value ? "bg-brand text-white" : "text-muted hover:text-foreground"
          }`}
        >
          {t(`dashboard.analytics_range_${value}`)}
        </button>
      ))}
    </div>
  );
}

export function AnalyticsPanel({
  businessId,
  branches,
  days: daysProp,
  onDays,
}: {
  businessId: string;
  branches: BranchChoice[];
  days?: RangeDays;
  onDays?: (value: RangeDays) => void;
}) {
  const { t, locale } = useI18n();
  const many = branches.length > 1;
  const [locationId, setLocationId] = useState(many ? "" : (branches[0]?.id ?? ""));
  const [innerDays, setInnerDays] = useState<RangeDays>(30);
  const days = daysProp ?? innerDays;
  const setDays = onDays ?? setInnerDays;
  const [data, setData] = useState<ListingAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!locationId) return;
    if (!branches.some((branch) => branch.id === locationId)) {
      setLocationId(many ? "" : (branches[0]?.id ?? ""));
    }
  }, [branches, locationId, many]);

  useEffect(() => {
    if (!businessId || (!locationId && !branches.length)) {
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
        const query = new URLSearchParams({ days: String(days) });
        if (locationId) query.set("location_id", locationId);
        const row = await apiGet<ListingAnalytics>(
          `/businesses/${businessId}/analytics?${query.toString()}`,
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
  }, [businessId, locationId, days, branches.length, t]);

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
              {many ? (
                <option value="">{t("dashboard.analytics_all_branches")}</option>
              ) : null}
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branchLabel(branch)}
                </option>
              ))}
            </select>
          </label>
          {onDays ? null : <RangeToggle days={days} onDays={setDays} />}
        </div>
        <p className="mt-3 text-xs leading-5 text-muted">{t("dashboard.analytics_privacy")}</p>
      </Card>

      <AnalyticsReport
        data={data}
        loading={loading}
        error={error}
        locale={locale}
        onSelectBranch={many ? setLocationId : undefined}
      />
    </section>
  );
}

export function AdminAnalytics() {
  const { t, locale } = useI18n();
  const [directory, setDirectory] = useState<AnalyticsDirectoryItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [days, setDays] = useState<RangeDays>(30);
  const [overview, setOverview] = useState<ListingAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
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
        if (!cancelled) setDirectory(rows);
      } catch {
        if (!cancelled) setError(t("dashboard.analytics_error"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const row = await apiGet<ListingAnalytics>(
          `/admin/analytics/overview?days=${days}`,
          await user.getIdToken(),
        );
        if (!cancelled) {
          setOverview(row);
          setError("");
        }
      } catch {
        if (!cancelled) {
          setOverview(null);
          setError(t("dashboard.analytics_error"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [days, t]);

  const filtered = useMemo(() => {
    const rows = directory ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => row.name.toLowerCase().includes(needle));
  }, [directory, query]);

  const selected = directory?.find((row) => row.id === businessId) ?? null;

  useEffect(() => {
    if (!businessId) return;
    if (selected) return;
    setBusinessId("");
  }, [businessId, selected]);

  return (
    <section>
      <h1 className="text-2xl font-medium leading-none text-foreground sm:text-[32px]">
        {t("admin.tab_analytics")}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{t("admin.analytics_body")}</p>
      {directory === null && !error ? (
        <p className="mt-8 text-sm text-muted">{t("loading")}</p>
      ) : directory?.length ? (
        <>
          <Card className="mt-6">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
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
                  <option value="">{t("admin.analytics_all")}</option>
                  {filtered.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
              <RangeToggle days={days} onDays={setDays} />
            </div>
          </Card>

          {selected ? (
            <AnalyticsPanel
              businessId={selected.id}
              branches={selected.locations}
              days={days}
              onDays={setDays}
            />
          ) : (
            <div className="mt-6 grid gap-4">
              <AnalyticsReport
                data={overview}
                loading={loading}
                error={error}
                locale={locale}
                onSelectBusiness={setBusinessId}
                businessesTitle={t("admin.analytics_by_business")}
              />
            </div>
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

function AnalyticsReport({
  data,
  loading,
  error,
  locale,
  onSelectBranch,
  onSelectBusiness,
  businessesTitle,
}: {
  data: ListingAnalytics | null;
  loading: boolean;
  error: string;
  locale: string;
  onSelectBranch?: (id: string) => void;
  onSelectBusiness?: (id: string) => void;
  businessesTitle?: string;
}) {
  const { t } = useI18n();
  if (error) {
    return (
      <p className="text-sm text-[#EF4444]" role="alert">
        {error}
      </p>
    );
  }
  if (loading && !data) {
    return <p className="text-sm text-muted">{t("loading")}</p>;
  }
  if (!data) return null;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("dashboard.analytics_impressions")} value={data.totals.impressions} locale={locale} />
        <Stat label={t("dashboard.analytics_views")} value={data.totals.views} locale={locale} />
        <Stat label={t("dashboard.analytics_visitors")} value={data.totals.unique_visitors} locale={locale} />
        <Stat label={t("dashboard.analytics_calls")} value={data.totals.calls} locale={locale} />
        <Stat label={t("dashboard.analytics_directions")} value={data.totals.directions} locale={locale} />
        <Stat label={t("dashboard.analytics_website")} value={data.totals.website} locale={locale} />
        <Stat label={t("dashboard.analytics_instagram")} value={data.totals.instagram} locale={locale} />
      </div>

      {data.businesses.length ? (
        <SliceTable
          title={businessesTitle ?? t("admin.analytics_by_business")}
          column={t("admin.analytics_business")}
          rows={data.businesses}
          locale={locale}
          onSelect={onSelectBusiness}
        />
      ) : null}

      {data.branches.length > 1 || (data.scope === "business" && data.branches.length > 0) ? (
        <SliceTable
          title={t("dashboard.analytics_by_branch")}
          column={t("dashboard.analytics_branch")}
          rows={data.branches}
          locale={locale}
          onSelect={onSelectBranch}
        />
      ) : null}

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
  );
}

function SliceTable({
  title,
  column,
  rows,
  locale,
  onSelect,
}: {
  title: string;
  column: string;
  rows: AnalyticsSlice[];
  locale: string;
  onSelect?: (id: string) => void;
}) {
  const { t } = useI18n();
  return (
    <Card>
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[44rem] text-start text-sm">
          <thead>
            <tr className="text-muted">
              <th className="pb-2 pe-3 font-medium">{column}</th>
              <th className="pb-2 pe-3 text-end font-medium">{t("dashboard.analytics_impressions")}</th>
              <th className="pb-2 pe-3 text-end font-medium">{t("dashboard.analytics_views")}</th>
              <th className="pb-2 pe-3 text-end font-medium">{t("dashboard.analytics_visitors")}</th>
              <th className="pb-2 pe-3 text-end font-medium">{t("dashboard.analytics_calls")}</th>
              <th className="pb-2 pe-3 text-end font-medium">{t("dashboard.analytics_directions")}</th>
              <th className="pb-2 pe-3 text-end font-medium">{t("dashboard.analytics_website")}</th>
              <th className="pb-2 text-end font-medium">{t("dashboard.analytics_instagram")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="py-2 pe-3">
                  {onSelect ? (
                    <button
                      type="button"
                      onClick={() => onSelect(row.id)}
                      className="text-start font-medium text-foreground hover:text-brand"
                    >
                      {row.name}
                    </button>
                  ) : (
                    <span className="font-medium text-foreground">{row.name}</span>
                  )}
                </td>
                <MetricCell value={row.totals.impressions} locale={locale} />
                <MetricCell value={row.totals.views} locale={locale} />
                <MetricCell value={row.totals.unique_visitors} locale={locale} />
                <MetricCell value={row.totals.calls} locale={locale} />
                <MetricCell value={row.totals.directions} locale={locale} />
                <MetricCell value={row.totals.website} locale={locale} />
                <MetricCell value={row.totals.instagram} locale={locale} last />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function MetricCell({
  value,
  locale,
  last,
}: {
  value: number;
  locale: string;
  last?: boolean;
}) {
  return (
    <td className={`py-2 text-end tabular-nums text-foreground ${last ? "" : "pe-3"}`}>
      {value.toLocaleString(locale)}
    </td>
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

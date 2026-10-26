"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminCreateForm } from "../components/admin-create-form";
import { AdminShell, useAdminSession, type AdminTab } from "../components/admin-shell";
import { BusinessDirectory } from "../components/business-directory";
import { apiGet } from "@/lib/api";
import type { Business, BusinessCounts } from "@/lib/business";
import { signedInThisTab } from "@/lib/auth";
import { auth } from "@/lib/firebase";
import { useI18n } from "@/lib/i18n";

const EMPTY_COUNTS: BusinessCounts = { total: 0, pending: 0, published: 0, rejected: 0, deleted: 0 };

function isTab(value: string | null): value is AdminTab {
  return value === "overview" || value === "businesses" || value === "users" || value === "analytics";
}

export default function AdminPage() {
  return (
    <Suspense fallback={<main className="min-h-full bg-[#F7F8FA]" />}>
      <Admin />
    </Suspense>
  );
}

function Admin() {
  const router = useRouter();
  const search = useSearchParams();
  const { t } = useI18n();
  const { ready, error } = useAdminSession();
  const [counts, setCounts] = useState<BusinessCounts>(EMPTY_COUNTS);
  const [directoryStatus, setDirectoryStatus] = useState<Business["status"] | "all">("all");
  const [directoryVersion, setDirectoryVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const requestedTab = search.get("tab");
  const tab: AdminTab = isTab(requestedTab) ? requestedTab : "businesses";

  const refreshCounts = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;
    setCounts(await apiGet<BusinessCounts>("/admin/businesses/summary", await user.getIdToken()));
  }, []);

  useEffect(() => {
    if (ready) void refreshCounts();
  }, [ready, refreshCounts]);

  if (!ready || !signedInThisTab()) {
    return (
      <main className="min-h-full bg-[#F7F8FA] px-4 py-10">
        {error ? (
          <p className="text-sm text-[#EF4444]" role="alert">
            {error}
          </p>
        ) : null}
      </main>
    );
  }

  function go(next: AdminTab) {
    setCreating(false);
    setNotice("");
    router.replace(next === "businesses" ? "/admin" : `/admin?tab=${next}`);
  }

  function reloadBoard() {
    setNotice("");
    setDirectoryVersion((version) => version + 1);
    void refreshCounts();
  }

  return (
    <AdminShell tab={tab} onTab={go} search={tab === "businesses" && !creating ? { value: query, onChange: setQuery } : undefined}>
      {tab === "businesses" ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-medium leading-none text-foreground sm:text-[32px]">{t("admin.tab_businesses")}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={reloadBoard}
                className="inline-flex h-11 items-center rounded-full border border-line bg-surface px-5 text-sm font-medium text-foreground hover:border-brand"
              >
                {t("admin.reload")}
              </button>
              <button
                type="button"
                onClick={() => setCreating((value) => !value)}
                className="inline-flex h-11 items-center rounded-full bg-[#111827] px-5 text-sm font-medium text-white"
              >
                {creating ? t("done") : t("admin.create_business")}
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:mt-7 sm:grid-cols-3">
            <Stat
              label={t("admin.stat_total")}
              value={counts.total}
              active={directoryStatus === "all"}
              onClick={() => setDirectoryStatus("all")}
            />
            <Stat
              label={t("admin.published")}
              value={counts.published}
              active={directoryStatus === "published"}
              onClick={() => setDirectoryStatus("published")}
            />
            <Stat
              label={t("admin.pending_review")}
              value={counts.pending}
              active={directoryStatus === "pending_review"}
              onClick={() => setDirectoryStatus("pending_review")}
            />
          </div>

          {error ? (
            <p className="mt-6 text-sm text-[#EF4444]" role="alert">
              {error}
            </p>
          ) : null}
          {notice ? <p className="mt-6 text-sm text-brand">{notice}</p> : null}

          {creating ? (
            <section className="mt-6">
              <AdminCreateForm
                onCreated={() => {
                  setCreating(false);
                  setNotice(t("admin.published_now"));
                  reloadBoard();
                }}
              />
            </section>
          ) : (
            <BusinessDirectory status={directoryStatus} onStatusChange={setDirectoryStatus} query={query} reloadKey={directoryVersion} />
          )}
        </>
      ) : (
        <EmptyTab title={t(`admin.tab_${tab}`)} />
      )}
    </AdminShell>
  );
}

function Stat({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-[20px] border border-brand bg-surface px-5 py-5 text-start sm:rounded-[24px] sm:px-6 sm:py-6"
          : "rounded-[20px] border border-line bg-surface px-5 py-5 text-start hover:border-brand sm:rounded-[24px] sm:px-6 sm:py-6"
      }
    >
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-3xl font-medium leading-none text-foreground sm:mt-3 sm:text-[40px]">{value}</p>
    </button>
  );
}

function EmptyTab({ title }: { title: string }) {
  const { t } = useI18n();
  return (
    <section>
      <h1 className="text-2xl font-medium leading-none text-foreground sm:text-[32px]">{title}</h1>
      <p className="mt-8 rounded-3xl border border-line bg-surface px-6 py-20 text-center text-sm text-muted">
        {t("admin.coming_soon")}
      </p>
    </section>
  );
}

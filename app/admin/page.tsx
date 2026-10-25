"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { AdminCreateForm } from "../components/admin-create-form";
import { BusinessDirectory } from "../components/business-directory";
import { LanguageSwitcher } from "../components/language-switcher";
import { apiGet } from "@/lib/api";
import type { Business, BusinessCounts, BusinessSession } from "@/lib/business";
import { signOutAccount, signedInThisTab } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { auth } from "@/lib/firebase";
import { useI18n } from "@/lib/i18n";

const EMPTY_COUNTS: BusinessCounts = { total: 0, pending: 0, published: 0, rejected: 0, deleted: 0 };

type Tab = "overview" | "businesses" | "users" | "analytics";

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
  const [ready, setReady] = useState(false);
  const [counts, setCounts] = useState<BusinessCounts>(EMPTY_COUNTS);
  const [directoryStatus, setDirectoryStatus] = useState<Business["status"] | "all">("all");
  const [directoryVersion, setDirectoryVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>(search.get("business") ? "businesses" : "businesses");
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");

  const refreshCounts = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;
    setCounts(await apiGet<BusinessCounts>("/admin/businesses/summary", await user.getIdToken()));
  }, []);

  useEffect(() => {
    if (!signedInThisTab()) {
      setReady(false);
      router.replace("/login");
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user || !signedInThisTab()) {
        setReady(false);
        router.replace("/login");
        return;
      }
      try {
        const session = await apiGet<BusinessSession>("/businesses/mine", await user.getIdToken());
        if (!session.is_ragly_admin) {
          router.replace("/dashboard");
          return;
        }
        await refreshCounts();
        setReady(true);
      } catch (err: unknown) {
        setError(errorMessage(err, t));
      }
    });
    return unsubscribe;
  }, [router, t, refreshCounts]);

  function reloadBoard() {
    setNotice("");
    setDirectoryVersion((version) => version + 1);
    void refreshCounts();
  }

  if (!ready || !signedInThisTab()) {
    return (
      <main className="min-h-full bg-[#F7F8FA] px-6 py-10">
        {error ? (
          <p className="text-sm text-[#EF4444]" role="alert">
            {error}
          </p>
        ) : null}
      </main>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: t("admin.tab_overview") },
    { id: "businesses", label: t("admin.tab_businesses") },
    { id: "users", label: t("admin.tab_users") },
    { id: "analytics", label: t("admin.tab_analytics") },
  ];

  return (
    <main className="min-h-full bg-[#F7F8FA]">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center gap-4 px-6 py-5 lg:px-10">
          <p className="text-[28px] font-medium leading-none text-brand">{t("admin.title")}</p>
          <nav className="flex flex-1 flex-wrap items-center gap-1 sm:justify-center">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  setCreating(false);
                }}
                className={
                  tab === item.id
                    ? "inline-flex h-10 items-center rounded-full bg-[#111827] px-5 text-sm font-medium text-white"
                    : "inline-flex h-10 items-center rounded-full px-5 text-sm font-medium text-muted hover:text-foreground"
                }
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {tab === "businesses" && !creating ? (
              <label className="relative block">
                <span className="sr-only">{t("admin.search")}</span>
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 fill-none stroke-muted stroke-2"
                >
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="m16 16 4 4" strokeLinecap="round" />
                </svg>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("admin.search")}
                  className="h-10 w-52 rounded-full border border-line bg-background ps-9 pe-4 text-sm text-foreground outline-none focus:border-brand lg:w-72"
                />
              </label>
            ) : null}
            <LanguageSwitcher />
            <button
              type="button"
              onClick={async () => {
                await signOutAccount();
                router.replace("/");
              }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#EEF3F2] text-sm font-medium text-brand"
              aria-label={t("dashboard.sign_out")}
            >
              {(auth.currentUser?.email?.[0] || "A").toUpperCase()}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1440px] px-6 py-8 lg:px-10">
        {tab === "businesses" ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h1 className="text-[32px] font-medium leading-none text-foreground">{t("admin.tab_businesses")}</h1>
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

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
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
              <BusinessDirectory
                status={directoryStatus}
                onStatusChange={setDirectoryStatus}
                query={query}
                reloadKey={directoryVersion}
                initialId={search.get("business")}
                onDeleted={() => void refreshCounts()}
              />
            )}
          </>
        ) : (
          <EmptyTab title={tabs.find((item) => item.id === tab)?.label || ""} />
        )}
      </div>
    </main>
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
          ? "rounded-[24px] border border-brand bg-surface px-6 py-6 text-start"
          : "rounded-[24px] border border-line bg-surface px-6 py-6 text-start hover:border-brand"
      }
    >
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-3 text-[40px] font-medium leading-none text-foreground">{value}</p>
    </button>
  );
}

function EmptyTab({ title }: { title: string }) {
  const { t } = useI18n();
  return (
    <section>
      <h1 className="text-[32px] font-medium leading-none text-foreground">{title}</h1>
      <p className="mt-8 rounded-3xl border border-line bg-surface px-6 py-20 text-center text-sm text-muted">
        {t("admin.coming_soon")}
      </p>
    </section>
  );
}

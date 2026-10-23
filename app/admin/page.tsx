"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { AccountBar } from "../components/account-bar";
import { AdminCreateForm } from "../components/admin-create-form";
import { AdminReview } from "../components/admin-review";
import { BusinessDetails } from "../components/business-details";
import { BusinessDirectory } from "../components/business-directory";
import { LogoBadge } from "../components/business-logo";
import { BusinessPillView } from "../components/status-pill";
import { apiGet } from "@/lib/api";
import type { Business, BusinessCounts, BusinessPage, BusinessSession, ReviewGroup } from "@/lib/business";
import { signedInThisTab } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { auth } from "@/lib/firebase";
import { useI18n } from "@/lib/i18n";

const EMPTY_COUNTS: BusinessCounts = { pending: 0, published: 0, rejected: 0, deleted: 0 };

type Tab = "review" | "businesses" | "add";

export default function AdminPage() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10" />}>
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
  const [groups, setGroups] = useState<ReviewGroup[]>([]);
  const [recent, setRecent] = useState<Business[]>([]);
  const [recentMore, setRecentMore] = useState(false);
  const [openRecentId, setOpenRecentId] = useState<string | null>(null);
  const [directoryStatus, setDirectoryStatus] = useState<Business["status"] | "all">("published");
  const [directoryVersion, setDirectoryVersion] = useState(0);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>(search.get("business") ? "businesses" : "review");
  const [notice, setNotice] = useState("");
  const recentSkip = useRef(0);
  const recentLoading = useRef(false);
  const recentSentinel = useRef<HTMLDivElement>(null);

  const loadReview = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;
    setGroups(await apiGet<ReviewGroup[]>("/admin/review", await user.getIdToken()));
  }, []);

  const loadRecent = useCallback(async (reset: boolean) => {
    const user = auth.currentUser;
    if (!user) return;
    if (!reset && recentLoading.current) return;
    recentLoading.current = true;
    try {
      const token = await user.getIdToken();
      const skip = reset ? 0 : recentSkip.current;
      const page = await apiGet<BusinessPage>(`/admin/businesses/page?status=reviewed&limit=20&skip=${skip}&sort=recent`, token);
      recentSkip.current = skip + page.items.length;
      setRecentMore(page.has_more);
      setRecent((current) => (reset ? page.items : [...current, ...page.items]));
    } finally {
      recentLoading.current = false;
    }
  }, []);

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
        await Promise.all([refreshCounts(), loadReview(), loadRecent(true)]);
        setReady(true);
      } catch (err: unknown) {
        setError(errorMessage(err, t));
      }
    });
    return unsubscribe;
  }, [router, t, refreshCounts, loadReview, loadRecent]);

  useEffect(() => {
    const node = recentSentinel.current;
    if (!node || !recentMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadRecent(false);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [recentMore, recent.length, loadRecent]);

  async function afterDecision() {
    setError("");
    try {
      await Promise.all([loadReview(), loadRecent(true), refreshCounts()]);
      setDirectoryVersion((version) => version + 1);
    } catch (err: unknown) {
      setError(errorMessage(err, t));
    }
  }

  if (!ready || !signedInThisTab()) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">
        {error ? (
          <p className="text-sm text-[#EF4444]" role="alert">
            {error}
          </p>
        ) : null}
      </main>
    );
  }

  const openRecent = recent.find((business) => business.id === openRecentId) ?? null;
  const waitingBranches = groups.reduce((sum, group) => sum + group.branches.length, 0);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-10">
      <AccountBar title={t("admin.title")} />
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("admin.waiting")} value={counts.pending} onClick={() => setTab("review")} />
        <Stat
          label={t("admin.published")}
          value={counts.published}
          onClick={() => {
            setDirectoryStatus("published");
            setTab("businesses");
          }}
        />
        <Stat
          label={t("admin.rejected")}
          value={counts.rejected}
          onClick={() => {
            setDirectoryStatus("rejected");
            setTab("businesses");
          }}
        />
        <Stat label={t("admin.deleted")} value={counts.deleted} />
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <TabButton active={tab === "review"} count={waitingBranches} onClick={() => setTab("review")}>
          {t("admin.tab_reviews")}
        </TabButton>
        <TabButton active={tab === "businesses"} onClick={() => setTab("businesses")}>
          {t("admin.tab_businesses")}
        </TabButton>
        <TabButton active={tab === "add"} onClick={() => setTab("add")}>
          {t("admin.tab_add")}
        </TabButton>
      </div>
      {error ? (
        <p className="mt-6 text-sm text-[#EF4444]" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? <p className="mt-6 text-sm text-brand">{notice}</p> : null}

      {tab === "businesses" ? (
        <BusinessDirectory
          status={directoryStatus}
          onStatusChange={setDirectoryStatus}
          reloadKey={directoryVersion}
          initialId={search.get("business")}
          onDeleted={() => void refreshCounts()}
        />
      ) : tab === "add" ? (
        <section className="mt-6">
          <AdminCreateForm
            onCreated={(business) => {
              setRecent((current) => [business, ...current]);
              setDirectoryVersion((version) => version + 1);
              setNotice(t("admin.published_now"));
              setTab("businesses");
              void refreshCounts();
            }}
          />
        </section>
      ) : (
        <div className="mt-6 grid gap-8">
          <section>
            <h2 className="text-lg font-medium text-foreground">{t("admin.pending_review")}</h2>
            <p className="mt-1 text-sm text-muted">{t("admin.review_hint")}</p>
            <AdminReview groups={groups} onDecided={() => void afterDecision()} />
          </section>
          <section className="rounded-3xl border border-line bg-surface p-5">
            <h2 className="text-lg font-medium text-foreground">{t("admin.recent")}</h2>
            {recent.length === 0 ? (
              <p className="mt-4 rounded-2xl bg-background px-4 py-8 text-center text-sm text-muted">{t("admin.empty_recent")}</p>
            ) : (
              <ul className="mt-4 grid gap-2">
                {recent.map((business) => {
                  const open = business.id === openRecentId;
                  return (
                    <li key={business.id} className="rounded-2xl bg-background">
                      <button
                        type="button"
                        onClick={() => setOpenRecentId(open ? null : business.id)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-start"
                      >
                        <LogoBadge business={business} size="h-12 w-12" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">{business.name}</span>
                          <span className="mt-1 block text-sm text-muted">
                            {business.city || "—"} · {t("admin.branch_count", { n: business.locations.length })}
                          </span>
                        </span>
                        <BusinessPillView status={business.status} />
                      </button>
                      {open && openRecent ? (
                        <div className="border-t border-line px-4 py-4">
                          <BusinessDetails business={openRecent} />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
            <div ref={recentSentinel} className="h-1" />
          </section>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value, onClick }: { label: string; value: number | string; onClick?: () => void }) {
  const className = "rounded-2xl border border-line bg-surface px-5 py-4 text-start";
  const body = (
    <>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-medium text-foreground">{value}</p>
    </>
  );
  if (!onClick) return <div className={className}>{body}</div>;
  return (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  );
}

function TabButton({ active, count = 0, onClick, children }: { active: boolean; count?: number; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-medium text-white"
          : "inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-5 text-sm font-medium text-foreground"
      }
    >
      {children}
      {count > 0 ? (
        <span
          className={
            active
              ? "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-xs text-brand"
              : "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-xs text-white"
          }
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { AccountBar } from "../components/account-bar";
import { BusinessDetails } from "../components/business-details";
import { BusinessDirectory } from "../components/business-directory";
import { BusinessForm } from "../components/business-form";
import { ReviewQueue } from "../components/review-queue";
import { apiGet, apiPost } from "@/lib/api";
import {
  businessImages,
  type Business,
  type BusinessCounts,
  type BusinessPage,
  type BusinessSession,
} from "@/lib/business";
import { errorMessage } from "@/lib/errors";
import { auth } from "@/lib/firebase";
import { useI18n } from "@/lib/i18n";

const EMPTY_COUNTS: BusinessCounts = { pending: 0, published: 0, rejected: 0, deleted: 0 };

export default function AdminPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [ready, setReady] = useState(false);
  const [counts, setCounts] = useState<BusinessCounts>(EMPTY_COUNTS);
  const [pending, setPending] = useState<Business[]>([]);
  const [pendingMore, setPendingMore] = useState(false);
  const [recent, setRecent] = useState<Business[]>([]);
  const [recentMore, setRecentMore] = useState(false);
  const [openRecentId, setOpenRecentId] = useState<string | null>(null);
  const [directoryStatus, setDirectoryStatus] = useState<Business["status"] | "all">("published");
  const [directoryVersion, setDirectoryVersion] = useState(0);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [tab, setTab] = useState<"businesses" | "reviews" | "add">("businesses");
  const [notice, setNotice] = useState("");
  const pendingSkip = useRef(0);
  const recentSkip = useRef(0);
  const queueLoading = useRef(false);
  const recentSentinel = useRef<HTMLDivElement>(null);

  const loadQueue = useCallback(async (kind: "pending" | "recent", reset: boolean) => {
    const user = auth.currentUser;
    if (!user) return;
    if (!reset && queueLoading.current) return;
    queueLoading.current = true;
    try {
      const token = await user.getIdToken();
      const skip = reset ? 0 : kind === "pending" ? pendingSkip.current : recentSkip.current;
      const status = kind === "pending" ? "pending_review" : "reviewed";
      const page = await apiGet<BusinessPage>(
        `/admin/businesses/page?status=${status}&limit=20&skip=${skip}&sort=recent`,
        token,
      );
      if (kind === "pending") {
        pendingSkip.current = skip + page.items.length;
        setPendingMore(page.has_more);
        setPending((current) => (reset ? page.items : [...current, ...page.items]));
      } else {
        recentSkip.current = skip + page.items.length;
        setRecentMore(page.has_more);
        setRecent((current) => (reset ? page.items : [...current, ...page.items]));
      }
    } finally {
      queueLoading.current = false;
    }
  }, []);

  const refreshCounts = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;
    const token = await user.getIdToken();
    setCounts(await apiGet<BusinessCounts>("/admin/businesses/summary", token));
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      try {
        const token = await user.getIdToken();
        const session = await apiGet<BusinessSession>("/businesses/mine", token);
        if (!session.is_ragly_admin) {
          router.replace("/dashboard");
          return;
        }
        await Promise.all([refreshCounts(), loadQueue("pending", true), loadQueue("recent", true)]);
        setReady(true);
      } catch (err: unknown) {
        setError(errorMessage(err, t));
        setReady(true);
      }
    });
    return unsubscribe;
  }, [router, t, refreshCounts, loadQueue]);

  useEffect(() => {
    const node = recentSentinel.current;
    if (!node || !recentMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadQueue("recent", false);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [recentMore, recent.length, loadQueue]);

  async function decide(
    id: string,
    action: "approve" | "reject",
    fieldErrors: Record<string, string>,
  ) {
    const user = auth.currentUser;
    if (!user) return;
    const notes = Object.fromEntries(
      Object.entries(fieldErrors).filter(([, note]) => note.trim()),
    );
    if (action === "reject" && Object.keys(notes).length === 0) return;
    setBusyId(id);
    setError("");
    try {
      const token = await user.getIdToken();
      const updated = await apiPost<Business>(
        `/admin/businesses/${id}/${action}`,
        token,
        action === "reject" ? { field_errors: notes } : {},
      );
      setPending((current) => current.filter((item) => item.id !== id));
      setRecent((current) => [updated, ...current.filter((item) => item.id !== id)]);
      setDirectoryVersion((version) => version + 1);
      await refreshCounts();
    } catch (err: unknown) {
      setError(errorMessage(err, t));
    } finally {
      setBusyId("");
    }
  }

  if (!ready && !error) {
    return <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10" />;
  }

  const openRecent = recent.find((business) => business.id === openRecentId) ?? null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-10">
      <AccountBar title={t("admin.title")} />
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={t("admin.waiting")}
          value={counts.pending}
          onClick={() => setTab("reviews")}
        />
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
      <div className="mt-6 flex gap-2">
        <TabButton active={tab === "businesses"} onClick={() => setTab("businesses")}>
          {t("admin.tab_businesses")}
        </TabButton>
        <TabButton
          active={tab === "reviews"}
          count={counts.pending}
          onClick={() => setTab("reviews")}
        >
          {t("admin.tab_reviews")}
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
          onUpdated={() => undefined}
          onInvited={() => undefined}
          onDeleted={() => {
            void refreshCounts();
          }}
        />
      ) : tab === "add" ? (
        <section className="mt-6 rounded-3xl border border-line bg-surface p-5 sm:p-8">
          <BusinessForm
            mode="admin"
            onSubmitted={(business) => {
              setRecent((current) => [business, ...current]);
              setDirectoryVersion((version) => version + 1);
              setNotice(t("admin.published_now"));
              setTab("reviews");
              void refreshCounts();
            }}
          />
        </section>
      ) : (
        <div className="mt-6 grid gap-5">
          <section>
            <h2 className="text-lg font-medium text-foreground">{t("admin.pending_review")}</h2>
            <ReviewQueue
              pending={pending}
              unreadIds={[]}
              busyId={busyId}
              hasMore={pendingMore}
              onLoadMore={() => void loadQueue("pending", false)}
              onDecide={(id, action, fieldErrors) => void decide(id, action, fieldErrors)}
            />
          </section>
          <section className="rounded-3xl border border-line bg-surface p-5">
            <h2 className="text-lg font-medium text-foreground">{t("admin.recent")}</h2>
            {recent.length === 0 ? (
              <p className="mt-4 rounded-2xl bg-background px-4 py-8 text-center text-sm text-muted">
                {t("admin.empty_recent")}
              </p>
            ) : (
              <ul className="mt-4 grid gap-2">
                {recent.map((business) => {
                  const image = businessImages(business)[0];
                  const open = business.id === openRecentId;
                  return (
                    <li key={business.id} className="rounded-2xl bg-background">
                      <button
                        type="button"
                        onClick={() => setOpenRecentId(open ? null : business.id)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-start"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-foreground">{business.name}</span>
                          <span className="mt-1 block text-sm text-muted">
                            {t(`admin.${business.status}`)} · {business.city}
                          </span>
                        </span>
                        {image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={image} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                        ) : (
                          <span className="h-14 w-14 shrink-0 rounded-xl bg-surface" />
                        )}
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

function Stat({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number | string;
  onClick?: () => void;
}) {
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

function TabButton({
  active,
  count = 0,
  onClick,
  children,
}: {
  active: boolean;
  count?: number;
  onClick: () => void;
  children: string;
}) {
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

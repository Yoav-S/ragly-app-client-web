"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { AccountBar } from "../components/account-bar";
import { BusinessDetails } from "../components/business-details";
import { BusinessDirectory } from "../components/business-directory";
import { BusinessForm } from "../components/business-form";
import { ReviewQueue } from "../components/review-queue";
import { apiGet, apiPost } from "@/lib/api";
import { type Business, type BusinessSession, type Invitation } from "@/lib/business";
import { errorMessage } from "@/lib/errors";
import { auth } from "@/lib/firebase";
import { useI18n } from "@/lib/i18n";

const SEEN_KEY = "ragly_seen_review_ids";

function readSeen(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export default function AdminPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [items, setItems] = useState<Business[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [tab, setTab] = useState<"businesses" | "reviews" | "add">("businesses");
  const [notice, setNotice] = useState("");
  const [seen, setSeen] = useState<string[] | null>(null);

  useEffect(() => {
    setSeen(readSeen());
  }, []);

  function markSeen(ids: string[]) {
    setSeen((current) => {
      const next = [...new Set([...(current ?? []), ...ids])];
      localStorage.setItem(SEEN_KEY, JSON.stringify(next));
      return next;
    });
  }

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
        const queue = await apiGet<Business[]>("/admin/businesses", token);
        setItems(queue);
      } catch (err: unknown) {
        setError(errorMessage(err, t));
        setItems([]);
      }
    });
    return unsubscribe;
  }, [router, t]);

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
      setItems((current) =>
        (current ?? []).map((item) => (item.id === id ? updated : item)),
      );
      markSeen([id]);
    } catch (err: unknown) {
      setError(errorMessage(err, t));
    } finally {
      setBusyId("");
    }
  }

  if (items === null && !error) {
    return <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10" />;
  }

  const pending = (items ?? []).filter((item) => item.status === "pending_review");
  const unread = seen ? pending.filter((item) => !seen.includes(item.id)) : [];
  const decided = (items ?? []).filter((item) => item.status !== "pending_review");
  const published = decided.filter((item) => item.status === "published").length;
  const rejected = decided.filter((item) => item.status === "rejected").length;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-10">
      <AccountBar title={t("admin.title")} />
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <Stat label={t("admin.waiting")} value={items ? pending.length : "–"} />
        <Stat label={t("admin.published")} value={items ? published : "–"} />
        <Stat label={t("admin.rejected")} value={items ? rejected : "–"} />
      </div>
      <div className="mt-6 flex gap-2">
        <TabButton active={tab === "businesses"} onClick={() => setTab("businesses")}>
          {t("admin.tab_businesses")}
        </TabButton>
        <TabButton active={tab === "reviews"} count={unread.length} onClick={() => setTab("reviews")}>
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
      {unread.length > 0 ? (
        <div
          className="mt-6 flex flex-col gap-3 rounded-2xl bg-[#EEF3F2] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <p className="text-sm font-medium text-foreground">
            {unread.length === 1
              ? t("admin.unread_one")
              : t("admin.unread_alert", { n: unread.length })}
          </p>
          <button
            type="button"
            onClick={() => markSeen(unread.map((item) => item.id))}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-2xl bg-brand px-4 text-sm font-medium text-white"
          >
            {t("admin.mark_read")}
          </button>
        </div>
      ) : null}

      {tab === "businesses" ? (
        <BusinessDirectory
          items={items ?? []}
          onUpdated={(business) =>
            setItems((current) =>
              (current ?? []).map((item) => (item.id === business.id ? business : item)),
            )
          }
          onInvited={(businessId: string, invitation: Invitation) =>
            setItems((current) =>
              (current ?? []).map((item) =>
                item.id === businessId
                  ? { ...item, invitations: [invitation, ...(item.invitations ?? [])] }
                  : item,
              ),
            )
          }
          onDeleted={(businessId) =>
            setItems((current) => (current ?? []).filter((item) => item.id !== businessId))
          }
        />
      ) : tab === "add" ? (
        <section className="mt-6 rounded-3xl border border-line bg-surface p-5 sm:p-8">
          <BusinessForm
            mode="admin"
            onSubmitted={(business) => {
              setItems((current) => [business, ...(current ?? [])]);
              setNotice(t("admin.published_now"));
              setTab("reviews");
            }}
          />
        </section>
      ) : (
        <div className="mt-6 grid gap-5">
          <section>
            <h2 className="text-lg font-medium text-foreground">{t("admin.pending_review")}</h2>
            <ReviewQueue
              pending={pending}
              unreadIds={unread.map((item) => item.id)}
              busyId={busyId}
              onDecide={(id, action, fieldErrors) => void decide(id, action, fieldErrors)}
            />
          </section>
          <section className="rounded-3xl border border-line bg-surface p-5">
            <h2 className="text-lg font-medium text-foreground">{t("admin.recent")}</h2>
            {items && decided.length === 0 ? (
              <p className="mt-4 rounded-2xl bg-background px-4 py-8 text-center text-sm text-muted">
                {t("admin.empty_recent")}
              </p>
            ) : null}
            <div className="mt-4 grid gap-4">
              {decided.map((business) => (
                <article key={business.id} className="rounded-2xl bg-background p-5">
                  <p className="text-sm font-medium text-brand">{t(`admin.${business.status}`)}</p>
                  <div className="mt-3">
                    <BusinessDetails business={business} />
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-5 py-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-medium text-foreground">{value}</p>
    </div>
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

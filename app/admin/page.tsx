"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { AccountBar } from "../components/account-bar";
import { BusinessDetails } from "../components/business-details";
import { apiGet, apiPost } from "@/lib/api";
import { type Business, type BusinessSession } from "@/lib/business";
import { errorMessage } from "@/lib/errors";
import { auth } from "@/lib/firebase";
import { useI18n } from "@/lib/i18n";

export default function AdminPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [items, setItems] = useState<Business[] | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

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

  async function decide(id: string, action: "approve" | "reject") {
    const user = auth.currentUser;
    if (!user) return;
    if (action === "reject" && !reasons[id]?.trim()) return;
    setBusyId(id);
    setError("");
    try {
      const token = await user.getIdToken();
      const updated = await apiPost<Business>(
        `/admin/businesses/${id}/${action}`,
        token,
        action === "reject" ? { reason: reasons[id].trim() } : {},
      );
      setItems((current) =>
        (current ?? []).map((item) => (item.id === id ? updated : item)),
      );
    } catch (err: unknown) {
      setError(errorMessage(err, t));
    } finally {
      setBusyId("");
    }
  }

  const pending = (items ?? []).filter((item) => item.status === "pending_review");
  const decided = (items ?? []).filter((item) => item.status !== "pending_review");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-12">
      <AccountBar title={t("admin.title")} />
      {error ? (
        <p className="mt-8 text-sm text-[#EF4444]" role="alert">
          {error}
        </p>
      ) : null}
      {items && pending.length === 0 ? (
        <p className="mt-8 text-base text-muted">{t("admin.empty")}</p>
      ) : null}
      <div className="mt-8 grid gap-5">
        {pending.map((business) => (
          <article key={business.id} className="rounded-2xl border border-line bg-surface p-6">
            <p className="text-sm font-medium text-brand">{t("admin.pending_review")}</p>
            <div className="mt-4">
              <BusinessDetails business={business} />
            </div>
            <label className="mt-5 block text-sm text-muted">
              {t("admin.reason")}
              <textarea
                className="mt-2 min-h-24 w-full rounded-2xl border border-line bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-brand"
                value={reasons[business.id] ?? ""}
                onChange={(event) =>
                  setReasons({ ...reasons, [business.id]: event.target.value })
                }
              />
            </label>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                disabled={busyId === business.id}
                onClick={() => decide(business.id, "approve")}
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-brand px-5 text-sm font-medium text-white disabled:bg-[#8DB0AA]"
              >
                {t("admin.approve")}
              </button>
              <button
                type="button"
                disabled={busyId === business.id || !reasons[business.id]?.trim()}
                onClick={() => decide(business.id, "reject")}
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-line px-5 text-sm font-medium text-foreground disabled:text-muted"
              >
                {t("admin.reject")}
              </button>
            </div>
          </article>
        ))}
        {decided.map((business) => (
          <article key={business.id} className="rounded-2xl border border-line p-6">
            <p className="text-sm font-medium text-muted">{t(`admin.${business.status}`)}</p>
            <div className="mt-4">
              <BusinessDetails business={business} />
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}

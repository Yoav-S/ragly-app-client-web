"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { AccountBar } from "../components/account-bar";
import { BusinessDetails } from "../components/business-details";
import { BusinessForm } from "../components/business-form";
import { apiGet, type UserProfile } from "@/lib/api";
import { type Business, type BusinessSession } from "@/lib/business";
import { errorMessage } from "@/lib/errors";
import { auth } from "@/lib/firebase";
import { useI18n } from "@/lib/i18n";

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      try {
        const token = await user.getIdToken();
        const [me, session] = await Promise.all([
          apiGet<UserProfile>("/users/me", token),
          apiGet<BusinessSession>("/businesses/mine", token),
        ]);
        if (session.is_ragly_admin) {
          router.replace("/admin");
          return;
        }
        setProfile(me);
        setBusiness(session.business);
        setReady(true);
      } catch (err: unknown) {
        setError(errorMessage(err, t));
        setReady(true);
      }
    });
    return unsubscribe;
  }, [router, t]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-12">
      <AccountBar title={t("dashboard.account")} />
      {error ? (
        <p className="mt-8 text-sm text-[#EF4444]" role="alert">
          {error}
        </p>
      ) : null}
      {profile && ready && !business ? (
        <>
          <p className="mt-6 text-sm text-muted">{profile.email}</p>
          <BusinessForm onSubmitted={setBusiness} />
        </>
      ) : null}
      {business ? (
        <section className="mt-8 rounded-2xl border border-line bg-surface p-6">
          <p className="text-sm font-medium text-brand">
            {t(`business.${business.status === "pending_review" ? "pending" : business.status}`)}
          </p>
          {business.status === "rejected" && business.rejection_reason ? (
            <p className="mt-3 text-sm text-foreground">{business.rejection_reason}</p>
          ) : null}
          <div className="mt-6">
            <BusinessDetails business={business} />
          </div>
          {business.status === "rejected" ? (
            <BusinessForm initial={business} onSubmitted={setBusiness} />
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

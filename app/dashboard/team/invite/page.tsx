"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { Card, inputClass, primaryButton } from "../../../components/form-controls";
import { apiGet, apiPost } from "@/lib/api";
import type { Business, BusinessSession, Invitation } from "@/lib/business";
import { errorMessage } from "@/lib/errors";
import { auth } from "@/lib/firebase";
import { useI18n } from "@/lib/i18n";

export default function InviteTeamMemberPage() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10" />}>
      <InviteTeamMember />
    </Suspense>
  );
}

function InviteTeamMember() {
  const router = useRouter();
  const search = useSearchParams();
  const { t } = useI18n();
  const businessId = search.get("business") ?? "";
  const [business, setBusiness] = useState<Business | null>(null);
  const [email, setEmail] = useState("");
  const [locationId, setLocationId] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      if (!businessId) {
        router.replace("/dashboard");
        return;
      }
      try {
        const session = await apiGet<BusinessSession>("/businesses/mine", await user.getIdToken());
        if (session.is_ragly_admin) {
          router.replace(`/admin/businesses/${businessId}`);
          return;
        }
        const membership = session.businesses.find((item) => item.business.id === businessId);
        if (!membership || membership.role !== "owner") {
          router.replace("/dashboard");
          return;
        }
        setBusiness(membership.business);
        const firstOpen = membership.business.locations.find((branch) => {
          const taken = (membership.business.members ?? []).some(
            (member) => member.role === "branch_owner" && member.location_id === branch.id,
          );
          const waiting = membership.business.invitations.some(
            (invitation) =>
              invitation.status === "pending" && invitation.role === "branch_owner" && invitation.location_id === branch.id,
          );
          return !taken && !waiting;
        });
        setLocationId(firstOpen?.id ?? membership.business.locations[0]?.id ?? "");
        setReady(true);
      } catch (err: unknown) {
        setError(errorMessage(err, t));
        setReady(true);
      }
    });
    return unsubscribe;
  }, [businessId, router, t]);

  const selected = useMemo(
    () => business?.locations.find((branch) => branch.id === locationId) ?? null,
    [business, locationId],
  );
  const taken = Boolean(
    selected &&
      ((business?.members ?? []).some((member) => member.role === "branch_owner" && member.location_id === selected.id) ||
        business?.invitations.some(
          (invitation) =>
            invitation.status === "pending" && invitation.role === "branch_owner" && invitation.location_id === selected.id,
        )),
  );
  const backHref = `/dashboard?business=${businessId}&tab=team`;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user || !business || pending || !email.trim() || !locationId || taken) return;
    setPending(true);
    setError("");
    try {
      await apiPost<Invitation>(`/businesses/${business.id}/invitations`, await user.getIdToken(), {
        email: email.trim().toLowerCase(),
        role: "branch_owner",
        location_id: locationId,
      });
      router.replace(backHref);
    } catch (err: unknown) {
      setError(errorMessage(err, t));
    } finally {
      setPending(false);
    }
  }

  if (!ready) {
    return <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10" />;
  }

  if (!business) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
        {error ? (
          <p className="text-sm text-[#EF4444]" role="alert">
            {error}
          </p>
        ) : null}
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-10">
      <Link href={backHref} className="text-sm font-medium text-brand">
        ← {t("dashboard.back_to_team")}
      </Link>
      <h1 className="mt-4 text-2xl font-medium text-foreground">{t("dashboard.add_member_title")}</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted">{t("dashboard.add_member_body")}</p>
      {business.locations.length === 0 ? (
        <p className="mt-6 text-sm text-muted">{t("dashboard.invite_branch_needed")}</p>
      ) : (
        <Card className="mt-6">
          <form onSubmit={onSubmit} className="grid gap-4">
            <label className="block text-sm font-medium text-foreground">
              {t("dashboard.member_email")}
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-foreground">
              {t("dashboard.role")}
              <select value="branch_owner" disabled className={inputClass}>
                <option value="branch_owner">{t("admin.role_branch_owner")}</option>
                <option value="worker">{t("dashboard.role_later")}</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-foreground">
              {t("dashboard.branch")}
              <select required value={locationId} onChange={(event) => setLocationId(event.target.value)} className={inputClass}>
                <option value="">{t("dashboard.pick_branch")}</option>
                {business.locations.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.address}
                    {branch.city ? ` · ${branch.city}` : ""}
                  </option>
                ))}
              </select>
            </label>
            {taken ? <p className="text-sm text-[#B91C1C]">{t("dashboard.invite_branch_taken")}</p> : null}
            {error ? (
              <p className="text-sm text-[#EF4444]" role="alert">
                {error}
              </p>
            ) : null}
            <div>
              <button type="submit" disabled={pending || taken || !locationId} className={primaryButton}>
                {t("dashboard.send_invite")}
              </button>
            </div>
          </form>
        </Card>
      )}
    </main>
  );
}

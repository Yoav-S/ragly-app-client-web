"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { AccountBar } from "../components/account-bar";
import { BusinessDetails } from "../components/business-details";
import { BusinessForm } from "../components/business-form";
import { BusinessPhotos } from "../components/business-photos";
import { apiDelete, apiGet, apiPost, type UserProfile } from "@/lib/api";
import { auth } from "@/lib/firebase";
import {
  type Business,
  type BusinessSession,
  type Invitation,
} from "@/lib/business";
import { errorMessage } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";

const FIELD_LABEL: Record<string, string> = {
  name: "business.name",
  phone: "business.phones",
  email: "business.email",
  description: "business.description",
  category: "business.category",
  city: "business.city",
  address: "business.address",
  timezone: "business.timezone",
  hours: "business.hours",
  website: "business.website",
  location: "admin.review_location",
  photo: "business.photo",
  instagram: "business.instagram",
};

function fieldLabel(field: string): string {
  return FIELD_LABEL[field] ?? field;
}

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [role, setRole] = useState<"owner" | "worker" | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"owner" | "worker">("worker");
  const [teamNotice, setTeamNotice] = useState("");

  async function load(token: string) {
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
    setRole(session.role);
    setInvitations(session.invitations ?? []);
    setReady(true);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      try {
        await load(await user.getIdToken());
      } catch (err: unknown) {
        setError(errorMessage(err, t));
        setReady(true);
      }
    });
    return unsubscribe;
  }, [router, t]);

  async function respond(invitation: Invitation, action: "approve" | "decline") {
    const user = auth.currentUser;
    if (!user) return;
    setError("");
    try {
      const token = await user.getIdToken();
      await apiPost(`/businesses/invitations/${invitation.id}/${action}`, token, {});
      await load(token);
    } catch (err: unknown) {
      setError(errorMessage(err, t));
    }
  }

  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user || !business || !memberEmail.trim()) return;
    setError("");
    setTeamNotice("");
    try {
      const token = await user.getIdToken();
      const invitation = await apiPost<Invitation>(
        `/businesses/${business.id}/invitations`,
        token,
        { email: memberEmail.trim().toLowerCase(), role: memberRole },
      );
      setBusiness({
        ...business,
        invitations: [invitation, ...(business.invitations ?? [])],
      });
      setMemberEmail("");
      setTeamNotice(t("admin.invite_sent"));
    } catch (err: unknown) {
      setError(errorMessage(err, t));
    }
  }

  async function removeBusiness() {
    const user = auth.currentUser;
    if (!user || !business) return;
    setError("");
    try {
      const token = await user.getIdToken();
      await apiDelete(`/businesses/${business.id}`, token);
      setBusiness(null);
      setRole(null);
      setEditing(false);
    } catch (err: unknown) {
      setError(errorMessage(err, t));
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-12">
      <AccountBar title={t("dashboard.account")} />
      {error ? (
        <p className="mt-8 text-sm text-[#EF4444]" role="alert">
          {error}
        </p>
      ) : null}
      {invitations.map((invitation) => (
        <section key={invitation.id} className="mt-6 rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-lg font-medium text-foreground">
            {t("dashboard.invite_title", { name: invitation.business_name })}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {t("dashboard.invite_body", {
              role: t(invitation.role === "owner" ? "admin.role_owner" : "admin.role_worker"),
            })}
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => respond(invitation, "approve")}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-brand px-4 text-sm font-medium text-white"
            >
              {t("dashboard.approve")}
            </button>
            <button
              type="button"
              onClick={() => respond(invitation, "decline")}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-line px-4 text-sm font-medium text-foreground"
            >
              {t("dashboard.decline")}
            </button>
          </div>
        </section>
      ))}
      {profile && ready && !business && invitations.length === 0 ? (
        <>
          <p className="mt-6 text-sm text-muted">{profile.email}</p>
          <p className="mt-3 text-sm text-muted">{t("dashboard.empty")}</p>
          <BusinessForm onSubmitted={setBusiness} />
        </>
      ) : null}
      {business ? (
        <section className="mt-8 rounded-2xl border border-line bg-surface p-6">
          <p className="text-sm font-medium text-brand">
            {t(`business.${business.status === "pending_review" ? "pending" : business.status}`)}
          </p>
          {role ? (
            <p className="mt-2 text-sm text-muted">
              {t("dashboard.your_role")}: {t(role === "owner" ? "admin.role_owner" : "admin.role_worker")}
            </p>
          ) : null}
          {business.status === "pending_review" ? (
            <p className="mt-3 rounded-2xl bg-[#EEF3F2] px-4 py-3 text-sm text-foreground">
              {t("business.pending")}
            </p>
          ) : null}
          {role === "worker" ? (
            <p className="mt-3 text-sm text-muted">{t("dashboard.worker_notice")}</p>
          ) : null}
          {business.status === "rejected" && Object.keys(business.field_errors ?? {}).length > 0 ? (
            <div className="mt-4 rounded-2xl bg-[#FEF2F2] p-4">
              <p className="text-sm font-medium text-[#EF4444]">{t("dashboard.fix_these")}</p>
              <ul className="mt-3 grid gap-2">
                {Object.entries(business.field_errors).map(([field, message]) => (
                  <li key={field} className="text-sm text-foreground">
                    <span className="font-medium">{t(fieldLabel(field))}</span>
                    <span className="mt-1 block text-[#EF4444]">{message}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {role === "owner" ? (
            <BusinessPhotos business={business} scope="owner" onChanged={setBusiness} />
          ) : null}
          <div className="mt-6">
            {editing && role === "owner" ? (
              <BusinessForm
                mode="manage"
                initial={business}
                onSubmitted={(updated) => {
                  setBusiness(updated);
                  setEditing(false);
                }}
              />
            ) : (
              <BusinessDetails business={business} showImages={role !== "owner"} />
            )}
          </div>
          {role === "owner" ? (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setEditing((current) => !current)}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-brand px-4 text-sm font-medium text-white"
              >
                {editing ? t("admin.view") : t("admin.update")}
              </button>
              <button
                type="button"
                onClick={() => void removeBusiness()}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-line px-4 text-sm font-medium text-[#EF4444]"
              >
                {t("dashboard.delete")}
              </button>
            </div>
          ) : null}
          {role === "owner" ? (
            <form onSubmit={inviteMember} className="mt-8 grid gap-3 border-t border-line pt-6">
              <h2 className="text-lg font-medium text-foreground">{t("dashboard.team")}</h2>
              <p className="text-sm text-muted">{t("dashboard.team_hint")}</p>
              <label className="block text-sm text-muted">
                {t("admin.invite_email")}
                <input
                  type="email"
                  required
                  value={memberEmail}
                  onChange={(event) => setMemberEmail(event.target.value)}
                  className="mt-2 h-11 w-full rounded-2xl border border-line bg-background px-4 text-sm text-foreground outline-none focus:border-brand"
                />
              </label>
              <label className="block text-sm text-muted">
                {t("dashboard.your_role")}
                <select
                  value={memberRole}
                  onChange={(event) => setMemberRole(event.target.value as "owner" | "worker")}
                  className="mt-2 h-11 w-full rounded-2xl border border-line bg-background px-3 text-sm text-foreground outline-none focus:border-brand"
                >
                  <option value="owner">{t("admin.role_owner")}</option>
                  <option value="worker">{t("admin.role_worker")}</option>
                </select>
              </label>
              {teamNotice ? <p className="text-sm text-brand">{teamNotice}</p> : null}
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-line px-4 text-sm font-medium text-foreground"
              >
                {t("dashboard.add_member")}
              </button>
              <ul className="grid gap-2">
                {(business.invitations ?? []).map((invitation) => (
                  <li key={invitation.id} className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      {invitation.email} · {t(invitation.role === "owner" ? "admin.role_owner" : "admin.role_worker")}
                    </span>
                    <span className="text-muted">{t(`admin.${invitation.status}`)}</span>
                  </li>
                ))}
              </ul>
            </form>
          ) : null}
          {business.status === "rejected" && role !== "worker" ? (
            <BusinessForm initial={business} onSubmitted={setBusiness} />
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

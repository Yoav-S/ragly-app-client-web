"use client";

import Link from "next/link";
import { dangerButton, secondaryButton } from "./form-controls";
import type { Business, Invitation, TeamMember } from "@/lib/business";
import { useI18n } from "@/lib/i18n";

function branchLabel(branch: { address: string; city: string }) {
  return branch.city ? `${branch.address} · ${branch.city}` : branch.address;
}

export function TeamRoster({
  business,
  canManage,
  ownerIsYou,
  inviteHrefFor,
  onFire,
  onCancelInvite,
}: {
  business: Business;
  canManage: boolean;
  ownerIsYou?: boolean;
  inviteHrefFor?: (locationId: string) => string;
  onFire?: (member: TeamMember) => void;
  onCancelInvite?: (invitation: Invitation) => void;
}) {
  const { t } = useI18n();
  const members = business.members ?? [];
  const owner = members.find((item) => item.role === "owner");
  const ownerEmail = owner?.email || business.owner_email || "—";

  return (
    <div className="grid gap-3">
      <article className="rounded-2xl border border-line bg-surface p-5">
        <p className="text-lg font-medium text-foreground">{business.name}</p>
        <dl className="mt-4 grid gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <dt className="text-sm text-muted">{t("dashboard.current_owner")}</dt>
            <dd className="text-sm font-medium text-foreground">
              {ownerIsYou ? `${t("dashboard.branch_owner_you")} · ${ownerEmail}` : ownerEmail}
            </dd>
          </div>
        </dl>
      </article>

      {business.locations.length === 0 ? (
        <p className="px-1 text-sm text-muted">{t("dashboard.invite_branch_needed")}</p>
      ) : (
        <ul className="grid gap-3">
          {business.locations.map((branch) => {
            const member = members.find((item) => item.role === "branch_owner" && item.location_id === branch.id);
            const pending = business.invitations.find(
              (item) => item.status === "pending" && item.role === "branch_owner" && item.location_id === branch.id,
            );
            const inviteHref = inviteHrefFor?.(branch.id);
            return (
              <li key={branch.id}>
                <article className="rounded-2xl border border-line bg-surface p-5">
                  <p className="text-sm font-medium text-foreground">{branchLabel(branch)}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted">{t("admin.role_branch_owner")}</p>
                      {member ? (
                        <p className="mt-1 truncate text-sm font-medium text-foreground">{member.email}</p>
                      ) : pending ? (
                        <p className="mt-1 truncate text-sm font-medium text-foreground">
                          {t("dashboard.waiting_for", { email: pending.email })}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {ownerIsYou ? t("dashboard.branch_owner_you") : t("dashboard.branch_owner_none")}
                        </p>
                      )}
                    </div>
                    {canManage && member && onFire ? (
                      <button type="button" className={dangerButton} onClick={() => onFire(member)}>
                        {t("dashboard.fire_member")}
                      </button>
                    ) : null}
                    {canManage && !member && pending && onCancelInvite ? (
                      <button type="button" className={secondaryButton} onClick={() => onCancelInvite(pending)}>
                        {t("dashboard.cancel_invite")}
                      </button>
                    ) : null}
                    {canManage && !member && !pending && inviteHref ? (
                      <Link href={inviteHref} className={secondaryButton}>
                        {t("dashboard.invite_for_branch")}
                      </Link>
                    ) : null}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

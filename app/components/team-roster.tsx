"use client";

import Link from "next/link";
import { dangerButton, secondaryButton } from "./form-controls";
import type { Business, Invitation, TeamMember } from "@/lib/business";
import { useI18n } from "@/lib/i18n";

export function TeamRoster({
  business,
  canManage,
  ownerIsYou,
  framed = true,
  inviteHrefFor,
  onFire,
  onCancelInvite,
}: {
  business: Business;
  canManage: boolean;
  ownerIsYou?: boolean;
  framed?: boolean;
  inviteHrefFor?: (locationId: string) => string;
  onFire?: (member: TeamMember) => void;
  onCancelInvite?: (invitation: Invitation) => void;
}) {
  const { t } = useI18n();
  const members = business.members ?? [];
  const owner = members.find((item) => item.role === "owner");
  const ownerEmail = owner?.email || business.owner_email || "—";

  return (
    <div className={framed ? "rounded-2xl border border-line bg-surface p-5 sm:p-6" : undefined}>
      <div>
        <p className="text-xs text-muted">{t("dashboard.current_owner")}</p>
        <p className="mt-1 text-sm font-medium text-foreground">
          {ownerIsYou ? t("dashboard.branch_owner_you") : ownerEmail}
        </p>
        {ownerIsYou ? <p className="mt-0.5 text-sm text-muted">{ownerEmail}</p> : null}
      </div>

      {business.locations.length === 0 ? (
        <p className="mt-6 text-sm text-muted">{t("dashboard.invite_branch_needed")}</p>
      ) : (
        <div className="mt-6 border-t border-line pt-5">
          <p className="text-xs text-muted">{t("dashboard.team_branches")}</p>
          <ul className="mt-3 grid gap-4">
            {business.locations.map((branch) => {
              const member = members.find((item) => item.role === "branch_owner" && item.location_id === branch.id);
              const pending = business.invitations.find(
                (item) => item.status === "pending" && item.role === "branch_owner" && item.location_id === branch.id,
              );
              const inviteHref = inviteHrefFor?.(branch.id);
              const address = branch.address.trim();
              const city = branch.city.trim();
              return (
                <li key={branch.id} className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{address || city || t("branch.no_address")}</p>
                    {city && city !== address ? <p className="mt-0.5 text-sm text-muted">{city}</p> : null}
                    {member ? (
                      <p className="mt-2 text-sm text-foreground">
                        {t("admin.role_branch_owner")}: {member.email}
                      </p>
                    ) : pending ? (
                      <p className="mt-2 text-sm text-muted">{t("dashboard.waiting_for", { email: pending.email })}</p>
                    ) : (
                      <p className="mt-2 text-sm text-muted">{t("dashboard.branch_owner_none")}</p>
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
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

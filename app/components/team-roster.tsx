"use client";

import { dangerButton, secondaryButton } from "./form-controls";
import type { Business, Invitation, TeamMember } from "@/lib/business";
import { useI18n } from "@/lib/i18n";

export function TeamRoster({
  business,
  canManage,
  vacantHint,
  onFire,
  onCancelInvite,
}: {
  business: Business;
  canManage: boolean;
  vacantHint: string;
  onFire?: (member: TeamMember) => void;
  onCancelInvite?: (invitation: Invitation) => void;
}) {
  const { t } = useI18n();
  const members = business.members ?? [];
  const owner = members.find((item) => item.role === "owner");
  const ownerLabel = owner?.email || business.owner_email || t("dashboard.business_owner");

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-line bg-background px-4 py-4">
        <p className="text-xs text-muted">{t("admin.role_owner")}</p>
        <p className="mt-1 text-sm font-medium text-foreground">{ownerLabel}</p>
      </div>
      {business.locations.length === 0 ? (
        <p className="text-sm text-muted">{t("dashboard.invite_branch_needed")}</p>
      ) : (
        <ul className="grid gap-3">
          {business.locations.map((branch) => {
            const member = members.find((item) => item.role === "branch_owner" && item.location_id === branch.id);
            const pending = business.invitations.find(
              (item) => item.status === "pending" && item.role === "branch_owner" && item.location_id === branch.id,
            );
            return (
              <li key={branch.id} className="rounded-2xl border border-line bg-background px-4 py-4">
                <p className="text-sm font-medium text-foreground">{branch.address}</p>
                {member ? (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-muted">
                      {t("admin.role_branch_owner")} · {member.email}
                    </p>
                    {canManage && onFire ? (
                      <button type="button" className={dangerButton} onClick={() => onFire(member)}>
                        {t("dashboard.fire_member")}
                      </button>
                    ) : null}
                  </div>
                ) : pending ? (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-muted">{t("dashboard.pending_invite", { email: pending.email })}</p>
                    {canManage && onCancelInvite ? (
                      <button type="button" className={secondaryButton} onClick={() => onCancelInvite(pending)}>
                        {t("dashboard.cancel_invite")}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted">{vacantHint}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-sm text-muted">{t("dashboard.team_later")}</p>
    </div>
  );
}

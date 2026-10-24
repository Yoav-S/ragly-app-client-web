"use client";

import { branchPill, type Branch, type BranchPill, type BusinessStatus } from "@/lib/business";
import { useI18n } from "@/lib/i18n";

const PILL_CLASS: Record<BranchPill, string> = {
  draft: "border border-line bg-surface text-muted",
  waiting: "bg-[#FEF3C7] text-[#92400E]",
  changes: "bg-[#FEF2F2] text-[#B91C1C]",
  active: "bg-[#E6F7EE] text-[#047857]",
  paused: "bg-[#F3F4F6] text-[#4B5563]",
};

const PILL_DOT: Record<BranchPill, string> = {
  draft: "bg-[#9CA3AF]",
  waiting: "bg-[#F59E0B]",
  changes: "bg-[#EF4444]",
  active: "bg-[#1EC876]",
  paused: "bg-[#6B7280]",
};

export function Pill({ kind, label }: { kind: BranchPill; label: string }) {
  return (
    <span
      className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ${PILL_CLASS[kind]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${PILL_DOT[kind]}`} aria-hidden />
      {label}
    </span>
  );
}

export function BranchPillView({ branch }: { branch: Branch }) {
  const { t } = useI18n();
  const kind = branchPill(branch);
  if (kind === "active") return null;
  return <Pill kind={kind} label={t(`status.${kind}`)} />;
}

export function businessPill(status: BusinessStatus, visible = true): BranchPill {
  if (status === "published") return visible ? "active" : "paused";
  if (status === "pending_review") return "waiting";
  if (status === "rejected") return "changes";
  if (status === "suspended") return "paused";
  return "draft";
}

export function BusinessPillView({ status, visible = true }: { status: BusinessStatus; visible?: boolean }) {
  const { t } = useI18n();
  const kind = businessPill(status, visible);
  const label =
    status === "published" && !visible
      ? t("status.inactive")
      : status === "suspended"
        ? t("status.suspended")
        : t(`status.${kind}`);
  return <Pill kind={kind} label={label} />;
}

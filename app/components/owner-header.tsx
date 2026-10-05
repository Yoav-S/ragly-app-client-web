"use client";

import Link from "next/link";
import type { UserProfile } from "@/lib/api";
import { greetingKey } from "@/lib/greeting";
import { useI18n } from "@/lib/i18n";

export function OwnerHeader({ profile }: { profile: UserProfile }) {
  const { t } = useI18n();
  const name = profile.name?.trim() || "";
  const initial = name.slice(0, 1).toUpperCase();

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        {profile.photo_url ? (
          // Account photos are Firebase download URLs.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.photo_url}
            alt=""
            className="h-12 w-12 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-medium text-white">
            {initial}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-sm text-muted">{t(greetingKey())}</p>
          <p className="truncate text-lg font-medium text-foreground">{name}</p>
        </div>
      </div>
      <Link href="/dashboard/account" className="shrink-0 text-sm font-medium text-brand">
        {t("dashboard.settings")}
      </Link>
    </div>
  );
}

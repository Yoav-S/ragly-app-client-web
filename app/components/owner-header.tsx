"use client";

import { useState } from "react";
import Link from "next/link";
import type { UserProfile } from "@/lib/api";
import { greetingKey } from "@/lib/greeting";
import { useI18n } from "@/lib/i18n";

export type OwnerNotice = {
  id: string;
  name: string;
  detail: string;
  unread?: boolean;
};

export function OwnerHeader({
  profile,
  notices,
  onOpen,
}: {
  profile: UserProfile;
  notices: OwnerNotice[];
  onOpen: (id: string) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const name = profile.name?.trim() || "";
  const initial = name.slice(0, 1).toUpperCase();
  const unreadCount = notices.filter((notice) => notice.unread).length;

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
      <div className="flex shrink-0 items-center gap-4">
        <div className="relative">
          <button
            type="button"
            aria-expanded={open}
            aria-label={t("dashboard.notices")}
            onClick={() => setOpen((value) => !value)}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-line text-foreground"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2">
              <path d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 7H3s3 0 3-7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10 19a2 2 0 0 0 4 0" strokeLinecap="round" />
            </svg>
            {unreadCount > 0 ? (
              <span className="absolute -end-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#1877F2] px-1 text-[10px] font-medium text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </button>
          {open ? (
            <div className="absolute end-0 z-20 mt-2 w-80 overflow-hidden rounded-2xl border border-line bg-surface shadow-lg">
              <p className="px-4 py-3 text-sm font-medium text-foreground">{t("dashboard.notices")}</p>
              {notices.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-muted">{t("dashboard.notices_empty")}</p>
              ) : (
                <ul className="max-h-80 overflow-auto">
                  {notices.map((notice) => (
                    <li key={notice.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onOpen(notice.id);
                          setOpen(false);
                        }}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-start ${
                          notice.unread ? "bg-[#E7F3FF]" : "bg-surface hover:bg-background"
                        }`}
                      >
                        <span
                          className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${notice.unread ? "bg-[#1877F2]" : "bg-transparent"}`}
                          aria-hidden
                        />
                        <span className="min-w-0">
                          <span className={`block text-sm ${notice.unread ? "font-semibold text-foreground" : "font-medium text-foreground"}`}>
                            {notice.name}
                          </span>
                          <span className="mt-1 block text-sm text-muted">{notice.detail}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
        <Link href="/dashboard/account" className="text-sm font-medium text-brand">
          {t("dashboard.settings")}
        </Link>
      </div>
    </div>
  );
}

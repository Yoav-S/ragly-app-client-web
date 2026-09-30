"use client";

import Link from "next/link";
import { LanguageSwitcher } from "./language-switcher";
import { useI18n } from "@/lib/i18n";

export function SiteHeader() {
  const { t } = useI18n();

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-4">
        <Link href="/" className="text-sm font-semibold tracking-wide text-brand">
          Ragly
        </Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Link
            href="/login"
            className="text-sm font-medium text-foreground hover:text-brand"
          >
            {t("auth.login")}
          </Link>
          <Link
            href="/register"
            className="inline-flex h-10 items-center justify-center rounded-2xl bg-brand px-4 text-sm font-medium text-white"
          >
            {t("auth.signup")}
          </Link>
        </div>
      </div>
    </header>
  );
}

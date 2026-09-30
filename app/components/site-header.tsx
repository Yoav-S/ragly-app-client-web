"use client";

import Link from "next/link";
import { LanguageSwitcher } from "./language-switcher";
import { useI18n } from "@/lib/i18n";

export function SiteHeader() {
  const { t } = useI18n();

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="shrink-0 text-sm font-semibold tracking-wide text-brand">
            Ragly
          </Link>
          <div className="sm:hidden">
            <LanguageSwitcher />
          </div>
        </div>
        <nav className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>
          <Link
            href="/login"
            className="inline-flex min-h-10 min-w-0 flex-1 items-center justify-center rounded-2xl border border-line px-3 py-2 text-center text-sm font-medium leading-5 text-foreground hover:text-brand sm:h-10 sm:flex-none sm:rounded-none sm:border-0 sm:px-2 sm:py-0"
          >
            {t("auth.login")}
          </Link>
          <Link
            href="/register"
            className="inline-flex min-h-10 min-w-0 flex-1 items-center justify-center rounded-2xl bg-brand px-3 py-2 text-center text-sm font-medium leading-5 text-white sm:h-10 sm:flex-none sm:px-4 sm:py-0"
          >
            {t("auth.signup")}
          </Link>
        </nav>
      </div>
    </header>
  );
}

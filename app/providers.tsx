"use client";

import type { ReactNode } from "react";
import { LocaleProvider } from "@/lib/i18n";
import type { AppLocale } from "@/lib/locale";

export function Providers({
  initialLocale,
  children,
}: {
  initialLocale: AppLocale;
  children: ReactNode;
}) {
  return <LocaleProvider initialLocale={initialLocale}>{children}</LocaleProvider>;
}

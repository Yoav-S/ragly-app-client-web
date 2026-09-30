"use client";

import { isLocale, LOCALES, type AppLocale } from "@/lib/locale";
import { useI18n } from "@/lib/i18n";

const LABEL: Record<AppLocale, string> = {
  en: "language_en",
  ro: "language_ro",
  ru: "language_ru",
};

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <label className="relative inline-flex shrink-0">
      <span className="sr-only">{t("language")}</span>
      <select
        value={locale}
        aria-label={t("language")}
        onChange={(event) => {
          const next = event.target.value;
          if (isLocale(next)) setLocale(next);
        }}
        className="h-10 w-32 appearance-none rounded-2xl border border-line bg-surface pe-8 ps-3 text-sm text-foreground outline-none focus:border-brand"
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>
            {t(LABEL[code])}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="pointer-events-none absolute inset-y-0 end-2.5 my-auto h-4 w-4 text-muted"
      >
        <path
          d="M5.5 7.5 10 12l4.5-4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </label>
  );
}

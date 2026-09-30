"use client";

import { useI18n } from "@/lib/i18n";
import { LOCALES, type AppLocale } from "@/lib/locale";

const LABEL: Record<AppLocale, string> = {
  en: "language_en",
  ro: "language_ro",
  ru: "language_ru",
  he: "language_he",
};

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={t("language")}>
      {LOCALES.map((code) => {
        const selected = code === locale;
        return (
          <button
            key={code}
            type="button"
            aria-pressed={selected}
            onClick={() => setLocale(code)}
            className={
              selected
                ? "h-10 rounded-2xl bg-brand px-3 text-sm font-medium text-white"
                : "h-10 rounded-2xl border border-line bg-surface px-3 text-sm text-foreground"
            }
          >
            {t(LABEL[code])}
          </button>
        );
      })}
    </div>
  );
}

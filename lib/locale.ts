export const LOCALES = ["en", "ro", "ru", "he"] as const;
export type AppLocale = (typeof LOCALES)[number];

export function isLocale(value: string | undefined | null): value is AppLocale {
  return LOCALES.includes(value as AppLocale);
}

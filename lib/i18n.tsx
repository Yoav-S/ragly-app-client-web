"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import en from "../locales/en.json";
import he from "../locales/he.json";
import ro from "../locales/ro.json";
import ru from "../locales/ru.json";
import { LOCALES, type AppLocale } from "./locale";

export { LOCALES, type AppLocale };

const catalogs = { en, ro, ru, he };
const RTL: readonly AppLocale[] = ["he"];
const COOKIE = "ragly_locale";

type Vars = Record<string, string | number>;

type LocaleContextValue = {
  locale: AppLocale;
  dir: "rtl" | "ltr";
  setLocale: (locale: AppLocale) => void;
  t: (key: string, vars?: Vars) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function lookup(source: unknown, key: string): string | undefined {
  let current: unknown = source;
  for (const part of key.split(".")) {
    if (!current || typeof current !== "object" || !(part in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

function translate(locale: AppLocale, key: string, vars?: Vars): string {
  const raw = lookup(catalogs[locale], key) ?? lookup(catalogs.en, key) ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name: string) =>
    vars[name] == null ? `{${name}}` : String(vars[name]),
  );
}

function writeLocaleCookie(locale: AppLocale): void {
  document.cookie = `${COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  document.documentElement.lang = locale;
  document.documentElement.dir = RTL.includes(locale) ? "rtl" : "ltr";
}

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: AppLocale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<AppLocale>(initialLocale);

  const value = useMemo<LocaleContextValue>(() => {
    return {
      locale,
      dir: RTL.includes(locale) ? "rtl" : "ltr",
      setLocale: (next) => {
        setLocaleState(next);
        writeLocaleCookie(next);
      },
      t: (key, vars) => translate(locale, key, vars),
    };
  }, [locale]);

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useI18n(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) {
    throw new Error("useI18n must be used inside LocaleProvider");
  }
  return value;
}

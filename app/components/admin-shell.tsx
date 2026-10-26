"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { LanguageSwitcher } from "./language-switcher";
import { apiGet } from "@/lib/api";
import type { BusinessSession } from "@/lib/business";
import { signedInThisTab, signOutAccount } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { auth } from "@/lib/firebase";
import { useI18n } from "@/lib/i18n";

export type AdminTab = "overview" | "businesses" | "users" | "analytics";

export function useAdminSession() {
  const router = useRouter();
  const { t } = useI18n();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!signedInThisTab()) {
      setReady(false);
      router.replace("/login");
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user || !signedInThisTab()) {
        setReady(false);
        router.replace("/login");
        return;
      }
      try {
        const session = await apiGet<BusinessSession>("/businesses/mine", await user.getIdToken());
        if (!session.is_ragly_admin) {
          router.replace("/dashboard");
          return;
        }
        setReady(true);
      } catch (err: unknown) {
        setError(errorMessage(err, t));
      }
    });
    return unsubscribe;
  }, [router, t]);

  return { ready, error };
}

export function AdminShell({
  tab,
  onTab,
  search,
  children,
}: {
  tab: AdminTab;
  onTab: (tab: AdminTab) => void;
  search?: { value: string; onChange: (value: string) => void };
  children: ReactNode;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);

  const tabs: { id: AdminTab; label: string }[] = [
    { id: "overview", label: t("admin.tab_overview") },
    { id: "businesses", label: t("admin.tab_businesses") },
    { id: "users", label: t("admin.tab_users") },
    { id: "analytics", label: t("admin.tab_analytics") },
  ];

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function choose(next: AdminTab) {
    setMenuOpen(false);
    onTab(next);
  }

  return (
    <main className="min-h-full bg-[#F7F8FA]">
      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-[1440px] items-center gap-3 px-4 py-3 sm:px-6 lg:px-10 lg:py-5">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line text-foreground md:hidden"
            aria-label={menuOpen ? t("admin.close_menu") : t("admin.menu")}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            <BurgerIcon open={menuOpen} />
          </button>
          <p className="min-w-0 truncate text-xl font-medium leading-none text-brand sm:text-[28px]">{t("admin.title")}</p>
          <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => choose(item.id)}
                className={
                  tab === item.id
                    ? "inline-flex h-10 items-center rounded-full bg-[#111827] px-5 text-sm font-medium text-white"
                    : "inline-flex h-10 items-center rounded-full px-5 text-sm font-medium text-muted hover:text-foreground"
                }
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-2 sm:gap-3">
            {search ? (
              <label className="relative hidden md:block">
                <span className="sr-only">{t("admin.search")}</span>
                <SearchIcon />
                <input
                  value={search.value}
                  onChange={(event) => search.onChange(event.target.value)}
                  placeholder={t("admin.search")}
                  className="h-10 w-52 rounded-full border border-line bg-background ps-9 pe-4 text-sm text-foreground outline-none focus:border-brand lg:w-72"
                />
              </label>
            ) : null}
            <LanguageSwitcher />
            <button
              type="button"
              onClick={async () => {
                await signOutAccount();
                router.replace("/");
              }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#EEF3F2] text-sm font-medium text-brand"
              aria-label={t("dashboard.sign_out")}
            >
              {(auth.currentUser?.email?.[0] || "A").toUpperCase()}
            </button>
          </div>
        </div>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label={t("admin.close_menu")} onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 start-0 flex w-[min(20rem,86vw)] flex-col bg-surface px-4 py-5 shadow-xl">
            <p className="px-2 text-lg font-medium text-brand">{t("admin.title")}</p>
            <nav className="mt-6 grid gap-1">
              {tabs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => choose(item.id)}
                  className={
                    tab === item.id
                      ? "rounded-2xl bg-[#111827] px-4 py-3 text-start text-sm font-medium text-white"
                      : "rounded-2xl px-4 py-3 text-start text-sm font-medium text-foreground hover:bg-[#F7F8FA]"
                  }
                >
                  {item.label}
                </button>
              ))}
            </nav>
            {search ? (
              <label className="relative mt-6 block">
                <span className="sr-only">{t("admin.search")}</span>
                <SearchIcon />
                <input
                  value={search.value}
                  onChange={(event) => search.onChange(event.target.value)}
                  placeholder={t("admin.search")}
                  className="h-11 w-full rounded-full border border-line bg-background ps-9 pe-4 text-sm text-foreground outline-none focus:border-brand"
                />
              </label>
            ) : null}
          </div>
        </div>
      ) : null}

      {search ? (
        <div className="border-b border-line bg-surface px-4 py-3 md:hidden">
          <label className="relative block">
            <span className="sr-only">{t("admin.search")}</span>
            <SearchIcon />
            <input
              value={search.value}
              onChange={(event) => search.onChange(event.target.value)}
              placeholder={t("admin.search")}
              className="h-11 w-full rounded-full border border-line bg-background ps-9 pe-4 text-sm text-foreground outline-none focus:border-brand"
            />
          </label>
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10">{children}</div>
    </main>
  );
}

function BurgerIcon({ open }: { open: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2">
      {open ? (
        <path d="M6 6 18 18M18 6 6 18" strokeLinecap="round" />
      ) : (
        <>
          <path d="M5 7h14" strokeLinecap="round" />
          <path d="M5 12h14" strokeLinecap="round" />
          <path d="M5 17h14" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 fill-none stroke-muted stroke-2"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" strokeLinecap="round" />
    </svg>
  );
}

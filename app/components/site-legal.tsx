"use client";

import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { useI18n } from "@/lib/i18n";

const PRIVACY = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10", "s11", "s12", "s13", "s14"] as const;
const TERMS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10", "s11", "s12", "s13"] as const;

export function SiteLegal({ kind }: { kind: "privacy" | "terms" }) {
  const { t } = useI18n();
  const sections = kind === "privacy" ? PRIVACY : TERMS;

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-12">
        <h1 className="text-3xl font-medium text-foreground">{t(`siteLegal.${kind}_title`)}</h1>
        <p className="mt-3 text-sm text-muted">{t("siteLegal.updated")}</p>
        <p className="mt-6 text-base leading-7 text-muted">{t(`siteLegal.${kind}_intro`)}</p>
        {sections.map((section) => (
          <section key={section} className="mt-8">
            <h2 className="text-lg font-medium text-foreground">
              {t(`siteLegal.${kind}_${section}_title`)}
            </h2>
            <p className="mt-2 text-base leading-7 text-muted">
              {t(`siteLegal.${kind}_${section}_body`)}
            </p>
          </section>
        ))}
      </main>
      <SiteFooter />
    </div>
  );
}

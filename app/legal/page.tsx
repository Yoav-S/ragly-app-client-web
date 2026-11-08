"use client";

import Link from "next/link";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";
import { useI18n } from "@/lib/i18n";

export default function LegalPage() {
  const { t } = useI18n();

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-12">
        <h1 className="text-3xl font-medium text-foreground">{t("legal.title")}</h1>
        <p className="mt-4 text-base leading-7 text-muted">{t("legal.body")}</p>

        <section className="mt-10 rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h2 className="text-lg font-medium text-foreground">{t("legal.app_title")}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{t("legal.app_body")}</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <a href="/privacy.html" className="font-medium text-brand hover:underline">
                {t("footer.privacy")}
              </a>
            </li>
            <li>
              <a href="/terms.html" className="font-medium text-brand hover:underline">
                {t("footer.terms")}
              </a>
            </li>
            <li>
              <a href="/delete-account.html" className="text-foreground hover:text-brand">
                {t("footer.delete_account")}
              </a>
            </li>
            <li>
              <a href="/delete-data.html" className="text-foreground hover:text-brand">
                {t("footer.delete_data")}
              </a>
            </li>
          </ul>
        </section>

        <section className="mt-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h2 className="text-lg font-medium text-foreground">{t("legal.website_title")}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{t("legal.website_body")}</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link href="/privacy" className="font-medium text-brand hover:underline">
                {t("footer.privacy")}
              </Link>
            </li>
            <li>
              <Link href="/terms" className="font-medium text-brand hover:underline">
                {t("footer.terms")}
              </Link>
            </li>
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

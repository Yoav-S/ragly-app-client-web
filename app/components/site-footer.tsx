"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

const SUPPORT = "support@ragly.cloud";

export function SiteFooter() {
  const { t } = useI18n();

  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <div className="mx-auto grid w-full max-w-5xl gap-8 px-5 py-10 sm:grid-cols-3">
        <div>
          <p className="text-sm font-semibold text-brand">Ragly</p>
          <p className="mt-2 max-w-xs text-sm leading-6 text-muted">{t("footer.tagline")}</p>
          <p className="mt-4 text-xs text-muted">{t("footer.rights")}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{t("footer.contact")}</p>
          <a
            href={`mailto:${SUPPORT}`}
            className="mt-2 inline-block text-sm text-brand underline-offset-2 hover:underline"
          >
            {SUPPORT}
          </a>
          <p className="mt-6 text-sm font-medium text-foreground">{t("footer.website")}</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            <li>
              <Link href="/privacy" className="text-muted hover:text-brand">
                {t("footer.privacy")}
              </Link>
            </li>
            <li>
              <Link href="/terms" className="text-muted hover:text-brand">
                {t("footer.terms")}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{t("footer.app")}</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            <li>
              <a href="/privacy.html" className="text-muted hover:text-brand">
                {t("footer.privacy")}
              </a>
            </li>
            <li>
              <a href="/terms.html" className="text-muted hover:text-brand">
                {t("footer.terms")}
              </a>
            </li>
            <li>
              <a href="/delete-account.html" className="text-muted hover:text-brand">
                {t("footer.delete_account")}
              </a>
            </li>
            <li>
              <a href="/delete-data.html" className="text-muted hover:text-brand">
                {t("footer.delete_data")}
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

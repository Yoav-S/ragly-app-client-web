"use client";

import Link from "next/link";
import { FadeIn } from "./components/fade-in";
import { PaidReviewBanners } from "./components/paid-review-banners";
import { SiteFooter } from "./components/site-footer";
import { SiteHeader } from "./components/site-header";
import { useI18n } from "@/lib/i18n";

const STEPS = ["step1", "step2", "step3"] as const;

export default function Home() {
  const { t } = useI18n();

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-12 sm:py-16">
        <FadeIn>
          <section className="max-w-2xl">
            <p className="text-sm font-medium text-brand">{t("welcome.kicker")}</p>
            <h1 className="mt-3 text-3xl font-medium leading-tight text-foreground sm:text-5xl">
              {t("welcome.title")}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg">
              {t("welcome.body")}
            </p>
          </section>
        </FadeIn>

        <section className="mt-10 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <FadeIn key={step} delay={index * 120} className="h-full">
              <article className="h-full rounded-2xl border border-line bg-surface p-5">
                <h2 className="text-base font-medium text-foreground">
                  {t(`welcome.${step}_title`)}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {t(`welcome.${step}_body`)}
                </p>
              </article>
            </FadeIn>
          ))}
        </section>

        <PaidReviewBanners />

        <FadeIn className="mt-10">
          <section className="max-w-2xl rounded-2xl bg-surface p-6 sm:p-8">
            <h2 className="text-xl font-medium text-foreground">
              {t("welcome.publish_title")}
            </h2>
            <p className="mt-3 max-w-xl text-base leading-7 text-muted">
              {t("welcome.publish_body")}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-brand px-5 text-sm font-medium text-white sm:min-w-40"
              >
                {t("auth.signup")}
              </Link>
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-line bg-surface px-5 text-sm font-medium text-foreground sm:min-w-40"
              >
                {t("auth.login")}
              </Link>
            </div>
          </section>
        </FadeIn>
      </main>
      <FadeIn>
        <SiteFooter />
      </FadeIn>
    </div>
  );
}

"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { apiPostPublic } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";

const SUPPORT = "support@ragly.cloud";
const INSTAGRAM = "https://www.instagram.com/ragly/";

const fieldClass =
  "h-11 w-full rounded-2xl border border-white/20 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/45 focus:border-white";

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
    </svg>
  );
}

function FooterLeadForm() {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || done) return;
    setPending(true);
    setError("");
    try {
      await apiPostPublic("/contact", { name, email, phone, website });
      setDone(true);
    } catch (err: unknown) {
      setError(errorMessage(err, t));
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return <p className="text-sm leading-6 text-white/80">{t("footer.lead_sent")}</p>;
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="grid gap-3">
      <div>
        <p className="text-sm font-medium text-white">{t("footer.lead_title")}</p>
        <p className="mt-1 text-xs leading-5 text-white/70">{t("footer.lead_body")}</p>
      </div>
      <label className="sr-only" htmlFor="footer-name">
        {t("footer.lead_name")}
      </label>
      <input
        id="footer-name"
        className={fieldClass}
        value={name}
        maxLength={80}
        autoComplete="name"
        placeholder={t("footer.lead_name")}
        onChange={(event) => setName(event.target.value)}
      />
      <label className="sr-only" htmlFor="footer-email">
        {t("footer.lead_email")}
      </label>
      <input
        id="footer-email"
        type="email"
        className={fieldClass}
        value={email}
        maxLength={120}
        autoComplete="email"
        placeholder={t("footer.lead_email")}
        onChange={(event) => setEmail(event.target.value)}
      />
      <label className="sr-only" htmlFor="footer-phone">
        {t("footer.lead_phone")}
      </label>
      <input
        id="footer-phone"
        type="tel"
        className={fieldClass}
        value={phone}
        maxLength={32}
        autoComplete="tel"
        placeholder={t("footer.lead_phone")}
        onChange={(event) => setPhone(event.target.value)}
      />
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        value={website}
        onChange={(event) => setWebsite(event.target.value)}
        className="pointer-events-none absolute h-px w-px opacity-0"
      />
      {error ? (
        <p className="text-xs text-[#FECACA]" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center justify-center rounded-2xl bg-white px-5 text-sm font-medium text-brand hover:bg-[#F6F7F9] disabled:cursor-not-allowed disabled:bg-white/70"
      >
        {pending ? t("saving") : t("footer.lead_send")}
      </button>
    </form>
  );
}

export function SiteFooter() {
  const { t } = useI18n();

  return (
    <footer className="mt-auto bg-brand text-white">
      <div className="mx-auto grid w-full max-w-5xl gap-10 px-5 py-10 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 overflow-hidden rounded-lg bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ragly-mark.png" alt="" className="h-8 w-8" />
            </span>
            <p className="text-sm font-semibold text-white">Ragly</p>
          </div>
          <p className="mt-2 max-w-xs text-sm leading-6 text-white/75">{t("footer.tagline")}</p>
          <a
            href={INSTAGRAM}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex text-white hover:text-white/80"
            aria-label={t("footer.instagram")}
          >
            <InstagramIcon />
          </a>
        </div>
        <div className="relative">
          <FooterLeadForm />
          <p className="mt-3 text-xs leading-5 text-white/65">
            {t("footer.lead_or")}{" "}
            <a href={`mailto:${SUPPORT}`} className="text-white underline-offset-2 hover:underline">
              {SUPPORT}
            </a>
          </p>
        </div>
        <div>
          <Link href="/legal" className="text-sm font-medium text-white hover:text-white/80">
            {t("footer.legal")}
          </Link>
          <ul className="mt-2 space-y-1.5 text-sm">
            <li>
              <a href="/delete-account.html" className="text-white/75 hover:text-white">
                {t("footer.delete_account")}
              </a>
            </li>
            <li>
              <a href="/delete-data.html" className="text-white/75 hover:text-white">
                {t("footer.delete_data")}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/15 bg-[#111827]">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-5 py-5 text-xs text-white/70 sm:flex-row sm:items-center sm:justify-between">
          <p>{t("footer.rights")}</p>
          <nav className="flex items-center text-sm text-white/80">
            <Link href="/privacy" className="hover:text-white">
              {t("footer.privacy")}
            </Link>
            <span className="mx-5 select-none" aria-hidden>
              ·
            </span>
            <Link href="/terms" className="hover:text-white">
              {t("footer.terms")}
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}

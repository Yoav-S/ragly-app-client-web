"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { sendOtp, setPendingAuth, type AuthIntent } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "./language-switcher";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthEmailForm({ intent }: { intent: AuthIntent }) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const trimmed = email.trim().toLowerCase();
  const canSubmit = EMAIL_PATTERN.test(trimmed);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || pending) return;
    setPending(true);
    setError("");
    try {
      setPendingAuth(trimmed, intent);
      await sendOtp(trimmed, locale);
      router.push("/verify");
    } catch (err: unknown) {
      setError(errorMessage(err, t));
      if (err instanceof ApiError && err.retryAfterSec) {
        setError(`${errorMessage(err, t)}`);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16">
      <div className="mb-6 flex justify-end">
        <LanguageSwitcher />
      </div>
      <Link href="/" className="text-sm font-medium text-brand">
        {t("back")}
      </Link>
      <h1 className="mt-6 text-3xl font-medium text-foreground">
        {intent === "register" ? t("auth.signup") : t("auth.login")}
      </h1>
      <p className="mt-3 text-base leading-7 text-muted">{t("auth.email_subtitle")}</p>
      <form onSubmit={onSubmit} className="mt-8" noValidate>
        <label className="block text-sm text-muted" htmlFor="email">
          {t("auth.email_label")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          value={email}
          placeholder={t("auth.email_placeholder")}
          onChange={(event) => {
            setEmail(event.target.value);
            if (error) setError("");
          }}
          className="mt-2 h-12 w-full rounded-2xl border border-line bg-surface px-4 text-base text-foreground outline-none focus:border-brand"
        />
        {error ? (
          <p className="mt-3 text-sm text-[#EF4444]" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={!canSubmit || pending}
          className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-brand px-5 text-sm font-medium text-white disabled:bg-[#8DB0AA]"
        >
          {t("continue")}
        </button>
      </form>
    </main>
  );
}

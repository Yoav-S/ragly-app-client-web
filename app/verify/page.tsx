"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  getAuthIntent,
  getPendingEmail,
  resendOtp,
  verifyOtpAndSignIn,
} from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "../components/language-switcher";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SEC = 20;

export default function VerifyPage() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [email, setEmail] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SEC);
  const submitting = useRef(false);

  useEffect(() => {
    const pendingEmail = getPendingEmail();
    if (!pendingEmail) {
      router.replace(`/${getAuthIntent() === "register" ? "register" : "login"}`);
      return;
    }
    setEmail(pendingEmail);
  }, [router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((current) => current - 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function submitCode(code: string) {
    if (!email || code.length !== OTP_LENGTH || submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError("");
    setInfo("");
    try {
      await verifyOtpAndSignIn(email, code);
      router.replace("/dashboard");
    } catch (err: unknown) {
      setError(errorMessage(err, t));
      setPending(false);
      submitting.current = false;
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (otp.length !== OTP_LENGTH) {
      setError(t("errors.otp_length"));
      return;
    }
    void submitCode(otp);
  }

  async function onResend() {
    if (!email || cooldown > 0) return;
    setError("");
    try {
      await resendOtp(email, locale);
      setOtp("");
      setCooldown(RESEND_COOLDOWN_SEC);
      setInfo(t("auth.code_resent"));
    } catch (err: unknown) {
      setError(errorMessage(err, t));
      if (err instanceof ApiError && err.retryAfterSec) {
        setCooldown(err.retryAfterSec);
      }
    }
  }

  if (!email) return null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16">
      <div className="mb-6 flex justify-end">
        <LanguageSwitcher />
      </div>
      <Link
        href={getAuthIntent() === "register" ? "/register" : "/login"}
        className="text-sm font-medium text-brand"
      >
        {t("back")}
      </Link>
      <h1 className="mt-6 text-3xl font-medium text-foreground">{t("verify.title")}</h1>
      <p className="mt-3 text-base leading-7 text-muted">
        {t("verify.sent_to")}{" "}
        <span className="font-medium text-foreground">{email}</span>
      </p>
      <form onSubmit={onSubmit} className="mt-8">
        <input
          name="otp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          pattern="\d{6}"
          maxLength={OTP_LENGTH}
          value={otp}
          aria-label={t("verify.title")}
          onChange={(event) => {
            const next = event.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH);
            setOtp(next);
            if (error) setError("");
            if (next.length === OTP_LENGTH) {
              event.target.blur();
              void submitCode(next);
            }
          }}
          className="h-12 w-full rounded-2xl border border-line bg-surface px-4 text-center text-lg tracking-[0.4em] text-foreground outline-none focus:border-brand"
        />
        <p className="mt-3 text-sm leading-6 text-muted">{t("verify.hint")}</p>
        {info ? <p className="mt-3 text-sm text-foreground">{info}</p> : null}
        {error ? (
          <p className="mt-3 text-sm text-[#EF4444]" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={otp.length !== OTP_LENGTH || pending}
          className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-brand px-5 text-sm font-medium text-white disabled:bg-[#8DB0AA]"
        >
          {t("verify.confirm")}
        </button>
      </form>
      <button
        type="button"
        onClick={onResend}
        disabled={cooldown > 0}
        className="mt-4 text-sm font-medium text-brand disabled:text-muted"
      >
        {cooldown > 0 ? t("verify.resend_in", { n: cooldown }) : t("verify.resend")}
      </button>
    </main>
  );
}

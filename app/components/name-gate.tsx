"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPatch, type UserProfile } from "@/lib/api";
import { signOutAccount } from "@/lib/auth";
import { auth } from "@/lib/firebase";
import { errorMessage } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "./language-switcher";

export function NameGate({ onSaved }: { onSaved: (profile: UserProfile) => void }) {
  const router = useRouter();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const trimmed = name.trim();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user || !trimmed || pending) return;
    setPending(true);
    setError("");
    try {
      const saved = await apiPatch<UserProfile>("/users/me", await user.getIdToken(), {
        name: trimmed,
      });
      onSaved(saved);
    } catch (err: unknown) {
      setError(errorMessage(err, t));
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16">
      <div className="mb-6 flex justify-end">
        <LanguageSwitcher />
      </div>
      <h1 className="text-3xl font-medium text-foreground">{t("dashboard.name_title")}</h1>
      <p className="mt-3 text-base leading-7 text-muted">{t("dashboard.name_body")}</p>
      <form onSubmit={onSubmit} className="mt-8">
        <label className="block text-sm text-muted" htmlFor="account-name">
          {t("dashboard.name_label")}
          <input
            id="account-name"
            required
            autoFocus
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 h-12 w-full rounded-2xl border border-line bg-surface px-4 text-base text-foreground outline-none focus:border-brand"
          />
        </label>
        {error ? (
          <p className="mt-3 text-sm text-[#EF4444]" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={!trimmed || pending}
          className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-brand px-5 text-sm font-medium text-white disabled:bg-[#8DB0AA]"
        >
          {t("dashboard.name_continue")}
        </button>
      </form>
      <button
        type="button"
        onClick={async () => {
          await signOutAccount();
          router.replace("/");
        }}
        className="mt-4 text-sm font-medium text-muted"
      >
        {t("dashboard.sign_out")}
      </button>
    </main>
  );
}

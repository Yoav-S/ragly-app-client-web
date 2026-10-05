"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { NameGate } from "../../components/name-gate";
import { LanguageSwitcher } from "../../components/language-switcher";
import { apiGet, apiPatch, type UserProfile } from "@/lib/api";
import { signOutAccount } from "@/lib/auth";
import { auth } from "@/lib/firebase";
import { errorMessage } from "@/lib/errors";
import { cleanPhone } from "@/lib/contact";
import { uploadAccountPhoto } from "@/lib/storage";
import { useI18n } from "@/lib/i18n";

const fieldClass =
  "mt-2 h-12 w-full rounded-2xl border border-line bg-surface px-4 text-base text-foreground outline-none focus:border-brand";

export default function AccountSettingsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      try {
        const me = await apiGet<UserProfile>("/users/me", await user.getIdToken());
        setProfile(me);
        setName(me.name ?? "");
        setPhone(me.phone ?? "");
        setPhoto(me.photo_url ?? null);
      } catch (err: unknown) {
        setError(errorMessage(err, t));
      } finally {
        setReady(true);
      }
    });
    return unsubscribe;
  }, [router, t]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const user = auth.currentUser;
    const trimmed = name.trim();
    if (!user || !trimmed || pending) return;
    if (phone.trim() && !cleanPhone(phone)) {
      setError(t("business.fix_phone_format"));
      setNotice("");
      return;
    }
    setPending(true);
    setError("");
    setNotice("");
    try {
      const token = await user.getIdToken();
      const photoUrl = file ? await uploadAccountPhoto(file) : photo;
      const saved = await apiPatch<UserProfile>("/users/me", token, {
        name: trimmed,
        phone: cleanPhone(phone),
        photo_url: photoUrl,
      });
      setProfile(saved);
      setPhoto(saved.photo_url ?? null);
      setFile(null);
      setPreview(null);
      setNotice(t("dashboard.account_saved"));
    } catch (err: unknown) {
      setError(errorMessage(err, t));
    } finally {
      setPending(false);
    }
  }

  if (!ready) {
    return <main className="mx-auto w-full max-w-md flex-1 px-5 py-16" />;
  }
  if (profile && !profile.name?.trim()) {
    return (
      <NameGate
        onSaved={(saved) => {
          setProfile(saved);
          setName(saved.name ?? "");
        }}
      />
    );
  }

  const shown = preview || photo;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-12">
      <Link href="/dashboard" className="text-sm font-medium text-brand">
        {t("back")}
      </Link>
      <h1 className="mt-6 text-3xl font-medium text-foreground">{t("dashboard.account_title")}</h1>
      <form onSubmit={onSubmit} className="mt-8 grid gap-5">
        <div className="flex items-center gap-4">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand text-lg font-medium text-white">
              {name.trim().slice(0, 1).toUpperCase()}
            </span>
          )}
          <label className="text-sm font-medium text-brand">
            {t("dashboard.account_photo")}
            <input
              type="file"
              accept="image/*"
              className="mt-2 block text-sm text-muted"
              onChange={(event) => {
                const next = event.target.files?.[0] ?? null;
                setFile(next);
                setPreview(next ? URL.createObjectURL(next) : null);
              }}
            />
          </label>
        </div>
        <label className="block text-sm text-muted">
          {t("dashboard.name_label")}
          <input className={fieldClass} required value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="block text-sm text-muted">
          {t("dashboard.account_phone")}
          <input
            className={fieldClass}
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+972 522 723 686"
          />
          <span className="mt-2 block">{t("business.phone_hint")}</span>
        </label>
        <p className="text-sm text-muted">{profile?.email}</p>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted">{t("language")}</span>
          <LanguageSwitcher />
        </div>
        {notice ? <p className="text-sm text-brand">{notice}</p> : null}
        {error ? (
          <p className="text-sm text-[#EF4444]" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={!name.trim() || pending}
          className="inline-flex h-12 items-center justify-center rounded-2xl bg-brand px-5 text-sm font-medium text-white disabled:bg-[#8DB0AA]"
        >
          {t("dashboard.account_save")}
        </button>
      </form>
      <button
        type="button"
        onClick={async () => {
          await signOutAccount();
          router.replace("/");
        }}
        className="mt-6 text-sm font-medium text-[#EF4444]"
      >
        {t("dashboard.sign_out")}
      </button>
    </main>
  );
}

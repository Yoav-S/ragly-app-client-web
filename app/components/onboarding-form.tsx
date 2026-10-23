"use client";

import { FormEvent, useState } from "react";
import { BusinessDetailsFields, cleanDetails, emptyDetails, type DetailsDraft, type DetailsErrors } from "./business-details-fields";
import { Card, primaryButton, secondaryButton } from "./form-controls";
import { apiPost } from "@/lib/api";
import type { Business } from "@/lib/business";
import { auth } from "@/lib/firebase";
import { errorMessage } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";

/**
 * Step one of a new business: who you are. Creates a draft that is not
 * visible anywhere until the first branch is reviewed.
 */
export function OnboardingForm({ onCreated, onCancel }: { onCreated: (business: Business) => void; onCancel?: () => void }) {
  const { t, locale } = useI18n();
  const [draft, setDraft] = useState<DetailsDraft>(emptyDetails);
  const [errors, setErrors] = useState<DetailsErrors>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [nameBlocked, setNameBlocked] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user || pending || nameBlocked) return;
    const result = cleanDetails(draft, t);
    if (result.errors) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setPending(true);
    setError("");
    try {
      const created = await apiPost<Business>("/businesses", await user.getIdToken(), { ...result.body, locale });
      onCreated(created);
    } catch (err: unknown) {
      setError(errorMessage(err, t));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6">
      <div className="flex items-start gap-4">
        <Step n={1} active />
        <div>
          <h1 className="text-2xl font-medium text-foreground">{t("onboarding.title")}</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">{t("onboarding.body")}</p>
        </div>
      </div>
      <Card>
        <BusinessDetailsFields
          draft={draft}
          onChange={setDraft}
          errors={errors}
          autoFocus
          allowClaim
          onNameBlocked={setNameBlocked}
        />
      </Card>
      <div className="grid gap-3 rounded-2xl bg-[#EEF3F2] px-5 py-4 text-sm text-foreground">
        <div className="flex items-center gap-3">
          <Step n={2} />
          <span>{t("onboarding.next_branch")}</span>
        </div>
        <div className="flex items-center gap-3">
          <Step n={3} />
          <span>{t("onboarding.next_review")}</span>
        </div>
      </div>
      {error ? (
        <p className="text-sm text-[#EF4444]" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="submit" disabled={pending || nameBlocked} className={primaryButton}>
          {pending ? t("saving") : t("onboarding.continue")}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className={secondaryButton}>
            {t("back")}
          </button>
        ) : null}
      </div>
    </form>
  );
}

function Step({ n, active = false }: { n: number; active?: boolean }) {
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
        active ? "bg-brand text-white" : "border border-brand/30 bg-surface text-brand"
      }`}
    >
      {n}
    </span>
  );
}

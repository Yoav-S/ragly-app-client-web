"use client";

import { useEffect, useState } from "react";
import {
  BusinessDetailsFields,
  cleanDetails,
  detailsFromBody,
  emptyDetails,
  type DetailsDraft,
  type DetailsErrors,
  type DetailsSection,
} from "./business-details-fields";
import { Card, primaryButton, secondaryButton } from "./form-controls";
import { apiPatch, apiPost, apiUpload } from "@/lib/api";
import {
  BUSINESS_IMAGE_ACCEPT,
  businessLogo,
  detailsBody,
  isBusinessImage,
  type Business,
  type BusinessDetailsBody,
  type OnboardingStep,
} from "@/lib/business";
import { auth } from "@/lib/firebase";
import { errorMessage } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";

type Step = DetailsSection | "logo";

const STEPS: Step[] = ["name", "description", "logo", "phones", "email", "website", "instagram"];
const OPTIONAL = new Set<Step>(["description", "logo", "phones", "email", "website", "instagram"]);
const AFTER: Record<Step, OnboardingStep> = {
  name: "description",
  description: "logo",
  logo: "phones",
  phones: "email",
  email: "website",
  website: "instagram",
  instagram: "done",
};

function stepIndex(saved?: string | null): number {
  if (!saved || saved === "done") return 0;
  const index = STEPS.indexOf(saved as Step);
  return index >= 0 ? index : 1;
}

/**
 * One field at a time. Name is required and saved immediately so a refresh
 * resumes here. Everything after that can be skipped. The dashboard stays
 * closed until the last step is finished or skipped.
 */
export function OnboardingForm({
  business,
  onChanged,
  onFinished,
}: {
  business?: Business | null;
  onChanged: (business: Business) => void;
  onFinished: (business: Business) => void;
}) {
  const { t, locale } = useI18n();
  const [step, setStep] = useState(() => stepIndex(business?.onboarding_step));
  const [draft, setDraft] = useState<DetailsDraft>(() => (business ? detailsFromBody(detailsBody(business)) : emptyDetails()));
  const [saved, setSaved] = useState<Business | null>(business ?? null);
  const [logoPreview, setLogoPreview] = useState(() => (business ? businessLogo(business) ?? "" : ""));
  const [errors, setErrors] = useState<DetailsErrors>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [nameBlocked, setNameBlocked] = useState(false);

  useEffect(() => {
    if (!business) return;
    setSaved(business);
    setDraft(detailsFromBody(detailsBody(business)));
    setLogoPreview((current) => current || businessLogo(business) || "");
    setStep((current) => (current === 0 && business.onboarding_step ? stepIndex(business.onboarding_step) : current));
  }, [business?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = STEPS[step];
  const last = step === STEPS.length - 1;
  const field = current === "logo" ? null : current;

  function go(next: number) {
    setErrors({});
    setError("");
    setStep(next);
  }

  function validateCurrent(): boolean {
    if (current === "name") {
      if (!draft.name.trim()) {
        setErrors({ name: t("business.fix_name") });
        return false;
      }
      if (nameBlocked) return false;
    }
    const result = cleanDetails(draft, t);
    if (result.errors && field && result.errors[field]) {
      setErrors({ [field]: result.errors[field] });
      return false;
    }
    setErrors({});
    return true;
  }

  async function persist(nextStep: OnboardingStep): Promise<Business | null> {
    const user = auth.currentUser;
    if (!user) return null;
    const result = cleanDetails(draft, t);
    if (result.errors) {
      const first = STEPS.findIndex((item) => item !== "logo" && result.errors?.[item]);
      if (first >= 0) setStep(first);
      setErrors(result.errors);
      return null;
    }
    const token = await user.getIdToken();
    const body: BusinessDetailsBody = { ...result.body, locale, onboarding_step: nextStep };
    const row = saved
      ? await apiPatch<Business>(`/businesses/${saved.id}`, token, body)
      : await apiPost<Business>("/businesses", token, body);
    setSaved(row);
    onChanged(row);
    return row;
  }

  async function advance() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const nextStep = AFTER[current];
      const row = await persist(nextStep);
      if (!row) return;
      if (nextStep === "done") onFinished(row);
      else go(step + 1);
    } catch (err: unknown) {
      setError(errorMessage(err, t));
    } finally {
      setPending(false);
    }
  }

  function onContinue() {
    if (!validateCurrent()) return;
    void advance();
  }

  function onSkip() {
    if (!OPTIONAL.has(current)) return;
    void advance();
  }

  async function pickLogo(file: File | null) {
    if (!file) {
      setLogoPreview(saved ? businessLogo(saved) ?? "" : "");
      setError("");
      return;
    }
    if (!isBusinessImage(file)) {
      setError(t("business.photo_type"));
      return;
    }
    const user = auth.currentUser;
    if (!user || !saved) {
      setLogoPreview(URL.createObjectURL(file));
      return;
    }
    setPending(true);
    setError("");
    try {
      const row = await apiUpload<Business>(`/businesses/${saved.id}/logo`, await user.getIdToken(), file);
      setSaved(row);
      setLogoPreview(businessLogo(row) || URL.createObjectURL(file));
      onChanged(row);
    } catch (err: unknown) {
      setError(errorMessage(err, t));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <p className="text-sm font-medium text-brand">{t("welcome.kicker")}</p>
      <ProgressDots current={step + 1} total={STEPS.length} />
      <h1 className="mt-6 text-3xl font-medium text-foreground">{t("onboarding.title")}</h1>
      <p className="mt-3 text-base leading-7 text-muted">{t(`onboarding.step_${current}`)}</p>

      <Card className="mt-8">
        {current === "logo" ? (
          <LogoStep preview={logoPreview} onPick={(file) => void pickLogo(file)} />
        ) : (
          <BusinessDetailsFields
            key={current}
            draft={draft}
            onChange={setDraft}
            errors={errors}
            autoFocus
            allowClaim={current === "name"}
            onNameBlocked={setNameBlocked}
            show={[current]}
          />
        )}
      </Card>

      {error ? (
        <p className="mt-4 text-sm text-[#EF4444]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          disabled={pending || (current === "name" && nameBlocked)}
          onClick={onContinue}
          className={primaryButton}
        >
          {pending ? t("saving") : last ? t("onboarding.continue") : t("onboarding.next")}
        </button>
        <div className="flex items-center justify-between gap-3">
          {step > 0 ? (
            <button type="button" disabled={pending} onClick={() => go(step - 1)} className={secondaryButton}>
              {t("back")}
            </button>
          ) : (
            <span />
          )}
          {OPTIONAL.has(current) ? (
            <button type="button" disabled={pending} onClick={onSkip} className="text-sm font-medium text-muted">
              {t("onboarding.skip")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div
      className="mt-5 flex items-center justify-center gap-2.5"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
    >
      {Array.from({ length: total }, (_, index) => {
        const active = index + 1 === current;
        return (
          <span
            key={index}
            className={active ? "h-2 w-[18px] rounded-[5px] bg-brand" : "h-2 w-2 rounded-full bg-brand/30"}
          />
        );
      })}
    </div>
  );
}

function LogoStep({ preview, onPick }: { preview: string; onPick: (file: File | null) => void }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-4">
      <p className="text-sm font-medium text-foreground">
        {t("business.logo")}
        <span className="ms-2 text-xs font-normal text-muted">{t("business.optional")}</span>
      </p>
      <div className="flex items-center gap-4">
        {preview ? (
          // Local object URL or the saved logo.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-20 w-20 shrink-0 rounded-2xl object-cover" />
        ) : (
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[#EEF3F2] text-2xl text-brand">
            +
          </span>
        )}
        <div className="grid gap-2">
          <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-2xl border border-line bg-surface px-4 text-sm font-medium text-foreground hover:border-brand">
            {preview ? t("business.change_logo") : t("business.add_logo")}
            <input
              type="file"
              accept={BUSINESS_IMAGE_ACCEPT}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                event.target.value = "";
                onPick(file);
              }}
            />
          </label>
          <p className="text-xs leading-5 text-muted">{t("business.logo_skip_hint")}</p>
        </div>
      </div>
    </div>
  );
}

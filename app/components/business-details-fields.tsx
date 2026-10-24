"use client";

import { useEffect, useRef, useState } from "react";
import { ConfirmModal } from "./confirm-modal";
import { Field, PhoneList, inputClass, textareaClass } from "./form-controls";
import { apiGet } from "@/lib/api";
import type { BusinessDetailsBody, NameCheck } from "@/lib/business";
import { cleanEmail, cleanInstagram, cleanPhone, cleanWebsite } from "@/lib/contact";
import { auth } from "@/lib/firebase";
import { useI18n } from "@/lib/i18n";

const SUPPORT = "support@ragly.cloud";

type NameState = "idle" | "checking" | "free" | "taken" | "claimable";

/** Raw text the form holds before it is cleaned into a request body. */
export type DetailsDraft = {
  name: string;
  phones: string[];
  email: string;
  description: string;
  website: string;
  instagram: string;
};

export type DetailsErrors = Partial<Record<keyof DetailsDraft, string>>;

export function emptyDetails(): DetailsDraft {
  return { name: "", phones: [""], email: "", description: "", website: "", instagram: "" };
}

export function detailsFromBody(body: BusinessDetailsBody): DetailsDraft {
  return {
    name: body.name,
    phones: body.phone.length ? body.phone : [""],
    email: body.email ?? "",
    description: body.description ?? "",
    website: body.website ?? "",
    instagram: body.instagram ?? "",
  };
}

type Translate = (key: string) => string;

/** Validate and clean. Returns the body, or the errors to show. */
export function cleanDetails(
  draft: DetailsDraft,
  t: Translate,
): { body: BusinessDetailsBody; errors: null } | { body: null; errors: DetailsErrors } {
  const errors: DetailsErrors = {};
  const name = draft.name.trim();
  if (!name) errors.name = t("business.fix_name");
  const filled = draft.phones.map((phone) => phone.trim()).filter(Boolean);
  const phones = filled.map((phone) => cleanPhone(phone));
  if (phones.some((phone) => !phone)) errors.phones = t("business.fix_phone_format");
  const emailText = draft.email.trim();
  const email = emailText ? cleanEmail(emailText) : null;
  if (emailText && !email) errors.email = t("business.fix_email");
  const websiteText = draft.website.trim();
  const website = websiteText ? cleanWebsite(websiteText) : null;
  if (websiteText && !website) errors.website = t("business.fix_website");
  const instagramText = draft.instagram.trim();
  const instagram = instagramText ? cleanInstagram(instagramText) : null;
  if (instagramText && !instagram) errors.instagram = t("business.fix_instagram");
  if (Object.keys(errors).length) return { body: null, errors };
  return {
    body: {
      name,
      phone: phones.filter((phone): phone is string => Boolean(phone)),
      email,
      description: draft.description.trim() || null,
      website,
      instagram,
    },
    errors: null,
  };
}

export type DetailsSection = "name" | "phones" | "email" | "description" | "website" | "instagram";

export function BusinessDetailsFields({
  draft,
  onChange,
  errors,
  notes,
  businessId,
  autoFocus,
  allowClaim = false,
  onNameBlocked,
  show,
}: {
  draft: DetailsDraft;
  onChange: (next: DetailsDraft) => void;
  errors: DetailsErrors;
  /** Notes an admin left per field. */
  notes?: Record<string, string>;
  /** Excluded from the name check when editing. */
  businessId?: string | null;
  autoFocus?: boolean;
  /** Owner onboarding: an unowned listing opens Contact us. Admins just see the taken error. */
  allowClaim?: boolean;
  onNameBlocked?: (blocked: boolean) => void;
  /** When set, only these sections render. Used by the one-field onboarding wizard. */
  show?: DetailsSection[];
}) {
  const visible = (section: DetailsSection) => !show || show.includes(section);
  const { t } = useI18n();
  const [nameState, setNameState] = useState<NameState>("idle");
  const [claimOpen, setClaimOpen] = useState(false);
  const checkRef = useRef(0);
  const lastClaimed = useRef("");
  const blockedRef = useRef(onNameBlocked);
  blockedRef.current = onNameBlocked;

  useEffect(() => {
    const name = draft.name.trim();
    if (name.length < 2) {
      setNameState("idle");
      setClaimOpen(false);
      blockedRef.current?.(false);
      return;
    }
    const id = ++checkRef.current;
    setNameState("checking");
    const handle = window.setTimeout(async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const params = new URLSearchParams({ name });
        if (businessId) params.set("business_id", businessId);
        const result = await apiGet<NameCheck>(`/businesses/name-check?${params}`, await user.getIdToken());
        if (id !== checkRef.current) return;
        if (result.available) {
          setNameState("free");
          setClaimOpen(false);
          blockedRef.current?.(false);
          return;
        }
        const claimable = Boolean(allowClaim && result.claimable);
        setNameState(claimable ? "claimable" : "taken");
        blockedRef.current?.(true);
        if (claimable && lastClaimed.current !== name) {
          lastClaimed.current = name;
          setClaimOpen(true);
        }
      } catch {
        if (id === checkRef.current) {
          setNameState("idle");
          blockedRef.current?.(false);
        }
      }
    }, 350);
    return () => window.clearTimeout(handle);
  }, [draft.name, businessId, allowClaim]);

  const takenName = draft.name.trim();
  const nameHint =
    nameState === "free" ? t("onboarding.name_free") : nameState === "claimable" || nameState === "taken" ? undefined : t("onboarding.name_hint");

  function contactUs() {
    const email = auth.currentUser?.email ?? "";
    const subject = t("onboarding.claim_mail_subject", { name: takenName });
    const body = t("onboarding.claim_mail_body", { name: takenName, email });
    window.location.href = `mailto:${SUPPORT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setClaimOpen(false);
  }

  return (
    <div className="grid gap-5">
      {visible("name") ? (
        <div>
          <Field
            label={t("business.name")}
            error={errors.name ?? (nameState === "taken" ? t("errors.business_name_taken") : null)}
            hint={nameHint}
            note={notes?.name}
          >
            <input
              className={inputClass}
              value={draft.name}
              autoFocus={autoFocus}
              maxLength={200}
              placeholder={t("onboarding.name_placeholder")}
              onChange={(event) => onChange({ ...draft, name: event.target.value })}
            />
          </Field>
          {nameState === "claimable" ? (
            <div className="mt-3 rounded-2xl bg-[#EEF3F2] px-4 py-3">
              <p className="text-sm leading-6 text-foreground">{t("onboarding.claim_hint", { name: takenName })}</p>
              <button type="button" onClick={contactUs} className="mt-2 text-sm font-medium text-brand">
                {t("onboarding.claim_contact")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      <ConfirmModal
        open={claimOpen && visible("name")}
        title={t("onboarding.claim_title", { name: takenName })}
        body={t("onboarding.claim_body", { name: takenName })}
        confirmLabel={t("onboarding.claim_contact")}
        cancelLabel={t("onboarding.claim_other")}
        onConfirm={contactUs}
        onCancel={() => setClaimOpen(false)}
      />
      {visible("phones") ? (
        <Field
          label={t("business.phones")}
          optional={t("business.optional")}
          error={errors.phones}
          hint={t("business.phone_skip_hint")}
          note={notes?.phone}
        >
          <div className="mt-2">
            <PhoneList
              phones={draft.phones}
              onChange={(phones) => onChange({ ...draft, phones })}
              addLabel={t("business.add_phone")}
              removeLabel={t("business.remove_phone")}
              placeholder="+373 ..."
            />
          </div>
        </Field>
      ) : null}
      {visible("description") ? (
        <Field
          label={t("business.description")}
          optional={t("business.optional")}
          hint={t("onboarding.description_hint")}
          note={notes?.description}
        >
          <textarea
            className={textareaClass}
            value={draft.description}
            maxLength={2000}
            placeholder={t("onboarding.description_placeholder")}
            onChange={(event) => onChange({ ...draft, description: event.target.value })}
          />
        </Field>
      ) : null}
      {visible("email") ? (
        <Field label={t("business.email")} optional={t("business.optional")} error={errors.email} note={notes?.email}>
          <input
            className={inputClass}
            type="email"
            value={draft.email}
            placeholder="name@email.com"
            onChange={(event) => onChange({ ...draft, email: event.target.value })}
          />
        </Field>
      ) : null}
      {visible("website") ? (
        <Field
          label={t("business.website")}
          optional={t("business.optional")}
          error={errors.website}
          hint={t("business.website_hint")}
          note={notes?.website}
        >
          <input
            className={inputClass}
            value={draft.website}
            placeholder="example.com"
            onChange={(event) => onChange({ ...draft, website: event.target.value })}
          />
        </Field>
      ) : null}
      {visible("instagram") ? (
        <Field
          label={t("business.instagram")}
          optional={t("business.optional")}
          error={errors.instagram}
          hint={t("business.instagram_hint")}
          note={notes?.instagram}
        >
          <input
            className={inputClass}
            value={draft.instagram}
            placeholder="@name"
            onChange={(event) => onChange({ ...draft, instagram: event.target.value })}
          />
        </Field>
      ) : null}
    </div>
  );
}

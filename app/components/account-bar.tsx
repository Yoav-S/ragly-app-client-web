"use client";

import { useRouter } from "next/navigation";
import { signOutAccount } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "./language-switcher";

export function AccountBar({ title }: { title: string }) {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <p className="text-sm font-medium text-brand">{title}</p>
      <div className="flex flex-wrap items-center gap-3">
        <LanguageSwitcher />
        <button
          type="button"
          onClick={async () => {
            await signOutAccount();
            router.replace("/");
          }}
          className="text-sm font-medium text-foreground"
        >
          {t("dashboard.sign_out")}
        </button>
      </div>
    </div>
  );
}

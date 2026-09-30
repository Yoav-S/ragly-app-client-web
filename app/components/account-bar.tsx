"use client";

import { useRouter } from "next/navigation";
import { signOutAccount } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "./language-switcher";

export function AccountBar({ title }: { title: string }) {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-medium text-brand">{title}</p>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
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

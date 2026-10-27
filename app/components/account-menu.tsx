"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { menuItemClass } from "./action-menu";
import { signOutAccount } from "@/lib/auth";
import { auth } from "@/lib/firebase";
import { useI18n } from "@/lib/i18n";

export function AccountMenu({ photoUrl }: { photoUrl?: string | null }) {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const initial = (auth.currentUser?.email?.[0] || "A").toUpperCase();

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("dashboard.account")}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#EEF3F2] text-sm font-medium text-brand"
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </button>
      {open ? (
        <div role="menu" className="absolute end-0 z-50 mt-2 min-w-52 overflow-hidden rounded-2xl border border-line bg-surface py-1 shadow-[0_8px_24px_rgba(31,41,55,0.12)]">
          <Link href="/dashboard/account" role="menuitem" onClick={() => setOpen(false)} className={menuItemClass}>
            {t("dashboard.account")}
          </Link>
          <Link href="/dashboard/account" role="menuitem" onClick={() => setOpen(false)} className={menuItemClass}>
            {t("dashboard.settings")}
          </Link>
          <button
            type="button"
            role="menuitem"
            className={`${menuItemClass} border-t border-line text-[#EF4444] hover:bg-[#FEF2F2]`}
            onClick={async () => {
              setOpen(false);
              await signOutAccount();
              router.replace("/");
            }}
          >
            {t("dashboard.sign_out")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

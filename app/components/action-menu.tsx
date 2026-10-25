"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export const menuItemClass =
  "flex w-full items-center px-4 py-2.5 text-start text-sm text-foreground hover:bg-[#EEF3F2]";

/** One 3-dot control that holds the add / edit / hide actions. */
export function ActionMenu({
  label,
  children,
}: {
  label: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

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
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-surface text-foreground hover:border-brand"
      >
        <span className="flex flex-col items-center gap-1" aria-hidden>
          <span className="h-1 w-1 rounded-full bg-current" />
          <span className="h-1 w-1 rounded-full bg-current" />
          <span className="h-1 w-1 rounded-full bg-current" />
        </span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute end-0 z-20 mt-2 min-w-56 overflow-hidden rounded-2xl border border-line bg-surface py-1 shadow-[0_8px_24px_rgba(31,41,55,0.12)]"
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

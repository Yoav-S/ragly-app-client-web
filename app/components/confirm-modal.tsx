"use client";

export function ConfirmModal({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  pending = false,
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  pending?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md rounded-3xl bg-surface p-6"
      >
        <h2 id="confirm-title" className="text-xl font-medium text-foreground">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted">{body}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className={
              danger
                ? "inline-flex h-11 flex-1 items-center justify-center rounded-2xl bg-[#EF4444] px-4 text-sm font-medium text-white"
                : "inline-flex h-11 flex-1 items-center justify-center rounded-2xl bg-brand px-4 text-sm font-medium text-white"
            }
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl border border-line px-4 text-sm font-medium text-foreground"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

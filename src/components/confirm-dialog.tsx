"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui";

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" for destructive or irreversible actions. */
  tone?: "default" | "danger";
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/**
 * In-app replacement for window.confirm(): `if (!(await confirm({...}))) return;`
 * Built on <dialog>.showModal(), so focus is trapped, Esc cancels and the page
 * behind is inert.
 */
export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return confirm;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);

  const confirm = useCallback<Confirm>(
    (next) =>
      new Promise<boolean>((resolve) => {
        resolveRef.current?.(false); // a newer request replaces an open one
        resolveRef.current = resolve;
        setOptions(next);
      }),
    [],
  );

  // Open once the content for this request has rendered.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (options && dialog && !dialog.open) dialog.showModal();
  }, [options]);

  function close(ok: boolean) {
    resolveRef.current?.(ok);
    resolveRef.current = null;
    dialogRef.current?.close();
    setOptions(null);
  }

  const danger = options?.tone === "danger";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <dialog
        ref={dialogRef}
        aria-labelledby="confirm-title"
        // Esc fires "cancel"; route it through close() so the promise resolves.
        onCancel={(e) => {
          e.preventDefault();
          close(false);
        }}
        // A click on the backdrop lands on the <dialog> element itself.
        onClick={(e) => e.target === e.currentTarget && close(false)}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-stone-200 bg-white p-0 text-stone-900 shadow-xl backdrop:bg-stone-900/40 backdrop:backdrop-blur-[2px] open:animate-[confirm-in_120ms_ease-out]"
      >
        {options && (
          <div className="p-6">
            <div className="flex gap-4">
              <span
                aria-hidden="true"
                className={`flex size-10 shrink-0 items-center justify-center rounded-full text-lg ${
                  danger ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-700"
                }`}
              >
                {danger ? "!" : "?"}
              </span>
              <div className="min-w-0 pt-1.5">
                <h2 id="confirm-title" className="font-semibold">
                  {options.title}
                </h2>
                {options.description && <div className="mt-1.5 text-sm leading-relaxed text-stone-600">{options.description}</div>}
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {/* Enter on a destructive prompt should not delete anything: focus "cancel" there. */}
              <Button variant="secondary" onClick={() => close(false)} autoFocus={danger}>
                {options.cancelLabel ?? "ยกเลิก"}
              </Button>
              <Button variant={danger ? "destructive" : "primary"} onClick={() => close(true)} autoFocus={!danger}>
                {options.confirmLabel ?? "ยืนยัน"}
              </Button>
            </div>
          </div>
        )}
      </dialog>
    </ConfirmContext.Provider>
  );
}

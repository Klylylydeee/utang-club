"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * Native <dialog> shown modally: a bottom sheet on phones, a centred card
 * from `sm` up. Focus trapping, Escape and the top layer come from the
 * browser. When closed it is display:none, so it never blocks taps.
 *
 * Escape and backdrop taps call `onRequestClose` instead of closing
 * directly, so the owner can ask before discarding unsaved input.
 */
export function Sheet(props: {
  open: boolean;
  onRequestClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Pinned to the bottom so the primary action stays reachable above the keyboard. */
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { open } = props;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        props.onRequestClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) props.onRequestClose();
      }}
      className="fixed inset-x-0 top-auto bottom-0 m-0 flex max-h-[92dvh] w-full max-w-none flex-col overflow-hidden rounded-t-xl bg-raised p-0 text-ink shadow-raised backdrop:bg-black/40 backdrop:backdrop-blur-sm not-open:hidden sm:inset-0 sm:m-auto sm:max-h-[85dvh] sm:max-w-lg sm:rounded-[10px]"
    >
      {open && (
        <>
          <header className="flex items-start justify-between gap-3 border-b border-separator px-5 pt-4 pb-3">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-semibold">
                {props.title}
              </h2>
              {props.description && <div className="mt-0.5 text-sm text-ink-secondary">{props.description}</div>}
            </div>
            <button
              type="button"
              onClick={props.onRequestClose}
              aria-label="Close"
              className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-secondary hover:bg-accent-soft hover:text-ink"
            >
              <span aria-hidden="true" className="text-xl leading-none">
                ×
              </span>
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{props.children}</div>
          {props.footer && (
            <footer className="border-t border-separator px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {props.footer}
            </footer>
          )}
        </>
      )}
    </dialog>
  );
}

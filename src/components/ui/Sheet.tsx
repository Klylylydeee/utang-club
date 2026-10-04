"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/** Matches Tailwind's `sm` breakpoint: below it the sheet is full screen. */
const PHONE_QUERY = "(max-width: 639.98px)";

/**
 * Native <dialog> shown modally. On phones it is a full-screen sheet with a
 * fixed height, so nothing collapses (iOS Safari shrinks auto-height flex
 * bodies to nothing) and it is sized to the area above the on-screen
 * keyboard, so fields and the footer button stay reachable while typing.
 * From `sm` up it is a centred card. Focus trapping, Escape and the top
 * layer come from the browser; when closed it is display:none.
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

  // iOS doesn't shrink the layout for the keyboard; fit the sheet to the visible area instead.
  useEffect(() => {
    const dialog = ref.current;
    const viewport = window.visualViewport;
    if (!open || !dialog || !viewport) return;
    const phone = window.matchMedia(PHONE_QUERY);
    const fit = () => {
      if (phone.matches) {
        dialog.style.height = `${viewport.height}px`;
        dialog.style.top = `${viewport.offsetTop}px`;
      } else {
        dialog.style.height = "";
        dialog.style.top = "";
      }
    };
    fit();
    viewport.addEventListener("resize", fit);
    viewport.addEventListener("scroll", fit);
    phone.addEventListener("change", fit);
    return () => {
      viewport.removeEventListener("resize", fit);
      viewport.removeEventListener("scroll", fit);
      phone.removeEventListener("change", fit);
      dialog.style.height = "";
      dialog.style.top = "";
    };
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
      className="fixed inset-x-0 top-0 m-0 flex h-dvh max-h-none w-full max-w-none flex-col overflow-hidden bg-raised p-0 text-ink backdrop:bg-black/40 not-open:hidden sm:inset-0 sm:m-auto sm:h-fit sm:max-h-[85dvh] sm:max-w-lg sm:rounded-[10px] sm:shadow-raised sm:backdrop:backdrop-blur-sm"
    >
      {open && (
        <>
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-separator px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3 sm:pt-4">
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
          {/* flex-auto (not flex-1): a 0% basis collapses in Safari when the height isn't fixed. */}
          <div className="min-h-0 flex-auto overflow-y-auto overscroll-contain px-5 py-4">{props.children}</div>
          {props.footer && (
            <footer className="shrink-0 border-t border-separator bg-raised px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {props.footer}
            </footer>
          )}
        </>
      )}
    </dialog>
  );
}

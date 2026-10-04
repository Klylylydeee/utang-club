"use client";

import { useEffect } from "react";
import { buttonStyles } from "@/components/ui/styles";

/**
 * Print / Save as PDF through the browser's own dialog (HANDOFF.md: a print
 * stylesheet instead of a PDF library). Paper gets the full detail: every
 * card is opened while printing, from this button or Ctrl+P, and the ones
 * that were closed are closed again afterwards.
 */
export function PrintButton() {
  useEffect(() => {
    let opened: HTMLDetailsElement[] = [];
    const expand = () => {
      // Adds to the list: a second beforeprint must not forget the first one's cards.
      const closed = [...document.querySelectorAll<HTMLDetailsElement>("main details:not([open])")];
      for (const details of closed) details.open = true;
      opened = [...opened, ...closed];
    };
    const restore = () => {
      for (const details of opened) details.open = false;
      opened = [];
    };
    window.addEventListener("beforeprint", expand);
    window.addEventListener("afterprint", restore);
    return () => {
      window.removeEventListener("beforeprint", expand);
      window.removeEventListener("afterprint", restore);
    };
  }, []);

  return (
    <button type="button" onClick={() => window.print()} className={buttonStyles.quiet}>
      Print or save PDF
    </button>
  );
}

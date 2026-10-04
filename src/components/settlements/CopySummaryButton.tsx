"use client";

import { useEffect, useRef, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { buttonStyles, inputStyles } from "@/components/ui/styles";

/**
 * Copies the plain-text summary for pasting into a chat. The Clipboard
 * API only exists on HTTPS (and localhost), so on a plain-HTTP LAN
 * address this opens a sheet with the text selected for manual copying.
 */
export function CopySummaryButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    if (manual) textRef.current?.select();
  }, [manual]);

  async function copy() {
    if (window.isSecureContext && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        return;
      } catch {
        // Permission denied: fall through to manual copy.
      }
    }
    setManual(true);
  }

  return (
    <>
      <button type="button" onClick={copy} className={buttonStyles.secondary} aria-live="polite">
        {copied ? (
          <>
            <span aria-hidden="true">✓</span> Copied
          </>
        ) : (
          "Copy summary"
        )}
      </button>
      <Sheet
        open={manual}
        onRequestClose={() => setManual(false)}
        title="Copy summary"
        description="Select the text and copy it, then paste it into your chat."
        footer={
          <button type="button" onClick={() => setManual(false)} className={`${buttonStyles.primary} w-full`}>
            Done
          </button>
        }
      >
        <label htmlFor="summary-text" className="sr-only">
          Summary text
        </label>
        <textarea
          id="summary-text"
          ref={textRef}
          readOnly
          value={text}
          rows={Math.min(14, text.split("\n").length + 1)}
          onFocus={(event) => event.currentTarget.select()}
          className={`${inputStyles} py-3 font-sans leading-relaxed`}
        />
      </Sheet>
    </>
  );
}

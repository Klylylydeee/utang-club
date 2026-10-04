"use client";

import { useEffect, useState } from "react";
import { buttonStyles } from "@/components/ui/styles";

type State =
  | { kind: "idle" }
  | { kind: "working" }
  /** Safari drops the tap's permission to share while the image loads; one more tap shares it. */
  | { kind: "ready"; file: File }
  | { kind: "saved" }
  | { kind: "error"; message: string };

/**
 * Shares the summary image. Where the Web Share API takes files (phones on
 * HTTPS) it opens the share sheet, straight to Messenger or Viber.
 * Elsewhere, including any plain-HTTP LAN address, it downloads the PNG.
 */
export function ShareImageButton({ tabId, tabName }: { tabId: string; tabName: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  useEffect(() => {
    if (state.kind !== "saved") return;
    const timer = window.setTimeout(() => setState({ kind: "idle" }), 2500);
    return () => window.clearTimeout(timer);
  }, [state.kind]);

  async function handleClick() {
    if (state.kind === "ready") {
      await deliver(state.file);
      return;
    }
    setState({ kind: "working" });
    let file: File;
    try {
      file = await fetchImage(tabId);
    } catch {
      setState({ kind: "error", message: "Couldn’t make the image. Check your connection and try again." });
      return;
    }
    await deliver(file);
  }

  async function deliver(file: File) {
    if (canShareFile(file)) {
      try {
        await navigator.share({ files: [file], title: tabName });
        setState({ kind: "idle" });
        return;
      } catch (error) {
        const name = error instanceof DOMException ? error.name : "";
        if (name === "AbortError") return setState({ kind: "idle" });
        if (name === "NotAllowedError") return setState({ kind: "ready", file });
        // Anything else: fall back to a download.
      }
    }
    download(file);
    setState({ kind: "saved" });
  }

  const label =
    state.kind === "working"
      ? "Making image…"
      : state.kind === "ready"
        ? "Tap to share image"
        : state.kind === "saved"
          ? "Image saved"
          : "Share image";

  return (
    <div className="contents">
      <button
        type="button"
        onClick={handleClick}
        disabled={state.kind === "working"}
        aria-live="polite"
        className={state.kind === "ready" ? buttonStyles.primary : buttonStyles.secondary}
      >
        {state.kind === "saved" && <span aria-hidden="true">✓</span>}
        {label}
      </button>
      {state.kind === "error" && (
        <p role="alert" className="basis-full text-[15px] text-negative">
          {state.message}
        </p>
      )}
    </div>
  );
}

async function fetchImage(tabId: string): Promise<File> {
  const response = await fetch(`/tabs/${tabId}/settlements/image`, { cache: "no-store" });
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || !type.startsWith("image/png")) throw new Error(`Image request failed: ${response.status}`);
  const name = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? "utang-club.png";
  return new File([await response.blob()], name, { type: "image/png" });
}

function canShareFile(file: File): boolean {
  return typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser time to start the download before the URL goes away.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

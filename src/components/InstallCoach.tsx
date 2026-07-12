"use client";

import { useEffect, useState } from "react";

/**
 * iOS install coach: Safari on iOS never fires a native install prompt, so we
 * explain Add to Home Screen ourselves.
 */
export default function InstallCoach() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // iPadOS masquerades as a Mac; the touch-point count gives it away.
    const isIOS =
      /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (!isIOS) return;

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    try {
      if (localStorage.getItem("gf-install-coach") === "dismissed") return;
    } catch {
      // Private browsing: show the coach, skip persistence.
    }

    setVisible(true);
  }, []);

  if (!visible) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem("gf-install-coach", "dismissed");
    } catch {
      // localStorage not available
    }
    setVisible(false);
  };

  return (
    <div
      role="note"
      aria-label="Install Studio"
      className="fixed inset-x-4 bottom-24 z-50 rounded-lg border border-line bg-bg p-4 pr-12 shadow-[0_8px_30px_rgba(0,0,0,0.12)] md:hidden"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        Install
      </p>
      <p className="mt-1 text-sm leading-relaxed text-fg/85">
        Put Studio on your Home Screen. Reminders only reach an installed app: tap Share, then Add to Home Screen.
      </p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={handleDismiss}
        className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center font-mono text-muted transition-colors hover:text-fg"
      >
        ✕
      </button>
    </div>
  );
}

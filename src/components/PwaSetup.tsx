"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (push + notification clicks only — no offline
 * caching of financial data). Runs once per load; browsers dedupe re-registration.
 */
export default function PwaSetup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .catch(() => {
        // Push simply won't be available; everything else works.
      });
  }, []);

  return null;
}

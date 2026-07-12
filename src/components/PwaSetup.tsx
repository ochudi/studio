"use client";

import { useEffect } from "react";

/**
 * Runs once per app open, in order: register the service worker (push +
 * notification clicks only — no offline caching of financial data), re-post
 * the live push subscription (iOS rotates and revokes them without ever
 * saying so), and fire the reminder sweep so opening the app is itself a
 * delivery moment. All best-effort; failures cost nothing but push.
 */
export default function PwaSetup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then(async (reg) => {
        if (!("Notification" in window) || Notification.permission !== "granted") return;
        const sub = await reg.pushManager.getSubscription();
        if (!sub) return;
        const json = sub.toJSON();
        await fetch("/api/push/subscriptions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
        });
      })
      .catch(() => {
        // Push simply won't be available; everything else works.
      });

    // Once per tab session, not per navigation — the cron is the mechanism,
    // this is the bonus.
    try {
      if (sessionStorage.getItem("gf-swept")) return;
      sessionStorage.setItem("gf-swept", "1");
    } catch {
      // Private browsing: sweep every load, harmlessly.
    }
    fetch("/api/notifications/sweep", { method: "POST" }).catch(() => {});
  }, []);

  return null;
}

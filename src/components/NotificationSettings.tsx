"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PushDevice } from "@/lib/domain";

/**
 * Per-device push registration with a test button, because a notification
 * pipeline you haven't fired is a rumor. iOS only grants the permission to
 * an installed (Home Screen) app, so the enable button explains itself when
 * the API is missing.
 */

function deviceLabel(): string {
  const ua = navigator.userAgent;
  const device = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Mac/.test(ua)
          ? "Mac"
          : "Desktop";
  const browser = /CriOS|Chrome/.test(ua) ? "Chrome" : /Firefox/.test(ua) ? "Firefox" : "Safari";
  return `${device} · ${browser}`;
}

function base64ToUint8(base64: string): Uint8Array {
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export default function NotificationSettings({ devices }: { devices: PushDevice[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  async function enable() {
    setBusy("enable");
    setNote(null);
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setNote(
          "This browser can't take push. On iPhone, install the app first: Share, then Add to Home Screen."
        );
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setNote("Permission declined. Enable notifications for Studio in system settings, then retry.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        setNote("Push keys aren't configured on the server.");
        return;
      }
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64ToUint8(key) as unknown as BufferSource,
        }));
      const body = sub.toJSON();
      const res = await fetch("/api/push/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: body.endpoint, keys: body.keys, device_label: deviceLabel() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setNote(data?.error ?? "Registering the device failed. Try again.");
        return;
      }
      setNote("This device is in. Send a test to prove the pipe.");
      router.refresh();
    } catch {
      setNote("That didn't work. On iPhone the app must be installed to the Home Screen first.");
    } finally {
      setBusy(null);
    }
  }

  async function test(id?: string) {
    setBusy(id ?? "test");
    setNote(null);
    const res = await fetch("/api/push/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(id ? { id } : {}),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setNote(res?.ok ? "Sent. It should be on the device now." : data?.error ?? "The test didn't send.");
    setBusy(null);
  }

  async function remove(id: string) {
    setBusy(id);
    await fetch("/api/push/subscriptions", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => null);
    setBusy(null);
    setRemoving(null);
    router.refresh();
  }

  const linkClass =
    "font-mono text-[10px] uppercase tracking-[0.16em] text-muted transition-colors hover:text-fg disabled:opacity-40";

  const relFmt = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Africa/Lagos",
  });

  return (
    <div>
      {devices.length === 0 ? (
        <p className="max-w-[52ch] text-fluid-sm leading-relaxed text-muted">
          No devices registered yet. Enable push here on each device you carry; reminders and the
          morning digest land on all of them.
        </p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {devices.map((d) => (
            <li key={d.id} className="group flex items-center justify-between gap-4 px-2 py-3.5">
              <div className="min-w-0">
                <p className="truncate text-fluid-sm">{d.device_label ?? "Unnamed device"}</p>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                  Added {relFmt.format(new Date(d.created_at))}
                  {d.last_used_at ? ` · last push ${relFmt.format(new Date(d.last_used_at))}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <button type="button" disabled={busy !== null} onClick={() => test(d.id)} className={linkClass}>
                  {busy === d.id ? "…" : "Test"}
                </button>
                {removing === d.id ? (
                  <span className="flex items-center gap-3">
                    <button type="button" disabled={busy !== null} onClick={() => remove(d.id)} className={linkClass}>
                      Really remove
                    </button>
                    <button type="button" onClick={() => setRemoving(null)} className={linkClass}>
                      Keep
                    </button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setRemoving(d.id)} className={linkClass}>
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={busy !== null}
          onClick={enable}
          className="inline-flex items-center rounded-full bg-fg px-5 py-2.5 font-mono text-fluid-xs uppercase tracking-[0.18em] text-bg transition-opacity duration-300 hover:opacity-85 disabled:opacity-40"
        >
          {busy === "enable" ? "Enabling" : "Enable on this device"}
        </button>
        {devices.length > 0 && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => test()}
            className="inline-flex items-center rounded-full border border-line px-5 py-2.5 font-mono text-fluid-xs uppercase tracking-[0.18em] text-fg transition-colors duration-300 hover:border-fg disabled:opacity-40"
          >
            Test all
          </button>
        )}
      </div>

      {note && (
        <p role="status" className="mt-4 max-w-[52ch] text-fluid-xs leading-relaxed text-muted">
          {note}
        </p>
      )}
    </div>
  );
}

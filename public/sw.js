/**
 * Push-only service worker. Deliberately no offline caching: a cached shell
 * showing stale financial data is worse than a network round-trip.
 *
 * iOS revokes the subscription after 3 pushes that don't visibly show a
 * notification, so every push event MUST end in showNotification inside
 * event.waitUntil. Payloads use the Declarative Web Push envelope; on
 * iOS 18.4+ the OS displays them without waking this worker, and this
 * handler covers everything else.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { notification: { title: "Greyform Studio", body: event.data?.text() } };
  }
  const n = data.notification || data;
  event.waitUntil(
    self.registration.showNotification(n.title || "Greyform Studio", {
      body: n.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: n.navigate || n.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const win of wins) {
        if ("focus" in win) {
          win.navigate(url);
          return win.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

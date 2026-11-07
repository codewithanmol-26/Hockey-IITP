// Makes the page installable and able to show alerts. Only the app files are cached; /api (the data) is never cached.
const V = "hk-v106",
  SHELL = [
    "./",
    "index.html",
    "favicon.ico",
    "style.css?v=106",
    "app.js?v=106",
    "public.js?v=103",
    "extras.js",
    "help.js",
    "icons.js?v=83",
    "config.js",
    "chat.js?v=84",
    "manifest.json",
    "icons/iitp-hockey-crest.svg",
    "icons/favicon-32.png",
    "icons/icon-192.png",
    "icons/icon-512.png",
    "icons/bot-icon.png",
  ];
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(V)
      .then((c) => c.addAll(SHELL))
      .catch(() => {}),
  );
  self.skipWaiting();
});
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((k) =>
        Promise.all(k.filter((x) => x !== V).map((x) => caches.delete(x))),
      )
      .then(() => self.clients.claim())
      .then(() =>
        self.clients.matchAll({ type: "window" }).then((clients) => {
          clients.forEach((c) =>
            c.postMessage({ type: "SW_UPDATED", version: V }),
          );
        }),
      ),
  ),
);
self.addEventListener("fetch", (e) => {
  const r = e.request,
    u = new URL(r.url);
  if (
    r.method !== "GET" ||
    u.origin !== location.origin ||
    u.pathname.startsWith("/api")
  )
    return;

  // Network first for HTML navigation requests so users always receive latest app shell
  const isNav =
    r.mode === "navigate" ||
    r.destination === "document" ||
    u.pathname === "/" ||
    u.pathname.endsWith("/index.html");
  if (isNav) {
    e.respondWith(
      fetch(r)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(V).then((h) => h.put(r, copy));
          }
          return res;
        })
        .catch(() =>
          caches
            .match(r)
            .then((c) => c || caches.match("index.html") || caches.match("./")),
        ),
    );
    return;
  }

  // Stale-while-revalidate for versioned static assets
  e.respondWith(
    caches.match(r).then((cached) => {
      const net = fetch(r)
        .then((x) => {
          if (x && x.ok) {
            const c = x.clone();
            caches.open(V).then((h) => h.put(r, c));
          }
          return x;
        })
        .catch(() => cached);

      return cached || net;
    }),
  );
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const targetUrl = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((l) => {
        if (l.length) {
          l[0].focus();
          return;
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});

// Push from the server: a playing day was scheduled or cancelled, or new announcement
self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data.json();
  } catch (x) {
    d = { body: e.data ? e.data.text() : "" };
  }
  e.waitUntil(
    self.registration.showNotification(d.title || "🏑 IITP Hockey", {
      body: d.body || "",
      tag: d.tag || "hk-plan",
      renotify: true,
      icon: "icons/icon-192.png",
      badge: "icons/favicon-32.png",
      vibrate: [250, 100, 250, 100, 250],
      data: { url: d.url || "./" },
    }),
  );
});

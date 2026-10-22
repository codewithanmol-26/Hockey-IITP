// Makes the page installable and able to show alerts. Only the app files are cached; /api (the data) is never cached.
const V = "hk-v38",
  SHELL = [
    "./",
    "index.html",
    "style.css",
    "app.js",
    "public.js",
    "extras.js",
    "help.js",
    "icons.js",
    "config.js",
    "chat.js",
    "manifest.json",
    "icons/icon-192.png",
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
      .then(() => self.clients.claim()),
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
  const net = fetch(r).then((x) => {
    if (x.ok) {
      const c = x.clone();
      caches.open(V).then((h) => h.put(r, c));
    }
    return x;
  });
  const slow = new Promise((ok, no) =>
    setTimeout(() => caches.match(r).then((x) => (x ? ok(x) : no())), 3500),
  ); // slow connection: use the saved copy of the app
  e.respondWith(
    Promise.race([net, slow])
      .catch(() => net)
      .catch(() =>
        caches.match(r).then((x) => x || caches.match("index.html")),
      ),
  );
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((l) => (l.length ? l[0].focus() : self.clients.openWindow("./"))),
  );
});

// Push from the server: a playing day was scheduled or cancelled. Plain notification, no custom sound.
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
      data: { url: d.url || "./" },
    }),
  );
});

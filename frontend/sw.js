// Makes the page installable and able to show alerts. Only the app files are cached; /api (the data) is never cached.
const V = "hk-v4",
  SHELL = [
    "./",
    "index.html",
    "style.css",
    "app.js",
    "extra.js",
    "config.js",
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
  e.respondWith(
    fetch(r)
      .then((x) => {
        if (x.ok) {
          const c = x.clone();
          caches.open(V).then((h) => h.put(r, c));
        }
        return x;
      })
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

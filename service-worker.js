const CACHE_NAME = "hagyeom-study-sticker-v30";
const ASSETS = [
  "/",
  "/index.html",
  "/css/styles.css",
  "/js/app.js",
  "/js/family-auth.js",
  "/js/family-chat.js",
  "/js/parent-dashboard.js",
  "/js/reward-store.js",
  "/js/config.js",
  "/manifest.webmanifest",
  "/img/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

function isSupabaseRequest(url) {
  return url.hostname.endsWith(".supabase.co") || url.hostname.endsWith(".supabase.in");
}

function shouldSkipServiceWorker(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith("/api/") || url.pathname === "/js/vendor/supabase-js.js" || isSupabaseRequest(url);
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === "basic") {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;

    if (request.mode === "navigate") {
      const fallback = await cache.match("/index.html");
      if (fallback) return fallback;
    }

    return new Response("Offline and no cached response is available.", {
      status: 503,
      statusText: "Service Unavailable",
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (shouldSkipServiceWorker(event.request)) return;
  event.respondWith(networkFirst(event.request));
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "학습 스티커",
    body: "새 알림이 도착했어요.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    url: "/",
    tag: "study-sticker",
  };

  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (error) {
    console.warn("[service-worker] push payload parse failed:", error);
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: payload.icon || "/icons/icon-192.png",
      badge: payload.badge || "/icons/icon-192.png",
      data: { url: payload.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const sameOriginClient = clientList.find((client) => new URL(client.url).origin === self.location.origin);
      if (sameOriginClient) {
        return sameOriginClient.focus().then(() => sameOriginClient.navigate(targetUrl));
      }
      return clients.openWindow(targetUrl);
    })
  );
});

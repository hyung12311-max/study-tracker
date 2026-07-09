const CACHE_NAME = "hagyeom-study-sticker-v22";
const ASSETS = [
  "/",
  "/index.html",
  "/css/styles.css",
  "/js/app.js",
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
  return url.pathname === "/js/vendor/supabase-js.js" || isSupabaseRequest(url);
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
  if (shouldSkipServiceWorker(event.request)) {
    return;
  }
  event.respondWith(networkFirst(event.request));
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "하겸이가 오늘 학습을 완료했어요!",
    body: "학습 완료 알림이 도착했어요.",
  };

  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (error) {
    console.warn("[service-worker] push payload parse failed:", error);
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag || "study-complete",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/"));
});

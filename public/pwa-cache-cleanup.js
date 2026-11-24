const legacyPrecache = `workbox-precache-v2-${self.registration.scope}`;

self.addEventListener('install', (event) => {
  // Do not leave an existing offline app in control while waiting for an update prompt.
  event.waitUntil(caches.has(legacyPrecache).then(found => found ? self.skipWaiting() : undefined));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.delete(legacyPrecache));
});

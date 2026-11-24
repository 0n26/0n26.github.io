import { mkdir, writeFile } from 'node:fs/promises';

const target = new URL(process.env.GATEWAY_ORIGIN);
if (target.protocol !== 'https:' || !/^gateway\.[a-z0-9-]+\.workers\.dev$/.test(target.hostname)
  || target.href !== `${target.origin}/` || target.port || target.username || target.password) {
  throw new Error('GATEWAY_ORIGIN must be the HTTPS workers.dev origin of gateway');
}

await mkdir('dist', { recursive: true });
await writeFile('dist/index.html', `<!doctype html>
<html lang="ru">
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ночной сеанс переехал</title>
  <h1>Ночной сеанс переехал</h1>
  <p><a id="site" href="${target.href}">Открыть сайт</a></p>
  <script>
    const site = document.getElementById('site');
    site.hash = location.hash;
    location.replace(site.href);
  </script>
</html>
`);
// Replace the old Workbox worker at the same URL so existing installs stop serving the former app offline.
await writeFile('dist/sw.js', `self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil((async () => {
  for (const key of await caches.keys()) {
    if (key.startsWith('workbox-precache-')) await caches.delete(key);
  }
  await self.clients.claim();
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  await Promise.allSettled(windows.map(client => {
    const target = new URL(${JSON.stringify(target.href)});
    target.hash = new URL(client.url).hash;
    return client.navigate(target.href);
  }));
  await self.registration.unregister();
})()));
`);

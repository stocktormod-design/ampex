/* Minimal service worker — registreres i produksjon for PWA-anker.
 * Utvid med workbox/precache når du vil cache statiske assets eller offline-sider.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

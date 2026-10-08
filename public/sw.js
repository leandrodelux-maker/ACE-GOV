/*
 * Endemias GOV — service worker (PWA).
 * Guarda só a "casca" do aplicativo (HTML, JS, CSS, ícones) para abrir sem internet.
 * Nunca intercepta chamadas a outros domínios (Supabase, mapas, IBGE): dados de saúde
 * não são guardados aqui; os registros offline ficam nas filas do próprio app.
 */
const SHELL_CACHE = 'endemias-shell-v1';
const ASSET_CACHE = 'endemias-assets-v1';
const SHELL = ['/', '/index.html', '/manifest.json', '/icon.svg'];
const MAX_ASSETS = 250;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('endemias-') && k !== SHELL_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trimAssets() {
  const cache = await caches.open(ASSET_CACHE);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_ASSETS; i++) await cache.delete(keys[i]);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navegação: rede primeiro (versão publicada mais recente); sem rede, a casca guardada.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(SHELL_CACHE).then((c) => c.put('/index.html', res.clone()));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Pacotes com hash no nome: imutáveis, cache primeiro.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then((hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(ASSET_CACHE).then((c) => c.put(req, copy)).then(trimAssets);
          }
          return res;
        })
      )
    );
    return;
  }

  // Demais arquivos estáticos do próprio domínio: cache com atualização em segundo plano.
  if (SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.match(req).then((hit) => {
        const update = fetch(req).then((res) => {
          if (res.ok) caches.open(SHELL_CACHE).then((c) => c.put(req, res.clone()));
          return res;
        }).catch(() => hit);
        return hit || update;
      })
    );
  }
});

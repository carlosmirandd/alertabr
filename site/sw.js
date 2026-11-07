/* Service worker do alertabr (PWA): abre rápido e funciona sem internet com o último dado salvo.
   - arquivos do site e geometria: cache primeiro, atualiza em segundo plano (stale-while-revalidate)
   - estado.json (dados ao vivo, no R2 ou local): rede primeiro; sem rede, usa a última cópia
   - /api/*: sempre rede (notícias). Para forçar atualização geral, troque o número em VERSAO. */
const VERSAO = "alertabr-v2";
const BASICOS = ["./", "index.html", "style.css", "app.js", "mapa.js", "mapa-gl.js", "cartao.js", "config.js", "ads.js", "sobre.html", "privacidade.html", "pagina.css", "data/noticias.json", "vendor/maplibre-gl.js", "vendor/maplibre-gl.css",
  "data/municipios.json", "data/estados.json", "data/estado.json", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/favicon.svg",
  "fonts/Open Sans Semibold/0-255.pbf", "fonts/Open Sans Semibold/256-511.pbf"];

self.addEventListener("install", (e) => { e.waitUntil(caches.open(VERSAO).then((c) => Promise.all(BASICOS.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });

const chave = (u) => new Request(u.origin + u.pathname); // ignora ?v=... para não acumular cópias
async function redePrimeiro(req, ms) {
  const u = new URL(req.url), c = await caches.open(VERSAO), ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(req, { signal: ctl.signal }); clearTimeout(t); if (r && r.ok) c.put(chave(u), r.clone()); return r; }
  catch (e) { clearTimeout(t); const k = await c.match(chave(u)); if (k) return k; throw e; }
}
async function cacheEAtualiza(req) {
  const c = await caches.open(VERSAO), k = await c.match(req, { ignoreSearch: true });
  const rede = fetch(req).then((r) => { if (r && r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
  return k || (await rede) || Response.error();
}
self.addEventListener("fetch", (e) => {
  const req = e.request; if (req.method !== "GET") return; const u = new URL(req.url);
  if (u.origin === location.origin && u.pathname.startsWith("/api/")) return;
  if (/\/(estado|noticias)\.json$/.test(u.pathname)) { e.respondWith(redePrimeiro(req, 8000)); return; }
  if (u.origin !== location.origin) return;
  if (req.mode === "navigate") { e.respondWith(redePrimeiro(req, 3500).catch(() => caches.match("index.html"))); return; }
  e.respondWith(cacheEAtualiza(req));
});

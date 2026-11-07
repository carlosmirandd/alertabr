// Radar de notícias: busca no Google Notícias (RSS), junta títulos parecidos e devolve poucos itens.
// GET /api/noticias?q=<busca>&dias=3   -> { itens: [{ t, u, f, d, n }] }   (cache de 10 min na borda)
const TEMAS = "(chuva OR alagamento OR enchente OR temporal OR queimada OR incêndio OR \"alerta\" OR \"Defesa Civil\" OR deslizamento OR seca OR \"onda de calor\")";
const dec = (s) => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&(amp|lt|gt|quot|#39|apos);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'" }[e])).trim();
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const tokens = (t) => new Set(norm(t).split(/[^a-z0-9]+/).filter((w) => w.length > 3));
const jac = (a, b) => { let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i || 1); };

export function parse(xml) {
  const out = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1], g = (tag) => { const r = b.match(new RegExp("<" + tag + "[^>]*>([\\s\\S]*?)</" + tag + ">")); return r ? dec(r[1]) : ""; };
    let t = g("title"), f = g("source");
    if (f && t.endsWith(" - " + f)) t = t.slice(0, -(f.length + 3));
    const u = g("link"), d = Date.parse(g("pubDate")) || 0;
    if (t && /^https:\/\//.test(u)) out.push({ t, u, f, d });
  }
  return out;
}
export function agrupa(itens, max = 14) { // títulos com mais de 55% de palavras em comum viram um só (guarda o mais recente + quantas fontes)
  const grupos = [];
  for (const it of itens.sort((a, b) => b.d - a.d)) {
    const tk = tokens(it.t), g = grupos.find((x) => jac(x.tk, tk) > 0.55);
    if (g) { g.n++; if (it.f && !g.fs.has(it.f)) g.fs.add(it.f); } else grupos.push({ ...it, tk, n: 1, fs: new Set(it.f ? [it.f] : []) });
  }
  return grupos.slice(0, max).map(({ tk, fs, ...x }) => ({ ...x, n: Math.max(x.n, fs.size) }));
}

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  let q = (url.searchParams.get("q") || "").replace(/[^\p{L}\p{N}\s"()\-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  const dias = Math.min(14, Math.max(1, parseInt(url.searchParams.get("dias"), 10) || 3));
  if (!q) q = TEMAS;
  const chave = new Request("https://cache.alertabr/noticias?" + new URLSearchParams({ q, dias }));
  const cache = typeof caches !== "undefined" ? caches.default : null;
  if (cache) { const hit = await cache.match(chave); if (hit) return hit; }
  const cab = { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" };
  try {
    const r = await fetch("https://news.google.com/rss/search?" + new URLSearchParams({ q: `${q} when:${dias}d`, hl: "pt-BR", gl: "BR", ceid: "BR:pt-419" }), { headers: { "user-agent": "Mozilla/5.0 (compatible; alertabr/1.0)" } });
    if (!r.ok) throw new Error("fonte " + r.status);
    const resp = new Response(JSON.stringify({ q, itens: agrupa(parse(await r.text())) }), { headers: { ...cab, "cache-control": "public, max-age=300, s-maxage=600" } });
    if (cache) await cache.put(chave, resp.clone());
    return resp;
  } catch (e) {
    return new Response(JSON.stringify({ q, itens: [], erro: String(e.message || e) }), { status: 200, headers: { ...cab, "cache-control": "public, max-age=30" } });
  }
}

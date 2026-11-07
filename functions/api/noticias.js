// Radar de notícias: busca no Google Notícias (RSS), junta títulos parecidos e devolve poucos itens.
// GET /api/noticias?q=<busca>&dias=3   -> { itens: [{ t, u, f, d, n }] }   (cache de 10 min na borda)
import { relevante } from "../../shared/relevancia.mjs";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const TEMAS = "(chuva OR terremoto OR alagamento OR enchente OR temporal OR queimada OR incêndio OR \"alerta\" OR \"Defesa Civil\" OR deslizamento OR seca OR \"onda de calor\")";
const dec = (s) => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&(amp|lt|gt|quot|#39|apos);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'" }[e])).trim();
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const tokens = (t) => new Set(norm(t).split(/[^a-z0-9]+/).filter((w) => w.length > 3));
const jac = (a, b) => { let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i || 1); };

export function parse(xml) {
  const out = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1], g = (tag) => { const r = b.match(new RegExp("<" + tag + "[^>]*>([\\s\\S]*?)</" + tag + ">")); return r ? dec(r[1]) : ""; };
    let t = g("title"), f = g("source") || g("News:Source");
    if (f && t.endsWith(" - " + f)) t = t.slice(0, -(f.length + 3));
    let u = g("link"); const via = /[?&]url=([^&]+)/.exec(u); if (via && /bing\.com\/news\/apiclick/.test(u)) { try { u = decodeURIComponent(via[1]); } catch (e) { /* mantém o link original */ } }
    const d = Date.parse(g("pubDate")) || 0;
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
  // Cada fonte pode recusar pedidos vindos de servidores (o Google responde 503 a vários endereços da Cloudflare): tenta uma, depois a outra.
  const fontes = [
    ["google", () => fetch("https://news.google.com/rss/search?" + new URLSearchParams({ q: `${q} when:${dias}d`, hl: "pt-BR", gl: "BR", ceid: "BR:pt-419" }), { headers: { "user-agent": UA, "accept-language": "pt-BR,pt;q=0.9" } })],
    ["bing", () => fetch("https://www.bing.com/news/search?" + new URLSearchParams({ q, format: "rss", setlang: "pt-BR", cc: "BR", qft: `interval="${dias <= 1 ? 7 : dias <= 7 ? 8 : 9}"` }), { headers: { "user-agent": UA, "accept-language": "pt-BR,pt;q=0.9" } })],
  ];
  const erros = [];
  for (const [nome, busca] of fontes) {
    try {
      const r = await busca(); if (!r.ok) throw new Error(nome + " " + r.status);
      const itens = agrupa(parse(await r.text()).filter((n) => relevante(n.t))); if (!itens.length) throw new Error(nome + " sem itens"); // o buscador traz coisa fora do assunto: passa pelo mesmo filtro dos feeds
      const resp = new Response(JSON.stringify({ q, fonte: nome, itens }), { headers: { ...cab, "cache-control": "public, max-age=300, s-maxage=600" } });
      if (cache) await cache.put(chave, resp.clone());
      return resp;
    } catch (e) { erros.push(String(e.message || e)); }
  }
  return new Response(JSON.stringify({ q, itens: [], erro: erros.join("; ") }), { status: 200, headers: { ...cab, "cache-control": "public, max-age=30" } });
}

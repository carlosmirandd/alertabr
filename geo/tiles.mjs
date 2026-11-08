// Gera os tiles vetoriais do mapa (site/tiles/{z}/{x}/{y}.pbf), o índice leve dos municípios (site/data/mun.json)
// e o contorno do Brasil embutido no index.html (esqueleto enquanto o mapa carrega).
// Entrada: site/data/municipios.json e site/data/estados.json (gerados por geo/build_geo.py).
// Uso: npm run tiles      (precisa de "npm install" uma vez: geojson-vt e vt-pbf são só de build)
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import geojsonvt from "geojson-vt";
import vtpbf from "vt-pbf";

const RAIZ = fileURLToPath(new URL("../site/", import.meta.url));
const ZMAX = 8; // acima disso o MapLibre amplia os tiles do z8 (precisão ~40 m, sobra para limites de município)
const geo = JSON.parse(readFileSync(join(RAIZ, "data/municipios.json"), "utf8"));
const est = JSON.parse(readFileSync(join(RAIZ, "data/estados.json"), "utf8"));
const [K, minx, miny, S] = est.proj, ll = (p) => [(p[0] / S + minx) / K, -(p[1] / S + miny)];

function aneis(d) {
  const out = []; let cur = null, x = 0, y = 0;
  for (const c of d.match(/[Mlz][^Mlz]*/g) || []) {
    const t = c[0]; if (t === "z") { if (cur && cur.length > 2) out.push(cur); cur = null; continue; }
    const v = (c.slice(1).match(/-?\d*\.?\d+/g) || []).map(Number);
    for (let i = 0; i + 1 < v.length; i += 2) { if (t === "M" && i === 0) { x = v[i]; y = v[i + 1]; cur = []; } else { x += v[i]; y += v[i + 1]; } if (cur) cur.push([x, y]); }
  }
  if (cur && cur.length > 2) out.push(cur);
  return out;
}
function linhas(d) {
  const out = []; let cur = null, x = 0, y = 0;
  for (const c of d.match(/[Ml][^Ml]*/g) || []) {
    const t = c[0], v = (c.slice(1).match(/-?\d*\.?\d+/g) || []).map(Number);
    for (let i = 0; i + 1 < v.length; i += 2) { if (t === "M") { x = v[i]; y = v[i + 1]; cur = []; out.push(cur); } else { x += v[i]; y += v[i + 1]; } if (cur) cur.push([x, y]); }
  }
  return out.filter((l) => l.length > 1);
}
const area = (r) => { let a = 0; for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return Math.abs(a) / 2; };
const centro = (r) => { let a = 0, cx = 0, cy = 0; for (let i = 0; i < r.length - 1; i++) { const f = r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; a += f; cx += (r[i][0] + r[i + 1][0]) * f; cy += (r[i][1] + r[i + 1][1]) * f; } return a ? [cx / (3 * a), cy / (3 * a)] : r[0]; };

// --- municípios: polígonos em graus + índice leve ---
const feats = [], B = [], P = [];
geo.d.forEach((d, i) => {
  const rs = aneis(d).map((r) => { const a = r.map(ll); a.push(a[0]); return a; });
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, maior = null, am = -1;
  for (const r of rs) { for (const p of r) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); } const a = area(r); if (a > am) { am = a; maior = r; } }
  feats.push({ type: "Feature", id: geo.c[i], properties: { c: geo.c[i] }, geometry: { type: "MultiPolygon", coordinates: rs.map((r) => [r]) } });
  B.push(Math.floor(x0 * 1e2), Math.floor(y0 * 1e2), Math.ceil(x1 * 1e2), Math.ceil(y1 * 1e2));
  const c = maior ? centro(maior) : [x0, y0]; P.push(Math.round(c[0] * 1e3), Math.round(c[1] * 1e3));
});
const ufLin = linhas(est.linhas || "").map((l) => l.map(ll));
const lab = {}; for (const u of Object.keys(est.lab)) { const p = ll(est.lab[u]); lab[u] = [Math.round(p[0] * 1e4), Math.round(p[1] * 1e4)]; }
writeFileSync(join(RAIZ, "data/mun.json"), JSON.stringify({ c: geo.c, n: geo.n, b: B, p: P, uf: lab }));

// --- tiles ---
const op = { maxZoom: ZMAX, indexMaxZoom: ZMAX, indexMaxPoints: 0, tolerance: 3, extent: 4096, buffer: 64 };
const iMun = geojsonvt({ type: "FeatureCollection", features: feats }, op);
const iUf = geojsonvt({ type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: ufLin } }] }, op);
const dir = join(RAIZ, "tiles"); rmSync(dir, { recursive: true, force: true });
let n = 0, bytes = 0, maior = 0;
const vazio = { features: [] };
for (const { z, x, y } of iMun.tileCoords) {
  const tm = iMun.getTile(z, x, y), tu = iUf.getTile(z, x, y);
  if (!tm || !tm.features.length) continue;
  const buf = Buffer.from(vtpbf.fromGeojsonVt({ mun: tm, uf: tu || vazio }, { version: 2 }));
  const f = join(dir, String(z), String(x), y + ".pbf"); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, buf);
  n++; bytes += buf.length; maior = Math.max(maior, buf.length);
}

// --- contorno do Brasil (Mercator, simplificado) embutido no index.html ---
const merc = (p) => [p[0], -Math.log(Math.tan(Math.PI / 4 + (p[1] * Math.PI) / 360)) * (180 / Math.PI)];
function dp(pts, eps) { // Douglas-Peucker
  if (pts.length < 3) return pts; const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const pilha = [[0, pts.length - 1]];
  while (pilha.length) { const [a, b] = pilha.pop(); const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1; let m = -1, im = 0; for (let i = a + 1; i < b; i++) { const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / L; if (d > m) { m = d; im = i; } } if (m > eps) { keep[im] = 1; pilha.push([a, im], [im, b]); } }
  return pts.filter((_, i) => keep[i]);
}
function emenda(ls) { // junta trechos que se tocam nas pontas em linhas contínuas
  const k = (p) => p[0].toFixed(4) + "," + p[1].toFixed(4), pontas = new Map(), usado = new Set();
  ls.forEach((l, i) => { for (const p of [l[0], l[l.length - 1]]) { const kk = k(p); (pontas.get(kk) || pontas.set(kk, []).get(kk)).push(i); } });
  const out = [];
  for (let i = 0; i < ls.length; i++) {
    if (usado.has(i)) continue; usado.add(i); let cur = ls[i].slice();
    for (let lado = 0; lado < 2; lado++) {
      for (;;) {
        const fim = cur[cur.length - 1], prox = (pontas.get(k(fim)) || []).find((j) => !usado.has(j)); if (prox == null) break;
        usado.add(prox); const l = ls[prox]; cur = cur.concat(k(l[0]) === k(fim) ? l.slice(1) : l.slice().reverse().slice(1));
      }
      cur.reverse();
    }
    out.push(cur);
  }
  return out;
}
const lm = emenda(ufLin).map((l) => dp(l.map(merc), 0.08)).filter((l) => l.length > 1);
let mx0 = 1e9, my0 = 1e9, mx1 = -1e9, my1 = -1e9; for (const l of lm) for (const [x, y] of l) { mx0 = Math.min(mx0, x); mx1 = Math.max(mx1, x); my0 = Math.min(my0, y); my1 = Math.max(my1, y); }
const E = 1000 / (mx1 - mx0), H = Math.round((my1 - my0) * E);
const d = lm.map((l) => "M" + l.map(([x, y]) => Math.round((x - mx0) * E) + " " + Math.round((y - my0) * E)).join(" ")).join("");
const svg = `<svg class="contorno" viewBox="0 0 1000 ${H}" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
const ip = join(RAIZ, "index.html"), html = readFileSync(ip, "utf8");
const re = /<!--contorno-->[\s\S]*?<!--\/contorno-->/;
if (re.test(html)) writeFileSync(ip, html.replace(re, `<!--contorno-->${svg}<!--/contorno-->`));
else console.warn("aviso: marcadores <!--contorno--> não encontrados no index.html");

const kb = (b) => Math.round(b / 1024) + " KB";
console.log(`tiles: ${n} arquivos, ${kb(bytes)} no total, maior ${kb(maior)} | mun.json ${kb(statSync(join(RAIZ, "data/mun.json")).size)} | contorno ${kb(svg.length)}`);
const z = {}; for (const zz of readdirSync(dir)) z[zz] = 0; console.log("níveis:", Object.keys(z).sort((a, b) => a - b).join(","));

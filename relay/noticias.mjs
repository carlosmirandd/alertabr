// Coleta de notícias e eventos para o noticias.json.
//  - lê os feeds de relay/feeds.json (RSS 2.0, Atom e RDF), filtra por assunto (shared/relevancia.mjs),
//    liga cada notícia aos municípios citados e junta títulos parecidos;
//  - eventos de outras instituições: GDACS (ONU/UE: terremotos, ciclones, enchentes, secas, incêndios) e USGS (terremotos), só o que toca o Brasil.
// Guardamos só título + link + nome da fonte. O texto das matérias nunca é copiado.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { baixa } from "./fontes.mjs";
import { relevante, temasDe, sem } from "../shared/relevancia.mjs";

const aqui = (p) => fileURLToPath(new URL(p, import.meta.url));
const GEO = JSON.parse(readFileSync(aqui("../site/data/municipios.json"), "utf8"));
const CFG = JSON.parse(readFileSync(aqui("./feeds.json"), "utf8"));
const DIAS = 7, MAX = 450;

export const UFN = { 11: "RO", 12: "AC", 13: "AM", 14: "RR", 15: "PA", 16: "AP", 17: "TO", 21: "MA", 22: "PI", 23: "CE", 24: "RN", 25: "PB", 26: "PE", 27: "AL", 28: "SE", 29: "BA", 31: "MG", 32: "ES", 33: "RJ", 35: "SP", 41: "PR", 42: "SC", 43: "RS", 50: "MS", 51: "MT", 52: "GO", 53: "DF" };
const ABR = new Map(Object.entries(UFN).map(([c, a]) => [a.toLowerCase(), +c]));
const ESTADOS = [["acre", 12], ["alagoas", 27], ["amapa", 16], ["amazonas", 13], ["bahia", 29], ["ceara", 23], ["distrito federal", 53], ["espirito santo", 32], ["goias", 52], ["maranhao", 21], ["mato grosso do sul", 50], ["mato grosso", 51], ["minas gerais", 31], ["paraiba", 25], ["parana", 41], ["pernambuco", 26], ["piaui", 22], ["rio de janeiro", 33], ["rio grande do norte", 24], ["rio grande do sul", 43], ["rondonia", 11], ["roraima", 14], ["santa catarina", 42], ["sao paulo", 35], ["sergipe", 28], ["tocantins", 17]];
// nomes que também são palavras comuns: só valem com a sigla do estado ao lado (ou em feed regional do mesmo estado, escritos com inicial maiúscula)
const AMBIGUO = new Set("natal salvador vitoria palmas serra formosa uniao esperanca planalto liberdade progresso campos alegre grande nova bonito bom jardim ouro prata mirante cruzeiro palmeiras santos fortaleza guarani mimoso estrela carmo lagoa paz wagner conquista central virginia catarina bandeira florestal montadas cavalcante barra sertao paraibano amapa tocantins goias riacho vila porto".split(" "));

const CAPITAIS = new Set(["natal", "salvador", "vitoria", "palmas", "fortaleza"]); // únicos ambíguos aceitos sem sigla, em feed do próprio estado
const porNome = new Map();
GEO.n.forEach((n, i) => { const k = sem(n).replace(/[^a-z0-9]+/g, " ").trim(); (porNome.get(k) || porNome.set(k, []).get(k)).push(i); });
const ufDe = (i) => Math.floor(GEO.c[i] / 100000);

const tira = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, ""); // tira acento, mantém maiúsculas
const REGIAO = new Set("interior litoral governo regiao sul norte oeste leste cidades municipios grande baixada vale zona estado capital serra agreste".split(" "));
const regiaoAntes = (w, i) => REGIAO.has(w[i - 1]) || (/^(de|do|da|no|na|em)$/.test(w[i - 1] || "") && (REGIAO.has(w[i - 2]) || w[i - 2] === "estado"));
const palavras = (s) => sem(s).replace(/rio grande do (sul|norte)|mato grosso( do sul)?/g, (m) => "#" + m.replace(/ /g, "_")).replace(/[^a-z0-9#_]+/g, " ").trim().split(" ").filter(Boolean);
// Municípios (e estados) citados no texto.
// Lugares citados em UM texto. O estado do feed regional só ajuda a desempatar nomes repetidos; não entra no resultado.
function achaLugares(txt, ufFeed) {
  const txtOrig = txt, w = palavras(txt), norm = " " + w.join(" ") + " ", det = new Set(), ufs = new Set(); if (ufFeed) ufs.add(ufFeed);
  const add = (c) => { ufs.add(c); det.add(c); };
  for (const [n, c] of ESTADOS) if (norm.includes(" " + n + " ")) add(c);
  const FIXO = { "#rio_grande_do_sul": 43, "#rio_grande_do_norte": 24, "#mato_grosso": 51, "#mato_grosso_do_sul": 50 };
  for (const m of norm.matchAll(/ (#[a-z_]+) /g)) if (FIXO[m[1]]) add(FIXO[m[1]]);
  const achados = new Set();
  for (let i = 0; i < w.length; i++) {
    for (let n = Math.min(6, w.length - i); n >= 1; n--) {
      const nome = w.slice(i, i + n).join(" ");
      if (nome.length < 5 || nome.startsWith("#")) continue;
      const cand = porNome.get(nome); if (!cand) continue;
      const sigla = ABR.get(w[i + n]); // "Petrópolis (RJ)", "Petrópolis/RJ"
      let esc = sigla ? cand.filter((x) => ufDe(x) === sigla) : [];
      if (esc.length !== 1) {
        if (AMBIGUO.has(nome)) { // só em feed regional do mesmo estado e escrito com a inicial maiúscula do original
          const c1 = CAPITAIS.has(nome) ? cand.filter((x) => ufFeed && ufDe(x) === ufFeed && txtOrig.includes(GEO.n[x])) : []; esc = c1.length === 1 && n === 1 ? c1 : [];
        } else if (cand.length === 1) esc = cand;
        else { const c2 = cand.filter((x) => ufs.has(ufDe(x))); esc = c2.length === 1 ? c2 : []; }
      }
      // o nome precisa aparecer com a mesma grafia/maiúsculas do original ("23 bezerros" não é Bezerros-PE) e não pode ser "estado de X", "interior de X"
      if (esc.length === 1 && tira(txtOrig).includes(tira(GEO.n[esc[0]])) && !regiaoAntes(w, i)) { achados.add(esc[0]); add(ufDe(esc[0])); i += n - 1; break; }
    }
  }
  return { m: [...achados].slice(0, 4), s: [...det].filter(Boolean) };
}
export function localiza(titulo, resumo, ufFeed = 0) {
  const t = achaLugares(titulo, ufFeed);
  if (t.m.length || t.s.length) return t; // o título manda
  const r = achaLugares(resumo, ufFeed);
  if (r.m.length > 3) return { m: [], s: ufFeed ? [ufFeed] : [] }; // resumo que lista várias cidades (previsão, balanço) não diz de onde é a notícia
  return r.m.length || r.s.length ? r : { m: [], s: ufFeed ? [ufFeed] : [] }; // sem lugar no texto: vale o estado do feed regional
}

const decode = (s) => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }[e]));
const limpa = (s) => decode(decode(s)).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
// RSS 2.0, RDF/RSS 1.0 e Atom.
export function leFeed(xml) {
  const out = [];
  for (const m of xml.matchAll(/<(item|entry)[\s>]([\s\S]*?)<\/\1>/g)) {
    const b = m[2], g = (tag) => { const r = b.match(new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + tag + ">")); return r ? r[1] : ""; };
    let u = limpa(g("link")); if (!u) { const a = b.match(/<link[^>]*href="([^"]+)"/); u = a ? decode(a[1]) : ""; }
    const d = Date.parse(limpa(g("pubDate") || g("dc:date") || g("published") || g("updated"))) || 0;
    const t = limpa(g("title")), r = limpa(g("description") || g("summary") || g("content:encoded") || g("content")).slice(0, 400);
    if (t && /^https?:\/\//.test(u)) out.push({ t, u, d, r });
  }
  return out;
}

const toks = (t) => new Set(sem(t).split(/[^a-z0-9]+/).filter((w) => w.length > 3));
const jac = (a, b) => { let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i || 1); };

async function umFeed(f) {
  const xml = await baixa(f.url, "text", 2, 20000);
  const lim = Date.now() - DIAS * 864e5, out = [];
  for (const it of leFeed(xml)) {
    if (it.d && it.d < lim) continue;
    const pv = /^previsao do tempo (hoje |para )/.test(sem(it.t)); // previsão diária de uma cidade (g1 publica ~45 por dia): só aparece na própria cidade e só a mais recente
    if (pv && (!it.d || Date.now() - it.d > 30 * 36e5)) continue;
    if (!f.semFiltro && !pv && !relevante(it.t, it.r)) continue;
    const tm = temasDe(it.t, it.r), loc = localiza(it.t, it.r, f.uf || 0);
    out.push({ t: it.t.slice(0, 170), u: it.u, f: f.nome, d: it.d || Date.now(), tm: tm.length ? tm : ["geral"], m: loc.m, s: loc.s, ...(f.oficial ? { o: 1 } : {}), ...(pv ? { pv: 1 } : {}) });
  }
  return out;
}

// ---------- outras instituições ----------
const TIPO = { EQ: ["Terremoto", "outros"], TC: ["Ciclone tropical", "outros"], FL: ["Inundação", "chuva"], DR: ["Seca", "calor"], WF: ["Incêndio florestal", "fogo"], VO: ["Vulcão", "outros"], TS: ["Tsunami", "outros"] };
const NIVEL = { green: 1, orange: 2, red: 3 }, NIVEL_PT = ["", "verde", "laranja", "vermelho"];
async function gdacs() {
  const xml = await baixa("https://www.gdacs.org/xml/rss.xml", "text", 2, 30000), out = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1], g = (tag) => { const r = b.match(new RegExp("<" + tag + "[^>]*>([\\s\\S]*?)</" + tag + ">")); return r ? limpa(r[1]) : ""; };
    if (!/brazil|brasil/i.test(g("gdacs:country"))) continue;
    const tipo = TIPO[g("gdacs:eventtype")]; if (!tipo) continue;
    const nv = NIVEL[g("gdacs:alertlevel").toLowerCase()] || 1, d = Date.parse(g("gdacs:fromdate")) || Date.parse(g("pubDate")) || 0;
    if (Date.now() - d > 14 * 864e5 || g("gdacs:iscurrent") === "false") continue;
    const mag = /Magnitude\s*([\d.]+)/.exec(g("title"));
    out.push({ t: `${tipo[0]} no Brasil${mag ? " · magnitude " + mag[1] : ""} · alerta ${NIVEL_PT[nv]}`, u: g("link").replace(/^http:/, "https:"), f: "GDACS (ONU/UE)", d, tm: [tipo[1], "outros"], nv, e: 1 });
  }
  return out;
}
async function usgs() {
  const ini = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const j = await baixa(`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${ini}&minlatitude=-34&maxlatitude=6&minlongitude=-75&maxlongitude=-32&minmagnitude=2.5&orderby=time&limit=60`, "json", 2, 25000);
  return (j.features || []).filter((x) => /brazil|brasil/i.test(x.properties.place || "")).map((x) => {
    const p = x.properties, mag = p.mag || 0;
    return { t: `Terremoto de magnitude ${mag.toFixed(1)} · ${String(p.place).replace(/Brazil/i, "Brasil")}`, u: String(p.url).replace(/^http:/, "https:"), f: "USGS", d: p.time, tm: ["outros"], nv: mag >= 5 ? 3 : mag >= 4 ? 2 : 1, e: 1 };
  });
}

export async function coletaNoticias(previo = null) {
  const feeds = CFG.feeds.filter((f) => f.ativo !== false), fontes = {}, todas = [];
  const rs = await Promise.allSettled(feeds.map(umFeed));
  rs.forEach((r, i) => {
    const f = feeds[i];
    if (r.status === "fulfilled") { fontes[f.id] = { ok: true, n: r.value.length }; todas.push(...r.value); }
    else fontes[f.id] = { ok: false, erro: String(r.reason && r.reason.message).slice(0, 80) };
  });
  // feed que caiu: mantém o que ele tinha no arquivo anterior (evita a lista piscar por uma falha de 5 minutos)
  if (previo && Array.isArray(previo.itens)) {
    const nomeDe = new Map(feeds.map((f) => [f.nome, f.id])), caidos = new Set(Object.keys(fontes).filter((k) => !fontes[k].ok));
    for (const it of previo.itens) { const id = nomeDe.get(it.f); if (id && caidos.has(id) && Date.now() - it.d < DIAS * 864e5) todas.push(it); }
  }
  // junta a mesma URL e títulos muito parecidos (guarda o oficial/mais recente e conta as fontes)
  const porUrl = new Map(); for (const it of todas) if (!porUrl.has(it.u)) porUrl.set(it.u, it);
  const grupos = [];
  for (const it of [...porUrl.values()].sort((a, b) => (b.o || 0) - (a.o || 0) || b.d - a.d)) {
    const tk = toks(it.t), mesmo = (a, b) => a.length === b.length && a.every((x) => b.includes(x)), g = grupos.find((x) => jac(x.tk, tk) > 0.55 && mesmo(x.m, it.m) && mesmo(x.s, it.s)); // só junta títulos parecidos que falam dos MESMOS lugares
    if (g) g.n++; else grupos.push({ ...it, tk, n: 1 });
  }
  const itens = grupos.sort((a, b) => b.d - a.d).slice(0, MAX).map(({ tk, ...x }) => x);
  const ev = await Promise.allSettled([gdacs(), usgs()]);
  fontes.gdacs = ev[0].status === "fulfilled" ? { ok: true, n: ev[0].value.length } : { ok: false, erro: String(ev[0].reason && ev[0].reason.message).slice(0, 80) };
  fontes.usgs = ev[1].status === "fulfilled" ? { ok: true, n: ev[1].value.length } : { ok: false, erro: String(ev[1].reason && ev[1].reason.message).slice(0, 80) };
  let eventos = ev.flatMap((x) => (x.status === "fulfilled" ? x.value : [])).sort((a, b) => b.nv - a.nv || b.d - a.d).slice(0, 30);
  if (previo && Array.isArray(previo.eventos)) { // evento de fonte que caiu continua por até 14 dias
    const caiu = (f) => (f === "USGS" && !fontes.usgs.ok) || (f === "GDACS (ONU/UE)" && !fontes.gdacs.ok);
    eventos = eventos.concat(previo.eventos.filter((e) => caiu(e.f) && Date.now() - e.d < 14 * 864e5));
  }
  return { v: 1, gerado: Date.now(), fontes, itens, eventos };
}

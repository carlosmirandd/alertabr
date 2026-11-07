#!/usr/bin/env node
// Relay do alertabr: lê INMET + INPE, monta estado.json e publica.
//   node relay/relay.mjs --uma --out site/data     gera o arquivo uma vez, em disco (teste / dado inicial do site)
//   node relay/relay.mjs                             loop: a cada 5 min envia para o R2 (precisa do wrangler logado)
// Variáveis: BUCKET (padrão "alertabr"), CHAVE (padrão "estado.json"), INTERVALO (segundos, padrão 300)
import { execFile } from "node:child_process";
import { writeFileSync, mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { monta } from "./monta.mjs";
import { coletaNoticias } from "./noticias.mjs";

const arg = (n) => { const i = process.argv.indexOf(n); return i < 0 ? null : (process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : true); };
const UMA = !!arg("--uma"), OUT = arg("--out");
const BUCKET = process.env.BUCKET || "alertabr", CHAVE = process.env.CHAVE || "estado.json";
const INTERVALO = Math.max(60, +process.env.INTERVALO || 300) * 1000;
const hora = () => new Date().toLocaleTimeString("pt-BR");

const q = (a) => '"' + String(a).replace(/"/g, '\\"') + '"';
const run = (args) => new Promise((res) => execFile("npx", ["wrangler", ...args].map(q), { shell: true }, (err, so, se) => res({ err, saida: String(so) + String(se) })));
async function publica(corpo, chave = CHAVE) {
  const txt = JSON.stringify(corpo);
  if (OUT) { mkdirSync(OUT, { recursive: true }); writeFileSync(join(OUT, chave), txt); return; }
  const arq = join(mkdtempSync(join(tmpdir(), "alertabr-")), chave); writeFileSync(arq, txt);
  const base = ["r2", "object", "put", `${BUCKET}/${chave}`, "--file", arq, "--content-type", "application/json; charset=utf-8", "--cache-control", chave === CHAVE ? "public, max-age=15, s-maxage=15, stale-while-revalidate=60, stale-if-error=600" : "public, max-age=60, s-maxage=60, stale-while-revalidate=300, stale-if-error=1800"];
  let r = await run([...base, "--remote"]);
  if (r.err && /unknown argument/i.test(r.saida)) r = await run(base);
  if (r.err) throw new Error(r.saida.slice(-300));
}

let memNoticias = null;
async function ciclo() {
  let previo = null;
  if (UMA && process.env.PREVIO) { try { previo = await (await fetch(process.env.PREVIO, { signal: AbortSignal.timeout(15000) })).json(); } catch (e) { /* sem arquivo anterior */ } }
  const c = await monta(previo);
  await publica(c);
  const f = c.fontes;
  // notícias e eventos: se falhar, o estado.json (mais importante) já foi publicado e o site usa a busca como reserva
  try {
    let pn = null;
    if (process.env.PREVIO_NOTICIAS || (UMA && process.env.PREVIO)) { try { pn = await (await fetch(process.env.PREVIO_NOTICIAS || process.env.PREVIO.replace(/estado\.json(\?.*)?$/, "noticias.json"), { signal: AbortSignal.timeout(15000) })).json(); } catch (e) { /* sem arquivo anterior */ } }
    const n = await coletaNoticias(pn || memNoticias);
    memNoticias = n; await publica(n, "noticias.json");
    const ok = Object.values(n.fontes).filter((x) => x.ok).length;
    console.log(`${hora()} notícias: ${n.itens.length} itens, ${n.eventos.length} eventos | fontes ok ${ok}/${Object.keys(n.fontes).length}`);
  } catch (e) { console.log(`${hora()} notícias: ERRO ${String(e.message || e).slice(0, 200)}`); }
  console.log(`${hora()} ok | alertas hoje: ${c.resumo.alertas} | focos 24h: ${c.resumo.focos} | INMET ${f.inmet.ok ? "ok" : "FALHOU"} | INPE ${f.inpe.ok ? "ok" : "FALHOU"}${OUT ? " -> " + OUT : ""}`);
  return c;
}
if (UMA) { try { await ciclo(); } catch (e) { console.error("ERRO:", e.message); process.exit(1); } process.exit(0); }
console.log(`alertabr relay: publicando em r2://${BUCKET}/${CHAVE} a cada ${INTERVALO / 1000} s. Ctrl+C para parar.`);
for (;;) {
  const t0 = Date.now();
  try { await ciclo(); } catch (e) { console.log(`${hora()} ERRO: ${String(e.message || e).replace(/\s+/g, " ").slice(0, 300)}`); }
  await new Promise((r) => setTimeout(r, Math.max(5000, INTERVALO - (Date.now() - t0))));
}

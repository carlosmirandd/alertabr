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

const arg = (n) => { const i = process.argv.indexOf(n); return i < 0 ? null : (process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : true); };
const UMA = !!arg("--uma"), OUT = arg("--out");
const BUCKET = process.env.BUCKET || "alertabr", CHAVE = process.env.CHAVE || "estado.json";
const INTERVALO = Math.max(60, +process.env.INTERVALO || 300) * 1000;
const hora = () => new Date().toLocaleTimeString("pt-BR");

const q = (a) => '"' + String(a).replace(/"/g, '\\"') + '"';
const run = (args) => new Promise((res) => execFile("npx", ["wrangler", ...args].map(q), { shell: true }, (err, so, se) => res({ err, saida: String(so) + String(se) })));
async function publica(corpo) {
  const txt = JSON.stringify(corpo);
  if (OUT) { mkdirSync(OUT, { recursive: true }); writeFileSync(join(OUT, "estado.json"), txt); return; }
  const arq = join(mkdtempSync(join(tmpdir(), "alertabr-")), "estado.json"); writeFileSync(arq, txt);
  const base = ["r2", "object", "put", `${BUCKET}/${CHAVE}`, "--file", arq, "--content-type", "application/json; charset=utf-8", "--cache-control", "public, max-age=30"];
  let r = await run([...base, "--remote"]);
  if (r.err && /unknown argument/i.test(r.saida)) r = await run(base);
  if (r.err) throw new Error(r.saida.slice(-300));
}

async function ciclo() {
  let previo = null;
  if (UMA && process.env.PREVIO) { try { previo = await (await fetch(process.env.PREVIO, { signal: AbortSignal.timeout(15000) })).json(); } catch (e) { /* sem arquivo anterior */ } }
  const c = await monta(previo);
  await publica(c);
  const f = c.fontes;
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

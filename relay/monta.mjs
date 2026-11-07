// Junta as fontes em UM arquivo compacto (estado.json) que o site lê.
// Os vetores s e f seguem a ORDEM de site/data/municipios.json (5.570 posições): o navegador não precisa de nomes nem de códigos.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { inmet, inpe } from "./fontes.mjs";

const GEO = JSON.parse(readFileSync(fileURLToPath(new URL("../site/data/municipios.json", import.meta.url)), "utf8"));
const IDX = new Map(GEO.c.map((c, i) => [c, i]));
export const TOTAL = GEO.c.length;
const ant = { inmet: null, inpe: null }; // último resultado bom de cada fonte: se uma cair, o site continua mostrando o que tinha

export async function monta(previo = null) {
  const fontes = {}, agora = Date.now();
  const [a, f] = await Promise.allSettled([inmet(), inpe(agora)]);
  if (a.status === "fulfilled") { ant.inmet = a.value; fontes.inmet = { ok: true, t: agora }; }
  else fontes.inmet = { ok: false, t: ant.inmet ? ant.inmet._t || 0 : 0, erro: String(a.reason && a.reason.message).slice(0, 120) };
  if (f.status === "fulfilled") { ant.inpe = f.value; fontes.inpe = { ok: true, t: agora }; }
  else fontes.inpe = { ok: false, erro: String(f.reason && f.reason.message).slice(0, 120) };
  if (!ant.inmet && !ant.inpe) throw new Error("nenhuma fonte respondeu");

  const avisos = (ant.inmet || []).slice().sort((x, y) => y.sev - x.sev || y.g.length - x.g.length);
  const s = new Array(TOTAL).fill(0), m = {}, alertas = [];
  avisos.forEach((x, k) => {
    const idxs = x.g.map((c) => IDX.get(c)).filter((i) => i != null);
    if (!idxs.length) return;
    const pos = alertas.length;
    alertas.push({ id: x.id, t: x.t, sev: x.sev, cor: x.cor, ini: x.ini, fim: x.fim, uf: x.uf, h: x.h, r: x.r, i: x.i, n: idxs.length });
    for (const i of idxs) { if (x.h === 0 && x.sev > s[i]) s[i] = x.sev; (m[i] || (m[i] = [])).push(pos); }
  });

  const f24 = new Array(TOTAL).fill(0), frp = {};
  let focos = 0;
  if (ant.inpe) for (const [cod, o] of ant.inpe.por) { const i = IDX.get(cod); if (i == null) continue; f24[i] = o.n; focos += o.n; if (o.frp) frp[i] = Math.round(o.frp); }

  const r = { v: 1, gerado: agora, fontes, resumo: { focos, alertas: alertas.filter((x) => x.h === 0).length }, alertas, s, f: f24, frp, m };
  // Execução única (ex.: GitHub Actions) não guarda memória: se uma fonte caiu, reaproveita essa parte do arquivo anterior.
  if (previo && previo.v === 1 && previo.s && previo.s.length === TOTAL) {
    if (!ant.inmet) { r.alertas = previo.alertas; r.s = previo.s; r.m = previo.m; r.resumo.alertas = previo.resumo.alertas; fontes.inmet.reaproveitado = true; }
    if (!ant.inpe) { r.f = previo.f; r.frp = previo.frp; r.resumo.focos = previo.resumo.focos; fontes.inpe.reaproveitado = true; }
  }
  return r;
}

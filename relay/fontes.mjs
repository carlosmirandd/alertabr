// Fontes oficiais lidas pelo relay. Todas são públicas e sem chave.
//  - INMET: avisos meteorológicos ativos (chuva, tempestade, calor, baixa umidade, ventos...)
//  - INPE: focos de calor detectados por satélite (CSV diário do Programa Queimadas)
export const UA = "alertabr/1.0 (+https://github.com/carlosmirandd/alertabr)";
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export async function baixa(url, tipo = "json", tentativas = 3, limite = 25000) {
  let ultimo;
  for (let t = 0; t < tentativas; t++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": UA, accept: "*/*" }, signal: AbortSignal.timeout(limite) });
      if (r.status === 404) { const e = new Error("404 " + url); e.naoExiste = true; throw e; }
      if (r.ok) return tipo === "json" ? await r.json() : await r.text();
      ultimo = new Error(r.status + " " + url);
    } catch (e) { if (e.naoExiste) throw e; ultimo = e; }
    await espera(800 * (t + 1) + Math.random() * 400); // 429/5xx: espera e tenta de novo
  }
  throw ultimo;
}

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const SEV = { "perigo potencial": 1, perigo: 2, "grande perigo": 3 };

// ---------- INMET ----------
export async function inmet() {
  const j = await baixa("https://apiprevmet3.inmet.gov.br/avisos/ativos", "json");
  const mapa = new Map();
  for (const [h, lista] of [[0, j.hoje || []], [1, j.futuro || []]]) {
    for (const a of lista) {
      if (a.encerrado) continue;
      const geo = String(a.geocodes || "").split(",").map((x) => parseInt(x, 10)).filter(Boolean);
      if (!geo.length) continue;
      const id = a.id_aviso, ant = mapa.get(id + ":" + h);
      if (ant && ant.seq >= (a.id_sequencia || 0)) continue; // fica com a versão mais nova do aviso
      mapa.set(id + ":" + h, {
        seq: a.id_sequencia || 0, id, h, t: String(a.descricao || "Aviso").trim(),
        sev: SEV[norm(a.severidade)] || 1, cor: a.aviso_cor || "#FFD60A",
        ini: a.inicio || "", fim: a.fim || "", uf: String(a.estados || "").trim(),
        r: (a.riscos || []).slice(0, 3), i: (a.instrucoes || []).slice(0, 3), g: geo,
      });
    }
  }
  return [...mapa.values()].map(({ seq, ...x }) => x);
}

// ---------- INPE ----------
const dia = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
const urlFocos = (d) => `https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/diario/Brasil/focos_diario_br_${dia(d)}.csv`;

// Conta os focos das últimas 24 h por município (código IBGE). Junta o arquivo de hoje e o de ontem (UTC).
export async function inpe(agora = Date.now()) {
  const corte = agora - 24 * 3600 * 1000, por = new Map();
  let total = 0, lidos = 0;
  for (const d of [new Date(agora), new Date(agora - 86400000)]) {
    let txt;
    try { txt = await baixa(urlFocos(d), "text", 3, 90000); } catch (e) { if (e.naoExiste) continue; throw e; }
    lidos++;
    const linhas = txt.split("\n"), cab = linhas[0].trim().split(",");
    const iT = cab.indexOf("data_hora_gmt"), iM = cab.indexOf("municipio_id"), iF = cab.indexOf("frp");
    if (iT < 0 || iM < 0) throw new Error("INPE: formato do CSV mudou");
    for (let k = 1; k < linhas.length; k++) {
      const c = linhas[k].split(","); if (c.length < cab.length - 1) continue;
      const t = Date.parse(c[iT].replace(" ", "T") + "Z"); if (!(t >= corte && t <= agora + 3600000)) continue;
      const m = parseInt(c[iM], 10); if (!m) continue;
      const o = por.get(m) || { n: 0, frp: 0 }; o.n++; o.frp += parseFloat(c[iF]) || 0; por.set(m, o); total++;
    }
  }
  if (!lidos) throw new Error("INPE: nenhum arquivo disponível");
  return { por, total };
}

// Previsão do tempo de um ponto (o centro do município), resumida para o cartão do site.
// GET /api/tempo?lat=-22.9&lon=-43.2&tz=-3  ->  { atual, agora: { temp, cod, tipo, txt, noite, chuva, vento, umid }, dias: [{ d, min, max, chuva, cod, tipo, txt }] }
// Fonte: MET Norway Locationforecast 2.0 (api.met.no), dados CC BY 4.0. Os termos pedem User-Agent identificado, no máximo 4 casas
// decimais nas coordenadas e respeito ao cache: por isso o navegador nunca chama a API deles direto, só esta função (cache de 30 min na borda).
const UA = "alertabr/1.0 https://github.com/carlosmirandd/alertabr";
const CAB = { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" };

// símbolo do MET Norway -> cena do cartão + texto em português
const BASE = {
  clearsky: ["sol", "Céu limpo"], fair: ["sol", "Poucas nuvens"], partlycloudy: ["nuvem", "Parcialmente nublado"], cloudy: ["nuvem", "Nublado"], fog: ["neblina", "Neblina"],
  lightrain: ["chuva", "Chuva fraca"], rain: ["chuva", "Chuva"], heavyrain: ["chuva", "Chuva forte"],
  lightrainshowers: ["chuva", "Pancadas fracas de chuva"], rainshowers: ["chuva", "Pancadas de chuva"], heavyrainshowers: ["chuva", "Pancadas fortes de chuva"],
  lightsleet: ["frio", "Chuva com neve fraca"], sleet: ["frio", "Chuva com neve"], heavysleet: ["frio", "Chuva com neve forte"],
  lightsleetshowers: ["frio", "Pancadas de chuva com neve"], sleetshowers: ["frio", "Pancadas de chuva com neve"], heavysleetshowers: ["frio", "Pancadas de chuva com neve"],
  lightsnow: ["frio", "Neve fraca"], snow: ["frio", "Neve"], heavysnow: ["frio", "Neve forte"], lightsnowshowers: ["frio", "Pancadas de neve"], snowshowers: ["frio", "Pancadas de neve"], heavysnowshowers: ["frio", "Pancadas de neve"],
};
const PESO = { sol: 0, nuvem: 1, neblina: 2, frio: 3, chuva: 4, tempestade: 6 }; // para escolher o símbolo que representa o dia
export function simbolo(cod) {
  const c = String(cod || "").replace(/_(day|night|polartwilight)$/, ""), trovao = /andthunder$/.test(c), b = BASE[c.replace(/s?andthunder$/, "")] || BASE[c.replace(/andthunder$/, "")] || ["nuvem", "Tempo instável"];
  const forte = /^heavy/.test(c);
  return { tipo: trovao ? "tempestade" : b[0], txt: trovao ? b[1] + " com trovoadas" : b[1], peso: (PESO[trovao ? "tempestade" : b[0]] || 0) + (forte ? 1 : 0) + (/^light/.test(c) ? -0.5 : 0) };
}

// Série do MET Norway -> resumo. tz = horas em relação ao UTC (ex.: -3).
export function resume(j, tz = -3, agora = Date.now()) {
  const st = (j && j.properties && j.properties.timeseries) || []; if (!st.length) return null;
  const local = (iso) => new Date(Date.parse(iso) + tz * 36e5), dia = (d) => d.toISOString().slice(0, 10);
  // "agora" = a entrada mais próxima da hora atual
  let k = 0; for (let i = 0; i < st.length; i++) if (Math.abs(Date.parse(st[i].time) - agora) < Math.abs(Date.parse(st[k].time) - agora)) k = i;
  const a = st[k], ad = a.data.instant.details, prox = a.data.next_1_hours || a.data.next_6_hours || a.data.next_12_hours || {};
  const cod = (prox.summary && prox.summary.symbol_code) || "cloudy", s = simbolo(cod);
  const out = { atual: Date.parse(j.properties.meta.updated_at) || agora,
    agora: { temp: Math.round(ad.air_temperature), cod, tipo: s.tipo, txt: s.txt, noite: /_night$/.test(cod), chuva: (prox.details && prox.details.precipitation_amount) || 0, vento: Math.round((ad.wind_speed || 0) * 3.6), umid: Math.round(ad.relative_humidity || 0) }, dias: [] };
  const porDia = new Map();
  for (const e of st) {
    const l = local(e.time), d = dia(l), h = l.getUTCHours(), o = porDia.get(d) || porDia.set(d, { d, min: 99, max: -99, chuva: 0, peso: -1, cod: "", ate: 0 }).get(d);
    const t = e.data.instant.details.air_temperature; if (t < o.min) o.min = t; if (t > o.max) o.max = t;
    const t0 = Date.parse(e.time), p1 = e.data.next_1_hours, p6 = e.data.next_6_hours;
    if (t0 >= o.ate) { // soma a chuva sem contar o mesmo período duas vezes (série horária no começo, de 6 em 6 h depois)
      if (p1) { o.chuva += p1.details.precipitation_amount || 0; o.ate = t0 + 36e5; } else if (p6) { o.chuva += p6.details.precipitation_amount || 0; o.ate = t0 + 6 * 36e5; }
    }
    const sc = (p1 || p6 || {}).summary; if (sc && h >= 6 && h <= 21) { const x = simbolo(sc.symbol_code); if (x.peso > o.peso) { o.peso = x.peso; o.cod = sc.symbol_code.replace(/_night$/, "_day"); } }
  }
  for (const o of [...porDia.values()].slice(0, 5)) {
    if (!o.cod) continue; const s2 = simbolo(o.cod);
    out.dias.push({ d: o.d, min: Math.round(o.min), max: Math.round(o.max), chuva: Math.round(o.chuva * 10) / 10, cod: o.cod, tipo: s2.tipo, txt: s2.txt });
  }
  out.dias = out.dias.slice(0, 4);
  return out;
}

export async function onRequestGet({ request }) {
  const u = new URL(request.url), lat = +u.searchParams.get("lat"), lon = +u.searchParams.get("lon"), tz = Math.max(-5, Math.min(-2, +u.searchParams.get("tz") || -3));
  if (!isFinite(lat) || !isFinite(lon) || lat < -35 || lat > 6 || lon < -75 || lon > -28) return new Response(JSON.stringify({ erro: "ponto fora do Brasil" }), { status: 400, headers: CAB });
  const la = lat.toFixed(2), lo = lon.toFixed(2); // 2 casas (~1 km): mais acertos de cache e dentro do limite de 4 casas dos termos
  const chave = new Request(`https://cache.alertabr/tempo?lat=${la}&lon=${lo}&tz=${tz}`), cache = typeof caches !== "undefined" ? caches.default : null;
  if (cache) { const hit = await cache.match(chave); if (hit) return hit; }
  try {
    const r = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${la}&lon=${lo}`, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error("fonte " + r.status);
    const res = resume(await r.json(), tz); if (!res) throw new Error("sem dados");
    const resp = new Response(JSON.stringify({ ...res, fonte: "MET Norway" }), { headers: { ...CAB, "cache-control": "public, max-age=900, s-maxage=1800" } });
    if (cache) await cache.put(chave, resp.clone());
    return resp;
  } catch (e) {
    return new Response(JSON.stringify({ erro: String(e.message || e) }), { status: 502, headers: { ...CAB, "cache-control": "public, max-age=30" } });
  }
}

// Testes rápidos (sem dependências): node scripts/teste.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse, agrupa } from "../functions/api/noticias.js";

const xml = `<rss><channel>
<item><title>Chuva forte alaga ruas de Porto Alegre - GZH</title><link>https://exemplo.com/a</link><pubDate>Sat, 07 Nov 2026 10:00:00 GMT</pubDate><source url="x">GZH</source></item>
<item><title>Chuva forte alaga ruas em Porto Alegre - G1</title><link>https://exemplo.com/b</link><pubDate>Sat, 07 Nov 2026 11:00:00 GMT</pubDate><source url="x">G1</source></item>
<item><title>Queimadas avançam no Pantanal - Folha</title><link>https://exemplo.com/c</link><pubDate>Sat, 07 Nov 2026 09:00:00 GMT</pubDate><source url="x">Folha</source></item>
<item><title>Link perigoso</title><link>javascript:alert(1)</link></item></channel></rss>`;
const it = parse(xml);
assert.equal(it.length, 3, "ignora links que não são https");
assert.equal(it[0].t, "Chuva forte alaga ruas de Porto Alegre", "tira o nome da fonte do título");
const g = agrupa(it);
assert.equal(g.length, 2, "junta títulos parecidos");
assert.equal(g[0].n, 2);

const bing = `<rss xmlns:News="x"><channel><item><title>Chuva forte alaga o Rio</title><link>http://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;aid=&amp;url=https%3a%2f%2fexemplo.com%2fnoticia%2f1&amp;c=1</link><pubDate>Sat, 07 Nov 2026 10:00:00 GMT</pubDate><News:Source>Exemplo</News:Source></item></channel></rss>`;
const ib = parse(bing); assert.equal(ib.length, 1); assert.equal(ib[0].u, "https://exemplo.com/noticia/1", "usa a URL real do veículo"); assert.equal(ib[0].f, "Exemplo");
const geo = JSON.parse(readFileSync(new URL("../site/data/municipios.json", import.meta.url)));
assert.equal(geo.c.length, 5570); assert.equal(geo.n.length, 5570); assert.equal(geo.d.length, 5570);
assert.ok(geo.c.every((c, i) => i === 0 || c > geo.c[i - 1]), "códigos IBGE em ordem crescente");
const e = JSON.parse(readFileSync(new URL("../site/data/estado.json", import.meta.url)));
assert.equal(e.s.length, 5570); assert.equal(e.f.length, 5570);
assert.ok(e.s.every((x) => x >= 0 && x <= 3));
const raiz = new URL("../site/", import.meta.url);
const man = JSON.parse(readFileSync(new URL("manifest.webmanifest", raiz)));
assert.equal(man.display, "standalone"); assert.ok(man.icons.some((i) => i.purpose === "maskable"), "ícone maskable");
for (const i of man.icons) readFileSync(new URL(i.src, raiz)); // o arquivo existe
const est = JSON.parse(readFileSync(new URL("data/estados.json", raiz)));
assert.equal(est.proj.length, 4, "parâmetros da projeção para o mapa em graus"); assert.ok(est.linhas.length > 1000, "linhas de estado");
const sw = readFileSync(new URL("sw.js", raiz), "utf8"); assert.ok(/VERSAO/.test(sw) && /fetch/.test(sw));
// --- filtro de assunto e ligação com municípios ---
const { relevante, temasDe } = await import("../shared/relevancia.mjs");
const { leFeed, localiza } = await import("../relay/noticias.mjs");
for (const t of ["Temporal derruba árvores e deixa 50 mil sem luz", "Defesa Civil emite alerta de chuva forte", "Incêndio florestal avança no Pantanal", "Inmet alerta para baixa umidade em 100 cidades", "Terremoto de magnitude 4 é sentido em Minas"]) assert.ok(relevante(t), "deve passar: " + t);
for (const t of ["Flamengo vence e assume a liderança do Brasileirão", "Sob chuva, Norris conquista pole no GP de São Paulo", "Toni Tornado e os bailes do Rio", "Incêndio em prédio deixa dois feridos", "Cantor cancela show e reage a temporal", "Dólar fecha em alta"]) assert.ok(!relevante(t), "deve cair: " + t);
assert.deepEqual(temasDe("Queimadas e fumaça cobrem a cidade"), ["fogo"]);
const fe = leFeed(`<feed><entry><title>Chuva forte em Petrópolis</title><link rel="alternate" href="https://exemplo.com/x"/><updated>2026-11-07T10:00:00Z</updated><summary>&lt;p&gt;Resumo&lt;/p&gt;</summary></entry></feed>`);
assert.equal(fe.length, 1); assert.equal(fe[0].u, "https://exemplo.com/x"); assert.equal(fe[0].r, "Resumo");
const rdf = leFeed(`<rdf:RDF><item rdf:about="https://a.gov.br/1"><title>Cemaden alerta</title><link>https://a.gov.br/1</link><dc:date>2026-11-07T10:00:00Z</dc:date></item></rdf:RDF>`);
assert.equal(rdf.length, 1);
const nome = (r) => r.m.map((i) => geo.n[i]);
assert.deepEqual(nome(localiza("Temporal causa estragos em Petrópolis, na Região Serrana", "")), ["Petrópolis"]);
assert.deepEqual(nome(localiza("Morreram 23 bezerros em fazenda", "")), [], "palavra comum em minúscula não é município");
assert.deepEqual(nome(localiza("Chuva forte atinge o interior de São Paulo", "")), [], "interior de X não é a cidade X");
assert.deepEqual(nome(localiza("Chuva em Bom Jesus (PI)", "")).length, 1, "nome repetido resolvido pela sigla");
assert.deepEqual(nome(localiza("Chuva forte no Rio Grande do Sul", "")), [], "estado não vira município");
assert.deepEqual(localiza("Previsão do tempo hoje para Brasília (DF): sol", "Goiânia Curitiba Niterói Recife Manaus Belém Natal", 53).m.length, 1, "resumo com lista de capitais não vira lugar da notícia");
assert.deepEqual(localiza("Chuva forte no litoral", "", 33), { m: [], s: [33] }, "sem lugar no texto vale o estado do feed");
assert.deepEqual(localiza("Previsão do tempo para Porto Alegre", "", 33).s, [43], "estado do feed não entra quando o texto cita outro lugar");
// --- índice leve e tiles do mapa ---
const mun = JSON.parse(readFileSync(new URL("../site/data/mun.json", import.meta.url)));
assert.equal(mun.c.length, geo.c.length, "mun.json tem todos os municípios"); assert.deepEqual(mun.c, geo.c, "mesma ordem do municipios.json (os vetores do estado.json dependem disso)");
assert.equal(mun.b.length, 4 * mun.c.length); assert.equal(mun.p.length, 2 * mun.c.length);
const { existsSync } = await import("node:fs");
for (const t of ["0/0/0", "4/5/8", "8/94/138"]) assert.ok(existsSync(new URL(`../site/tiles/${t}.pbf`, import.meta.url)), "tile " + t);
assert.ok(/<!--contorno--><svg class="contorno"/.test(readFileSync(new URL("../site/index.html", import.meta.url), "utf8")), "contorno do esqueleto embutido no HTML");
// --- previsão do tempo (MET Norway -> cartão) ---
const { simbolo, resume } = await import("../functions/api/tempo.js");
assert.equal(simbolo("rainshowersandthunder_day").tipo, "tempestade"); assert.equal(simbolo("clearsky_night").tipo, "sol"); assert.equal(simbolo("heavyrain").txt, "Chuva forte");
const serie = (h, t, cod, mm) => ({ time: new Date(Date.UTC(2026, 10, 11, h)).toISOString(), data: { instant: { details: { air_temperature: t, wind_speed: 5, relative_humidity: 80 } }, next_1_hours: { summary: { symbol_code: cod }, details: { precipitation_amount: mm } } } });
const rt = resume({ properties: { meta: { updated_at: "2026-11-11T12:00:00Z" }, timeseries: [serie(12, 20, "cloudy", 0), serie(15, 26, "rain", 2), serie(18, 24, "rainandthunder", 5), serie(36, 18, "clearsky_day", 0)] } }, -3, Date.UTC(2026, 10, 11, 12));
assert.equal(rt.agora.temp, 20); assert.equal(rt.agora.tipo, "nuvem"); assert.equal(rt.dias[0].max, 26); assert.equal(rt.dias[0].tipo, "tempestade", "o dia é representado pelo pior tempo"); assert.equal(rt.dias[0].chuva, 7);
// --- motor de notícias: apelidos, peso, "Lei Seca" ---
const { pesoDe } = await import("../relay/noticias.mjs");
assert.ok(!relevante("Motociclista é preso em blitz da Lei Seca"), "Lei Seca não é seca"); assert.ok(relevante("Seca afeta 160 mil famílias no Amazonas"));
assert.deepEqual(nome(localiza("Temporal alaga ruas de BH", "")), ["Belo Horizonte"]); assert.deepEqual(nome(localiza("Chuva forte atinge o Rio e fecha túnel", "", 33)), ["Rio de Janeiro"]);
assert.deepEqual(nome(localiza("Nível do rio sobe e preocupa moradores", "", 33)), [], "rio (curso d'água) não é a cidade"); assert.deepEqual(nome(localiza("Temporal alaga ruas da capital", "", 43)), ["Porto Alegre"]);
assert.ok(pesoDe("Temporal deixa dois mortos e 300 desabrigados") > pesoDe("Veja a previsão para o fim de semana"));
console.log("ok: todos os testes passaram");

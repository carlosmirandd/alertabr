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

const geo = JSON.parse(readFileSync(new URL("../site/data/municipios.json", import.meta.url)));
assert.equal(geo.c.length, 5570); assert.equal(geo.n.length, 5570); assert.equal(geo.d.length, 5570);
assert.ok(geo.c.every((c, i) => i === 0 || c > geo.c[i - 1]), "códigos IBGE em ordem crescente");
const e = JSON.parse(readFileSync(new URL("../site/data/estado.json", import.meta.url)));
assert.equal(e.s.length, 5570); assert.equal(e.f.length, 5570);
assert.ok(e.s.every((x) => x >= 0 && x <= 3));
console.log("ok: todos os testes passaram");

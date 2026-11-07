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
console.log("ok: todos os testes passaram");

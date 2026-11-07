// Servidor local sem dependências: serve site/ e roda a função /api/noticias. Uso: node scripts/dev.mjs [porta]
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = fileURLToPath(new URL("../site/", import.meta.url)), FUNCOES = fileURLToPath(new URL("../functions/api/", import.meta.url)), PORTA = +process.argv[2] || 8788;
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json", ".pbf": "application/x-protobuf" };
createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  try {
    if (u.pathname.startsWith("/api/")) {
      const nome = u.pathname.slice(5).replace(/[^a-z]/g, ""), mod = await import(pathToFileURL(join(FUNCOES, nome + ".js")).href);
      const r = await mod.onRequestGet({ request: new Request(u.href), env: process.env });
      res.writeHead(r.status, Object.fromEntries(r.headers)); return res.end(Buffer.from(await r.arrayBuffer()));
    }
    let p = normalize(decodeURIComponent(u.pathname)).replace(/^([/\\])+/, ""); if (!p || p.endsWith("/") || p.endsWith("\\")) p += "index.html";
    if (p.includes("..")) { res.writeHead(400); return res.end(); }
    const b = await readFile(join(RAIZ, p)); res.writeHead(200, { "content-type": TIPOS[extname(p)] || "application/octet-stream", "cache-control": "no-store" }); res.end(b);
  } catch (e) { res.writeHead(404); res.end("não encontrado"); }
}).listen(PORTA, () => console.log("alertabr em http://localhost:" + PORTA));

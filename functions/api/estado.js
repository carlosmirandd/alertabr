// Reserva: devolve o estado.json pelo mesmo domínio do site (sem CORS). O site só usa isto se a leitura direta do R2 falhar.
// Em wrangler.toml / Configurações do projeto, defina FEED_URL (ex.: https://dados.seudominio.com/alertabr/estado.json).
export async function onRequestGet({ env }) {
  const alvo = env && env.FEED_URL;
  if (!alvo) return new Response('{"erro":"FEED_URL não configurada"}', { status: 503, headers: { "content-type": "application/json" } });
  const r = await fetch(alvo, { cf: { cacheTtl: 30, cacheEverything: true } });
  return new Response(r.body, { status: r.status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=20, s-maxage=30" } });
}

// Agendador confiável do relay: a cada 5 minutos pede ao GitHub Actions para rodar o fluxo "relay".
// (O agendamento próprio do GitHub atrasa ou pula execuções; o cron da Cloudflare não.)
// Precisa do segredo GH_TOKEN: token fino do GitHub, só neste repositório, permissão "Actions: Read and write".
export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(dispara(env)); },
  async fetch(req, env, ctx) {
    if (new URL(req.url).searchParams.get("agora") === "1" && req.method === "POST") { ctx.waitUntil(dispara(env)); return new Response("disparado\n"); }
    return new Response("alertabr-cron: dispara o relay no GitHub Actions a cada 5 minutos.\n");
  },
};

async function dispara(env) {
  if (!env.GH_TOKEN) { console.log("GH_TOKEN não configurado"); return; }
  const r = await fetch(`https://api.github.com/repos/${env.REPO}/actions/workflows/relay.yml/dispatches`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.GH_TOKEN}`, accept: "application/vnd.github+json", "user-agent": "alertabr-cron", "x-github-api-version": "2022-11-28", "content-type": "application/json" },
    body: JSON.stringify({ ref: "main" }),
  });
  if (r.status !== 204) console.log("GitHub respondeu", r.status, (await r.text()).slice(0, 300));
}

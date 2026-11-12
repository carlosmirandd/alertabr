/* alertabr: lógica da página. Sem framework, sem build. */
(function () {
  const CFG = window.ALERTABR, $ = (s) => document.querySelector(s);
  const UFS = { 11: "RO", 12: "AC", 13: "AM", 14: "RR", 15: "PA", 16: "AP", 17: "TO", 21: "MA", 22: "PI", 23: "CE", 24: "RN", 25: "PB", 26: "PE", 27: "AL", 28: "SE", 29: "BA", 31: "MG", 32: "ES", 33: "RJ", 35: "SP", 41: "PR", 42: "SC", 43: "RS", 50: "MS", 51: "MT", 52: "GO", 53: "DF" };
  const NOME_SEV = window.Cartao.NOME_SEV;
  let COR_SEV = {}, COR_FOGO = [];
  function lerCores() { // as cores do mapa vêm das variáveis CSS do tema atual (claro/escuro)
    const cs = getComputedStyle(document.documentElement), v = (n) => cs.getPropertyValue(n).trim();
    COR_SEV = { 0: v("--sev-nenhum"), 1: v("--sev-potencial"), 2: v("--sev-perigo"), 3: v("--sev-grande") };
    COR_FOGO = [v("--sev-nenhum"), v("--fogo-1"), v("--fogo-2"), v("--fogo-3"), v("--fogo-4"), v("--fogo-5")]; // 0, 1, 2-3, 4-9, 10-24, 25+
  }
  lerCores();
  const fmt = (n) => Number(n || 0).toLocaleString("pt-BR");
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const balde = (n) => (n <= 0 ? 0 : n === 1 ? 1 : n < 4 ? 2 : n < 10 ? 3 : n < 25 ? 4 : 5);
  const ufDe = (i) => UFS[Math.floor(G.c[i] / 100000)] || "";
  const janela = (t) => { const m = /(\d{4})-(\d\d)-(\d\d) (\d\d:\d\d)/.exec(t || ""); return m ? m[3] + "/" + m[2] + " " + m[4] : t || ""; };
  const hora = (t) => new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const ha = (t) => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? "agora" : m < 60 ? "há " + m + " min" : m < 1440 ? "há " + Math.floor(m / 60) + " h" : "há " + Math.floor(m / 1440) + " d"; };
  // "hoje", "amanhã" ou dd/mm, a partir do início do aviso
  const diaTxt = (t) => { const m = /(\d{4})-(\d\d)-(\d\d)/.exec(t || ""); if (!m) return ""; const h = new Date(), d0 = new Date(h.getFullYear(), h.getMonth(), h.getDate()), dif = Math.round((new Date(+m[1], +m[2] - 1, +m[3]) - d0) / 86400000); return dif === 0 ? "hoje" : dif === 1 ? "amanhã" : m[3] + "/" + m[2]; };

  let filtroSev = 0, pilSel = -1, verFut = false, G = null, E = null, mapa = null, D = null, camada = "alertas", sel = -1, destaquePos = -1, fonteOk = 0, formato = "post", tema = "todos", timer = 0, semDados = true;
  const NOME_UF = { 11: "Rondônia", 12: "Acre", 13: "Amazonas", 14: "Roraima", 15: "Pará", 16: "Amapá", 17: "Tocantins", 21: "Maranhão", 22: "Piauí", 23: "Ceará", 24: "Rio Grande do Norte", 25: "Paraíba", 26: "Pernambuco", 27: "Alagoas", 28: "Sergipe", 29: "Bahia", 31: "Minas Gerais", 32: "Espírito Santo", 33: "Rio de Janeiro", 35: "São Paulo", 41: "Paraná", 42: "Santa Catarina", 43: "Rio Grande do Sul", 50: "Mato Grosso do Sul", 51: "Mato Grosso", 52: "Goiás", 53: "Distrito Federal" };
  let selUf = 0, ufIdx = null; // selUf: visão do estado inteiro (resumo + notícias), quando nenhum município está selecionado
  const codUf = (i) => Math.floor(G.c[i] / 100000), idxUf = (c) => { if (!ufIdx) { ufIdx = {}; G.c.forEach((_, i) => (ufIdx[codUf(i)] || (ufIdx[codUf(i)] = [])).push(i)); } return ufIdx[c] || []; };
  let membros = [], porNome = null, cartaoCv = null; const sujo = { n: true, c: true };
  const DESK = "(min-width: 900px), (orientation: landscape) and (min-width: 600px) and (max-height: 560px)", desk = () => matchMedia(DESK).matches, folha = () => !desk(); // coluna lateral (computador, celular deitado) ou folha que sobe de baixo (celular em pé, tablet)
  const CAPITAIS = new Set([1100205, 1200401, 1302603, 1400100, 1501402, 1600303, 1721000, 2111300, 2211001, 2304400, 2408102, 2507507, 2611606, 2704302, 2800308, 2927408, 3106200, 3205309, 3304557, 3550308, 4106902, 4205407, 4314902, 5002704, 5103403, 5208707, 5300108]); // capitais aparecem primeiro na busca e no mapa

  // área do mapa que fica livre de controles e da folha (o enquadramento do Brasil usa isso)
  function insets() {
    const m = $("#mapa").getBoundingClientRect(), cam = $(".camadas").getBoundingClientRect(), t = Math.max(16, cam.bottom - m.top + 12);
    if (desk()) return { l: 24, r: 72, t, b: 24 };
    return { l: 12, r: 64, t, b: Math.max(16, m.bottom - $("#painel").getBoundingClientRect().top + 12) };
  }

  // ---------- carregar ----------
  const json = (u, ms = 12000) => fetch(u, { signal: AbortSignal.timeout(ms) }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
  // Ordem de carga: índice dos municípios (leve) e dados de alerta saem JUNTOS; o mapa é criado sem esperar os alertas,
  // e os painéis aparecem assim que os alertas chegam. Cada parte falha sozinha, com mensagem e "Tentar de novo".
  async function init() {
    const pDados = buscaEstado();
    try { G = await json("data/mun.json", 30000); }
    catch (e) { erroMapa("Não foi possível carregar a lista de municípios. Verifique a conexão."); status("erro"); return; }
    criaMapa(); legenda(); pintaAgora(); ligaUI();
    const j = await pDados; if (j) aplica(j); else falhaDados();
    if (mapa.fitBrasil !== false && mapa.refit) mapa.refit(); // enquadra o Brasil já descontando os cartões que acabaram de aparecer
    leURL(); addEventListener("popstate", leURL);
    ciclo();
  }
  function criaMapa() {
    const op = { cor: corDe, padrao: padraoDe, aoClicar: aoClicar, aoPassar: aoPassar, insets: insets, capitais: CAPITAIS, aoPronto: () => { $("#carrega").classList.add("ok"); const ok = () => mapa.carregaFormas().then(() => { if (sel >= 0) pintaCartao(); }).catch(() => {}); if (window.requestIdleCallback) requestIdleCallback(ok, { timeout: 4000 }); else setTimeout(ok, 1500); }, aoErro: () => erroMapa("Não foi possível carregar o mapa. Verifique a conexão.") };
    if (window.MapaGL && window.MapaGL.suportado()) {
      // se o WebGL falhar antes de o mapa aparecer (contexto gráfico indisponível, tiles fora do ar), tenta o mapa em canvas
      op.aoErro = () => { if (mapa && mapa.pronto) return; try { mapa.map.remove(); } catch (e) { /* já removido */ } $("#mapa").querySelectorAll(".maplibregl-canvas-container, .maplibregl-control-container").forEach((x) => x.remove()); criaCanvas(op); };
      try { mapa = new window.MapaGL($("#mapa"), G, null, op); return; } catch (e) { /* cai para o canvas */ }
    }
    criaCanvas(op);
  }
  function criaCanvas(op) { // sem WebGL: mapa em canvas, que precisa da geometria completa (mais pesada)
    op = { ...op, aoErro: undefined };
    mapa = { setCor() {}, setDestaque() {}, setSel() {}, zoomPara() {}, zoomLista() {}, zoomMais() {}, resetar() {}, refit() {}, forma: () => null, carregaFormas: () => Promise.reject(), w: 0, h: 0 };
    Promise.all([json("data/municipios.json", 30000), json("data/estados.json", 30000)]).then(([g, e]) => {
      mapa = new window.MapaBrasil($("#mapa"), g, e, op); mapa.prio = new Set([...CAPITAIS].map((c) => G.c.indexOf(c)).filter((k) => k >= 0));
      mapa.forma = (i) => ({ path: mapa.paths[i], caixa: mapa.box[i] }); mapa.carregaFormas = () => Promise.resolve();
      $("#carrega").classList.remove("erro"); $("#carrega").classList.add("ok"); if (D) mapa.setCor(corDe, true); if (sel >= 0) mapa.setSel(sel); if (mapa.refit) mapa.refit();
    }).catch(() => erroMapa("Não foi possível carregar o mapa. Verifique a conexão."));
  }
  function erroMapa(msg) {
    const c = $("#carrega"); c.classList.remove("ok"); c.classList.add("erro");
    $("#carregaTxt").innerHTML = `${esc(msg)}<button type="button" class="btn" id="tentaMapa">Tentar de novo</button>`;
    $("#tentaMapa").addEventListener("click", () => location.reload());
  }
  const TOTAL_MUN = 5570;
  function validado(j) { return j && j.v === 1 && Array.isArray(j.s) && j.s.length === (G ? G.c.length : TOTAL_MUN) && Array.isArray(j.f) ? j : null; }
  async function buscaEstado() { // tenta R2, depois a função do site, depois a cópia local; devolve null se todas falharem
    const emLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && !/[?&]feed=1/.test(location.search); // no seu computador: usa o arquivo local (veja o README)
    const urls = emLocal ? [CFG.LOCAL] : [CFG.FEED && CFG.FEED + "?v=" + Math.floor(Date.now() / 30000), CFG.RESERVA, CFG.LOCAL].filter(Boolean);
    for (let k = 0; k < urls.length; k++) {
      const u = urls[(fonteOk + k) % urls.length];
      try { const j = validado(await json(u, 10000)); if (j) { fonteOk = (fonteOk + k) % urls.length; return j; } } catch (e) { /* tenta a próxima fonte */ }
    }
    return null;
  }
  let erroDados = false;
  function aplica(j) {
    if (D && j.gerado <= D.gerado) { status(); return; } // um arquivo mais velho que o que já temos não substitui os dados
    const antes = D ? D.s.reduce((a, x) => a + (x ? 1 : 0), 0) : -1;
    D = j; semDados = false; erroDados = false; montaMembros();
    if (antes >= 0) { const agora = D.s.reduce((a, x) => a + (x ? 1 : 0), 0); anuncia("Alertas atualizados." + (agora !== antes ? ` Agora são ${fmt(agora)} municípios com aviso.` : "")); } mapa.setCor(corDe, true); mapa.setDestaque(destaquePos >= 0 ? membros[destaquePos] : null);
    legenda(); pintaHero(); pintaAgora(); pintaCartao(); if (sujo.n) pintaNoticias(); status();
  }
  function falhaDados() { if (!D) { erroDados = true; pintaAgora(); pintaHero(); anuncia("Não foi possível buscar os alertas."); } status("erro"); }
  function anuncia(txt) { const el = $("#anuncio"); el.textContent = ""; setTimeout(() => { el.textContent = txt; }, 50); }
  async function atualiza() { const j = await buscaEstado(); if (j) aplica(j); else falhaDados(); }
  function ciclo() {
    clearTimeout(timer);
    timer = setTimeout(async () => { if (!document.hidden) await atualiza(); ciclo(); }, CFG.INTERVALO);
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && D && Date.now() - D.gerado > CFG.INTERVALO) atualiza(); });
  function montaMembros() { membros = D.alertas.map(() => new Set()); for (const i in D.m) for (const p of D.m[i]) membros[p] && membros[p].add(+i); }
  function status(forca) {
    const el = $("#status"), t = $("#stTxt"); el.classList.remove("velho", "erro");
    if (!D) { el.classList.toggle("erro", forca === "erro"); t.textContent = forca === "erro" ? "Sem conexão com as fontes de alerta" : "Carregando…"; return; }
    const idade = Date.now() - D.gerado, fora = ["inmet", "inpe"].filter((k) => D.fontes[k] && !D.fontes[k].ok), velho = idade > CFG.VELHO;
    if (velho || forca === "erro") el.classList.add("velho");
    t.textContent = "Atualizado " + ha(D.gerado) + (velho ? " · pode estar desatualizado" : "") + (fora.length ? " · " + fora.map((x) => x.toUpperCase()).join(" e ") + " fora do ar (mostrando a última leitura)" : "");
  }
  setInterval(() => { if (D && !document.hidden) status(); }, 30000);

  // ---------- números grandes (que também filtram o mapa) ----------
  function pintaHero() {
    if (!D) { if (folha()) requestAnimationFrame(() => folhaPara(altura)); $("#hSub").textContent = erroDados ? "Sem conexão com as fontes de alerta. Tente de novo." : "Buscando os dados mais recentes…"; return; } const r = resumoBr(regiaoAtual()), tot = r.tot, soma = r.sev[1] + r.sev[2] + r.sev[3];
    $("#n3").textContent = fmt(r.sev[3]); $("#n2").textContent = fmt(r.sev[2]); $("#n1").textContent = fmt(r.sev[1]); $("#nF").textContent = fmt(r.focos);
    document.querySelectorAll("#filtros [data-sev]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.sev === filtroSev && camada === "alertas")));
    $("#filtros [data-camada]").setAttribute("aria-pressed", String(camada === "focos"));
    const cr = $("#crumbs"); // caminho clicável: Brasil › Estado › Município
    if (sel >= 0) cr.innerHTML = `<button type="button" data-limpa="1">Brasil</button><span>›</span><button type="button" data-uf="${codUf(sel)}">${esc(NOME_UF[codUf(sel)])}</button>`;
    else if (selUf) cr.innerHTML = '<button type="button" data-limpa="1">Brasil</button><span>›</span><b>' + esc(NOME_UF[selUf]) + "</b>";
    cr.hidden = sel < 0 && !selUf; $("#filtros").hidden = sel >= 0; // no município, a contagem por gravidade não se aplica
    if (folha() && (altura === "baixo" || altura === "min")) requestAnimationFrame(() => folhaPara(altura)); // o cabeçalho mudou de tamanho: a folha recolhida acompanha
    if (sel >= 0) {
      const al = alertasDe(sel).filter((x) => x.h === 0), foc = D.f[sel];
      $("#hTitulo").textContent = G.n[sel] + " · " + ufDe(sel);
      $("#hSub").innerHTML = (al.length ? `<b>${al.length}</b> aviso${al.length === 1 ? "" : "s"} do INMET hoje` : "Nenhum aviso do INMET hoje") + ` · <b>${fmt(foc)}</b> foco${foc === 1 ? "" : "s"} de calor em 24 h`;
    } else {
      $("#hTitulo").textContent = selUf ? NOME_UF[selUf] + " agora" : "Brasil agora";
      $("#hSub").innerHTML = `<b>${fmt(soma)}</b> de ${fmt(tot)} municípios (${(soma / tot * 100).toFixed(1).replace(".", ",")} %) com aviso do INMET hoje`;
    }
  }

  // ---------- cores e legenda ----------
  function padraoDe(i) { if (!D || camada !== "alertas") return 0; const s = D.s[i]; return filtroSev && s !== filtroSev ? 0 : s >= 2 ? s : 0; }
  function corDe(i) { if (!D) return COR_SEV[0]; if (camada === "alertas") { const s = D.s[i]; return filtroSev && s !== filtroSev ? COR_SEV[0] : COR_SEV[s]; } return COR_FOGO[balde(D.f[i])]; }
  function legenda() {
    const l = $("#leg"), li = (c, t, p) => `<div><i class="${p || ""}" style="background-color:${c}"></i>${t}</div>`;
    l.innerHTML = camada === "alertas" ? li(COR_SEV[3], "Grande perigo", "pad-3") + li(COR_SEV[2], "Perigo", "pad-2") + li(COR_SEV[1], "Perigo potencial") + li(COR_SEV[0], "Sem aviso hoje")
      : li(COR_FOGO[5], "25+ focos") + li(COR_FOGO[4], "10 a 24") + li(COR_FOGO[3], "4 a 9") + li(COR_FOGO[2], "2 a 3") + li(COR_FOGO[1], "1 foco") + li(COR_FOGO[0], "nenhum (24 h)");
  }

  // ---------- interação com o mapa ----------
  function aoClicar(i) { seleciona(i); }
  function aoPassar(i, px, py) {
    const tip = $("#tip"); if (i < 0) { tip.hidden = true; return; }
    if (tip.dataset.i !== String(i) || tip.dataset.v !== String(D ? D.gerado : 0) + camada) { // so remonta o conteudo quando muda de municipio
      tip.dataset.i = i; tip.dataset.v = String(D ? D.gerado : 0) + camada;
      let h = `<div class="tip-t"><b>${esc(G.n[i])}</b><span>${ufDe(i)}</span></div>`;
      if (D) {
        const al = alertasDe(i).filter((x) => x.h === 0).sort((x, y) => y.sev - x.sev), foc = D.f[i];
        h += al.length ? al.slice(0, 2).map((x) => `<div class="tip-l"><span class="tag sev-${x.sev}">${NOME_SEV[x.sev] || ""}</span>${esc(x.t)}</div>`).join("") + (al.length > 2 ? `<div class="tip-s">+${al.length - 2} aviso${al.length > 3 ? "s" : ""}</div>` : "") : '<div class="tip-s">Sem aviso do INMET hoje</div>';
        h += `<div class="tip-l"><b style="color:var(--fogo)">${fmt(foc)}</b>&nbsp;foco${foc === 1 ? "" : "s"} de calor em 24 h</div>`;
      }
      tip.innerHTML = h + '<div class="tip-s tip-d">Clique para ver detalhes</div>';
    }
    tip.hidden = false; const m = $("#mapa"), w = tip.offsetWidth, hh = tip.offsetHeight;
    tip.style.left = Math.max(6, Math.min(px + 14, m.clientWidth - w - 6)) + "px"; tip.style.top = Math.max(6, py + hh + 24 > m.clientHeight ? py - hh - 12 : py + 14) + "px";
  }
  function seleciona(i, semZoom) {
    sel = i; selUf = 0; destaquePos = -1; pilSel = -1; verFut = false; mapa.setDestaque(null); mapa.setSel(i);
    if (i >= 0) { if (folha() && altura !== "min") folhaPara("meio"); if (!semZoom) mapa.zoomPara(i); }
    gravaURL(true);
    $("#q").value = i >= 0 ? G.n[i] : ""; pintaHero(); pintaAgora(); pintaNoticias(); pintaCartao();
  }
  function selecionaUf(cod) { // visão do estado: resumo, avisos, focos e notícias só dele
    sel = -1; selUf = cod; destaquePos = -1; pilSel = -1; verFut = false; mapa.setDestaque(null); mapa.setSel(-1);
    if (folha() && altura !== "min") folhaPara("meio");
    gravaURL(true); mapa.zoomLista(idxUf(cod)); $("#q").value = NOME_UF[cod];
    pintaHero(); pintaAgora(); pintaNoticias(); pintaCartao();
  }
  // ---------- estado da tela na URL: #m=código | #uf=NN, &camada=focos, &aba=noticias|cartao ----------
  // Trocar de lugar cria uma entrada no histórico (o "voltar" do navegador funciona); camada e aba só atualizam o endereço.
  let lendoURL = false;
  function hashAtual() { const p = []; if (sel >= 0) p.push("m=" + G.c[sel]); else if (selUf) p.push("uf=" + selUf); if (camada === "focos") p.push("camada=focos"); if (aba !== "agora") p.push("aba=" + aba); return p.length ? "#" + p.join("&") : ""; }
  function gravaURL(novo) { if (lendoURL || !G) return; const h = hashAtual(); if (h === location.hash) return; const u = location.pathname + location.search + h; if (novo) history.pushState(null, "", u); else history.replaceState(null, "", u); }
  function leURL() {
    lendoURL = true;
    try {
      const q = new URLSearchParams(location.hash.slice(1)), m = +q.get("m"), uf = +q.get("uf"), a = q.get("aba");
      setCamada(q.get("camada") === "focos" || /[?&]camada=focos/.test(location.search) ? "focos" : "alertas");
      if (m) { const i = G.c.indexOf(m); if (i >= 0 && i !== sel) seleciona(i); }
      else if (uf && NOME_UF[uf]) { if (selUf !== uf || sel >= 0) selecionaUf(uf); }
      else if (sel >= 0 || selUf) { seleciona(-1); mapa.resetar(); }
      trocaAba(["agora", "noticias", "cartao"].includes(a) ? a : "agora");
    } finally { lendoURL = false; }
  }
  function alertasDe(i) { return D && D.m[i] ? D.m[i].map((p) => D.alertas[p]).filter(Boolean) : []; }

  const rng = (s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  function camadasCeu(tipo) { // fundo animado: chuva, raios, neve, sol, vento ou brasas (só transform/opacity, poucos elementos)
    const r = rng(tipo.length * 977 + tipo.charCodeAt(0)), R = (x, y) => x + r() * (y - x), P = (n, d = 1) => n.toFixed(d); let h = "";
    h += '<svg class="c-n n1" viewBox="0 0 112 76"><use href="#i-nuvem"/></svg><svg class="c-n n2" viewBox="0 0 112 76"><use href="#i-nuvem"/></svg><svg class="c-n n3" viewBox="0 0 112 76"><use href="#i-nuvem"/></svg>';
    if (tipo === "noite") { for (let k = 0; k < 14; k++) h += `<b class="gota est" style="left:${P(R(2, 96))}%;top:${P(R(4, 70))}%;--s:${P(R(2, 4), 0)}px;--d:-${P(R(0, 5), 1)}s"></b>`; }
    else if (tipo === "chuva" || tipo === "tempestade") {
      const n = tipo === "tempestade" ? 18 : 14;
      for (let k = 0; k < n; k++) h += `<i class="gt" style="left:${P(R(0, 100))}%;--h:${P(R(22, 58), 0)}px;--o:${P(R(.25, .8), 2)};--t:${P(R(.6, 1.3), 2)}s;--d:-${P(R(0, 1.4), 2)}s"></i>`;
      for (let k = 0; k < 4; k++) h += `<b class="gota" style="left:${P(R(2, 96))}%;top:${P(R(4, 92))}%;--s:${P(R(4, 9), 0)}px;--d:-${P(R(0, 5), 1)}s"></b>`;
      if (tipo === "tempestade") h += '<div class="raio"></div>';
    } else if (tipo === "frio") {
      for (let k = 0; k < 30; k++) h += `<i class="fl" style="left:${P(R(0, 100))}%;--s:${P(R(3, 6), 0)}px;--t:${P(R(7, 12), 1)}s;--d:-${P(R(0, 10), 1)}s;--x:${P(R(-22, 22), 0)}px"></i>`;
    } else if (tipo === "sol" || tipo === "limpo") {
      h += '<div class="sol-g"><span class="raios"></span><span class="disco"></span></div>';
    } else if (tipo === "vento") {
      for (let k = 0; k < 12; k++) h += `<i class="vt" style="top:${P(R(8, 92))}%;--w:${P(R(50, 120), 0)}px;--o:${P(R(.3, .7), 2)};--t:${P(R(1.6, 3.4), 1)}s;--d:-${P(R(0, 3), 1)}s"></i>`;
    } else if (tipo === "fogo") {
      for (let k = 0; k < 22; k++) h += `<i class="br" style="left:${P(R(0, 100))}%;--s:${P(R(3, 7), 0)}px;--t:${P(R(3.5, 7), 1)}s;--d:-${P(R(0, 6), 1)}s;--x:${P(R(-30, 30), 0)}px"></i>`;
    }
    return `<div class="cam" aria-hidden="true">${h}</div>`;
  }
  function icoCeu(tipo) {
    const nuv = '<use href="#i-nuvem" class="nv-b" x="4" y="0" width="112" height="76"/>';
    let s;
    if (tipo === "noite") s = '<svg viewBox="0 0 120 92" aria-hidden="true"><path d="M78 58A30 30 0 1 1 52 16a24 24 0 0 0 26 42z" fill="#f4e9c1"/></svg>';
    else if (tipo === "sol" || tipo === "limpo") s = '<svg viewBox="0 0 120 92" aria-hidden="true"><defs><radialGradient id="gs" cx=".38" cy=".35"><stop offset="0" stop-color="#fff3b8"/><stop offset="1" stop-color="#ffb62e"/></radialGradient></defs><g class="rs" stroke="#ffc93d" stroke-width="5" stroke-linecap="round">' + [...Array(12)].map((_, k) => `<path d="M60 46 m0 -34 v-8" transform="rotate(${k * 30} 60 46)"/>`).join("") + '</g><circle cx="60" cy="46" r="22" fill="url(#gs)"/></svg>';
    else if (tipo === "fogo") s = '<svg viewBox="0 0 24 24" fill="#ffb15c" stroke="#ff7a1a" stroke-width="1.1" stroke-linejoin="round" aria-hidden="true"><use href="#i-fogo"/></svg>';
    else if (tipo === "chuva") s = `<svg viewBox="0 0 120 92" aria-hidden="true">${nuv}<path d="M42 82v7M60 80v8M78 82v7" stroke="#a9c4ee" stroke-width="3.6" stroke-linecap="round"/></svg>`;
    else if (tipo === "tempestade") s = `<svg viewBox="0 0 120 92" aria-hidden="true">${nuv}<path d="M66 58 50 80h11l-4 12 20-24H64l4-10z" fill="#ffc83d"/></svg>`;
    else if (tipo === "vento") s = `<svg viewBox="0 0 120 92" aria-hidden="true">${nuv}<path d="M18 84h56M40 90h44" stroke="rgba(255,255,255,.75)" stroke-width="3.6" stroke-linecap="round"/></svg>`;
    else s = `<svg viewBox="0 0 120 92" aria-hidden="true">${nuv}</svg>`;
    return `<div class="c-ico">${s}</div>`;
  }
  // Cartão do tempo.
  //  - Município: o TEMPO DE VERDADE (previsão do MET Norway via /api/tempo): cena, temperatura, condição e próximos dias. O aviso do INMET, se houver, entra como etiqueta.
  //  - Brasil / estado: não existe "um tempo só", então a cena é a do aviso mais grave, dito com todas as letras.
  let ultimoCeu = "";
  const cacheT = new Map(); // município -> { t, j } (20 min) | { erro: true, t }
  const fusoDe = (i) => { const u = codUf(i); return u === 12 ? -5 : [11, 13, 14, 50, 51].includes(u) ? -4 : -3; };
  const DIA_SEM = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const ICONE_T = { sol: "sol", nuvem: "nuvemc", neblina: "neblina", chuva: "gota", tempestade: "raio", frio: "frio" };
  function buscaTempo(i) {
    const c = cacheT.get(i); if (c && (c.carregando || Date.now() - c.t < (c.erro ? 30000 : 1200000))) return;
    cacheT.set(i, { t: Date.now(), carregando: true });
    json(`/api/tempo?lat=${(G.p[2 * i + 1] / 1000).toFixed(2)}&lon=${(G.p[2 * i] / 1000).toFixed(2)}&tz=${fusoDe(i)}`, 15000)
      .then((j) => { if (!j || !j.agora) throw new Error("vazio"); cacheT.set(i, { t: Date.now(), j }); })
      .catch(() => cacheT.set(i, { t: Date.now(), erro: true }))
      .then(() => { if (sel === i) { pintaCeu(); if (aba === "cartao") pintaCartao(); } });
  }
  function avisoDoMunicipio(i) { // aviso em destaque: o que a pessoa tocou, ou o mais grave de hoje
    const pos = (D.m[i] || []).slice().sort((x, y) => D.alertas[x].h - D.alertas[y].h || D.alertas[y].sev - D.alertas[x].sev);
    const p = pilSel >= 0 && pos.includes(pilSel) ? pilSel : pos[0]; return p != null ? D.alertas[p] : null;
  }
  function pintaCeu() {
    const el = $("#ceu"); if (!D) { el.hidden = true; return; }
    let tipo = "limpo", h = "";
    const linha = (palavra, sub) => `<div class="pal"><b>${esc(palavra)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</div>`;
    if (sel >= 0) {
      buscaTempo(sel);
      const c = cacheT.get(sel) || {}, at = avisoDoMunicipio(sel);
      const etiqueta = at ? `<p class="ceu-av"><span class="tag sev-${at.sev}">${NOME_SEV[at.sev]}</span> Aviso de ${esc(at.t)}${at.h ? " · " + esc(diaTxt(at.ini)) : " hoje"}</p>` : "";
      if (c.j) {
        const a = c.j.agora; tipo = a.noite && (a.tipo === "sol" || a.tipo === "nuvem") ? "noite" : a.tipo;
        const hojeIso = new Date(Date.now() + fusoDe(sel) * 36e5).toISOString().slice(0, 10);
        const dias = c.j.dias.filter((d) => d.d > hojeIso).slice(0, 3).map((d) => { const w = new Date(d.d + "T12:00:00Z").getUTCDay();
          return `<li><span>${DIA_SEM[w]}</span><svg class="ic" aria-hidden="true"><use href="#i-${ICONE_T[d.tipo] || "nuvemc"}"/></svg><b>${d.max}°</b><small>${d.min}°</small><em>${esc(d.txt)}${d.chuva >= 0.5 ? ", " + fmt(Math.round(d.chuva)) + " mm" : ""}</em></li>`; }).join("");
        h = `<div class="ceu-c">${icoCeu(tipo)}<div class="ceu-t"><b>${a.temp}°</b></div>${linha(a.txt, "Vento " + a.vento + " km/h · Umidade " + a.umid + "%")}</div>${etiqueta}${dias ? `<ul class="ceu-dias" aria-label="Próximos dias">${dias}</ul>` : ""}<p class="ceu-f">Previsão: MET Norway · ${ha(c.j.atual)}</p>`;
      } else {
        // carregando ou sem previsão: a cena fica neutra (nunca um sol inventado) e o aviso continua visível
        tipo = "nuvem";
        h = `<div class="ceu-c">${icoCeu("nuvem")}${c.erro ? linha("Previsão do tempo indisponível", "A fonte não respondeu agora.") : linha("Buscando a previsão do tempo…", "")}</div>${etiqueta}${c.erro ? '<button type="button" class="btn sec ceu-btn" data-tenta="tempo">Tentar de novo</button>' : ""}`;
      }
    } else {
      const cod = selUf; let topo = destaquePos >= 0 ? D.alertas[destaquePos] : null;
      if (!topo) for (let p = 0; p < D.alertas.length; p++) { const a = D.alertas[p]; if (a.h !== 0) continue; if (cod) { let ok = false; for (const i of membros[p] || []) if (codUf(i) === cod) { ok = true; break; } if (!ok) continue; } topo = a; break; }
      let palavra = "Sem aviso do INMET hoje", sub = "Escolha um município para ver a previsão do tempo.";
      if (camada === "focos") { tipo = "fogo"; palavra = "Focos de calor"; sub = "detecções de satélite em 24 h"; }
      else if (topo) { tipo = tipoCeu(topo); palavra = "Aviso mais grave: " + topo.t; sub = NOME_SEV[topo.sev] + (cod ? " · " + UFS[cod] : " · " + siglas(topo.uf)); }
      else tipo = "nuvem";
      h = `<div class="ceu-c">${icoCeu(tipo)}${linha(palavra, sub)}</div>`;
    }
    const chave = tipo + "|" + sel; const ani = ultimoCeu !== chave; ultimoCeu = chave;
    el.hidden = false; el.setAttribute("aria-label", sel >= 0 ? "Tempo agora em " + G.n[sel] : "Resumo dos avisos");
    el.className = "ceu " + tipo + (ani ? " ani" : "");
    el.innerHTML = camadasCeu(tipo) + h;
    if (folha() && (altura === "baixo" || altura === "min")) requestAnimationFrame(() => folhaPara(altura));
  }

  // ---------- aba Avisos ----------
  function resumoBr(cod = 0) { // cod = 0: Brasil; senão, só os municípios daquele estado
    const ix = cod ? idxUf(cod) : null, c = { 1: 0, 2: 0, 3: 0 }, top = []; let focos = 0;
    const cada = (i) => { const s = D.s[i]; if (s) c[s]++; if (D.f[i] > 0) { top.push(i); focos += D.f[i]; } };
    if (ix) ix.forEach(cada); else for (let i = 0; i < D.s.length; i++) cada(i);
    top.sort((a, b) => D.f[b] - D.f[a]);
    return { sev: c, focos: cod ? focos : D.resumo.focos, tot: ix ? ix.length : G.c.length, top: top.slice(0, 8).map((i) => ({ i, nome: G.n[i], uf: ufDe(i), n: D.f[i] })), fmt, ...(cod ? { sufixo: NOME_UF[cod], rot: "PANORAMA · " + UFS[cod] } : {}) };
  }
  const regiaoAtual = () => (sel < 0 ? selUf : 0);
  // ícone pelo tipo do aviso do INMET
  function tipoCeu(a) {
    const t = norm(a.t);
    if (/tempest|trovoad|granizo|raio/.test(t)) return "tempestade";
    if (/chuva|alag|enxurr|inunda|ciclone|deslizam|ressaca|precipit/.test(t)) return "chuva";
    if (/declinio|frio|geada|friagem/.test(t)) return "frio";
    if (/umidade|calor|seca|estiagem|temperatura/.test(t)) return "sol";
    if (/vento|vendaval|rajada/.test(t)) return "vento";
    if (/nevoe|neblina|nevoa/.test(t)) return "neblina";
    if (/incend|queimad|fogo/.test(t)) return "fogo";
    return "nuvem";
  }
  const ICONE = { chuva: "gota", tempestade: "raio", frio: "frio", sol: "sol", vento: "vento", nuvem: "gota", neblina: "neblina", fogo: "fogo", limpo: "sol" };
  const SIGLA = Object.fromEntries(Object.entries(NOME_UF).map(([c, n]) => [norm(n), UFS[c]]));
  const juntaE = (l) => (l.length < 2 ? l[0] || "" : l.slice(0, -1).join(", ") + " e " + l[l.length - 1]);
  const listaUf = (txt) => String(txt || "").split(",").map((x) => x.trim()).filter(Boolean);
  const siglas = (txt, max = 3) => { const l = listaUf(txt).map((n) => SIGLA[norm(n)] || n); return l.length <= max + 1 ? juntaE(l) : l.slice(0, max).join(", ") + " e mais " + (l.length - max); };
  const icone = (a) => `<svg class="ic" aria-hidden="true"><use href="#i-${ICONE[tipoCeu(a)]}"/></svg>`;
  // texto completo de um aviso (nada fica cortado): quando, onde, o que é e o que fazer
  function textoAviso(a, comEstados) {
    const ins = (a.i || []).filter(Boolean);
    return `<div class="av-txt"><p class="av-quando">${a.h ? "Previsto para " + diaTxt(a.ini) + " · " : ""}De ${esc(janela(a.ini))} até ${esc(janela(a.fim))}</p>`
      + (comEstados ? `<p><b>Estados:</b> ${esc(juntaE(listaUf(a.uf)))}.</p>` : "")
      + (a.r && a.r[0] ? `<p>${esc(a.r.join(" "))}</p>` : "")
      + (ins.length ? `<div class="av-fazer"><b>O que fazer</b><ul>${ins.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : "")
      + "</div>";
  }
  const linhaAviso = ([a, p]) => { const ab = p === destaquePos;
    return `<li><button type="button" class="rw sev-${a.sev}${ab ? " on" : ""}" data-alerta="${p}" aria-expanded="${ab}">${icone(a)}<span class="rw-tx"><b>${esc(a.t)}</b><small><span class="tag sev-${a.sev}">${NOME_SEV[a.sev] || ""}</span> ${esc(siglas(a.uf))}</small></span><span class="rw-n"><b>${fmt(a.n)}</b><small>municípios</small></span></button>${ab ? textoAviso(a, true) : ""}</li>`; };
  function pintaAgora() {
    pintaCeu();
    const el = $("#aba-agora");
    if (!D) { el.innerHTML = erroDados ? '<div class="estado-msg" role="alert"><p><b>Não foi possível buscar os alertas agora.</b> As fontes (INMET e INPE) ou a sua conexão não responderam.</p><button type="button" class="btn" data-tenta="dados">Tentar de novo</button></div>' : '<div class="estado-msg" aria-busy="true"><span class="esq-linha"></span><span class="esq-linha"></span><span class="esq-linha curta"></span></div>'; return; }
    el.innerHTML = sel >= 0 ? municipio(sel) : brasil();
  }
  function brasil() {
    const cod = selUf, nomeR = cod ? NOME_UF[cod] : "Brasil", r = resumoBr(cod);
    if (camada === "focos") {
      return `<h2 class="sec">Municípios com mais focos de calor (24 h)</h2>` + (r.top.length ? `<ol class="lista">${r.top.map((t) => `<li><button type="button" class="rw fg" data-cid="${t.i}"><svg class="ic" aria-hidden="true"><use href="#i-fogo"/></svg><span class="rw-tx"><b>${esc(t.nome)}</b><small>${t.uf}</small></span><span class="rw-n"><b>${fmt(t.n)}</b><small>focos</small></span></button></li>`).join("")}</ol>` : `<p class="vazio">Nenhum foco de calor registrado em ${esc(nomeR)} nas últimas 24 h.</p>`)
        + '<p class="nota">Focos são detecções de satélite, não incêndios confirmados.</p>';
    }
    // no estado, cada aviso conta só os municípios daquele estado
    const todos = D.alertas.map((a, p) => { if (!cod) return [a, p]; let n = 0; for (const i of membros[p] || []) if (codUf(i) === cod) n++; return n ? [{ ...a, n }, p] : null; }).filter(Boolean);
    const hoje = todos.filter(([a]) => a.h === 0), fut = todos.filter(([a]) => a.h === 1);
    let h = `<h2 class="sec">Avisos de hoje${hoje.length ? " · " + hoje.length : ""}</h2>`;
    h += hoje.length ? `<ul class="lista">${hoje.map(linhaAviso).join("")}</ul>` : `<p class="vazio">Nenhum aviso do INMET hoje em ${esc(nomeR)}.</p>`;
    if (fut.length) h += verFut ? `<h2 class="sec">Próximos dias · ${fut.length}</h2><ul class="lista">${fut.map(linhaAviso).join("")}</ul>` : `<button type="button" class="btn sec largo" data-fut="1">Ver avisos dos próximos dias (${fut.length})</button>`;
    if (cod) h += '<div class="fila"><button type="button" class="btn sec" data-limpa="1">Ver o Brasil</button></div>';
    return h;
  }
  function municipio(i) {
    // avisos de HOJE vêm primeiro; dentro de cada dia, o mais grave. Um aberto por vez (o primeiro, ou o que a pessoa tocou).
    const pos = (D.m[i] || []).slice().sort((x, y) => D.alertas[x].h - D.alertas[y].h || D.alertas[y].sev - D.alertas[x].sev);
    const aberto = pilSel === -2 ? -1 : pos.includes(pilSel) ? pilSel : pos[0], foc = D.f[i], nome = G.n[i];
    let h = `<h2 class="sec">${pos.length ? "Avisos para " + esc(nome) : "Avisos"}</h2>`;
    h += pos.length ? pos.map((p) => { const a = D.alertas[p], ab = p === aberto;
      return `<article class="aviso sev-${a.sev}"><button type="button" class="av-cab" data-pil="${p}" aria-expanded="${ab}">${icone(a)}<span class="rw-tx"><b>${esc(a.t)}</b><small><span class="tag sev-${a.sev}">${NOME_SEV[a.sev] || ""}</span> ${a.h ? esc(diaTxt(a.ini)) : "hoje"}</small></span></button>${ab ? textoAviso(a, false) : ""}</article>`; }).join("")
      : `<p class="vazio">Nenhum aviso do INMET hoje para ${esc(nome)}.</p>`;
    h += `<h2 class="sec">Focos de calor</h2><p class="texto">${foc ? `<b>${fmt(foc)}</b> foco${foc === 1 ? "" : "s"} detectado${foc === 1 ? "" : "s"} por satélite nas últimas 24 h${D.frp[i] ? ` · potência somada de ${fmt(D.frp[i])} MW` : ""}.` : "Nenhum foco detectado nas últimas 24 h."}</p>`;
    h += `<div class="fila"><button type="button" class="btn sec" data-uf="${codUf(i)}">Ver ${esc(NOME_UF[codUf(i)])}</button><button type="button" class="btn sec" data-limpa="1">Ver o Brasil</button></div>`;
    return h;
  }

  // ---------- cartão da direita: notícias ----------
  // Fonte principal: noticias.json (feeds de veículos e órgãos lidos pelo relay, já filtrados por assunto e ligados aos municípios).
  // Complemento: /api/noticias (Google Notícias/Bing), que preenche o que faltar. O mesmo filtro de assunto vale para os dois.
  const TEMAS = { todos: '(chuva OR alagamento OR queimada OR incêndio OR "Defesa Civil" OR temporal OR seca)', chuva: "(chuva OR alagamento OR enchente OR temporal OR deslizamento)", fogo: '(queimada OR incêndio OR "foco de calor" OR fumaça)', calor: '("onda de calor" OR seca OR "baixa umidade" OR geada OR "frio intenso")', outros: "(terremoto OR tremor OR ciclone OR tornado OR vendaval OR granizo OR ressaca)" };
  const CHIPS = [["todos", "Tudo"], ["chuva", "Chuva"], ["fogo", "Queimadas"], ["calor", "Calor, frio e seca"], ["outros", "Outros riscos"]];
  const cacheN = new Map(), noticiasVisivel = () => aba === "noticias";
  let feedN = null, feedOk = null;
  const carregaFeed = () => {
    if (feedN && Date.now() - feedN.t < 300000) return feedN.p;
    const urls = (location.hostname === "localhost" || location.hostname === "127.0.0.1" ? [CFG.LOCAL_NOTICIAS] : [CFG.NOTICIAS && CFG.NOTICIAS + "?v=" + Math.floor(Date.now() / 60000), CFG.LOCAL_NOTICIAS]).filter(Boolean);
    const p = (async () => { for (const u of urls) { try { const j = await json(u, 12000); if (j && Array.isArray(j.itens)) { feedOk = j; return j; } } catch (e) { /* tenta a próxima */ } } return feedOk; })(); // falhou (ex.: aba em segundo plano)? usa a última cópia boa
    feedN = { t: Date.now(), p }; p.then((j) => { if (!j && feedN && feedN.p === p) feedN = null; }); return p; // não guarda falha: tenta de novo na próxima
  };
  const tok = (t) => new Set(norm(t).split(/[^a-z0-9]+/).filter((w) => w.length > 3));
  const jac = (a, b) => { let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i || 1); };
  const semRepetidos = (lista) => { const out = [], ts = []; for (const n of lista) { const k = tok(n.t); if (ts.some((x) => jac(x, k) > 0.55)) continue; ts.push(k); out.push(n); } return out; };
  // ORDEM das notícias (pontuação): recência com meia-vida de 36 h + peso editorial dado pelo relay (impacto, alerta, fonte oficial)
  // + quantos veículos deram a mesma notícia + (na cidade) se o nome dela está no título. Notícia grave de ontem fica acima de rotina de hoje.
  const pontos = (n, local) => { const h = Math.max(0, (Date.now() - n.d) / 36e5); return 6 * Math.pow(0.5, h / 36) + (n.p != null ? n.p : 3) * 0.6 + Math.min(3, (n.n || 1) - 1) * 0.8 + (n.o ? 0.5 : 0) + (local && n.mt ? 2 : 0) + (n.nv || 0) * 2; };
  const ordena = (l, local) => l.map((n) => [pontos(n, local), n]).sort((a, b) => b[0] - a[0]).map((x) => x[1]);
  // distância em km entre os pontos de rótulo de dois municípios
  const distKm = (a, b) => { const R = Math.PI / 180, la1 = G.p[2 * a + 1] / 1000 * R, la2 = G.p[2 * b + 1] / 1000 * R, dl = (G.p[2 * b] - G.p[2 * a]) / 1000 * R; return 6371 * Math.acos(Math.min(1, Math.sin(la1) * Math.sin(la2) + Math.cos(la1) * Math.cos(la2) * Math.cos(dl))); };
  function listaDoFeed(j, t = tema) {
    const est = sel < 0 ? selUf : 0;
    const ok = (n) => t === "todos" || n.tm.includes(t), ate = Date.now() - 7 * 864e5, ateGeral = Date.now() - 3 * 864e5;
    const itens = (j.itens || []).filter((n) => ok(n) && n.d > ate && (sel >= 0 || !n.pv)); // previsão diária de cidade só aparece na visão da cidade
    const ev = (j.eventos || []).filter((e) => t === "outros" || (t === "todos" ? e.nv >= 2 : e.tm.includes(t) && e.nv >= 2));
    if (est) return { principal: semRepetidos(ordena([...ev.filter((e) => t === "outros"), ...itens.filter((n) => n.s.includes(est) && n.d > ateGeral)])), perto: [] };
    if (sel < 0) return { principal: semRepetidos(ordena([...ev, ...itens.filter((n) => n.d > ateGeral)])), perto: [] };
    const loc = ordena(itens.filter((n) => n.m.includes(sel)), true);
    // na região: notícias que citam municípios a até 50 km (tempo severo é regional). Vêm separadas e com a cidade e a distância ditas.
    const perto = [];
    for (const n of itens) { if (n.pv || n.m.includes(sel) || n.d < ateGeral) continue; let melhor = null; for (const k of n.m) { const d = distKm(sel, k); if (d <= 50 && (!melhor || d < melhor.km)) melhor = { km: d, k }; } if (melhor) perto.push({ ...n, perto: G.n[melhor.k] + " · " + Math.max(1, Math.round(melhor.km)) + " km", km: melhor.km }); }
    return { principal: loc, perto: semRepetidos(ordena(perto)).slice(0, 5) };
  }
  function pintaNoticias() {
    if (!noticiasVisivel()) { sujo.n = true; return; } sujo.n = false;
    const el = $("#aba-noticias"), local = sel >= 0, est = sel < 0 ? selUf : 0, ch = sel + "|" + selUf + "|" + tema, nome = local ? G.n[sel] : "", sigla = local ? ufDe(sel) : "";
    el.innerHTML = `<h2 class="sec">${local ? "Notícias · " + esc(nome) : "Notícias · " + (est ? esc(NOME_UF[est]) : "Brasil")}</h2><div class="chips">${CHIPS.map(([k, n]) => `<button data-tema="${k}" aria-pressed="${tema === k}">${n}</button>`).join("")}</div><div id="listaN"><p class="vazio esq">Buscando notícias…</p></div>`;
    const q = (local ? `"${nome}" ${sigla} ` : est ? `"${NOME_UF[est]}" ` : "") + TEMAS[tema];
    let feed = undefined, api = undefined; // undefined = ainda carregando; null = falhou
    const item = (n) => `<a class="not" href="${esc(n.u)}" target="_blank" rel="noopener noreferrer"><b>${esc(n.t)}</b><small>${n.perto ? `<span class="not-perto">${esc(n.perto)}</span> · ` : ""}${esc(n.f || "")}${n.o ? " · oficial" : ""}${n.d ? " · " + ha(n.d) : ""}${n.n > 1 ? " · " + n.n + " fontes" : ""}</small></a>`;
    const desenha = () => {
      const L = $("#listaN"); if (!L || ch !== sel + "|" + selUf + "|" + tema) return;
      if (feed === undefined && api === undefined) return;
      const f = feed ? listaDoFeed(feed) : { principal: [], perto: [] }, a = (api && api.itens) || [];
      // município: o que cita a cidade vem primeiro (feeds, depois busca); sem nada local, mostra o estado e avisa
      const ap = local ? a.filter((n) => norm(n.t).includes(norm(nome))) : a;
      let lista = semRepetidos(local ? [...f.principal, ...ap] : ordena([...f.principal, ...a]));
      const regiao = local && f.perto.length ? `<h2 class="sec">Na região (até 50 km)</h2>` + f.perto.map(item).join("") : "";
      let aviso = "";
      if (local && !lista.length) aviso = `<p class="vazio esq">Nenhuma notícia sobre ${esc(nome)} nos últimos 7 dias.</p><button type="button" class="btn sec" style="margin:4px" data-uf="${codUf(sel)}">Ver notícias de ${esc(NOME_UF[codUf(sel)])}</button>`; // sem misturar com outras cidades
      lista = lista.slice(0, 15);
      if ((feed === undefined || api === undefined) && !lista.length) return; // espera o outro lado antes de dizer que não há nada
      const falhou = feed === null && (api === null || (api && api.erro));
      L.innerHTML = lista.length ? lista.map(item).join("") + regiao + aviso : falhou ? '<p class="vazio">Não foi possível buscar as notícias agora.</p><button type="button" class="btn" style="margin:4px" data-tenta="noticias">Tentar de novo</button>' : (local && aviso) ? aviso + regiao : `<p class="vazio">Nenhuma notícia recente sobre o assunto.</p><a class="btn sec" style="display:inline-flex;align-items:center;margin:4px" href="https://news.google.com/search?q=${encodeURIComponent(q)}&hl=pt-BR&gl=BR&ceid=BR:pt-419" target="_blank" rel="noopener noreferrer">Buscar no Google Notícias</a>`;
    };
    carregaFeed().then((j) => { feed = j; desenha(); });
    const c = cacheN.get(q); if (c && Date.now() - c.t < 600000) { api = c.j; desenha(); return; }
    json("/api/noticias?q=" + encodeURIComponent(q), 15000).then((j) => { cacheN.set(q, { t: Date.now(), j }); if (cacheN.size > 40) cacheN.delete(cacheN.keys().next().value); api = j; desenha(); }).catch(() => { api = null; desenha(); });
  }

  // ---------- cartão da direita: imagem para compartilhar ----------
  // Dados do cartão, já em texto. Sempre há o que mostrar: com aviso, a situação; sem aviso, "tudo certo".
  const DOMINIO = /^(localhost|127\.|\[::1\])/.test(location.hostname) ? "alertabr.pages.dev" : location.host;
  const SEV_COR = { 1: "potencial", 2: "perigo", 3: "grande" };
  const quandoAgora = () => { const d = new Date(); return DIA_SEM[d.getDay()] + ", " + d.toLocaleDateString("pt-BR") + " · " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); };
  // origem dita em cada manchete: a cidade escolhida, "Cidade · N km" (vizinha) ou a cidade/estado a que a notícia se refere
  const manchetes = (lista, origem) => semRepetidos(lista.filter((n) => !n.pv && !n.e)).slice(0, 4).map((n) => ({ t: n.t, meta: [origem ? origem(n) : "", n.f || "", n.d ? ha(n.d) : ""].filter(Boolean).join(" · ") }));
  async function dadosCartao() {
    let feed = null; try { feed = await carregaFeed(); } catch (e) { /* sem manchetes */ }
    const d = { formato, quando: quandoAgora(), dominio: DOMINIO, fontes: "Fontes: INMET (avisos), INPE (focos)" + (sel >= 0 ? ", MET Norway (tempo)" : "") + " · notícias dos veículos citados" };
    if (sel >= 0) {
      const at = avisoDoMunicipio(sel), foc = D.f[sel], c = cacheT.get(sel) || {}, uf = codUf(sel);
      d.lugar = { nome: G.n[sel], sub: NOME_UF[uf] };
      d.status = at ? { cor: SEV_COR[at.sev], sev: at.sev, txt: NOME_SEV[at.sev] + " · " + at.t + (at.h && diaTxt(at.ini) !== "hoje" ? " · previsto para " + diaTxt(at.ini) : " · hoje") }
        : { cor: "ok", txt: "Nenhum aviso do INMET para hoje. Tudo certo por aqui." };
      if (at) d.aviso = { sev: at.sev, t: at.t, quando: (at.h && diaTxt(at.ini) !== "hoje" ? diaTxt(at.ini) + " · " : "") + janela(at.ini) + " → " + janela(at.fim), desc: (at.r || []).join(" "), fazer: (at.i || []).filter(Boolean).slice(0, 2) };
      if (c.j) {
        const a = c.j.agora, hojeIso = new Date(Date.now() + fusoDe(sel) * 36e5).toISOString().slice(0, 10), hoje = c.j.dias.find((x) => x.d === hojeIso);
        d.tempo = { temp: a.temp, txt: a.txt, cena: a.noite && (a.tipo === "sol" || a.tipo === "nuvem") ? "noite" : a.tipo,
          detalhe: (hoje ? "Máx " + hoje.max + "° · Mín " + hoje.min + "° · " : "") + "Vento " + a.vento + " km/h · Umidade " + a.umid + "%",
          dias: c.j.dias.filter((x) => x.d > hojeIso).slice(0, 3).map((x) => ({ dia: DIA_SEM[new Date(x.d + "T12:00:00Z").getUTCDay()], cena: x.tipo, max: x.max, min: x.min })) };
      } else buscaTempo(sel); // chega depois e o cartão se refaz
      d.focos = { n: foc, txt: foc ? fmt(foc) + (foc === 1 ? " foco de calor" : " focos de calor") + " nas últimas 24 h" : "Nenhum foco de calor nas últimas 24 h" };
      if (feed) { const f = listaDoFeed(feed, "todos"), est = ordena((feed.itens || []).filter((n) => !n.pv && n.s.includes(uf) && !n.m.includes(sel) && Date.now() - n.d < 3 * 864e5)); d.manchetes = manchetes([...f.principal, ...f.perto, ...est], (n) => n.perto || (n.m.includes(sel) ? G.n[sel] : n.m.length ? G.n[n.m[0]] + (codUf(n.m[0]) === uf ? "" : " · " + ufDe(n.m[0])) : NOME_UF[uf])); }
    } else {
      const cod = selUf, r = resumoBr(cod), soma = r.sev[1] + r.sev[2] + r.sev[3];
      d.lugar = { nome: cod ? NOME_UF[cod] : "Brasil", sub: cod ? "Panorama do estado" : "Panorama nacional" };
      const hoje = D.alertas.map((a, p) => { if (!cod) return a; let n = 0; for (const i of membros[p] || []) if (codUf(i) === cod) n++; return n ? { ...a, n } : null; }).filter((a) => a && a.h === 0);
      const pior = hoje.reduce((m, a) => Math.max(m, a.sev), 0);
      d.status = soma ? { cor: SEV_COR[pior], sev: pior, txt: fmt(soma) + " de " + fmt(r.tot) + " municípios com aviso do INMET hoje (" + (soma / r.tot * 100).toFixed(1).replace(".", ",") + "%)" }
        : { cor: "ok", txt: "Nenhum aviso do INMET hoje" + (cod ? " no estado" : " no país") + ". Tudo certo por enquanto." };
      d.resumo = soma ? { c: { 1: fmt(r.sev[1]), 2: fmt(r.sev[2]), 3: fmt(r.sev[3]) }, top: hoje.sort((a, b) => b.sev - a.sev || b.n - a.n).map((a) => ({ t: a.t, sev: a.sev, onde: cod ? "até " + janela(a.fim) : siglas(a.uf, 2), n: fmt(a.n) })) } : null;
      d.focos = { n: r.focos, txt: r.focos ? fmt(r.focos) + " focos de calor em 24 h" : "Nenhum foco de calor em 24 h", extra: r.top[0] ? "Mais focos: " + r.top[0].nome + " · " + r.top[0].uf + " (" + fmt(r.top[0].n) + ")" : "" };
      if (feed) d.manchetes = manchetes(listaDoFeed(feed, "todos").principal, (n) => n.m.length ? G.n[n.m[0]] + " · " + ufDe(n.m[0]) : n.s.length === 1 ? NOME_UF[n.s[0]] : "");
    }
    return d;
  }
  let vezCartao = 0;
  async function pintaCartao() {
    if (!D) return; if (aba !== "cartao") { sujo.c = true; return; } sujo.c = false;
    const el = $("#aba-cartao"), vez = ++vezCartao;
    el.innerHTML = `<h2 class="sec">Cartão para compartilhar · ${sel >= 0 ? esc(G.n[sel]) : selUf ? esc(NOME_UF[selUf]) : "Brasil"}</h2>
      <div class="chips"><button data-fmt="post" aria-pressed="${formato === "post"}">Post 1:1</button><button data-fmt="stories" aria-pressed="${formato === "stories"}">Stories 9:16</button></div>
      <div class="cartao-l"><div id="prev"><div class="esq-linha" style="height:260px;max-width:360px"></div></div><div class="acoes"><button class="btn" data-baixa="1">Baixar PNG</button><button class="btn sec" data-comp="1">Compartilhar</button></div></div>`;
    const d = await dadosCartao(); if (vez !== vezCartao || aba !== "cartao") return;
    cartaoCv = window.Cartao.gera(d); const img = new Image(); img.className = "previa"; img.alt = "Prévia do cartão: " + d.lugar.nome + ". " + d.status.txt; img.src = cartaoCv.toDataURL("image/jpeg", 0.88);
    const pv = $("#prev"); pv.innerHTML = ""; pv.appendChild(img);
  }
  const nomeArq = () => "alertabr-" + (sel >= 0 ? norm(G.n[sel]).replace(/[^a-z0-9]+/g, "-") : selUf ? norm(NOME_UF[selUf]).replace(/[^a-z0-9]+/g, "-") : "brasil") + "-" + formato + ".png";

  // ---------- UI ----------
  // Folha do celular: 3 alturas (baixo = só o resumo, meio, alto). Arrasta pelo puxador ou pelo cabeçalho; toque no puxador avança.
  let altura = "baixo", tRefit = 0, aba = "agora";
  function alturasFolha() {
    const p = $("#painel"), fundo = innerHeight - p.getBoundingClientRect().bottom, topo = $("#barra").getBoundingClientRect().bottom + 8;
    const max = Math.max(200, innerHeight - fundo - topo), baixo = Math.min(max, $("#grip").offsetHeight + $("#pCab").offsetHeight + 4);
    // min: puxador, caminho, nome do lugar e a linha-resumo (mapa quase todo livre). Medido pelo fim do subtítulo, que não muda com a altura do painel.
    const t = $("#hSub").getBoundingClientRect(), pt = p.getBoundingClientRect().top - p.scrollTop, min = Math.min(baixo, Math.max($("#grip").offsetHeight + 40, Math.round(t.bottom - pt + 12)));
    return { min, baixo, meio: Math.max(baixo, Math.min(max, Math.round(innerHeight * 0.55))), alto: max };
  }
  function folhaPara(h) {
    const p = $("#painel"), g = $("#grip");
    if (desk()) { p.style.height = ""; p.dataset.altura = ""; document.documentElement.style.removeProperty("--folha"); document.documentElement.classList.remove("folha-alta"); return; }
    altura = h; const px = alturasFolha()[h]; p.style.height = px + "px"; p.dataset.altura = h; if (h === "baixo" || h === "min") p.scrollTop = 0;
    document.documentElement.style.setProperty("--folha", px + "px");
    document.documentElement.classList.toggle("folha-alta", h === "alto");
    g.setAttribute("aria-expanded", String(h !== "baixo" && h !== "min")); g.setAttribute("aria-label", h === "min" ? "Mostrar o painel" : h === "alto" ? "Recolher o painel para liberar o mapa" : "Mostrar mais");
    clearTimeout(tRefit); tRefit = setTimeout(() => { if (mapa && mapa.fitBrasil && mapa.refit) mapa.refit(); }, 280);
  }
  function ligaFolha() {
    const p = $("#painel"); let y0 = 0, h0 = 0, ativo = false, moveu = false;
    const ini = (e) => { if (desk() || (e.button && e.button > 0)) return; if (e.target.closest("button, a, input") && !e.target.closest("#grip")) return; ativo = true; moveu = false; y0 = e.clientY; h0 = p.offsetHeight; e.currentTarget.setPointerCapture(e.pointerId); };
    const mov = (e) => { if (!ativo) return; const dy = y0 - e.clientY; if (!moveu && Math.abs(dy) < 6) return; if (!moveu) { moveu = true; p.classList.add("arrastando"); } const a = alturasFolha(); p.style.height = Math.max(a.min, Math.min(a.alto, h0 + dy)) + "px"; };
    const fim = () => { if (!ativo) return; ativo = false; p.classList.remove("arrastando"); if (!moveu) return; const h = p.offsetHeight, a = alturasFolha(); folhaPara(["min", "baixo", "meio", "alto"].reduce((m, k) => (Math.abs(a[k] - h) < Math.abs(a[m] - h) ? k : m), "baixo")); $("#grip").dataset.arrastou = "1"; setTimeout(() => delete $("#grip").dataset.arrastou, 80); };
    for (const el of [$("#grip"), $("#pCab")]) { el.addEventListener("pointerdown", ini); el.addEventListener("pointermove", mov); el.addEventListener("pointerup", fim); el.addEventListener("pointercancel", fim); }
    $("#grip").addEventListener("click", () => { if ($("#grip").dataset.arrastou) return; folhaPara(altura === "min" ? "baixo" : altura === "baixo" ? "meio" : altura === "meio" ? "alto" : "min"); }); // toque no puxador: abre em etapas e, na última, recolhe tudo
  }
  function trocaAba(a, foco) {
    aba = a;
    for (const t of document.querySelectorAll(".abas [role=tab]")) { const on = t.dataset.aba === a; t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1; $("#aba-" + t.dataset.aba).hidden = !on; }
    if (a === "noticias") pintaNoticias(); else if (a === "cartao") pintaCartao();
    if (folha() && (altura === "baixo" || altura === "min") && !lendoURL) folhaPara("meio");
    gravaURL(false);
    if (foco) $("#t-" + a).focus();
    $("#pCorpo").scrollTop = 0; if (folha()) { const p = $("#painel"), ab = $(".abas"); if (p.scrollTop > ab.offsetTop - 28) p.scrollTop = ab.offsetTop - 28; }
  }
  function ligaUI() {
    $("#filtros").addEventListener("click", (e) => {
      const b = e.target.closest("[data-sev],[data-camada]"); if (!b) return;
      if (b.dataset.camada) { setCamada(camada === "focos" ? "alertas" : "focos"); return; }
      const n = +b.dataset.sev; filtroSev = n === filtroSev ? 0 : n; setCamada("alertas"); pintaHero(); mapa.setCor(corDe, true);
    });
    $("#c-alertas").addEventListener("click", () => setCamada("alertas")); $("#c-focos").addEventListener("click", () => setCamada("focos"));
    ligaFolha(); folhaPara("baixo");
    const abas = [...document.querySelectorAll(".abas [role=tab]")];
    for (const t of abas) t.addEventListener("click", () => trocaAba(t.dataset.aba));
    $(".abas").addEventListener("keydown", (e) => { const k = abas.findIndex((t) => t.dataset.aba === aba), d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0; if (e.key === "Home" || e.key === "End") { e.preventDefault(); trocaAba(abas[e.key === "Home" ? 0 : abas.length - 1].dataset.aba, true); } else if (d) { e.preventDefault(); trocaAba(abas[(k + d + abas.length) % abas.length].dataset.aba, true); } });
    let tr = 0; addEventListener("resize", () => { clearTimeout(tr); tr = setTimeout(() => folhaPara(altura), 120); });
    $("#zMais").addEventListener("click", () => mapa.zoomMais(1.6, mapa.w / 2, mapa.h / 2, true)); $("#zMenos").addEventListener("click", () => mapa.zoomMais(1 / 1.6, mapa.w / 2, mapa.h / 2, true));
    $("#zLoc").addEventListener("click", minhaLocal);
    $("#zBr").addEventListener("click", () => { destaquePos = -1; mapa.setDestaque(null); seleciona(-1); mapa.resetar(); pintaAgora(); });
    $("#tema").addEventListener("click", alternaTema); atualizaIconeTema();
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (!document.documentElement.dataset.tema) recolore(); });
    matchMedia(DESK).addEventListener("change", () => { folhaPara(altura); mapa.refit(); });
    document.addEventListener("keydown", (e) => { if (e.key === "/" && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) { e.preventDefault(); abreBusca(); } });
    $("#aba-agora").addEventListener("wheel", (e) => { const p = e.target.closest(".pils"); if (p && p.scrollWidth > p.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { p.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false }); // roda do mouse rola a faixa de avisos na horizontal
    $("#painel").addEventListener("click", (e) => {
      const t = e.target.closest("[data-pil],[data-alerta],[data-cid],[data-ir],[data-uf],[data-limpa],[data-tenta],[data-tema],[data-fmt],[data-baixa],[data-comp],[data-fut]"); if (!t || t === document.documentElement || !e.currentTarget.contains(t)) return; const d = t.dataset; // <html data-tema="escuro"> também casa com o seletor: ignora tudo que está fora do painel
      if (d.pil != null) { const p = +d.pil; if (sel >= 0) { pilSel = t.getAttribute("aria-expanded") === "true" ? -2 : p; pintaAgora(); } else { destaquePos = destaquePos === p ? -1 : p; mapa.setDestaque(destaquePos >= 0 ? membros[p] : null); if (destaquePos >= 0) { setCamada("alertas"); mapa.zoomLista([...membros[p]]); } pintaAgora(); } }
      else if (d.alerta != null) { const p = +d.alerta; destaquePos = destaquePos === p ? -1 : p; mapa.setDestaque(destaquePos >= 0 ? membros[p] : null); if (destaquePos >= 0) { setCamada("alertas"); mapa.zoomLista([...membros[p]]); if (folha() && altura === "alto") folhaPara("meio"); } pintaAgora(); }
      else if (d.cid != null) { seleciona(+d.cid); }
      else if (d.fut) { verFut = true; pintaAgora(); }
      else if (d.tenta === "dados") { erroDados = false; pintaAgora(); atualiza(); } else if (d.tenta === "tempo") { cacheT.delete(sel); pintaCeu(); } else if (d.tenta === "noticias") { feedN = null; cacheN.clear(); pintaNoticias(); } else if (d.ir) trocaAba(d.ir); else if (d.uf) selecionaUf(+d.uf); else if (d.limpa) { seleciona(-1); mapa.resetar(); }
      else if (d.tema) { tema = d.tema; pintaNoticias(); } else if (d.fmt) { formato = d.fmt; pintaCartao(); }
      else if (d.baixa && cartaoCv) { window.Cartao.baixa(cartaoCv, nomeArq()); aviso("Imagem baixada."); }
      else if (d.comp && cartaoCv) window.Cartao.compartilha(cartaoCv, nomeArq(), (sel >= 0 ? G.n[sel] + ": " : selUf ? NOME_UF[selUf] + ": " : "") + "alertas e focos de calor em tempo real").then((ok) => { if (!ok) { window.Cartao.baixa(cartaoCv, nomeArq()); aviso("Este navegador não compartilha imagens diretamente. A imagem foi baixada para você enviar."); } });
    });
    $("#painel").addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && (e.target.dataset.alerta != null || e.target.dataset.cid != null)) { e.preventDefault(); e.target.click(); } });
    busca();
  }
  // aviso curto sobre o mapa (localização, cópias...): some sozinho
  let tAviso = 0;
  function aviso(txt, ms = 6000) { const el = $("#avisoFlut"); el.textContent = txt; el.hidden = !txt; clearTimeout(tAviso); if (txt && ms) tAviso = setTimeout(() => { el.hidden = true; }, ms); }
  const BR = [-74.2, -34, -28.6, 5.4];
  function minhaLocal() {
    const b = $("#zLoc");
    if (!("geolocation" in navigator)) { aviso("Este navegador não informa a localização. Busque seu município pelo nome."); return; }
    b.setAttribute("aria-busy", "true"); aviso("Buscando sua localização…", 0);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lon = pos.coords.longitude, lat = pos.coords.latitude;
      if (lon < BR[0] || lon > BR[2] || lat < BR[1] || lat > BR[3]) { b.removeAttribute("aria-busy"); aviso("Sua localização está fora do Brasil. O alertabr mostra só municípios brasileiros."); return; }
      let i = -1;
      if (mapa.municipioEm) i = await mapa.municipioEm(lon, lat);
      else { let melhor = 1e9; for (let k = 0; k < G.c.length; k++) { const x0 = G.b[4 * k] / 100, y0 = G.b[4 * k + 1] / 100, x1 = G.b[4 * k + 2] / 100, y1 = G.b[4 * k + 3] / 100, a = (x1 - x0) * (y1 - y0); if (lon >= x0 && lon <= x1 && lat >= y0 && lat <= y1 && a < melhor) { melhor = a; i = k; } } }
      b.removeAttribute("aria-busy");
      if (i < 0) { aviso("Não encontramos um município brasileiro nesse ponto. Busque seu município pelo nome."); return; }
      aviso(""); seleciona(i, true);
    }, (err) => {
      b.removeAttribute("aria-busy");
      aviso(err.code === 1 ? "Você não permitiu o acesso à localização. Libere nas configurações do navegador ou busque seu município pelo nome."
        : err.code === 3 ? "A localização demorou demais para responder. Tente de novo ou busque pelo nome."
        : "Não foi possível descobrir sua localização agora. Tente de novo ou busque pelo nome.", 9000);
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
  }
  function abreBusca() { $("#barra").classList.add("buscando"); $("#q").focus(); $("#q").select(); }
  function setCamada(c) {
    if (camada === c) { pintaHero(); return; }
    camada = c; $("#c-alertas").setAttribute("aria-checked", c === "alertas"); $("#c-focos").setAttribute("aria-checked", c === "focos");
    legenda(); mapa.setCor(corDe, true); if (D) { pintaHero(); pintaAgora(); } gravaURL(false);
  }
  // ---------- tema claro/escuro ----------
  const escuroAgora = () => { const t = document.documentElement.dataset.tema; return t ? t === "escuro" : matchMedia("(prefers-color-scheme: dark)").matches; };
  function atualizaIconeTema() { const e = escuroAgora(); $("#temaIc use").setAttribute("href", e ? "#i-sol" : "#i-lua"); $("#tema").setAttribute("aria-label", e ? "Usar tema claro" : "Usar tema escuro"); }
  function recolore() { lerCores(); atualizaIconeTema(); legenda(); if (mapa) mapa.setCor(corDe); if (D) pintaCartao(); }
  function alternaTema() {
    const novo = escuroAgora() ? "claro" : "escuro"; document.documentElement.dataset.tema = novo;
    try { localStorage.setItem("alertabr-tema", novo); } catch (e) { /* sem armazenamento: vale só nesta visita */ }
    recolore();
  }

  // ---------- busca ----------
  // distância de edição com transposição (Damerau restrita), parando cedo quando passa do limite
  function dist(a, b, lim) {
    if (Math.abs(a.length - b.length) > lim) return 99;
    let p2 = null, p1 = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const c = [i]; let menor = i;
      for (let j = 1; j <= b.length; j++) {
        let v = Math.min(p1[j] + 1, c[j - 1] + 1, p1[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (p2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, p2[j - 2] + 1);
        c.push(v); if (v < menor) menor = v;
      }
      if (menor > lim) return 99; p2 = p1; p1 = c;
    }
    return p1[b.length];
  }
  function busca() {
    const inp = $("#q"), ul = $("#sug"); let achados = [], pos = -1, tb = 0;
    const fecha = () => { ul.hidden = true; inp.setAttribute("aria-expanded", "false"); pos = -1; }, fim = () => { fecha(); $("#barra").classList.remove("buscando"); };
    const pinta = () => {
      if (!achados.length) { ul.innerHTML = '<li class="sug-vazio" role="option" aria-disabled="true" id="sug-0">Nenhum município encontrado. Confira o nome ou tente só o começo.</li>'; ul.hidden = false; inp.setAttribute("aria-expanded", "true"); inp.removeAttribute("aria-activedescendant"); return; }
      if (pos >= 0) inp.setAttribute("aria-activedescendant", "sug-" + pos); else inp.removeAttribute("aria-activedescendant");
      ul.innerHTML = achados.map((i, k) => `<li role="option" id="sug-${k}" data-i="${i}" aria-selected="${k === pos}">${i < 0 ? esc(NOME_UF[-i]) + "<small>Estado · " + UFS[-i] + "</small>" : esc(G.n[i]) + "<small>" + ufDe(i) + "</small>"}</li>`).join(""); ul.hidden = !achados.length; inp.setAttribute("aria-expanded", String(!!achados.length)); };
    inp.addEventListener("input", () => { clearTimeout(tb); tb = setTimeout(() => {
      const v = norm(inp.value).trim(); if (v.length < 2) { achados = []; fecha(); return; }
      if (!porNome) porNome = G.n.map(norm);
      const a = [], b = []; for (let i = 0; i < porNome.length; i++) { const p = porNome[i].indexOf(v); if (p === 0) a.push(i); else if (p > 0) b.push(i); }
      const pri = (i) => (porNome[i] === v ? 0 : 1) + (CAPITAIS.has(G.c[i]) ? 0 : 0.5); a.sort((x, y) => pri(x) - pri(y));
      const es = Object.keys(NOME_UF).filter((c) => norm(NOME_UF[c]).startsWith(v) || norm(UFS[c]) === v).map((c) => -c); // estados primeiro (valor negativo = código do estado)
      achados = es.concat(a, b);
      if (achados.length < 8 && v.length >= 4) { // erro leve de digitação ("sao paolo", "florianopolsi"): distância de edição até 1 (até 2 em nomes longos)
        const lim = v.length >= 8 ? 2 : 1, ja = new Set(achados), perto = [];
        for (let i = 0; i < porNome.length; i++) { if (ja.has(i)) continue; const n = porNome[i], d = Math.min(dist(v, n, lim), n.length > v.length ? dist(v, n.slice(0, v.length), lim) : 99); if (d <= lim) perto.push([d, CAPITAIS.has(G.c[i]) ? 0 : 1, i]); }
        perto.sort((x, y) => x[0] - y[0] || x[1] - y[1]); achados = achados.concat(perto.map((x) => x[2]));
      }
      achados = achados.slice(0, 8); pos = -1; pinta(); }, 80); });
    inp.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { if (ul.hidden && inp.value) inp.dispatchEvent(new Event("input")); pos = Math.min(achados.length - 1, pos + 1); pinta(); e.preventDefault(); } else if (e.key === "ArrowUp") { pos = Math.max(0, pos - 1); pinta(); e.preventDefault(); }
      else if (e.key === "Enter" && achados.length) { const v = achados[pos < 0 ? 0 : pos]; v < 0 ? selecionaUf(-v) : seleciona(v); fim(); inp.blur(); } else if (e.key === "Escape") { fim(); inp.blur(); }
    });
    ul.addEventListener("mousedown", (e) => { const li = e.target.closest("li[data-i]"); if (li) { e.preventDefault(); const v = +li.dataset.i; v < 0 ? selecionaUf(-v) : seleciona(v); fim(); inp.blur(); } });
    inp.addEventListener("blur", () => setTimeout(fim, 150));
  }
  if ("serviceWorker" in navigator) {
    if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
    else addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => { /* sem service worker: o site funciona igual, só não instala offline */ }));
  }
  window.alertabr = { get mapa() { return mapa; } }; // gancho para depuração/medição
  init();
})();

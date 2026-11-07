/* alertabr: lógica da página. Sem framework, sem build. */
(function () {
  const CFG = window.ALERTABR, $ = (s) => document.querySelector(s);
  const UFS = { 11: "RO", 12: "AC", 13: "AM", 14: "RR", 15: "PA", 16: "AP", 17: "TO", 21: "MA", 22: "PI", 23: "CE", 24: "RN", 25: "PB", 26: "PE", 27: "AL", 28: "SE", 29: "BA", 31: "MG", 32: "ES", 33: "RJ", 35: "SP", 41: "PR", 42: "SC", 43: "RS", 50: "MS", 51: "MT", 52: "GO", 53: "DF" };
  const NOME_SEV = window.Cartao.NOME_SEV, SEV_CURTO = { 1: "Potencial", 2: "Perigo", 3: "Grande" };
  let COR_SEV = {}, COR_FOGO = [];
  function lerCores() { // as cores do mapa vêm das variáveis CSS do tema atual (claro/escuro)
    const cs = getComputedStyle(document.documentElement), v = (n) => cs.getPropertyValue(n).trim();
    COR_SEV = { 0: v("--map-neutro"), 1: v("--s-1"), 2: v("--s-2"), 3: v("--s-3") };
    COR_FOGO = [v("--map-neutro"), "#ffc27a", "#ff9a3c", "#f2641a", "#c8311a", "#7d1410"]; // 0, 1, 2-3, 4-9, 10-24, 25+
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

  let filtroSev = 0, pilSel = -1, ultimoCeu = "", verFut = false, G = null, E = null, mapa = null, D = null, camada = "alertas", sel = -1, destaquePos = -1, fonteOk = 0, formato = "post", tema = "todos", timer = 0, semDados = true;
  const NOME_UF = { 11: "Rondônia", 12: "Acre", 13: "Amazonas", 14: "Roraima", 15: "Pará", 16: "Amapá", 17: "Tocantins", 21: "Maranhão", 22: "Piauí", 23: "Ceará", 24: "Rio Grande do Norte", 25: "Paraíba", 26: "Pernambuco", 27: "Alagoas", 28: "Sergipe", 29: "Bahia", 31: "Minas Gerais", 32: "Espírito Santo", 33: "Rio de Janeiro", 35: "São Paulo", 41: "Paraná", 42: "Santa Catarina", 43: "Rio Grande do Sul", 50: "Mato Grosso do Sul", 51: "Mato Grosso", 52: "Goiás", 53: "Distrito Federal" };
  let selUf = 0, ufIdx = null; // selUf: visão do estado inteiro (resumo + notícias), quando nenhum município está selecionado
  const codUf = (i) => Math.floor(G.c[i] / 100000), idxUf = (c) => { if (!ufIdx) { ufIdx = {}; G.c.forEach((_, i) => (ufIdx[codUf(i)] || (ufIdx[codUf(i)] = [])).push(i)); } return ufIdx[c] || []; };
  let membros = [], porNome = null, cartaoCv = null; const sujo = { n: true, c: true };
  const DESK = "(min-width:1000px) and (min-height:560px)", desk = () => matchMedia(DESK).matches, folha = () => !desk(); // desktop: cartões soltos sobre o mapa; resto: cartões embaixo + folha
  const CAPITAIS = new Set([1100205, 1200401, 1302603, 1400100, 1501402, 1600303, 1721000, 2111300, 2211001, 2304400, 2408102, 2507507, 2611606, 2704302, 2800308, 2927408, 3106200, 3205309, 3304557, 3550308, 4106902, 4205407, 4314902, 5002704, 5103403, 5208707, 5300108]); // capitais aparecem primeiro na busca e no mapa

  // espaço livre para o mapa entre os cartões (o mapa em si ocupa a tela inteira)
  function insets() {
    const W = innerWidth, H = innerHeight, R = (s) => { const e = $(s); return e && e.offsetParent !== null ? e.getBoundingClientRect() : null; }, res = R("#resumo"), t = res ? res.bottom + 8 : 60;
    if (desk()) { const e = R("#aba-agora"), d = R("#aba-noticias"), ad = R(".anuncio"); return { l: e ? e.right + 12 : 0, r: d ? W - d.left + 12 : 0, t, b: 40 + (ad ? ad.height : 0) }; }
    const p = $("#painel").getBoundingClientRect(), c = R(".ceu"), l = R(".lista, .detalhe");
    if (matchMedia("(max-height:559px) and (orientation:landscape)").matches) { const g = R(".grip"); return { l: c ? c.right + 8 : 0, r: l ? W - l.left + 8 : 0, t, b: g ? H - g.top + 6 : 8 }; }
    return { l: 0, r: 0, t, b: $("#painel").classList.contains("alto") ? 0 : Math.max(0, H - p.top + 8) };
  }

  // ---------- carregar ----------
  const json = (u, ms = 12000) => fetch(u, { signal: AbortSignal.timeout(ms) }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
  async function init() {
    try { [G, E] = await Promise.all([json("data/municipios.json", 30000), json("data/estados.json", 30000)]); }
    catch (e) { $("#carrega").textContent = "Não foi possível carregar o mapa. Recarregue a página."; return; }
    const GL = !!(window.MapaGL && window.MapaGL.suportado()), Mapa = GL ? window.MapaGL : window.MapaBrasil;
    mapa = new Mapa($("#mapa"), G, E, { cor: corDe, aoClicar: aoClicar, aoPassar: aoPassar, insets: insets, capitais: CAPITAIS, aoPronto: () => $("#carrega").classList.add("ok") });
    if (!GL) { mapa.prio = new Set([...CAPITAIS].map((c) => G.c.indexOf(c)).filter((k) => k >= 0)); $("#carrega").classList.add("ok"); }
    legenda(); pintaAgora(); ligaUI();
    const h = /#m=(\d{7})/.exec(location.hash), hu = /#uf=(\d{2})/.exec(location.hash); if (/[?&]camada=focos/.test(location.search)) setCamada("focos"); await atualiza(true); mapa.refit();
    if (h) { const i = G.c.indexOf(+h[1]); if (i >= 0) seleciona(i); } else if (hu && NOME_UF[+hu[1]]) selecionaUf(+hu[1]);
    ciclo();
  }
  function validado(j) { return j && j.v === 1 && Array.isArray(j.s) && j.s.length === G.c.length && Array.isArray(j.f) ? j : null; }
  async function atualiza(primeira) {
    const emLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && !/[?&]feed=1/.test(location.search); // no seu computador: usa o arquivo local (veja o README)
    const urls = emLocal ? [CFG.LOCAL] : [CFG.FEED && CFG.FEED + "?v=" + Math.floor(Date.now() / 30000), CFG.RESERVA, CFG.LOCAL].filter(Boolean);
    for (let k = 0; k < urls.length; k++) {
      const u = urls[(fonteOk + k) % urls.length];
      try {
        const j = validado(await json(u, 10000)); if (!j) continue;
        fonteOk = (fonteOk + k) % urls.length;
        // um arquivo local mais velho que o que já temos não substitui os dados
        if (D && j.gerado <= D.gerado) { status(); return; }
        D = j; semDados = false; montaMembros(); mapa.setCor(corDe, true); mapa.setDestaque(destaquePos >= 0 ? membros[destaquePos] : null); legenda(); pintaHero(); pintaAgora(); pintaCartao(); if (sujo.n) pintaNoticias(); status(); return;
      } catch (e) { /* tenta a próxima fonte */ }
    }
    if (primeira || semDados) status("erro");
  }
  function ciclo() {
    clearTimeout(timer);
    timer = setTimeout(async () => { if (!document.hidden) await atualiza(); ciclo(); }, CFG.INTERVALO);
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && D && Date.now() - D.gerado > CFG.INTERVALO) atualiza(); });
  function montaMembros() { membros = D.alertas.map(() => new Set()); for (const i in D.m) for (const p of D.m[i]) membros[p] && membros[p].add(+i); }
  function status(forca) {
    const els = [$("#status"), $("#vivo")], t = $("#vivoTxt"); els.forEach((e) => e.classList.remove("velho", "erro"));
    if (!D) { els.forEach((e) => e.classList.add("erro")); t.textContent = "sem dados"; return; }
    const idade = Date.now() - D.gerado, fora = ["inmet", "inpe"].filter((k) => D.fontes[k] && !D.fontes[k].ok);
    if (forca === "erro" || idade > CFG.VELHO) els.forEach((e) => e.classList.add("velho"));
    const txt = (idade > CFG.VELHO ? "Dados de " : "Ao vivo · ") + ha(D.gerado) + (fora.length ? " · " + fora.map((x) => x.toUpperCase()).join(", ") + " fora do ar" : "");
    t.textContent = txt; $("#stTxt").textContent = txt; $("#status").title = txt;
  }
  setInterval(() => { if (D && !document.hidden) status(); }, 30000);

  // ---------- números grandes (que também filtram o mapa) ----------
  function pintaHero() {
    if (!D) return; const r = resumoBr(regiaoAtual()), tot = r.tot, soma = r.sev[1] + r.sev[2] + r.sev[3];
    $("#n3").textContent = fmt(r.sev[3]); $("#n2").textContent = fmt(r.sev[2]); $("#n1").textContent = fmt(r.sev[1]); $("#nF").textContent = fmt(r.focos);
    $("#bb3").style.width = (r.sev[3] / tot * 100) + "%"; $("#bb2").style.width = (r.sev[2] / tot * 100) + "%"; $("#bb1").style.width = (r.sev[1] / tot * 100) + "%";
    document.querySelectorAll("#filtros [data-sev]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.sev === filtroSev && camada === "alertas")));
    $("#filtros [data-camada]").setAttribute("aria-pressed", String(camada === "focos"));
    if (sel >= 0) {
      const al = alertasDe(sel).filter((x) => x.h === 0), foc = D.f[sel];
      $("#hTitulo").textContent = G.n[sel] + " · " + ufDe(sel);
      $("#hSub").innerHTML = `<b>${al.length}</b> aviso${al.length === 1 ? "" : "s"} do INMET hoje · <b>${fmt(foc)}</b> foco${foc === 1 ? "" : "s"} de calor nas últimas 24 h`;
    } else {
      $("#hTitulo").textContent = selUf ? NOME_UF[selUf] + " agora" : "Brasil agora";
      $("#hSub").innerHTML = `<b>${fmt(soma)}</b> de ${fmt(tot)} municípios (${(soma / tot * 100).toFixed(1).replace(".", ",")} %) com aviso do INMET hoje · <b>${fmt(r.focos)}</b> focos de calor em 24 h`;
    }
  }

  // ---------- cores e legenda ----------
  function corDe(i) { if (!D) return COR_SEV[0]; if (camada === "alertas") { const s = D.s[i]; return filtroSev && s !== filtroSev ? COR_SEV[0] : COR_SEV[s]; } return COR_FOGO[balde(D.f[i])]; }
  function legenda() {
    const l = $("#leg"), li = (c, t) => `<div><i style="background:${c}"></i>${t}</div>`;
    l.innerHTML = camada === "alertas" ? li(COR_SEV[3], "Grande perigo") + li(COR_SEV[2], "Perigo") + li(COR_SEV[1], "Perigo potencial") + li(COR_SEV[0], "Sem aviso hoje")
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
        h += al.length ? al.slice(0, 2).map((x) => `<div class="tip-l"><span class="tag" style="--c:${esc(x.cor)}">${NOME_SEV[x.sev] || ""}</span>${esc(x.t)}</div>`).join("") + (al.length > 2 ? `<div class="tip-s">+${al.length - 2} aviso${al.length > 3 ? "s" : ""}</div>` : "") : '<div class="tip-s">Sem aviso do INMET hoje</div>';
        h += `<div class="tip-l"><b style="color:var(--fogo)">${fmt(foc)}</b>&nbsp;foco${foc === 1 ? "" : "s"} de calor em 24 h</div>`;
      }
      tip.innerHTML = h + '<div class="tip-s tip-d">Clique para ver detalhes</div>';
    }
    tip.hidden = false; const m = $("#mapa"), w = tip.offsetWidth, hh = tip.offsetHeight;
    tip.style.left = Math.max(6, Math.min(px + 14, m.clientWidth - w - 6)) + "px"; tip.style.top = Math.max(6, py + hh + 24 > m.clientHeight ? py - hh - 12 : py + 14) + "px";
  }
  function seleciona(i, semZoom) {
    sel = i; selUf = 0; destaquePos = -1; pilSel = -1; verFut = false; mapa.setDestaque(null); mapa.setSel(i);
    if (i >= 0) { if (folha() && $("#painel").classList.contains("alto")) painelAltura("meio"); history.replaceState(null, "", "#m=" + G.c[i]); if (!semZoom) mapa.zoomPara(i); } else history.replaceState(null, "", location.pathname);
    $("#q").value = i >= 0 ? G.n[i] : ""; pintaHero(); pintaAgora(); pintaNoticias(); pintaCartao();
  }
  function selecionaUf(cod) { // visão do estado: resumo, avisos, focos e notícias só dele
    sel = -1; selUf = cod; destaquePos = -1; pilSel = -1; verFut = false; mapa.setDestaque(null); mapa.setSel(-1);
    if (folha() && $("#painel").classList.contains("alto")) painelAltura("meio");
    history.replaceState(null, "", "#uf=" + cod); mapa.zoomLista(idxUf(cod)); $("#q").value = NOME_UF[cod];
    pintaHero(); pintaAgora(); pintaNoticias(); pintaCartao();
  }
  function alertasDe(i) { return D && D.m[i] ? D.m[i].map((p) => D.alertas[p]).filter(Boolean) : []; }

  // ---------- cartões da esquerda: céu animado + lista ----------
  function resumoBr(cod = 0) { // cod = 0: Brasil; senão, só os municípios daquele estado
    const ix = cod ? idxUf(cod) : null, c = { 1: 0, 2: 0, 3: 0 }, top = []; let focos = 0;
    const cada = (i) => { const s = D.s[i]; if (s) c[s]++; if (D.f[i] > 0) { top.push(i); focos += D.f[i]; } };
    if (ix) ix.forEach(cada); else for (let i = 0; i < D.s.length; i++) cada(i);
    top.sort((a, b) => D.f[b] - D.f[a]);
    return { sev: c, focos: cod ? focos : D.resumo.focos, tot: ix ? ix.length : G.c.length, top: top.slice(0, 8).map((i) => ({ i, nome: G.n[i], uf: ufDe(i), n: D.f[i] })), fmt, ...(cod ? { sufixo: NOME_UF[cod], rot: "PANORAMA · " + UFS[cod] } : {}) };
  }
  const regiaoAtual = () => (sel < 0 ? selUf : 0);
  // tipo de "céu" pelo nome do aviso do INMET
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
  const rng = (s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  function camadasCeu(tipo) { // fundo animado: chuva, raios, neve, sol, vento ou brasas (só transform/opacity, poucos elementos)
    const r = rng(tipo.length * 977 + tipo.charCodeAt(0)), R = (x, y) => x + r() * (y - x), P = (n, d = 1) => n.toFixed(d); let h = "";
    h += '<svg class="c-n n1" viewBox="0 0 112 76"><use href="#i-nuvem"/></svg><svg class="c-n n2" viewBox="0 0 112 76"><use href="#i-nuvem"/></svg><svg class="c-n n3" viewBox="0 0 112 76"><use href="#i-nuvem"/></svg>';
    if (tipo === "chuva" || tipo === "tempestade") {
      const n = tipo === "tempestade" ? 34 : 26;
      for (let k = 0; k < n; k++) h += `<i class="gt" style="left:${P(R(0, 100))}%;--h:${P(R(22, 58), 0)}px;--o:${P(R(.25, .8), 2)};--t:${P(R(.6, 1.3), 2)}s;--d:-${P(R(0, 1.4), 2)}s"></i>`;
      for (let k = 0; k < 9; k++) h += `<b class="gota" style="left:${P(R(2, 96))}%;top:${P(R(4, 92))}%;--s:${P(R(4, 9), 0)}px;--d:-${P(R(0, 5), 1)}s"></b>`;
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
    if (tipo === "sol" || tipo === "limpo") s = '<svg viewBox="0 0 120 92" aria-hidden="true"><defs><radialGradient id="gs" cx=".38" cy=".35"><stop offset="0" stop-color="#fff3b8"/><stop offset="1" stop-color="#ffb62e"/></radialGradient></defs><g class="rs" stroke="#ffc93d" stroke-width="5" stroke-linecap="round">' + [...Array(12)].map((_, k) => `<path d="M60 46 m0 -34 v-8" transform="rotate(${k * 30} 60 46)"/>`).join("") + '</g><circle cx="60" cy="46" r="22" fill="url(#gs)"/></svg>';
    else if (tipo === "fogo") s = '<svg viewBox="0 0 24 24" fill="#ffb15c" stroke="#ff7a1a" stroke-width="1.1" stroke-linejoin="round" aria-hidden="true"><use href="#i-fogo"/></svg>';
    else if (tipo === "chuva") s = `<svg viewBox="0 0 120 92" aria-hidden="true">${nuv}<path d="M42 82v7M60 80v8M78 82v7" stroke="#a9c4ee" stroke-width="3.6" stroke-linecap="round"/></svg>`;
    else if (tipo === "tempestade") s = `<svg viewBox="0 0 120 92" aria-hidden="true">${nuv}<path d="M66 58 50 80h11l-4 12 20-24H64l4-10z" fill="#ffc83d"/></svg>`;
    else if (tipo === "vento") s = `<svg viewBox="0 0 120 92" aria-hidden="true">${nuv}<path d="M18 84h56M40 90h44" stroke="rgba(255,255,255,.75)" stroke-width="3.6" stroke-linecap="round"/></svg>`;
    else s = `<svg viewBox="0 0 120 92" aria-hidden="true">${nuv}</svg>`;
    return `<div class="c-ico">${s}</div>`;
  }
  function ceu(o) { // cartão de vidro sobre o céu animado
    const ani = ultimoCeu !== o.chave; ultimoCeu = o.chave;
    return `<section class="ceu ${o.tipo}${ani ? " ani" : ""}" aria-label="${esc(o.aria)}">${camadasCeu(o.tipo)}
      <div class="cab"><span><svg class="ic"><use href="#i-pino"/></svg>${esc(o.local)}</span><small>${esc(o.hora)}</small></div>
      <div class="num-g"><div class="gr">${o.gr}${o.unid ? `<sup>${esc(o.unid)}</sup>` : ""}</div>${icoCeu(o.tipo)}</div>
      <div class="pal">${esc(o.palavra)}${o.sub ? `<small>${esc(o.sub)}</small>` : ""}</div>
      <div class="blocos">${o.blocos.map((b) => `<div class="bl"><span>${esc(b[0])}</span><b>${b[1]}</b></div>`).join("")}</div>
      ${o.pils.length ? `<div class="pils" role="group" aria-label="Avisos">${o.pils.map((p) => `<button type="button" class="pil${p.on ? " on" : ""}" data-pil="${p.pos}" aria-pressed="${p.on}"><svg class="ic"><use href="#i-${ICONE[tipoCeu(p.a)]}"/></svg><em>${esc(p.a.t)}</em><b>${esc(p.txt)}</b></button>`).join("")}</div>` : ""}
    </section>`;
  }
  const RODAPE = '<footer class="rodape">Dados: <a href="https://alertas2.inmet.gov.br/" target="_blank" rel="noopener">INMET</a> · <a href="https://terrabrasilis.dpi.inpe.br/queimadas/portal/" target="_blank" rel="noopener">INPE Queimadas</a> · malhas <a href="https://www.ibge.gov.br/" target="_blank" rel="noopener">IBGE</a> · <a href="https://www.gdacs.org/" target="_blank" rel="noopener">GDACS</a> · <a href="https://earthquake.usgs.gov/" target="_blank" rel="noopener">USGS</a> · notícias dos veículos citados. <a href="sobre.html">Sobre</a> · <a href="privacidade.html">Privacidade</a>. Em emergência ligue <b>199</b> ou <b>193</b>.</footer>';
  const horaTxt = () => new Date(D.gerado).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  function pintaAgora() {
    const el = $("#aba-agora"); if (!D) { el.innerHTML = '<p class="vazio esq">Buscando os dados mais recentes…</p>'; return; }
    el.innerHTML = (sel >= 0 ? municipio(sel) : brasil()) + RODAPE;
    requestAnimationFrame(cabeLista);
  }
  // a lista nunca rola: mostra as linhas que cabem e resume o resto
  function cabeLista() {
    const l = $("#aba-agora .lista"); if (!l) return; l.querySelectorAll(".mais-n").forEach((e) => e.remove()); if (desk()) { l.querySelectorAll(".rw").forEach((x) => { x.hidden = false; }); return; } // desktop: a lista rola
    const rows = [...l.querySelectorAll(".rw")]; rows.forEach((r) => { r.hidden = false; }); if (!l.clientHeight) return;
    const lim = l.clientHeight - 34; let n = 0;
    for (const r of rows) if (r.offsetTop + r.offsetHeight > lim) { r.hidden = true; n++; }
    if (n) { const d = document.createElement("div"); d.className = "mais-n"; d.textContent = "+ " + n + " no painel completo (Ver tudo)"; if (desk()) d.textContent = "+ " + n + " — toque no mapa para ver por cidade"; l.appendChild(d); }
  }
  function cabeNoticias() { // no desktop as notícias não rolam: entram as que cabem
    const el = $("#aba-noticias"); if (!el || !desk()) return; return; const it = [...el.querySelectorAll(".not")]; it.forEach((n) => { n.hidden = false; }); if (!el.clientHeight) return;
    const lim = el.clientHeight - 12; for (const n of it) if (n.offsetTop + n.offsetHeight > lim) n.hidden = true;
  }
  let tr = 0; addEventListener("resize", () => { clearTimeout(tr); tr = setTimeout(() => { cabeLista(); cabeNoticias(); }, 120); });
  const linhaAviso = ([a, p]) => `<div class="rw${p === destaquePos ? " on" : ""}" style="--c:${esc(a.cor)}" data-alerta="${p}" tabindex="0" role="button"><i></i><span>${esc(a.t)}<small>${NOME_SEV[a.sev] || ""} · ${esc(a.uf)}</small></span><b>${fmt(a.n)}</b></div>`;
  function brasil() {
    const cod = selUf, nomeR = cod ? NOME_UF[cod] : "Brasil", r = resumoBr(cod), tot = r.tot, soma = r.sev[1] + r.sev[2] + r.sev[3];
    // no estado, cada aviso conta só os municípios daquele estado
    const todos = D.alertas.map((a, p) => { if (!cod) return [a, p]; let n = 0; for (const i of membros[p] || []) if (codUf(i) === cod) n++; return n ? [{ ...a, n }, p] : null; }).filter(Boolean);
    const hoje = todos.filter(([a]) => a.h === 0), fut = todos.filter(([a]) => a.h === 1), voltar = cod ? '<button type="button" class="btn sec mini" data-limpa="1">← Brasil</button>' : "";
    const topo = destaquePos >= 0 ? D.alertas[destaquePos] : (hoje[0] && hoje[0][0]);
    const tipo = camada === "focos" ? "fogo" : topo ? tipoCeu(topo) : "limpo";
    const c = ceu({
      chave: "br|" + cod + "|" + tipo + "|" + destaquePos + "|" + camada, tipo, aria: "Resumo de " + nomeR, local: nomeR, hora: horaTxt(),
      gr: camada === "focos" ? fmt(r.focos) : (soma / tot * 100).toFixed(1).replace(".", ","), unid: camada === "focos" ? "" : "%",
      palavra: camada === "focos" ? "Focos de calor" : topo ? topo.t : "Sem avisos hoje", sub: camada === "focos" ? "detecções de satélite em 24 h" : topo ? NOME_SEV[topo.sev] + " · " + fmt((todos.find(([, p]) => D.alertas[p] === topo) || [topo])[0].n) + " municípios" : "nenhum aviso ativo do INMET",
      blocos: [["Grande", fmt(r.sev[3])], ["Perigo", fmt(r.sev[2])], ["Focos 24h", fmt(r.focos)]],
      pils: hoje.map(([a, p]) => ({ a, pos: p, on: p === destaquePos, txt: fmt(a.n) })),
    });
    const lista = camada === "focos"
      ? `<section class="lista"><h3 class="h-vol"><span>Municípios com mais focos (24 h)</span>${voltar}</h3>${r.top.length ? r.top.map((t) => `<div class="rw" style="--c:var(--fogo)" data-cid="${t.i}" tabindex="0" role="button"><i></i><span>${esc(t.nome)}<small>${t.uf}</small></span><b>${fmt(t.n)}</b></div>`).join("") : '<p class="vazio">Sem focos registrados.</p>'}</section>`
      : `<section class="lista"><h3 class="h-vol"><span>Avisos de hoje (${hoje.length})</span>${voltar}</h3>${hoje.length ? hoje.map(linhaAviso).join("") : '<p class="vazio">Nenhum aviso ativo hoje.</p>'}${fut.length ? (verFut ? `<h3 style="margin-top:10px">Próximos dias (${fut.length})</h3>` + fut.map(linhaAviso).join("") : `<button type="button" class="mais" data-fut="1">+ ${fut.length} nos próximos dias</button>`) : ""}</section>`;
    return c + lista;
  }
  function municipio(i) {
    // avisos de HOJE vêm primeiro; dentro de cada dia, o mais grave
    const pos = (D.m[i] || []).slice().sort((x, y) => D.alertas[x].h - D.alertas[y].h || D.alertas[y].sev - D.alertas[x].sev);
    const ativoPos = pos.includes(pilSel) ? pilSel : pos[0], at = ativoPos != null ? D.alertas[ativoPos] : null, foc = D.f[i], hojeN = pos.filter((p) => D.alertas[p].h === 0).length;
    const comFoco = camada === "focos" || !at;
    const tipo = camada === "focos" && foc > 0 ? "fogo" : at ? tipoCeu(at) : foc > 0 ? "fogo" : "limpo";
    const c = ceu({
      chave: "m|" + i + "|" + tipo + "|" + ativoPos + "|" + camada, tipo, aria: "Situação em " + G.n[i], local: G.n[i] + " · " + ufDe(i), hora: horaTxt(),
      gr: comFoco && foc > 0 ? fmt(foc) : String(hojeN), unid: comFoco && foc > 0 ? (foc === 1 ? "foco" : "focos") : hojeN === 1 ? "aviso" : "avisos",
      palavra: at ? at.t : foc > 0 ? "Focos de calor" : "Sem aviso hoje", sub: at ? (at.h ? "previsto para " + diaTxt(at.ini) : NOME_SEV[at.sev]) : foc > 0 ? "detecções de satélite em 24 h" : "nenhum aviso do INMET ativo",
      blocos: [["Gravidade", at ? SEV_CURTO[at.sev] : "–"], ["Focos 24h", fmt(foc)], ["Potência", D.frp[i] ? fmt(D.frp[i]) + " <small>MW</small>" : "–"]],
      pils: pos.map((p) => ({ a: D.alertas[p], pos: p, on: p === ativoPos, txt: D.alertas[p].h ? diaTxt(D.alertas[p].ini) : SEV_CURTO[D.alertas[p].sev] })),
    });
    const det = at ? `<div class="card" style="--c:${esc(at.cor)}"><h4><span>${esc(at.t)}</span><small>${at.h ? diaTxt(at.ini) : "hoje"}</small></h4><p><span class="tag">${NOME_SEV[at.sev] || ""}</span>${janela(at.ini)} → ${janela(at.fim)}</p>${at.r[0] ? `<p class="clamp3">${esc(at.r[0])}</p>` : ""}${at.i.length ? `<div class="instr"><b>O que fazer:</b> <span class="clamp2">${esc(at.i.slice(0, 2).join(" "))}</span></div>` : ""}</div>` : '<p class="vazio">Nenhum aviso do INMET ativo para este município.</p>';
    return c + `<section class="detalhe">${det}<div class="fila"><button class="btn" data-ir="cartao">Gerar cartão</button><button class="btn sec" data-ir="noticias">Notícias</button><button class="btn sec" data-uf="${codUf(i)}">Estado ${ufDe(i)}</button><button class="btn sec" data-limpa="1">Brasil</button></div></section>`;
  }

  // ---------- cartão da direita: notícias ----------
  // Fonte principal: noticias.json (feeds de veículos e órgãos lidos pelo relay, já filtrados por assunto e ligados aos municípios).
  // Complemento: /api/noticias (Google Notícias/Bing), que preenche o que faltar. O mesmo filtro de assunto vale para os dois.
  const TEMAS = { todos: '(chuva OR alagamento OR queimada OR incêndio OR "Defesa Civil" OR temporal OR seca)', chuva: "(chuva OR alagamento OR enchente OR temporal OR deslizamento)", fogo: '(queimada OR incêndio OR "foco de calor" OR fumaça)', calor: '("onda de calor" OR seca OR "baixa umidade" OR geada OR "frio intenso")', outros: "(terremoto OR tremor OR ciclone OR tornado OR vendaval OR granizo OR ressaca)" };
  const CHIPS = [["todos", "Tudo"], ["chuva", "Chuva"], ["fogo", "Queimadas"], ["calor", "Calor, frio e seca"], ["outros", "Outros riscos"]];
  const cacheN = new Map(), tabletCards = () => matchMedia("(min-width:600px) and (max-width:999px) and (min-height:800px)").matches, secundariaVisivel = () => desk() || $("#painel").classList.contains("alto"), noticiasVisivel = () => secundariaVisivel() || tabletCards();
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
  function listaDoFeed(j) { // monta a ordem: o do município, depois o do estado, depois o do Brasil
    const t = tema, uf = sel >= 0 ? Math.floor(G.c[sel] / 100000) : 0, est = sel < 0 ? selUf : 0;
    const ok = (n) => t === "todos" || n.tm.includes(t), ate = Date.now() - 4 * 864e5;
    const itens = (j.itens || []).filter((n) => ok(n) && n.d > ate);
    const ev = (j.eventos || []).filter((e) => t === "outros" || (t === "todos" ? e.nv >= 2 : e.tm.includes(t) && e.nv >= 2));
    if (est) return { principal: semRepetidos([...ev.filter((e) => t === "outros"), ...itens.filter((n) => n.s.includes(est))].sort((a, b) => (b.nv || 0) - (a.nv || 0) || b.d - a.d)), extra: [] };
    if (sel < 0) return { principal: semRepetidos([...ev, ...itens].sort((a, b) => (b.nv || 0) - (a.nv || 0) || b.d - a.d)), extra: [] };
    const loc = itens.filter((n) => n.m.includes(sel)), doEstado = itens.filter((n) => !n.m.includes(sel) && n.s.includes(uf));
    return { principal: loc, extra: semRepetidos([...ev.filter((e) => t === "outros"), ...doEstado]) };
  }
  function pintaNoticias() {
    if (!noticiasVisivel()) { sujo.n = true; return; } sujo.n = false;
    const el = $("#aba-noticias"), local = sel >= 0, est = sel < 0 ? selUf : 0, ch = sel + "|" + selUf + "|" + tema, nome = local ? G.n[sel] : "", sigla = local ? ufDe(sel) : "";
    el.innerHTML = `<h3>${local ? "Notícias · " + esc(nome) : "Notícias · " + (est ? esc(NOME_UF[est]) : "Brasil")}</h3><div class="chips">${CHIPS.map(([k, n]) => `<button data-tema="${k}" aria-pressed="${tema === k}">${n}</button>`).join("")}</div><div id="listaN"><p class="vazio esq">Buscando notícias…</p></div>`;
    const q = (local ? `"${nome}" ${sigla} ` : est ? `"${NOME_UF[est]}" ` : "") + TEMAS[tema];
    let feed = undefined, api = undefined; // undefined = ainda carregando; null = falhou
    const item = (n) => `<a class="not" href="${esc(n.u)}" target="_blank" rel="noopener noreferrer"><b>${esc(n.t)}</b><small>${esc(n.f || "")}${n.o ? " · oficial" : ""}${n.d ? " · " + ha(n.d) : ""}${n.n > 1 ? " · " + n.n + " fontes" : ""}</small></a>`;
    const desenha = () => {
      const L = $("#listaN"); if (!L || ch !== sel + "|" + selUf + "|" + tema) return;
      if (feed === undefined && api === undefined) return;
      const f = feed ? listaDoFeed(feed) : { principal: [], extra: [] }, a = (api && api.itens) || [];
      // município: o que cita a cidade vem primeiro (feeds, depois busca); sem nada local, mostra o estado e avisa
      const ap = local ? a.filter((n) => norm(n.t).includes(norm(nome))) : a;
      let lista = semRepetidos(local ? [...f.principal, ...ap] : [...f.principal, ...a].sort((x, y) => (y.nv || 0) - (x.nv || 0) || y.d - x.d));
      let aviso = "";
      if (lista.length < 3 && local && f.extra.length) { aviso = `<p class="vazio esq">Pouca coisa sobre ${esc(nome)}. Mais notícias em ${esc(sigla)}:</p>`; lista = semRepetidos([...lista, ...f.extra]); }
      lista = lista.slice(0, desk() ? 15 : 7);
      if ((feed === undefined || api === undefined) && !lista.length) return; // espera o outro lado antes de dizer que não há nada
      const falhou = feed === null && (api === null || (api && api.erro));
      L.innerHTML = lista.length ? aviso + lista.map(item).join("") : `<p class="vazio">Nenhuma notícia recente sobre o assunto${falhou ? " (fontes indisponíveis agora)" : ""}.</p><a class="btn sec" style="display:inline-flex;align-items:center;margin:4px" href="https://news.google.com/search?q=${encodeURIComponent(q)}&hl=pt-BR&gl=BR&ceid=BR:pt-419" target="_blank" rel="noopener noreferrer">Buscar no Google Notícias</a>`;
      cabeNoticias();
    };
    carregaFeed().then((j) => { feed = j; desenha(); });
    const c = cacheN.get(q); if (c && Date.now() - c.t < 600000) { api = c.j; desenha(); return; }
    json("/api/noticias?q=" + encodeURIComponent(q), 15000).then((j) => { cacheN.set(q, { t: Date.now(), j }); if (cacheN.size > 40) cacheN.delete(cacheN.keys().next().value); api = j; desenha(); }).catch(() => { api = null; desenha(); });
  }

  // ---------- cartão da direita: imagem para compartilhar ----------
  function dadosCartao() {
    if (sel < 0) { const r = resumoBr(selUf); return { formato, nacional: r, gerado: D.gerado }; }
    const al = alertasDe(sel).filter((a) => a.h === 0).sort((a, b) => b.sev - a.sev)[0], foc = D.f[sel];
    if (!al && !foc) return null;
    return { formato, nome: G.n[sel], uf: ufDe(sel), alerta: al || null, focos: foc, forma: mapa.forma(sel), gerado: D.gerado };
  }
  function pintaCartao() {
    if (!D) return; if (!secundariaVisivel()) { sujo.c = true; return; } sujo.c = false;
    const el = $("#aba-cartao"), d = dadosCartao();
    el.innerHTML = `<h3>Cartão para compartilhar · ${sel >= 0 ? esc(G.n[sel]) : selUf ? esc(NOME_UF[selUf]) : "Brasil"}</h3>
      <div class="chips"><button data-fmt="post" aria-pressed="${formato === "post"}">Post 1:1</button><button data-fmt="stories" aria-pressed="${formato === "stories"}">Stories 9:16</button></div>
      ${d ? '<div class="cartao-l"><div id="prev"></div><div class="acoes"><button class="btn" data-baixa="1">Baixar PNG</button><button class="btn sec" data-comp="1">Compartilhar</button></div></div>' : '<p class="vazio">Sem aviso nem foco de calor neste município agora, então não há o que divulgar.</p>'}`;
    if (!d) { cartaoCv = null; return; }
    cartaoCv = window.Cartao.gera(d); const img = new Image(); img.className = "previa"; img.alt = "Prévia do cartão"; img.src = cartaoCv.toDataURL("image/jpeg", 0.85); $("#prev").appendChild(img);
  }
  const nomeArq = () => "alertabr-" + (sel >= 0 ? norm(G.n[sel]).replace(/[^a-z0-9]+/g, "-") : selUf ? norm(NOME_UF[selUf]).replace(/[^a-z0-9]+/g, "-") : "brasil") + "-" + formato + ".png";

  // ---------- UI ----------
  function painelAltura(h) { // celular/tablet: cartões embaixo (meio) ou folha com tudo (alto)
    const p = $("#painel"); p.classList.remove("baixo", "alto"); if (h === "alto") p.classList.add("alto");
    $("#gripTxt").textContent = h === "alto" ? "Recolher" : "Ver tudo";
    document.body.classList.toggle("folha-alta", h === "alto");
    if (h === "alto") { if (sujo.n) pintaNoticias(); if (sujo.c) pintaCartao(); }
    if (mapa) setTimeout(() => mapa.refit && mapa.fitBrasil && mapa.refit(), 0);
  }
  function irPara(a) { // botões "Gerar cartão" e "Notícias"
    if (desk()) return; painelAltura("alto"); setTimeout(() => { const e = $("#aba-" + a); if (e) e.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60);
  }
  function ligaUI() {
    $("#filtros").addEventListener("click", (e) => {
      const b = e.target.closest("[data-sev],[data-camada]"); if (!b) return;
      if (b.dataset.camada) { setCamada(camada === "focos" ? "alertas" : "focos"); return; }
      const n = +b.dataset.sev; filtroSev = n === filtroSev ? 0 : n; setCamada("alertas"); pintaHero(); mapa.setCor(corDe, true);
    });
    $("#c-alertas").addEventListener("click", () => setCamada("alertas")); $("#c-focos").addEventListener("click", () => setCamada("focos"));
    $("#zMais").addEventListener("click", () => mapa.zoomMais(1.6, mapa.w / 2, mapa.h / 2, true)); $("#zMenos").addEventListener("click", () => mapa.zoomMais(1 / 1.6, mapa.w / 2, mapa.h / 2, true));
    $("#zBr").addEventListener("click", () => { destaquePos = -1; mapa.setDestaque(null); seleciona(-1); mapa.resetar(); pintaAgora(); });
    $("#grip").addEventListener("click", () => painelAltura($("#painel").classList.contains("alto") ? "meio" : "alto"));
    $("#tema").addEventListener("click", alternaTema); atualizaIconeTema();
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (!document.documentElement.dataset.tema) recolore(); });
    matchMedia(DESK).addEventListener("change", () => { painelAltura("meio"); pintaAgora(); pintaNoticias(); pintaCartao(); mapa.refit(); });
    document.addEventListener("keydown", (e) => { if (e.key === "/" && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) { e.preventDefault(); abreBusca(); } });
    $("#buscaIc").addEventListener("click", abreBusca);
    $("#aba-agora").addEventListener("wheel", (e) => { const p = e.target.closest(".pils"); if (p && p.scrollWidth > p.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { p.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false }); // roda do mouse rola a faixa de avisos na horizontal
    $("#painel").addEventListener("click", (e) => {
      const t = e.target.closest("[data-pil],[data-alerta],[data-cid],[data-ir],[data-uf],[data-limpa],[data-tema],[data-fmt],[data-baixa],[data-comp],[data-fut]"); if (!t) return; const d = t.dataset;
      if (d.pil != null) { const p = +d.pil; if (sel >= 0) { pilSel = p; pintaAgora(); } else { destaquePos = destaquePos === p ? -1 : p; mapa.setDestaque(destaquePos >= 0 ? membros[p] : null); if (destaquePos >= 0) { setCamada("alertas"); mapa.zoomLista([...membros[p]]); } pintaAgora(); } }
      else if (d.alerta != null) { const p = +d.alerta; destaquePos = destaquePos === p ? -1 : p; mapa.setDestaque(destaquePos >= 0 ? membros[p] : null); if (destaquePos >= 0) { setCamada("alertas"); mapa.zoomLista([...membros[p]]); if (folha()) painelAltura("meio"); } pintaAgora(); }
      else if (d.cid != null) { seleciona(+d.cid); }
      else if (d.fut) { verFut = true; pintaAgora(); }
      else if (d.ir) irPara(d.ir); else if (d.uf) selecionaUf(+d.uf); else if (d.limpa) { seleciona(-1); mapa.resetar(); }
      else if (d.tema) { tema = d.tema; pintaNoticias(); } else if (d.fmt) { formato = d.fmt; pintaCartao(); }
      else if (d.baixa && cartaoCv) window.Cartao.baixa(cartaoCv, nomeArq());
      else if (d.comp && cartaoCv) window.Cartao.compartilha(cartaoCv, nomeArq(), (sel >= 0 ? G.n[sel] + ": " : selUf ? NOME_UF[selUf] + ": " : "") + "alertas e focos de calor em tempo real").then((ok) => { if (!ok) window.Cartao.baixa(cartaoCv, nomeArq()); });
    });
    $("#painel").addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && (e.target.dataset.alerta != null || e.target.dataset.cid != null)) { e.preventDefault(); e.target.click(); } });
    busca();
  }
  function abreBusca() { $("#barra").classList.add("buscando"); $("#q").focus(); $("#q").select(); }
  function setCamada(c) {
    if (camada === c) { pintaHero(); return; }
    camada = c; $("#c-alertas").setAttribute("aria-selected", c === "alertas"); $("#c-focos").setAttribute("aria-selected", c === "focos");
    legenda(); mapa.setCor(corDe, true); if (D) { pintaHero(); pintaAgora(); }
  }
  // ---------- tema claro/escuro ----------
  const escuroAgora = () => { const t = document.documentElement.dataset.tema; return t ? t === "escuro" : matchMedia("(prefers-color-scheme: dark)").matches; };
  function atualizaIconeTema() { $("#temaIc use").setAttribute("href", escuroAgora() ? "#i-sol" : "#i-lua"); }
  function recolore() { lerCores(); atualizaIconeTema(); legenda(); if (mapa) mapa.setCor(corDe); if (D) pintaCartao(); }
  function alternaTema() {
    const novo = escuroAgora() ? "claro" : "escuro"; document.documentElement.dataset.tema = novo;
    try { localStorage.setItem("alertabr-tema", novo); } catch (e) { /* sem armazenamento: vale só nesta visita */ }
    recolore();
  }

  // ---------- busca ----------
  function busca() {
    const inp = $("#q"), ul = $("#sug"); let achados = [], pos = -1, tb = 0;
    const fecha = () => { ul.hidden = true; inp.setAttribute("aria-expanded", "false"); pos = -1; }, fim = () => { fecha(); $("#barra").classList.remove("buscando"); };
    const pinta = () => { ul.innerHTML = achados.map((i, k) => `<li role="option" data-i="${i}" aria-selected="${k === pos}">${i < 0 ? esc(NOME_UF[-i]) + "<small>Estado · " + UFS[-i] + "</small>" : esc(G.n[i]) + "<small>" + ufDe(i) + "</small>"}</li>`).join(""); ul.hidden = !achados.length; inp.setAttribute("aria-expanded", String(!!achados.length)); };
    inp.addEventListener("input", () => { clearTimeout(tb); tb = setTimeout(() => {
      const v = norm(inp.value).trim(); if (v.length < 2) { achados = []; fecha(); return; }
      if (!porNome) porNome = G.n.map(norm);
      const a = [], b = []; for (let i = 0; i < porNome.length; i++) { const p = porNome[i].indexOf(v); if (p === 0) a.push(i); else if (p > 0) b.push(i); }
      const pri = (i) => (porNome[i] === v ? 0 : 1) + (CAPITAIS.has(G.c[i]) ? 0 : 0.5); a.sort((x, y) => pri(x) - pri(y));
      const es = Object.keys(NOME_UF).filter((c) => norm(NOME_UF[c]).startsWith(v) || norm(UFS[c]) === v).map((c) => -c); // estados primeiro (valor negativo = código do estado)
      achados = es.concat(a, b).slice(0, 8); pos = -1; pinta(); }, 80); });
    inp.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { pos = Math.min(achados.length - 1, pos + 1); pinta(); e.preventDefault(); } else if (e.key === "ArrowUp") { pos = Math.max(0, pos - 1); pinta(); e.preventDefault(); }
      else if (e.key === "Enter" && achados.length) { const v = achados[pos < 0 ? 0 : pos]; v < 0 ? selecionaUf(-v) : seleciona(v); fim(); inp.blur(); } else if (e.key === "Escape") { fim(); inp.blur(); }
    });
    ul.addEventListener("mousedown", (e) => { const li = e.target.closest("li"); if (li) { e.preventDefault(); const v = +li.dataset.i; v < 0 ? selecionaUf(-v) : seleciona(v); fim(); inp.blur(); } });
    inp.addEventListener("blur", () => setTimeout(fim, 150));
  }
  if ("serviceWorker" in navigator) {
    if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
    else addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => { /* sem service worker: o site funciona igual, só não instala offline */ }));
  }
  window.alertabr = { get mapa() { return mapa; } }; // gancho para depuração/medição
  init();
})();

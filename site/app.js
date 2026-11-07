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

  let filtroSev = 0, pilSel = -1, ultimoCeu = "", G = null, E = null, mapa = null, D = null, camada = "alertas", sel = -1, aba = "agora", destaquePos = -1, fonteOk = 0, formato = "post", tema = "todos", timer = 0, semDados = true;
  let membros = [], porNome = null;
  const folha = () => matchMedia("(max-width:899px)").matches && !matchMedia("(max-height:520px) and (orientation:landscape)").matches; // painel em folha (celular/tablet em pé)
  const CAPITAIS = new Set([1100205, 1200401, 1302603, 1400100, 1501402, 1600303, 1721000, 2111300, 2211001, 2304400, 2408102, 2507507, 2611606, 2704302, 2800308, 2927408, 3106200, 3205309, 3304557, 3550308, 4106902, 4205407, 4314902, 5002704, 5103403, 5208707, 5300108]); // capitais aparecem primeiro na busca

  // ---------- carregar ----------
  const json = (u, ms = 12000) => fetch(u, { signal: AbortSignal.timeout(ms) }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
  async function init() {
    try { [G, E] = await Promise.all([json("data/municipios.json", 30000), json("data/estados.json", 30000)]); }
    catch (e) { $("#carrega").textContent = "Não foi possível carregar o mapa. Recarregue a página."; return; }
    lerCores(); mapa = new window.MapaBrasil($("#mapa"), G, E, { cor: corDe, aoClicar: aoClicar, aoPassar: aoPassar, insetBaixo: () => { if (!folha()) return 0; const m = $("#mapa").getBoundingClientRect(), p = $("#painel").getBoundingClientRect(); return Math.max(0, Math.round(m.bottom - p.top + 8)); } });
    mapa.prio = new Set([...CAPITAIS].map((c) => G.c.indexOf(c)).filter((k) => k >= 0));
    $("#carrega").classList.add("ok"); legenda(); pintaAgora(); ligaUI();
    const h = /#m=(\d{7})/.exec(location.hash); await atualiza(true);
    if (h) { const i = G.c.indexOf(+h[1]); if (i >= 0) seleciona(i); }
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
        D = j; semDados = false; montaMembros(); mapa.setCor(corDe, true); mapa.setDestaque(destaquePos >= 0 ? membros[destaquePos] : null); legenda(); pintaHero(); pintaAgora(); if (aba === "cartao") pintaCartao(); status(); return;
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
    const el = $("#status"), t = $("#stTxt"); el.classList.remove("velho", "erro");
    if (!D) { el.classList.add("erro"); t.textContent = "sem dados"; return; }
    const idade = Date.now() - D.gerado, fora = ["inmet", "inpe"].filter((k) => D.fontes[k] && !D.fontes[k].ok);
    if (forca === "erro" || idade > CFG.VELHO) el.classList.add("velho");
    t.textContent = "Ao vivo · atualizado " + ha(D.gerado) + (fora.length ? " · " + fora.map((x) => x.toUpperCase()).join(", ") + " fora do ar" : "") + (idade > CFG.VELHO ? " · dados antigos" : "");
  }
  setInterval(() => { if (D && !document.hidden) status(); }, 30000);

  // ---------- título grande e filtros de gravidade ----------
  function pintaHero() {
    if (!D) return; const r = resumoBr(), tot = G.c.length, soma = r.sev[1] + r.sev[2] + r.sev[3];
    $("#n0").textContent = fmt(soma); $("#n1").textContent = fmt(r.sev[1]); $("#n2").textContent = fmt(r.sev[2]); $("#n3").textContent = fmt(r.sev[3]);
    document.querySelectorAll("[data-sev]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.sev === filtroSev)));
    if (sel >= 0) {
      const al = alertasDe(sel).filter((x) => x.h === 0), foc = D.f[sel];
      $("#hTitulo").textContent = G.n[sel] + " · " + ufDe(sel);
      $("#hSub").innerHTML = `<b>${al.length}</b> aviso${al.length === 1 ? "" : "s"} do INMET hoje · <b>${fmt(foc)}</b> foco${foc === 1 ? "" : "s"} de calor nas últimas 24 h`;
    } else {
      $("#hTitulo").textContent = "Brasil agora";
      $("#hSub").innerHTML = `<b>${fmt(soma)}</b> municípios (${(soma / tot * 100).toFixed(1).replace(".", ",")} %) com aviso do INMET hoje · <b>${fmt(r.focos)}</b> focos de calor nas últimas 24 h`;
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
    sel = i; destaquePos = -1; pilSel = -1; mapa.setDestaque(null); mapa.setSel(i);
    if (i >= 0) { if (folha()) painelAltura("meio"); history.replaceState(null, "", "#m=" + G.c[i]); if (!semZoom) setTimeout(() => mapa.zoomPara(i), folha() ? 320 : 0); } else history.replaceState(null, "", location.pathname);
    $("#q").value = i >= 0 ? G.n[i] : ""; mudaAba("agora"); pintaHero(); pintaAgora(); if (aba === "noticias") pintaNoticias(); if (aba === "cartao") pintaCartao();
  }
  function alertasDe(i) { return D && D.m[i] ? D.m[i].map((p) => D.alertas[p]).filter(Boolean) : []; }

  // ---------- aba Agora ----------
  function resumoBr() {
    const c = { 1: 0, 2: 0, 3: 0 }; for (const s of D.s) if (s) c[s]++;
    const top = []; for (let i = 0; i < D.f.length; i++) if (D.f[i] > 0) top.push(i); top.sort((a, b) => D.f[b] - D.f[a]);
    return { sev: c, focos: D.resumo.focos, top: top.slice(0, 8).map((i) => ({ i, nome: G.n[i], uf: ufDe(i), n: D.f[i] })), fmt };
  }
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
  const horaTxt = () => new Date(D.gerado).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  function pintaAgora() {
    const el = $("#aba-agora"); if (!D) { el.innerHTML = '<p class="vazio esq">Buscando os dados mais recentes…</p>'; return; }
    const rolagem = el.scrollTop;
    el.innerHTML = sel >= 0 ? municipio(sel) : brasil();
    el.scrollTop = rolagem;
  }
  function brasil() {
    const r = resumoBr(), tot = G.c.length, soma = r.sev[1] + r.sev[2] + r.sev[3];
    const hoje = D.alertas.map((a, p) => [a, p]).filter(([a]) => a.h === 0), fut = D.alertas.map((a, p) => [a, p]).filter(([a]) => a.h === 1);
    const topo = destaquePos >= 0 ? D.alertas[destaquePos] : (hoje[0] && hoje[0][0]);
    const tipo = camada === "focos" ? "fogo" : topo ? tipoCeu(topo) : "limpo";
    const card = ([a, p]) => `<div class="card${p === destaquePos ? " on" : ""}" style="--c:${esc(a.cor)}" data-alerta="${p}" tabindex="0" role="button"><h4><span>${esc(a.t)}</span><small>${fmt(a.n)} municípios</small></h4><p><span class="tag">${NOME_SEV[a.sev] || ""}</span>${esc(a.uf)}</p></div>`;
    const c = ceu({
      chave: "br|" + tipo + "|" + destaquePos + "|" + camada, tipo, aria: "Resumo do Brasil", local: "Brasil", hora: horaTxt(),
      gr: camada === "focos" ? fmt(r.focos) : (soma / tot * 100).toFixed(1).replace(".", ","), unid: camada === "focos" ? "" : "%",
      palavra: camada === "focos" ? "Focos de calor" : topo ? topo.t : "Sem avisos hoje", sub: camada === "focos" ? "detecções de satélite em 24 h" : topo ? NOME_SEV[topo.sev] + " · " + fmt(topo.n) + " municípios" : "nenhum aviso ativo do INMET",
      blocos: [["Grande", fmt(r.sev[3])], ["Perigo", fmt(r.sev[2])], ["Focos 24h", fmt(r.focos)]],
      pils: hoje.map(([a, p]) => ({ a, pos: p, on: p === destaquePos, txt: fmt(a.n) })),
    });
    return c + `<h3>Avisos de hoje (${hoje.length})</h3>${hoje.length ? hoje.map(card).join("") : '<p class="vazio">Nenhum aviso ativo hoje.</p>'}
      ${fut.length ? `<h3>Próximos dias (${fut.length})</h3>` + fut.map(card).join("") : ""}
      <h3>Municípios com mais focos (24 h)</h3>${r.top.length ? '<ul class="top">' + r.top.map((t) => `<li data-cid="${t.i}"><span>${esc(t.nome)} · ${t.uf}</span><b>${fmt(t.n)}</b></li>`).join("") + "</ul>" : '<p class="vazio">Sem focos registrados.</p>'}
      <div class="fila"><button class="btn sec" data-ir="cartao">Cartão do Brasil</button></div>`;
  }
  function municipio(i) {
    const pos = (D.m[i] || []).slice().sort((x, y) => D.alertas[y].sev - D.alertas[x].sev || D.alertas[x].h - D.alertas[y].h);
    const ativoPos = pos.includes(pilSel) ? pilSel : pos[0], at = ativoPos != null ? D.alertas[ativoPos] : null, foc = D.f[i], hojeN = pos.filter((p) => D.alertas[p].h === 0).length;
    const tipo = camada === "focos" && foc > 0 ? "fogo" : at ? tipoCeu(at) : foc > 0 ? "fogo" : "limpo";
    const c = ceu({
      chave: "m|" + i + "|" + tipo + "|" + ativoPos + "|" + camada, tipo, aria: "Situação em " + G.n[i], local: G.n[i] + " · " + ufDe(i), hora: horaTxt(),
      gr: camada === "focos" || (!at && foc > 0) ? fmt(foc) : String(hojeN), unid: camada === "focos" || (!at && foc > 0) ? (foc === 1 ? "foco" : "focos") : hojeN === 1 ? "aviso" : "avisos",
      palavra: at ? at.t : foc > 0 ? "Focos de calor" : "Sem aviso hoje", sub: at ? (at.h ? "previsto para os próximos dias" : NOME_SEV[at.sev]) : foc > 0 ? "detecções de satélite em 24 h" : "nenhum aviso do INMET ativo",
      blocos: [["Gravidade", at ? SEV_CURTO[at.sev] : "–"], ["Focos 24h", fmt(foc)], ["Potência", D.frp[i] ? fmt(D.frp[i]) + " <small>MW</small>" : "–"]],
      pils: pos.map((p) => ({ a: D.alertas[p], pos: p, on: p === ativoPos, txt: D.alertas[p].h ? "em breve" : SEV_CURTO[D.alertas[p].sev] })),
    });
    const det = at ? `<div class="card" style="--c:${esc(at.cor)};cursor:default"><h4><span>${esc(at.t)}</span><small>${at.h ? "em breve" : "hoje"}</small></h4><p><span class="tag">${NOME_SEV[at.sev] || ""}</span>${janela(at.ini)} → ${janela(at.fim)}</p>${at.r[0] ? `<p>${esc(at.r[0])}</p>` : ""}${at.i.length ? `<div class="instr"><b>O que fazer:</b> ${esc(at.i.slice(0, 2).join(" "))}</div>` : ""}</div>` : '<p class="vazio">Nenhum aviso do INMET ativo para este município.</p>';
    return c + det + `<div class="fila"><button class="btn" data-ir="cartao">Gerar cartão</button><button class="btn sec" data-ir="noticias">Ver notícias</button><button class="btn sec" data-limpa="1">Voltar ao Brasil</button></div>`;
  }

  // ---------- aba Notícias ----------
  const TEMAS = { todos: '(chuva OR alagamento OR queimada OR incêndio OR "Defesa Civil" OR temporal OR seca)', chuva: "(chuva OR alagamento OR enchente OR temporal OR deslizamento)", fogo: '(queimada OR incêndio OR "foco de calor" OR fumaça)', calor: '("onda de calor" OR seca OR "baixa umidade" OR calor)' };
  const cacheN = new Map();
  function pintaNoticias() {
    const el = $("#aba-noticias"), local = sel >= 0;
    el.innerHTML = `<h2>${local ? "Notícias · " + esc(G.n[sel]) : "Notícias · Brasil"}</h2><div class="chips">${[["todos", "Tudo"], ["chuva", "Chuva e alagamento"], ["fogo", "Queimadas"], ["calor", "Calor e seca"]].map(([k, n]) => `<button data-tema="${k}" aria-pressed="${tema === k}">${n}</button>`).join("")}</div><div id="listaN"><p class="vazio esq">Buscando notícias…</p></div>`;
    const q = (local ? `"${G.n[sel]}" ${ufDe(sel)} ` : "") + TEMAS[tema];
    const mostra = (j) => { const L = $("#listaN"); if (!L || el.hidden) return; L.innerHTML = j.itens && j.itens.length ? j.itens.map((n) => `<a class="not" href="${esc(n.u)}" target="_blank" rel="noopener noreferrer"><b>${esc(n.t)}</b><small>${esc(n.f || "")}${n.d ? " · " + ha(n.d) : ""}${n.n > 1 ? " · " + n.n + " fontes" : ""}</small></a>`).join("") : '<p class="vazio">Nenhuma notícia recente encontrada' + (j.erro ? " (fonte indisponível agora)" : "") + ".</p>"; };
    const c = cacheN.get(q); if (c && Date.now() - c.t < 600000) { mostra(c.j); return; }
    json("/api/noticias?q=" + encodeURIComponent(q), 15000).then((j) => { cacheN.set(q, { t: Date.now(), j }); if (cacheN.size > 40) cacheN.delete(cacheN.keys().next().value); mostra(j); }).catch(() => mostra({ itens: [], erro: 1 }));
  }

  // ---------- aba Cartão ----------
  function dadosCartao() {
    if (sel < 0) { const r = resumoBr(); return { formato, nacional: r, gerado: D.gerado }; }
    const al = alertasDe(sel).filter((a) => a.h === 0).sort((a, b) => b.sev - a.sev)[0], foc = D.f[sel];
    if (!al && !foc) return null;
    return { formato, nome: G.n[sel], uf: ufDe(sel), alerta: al || null, focos: foc, forma: mapa.forma(sel), gerado: D.gerado };
  }
  let cartaoCv = null;
  function pintaCartao() {
    const el = $("#aba-cartao"); if (!D) return;
    const d = dadosCartao();
    el.innerHTML = `<h2>Cartão para compartilhar</h2><p class="sub">${sel >= 0 ? esc(G.n[sel]) : "Resumo do Brasil"} · imagem pronta para WhatsApp e redes.</p>
      <div class="chips"><button data-fmt="post" aria-pressed="${formato === "post"}">Post 1:1</button><button data-fmt="stories" aria-pressed="${formato === "stories"}">Stories 9:16</button></div>
      ${d ? '<div id="prev"></div><div class="fila"><button class="btn" data-baixa="1">Baixar PNG</button><button class="btn sec" data-comp="1">Compartilhar</button></div>' : '<p class="vazio">Este município não tem aviso nem foco de calor agora, então não há o que divulgar. Escolha outro ou volte ao Brasil.</p>'}`;
    if (!d) { cartaoCv = null; return; }
    cartaoCv = window.Cartao.gera(d); const img = new Image(); img.className = "previa"; img.alt = "Prévia do cartão"; img.src = cartaoCv.toDataURL("image/jpeg", 0.85); $("#prev").appendChild(img);
  }
  const nomeArq = () => "alertabr-" + (sel >= 0 ? norm(G.n[sel]).replace(/[^a-z0-9]+/g, "-") : "brasil") + "-" + formato + ".png";

  // ---------- UI ----------
  function mudaAba(a) {
    aba = a; document.querySelectorAll(".nav [data-aba]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.aba === a)));
    for (const k of ["agora", "noticias", "cartao"]) $("#aba-" + k).hidden = k !== a;
    if (a === "noticias") pintaNoticias(); if (a === "cartao") pintaCartao();
  }
  function painelAltura(h) { const p = $("#painel"); p.classList.remove("baixo", "alto"); if (h === "baixo") p.classList.add("baixo"); if (h === "alto") p.classList.add("alto"); }
  function ligaUI() {
    document.querySelectorAll(".nav [data-aba]").forEach((b) => b.addEventListener("click", () => { mudaAba(b.dataset.aba); if (folha() && $("#painel").classList.contains("baixo")) painelAltura("meio"); }));
    $("#filtros").addEventListener("click", (e) => { const b = e.target.closest("[data-sev]"); if (!b) return; const n = +b.dataset.sev; filtroSev = n === filtroSev ? 0 : n; if (filtroSev) setCamada("alertas"); pintaHero(); mapa.setCor(corDe, true); });
    $("#tema").addEventListener("click", alternaTema); atualizaIconeTema();
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (!document.documentElement.dataset.tema) recolore(); });
    document.addEventListener("keydown", (e) => { if (e.key === "/" && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) { e.preventDefault(); $("#q").focus(); } });
    $("#grip").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } });
    const compacto = matchMedia("(max-width:599px)"), poeCamadas = () => { const c = $(".camadas"), alvo = compacto.matches ? $("#mapa") : $("#filtros"); if (c.parentElement !== alvo) alvo.appendChild(c); };
    compacto.addEventListener("change", poeCamadas); poeCamadas();
    $("#c-alertas").addEventListener("click", () => setCamada("alertas")); $("#c-focos").addEventListener("click", () => setCamada("focos"));
    $("#zMais").addEventListener("click", () => mapa.zoomMais(1.6, mapa.w / 2, mapa.h / 2, true)); $("#zMenos").addEventListener("click", () => mapa.zoomMais(1 / 1.6, mapa.w / 2, mapa.h / 2, true));
    $("#zBr").addEventListener("click", () => { destaquePos = -1; mapa.setDestaque(null); seleciona(-1); mapa.resetar(); pintaAgora(); });
    $("#grip").addEventListener("click", () => { const p = $("#painel"); painelAltura(p.classList.contains("baixo") ? "meio" : p.classList.contains("alto") ? "baixo" : "alto"); });
    $("#painel").addEventListener("click", (e) => {
      const t = e.target.closest("[data-pil],[data-alerta],[data-cid],[data-ir],[data-limpa],[data-tema],[data-fmt],[data-baixa],[data-comp]"); if (!t) return; const d = t.dataset;
      if (d.pil != null) { const p = +d.pil; if (sel >= 0) { pilSel = p; pintaAgora(); } else { destaquePos = destaquePos === p ? -1 : p; mapa.setDestaque(destaquePos >= 0 ? membros[p] : null); if (destaquePos >= 0) { setCamada("alertas"); mapa.zoomLista([...membros[p]]); } pintaAgora(); } }
      else if (d.alerta != null) { const p = +d.alerta; destaquePos = destaquePos === p ? -1 : p; mapa.setDestaque(destaquePos >= 0 ? membros[p] : null); if (destaquePos >= 0) { setCamada("alertas"); mapa.zoomLista([...membros[p]]); } pintaAgora(); }
      else if (d.cid != null) { setCamada("focos"); seleciona(+d.cid); }
      else if (d.ir) mudaAba(d.ir); else if (d.limpa) { seleciona(-1); mapa.resetar(); }
      else if (d.tema) { tema = d.tema; pintaNoticias(); } else if (d.fmt) { formato = d.fmt; pintaCartao(); }
      else if (d.baixa && cartaoCv) window.Cartao.baixa(cartaoCv, nomeArq());
      else if (d.comp && cartaoCv) window.Cartao.compartilha(cartaoCv, nomeArq(), (sel >= 0 ? G.n[sel] + ": " : "") + "alertas e focos de calor em tempo real").then((ok) => { if (!ok) window.Cartao.baixa(cartaoCv, nomeArq()); });
    });
    $("#painel").addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.dataset.alerta != null) { e.preventDefault(); e.target.click(); } });
    busca();
  }
  function setCamada(c) { if (camada === c) return; camada = c; $("#c-alertas").setAttribute("aria-selected", c === "alertas"); $("#c-focos").setAttribute("aria-selected", c === "focos"); legenda(); mapa.setCor(corDe, true); if (D) pintaAgora(); }
  // ---------- tema claro/escuro ----------
  const escuroAgora = () => { const t = document.documentElement.dataset.tema; return t ? t === "escuro" : matchMedia("(prefers-color-scheme: dark)").matches; };
  function atualizaIconeTema() { $("#temaIc use").setAttribute("href", escuroAgora() ? "#i-sol" : "#i-lua"); }
  function recolore() { lerCores(); atualizaIconeTema(); legenda(); if (mapa) mapa.setCor(corDe); if (aba === "cartao" && D) pintaCartao(); }
  function alternaTema() {
    const novo = escuroAgora() ? "claro" : "escuro"; document.documentElement.dataset.tema = novo;
    try { localStorage.setItem("alertabr-tema", novo); } catch (e) { /* sem armazenamento: vale só nesta visita */ }
    recolore();
  }

  // ---------- busca ----------
  function busca() {
    const inp = $("#q"), ul = $("#sug"); let achados = [], pos = -1, tb = 0;
    const fecha = () => { ul.hidden = true; inp.setAttribute("aria-expanded", "false"); pos = -1; };
    const pinta = () => { ul.innerHTML = achados.map((i, k) => `<li role="option" data-i="${i}" aria-selected="${k === pos}">${esc(G.n[i])}<small>${ufDe(i)}</small></li>`).join(""); ul.hidden = !achados.length; inp.setAttribute("aria-expanded", String(!!achados.length)); };
    inp.addEventListener("input", () => { clearTimeout(tb); tb = setTimeout(() => {
      const v = norm(inp.value).trim(); if (v.length < 2) { achados = []; fecha(); return; }
      if (!porNome) porNome = G.n.map(norm);
      const a = [], b = []; for (let i = 0; i < porNome.length; i++) { const p = porNome[i].indexOf(v); if (p === 0) a.push(i); else if (p > 0) b.push(i); }
      const pri = (i) => (porNome[i] === v ? 0 : 1) + (CAPITAIS.has(G.c[i]) ? 0 : 0.5); a.sort((x, y) => pri(x) - pri(y));
      achados = a.concat(b).slice(0, 8); pos = -1; pinta(); }, 80); });
    inp.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { pos = Math.min(achados.length - 1, pos + 1); pinta(); e.preventDefault(); } else if (e.key === "ArrowUp") { pos = Math.max(0, pos - 1); pinta(); e.preventDefault(); }
      else if (e.key === "Enter" && achados.length) { seleciona(achados[pos < 0 ? 0 : pos]); fecha(); inp.blur(); } else if (e.key === "Escape") fecha();
    });
    ul.addEventListener("mousedown", (e) => { const li = e.target.closest("li"); if (li) { e.preventDefault(); seleciona(+li.dataset.i); fecha(); inp.blur(); } });
    inp.addEventListener("blur", () => setTimeout(fecha, 120));
  }
  window.alertabr = { get mapa() { return mapa; } }; // gancho para depuração/medição
  init();
})();

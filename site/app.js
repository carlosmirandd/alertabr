/* alertabr: lógica da página. Sem framework, sem build. */
(function () {
  const CFG = window.ALERTABR, $ = (s) => document.querySelector(s);
  const UFS = { 11: "RO", 12: "AC", 13: "AM", 14: "RR", 15: "PA", 16: "AP", 17: "TO", 21: "MA", 22: "PI", 23: "CE", 24: "RN", 25: "PB", 26: "PE", 27: "AL", 28: "SE", 29: "BA", 31: "MG", 32: "ES", 33: "RJ", 35: "SP", 41: "PR", 42: "SC", 43: "RS", 50: "MS", 51: "MT", 52: "GO", 53: "DF" };
  const COR_SEV = { 0: "#262320", 1: "#ffd60a", 2: "#ff9900", 3: "#f80703" }, NOME_SEV = window.Cartao.NOME_SEV;
  const COR_FOGO = ["#262320", "#ffc27a", "#ff9a3c", "#f2641a", "#c8311a", "#7d1410"]; // 0, 1, 2-3, 4-9, 10-24, 25+
  const fmt = (n) => Number(n || 0).toLocaleString("pt-BR");
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const balde = (n) => (n <= 0 ? 0 : n === 1 ? 1 : n < 4 ? 2 : n < 10 ? 3 : n < 25 ? 4 : 5);
  const ufDe = (i) => UFS[Math.floor(G.c[i] / 100000)] || "";
  const janela = (t) => { const m = /(\d{4})-(\d\d)-(\d\d) (\d\d:\d\d)/.exec(t || ""); return m ? m[3] + "/" + m[2] + " " + m[4] : t || ""; };
  const hora = (t) => new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const ha = (t) => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? "agora" : m < 60 ? "há " + m + " min" : m < 1440 ? "há " + Math.floor(m / 60) + " h" : "há " + Math.floor(m / 1440) + " d"; };

  let G = null, E = null, mapa = null, D = null, camada = "alertas", sel = -1, aba = "agora", destaquePos = -1, fonteOk = 0, formato = "post", tema = "todos", timer = 0, semDados = true;
  let membros = [], porNome = null;
  const CAPITAIS = new Set([1100205, 1200401, 1302603, 1400100, 1501402, 1600303, 1721000, 2111300, 2211001, 2304400, 2408102, 2507507, 2611606, 2704302, 2800308, 2927408, 3106200, 3205309, 3304557, 3550308, 4106902, 4205407, 4314902, 5002704, 5103403, 5208707, 5300108]); // capitais aparecem primeiro na busca

  // ---------- carregar ----------
  const json = (u, ms = 12000) => fetch(u, { signal: AbortSignal.timeout(ms) }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
  async function init() {
    try { [G, E] = await Promise.all([json("data/municipios.json", 30000), json("data/estados.json", 30000)]); }
    catch (e) { $("#carrega").textContent = "Não foi possível carregar o mapa. Recarregue a página."; return; }
    mapa = new window.MapaBrasil($("#mapa"), G, E, { cor: corDe, aoClicar: aoClicar, aoPassar: aoPassar });
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
        D = j; semDados = false; montaMembros(); mapa.setCor(corDe, true); mapa.setDestaque(destaquePos >= 0 ? membros[destaquePos] : null); legenda(); pintaPlacar(); pintaAgora(); if (aba === "cartao") pintaCartao(); status(); return;
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
    t.textContent = "atualizado " + ha(D.gerado) + (fora.length ? " · " + fora.map((x) => x.toUpperCase()).join(", ") + " fora do ar" : "") + (idade > CFG.VELHO ? " · dados antigos" : "");
  }
  setInterval(() => { if (D && !document.hidden) status(); }, 30000);

  // ---------- placar (números grandes com contagem animada) ----------
  const tw = new Map();
  function conta(id, para) {
    const el = $("#" + id), de = tw.has(id) ? tw.get(id) : null; tw.set(id, para);
    if (de == null || document.hidden || matchMedia("(prefers-reduced-motion: reduce)").matches || de === para) { el.textContent = fmt(para); return; }
    const t0 = performance.now(), dur = 700;
    (function passo(t) { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(Math.round(de + (para - de) * e)); if (k < 1 && tw.get(id) === para) requestAnimationFrame(passo); else el.textContent = fmt(para); })(t0);
  }
  function pintaPlacar() {
    if (!D) return; const r = resumoBr(), tot = G.c.length;
    conta("pl3", r.sev[3]); conta("pl2", r.sev[2]); conta("pl1", r.sev[1]); conta("plF", r.focos);
    const soma = r.sev[1] + r.sev[2] + r.sev[3];
    $("#bb3").style.width = (r.sev[3] / tot * 100) + "%"; $("#bb2").style.width = (r.sev[2] / tot * 100) + "%"; $("#bb1").style.width = (r.sev[1] / tot * 100) + "%";
    $("#barraTxt").textContent = fmt(soma) + " de " + fmt(tot) + " municípios (" + (soma / tot * 100).toFixed(1).replace(".", ",") + " %) com aviso do INMET hoje";
  }

  // ---------- cores e legenda ----------
  function corDe(i) { if (!D) return COR_SEV[0]; return camada === "alertas" ? COR_SEV[D.s[i]] : COR_FOGO[balde(D.f[i])]; }
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
    sel = i; destaquePos = -1; mapa.setDestaque(null); mapa.setSel(i);
    if (i >= 0) { if (!semZoom) mapa.zoomPara(i); history.replaceState(null, "", "#m=" + G.c[i]); if (matchMedia("(max-width:860px)").matches) painelAltura("meio"); } else history.replaceState(null, "", location.pathname);
    $("#q").value = i >= 0 ? G.n[i] : ""; mudaAba("agora"); pintaAgora(); if (aba === "noticias") pintaNoticias(); if (aba === "cartao") pintaCartao();
  }
  function alertasDe(i) { return D && D.m[i] ? D.m[i].map((p) => D.alertas[p]).filter(Boolean) : []; }

  // ---------- aba Agora ----------
  function resumoBr() {
    const c = { 1: 0, 2: 0, 3: 0 }; for (const s of D.s) if (s) c[s]++;
    const top = []; for (let i = 0; i < D.f.length; i++) if (D.f[i] > 0) top.push(i); top.sort((a, b) => D.f[b] - D.f[a]);
    return { sev: c, focos: D.resumo.focos, top: top.slice(0, 8).map((i) => ({ i, nome: G.n[i], uf: ufDe(i), n: D.f[i] })), fmt };
  }
  function pintaAgora() {
    const el = $("#aba-agora"); if (!D) { el.innerHTML = '<p class="vazio esq">Buscando os dados mais recentes…</p>'; return; }
    if (sel >= 0) { el.innerHTML = detalhe(sel); return; }
    const r = resumoBr(), hoje = D.alertas.map((a, p) => [a, p]).filter(([a]) => a.h === 0), fut = D.alertas.map((a, p) => [a, p]).filter(([a]) => a.h === 1);
    const card = ([a, p]) => `<div class="card${p === destaquePos ? " on" : ""}" style="--c:${esc(a.cor)}" data-alerta="${p}" tabindex="0" role="button"><h4><span>${esc(a.t)}</span><small>${fmt(a.n)} municípios</small></h4><p><span class="tag">${NOME_SEV[a.sev] || ""}</span>${esc(a.uf)}</p></div>`;
    el.innerHTML = `<h2>Brasil agora</h2><p class="sub">Toque no mapa, busque uma cidade ou escolha um aviso abaixo.</p>
      <h3>Avisos de hoje (${hoje.length})</h3>${hoje.length ? hoje.map(card).join("") : '<p class="vazio">Nenhum aviso ativo hoje.</p>'}
      ${fut.length ? `<h3>Próximos dias (${fut.length})</h3>` + fut.map(card).join("") : ""}
      <h3>Municípios com mais focos (24 h)</h3>${r.top.length ? '<ul class="top">' + r.top.map((t) => `<li data-cid="${t.i}"><span>${esc(t.nome)} · ${t.uf}</span><b>${fmt(t.n)}</b></li>`).join("") + "</ul>" : '<p class="vazio">Sem focos registrados.</p>'}
      <div class="fila"><button class="btn sec" data-ir="cartao">Cartão do Brasil</button></div>`;
  }
  function detalhe(i) {
    const al = alertasDe(i), foc = D.f[i], hoje = al.filter((a) => a.h === 0), fut = al.filter((a) => a.h === 1), fn = (a) => `<div class="card" style="--c:${esc(a.cor)};cursor:default"><h4><span>${esc(a.t)}</span><small>${a.h ? "em breve" : "hoje"}</small></h4><p><span class="tag">${NOME_SEV[a.sev] || ""}</span>${janela(a.ini)} → ${janela(a.fim)}</p>${a.r[0] ? `<p>${esc(a.r[0])}</p>` : ""}${a.i.length ? `<div class="instr"><b>O que fazer:</b> ${esc(a.i.slice(0, 2).join(" "))}</div>` : ""}</div>`;
    return `<h2>${esc(G.n[i])} <small style="color:var(--tx2);font-weight:600">${ufDe(i)}</small></h2>
      <div class="num"><div><b style="color:${COR_SEV[D.s[i]] === COR_SEV[0] ? "var(--tx)" : COR_SEV[D.s[i]]}">${D.s[i] ? NOME_SEV[D.s[i]].split(" ")[0] : "Nenhum"}</b><span>aviso hoje</span></div><div><b style="color:var(--fogo)">${fmt(foc)}</b><span>focos em 24 h</span></div><div><b>${D.frp[i] ? fmt(D.frp[i]) : "–"}</b><span>potência (MW)</span></div></div>
      ${hoje.length ? "<h3>Avisos hoje</h3>" + hoje.map(fn).join("") : '<p class="vazio">Nenhum aviso do INMET ativo hoje para este município.</p>'}
      ${fut.length ? "<h3>Próximos dias</h3>" + fut.map(fn).join("") : ""}
      <div class="fila"><button class="btn" data-ir="cartao">Gerar cartão</button><button class="btn sec" data-ir="noticias">Ver notícias</button><button class="btn sec" data-limpa="1">Voltar ao Brasil</button></div>`;
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
    aba = a; document.querySelectorAll(".abas button").forEach((b) => b.setAttribute("aria-selected", b.dataset.aba === a));
    for (const k of ["agora", "noticias", "cartao"]) $("#aba-" + k).hidden = k !== a;
    if (a === "noticias") pintaNoticias(); if (a === "cartao") pintaCartao();
  }
  function painelAltura(h) { const p = $("#painel"); p.classList.remove("baixo", "alto"); if (h === "baixo") p.classList.add("baixo"); if (h === "alto") p.classList.add("alto"); }
  function ligaUI() {
    document.querySelectorAll(".abas button").forEach((b) => b.addEventListener("click", () => { mudaAba(b.dataset.aba); if (matchMedia("(max-width:860px)").matches && $("#painel").classList.contains("baixo")) painelAltura("meio"); }));
    $("#c-alertas").addEventListener("click", () => setCamada("alertas")); $("#c-focos").addEventListener("click", () => setCamada("focos"));
    $("#zMais").addEventListener("click", () => mapa.zoomMais(1.6, mapa.w / 2, mapa.h / 2, true)); $("#zMenos").addEventListener("click", () => mapa.zoomMais(1 / 1.6, mapa.w / 2, mapa.h / 2, true));
    $("#zBr").addEventListener("click", () => { destaquePos = -1; mapa.setDestaque(null); seleciona(-1); mapa.resetar(); pintaAgora(); });
    $("#grip").addEventListener("click", () => { const p = $("#painel"); painelAltura(p.classList.contains("baixo") ? "meio" : p.classList.contains("alto") ? "baixo" : "alto"); });
    $("#painel").addEventListener("click", (e) => {
      const t = e.target.closest("[data-alerta],[data-cid],[data-ir],[data-limpa],[data-tema],[data-fmt],[data-baixa],[data-comp]"); if (!t) return; const d = t.dataset;
      if (d.alerta != null) { const p = +d.alerta; destaquePos = destaquePos === p ? -1 : p; mapa.setDestaque(destaquePos >= 0 ? membros[p] : null); if (destaquePos >= 0) { setCamada("alertas"); mapa.zoomLista([...membros[p]]); } pintaAgora(); }
      else if (d.cid != null) { setCamada("focos"); seleciona(+d.cid); }
      else if (d.ir) mudaAba(d.ir); else if (d.limpa) { seleciona(-1); mapa.resetar(); }
      else if (d.tema) { tema = d.tema; pintaNoticias(); } else if (d.fmt) { formato = d.fmt; pintaCartao(); }
      else if (d.baixa && cartaoCv) window.Cartao.baixa(cartaoCv, nomeArq());
      else if (d.comp && cartaoCv) window.Cartao.compartilha(cartaoCv, nomeArq(), (sel >= 0 ? G.n[sel] + ": " : "") + "alertas e focos de calor em tempo real").then((ok) => { if (!ok) window.Cartao.baixa(cartaoCv, nomeArq()); });
    });
    $("#painel").addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.dataset.alerta != null) { e.preventDefault(); e.target.click(); } });
    busca();
  }
  function setCamada(c) { if (camada === c) return; camada = c; $("#c-alertas").setAttribute("aria-selected", c === "alertas"); $("#c-focos").setAttribute("aria-selected", c === "focos"); legenda(); mapa.setCor(corDe, true); }

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

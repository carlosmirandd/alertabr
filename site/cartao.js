/* Gerador de cartões compartilháveis (PNG) em canvas. Formatos: "post" 1080x1080 e "stories" 1080x1920.
   Tudo é desenhado no navegador: nenhuma imagem sai do aparelho e nenhuma biblioteca é carregada.
   O app monta os dados já em texto (ver dadosCartao em app.js); aqui só há desenho.
   Ordem de prioridade quando falta espaço: situação (aviso ou "tudo certo") > tempo/resumo > manchetes > focos. */
(function () {
  const FONTE = '-apple-system, BlinkMacSystemFont, "Segoe UI Variable", "Segoe UI", Roboto, "Helvetica Neue", Arial, system-ui, sans-serif'; // mesma família da página
  // Fundo sempre escuro: valores dos tokens do tema escuro (--sev-*, --fogo, --ok) num lugar só.
  const C = { bg1: "#141a28", bg2: "#07090e", tx: "#ffffff", tx2: "rgba(255,255,255,.80)", tx3: "rgba(255,255,255,.58)", card: "rgba(255,255,255,.055)", borda: "rgba(255,255,255,.10)",
    grande: "#e8392c", perigo: "#f5902a", potencial: "#ffe066", fogo: "#ff7a1a", ok: "#3dd68c", sol: "#ffd25a", nuvem: "#e6ecf5", gota: "#8ec5ff", lua: "#f4e9c1" };
  const COR_SEV = { 1: C.potencial, 2: C.perigo, 3: C.grande };
  const NOME_SEV = { 1: "Perigo potencial", 2: "Perigo", 3: "Grande perigo" };
  const fnt = (peso, tam) => `${peso} ${tam}px ${FONTE}`;

  function linhas(cx, txt, larg, max) {
    const pal = String(txt || "").replace(/\s+/g, " ").trim().split(" "), out = []; let at = "";
    for (const p of pal) { const t = at ? at + " " + p : p; if (cx.measureText(t).width > larg && at) { out.push(at); at = p; } else at = t; }
    if (at) out.push(at);
    if (out.length > max) { out.length = max; let u = out[max - 1]; while (cx.measureText(u + "…").width > larg && u.length) u = u.slice(0, -1); out[max - 1] = u.replace(/[ ,.;:]+$/, "") + "…"; }
    return out;
  }
  function escreve(cx, s, x, y, peso, tam, cor, alinha) { cx.font = fnt(peso, tam); cx.fillStyle = cor; cx.textAlign = alinha || "left"; cx.textBaseline = "alphabetic"; cx.fillText(s, x, y); cx.textAlign = "left"; }
  function bloco(cx, x, y, w, h, r) { cx.beginPath(); cx.roundRect(x, y, w, h, r); cx.fillStyle = C.card; cx.fill(); cx.strokeStyle = C.borda; cx.lineWidth = 2; cx.stroke(); }

  // ---------- ícones de tempo desenhados (sem imagens) ----------
  function nuvem(cx, x, y, s, cor) { cx.fillStyle = cor; cx.beginPath(); cx.arc(x + s * 0.32, y + s * 0.6, s * 0.19, 0, 7); cx.arc(x + s * 0.52, y + s * 0.46, s * 0.25, 0, 7); cx.arc(x + s * 0.73, y + s * 0.6, s * 0.17, 0, 7); cx.fill(); cx.fillRect(x + s * 0.32, y + s * 0.58, s * 0.41, s * 0.21); }
  function icone(cx, tipo, x, y, s) {
    cx.save(); cx.lineCap = "round"; cx.lineJoin = "round";
    if (tipo === "sol" || tipo === "limpo") {
      const c = s / 2; cx.strokeStyle = C.sol; cx.lineWidth = s * 0.06;
      for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; cx.beginPath(); cx.moveTo(x + c + Math.cos(a) * s * 0.33, y + c + Math.sin(a) * s * 0.33); cx.lineTo(x + c + Math.cos(a) * s * 0.45, y + c + Math.sin(a) * s * 0.45); cx.stroke(); }
      cx.fillStyle = C.sol; cx.beginPath(); cx.arc(x + c, y + c, s * 0.22, 0, 7); cx.fill();
    } else if (tipo === "noite") {
      const t = document.createElement("canvas"); t.width = t.height = Math.ceil(s); const k = t.getContext("2d");
      k.fillStyle = C.lua; k.beginPath(); k.arc(s * 0.5, s * 0.5, s * 0.3, 0, 7); k.fill(); k.globalCompositeOperation = "destination-out"; k.beginPath(); k.arc(s * 0.64, s * 0.38, s * 0.26, 0, 7); k.fill();
      cx.drawImage(t, x, y);
    } else if (tipo === "chuva") {
      nuvem(cx, x, y - s * 0.08, s, C.nuvem); cx.strokeStyle = C.gota; cx.lineWidth = s * 0.055;
      for (const dx of [0.36, 0.52, 0.68]) { cx.beginPath(); cx.moveTo(x + s * dx, y + s * 0.8); cx.lineTo(x + s * (dx - 0.05), y + s * 0.95); cx.stroke(); }
    } else if (tipo === "tempestade") {
      nuvem(cx, x, y - s * 0.08, s, "#c9d2e0"); cx.fillStyle = C.sol; cx.beginPath();
      cx.moveTo(x + s * 0.56, y + s * 0.56); cx.lineTo(x + s * 0.42, y + s * 0.8); cx.lineTo(x + s * 0.52, y + s * 0.8); cx.lineTo(x + s * 0.46, y + s * 0.98); cx.lineTo(x + s * 0.66, y + s * 0.72); cx.lineTo(x + s * 0.55, y + s * 0.72); cx.lineTo(x + s * 0.62, y + s * 0.56); cx.closePath(); cx.fill();
    } else if (tipo === "neblina") {
      cx.strokeStyle = C.nuvem; cx.lineWidth = s * 0.07; for (const [a, b, yy] of [[0.18, 0.82, 0.38], [0.1, 0.9, 0.55], [0.22, 0.78, 0.72]]) { cx.beginPath(); cx.moveTo(x + s * a, y + s * yy); cx.lineTo(x + s * b, y + s * yy); cx.stroke(); }
    } else if (tipo === "frio") {
      const c = s / 2; cx.strokeStyle = C.gota; cx.lineWidth = s * 0.06;
      for (let k = 0; k < 3; k++) { const a = (k * Math.PI) / 3; cx.beginPath(); cx.moveTo(x + c - Math.cos(a) * s * 0.38, y + c - Math.sin(a) * s * 0.38); cx.lineTo(x + c + Math.cos(a) * s * 0.38, y + c + Math.sin(a) * s * 0.38); cx.stroke(); }
    } else if (tipo === "fogo") {
      cx.fillStyle = C.fogo; cx.beginPath(); cx.moveTo(x + s * 0.5, y + s * 0.08); cx.bezierCurveTo(x + s * 0.9, y + s * 0.42, x + s * 0.82, y + s * 0.92, x + s * 0.5, y + s * 0.92); cx.bezierCurveTo(x + s * 0.18, y + s * 0.92, x + s * 0.12, y + s * 0.5, x + s * 0.36, y + s * 0.32); cx.bezierCurveTo(x + s * 0.38, y + s * 0.5, x + s * 0.46, y + s * 0.54, x + s * 0.5, y + s * 0.08); cx.fill();
    } else nuvem(cx, x, y, s, C.nuvem);
    cx.restore();
  }

  // ---------- blocos (cada um devolve a altura; com desenha=false só mede) ----------
  function blocoTempo(cx, d, x, y, w, desenha, S) {
    const t = d.tempo, temDias = S && t.dias && t.dias.length, h = temDias ? 396 : 214;
    if (!desenha) return h;
    bloco(cx, x, y, w, h, 32);
    escreve(cx, "TEMPO AGORA", x + 36, y + 52, 700, 22, C.tx3);
    icone(cx, t.cena, x + 30, y + 64, 128);
    escreve(cx, t.temp + "°", x + 176, y + 156, 800, 104, C.tx);
    cx.font = fnt(800, 104); const tw = cx.measureText(t.temp + "°").width;
    const xx = x + 176 + tw + 28, lw = w - (xx - x) - 32;
    cx.font = fnt(700, 34); const tl = linhas(cx, t.txt, lw, 2); tl.forEach((l, i) => escreve(cx, l, xx, y + 108 + i * 40, 700, 34, C.tx));
    cx.font = fnt(500, 24); linhas(cx, t.detalhe, lw, 2).forEach((l, i) => escreve(cx, l, xx, y + 108 + tl.length * 40 + 4 + i * 30, 500, 24, C.tx3));
    if (temDias) {
      cx.fillStyle = C.borda; cx.fillRect(x + 32, y + 214, w - 64, 2);
      const cw = (w - 64) / t.dias.length;
      t.dias.forEach((dd, i) => { const cxx = x + 32 + i * cw + cw / 2;
        escreve(cx, dd.dia, cxx, y + 260, 700, 26, C.tx2, "center"); icone(cx, dd.cena, cxx - 30, y + 274, 60);
        escreve(cx, dd.max + "°", cxx - 10, y + 370, 800, 30, C.tx, "right"); escreve(cx, dd.min + "°", cxx + 10, y + 370, 600, 26, C.tx3); });
    }
    return h;
  }
  function blocoAviso(cx, d, x, y, w, desenha, S) {
    const a = d.aviso, cor = COR_SEV[a.sev] || C.perigo, iw = w - 72;
    cx.font = fnt(800, 44); const tt = linhas(cx, a.t, iw, 2);
    cx.font = fnt(500, 28); const ds = a.desc ? linhas(cx, a.desc, iw, S ? 4 : 2) : [];
    cx.font = fnt(500, 26); const fz = S && a.fazer.length ? linhas(cx, a.fazer.join(" "), iw, 3) : [];
    const h = 82 + tt.length * 50 + 20 + ds.length * 38 + (fz.length ? 58 + fz.length * 36 : 0) + 12;
    if (!desenha) return h;
    bloco(cx, x, y, w, h, 32); cx.fillStyle = cor; cx.beginPath(); cx.roundRect(x, y + 28, 8, h - 56, 4); cx.fill();
    escreve(cx, "AVISO DO INMET · " + a.quando.toUpperCase(), x + 36, y + 52, 700, 22, C.tx3);
    let yy = y + 104; tt.forEach((l) => { escreve(cx, l, x + 36, yy, 800, 44, C.tx); yy += 50; }); yy += 4;
    ds.forEach((l) => { escreve(cx, l, x + 36, yy, 500, 28, C.tx2); yy += 38; });
    if (fz.length) { yy += 20; escreve(cx, "O QUE FAZER", x + 36, yy, 700, 22, cor); yy += 40; fz.forEach((l) => { escreve(cx, l, x + 36, yy, 500, 26, C.tx); yy += 36; }); }
    return h;
  }
  function blocoResumo(cx, d, x, y, w, desenha, S) {
    const r = d.resumo, n = Math.min(r.top.length, S ? 4 : 2), h = 214 + (n ? 26 + n * 60 : 0);
    if (!desenha) return h;
    bloco(cx, x, y, w, h, 32);
    escreve(cx, "MUNICÍPIOS COM AVISO HOJE", x + 36, y + 52, 700, 22, C.tx3);
    const cw = (w - 72) / 3;
    [[3, "Grande perigo"], [2, "Perigo"], [1, "Perigo potencial"]].forEach(([s, nome], i) => { const xx = x + 36 + i * cw;
      cx.fillStyle = COR_SEV[s]; cx.beginPath(); cx.roundRect(xx, y + 82, 16, 16, 4); cx.fill(); escreve(cx, nome, xx + 26, y + 98, 600, 24, C.tx2);
      escreve(cx, r.c[s], xx, y + 176, 800, 66, C.tx); });
    if (n) { let yy = y + 238; cx.fillStyle = C.borda; cx.fillRect(x + 36, yy - 24, w - 72, 2);
      r.top.slice(0, n).forEach((a) => { cx.fillStyle = COR_SEV[a.sev]; cx.beginPath(); cx.arc(x + 46, yy + 16, 9, 0, 7); cx.fill();
        cx.font = fnt(700, 30); const nomeA = linhas(cx, a.t + (a.onde ? " · " + a.onde : ""), w - 72 - 230, 1)[0];
        escreve(cx, nomeA, x + 70, yy + 26, 700, 30, C.tx); escreve(cx, a.n + " mun.", x + w - 36, yy + 26, 600, 26, C.tx3, "right"); yy += 60; }); }
    return h;
  }
  function blocoFocos(cx, d, x, y, w, desenha) {
    const f = d.focos, h = f.extra ? 96 : 64;
    if (!desenha) return h;
    icone(cx, "fogo", x, y + 2, 48);
    escreve(cx, f.txt, x + 64, y + 38, 700, 32, f.n ? C.tx : C.tx2);
    if (f.extra) escreve(cx, f.extra, x + 64, y + 78, 500, 24, C.tx3);
    return h;
  }
  function blocoManchetes(cx, d, x, y, w, desenha, S, disp) { // entram quantas manchetes couberem no espaço (no máximo 4 / 2)
    cx.font = fnt(700, 30); const it = []; let h = 52;
    for (const m of d.manchetes.slice(0, S ? 4 : 3)) { const l = linhas(cx, m.t, w, 2), hh = l.length * 38 + 50; if (disp != null && h + hh > disp) break; it.push({ l, meta: m.meta }); h += hh; }
    if (!it.length) return 1e6; // nem uma coube
    if (!desenha) return h;
    escreve(cx, "MANCHETES", x, y + 30, 700, 22, C.tx3);
    let yy = y + 78;
    it.forEach((m, i) => { m.l.forEach((l, k) => escreve(cx, l, x, yy + k * 38, 700, 30, C.tx)); yy += m.l.length * 38; escreve(cx, m.meta, x, yy + 2, 500, 22, C.tx3); yy += 50;
      if (i < it.length - 1) { cx.fillStyle = C.borda; cx.fillRect(x, yy - 26, w, 2); } });
    return h;
  }

  function gera(d) {
    const S = d.formato === "stories", W = 1080, H = S ? 1920 : 1080, M = S ? 72 : 64, L = W - 2 * M, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const cx = cv.getContext("2d"), cor = d.status.cor === "ok" ? C.ok : COR_SEV[d.status.sev] || C.perigo;
    // fundo: gradiente profundo + brilho suave da cor da situação
    const g = cx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, C.bg1); g.addColorStop(1, C.bg2); cx.fillStyle = g; cx.fillRect(0, 0, W, H);
    const rg = cx.createRadialGradient(W * 0.88, 0, 0, W * 0.88, 0, W * 0.95); rg.addColorStop(0, cor + "47"); rg.addColorStop(1, cor + "00"); cx.fillStyle = rg; cx.fillRect(0, 0, W, H);
    // cabeçalho: marca + data e hora
    let y = M;
    cx.fillStyle = C.perigo; cx.beginPath(); cx.moveTo(M + 18, y + 2); cx.lineTo(M + 36, y + 34); cx.lineTo(M, y + 34); cx.closePath(); cx.fill();
    cx.fillStyle = C.bg1; cx.fillRect(M + 16.5, y + 13, 3, 11); cx.fillRect(M + 16.5, y + 27, 3, 3);
    escreve(cx, "alertabr", M + 50, y + 31, 800, 32, C.tx); escreve(cx, d.quando, W - M, y + 31, 600, 26, C.tx2, "right");
    y += 96;
    // lugar
    let tam = S ? 96 : 76; cx.font = fnt(800, tam); while (cx.measureText(d.lugar.nome).width > L && tam > 48) { tam -= 4; cx.font = fnt(800, tam); }
    const ln = linhas(cx, d.lugar.nome, L, 2); ln.forEach((l, i) => escreve(cx, l, M, y + tam + i * tam * 1.05, 800, tam, C.tx)); y += tam + (ln.length - 1) * tam * 1.05 + 14;
    escreve(cx, d.lugar.sub, M, y + 30, 500, 30, C.tx3); y += 62;
    // situação (sempre aparece: aviso ou "tudo certo")
    cx.font = fnt(700, 30); const st = linhas(cx, d.status.txt, L - 96, 2), sh = 40 + st.length * 38;
    cx.beginPath(); cx.roundRect(M, y, L, sh, sh > 90 ? 28 : sh / 2); cx.fillStyle = cor + "26"; cx.fill(); cx.strokeStyle = cor + "88"; cx.lineWidth = 2; cx.stroke();
    cx.fillStyle = cor; cx.beginPath(); cx.arc(M + 36, y + sh / 2, 11, 0, 7); cx.fill();
    st.forEach((l, i) => escreve(cx, l, M + 64, y + 49 + i * 38, 700, 30, C.tx));
    y += sh + (S ? 36 : 26);
    // blocos por prioridade, só o que couber acima do rodapé
    const rodape = S ? 170 : 128, lim = H - rodape - 18, folga = S ? 32 : 22;
    const fila = [];
    if (d.tempo) fila.push(blocoTempo);
    if (d.aviso) fila.push(blocoAviso);
    if (d.resumo) fila.push(blocoResumo);
    if (d.manchetes && d.manchetes.length) fila.push(blocoManchetes);
    if (d.focos) fila.push(blocoFocos);
    for (const b of fila) { const h = b(cx, d, M, y, L, false, S, lim - y); if (y + h > lim) continue; b(cx, d, M, y, L, true, S, lim - y); y += h + folga; }
    // rodapé: domínio em destaque, fontes e números de emergência
    cx.fillStyle = C.borda; cx.fillRect(M, H - rodape, L, 2);
    escreve(cx, d.dominio, M, H - rodape + 56, 800, S ? 40 : 34, C.tx);
    escreve(cx, "Emergência: 199 Defesa Civil · 193 Bombeiros", W - M, H - rodape + 54, 600, S ? 26 : 22, C.tx2, "right");
    escreve(cx, d.fontes, M, H - rodape + (S ? 110 : 96), 500, S ? 24 : 21, C.tx3);
    return cv;
  }
  async function baixa(cv, nome) {
    const blob = await new Promise((r) => cv.toBlob(r, "image/png")), a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  async function compartilha(cv, nome, texto) {
    const blob = await new Promise((r) => cv.toBlob(r, "image/png")), f = new File([blob], nome, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], text: texto }); return true; } catch (e) { if (e && e.name === "AbortError") return true; } }
    return false;
  }
  window.Cartao = { gera, baixa, compartilha, NOME_SEV };
})();

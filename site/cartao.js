/* Gerador de cartões compartilháveis (PNG) em canvas. Formatos: "post" 1080x1080 e "stories" 1080x1920.
   Tudo é desenhado no navegador: nenhuma imagem sai do aparelho e nenhuma biblioteca é carregada. */
(function () {
  const FONTE = '"Geist", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  const NOME_SEV = { 1: "Perigo potencial", 2: "Perigo", 3: "Grande perigo" };
  const lum = (hex) => { const n = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };

  function linhas(cx, txt, larg, max) {
    const pal = String(txt).replace(/\s+/g, " ").trim().split(" "), out = []; let at = "";
    for (const p of pal) { const t = at ? at + " " + p : p; if (cx.measureText(t).width > larg && at) { out.push(at); at = p; } else at = t; }
    if (at) out.push(at);
    if (out.length > max) { out.length = max; let u = out[max - 1]; while (cx.measureText(u + "…").width > larg && u.length) u = u.slice(0, -1); out[max - 1] = u.replace(/[ ,.;:]+$/, "") + "…"; }
    return out;
  }
  function texto(cx, txt, x, y, larg, tam, peso, cor, max, folga = 1.28) {
    cx.font = `${peso} ${tam}px ${FONTE}`; cx.fillStyle = cor; cx.textBaseline = "alphabetic";
    const ls = linhas(cx, txt, larg, max); ls.forEach((l, i) => cx.fillText(l, x, y + tam + i * tam * folga)); return y + tam + (ls.length - 1) * tam * folga + tam * 0.35;
  }
  const hora = (t) => new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  function desenhaForma(cx, forma, x, y, w, h, cor) { // desenha o contorno do município dentro da caixa
    const b = forma.caixa, bw = Math.max(b[2] - b[0], 1), bh = Math.max(b[3] - b[1], 1), k = Math.min(w / bw, h / bh);
    cx.save(); cx.translate(x + (w - bw * k) / 2 - b[0] * k, y + (h - bh * k) / 2 - b[1] * k); cx.scale(k, k);
    cx.fillStyle = cor; cx.fill(forma.path); cx.lineWidth = 3 / k; cx.strokeStyle = "rgba(255,255,255,.85)"; cx.lineJoin = "round"; cx.stroke(forma.path); cx.restore();
  }

  // dados: { formato, nome, uf, sev, alerta:{t,r,i,ini,fim,cor}, focos, forma, gerado, nacional:{...} }
  function gera(d) {
    const W = 1080, H = d.formato === "stories" ? 1920 : 1080, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const cx = cv.getContext("2d"), cor = d.nacional ? "#FF9900" : d.alerta ? d.alerta.cor : "#FF7A1A", claro = lum(cor) > 0.6, M = 72, L = W - M * 2;
    const g = cx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#1b1a17"); g.addColorStop(1, "#0f0e0d"); cx.fillStyle = g; cx.fillRect(0, 0, W, H);
    cx.fillStyle = cor; cx.fillRect(0, 0, W, 22);
    let y = 70;
    // etiqueta
    const rot = d.nacional ? "PANORAMA DO BRASIL" : d.alerta ? "ALERTA · " + (NOME_SEV[d.alerta.sev] || "").toUpperCase() : "FOCOS DE CALOR · ÚLTIMAS 24 H";
    cx.font = `800 30px ${FONTE}`; const tw = cx.measureText(rot).width + 44; cx.fillStyle = cor; cx.beginPath(); cx.roundRect(M, y, tw, 56, 28); cx.fill();
    cx.fillStyle = claro ? "#111" : "#fff"; cx.textBaseline = "middle"; cx.fillText(rot, M + 22, y + 30); y += 96;

    if (d.nacional) {
      const n = d.nacional, P = d.formato !== "stories", BH = P ? 150 : 190; // no post (quadrado) tudo é mais compacto para a lista caber acima do rodapé
      y = texto(cx, "Alertas e focos de calor no Brasil", M, y, L, P ? 66 : 78, 800, "#fff", 2, 1.12) + (P ? 18 : 24);
      const caixas = [["Grande perigo", n.sev[3], "#F80703"], ["Perigo", n.sev[2], "#FF9900"], ["Potencial", n.sev[1], "#FFD60A"]], bw = (L - 40) / 3;
      caixas.forEach((c, i) => { const x = M + i * (bw + 20); cx.fillStyle = "rgba(255,255,255,.07)"; cx.beginPath(); cx.roundRect(x, y, bw, BH, 22); cx.fill(); cx.fillStyle = c[2]; cx.fillRect(x, y + 24, 8, BH - 48);
        cx.fillStyle = "#fff"; cx.font = `800 ${P ? 68 : 82}px ${FONTE}`; cx.textBaseline = "alphabetic"; cx.fillText(n.fmt(c[1]), x + 30, y + (P ? 88 : 112)); cx.font = `600 26px ${FONTE}`; cx.fillStyle = "#b7c3d0"; cx.fillText(c[0], x + 30, y + BH - (P ? 30 : 36)); });
      y += BH + (P ? 30 : 36); cx.font = `600 32px ${FONTE}`; cx.fillStyle = "#b7c3d0"; cx.fillText("municípios com aviso do INMET hoje", M, y); y += P ? 34 : 44;
      cx.font = `800 ${P ? 76 : 96}px ${FONTE}`; cx.fillStyle = "#FF7A1A"; cx.fillText(n.fmt(n.focos), M, y + (P ? 64 : 80)); y += P ? 96 : 120;
      cx.font = `600 32px ${FONTE}`; cx.fillStyle = "#b7c3d0"; cx.fillText("focos de calor detectados por satélite em 24 h", M, y); y += P ? 44 : 56;
      const cabem = Math.floor((H - 166 - y - 56) / 56); // linhas que cabem acima do rodapé
      if (n.top.length && cabem >= 1) { cx.font = `800 30px ${FONTE}`; cx.fillStyle = "#fff"; cx.fillText("Mais focos agora", M, y + 30); y += 56;
        n.top.slice(0, Math.min(cabem, d.formato === "stories" ? 7 : 4)).forEach((t) => { cx.font = `600 34px ${FONTE}`; cx.fillStyle = "#e8eef4"; cx.fillText(t.nome + " · " + t.uf, M, y + 34); cx.textAlign = "right"; cx.fillStyle = "#FF7A1A"; cx.font = `800 34px ${FONTE}`; cx.fillText(n.fmt(t.n), W - M, y + 34); cx.textAlign = "left"; y += 56; }); }
    } else {
      const forT = d.forma ? (d.formato === "stories" ? 520 : 300) : 0;
      if (d.alerta) y = texto(cx, d.alerta.t, M, y, L - (forT ? forT * 0.6 : 0), 54, 700, cor, 2) + 6;
      const nome = d.nome; let tam = 108; cx.font = `800 ${tam}px ${FONTE}`; while (cx.measureText(nome).width > L - (forT && d.formato !== "stories" ? forT + 20 : 0) && tam > 54) { tam -= 6; cx.font = `800 ${tam}px ${FONTE}`; }
      const ny = y; y = texto(cx, nome, M, y, L - (forT && d.formato !== "stories" ? forT + 20 : 0), tam, 800, "#fff", 2, 1.08);
      cx.font = `600 40px ${FONTE}`; cx.fillStyle = "#b7c3d0"; cx.fillText(d.uf + (d.alerta ? " · " + (d.alerta.ini ? hora(d.alerta.ini.replace(" ", "T")) : "") + (d.alerta.fim ? " → " + hora(d.alerta.fim.replace(" ", "T")) : "") : ""), M, y + 40); y += 70;
      if (forT) { if (d.formato === "stories") { desenhaForma(cx, d.forma, M, y, L, forT, cor); y += forT + 34; } else desenhaForma(cx, d.forma, W - M - forT, ny - 6, forT, forT, cor); }
      if (d.alerta) {
        if (d.alerta.r[0]) y = texto(cx, d.alerta.r[0], M, y, L - (forT && d.formato !== "stories" ? forT + 24 : 0), 34, 500, "#e8eef4", d.formato === "stories" ? 7 : 5) + 16;
        if (forT && d.formato !== "stories") y = Math.max(y, ny - 6 + forT + 14);
        if (d.alerta.i[0]) { cx.fillStyle = "rgba(255,255,255,.07)"; const ls = (cx.font = `500 31px ${FONTE}`, linhas(cx, d.alerta.i.slice(0, 2).join(" "), L - 60, d.formato === "stories" ? 5 : 3)), h = ls.length * 40 + 64; cx.beginPath(); cx.roundRect(M, y, L, h, 20); cx.fill(); cx.fillStyle = cor; cx.fillRect(M, y + 20, 7, h - 40);
          cx.font = `800 26px ${FONTE}`; cx.fillStyle = cor; cx.fillText("O QUE FAZER", M + 30, y + 44); ls.forEach((l, i) => { cx.font = `500 31px ${FONTE}`; cx.fillStyle = "#fff"; cx.fillText(l, M + 30, y + 88 + i * 40 - 8); }); y += h + 22; }
      }
      if (d.focos > 0) { cx.font = `800 52px ${FONTE}`; cx.fillStyle = "#FF7A1A"; cx.fillText(String(d.focos), M, y + 52); const w = cx.measureText(String(d.focos)).width; cx.font = `600 32px ${FONTE}`; cx.fillStyle = "#e8eef4"; cx.fillText(d.focos === 1 ? "foco de calor nas últimas 24 h" : "focos de calor nas últimas 24 h", M + w + 16, y + 50); y += 80; }
    }
    // rodapé
    cx.fillStyle = "rgba(255,255,255,.12)"; cx.fillRect(M, H - 150, L, 2);
    cx.textBaseline = "alphabetic"; cx.font = `600 27px ${FONTE}`; cx.fillStyle = "#9fb0c0"; cx.fillText("Fonte: INMET (avisos) e INPE (focos de calor) · " + hora(d.gerado), M, H - 96);
    cx.font = `800 34px ${FONTE}`; cx.fillStyle = "#fff"; cx.fillText("alertabr", M, H - 48); cx.font = `500 26px ${FONTE}`; cx.fillStyle = "#9fb0c0"; cx.fillText("Em emergência ligue 199 (Defesa Civil) ou 193 (Bombeiros)", M + 170, H - 48);
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

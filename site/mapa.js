/* Mapa do Brasil por município em <canvas>, sem biblioteca.
   Feito para não travar com 5.570 polígonos:
   - desenha só o que está na tela (caixa de cada município) e só quando precisa (sob demanda);
   - durante arrastar/zoom move a imagem já pronta (CSS transform) e redesenha só quando para;
   - o canvas tem teto de pixels, então telas 4K não ficam pesadas. */
(function () {
  const NEUTRO = "#262320", BORDA = "rgba(15,14,13,.5)", UFLINHA = "rgba(250,250,249,.5)";

  function caixa(d) { // caixa [x0,y0,x1,y1] de um caminho SVG relativo (M x,y l dx,dy ... z)
    const n = d.match(/-?\d*\.?\d+/g); let x = 0, y = 0, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, abs = true;
    const cmds = d.match(/[Mlz][^Mlz]*/g) || [];
    for (const c of cmds) {
      const t = c[0]; if (t === "z") continue;
      const v = (c.slice(1).match(/-?\d*\.?\d+/g) || []).map(Number);
      for (let i = 0; i + 1 < v.length; i += 2) {
        if (t === "M" && i === 0) { x = v[i]; y = v[i + 1]; } else { x += v[i]; y += v[i + 1]; }
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    return [x0, y0, x1, y1];
  }

  class MapaBrasil {
    constructor(el, geo, est, op = {}) {
      this.el = el; this.op = op; this.n = geo.c.length; this.cod = geo.c; this.nomes = geo.n;
      this.paths = geo.d.map((d) => new Path2D(d)); this.box = geo.d.map(caixa);
      this.ufPath = new Path2D(est.linhas || Object.values(est.d || {}).join(""));
      this.estLab = est.lab; const vb = est.vb.split(" ").map(Number); this.W = vb[2]; this.H = vb[3];
      this.prio = new Set(); this.cent = new Array(this.n); this.cor = op.cor || (() => NEUTRO); this.vis = null; this.sel = -1; this.hover = -1; this.destaque = null;
      this.v = { x: 0, y: 0, k: 1 }; this.base = null; this.feito = null; this.q = 0; this.tm = 0;
      this.cvp = document.createElement("canvas"); this.cvp.className = "mapa-cv mapa-prev"; this.cv = document.createElement("canvas"); this.cv.className = "mapa-cv"; this.cvt = document.createElement("canvas"); this.cvt.className = "mapa-cv mapa-topo";
      el.append(this.cvp, this.cv, this.cvt); this.cxp = this.cvp.getContext("2d"); this.cxt = this.cvt.getContext("2d"); this.fade = false; this.qt = 0;
      this.cx = this.cv.getContext("2d", { alpha: true }); this.hc = document.createElement("canvas").getContext("2d"); // contexto só para testar cliques (transformação neutra)
      this.fitBrasil = true; this.ro = new ResizeObserver(() => { this.medir(); if (this.fitBrasil) this.resetar(true); else this.ajusta(); this.desenhaJa(); }); this.ro.observe(el);
      this.medir(); this.resetar(true); this.gestos(); this.desenhaJa();
    }
    medir() { const r = this.el.getBoundingClientRect(); this.w = Math.max(1, r.width); this.h = Math.max(1, r.height); }
    // visão = {x,y} canto superior esquerdo em unidades do mapa, k = pixels por unidade.
    // O mapa ocupa a tela toda; "area" é o espaço livre entre os cartões flutuantes (insets vêm da página).
    area() { const i = this.op.insets ? this.op.insets() : null, l = i ? i.l : 0, r = i ? i.r : 0, t = i ? i.t : 0, b = i ? i.b : 0; return { l, t, w: Math.max(120, this.w - l - r), h: Math.max(120, this.h - t - b) }; }
    kMin() { const a = this.area(); return Math.min(a.w / this.W, a.h / this.H); }
    ajusta() { const v = this.v, km = this.kMin(); v.k = Math.max(km, Math.min(km * 90, v.k)); const cx = v.x + this.w / (2 * v.k), cy = v.y + this.h / (2 * v.k), mx = this.W * 0.2, my = this.H * 0.2;
      v.x = Math.max(-mx, Math.min(this.W + mx, cx)) - this.w / (2 * v.k); v.y = Math.max(-my, Math.min(this.H + my, cy)) - this.h / (2 * v.k); }
    visaoBrasil() { const a = this.area(), k = this.kMin(); return { k, x: this.W / 2 - (a.l + a.w / 2) / k, y: this.H / 2 - (a.t + a.h / 2) / k }; }
    resetar(sem) { const b = this.visaoBrasil(); if (sem) { Object.assign(this.v, b); this.ajusta(); this.fitBrasil = true; return; } this.vaiPara(b.x, b.y, b.k); this.fitBrasil = true; }
    refit() { this.medir(); this.resetar(true); this.agenda(true); }
    // leva a visao ate o alvo com animacao: move a imagem pronta (CSS) a cada quadro e redesenha nitido so no fim
    vaiPara(x, y, k, dur = 420) {
      this.fitBrasil = false; const v = this.v, ant = { ...v }; Object.assign(v, { x, y, k }); this.ajusta(); const al = { ...v }; Object.assign(v, ant);
      cancelAnimationFrame(this.qa); clearTimeout(this.tm);
      if (document.hidden || dur <= 0 || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) { Object.assign(v, al); this.agenda(true); return; }
      const c0 = [ant.x + this.w / (2 * ant.k), ant.y + this.h / (2 * ant.k)], c1 = [al.x + this.w / (2 * al.k), al.y + this.h / (2 * al.k)], t0 = performance.now();
      const passo = (t) => {
        const u = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - u, 4), kk = ant.k * Math.pow(al.k / ant.k, e);
        v.k = kk; v.x = c0[0] + (c1[0] - c0[0]) * e - this.w / (2 * kk); v.y = c0[1] + (c1[1] - c0[1]) * e - this.h / (2 * kk);
        if (u < 1) { this.transforma(); this.qa = requestAnimationFrame(passo); } else { Object.assign(v, al); this.agenda(true); }
      };
      this.qa = requestAnimationFrame(passo);
    }
    zoomCaixa(b, folga = 1.25) { const a = this.area(), w = Math.max(b[2] - b[0], 4), h = Math.max(b[3] - b[1], 4), k = Math.min(a.w / (w * folga), a.h / (h * folga));
      this.vaiPara((b[0] + b[2]) / 2 - (a.l + a.w / 2) / k, (b[1] + b[3]) / 2 - (a.t + a.h / 2) / k, k); }
    zoomPara(idx) { if (idx >= 0) this.zoomCaixa(this.box[idx], 3.2); }
    zoomLista(lista) { if (!lista.length) return; let b = [1e9, 1e9, -1e9, -1e9]; for (const i of lista) { const q = this.box[i]; if (q[0] < b[0]) b[0] = q[0]; if (q[1] < b[1]) b[1] = q[1]; if (q[2] > b[2]) b[2] = q[2]; if (q[3] > b[3]) b[3] = q[3]; } this.zoomCaixa(b, 1.15); }
    zoomMais(f, px, py, anima) { const v = this.v, antes = v.k, x0 = v.x, y0 = v.y; v.k = antes * f; this.ajusta(); const k = v.k; // mantém o ponto sob o cursor
      v.x += px / antes - px / k; v.y += py / antes - py / k; this.ajusta(); if (!anima) { this.agenda(); return; }
      const al = { x: v.x, y: v.y, k: v.k }; Object.assign(v, { x: x0, y: y0, k: antes }); this.vaiPara(al.x, al.y, al.k, 320); }
    cidadeEm(px, py) { const mx = this.v.x + px / this.v.k, my = this.v.y + py / this.v.k, cx = this.hc; let achado = -1;
      for (let i = 0; i < this.n; i++) { const b = this.box[i]; if (mx < b[0] || mx > b[2] || my < b[1] || my > b[3]) continue;
        if (cx.isPointInPath(this.paths[i], mx, my)) { achado = i; break; } }
      return achado; }

    setCor(fn, fade) { this.cor = fn; this.fade = !!fade; this.agenda(true); }
    setSel(i) { this.sel = i; this.agendaTopo(); }
    setDestaque(set) { this.destaque = set; this.agenda(true); }

    // --- desenho ---
    agenda(ja) { if (!ja) this.fitBrasil = false; if (ja) { cancelAnimationFrame(this.q); this.q = requestAnimationFrame(() => this.desenha()); this.transforma(); return; }
      this.transforma(); clearTimeout(this.tm); this.tm = setTimeout(() => this.desenha(), 110); }
    desenhaJa() { cancelAnimationFrame(this.q); this.desenha(); }
    transforma() { if (!this.feito) return; const f = this.feito, k = this.v.k / f.k;
      const t = `translate(${((f.x - this.v.x) * this.v.k).toFixed(1)}px,${((f.y - this.v.y) * this.v.k).toFixed(1)}px) scale(${k.toFixed(4)})`;
      for (const c of [this.cv, this.cvt, this.cvp]) { c.style.transformOrigin = "0 0"; c.style.transform = t; }
      this.cvt.style.opacity = "0"; } // durante o gesto a selecao some; volta quando o desenho termina
    agendaTopo() { if (this.qt) return; this.qt = requestAnimationFrame(() => { this.qt = 0; this.desenhaTopo(); }); }
    lerTema() { const cs = getComputedStyle(this.el), V = (n, d) => cs.getPropertyValue(n).trim() || d; this.cc = { borda: V("--map-borda", BORDA), uf: V("--map-uf", UFLINHA), dim: V("--map-dim", "#1a1917"), rot: V("--map-rot", "#fff"), halo: V("--map-halo", "rgba(15,14,13,.9)"), sel: V("--on", "#fff") }; }
    tamanho(cv, W, H) { if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; cv.style.width = this.w + "px"; cv.style.height = this.h + "px"; } }
    dprAtual() { let dpr = Math.min(window.devicePixelRatio || 1, 2); const maxPx = 2.6e6; if (this.w * this.h * dpr * dpr > maxPx) dpr = Math.sqrt(maxPx / (this.w * this.h)); return dpr; }
    // camada de cima: so o contorno da cidade selecionada e da que esta sob o mouse (barato, nao toca na camada de cores)
    desenhaTopo() {
      const cx = this.cxt, v = this.v, dpr = this.dprAtual(), W = Math.round(this.w * dpr), H = Math.round(this.h * dpr); this.tamanho(this.cvt, W, H);
      cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, W, H); cx.setTransform(v.k * dpr, 0, 0, v.k * dpr, -v.x * v.k * dpr, -v.y * v.k * dpr); cx.lineJoin = "round";
      if (!this.cc) this.lerTema(); if (this.sel >= 0) { cx.lineWidth = 2.4 / v.k; cx.strokeStyle = this.cc.sel; cx.stroke(this.paths[this.sel]); }
      if (this.hover >= 0 && this.hover !== this.sel) { cx.lineWidth = 1.6 / v.k; cx.strokeStyle = this.cc.sel; cx.globalAlpha = .75; cx.stroke(this.paths[this.hover]); cx.globalAlpha = 1; }
      this.cvt.style.transform = ""; this.cvt.style.opacity = "1";
    }
    desenha() {
      this.q = 0; const cx = this.cx, v = this.v, dpr = this.dprAtual(); this.lerTema();
      const W = Math.round(this.w * dpr), H = Math.round(this.h * dpr);
      // dados novos na mesma visao: guarda a imagem antiga e deixa esmaecer por cima (troca suave, sem piscar)
      const fade = this.fade && this.feito && this.cv.width === W && this.cv.height === H && this.feito.k === v.k && this.feito.x === v.x && this.feito.y === v.y; this.fade = false;
      if (fade) { this.tamanho(this.cvp, W, H); this.cxp.setTransform(1, 0, 0, 1, 0, 0); this.cxp.clearRect(0, 0, W, H); this.cxp.drawImage(this.cv, 0, 0); this.cvp.style.transition = "none"; this.cvp.style.opacity = "1"; }
      this.tamanho(this.cv, W, H);
      cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, W, H);
      cx.setTransform(v.k * dpr, 0, 0, v.k * dpr, -v.x * v.k * dpr, -v.y * v.k * dpr);
      const x0 = v.x, y0 = v.y, x1 = v.x + this.w / v.k, y1 = v.y + this.h / v.k, det = v.k > this.kMin() * 2.2, dest = this.destaque;
      cx.lineJoin = "round"; cx.lineWidth = (det ? 0.7 : 0.55) / v.k; // sem zoom: traco da mesma cor esconde so a costura do anti-alias; com zoom: divisa escura fina
      let ult = ""; const dim = this.cc.dim;
      for (let i = 0; i < this.n; i++) {
        const b = this.box[i]; if (b[2] < x0 || b[0] > x1 || b[3] < y0 || b[1] > y1) continue;
        const c = dest && !dest.has(i) ? dim : this.cor(i); if (c !== ult) { cx.fillStyle = c; cx.strokeStyle = det ? this.cc.borda : c; ult = c; }
        cx.fill(this.paths[i]); cx.stroke(this.paths[i]);
      }
      cx.lineWidth = 1.1 / v.k; cx.strokeStyle = this.cc.uf; cx.stroke(this.ufPath);
      if (v.k > this.kMin() * 3.2) this.rotulos(cx, dpr, x0, y0, x1, y1);
      if (v.k < this.kMin() * 2.6) { // siglas dos estados
        cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.font = "700 11px system-ui, sans-serif"; cx.textAlign = "center"; cx.textBaseline = "middle"; cx.lineWidth = 3; cx.strokeStyle = this.cc.halo; cx.fillStyle = this.cc.rot;
        for (const u in this.estLab) { const p = this.estLab[u], sx = (p[0] - v.x) * v.k, sy = (p[1] - v.y) * v.k; if (sx < 0 || sy < 0 || sx > this.w || sy > this.h) continue; cx.strokeText(u, sx, sy); cx.fillText(u, sx, sy); }
      }
      this.feito = { x: v.x, y: v.y, k: v.k }; for (const c of [this.cv, this.cvp]) c.style.transform = "";
      if (fade) requestAnimationFrame(() => { this.cvp.style.transition = "opacity .7s ease-out"; this.cvp.style.opacity = "0"; }); else this.cvp.style.opacity = "0";
      this.desenhaTopo();
    }

    // ponto de rotulo dentro do municipio: o centro da caixa, ou o ponto mais proximo dele que caia dentro da forma
    centroDe(i) {
      if (this.cent[i]) return this.cent[i]; const b = this.box[i], cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, h = this.hc; let r = [cx, cy];
      if (!h.isPointInPath(this.paths[i], cx, cy)) {
        let melhor = 1e18; for (let a = 1; a <= 7; a++) for (let c = 1; c <= 7; c++) { const x = b[0] + (b[2] - b[0]) * a / 8, y = b[1] + (b[3] - b[1]) * c / 8, d = (x - cx) * (x - cx) + (y - cy) * (y - cy); if (d < melhor && h.isPointInPath(this.paths[i], x, y)) { melhor = d; r = [x, y]; } }
      }
      return (this.cent[i] = r);
    }
    // nomes de cidades: as maiores na tela (e as capitais) primeiro; um nome so entra se nao bater em outro
    rotulos(cx, dpr, x0, y0, x1, y1) {
      const v = this.v, cand = [];
      for (let i = 0; i < this.n; i++) {
        const b = this.box[i]; if (b[2] < x0 || b[0] > x1 || b[3] < y0 || b[1] > y1) continue;
        const area = (b[2] - b[0]) * (b[3] - b[1]) * v.k * v.k; if (area < 500 && i !== this.sel && !this.prio.has(i)) continue;
        cand.push([i === this.sel ? 1e12 : this.prio.has(i) ? 1e9 + area : area, i]);
      }
      cand.sort((a, b) => b[0] - a[0]); if (cand.length > 500) cand.length = 500;
      cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.font = "600 11px Geist, system-ui, sans-serif"; cx.textAlign = "center"; cx.textBaseline = "middle"; cx.lineJoin = "round"; cx.lineWidth = 3.5;
      const ocupado = []; let n = 0;
      for (const [, i] of cand) {
        const c = this.centroDe(i), sx = (c[0] - v.x) * v.k, sy = (c[1] - v.y) * v.k; if (sx < 0 || sy < 0 || sx > this.w || sy > this.h) continue;
        const nome = this.nomes[i], w = cx.measureText(nome).width + 6, r = [sx - w / 2, sy - 8, sx + w / 2, sy + 8];
        if (ocupado.some((o) => r[0] < o[2] && r[2] > o[0] && r[1] < o[3] && r[3] > o[1])) continue;
        ocupado.push(r); cx.strokeStyle = this.cc.halo; cx.fillStyle = this.cc.rot; cx.strokeText(nome, sx, sy); cx.fillText(nome, sx, sy); if (++n >= 90) break;
      }
    }

    // --- gestos: arrastar, pinça, roda do mouse, clique, passar o mouse ---
    gestos() {
      const el = this.el, ptr = new Map(); let arr = null, pin = null, mov = 0;
      const pos = (e) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
      el.style.touchAction = "none";
      el.addEventListener("pointerdown", (e) => { cancelAnimationFrame(this.qa); el.setPointerCapture(e.pointerId); const q = pos(e); ptr.set(e.pointerId, { x: q.x, y: q.y }); mov = 0; arr = ptr.size === 1 ? { x: q.x, y: q.y, vx: this.v.x, vy: this.v.y } : null;
        if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pin = { d: Math.hypot(a.x - b.x, a.y - b.y), k: this.v.k }; } });
      el.addEventListener("pointermove", (e) => {
        const p = ptr.get(e.pointerId), q = pos(e);
        if (!p) { if (e.pointerType === "mouse") this.passa(q.x, q.y); return; }
        p.x = q.x; p.y = q.y;
        if (ptr.size === 2 && pin) { const [a, b] = [...ptr.values()], d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, antes = this.v.k;
          this.v.k = pin.k * d / pin.d; this.ajusta(); this.v.x += cx / antes - cx / this.v.k; this.v.y += cy / antes - cy / this.v.k; this.ajusta(); mov = 99; this.agenda(); return; }
        if (arr && ptr.size === 1) { const dx = q.x - arr.x, dy = q.y - arr.y; mov = Math.max(mov, Math.abs(dx) + Math.abs(dy)); if (mov < 4) return;
          this.v.x = arr.vx - dx / this.v.k; this.v.y = arr.vy - dy / this.v.k; this.ajusta(); this.agenda(); }
      });
      const fim = (e) => { const tinha = ptr.has(e.pointerId); ptr.delete(e.pointerId); if (ptr.size < 2) pin = null;
        if (tinha && e.type === "pointerup" && mov < 5 && ptr.size === 0) { const q = pos(e), i = this.cidadeEm(q.x, q.y); if (this.op.aoClicar) this.op.aoClicar(i, e); }
        if (ptr.size === 1) { const [id, p] = [...ptr][0]; arr = { x: p.x, y: p.y, vx: this.v.x, vy: this.v.y }; } else arr = null; };
      el.addEventListener("pointerup", fim); el.addEventListener("pointercancel", fim);
      el.addEventListener("pointerleave", () => { if (this.hover >= 0) { this.hover = -1; this.agendaTopo(); if (this.op.aoPassar) this.op.aoPassar(-1); } });
      el.addEventListener("wheel", (e) => { e.preventDefault(); const q = pos(e); this.zoomMais(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)), q.x, q.y); }, { passive: false });
      el.addEventListener("dblclick", (e) => { const q = pos(e); this.zoomMais(2, q.x, q.y, true); });
    }
    passa(px, py) { if (this.tp) return; this.tp = setTimeout(() => { this.tp = 0; }, 40); const i = this.cidadeEm(px, py);
      if (i !== this.hover) { this.hover = i; this.agendaTopo(); if (this.op.aoPassar) this.op.aoPassar(i, px, py); } else if (i >= 0 && this.op.aoPassar) this.op.aoPassar(i, px, py); }
    // forma de um município isolado (para o cartão): devolve {path, caixa}
    forma(i) { return { path: this.paths[i], caixa: this.box[i] }; }
  }
  window.MapaBrasil = MapaBrasil;
})();

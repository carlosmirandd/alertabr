/* Mapa do Brasil por município em <canvas>, sem biblioteca.
   Feito para não travar com 5.570 polígonos:
   - desenha só o que está na tela (caixa de cada município) e só quando precisa (sob demanda);
   - durante arrastar/zoom move a imagem já pronta (CSS transform) e redesenha só quando para;
   - o canvas tem teto de pixels, então telas 4K não ficam pesadas. */
(function () {
  const NEUTRO = "#262320", BORDA = "rgba(255,255,255,.1)", UFLINHA = "rgba(250,250,249,.5)";

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
      this.estPath = {}; for (const u in est.d) this.estPath[u] = new Path2D(est.d[u]);
      this.estLab = est.lab; const vb = est.vb.split(" ").map(Number); this.W = vb[2]; this.H = vb[3];
      this.cor = op.cor || (() => NEUTRO); this.vis = null; this.sel = -1; this.hover = -1; this.destaque = null;
      this.v = { x: 0, y: 0, k: 1 }; this.base = null; this.feito = null; this.q = 0; this.tm = 0;
      this.cv = document.createElement("canvas"); this.cv.className = "mapa-cv"; el.appendChild(this.cv);
      this.cx = this.cv.getContext("2d", { alpha: true }); this.hc = document.createElement("canvas").getContext("2d"); // contexto só para testar cliques (transformação neutra)
      this.ro = new ResizeObserver(() => { this.medir(); this.ajusta(); this.desenhaJa(); }); this.ro.observe(el);
      this.medir(); this.resetar(true); this.gestos(); this.desenhaJa();
    }
    medir() { const r = this.el.getBoundingClientRect(); this.w = Math.max(1, r.width); this.h = Math.max(1, r.height); }
    // visão = {x,y} canto superior esquerdo em unidades do mapa, k = pixels por unidade
    kMin() { return Math.min(this.w / this.W, this.h / this.H); }
    ajusta() { const v = this.v, km = this.kMin(); v.k = Math.max(km, Math.min(km * 90, v.k)); const mw = this.w / v.k, mh = this.h / v.k;
      v.x = mw >= this.W ? (this.W - mw) / 2 : Math.max(0, Math.min(this.W - mw, v.x));
      v.y = mh >= this.H ? (this.H - mh) / 2 : Math.max(0, Math.min(this.H - mh, v.y)); }
    resetar(sem) { this.v.k = this.kMin(); this.v.x = 0; this.v.y = 0; this.ajusta(); if (!sem) this.agenda(true); }
    zoomCaixa(b, folga = 1.25) { const w = Math.max(b[2] - b[0], 4), h = Math.max(b[3] - b[1], 4), k = Math.min(this.w / (w * folga), this.h / (h * folga));
      this.v.k = k; this.v.x = (b[0] + b[2]) / 2 - this.w / k / 2; this.v.y = (b[1] + b[3]) / 2 - this.h / k / 2; this.ajusta(); this.agenda(true); }
    zoomPara(idx) { if (idx >= 0) this.zoomCaixa(this.box[idx], 3.2); }
    zoomLista(lista) { if (!lista.length) return; let b = [1e9, 1e9, -1e9, -1e9]; for (const i of lista) { const q = this.box[i]; if (q[0] < b[0]) b[0] = q[0]; if (q[1] < b[1]) b[1] = q[1]; if (q[2] > b[2]) b[2] = q[2]; if (q[3] > b[3]) b[3] = q[3]; } this.zoomCaixa(b, 1.15); }
    zoomMais(f, px, py) { const v = this.v, antes = v.k; v.k = antes * f; this.ajusta(); const k = v.k; // mantém o ponto sob o cursor
      v.x += px / antes - px / k; v.y += py / antes - py / k; this.ajusta(); this.agenda(); }
    cidadeEm(px, py) { const mx = this.v.x + px / this.v.k, my = this.v.y + py / this.v.k, cx = this.hc; let achado = -1;
      for (let i = 0; i < this.n; i++) { const b = this.box[i]; if (mx < b[0] || mx > b[2] || my < b[1] || my > b[3]) continue;
        if (cx.isPointInPath(this.paths[i], mx, my)) { achado = i; break; } }
      return achado; }

    setCor(fn) { this.cor = fn; this.agenda(true); }
    setSel(i) { this.sel = i; this.agenda(true); }
    setDestaque(set) { this.destaque = set; this.agenda(true); }

    // --- desenho ---
    agenda(ja) { if (ja) { cancelAnimationFrame(this.q); this.q = requestAnimationFrame(() => this.desenha()); this.transforma(); return; }
      this.transforma(); clearTimeout(this.tm); this.tm = setTimeout(() => this.desenha(), 110); }
    desenhaJa() { cancelAnimationFrame(this.q); this.desenha(); }
    transforma() { if (!this.feito) return; const f = this.feito, k = this.v.k / f.k;
      this.cv.style.transformOrigin = "0 0";
      this.cv.style.transform = `translate(${((f.x - this.v.x) * this.v.k).toFixed(1)}px,${((f.y - this.v.y) * this.v.k).toFixed(1)}px) scale(${k.toFixed(4)})`; }
    desenha() {
      this.q = 0; const cx = this.cx, v = this.v;
      let dpr = Math.min(window.devicePixelRatio || 1, 2); const maxPx = 2.6e6; if (this.w * this.h * dpr * dpr > maxPx) dpr = Math.sqrt(maxPx / (this.w * this.h));
      const W = Math.round(this.w * dpr), H = Math.round(this.h * dpr);
      if (this.cv.width !== W || this.cv.height !== H) { this.cv.width = W; this.cv.height = H; this.cv.style.width = this.w + "px"; this.cv.style.height = this.h + "px"; }
      cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, W, H);
      cx.setTransform(v.k * dpr, 0, 0, v.k * dpr, -v.x * v.k * dpr, -v.y * v.k * dpr);
      const x0 = v.x, y0 = v.y, x1 = v.x + this.w / v.k, y1 = v.y + this.h / v.k, det = v.k > this.kMin() * 3.5, dest = this.destaque;
      cx.lineJoin = "round"; cx.lineWidth = 0.9 / v.k; // o traço cobre as frestas entre municípios (a malha é simplificada)
      let ult = ""; const dim = "#1a1917";
      for (let i = 0; i < this.n; i++) {
        const b = this.box[i]; if (b[2] < x0 || b[0] > x1 || b[3] < y0 || b[1] > y1) continue;
        const c = dest && !dest.has(i) ? dim : this.cor(i); if (c !== ult) { cx.fillStyle = c; cx.strokeStyle = det ? BORDA : c; ult = c; }
        cx.fill(this.paths[i]); cx.stroke(this.paths[i]);
      }
      cx.lineWidth = 1.1 / v.k; cx.strokeStyle = UFLINHA; for (const u in this.estPath) cx.stroke(this.estPath[u]);
      if (this.sel >= 0) { cx.lineWidth = 2.4 / v.k; cx.strokeStyle = "#fff"; cx.stroke(this.paths[this.sel]); }
      if (this.hover >= 0 && this.hover !== this.sel) { cx.lineWidth = 1.6 / v.k; cx.strokeStyle = "#ffffffcc"; cx.stroke(this.paths[this.hover]); }
      if (v.k < this.kMin() * 2.6) { // siglas dos estados
        cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.font = "700 11px system-ui, sans-serif"; cx.textAlign = "center"; cx.textBaseline = "middle"; cx.lineWidth = 3; cx.strokeStyle = "rgba(15,14,13,.8)"; cx.fillStyle = "#fff";
        for (const u in this.estLab) { const p = this.estLab[u], sx = (p[0] - v.x) * v.k, sy = (p[1] - v.y) * v.k; if (sx < 0 || sy < 0 || sx > this.w || sy > this.h) continue; cx.strokeText(u, sx, sy); cx.fillText(u, sx, sy); }
      }
      this.feito = { x: v.x, y: v.y, k: v.k }; this.cv.style.transform = "";
    }

    // --- gestos: arrastar, pinça, roda do mouse, clique, passar o mouse ---
    gestos() {
      const el = this.el, ptr = new Map(); let arr = null, pin = null, mov = 0;
      el.style.touchAction = "none";
      el.addEventListener("pointerdown", (e) => { el.setPointerCapture(e.pointerId); ptr.set(e.pointerId, { x: e.offsetX, y: e.offsetY }); mov = 0; arr = ptr.size === 1 ? { x: e.offsetX, y: e.offsetY, vx: this.v.x, vy: this.v.y } : null;
        if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pin = { d: Math.hypot(a.x - b.x, a.y - b.y), k: this.v.k }; } });
      el.addEventListener("pointermove", (e) => {
        const p = ptr.get(e.pointerId);
        if (!p) { if (e.pointerType === "mouse") this.passa(e.offsetX, e.offsetY); return; }
        p.x = e.offsetX; p.y = e.offsetY;
        if (ptr.size === 2 && pin) { const [a, b] = [...ptr.values()], d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, antes = this.v.k;
          this.v.k = pin.k * d / pin.d; this.ajusta(); this.v.x += cx / antes - cx / this.v.k; this.v.y += cy / antes - cy / this.v.k; this.ajusta(); mov = 99; this.agenda(); return; }
        if (arr && ptr.size === 1) { const dx = e.offsetX - arr.x, dy = e.offsetY - arr.y; mov = Math.max(mov, Math.abs(dx) + Math.abs(dy)); if (mov < 4) return;
          this.v.x = arr.vx - dx / this.v.k; this.v.y = arr.vy - dy / this.v.k; this.ajusta(); this.agenda(); }
      });
      const fim = (e) => { const tinha = ptr.has(e.pointerId); ptr.delete(e.pointerId); if (ptr.size < 2) pin = null;
        if (tinha && e.type === "pointerup" && mov < 5 && ptr.size === 0) { const i = this.cidadeEm(e.offsetX, e.offsetY); if (this.op.aoClicar) this.op.aoClicar(i, e); }
        if (ptr.size === 1) { const [id, p] = [...ptr][0]; arr = { x: p.x, y: p.y, vx: this.v.x, vy: this.v.y }; } else arr = null; };
      el.addEventListener("pointerup", fim); el.addEventListener("pointercancel", fim);
      el.addEventListener("pointerleave", () => { if (this.hover >= 0) { this.hover = -1; this.agenda(true); if (this.op.aoPassar) this.op.aoPassar(-1); } });
      el.addEventListener("wheel", (e) => { e.preventDefault(); this.zoomMais(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)), e.offsetX, e.offsetY); }, { passive: false });
      el.addEventListener("dblclick", (e) => this.zoomMais(2, e.offsetX, e.offsetY));
    }
    passa(px, py) { if (this.tp) return; this.tp = setTimeout(() => { this.tp = 0; }, 40); const i = this.cidadeEm(px, py);
      if (i !== this.hover) { this.hover = i; this.agenda(true); if (this.op.aoPassar) this.op.aoPassar(i, px, py); } else if (i >= 0 && this.op.aoPassar) this.op.aoPassar(i, px, py); }
    // forma de um município isolado (para o cartão): devolve {path, caixa}
    forma(i) { return { path: this.paths[i], caixa: this.box[i] }; }
  }
  window.MapaBrasil = MapaBrasil;
})();

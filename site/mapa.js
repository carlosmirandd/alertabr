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
      this.cvp = document.createElement("canvas"); this.cvp.className = "mapa-cv mapa-prev"; this.cv = document.createElement("canvas"); this.cv.className = "mapa-cv"; this.cvt = document.createElement("canvas"); this.cvt.className = "mapa-cv mapa-topo";
      el.append(this.cvp, this.cv, this.cvt); this.cxp = this.cvp.getContext("2d"); this.cxt = this.cvt.getContext("2d"); this.fade = false; this.qt = 0;
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

    setCor(fn, fade) { this.cor = fn; this.fade = !!fade; this.agenda(true); }
    setSel(i) { this.sel = i; this.agendaTopo(); }
    setDestaque(set) { this.destaque = set; this.agenda(true); }

    // --- desenho ---
    agenda(ja) { if (ja) { cancelAnimationFrame(this.q); this.q = requestAnimationFrame(() => this.desenha()); this.transforma(); return; }
      this.transforma(); clearTimeout(this.tm); this.tm = setTimeout(() => this.desenha(), 110); }
    desenhaJa() { cancelAnimationFrame(this.q); this.desenha(); }
    transforma() { if (!this.feito) return; const f = this.feito, k = this.v.k / f.k;
      const t = `translate(${((f.x - this.v.x) * this.v.k).toFixed(1)}px,${((f.y - this.v.y) * this.v.k).toFixed(1)}px) scale(${k.toFixed(4)})`;
      for (const c of [this.cv, this.cvt, this.cvp]) { c.style.transformOrigin = "0 0"; c.style.transform = t; }
      this.cvt.style.opacity = "0"; } // durante o gesto a selecao some; volta quando o desenho termina
    agendaTopo() { if (this.qt) return; this.qt = requestAnimationFrame(() => { this.qt = 0; this.desenhaTopo(); }); }
    tamanho(cv, W, H) { if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; cv.style.width = this.w + "px"; cv.style.height = this.h + "px"; } }
    dprAtual() { let dpr = Math.min(window.devicePixelRatio || 1, 2); const maxPx = 2.6e6; if (this.w * this.h * dpr * dpr > maxPx) dpr = Math.sqrt(maxPx / (this.w * this.h)); return dpr; }
    // camada de cima: so o contorno da cidade selecionada e da que esta sob o mouse (barato, nao toca na camada de cores)
    desenhaTopo() {
      const cx = this.cxt, v = this.v, dpr = this.dprAtual(), W = Math.round(this.w * dpr), H = Math.round(this.h * dpr); this.tamanho(this.cvt, W, H);
      cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, W, H); cx.setTransform(v.k * dpr, 0, 0, v.k * dpr, -v.x * v.k * dpr, -v.y * v.k * dpr); cx.lineJoin = "round";
      if (this.sel >= 0) { cx.lineWidth = 2.4 / v.k; cx.strokeStyle = "#fff"; cx.stroke(this.paths[this.sel]); }
      if (this.hover >= 0 && this.hover !== this.sel) { cx.lineWidth = 1.6 / v.k; cx.strokeStyle = "rgba(255,255,255,.8)"; cx.stroke(this.paths[this.hover]); }
      this.cvt.style.transform = ""; this.cvt.style.opacity = "1";
    }
    desenha() {
      this.q = 0; const cx = this.cx, v = this.v, dpr = this.dprAtual();
      const W = Math.round(this.w * dpr), H = Math.round(this.h * dpr);
      // dados novos na mesma visao: guarda a imagem antiga e deixa esmaecer por cima (troca suave, sem piscar)
      const fade = this.fade && this.feito && this.cv.width === W && this.cv.height === H && this.feito.k === v.k && this.feito.x === v.x && this.feito.y === v.y; this.fade = false;
      if (fade) { this.tamanho(this.cvp, W, H); this.cxp.setTransform(1, 0, 0, 1, 0, 0); this.cxp.clearRect(0, 0, W, H); this.cxp.drawImage(this.cv, 0, 0); this.cvp.style.transition = "none"; this.cvp.style.opacity = "1"; }
      this.tamanho(this.cv, W, H);
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
      if (v.k < this.kMin() * 2.6) { // siglas dos estados
        cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.font = "700 11px system-ui, sans-serif"; cx.textAlign = "center"; cx.textBaseline = "middle"; cx.lineWidth = 3; cx.strokeStyle = "rgba(15,14,13,.8)"; cx.fillStyle = "#fff";
        for (const u in this.estLab) { const p = this.estLab[u], sx = (p[0] - v.x) * v.k, sy = (p[1] - v.y) * v.k; if (sx < 0 || sy < 0 || sx > this.w || sy > this.h) continue; cx.strokeText(u, sx, sy); cx.fillText(u, sx, sy); }
      }
      this.feito = { x: v.x, y: v.y, k: v.k }; for (const c of [this.cv, this.cvp]) c.style.transform = "";
      if (fade) requestAnimationFrame(() => { this.cvp.style.transition = "opacity .7s ease-out"; this.cvp.style.opacity = "0"; }); else this.cvp.style.opacity = "0";
      this.desenhaTopo();
    }

    // --- gestos: arrastar, pinça, roda do mouse, clique, passar o mouse ---
    gestos() {
      const el = this.el, ptr = new Map(); let arr = null, pin = null, mov = 0;
      const pos = (e) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
      el.style.touchAction = "none";
      el.addEventListener("pointerdown", (e) => { el.setPointerCapture(e.pointerId); const q = pos(e); ptr.set(e.pointerId, { x: q.x, y: q.y }); mov = 0; arr = ptr.size === 1 ? { x: q.x, y: q.y, vx: this.v.x, vy: this.v.y } : null;
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
      el.addEventListener("dblclick", (e) => { const q = pos(e); this.zoomMais(2, q.x, q.y); });
    }
    passa(px, py) { if (this.tp) return; this.tp = setTimeout(() => { this.tp = 0; }, 40); const i = this.cidadeEm(px, py);
      if (i !== this.hover) { this.hover = i; this.agendaTopo(); if (this.op.aoPassar) this.op.aoPassar(i, px, py); } else if (i >= 0 && this.op.aoPassar) this.op.aoPassar(i, px, py); }
    // forma de um município isolado (para o cartão): devolve {path, caixa}
    forma(i) { return { path: this.paths[i], caixa: this.box[i] }; }
  }
  window.MapaBrasil = MapaBrasil;
})();

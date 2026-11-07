/* Mapa do Brasil por município com MapLibre GL (WebGL).
   Mesma interface do mapa em canvas (mapa.js), que continua como reserva quando o aparelho não tem WebGL.
   Sem mapa-base: só os 5.570 municípios, as divisas de estado e os nomes. As cores de cada município são "estado de feição"
   (feature-state): trocar o dado só repinta na GPU, sem refazer geometria. O zoom e o arrasto são feitos pela GPU. */
(function () {
  const BRASIL = [[-74.2, -34.0], [-28.6, 5.4]];
  const suportado = () => { try { const c = document.createElement("canvas"); return !!(window.maplibregl && (c.getContext("webgl2") || c.getContext("webgl"))); } catch (e) { return false; } };

  function aneis(d) { // caminho SVG relativo (M x,y l dx,dy ... z) -> lista de anéis [[x,y], ...] em unidades do mapa
    const out = []; let cur = null, x = 0, y = 0;
    for (const c of d.match(/[Mlz][^Mlz]*/g) || []) {
      const t = c[0]; if (t === "z") { if (cur && cur.length > 2) out.push(cur); cur = null; continue; }
      const v = (c.slice(1).match(/-?\d*\.?\d+/g) || []).map(Number);
      for (let i = 0; i + 1 < v.length; i += 2) { if (t === "M" && i === 0) { x = v[i]; y = v[i + 1]; cur = []; } else { x += v[i]; y += v[i + 1]; } if (cur) cur.push([x, y]); }
    }
    if (cur && cur.length > 2) out.push(cur);
    return out;
  }
  function linhas(d) { // caminho aberto -> lista de linhas
    const out = []; let cur = null, x = 0, y = 0;
    for (const c of d.match(/[Ml][^Ml]*/g) || []) {
      const t = c[0], v = (c.slice(1).match(/-?\d*\.?\d+/g) || []).map(Number);
      for (let i = 0; i + 1 < v.length; i += 2) { if (t === "M") { x = v[i]; y = v[i + 1]; cur = []; out.push(cur); } else { x += v[i]; y += v[i + 1]; } if (cur) cur.push([x, y]); }
    }
    return out.filter((l) => l.length > 1);
  }
  function caixa(d) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const r of aneis(d)) for (const p of r) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; } return [x0, y0, x1, y1]; }
  const area = (r) => { let a = 0; for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return Math.abs(a) / 2; };
  const centro = (r) => { let a = 0, cx = 0, cy = 0; for (let i = 0; i < r.length - 1; i++) { const f = r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; a += f; cx += (r[i][0] + r[i + 1][0]) * f; cy += (r[i][1] + r[i + 1][1]) * f; } return a ? [cx / (3 * a), cy / (3 * a)] : r[0]; };

  class MapaGL {
    constructor(el, geo, est, op = {}) {
      this.el = el; this.op = op; this.n = geo.c.length; this.cod = geo.c; this.nomes = geo.n; this.d = geo.d; this.ufLab = est.lab;
      this.idx = new Map(geo.c.map((c, i) => [c, i])); this.cor = op.cor || (() => "#444"); this.sel = -1; this.hover = -1; this.destaque = null; this.ult = new Array(this.n).fill(null);
      this.pronto = false; this.fitBrasil = true; this.capitais = op.capitais || new Set();
      const [K, minx, miny, S] = est.proj, ll = (p) => [+((p[0] / S + minx) / K).toFixed(5), +(-(p[1] / S + miny)).toFixed(5)];
      // geometria em graus (a partir dos mesmos caminhos compactos): polígonos, caixas, pontos de rótulo
      const feats = [], pts = [], bnd = new Array(this.n);
      for (let i = 0; i < this.n; i++) {
        const rs = aneis(this.d[i]).map((r) => { const a = r.map(ll); a.push(a[0]); return a; });
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, maior = null, am = -1;
        for (const r of rs) { for (const p of r) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; } const a = area(r); if (a > am) { am = a; maior = r; } }
        bnd[i] = [[x0, y0], [x1, y1]];
        feats.push({ type: "Feature", id: this.cod[i], properties: { c: this.cod[i] }, geometry: { type: "MultiPolygon", coordinates: rs.map((r) => [r]) } });
        const prio = this.capitais.has(this.cod[i]) ? 1e6 : (x1 - x0) * (y1 - y0);
        pts.push({ type: "Feature", properties: { n: this.nomes[i], s: -prio }, geometry: { type: "Point", coordinates: maior ? centro(maior) : [x0, y0] } });
      }
      this.bnd = bnd;
      const ufLin = linhas(est.linhas || "").map((l) => l.map(ll));
      const ufPts = Object.keys(est.lab).map((u) => ({ type: "Feature", properties: { n: u }, geometry: { type: "Point", coordinates: ll(est.lab[u]) } }));
      this.dados = { mun: { type: "FeatureCollection", features: feats }, rot: { type: "FeatureCollection", features: pts }, uf: { type: "Feature", geometry: { type: "MultiLineString", coordinates: ufLin } }, ufr: { type: "FeatureCollection", features: ufPts } };

      const c = this.cores(), base = location.origin + location.pathname.replace(/[^/]*$/, "");
      this.map = new maplibregl.Map({
        container: el, style: { version: 8, glyphs: base + "fonts/{fontstack}/{range}.pbf", sources: {}, layers: [{ id: "fundo", type: "background", paint: { "background-color": c.sea } }] },
        bounds: BRASIL, fitBoundsOptions: { padding: this.padding(), duration: 0 }, attributionControl: false, dragRotate: false, pitchWithRotate: false, touchPitch: false,
        renderWorldCopies: false, maxZoom: 12.5, minZoom: 2.2, maxBounds: [[-150, -75], [40, 45]], fadeDuration: 120, pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      });
      const m = this.map; m.touchZoomRotate.disableRotation(); m.keyboard.disableRotation();
      m.on("load", () => this.montaCamadas());
      m.on("dragstart", () => { this.fitBrasil = false; }); m.on("zoomstart", (e) => { if (e.originalEvent) this.fitBrasil = false; });
      m.on("mousemove", (e) => this.passa(e)); m.getCanvas().addEventListener("mouseleave", () => this.passa(null));
      m.on("click", (e) => { const f = m.queryRenderedFeatures(e.point, { layers: ["mun-fill"] })[0]; if (this.op.aoClicar) this.op.aoClicar(f ? this.idx.get(f.id) : -1, e.originalEvent); });
      this.ro = new ResizeObserver(() => { if (this.fitBrasil && this.pronto) this.resetar(true); }); this.ro.observe(el);
    }
    get w() { return this.el.clientWidth; } get h() { return this.el.clientHeight; }
    cores() { const cs = getComputedStyle(this.el), V = (n, d) => cs.getPropertyValue(n).trim() || d; return { sea: V("--map-sea", "#100e0c"), neutro: V("--map-neutro", "#2a2622"), dim: V("--map-dim", "#1a1815"), uf: V("--map-uf", "rgba(250,246,240,.5)"), borda: V("--map-borda", "rgba(16,14,12,.55)"), rot: V("--map-rot", "#fff"), halo: V("--map-halo", "rgba(16,14,12,.9)"), sel: V("--on", "#fff") }; }
    padding() { const i = this.op.insets ? this.op.insets() : null; return i ? { left: i.l, right: i.r, top: i.t, bottom: i.b } : { left: 0, right: 0, top: 0, bottom: 0 }; }
    montaCamadas() {
      const m = this.map, c = this.cores(), fonte = ["Open Sans Semibold"];
      m.addSource("mun", { type: "geojson", data: this.dados.mun, tolerance: 0.25, buffer: 16, maxzoom: 11 });
      m.addSource("uf", { type: "geojson", data: this.dados.uf, tolerance: 0.4 });
      m.addSource("rot", { type: "geojson", data: this.dados.rot, maxzoom: 8 });
      m.addSource("ufr", { type: "geojson", data: this.dados.ufr });
      m.addLayer({ id: "mun-fill", type: "fill", source: "mun", paint: { "fill-color": ["coalesce", ["feature-state", "cor"], c.neutro], "fill-color-transition": { duration: 600 }, "fill-antialias": true } });
      m.addLayer({ id: "mun-line", type: "line", source: "mun", minzoom: 5, paint: { "line-color": c.borda, "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.25, 9, 0.7, 12, 1.2], "line-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0, 6.5, 1] } });
      m.addLayer({ id: "uf-line", type: "line", source: "uf", layout: { "line-join": "round" }, paint: { "line-color": c.uf, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.6, 8, 1.5] } });
      m.addLayer({ id: "hov-line", type: "line", source: "mun", filter: ["==", ["get", "c"], -1], layout: { "line-join": "round" }, paint: { "line-color": c.sel, "line-width": 1.8, "line-opacity": 0.75 } });
      m.addLayer({ id: "sel-line", type: "line", source: "mun", filter: ["==", ["get", "c"], -1], layout: { "line-join": "round" }, paint: { "line-color": c.sel, "line-width": 3 } });
      m.addLayer({ id: "rot-mun", type: "symbol", source: "rot", minzoom: 5.4, layout: { "text-field": ["get", "n"], "text-font": fonte, "text-size": ["interpolate", ["linear"], ["zoom"], 5.4, 10, 10, 13], "symbol-sort-key": ["get", "s"], "text-padding": 4, "text-max-width": 7 }, paint: { "text-color": c.rot, "text-halo-color": c.halo, "text-halo-width": 1.4 } });
      m.addLayer({ id: "rot-uf", type: "symbol", source: "ufr", maxzoom: 6, layout: { "text-field": ["get", "n"], "text-font": fonte, "text-size": 12, "text-allow-overlap": true }, paint: { "text-color": c.rot, "text-halo-color": c.halo, "text-halo-width": 1.6 } });
      this.pronto = true; this.recolore(); this.setSel(this.sel);
      m.once("idle", () => { if (this.op.aoPronto) this.op.aoPronto(); });
    }
    aplicaTema() {
      if (!this.pronto) return; const m = this.map, c = this.cores();
      m.setPaintProperty("fundo", "background-color", c.sea); m.setPaintProperty("mun-fill", "fill-color", ["coalesce", ["feature-state", "cor"], c.neutro]);
      m.setPaintProperty("mun-line", "line-color", c.borda); m.setPaintProperty("uf-line", "line-color", c.uf);
      m.setPaintProperty("hov-line", "line-color", c.sel); m.setPaintProperty("sel-line", "line-color", c.sel);
      for (const id of ["rot-mun", "rot-uf"]) { m.setPaintProperty(id, "text-color", c.rot); m.setPaintProperty(id, "text-halo-color", c.halo); }
    }
    recolore() {
      if (!this.pronto) return; const m = this.map, dest = this.destaque, dim = this.cores().dim;
      for (let i = 0; i < this.n; i++) { const c = dest && !dest.has(i) ? dim : this.cor(i); if (this.ult[i] !== c) { m.setFeatureState({ source: "mun", id: this.cod[i] }, { cor: c }); this.ult[i] = c; } }
      this.aplicaTema();
    }
    setCor(fn) { this.cor = fn; this.recolore(); }
    setDestaque(set) { this.destaque = set; this.recolore(); }
    setSel(i) { this.sel = i; if (this.pronto) this.map.setFilter("sel-line", ["==", ["get", "c"], i >= 0 ? this.cod[i] : -1]); }
    passa(e) {
      if (!this.pronto) return; if (this.raf) { this.ult_e = e; return; } this.ult_e = e;
      this.raf = requestAnimationFrame(() => {
        this.raf = 0; const ev = this.ult_e, f = ev ? this.map.queryRenderedFeatures(ev.point, { layers: ["mun-fill"] })[0] : null, i = f ? this.idx.get(f.id) : -1;
        if (i !== this.hover) { this.hover = i; this.map.setFilter("hov-line", ["==", ["get", "c"], i >= 0 ? this.cod[i] : -1]); this.map.getCanvas().style.cursor = i >= 0 ? "pointer" : ""; }
        if (this.op.aoPassar) this.op.aoPassar(i, ev ? ev.point.x : 0, ev ? ev.point.y : 0);
      });
    }
    medir() { this.map.resize(); }
    resetar(sem) { this.fitBrasil = true; this.map.fitBounds(BRASIL, { padding: this.padding(), duration: sem ? 0 : 700 }); }
    refit() { this.map.resize(); this.resetar(true); }
    zoomPara(i) { if (i < 0) return; this.fitBrasil = false; this.map.fitBounds(this.bnd[i], { padding: this.padding(), maxZoom: 11, duration: 700 }); }
    zoomLista(lista) { if (!lista.length) return; let b = [[1e9, 1e9], [-1e9, -1e9]]; for (const i of lista) { const q = this.bnd[i]; b[0][0] = Math.min(b[0][0], q[0][0]); b[0][1] = Math.min(b[0][1], q[0][1]); b[1][0] = Math.max(b[1][0], q[1][0]); b[1][1] = Math.max(b[1][1], q[1][1]); } this.fitBrasil = false; this.map.fitBounds(b, { padding: this.padding(), maxZoom: 9, duration: 700 }); }
    zoomMais(f, px, py, anima) { const m = this.map; this.fitBrasil = false; m.easeTo({ zoom: m.getZoom() + Math.log2(f), around: m.unproject([px, py]), duration: anima ? 300 : 0 }); }
    forma(i) { return { path: new Path2D(this.d[i]), caixa: caixa(this.d[i]) }; } // contorno para o cartão de compartilhar
  }
  window.MapaGL = MapaGL; window.MapaGL.suportado = suportado;
})();

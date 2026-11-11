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
    // geo = data/mun.json: códigos (c), nomes (n), caixas em graus×100 (b), ponto do rótulo em graus×1000 (p), rótulo dos estados (uf, graus×10000).
    // A geometria vem em tiles vetoriais estáticos (site/tiles, gerados por geo/tiles.mjs): o navegador só baixa o que está na tela.
    constructor(el, geo, est, op = {}) {
      this.el = el; this.op = op; this.n = geo.c.length; this.cod = geo.c; this.nomes = geo.n; this.paths = null;
      this.idx = new Map(geo.c.map((c, i) => [c, i])); this.cor = op.cor || (() => "#444"); this.sel = -1; this.hover = -1; this.destaque = null; this.ult = new Array(this.n).fill(null);
      this.pronto = false; this.fitBrasil = true; this.capitais = op.capitais || new Set();
      const bnd = new Array(this.n), pts = [];
      for (let i = 0; i < this.n; i++) {
        const x0 = geo.b[4 * i] / 100, y0 = geo.b[4 * i + 1] / 100, x1 = geo.b[4 * i + 2] / 100, y1 = geo.b[4 * i + 3] / 100;
        bnd[i] = [[x0, y0], [x1, y1]];
        const prio = this.capitais.has(this.cod[i]) ? 1e6 : (x1 - x0) * (y1 - y0);
        pts.push({ type: "Feature", properties: { n: this.nomes[i], s: -prio }, geometry: { type: "Point", coordinates: [geo.p[2 * i] / 1000, geo.p[2 * i + 1] / 1000] } });
      }
      this.bnd = bnd;
      const ufPts = Object.keys(geo.uf || {}).map((u) => ({ type: "Feature", properties: { n: u }, geometry: { type: "Point", coordinates: [geo.uf[u][0] / 1e4, geo.uf[u][1] / 1e4] } }));
      this.dados = { rot: { type: "FeatureCollection", features: pts }, ufr: { type: "FeatureCollection", features: ufPts } };

      const c = this.cores(), base = location.origin + location.pathname.replace(/[^/]*$/, "");
      this.map = new maplibregl.Map({
        container: el, style: { version: 8, glyphs: base + "fonts/{fontstack}/{range}.pbf", sources: {}, layers: [{ id: "fundo", type: "background", paint: { "background-color": c.sea } }] },
        bounds: BRASIL, fitBoundsOptions: { padding: this.padding(), duration: 0 }, attributionControl: false, dragRotate: false, pitchWithRotate: false, touchPitch: false,
        renderWorldCopies: false, maxZoom: 12.5, minZoom: 2.2, maxBounds: [[-150, -75], [40, 45]], fadeDuration: 120, pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      });
      const m = this.map; m.touchZoomRotate.disableRotation(); m.keyboard.disableRotation();
      m.on("load", () => this.montaCamadas());
      // prazo de segurança: se em 15 s nenhum município apareceu (WebGL travado, tiles fora do ar), avisa para trocar de mapa
      this.prazo = setTimeout(() => { let tem = false; try { tem = this.pronto && m.querySourceFeatures("mun", { sourceLayer: "mun" }).length > 0; } catch (e) { /* estilo não carregou */ } if (!tem && this.op.aoErro && !this.avisou) { this.avisou = true; this.op.aoErro(); } }, 15000);
      m.on("error", (e) => { console.warn("mapa:", e && e.error ? e.error.message : e); if (!this.carregou && this.op.aoErro && !this.avisou) { this.avisou = true; this.op.aoErro(e && e.error); } }); // falha antes de o mapa aparecer (ex.: tiles fora do ar)
      m.on("dragstart", () => { this.fitBrasil = false; }); m.on("zoomstart", (e) => { if (e.originalEvent) this.fitBrasil = false; });
      m.on("mousemove", (e) => this.passa(e)); m.getCanvas().addEventListener("mouseleave", () => this.passa(null));
      m.on("click", (e) => { const f = m.queryRenderedFeatures(e.point, { layers: ["mun-fill"] })[0]; if (this.op.aoClicar) this.op.aoClicar(f ? this.idx.get(f.id) : -1, e.originalEvent); });
      this.ro = new ResizeObserver(() => { if (this.fitBrasil && this.pronto) this.resetar(true); }); this.ro.observe(el);
    }
    get w() { return this.el.clientWidth; } get h() { return this.el.clientHeight; }
    cores() { const cs = getComputedStyle(this.el), V = (n, d) => cs.getPropertyValue(n).trim() || d; return { sea: V("--map-sea", "#100e0c"), neutro: V("--sev-nenhum", "#2f2a25"), padrao: V("--sev-padrao", "rgba(14,12,11,.6)"), dim: V("--map-dim", "#1a1815"), uf: V("--map-uf", "rgba(250,246,240,.5)"), borda: V("--map-borda", "rgba(16,14,12,.55)"), rot: V("--map-rot", "#fff"), halo: V("--map-halo", "rgba(16,14,12,.9)"), sel: V("--on", "#fff") }; }
    padding() { const i = this.op.insets ? this.op.insets() : null; return i ? { left: i.l, right: i.r, top: i.t, bottom: i.b } : { left: 0, right: 0, top: 0, bottom: 0 }; }
    montaCamadas() {
      const m = this.map, c = this.cores(), fonte = ["Open Sans Semibold"];
      const base = location.origin + location.pathname.replace(/[^/]*$/, "");
      m.addSource("mun", { type: "vector", tiles: [base + "tiles/{z}/{x}/{y}.pbf"], minzoom: 0, maxzoom: 8, bounds: [-74.2, -34, -28.6, 5.4], promoteId: { mun: "c" } });
      m.addSource("rot", { type: "geojson", data: this.dados.rot, maxzoom: 8 });
      m.addSource("ufr", { type: "geojson", data: this.dados.ufr });
      m.addLayer({ id: "mun-fill", type: "fill", source: "mun", "source-layer": "mun", paint: { "fill-color": ["coalesce", ["feature-state", "cor"], c.neutro], "fill-color-transition": { duration: 600 }, "fill-antialias": true } });
      this.padroes(c.padrao);
      m.addLayer({ id: "mun-hachura", type: "fill", source: "mun", "source-layer": "mun", paint: { "fill-pattern": "hachura", "fill-opacity": ["case", ["==", ["feature-state", "p"], 3], 1, 0] } });
      m.addLayer({ id: "mun-pontos", type: "fill", source: "mun", "source-layer": "mun", paint: { "fill-pattern": "pontos", "fill-opacity": ["case", ["==", ["feature-state", "p"], 2], 1, 0] } });
      // costura: contorno de ~1 px na MESMA cor do município cobre as frestas que a simplificação dos tiles abre entre vizinhos
      m.addLayer({ id: "mun-costura", type: "line", source: "mun", "source-layer": "mun", layout: { "line-join": "round" }, paint: { "line-color": ["coalesce", ["feature-state", "cor"], c.neutro], "line-color-transition": { duration: 600 }, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.9, 8, 1.2] } });
      m.addLayer({ id: "mun-line", type: "line", source: "mun", "source-layer": "mun", minzoom: 5, paint: { "line-color": c.borda, "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.25, 9, 0.7, 12, 1.2], "line-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0, 6.5, 1] } });
      m.addLayer({ id: "uf-line", type: "line", source: "mun", "source-layer": "uf", layout: { "line-join": "round" }, paint: { "line-color": c.uf, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.6, 8, 1.5] } });
      m.addLayer({ id: "hov-line", type: "line", source: "mun", "source-layer": "mun", filter: ["==", ["get", "c"], -1], layout: { "line-join": "round" }, paint: { "line-color": c.sel, "line-width": 1.8, "line-opacity": 0.75 } });
      m.addLayer({ id: "sel-line", type: "line", source: "mun", "source-layer": "mun", filter: ["==", ["get", "c"], -1], layout: { "line-join": "round" }, paint: { "line-color": c.sel, "line-width": 3 } });
      m.addLayer({ id: "rot-mun", type: "symbol", source: "rot", minzoom: 5.4, layout: { "text-field": ["get", "n"], "text-font": fonte, "text-size": ["interpolate", ["linear"], ["zoom"], 5.4, 10, 10, 13], "symbol-sort-key": ["get", "s"], "text-padding": 4, "text-max-width": 7 }, paint: { "text-color": c.rot, "text-halo-color": c.halo, "text-halo-width": 1.4 } });
      m.addLayer({ id: "rot-uf", type: "symbol", source: "ufr", maxzoom: 6, layout: { "text-field": ["get", "n"], "text-font": fonte, "text-size": 12, "text-allow-overlap": true }, paint: { "text-color": c.rot, "text-halo-color": c.halo, "text-halo-width": 1.6 } });
      this.pronto = true; this.recolore(); this.setSel(this.sel);
      // tira o "Carregando" assim que os municípios chegam (sem esperar o mapa parar de se mexer)
      const cedo = (e) => { if (e.sourceId !== "mun" || !e.isSourceLoaded || this.avisouPronto) return; let n = 0; try { n = m.querySourceFeatures("mun", { sourceLayer: "mun" }).length; } catch (x) { /* ainda não */ } if (n) { this.avisouPronto = true; this.carregou = true; m.off("sourcedata", cedo); if (this.op.aoPronto) this.op.aoPronto(); } };
      m.on("sourcedata", cedo);
      m.once("idle", () => { // tile que não chega (404, offline) não gera erro no MapLibre: confere se algum município foi desenhado
        this.carregou = true;
        const tem = () => m.querySourceFeatures("mun", { sourceLayer: "mun" }).length > 0;
        if (this.avisouPronto) return;
        if (tem()) { this.avisouPronto = true; if (this.op.aoPronto) this.op.aoPronto(); return; }
        // ainda vazio: espera os tiles mais um pouco antes de declarar erro (aparelho lento ou aba em segundo plano)
        const ok = () => { if (tem()) { m.off("sourcedata", ok); clearTimeout(t); if (this.op.aoPronto) this.op.aoPronto(); } };
        m.on("sourcedata", ok);
        const t = setTimeout(() => { m.off("sourcedata", ok); if (!tem() && this.op.aoErro && !this.avisou) { this.avisou = true; this.op.aoErro(); } }, 10000);
      });
    }
    padroes(cor) { // desenha os ladrilhos dos padrões na cor do tema (troca junto com o tema)
      const m = this.map, px = Math.min(window.devicePixelRatio || 1, 2), faz = (nome, fn) => { const s = 8 * px, cv = document.createElement("canvas"); cv.width = cv.height = s; const x = cv.getContext("2d"); x.scale(px, px); x.fillStyle = x.strokeStyle = cor; fn(x); const img = x.getImageData(0, 0, s, s); if (m.hasImage(nome)) m.updateImage(nome, img); else m.addImage(nome, img, { pixelRatio: px }); };
      faz("hachura", (x) => { x.lineWidth = 1.6; x.beginPath(); for (const o of [-8, 0, 8]) { x.moveTo(o, 8); x.lineTo(o + 8, 0); } x.stroke(); });
      faz("pontos", (x) => { x.beginPath(); x.arc(2, 2, 1.1, 0, 7); x.arc(6, 6, 1.1, 0, 7); x.fill(); });
    }
    aplicaTema() {
      if (!this.pronto) return; const m = this.map, c = this.cores(); this.padroes(c.padrao);
      m.setPaintProperty("fundo", "background-color", c.sea); m.setPaintProperty("mun-fill", "fill-color", ["coalesce", ["feature-state", "cor"], c.neutro]); m.setPaintProperty("mun-costura", "line-color", ["coalesce", ["feature-state", "cor"], c.neutro]);
      m.setPaintProperty("mun-line", "line-color", c.borda); m.setPaintProperty("uf-line", "line-color", c.uf);
      m.setPaintProperty("hov-line", "line-color", c.sel); m.setPaintProperty("sel-line", "line-color", c.sel);
      for (const id of ["rot-mun", "rot-uf"]) { m.setPaintProperty(id, "text-color", c.rot); m.setPaintProperty(id, "text-halo-color", c.halo); }
    }
    recolore() {
      if (!this.pronto) return; const m = this.map, dest = this.destaque, dim = this.cores().dim;
      const pad = this.op.padrao || (() => 0);
      for (let i = 0; i < this.n; i++) { const fora = dest && !dest.has(i), c = fora ? dim : this.cor(i), p = fora ? 0 : pad(i), k = c + p; if (this.ult[i] !== k) { m.setFeatureState({ source: "mun", sourceLayer: "mun", id: this.cod[i] }, { cor: c, p }); this.ult[i] = k; } }
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
    // município sob um ponto (lon, lat): aproxima, espera os tiles e consulta o polígono desenhado. Devolve o índice ou -1.
    municipioEm(lon, lat) {
      const m = this.map; this.fitBrasil = false;
      return new Promise((ok) => {
        m.easeTo({ center: [lon, lat], zoom: Math.max(m.getZoom(), 9), duration: 600 });
        m.once("idle", () => { const f = m.queryRenderedFeatures(m.project([lon, lat]), { layers: ["mun-fill"] })[0]; ok(f ? this.idx.get(f.id) ?? -1 : -1); });
      });
    }
    // contorno detalhado (cartão de compartilhar, localização): baixado só quando preciso, em segundo plano
    carregaFormas() { if (!this.pFormas) this.pFormas = fetch("data/municipios.json").then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((g) => { this.paths = g.d; return g; }).catch((e) => { this.pFormas = null; throw e; }); return this.pFormas; }
    forma(i) { return this.paths && this.paths[i] ? { path: new Path2D(this.paths[i]), caixa: caixa(this.paths[i]) } : null; }
  }
  window.MapaGL = MapaGL; window.MapaGL.suportado = suportado;
})();

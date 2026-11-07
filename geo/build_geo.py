#!/usr/bin/env python3
"""Baixa as malhas do IBGE e gera dois arquivos compactos em ../site/data/:
  estados.json    -> viewBox, posicao das siglas e UMA linha com todas as divisas de estado/costa (derivada dos municipios)
  municipios.json -> {c: codigos IBGE, n: nomes, d: caminhos SVG relativos} dos 5.570 municipios
Diferenca para a versao anterior: a simplificacao e TOPOLOGICA. Cada divisa compartilhada entre dois municipios (um "arco")
e simplificada uma unica vez e reutilizada pelos dois lados, entao nao surgem frestas nem sobreposicoes, e as linhas de estado
coincidem exatamente com as divisas dos municipios.
Uso: python geo/build_geo.py [eps]     (precisa de internet na primeira vez; guarda cache em geo/.cache; so biblioteca padrao)
Dados: IBGE (malhas territoriais), uso livre com citacao da fonte."""
import json, math, gzip, os, sys, hashlib, urllib.request

UA = {"User-Agent": "alertabr/1.0"}
UF = {"11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO", "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA", "31": "MG", "32": "ES", "33": "RJ", "35": "SP", "41": "PR", "42": "SC", "43": "RS", "50": "MS", "51": "MT", "52": "GO", "53": "DF"}
API = "https://servicodados.ibge.gov.br/api"
AQUI = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(AQUI, "..", "site", "data")
CACHE = os.path.join(AQUI, ".cache")
EPS = float(sys.argv[1]) if len(sys.argv) > 1 else 0.14   # tolerancia em unidades do mapa (viewBox de 1000 de largura)
QUAL = "intermediaria"                                       # qualidade da malha de origem dos municipios
PREC = 20                                                    # grade de arredondamento: 1/PREC unidade (0,05)

os.makedirs(CACHE, exist_ok=True)

def baixa(url):
    f = os.path.join(CACHE, hashlib.md5(url.encode()).hexdigest() + ".json")
    if os.path.exists(f):
        return json.load(open(f, encoding="utf-8"))
    for t in range(4):
        try:
            b = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180).read(); break
        except Exception as e:
            if t == 3: raise
    if b[:2] == bytes([31, 139]): b = gzip.decompress(b)
    j = json.loads(b.decode("utf-8")); json.dump(j, open(f, "w", encoding="utf-8")); return j

def aneis(geom, so_externo=False):
    polys = [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
    return [poly[0] for poly in polys] if so_externo else [r for poly in polys for r in poly]

# --- estados: so para definir a projecao (equiretangular corrigida pela latitude media do Brasil) e a posicao das siglas ---
estados = baixa(f"{API}/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=UF")
K = math.cos(math.radians(-15))
pts = [c for f in estados["features"] for r in aneis(f["geometry"], True) for c in r]
minx = min(p[0] for p in pts) * K; maxx = max(p[0] for p in pts) * K; miny = min(-p[1] for p in pts); maxy = max(-p[1] for p in pts)
S = 1000 / (maxx - minx); H = math.ceil((maxy - miny) * S)
P = lambda c: ((c[0] * K - minx) * S, (-c[1] - miny) * S)

def dp(p, eps):  # Douglas-Peucker iterativo (as divisas podem ter milhares de pontos)
    n = len(p)
    if n < 3: return list(p)
    keep = [False] * n; keep[0] = keep[-1] = True; pilha = [(0, n - 1)]
    while pilha:
        i, j = pilha.pop(); a, b = p[i], p[j]; dx, dy = b[0] - a[0], b[1] - a[1]; den = math.hypot(dx, dy)
        dmax, idx = 0.0, -1
        for k in range(i + 1, j):
            x, y = p[k]
            d = abs(dy * (x - a[0]) - dx * (y - a[1])) / den if den > 1e-12 else math.hypot(x - a[0], y - a[1])
            if d > dmax: dmax, idx = d, k
        if dmax > eps and idx > 0: keep[idx] = True; pilha.append((i, idx)); pilha.append((idx, j))
    return [p[k] for k in range(n) if keep[k]]

def centro(r):
    A = sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1)) / 2
    if not A: return abs(A), r[0]
    cx = sum((r[i][0] + r[i + 1][0]) * (r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]) for i in range(len(r) - 1)) / (6 * A)
    cy = sum((r[i][1] + r[i + 1][1]) * (r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]) for i in range(len(r) - 1)) / (6 * A)
    return abs(A), (cx, cy)

lab = {}
for f in estados["features"]:
    u = UF[f["properties"]["codarea"]]; melhor = (0, None)
    for ring in aneis(f["geometry"], True):
        r = [P(c) for c in ring]
        if len(r) < 3: continue
        a, c = centro(r if r[0] == r[-1] else r + [r[0]])
        if a > melhor[0]: melhor = (a, c)
    lab[u] = [round(melhor[1][0]), round(melhor[1][1])]

# --- municipios: baixa as malhas por estado ---
nomes = {str(x["id"]): x["nome"] for x in baixa(f"{API}/v1/localidades/municipios")}
feats = []
for cod in UF:
    j = baixa(f"{API}/v3/malhas/estados/{cod}?formato=application/vnd.geo+json&qualidade={QUAL}&intrarregiao=municipio")
    feats += j["features"]
    print("  malha", UF[cod], len(j["features"]), end="\r")
feats.sort(key=lambda f: f["properties"]["codarea"])
print("\nmunicipios:", len(feats))

# --- topologia: quem usa cada aresta ---
Q = 1e5
vk = lambda c: (round(c[0] * Q), round(c[1] * Q))      # chave de vertice (coordenadas iguais nos vizinhos)
poligonos = []   # por municipio: aneis externos e todos os aneis (chaves de vertice)
dono = {}        # aresta (a,b) ordenada -> conjunto de indices de municipio
proj = {}        # chave de vertice -> ponto projetado
for idx, f in enumerate(feats):
    ext, todos = [], []
    geom = f["geometry"]; polys = [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
    for poly in polys:
        for k, ring in enumerate(poly):
            out = []
            for c in ring:
                key = vk(c)
                if not out or out[-1] != key: out.append(key)
                if key not in proj: proj[key] = P(c)
            if len(out) > 1 and out[0] == out[-1]: out.pop()
            if len(out) < 3: continue
            todos.append(out)
            if k == 0: ext.append(out)
    poligonos.append((ext, todos))
    for ring in todos:
        n = len(ring)
        for i in range(n):
            a, b = ring[i], ring[(i + 1) % n]
            dono.setdefault((a, b) if a < b else (b, a), set()).add(idx)
cods = [int(f["properties"]["codarea"]) for f in feats]
ufde = [str(c)[:2] for c in cods]

def sig(a, b): return frozenset(dono[(a, b) if a < b else (b, a)])

cache_arco = {}   # arco canonico -> pontos simplificados (na orientacao canonica)
arcos_borda = {}  # arcos que sao divisa de estado ou costa/fronteira -> pontos
def arco_simplificado(vs, assinatura):
    t = tuple(vs); r = t[::-1]; canon, inv = (t, False) if t <= r else (r, True)
    if canon not in cache_arco:
        pts = dp([proj[k] for k in canon], EPS)
        cache_arco[canon] = pts
        ufs = {ufde[i] for i in assinatura}
        if len(assinatura) == 1 or len(ufs) > 1:   # costa/fronteira do pais, ou divisa entre estados
            arcos_borda[canon] = pts
    pts = cache_arco[canon]
    return pts[::-1] if inv else pts

def anel_simplificado(ring):
    n = len(ring); sigs = [sig(ring[i], ring[(i + 1) % n]) for i in range(n)]
    quebras = [i for i in range(n) if sigs[i - 1] != sigs[i]]   # o vertice i comeca uma aresta com outro conjunto de donos
    if not quebras:   # anel isolado: um unico arco fechado, simplificado em duas metades
        h = n // 2; a = [proj[k] for k in ring[:h + 1]]; b = [proj[k] for k in ring[h:] + [ring[0]]]
        return dp(a, EPS)[:-1] + dp(b, EPS)[:-1]
    ring = ring[quebras[0]:] + ring[:quebras[0]]; sigs = sigs[quebras[0]:] + sigs[:quebras[0]]
    quebras = [i for i in range(n) if sigs[i - 1] != sigs[i]] + [n]
    pts = []
    for a, b in zip(quebras, quebras[1:]):
        trecho = ring[a:b + 1] if b < n else ring[a:] + [ring[0]]
        pts += arco_simplificado(trecho, sigs[a])[:-1]
    return pts

def grade(pts):
    r = [(round(x * PREC), round(y * PREC)) for x, y in pts]; out = [r[0]]
    for p in r[1:]:
        if p != out[-1]: out.append(p)
    return out

def caminho(out, fechado):
    f = lambda v: ("%g" % (v / PREC))
    return "M%s,%s" % (f(out[0][0]), f(out[0][1])) + "".join("l%s,%s" % (f(b[0] - a[0]), f(b[1] - a[1])) for a, b in zip(out, out[1:])) + ("z" if fechado else "")

def rel(pts):
    out = grade(pts)
    if len(out) > 1 and out[0] == out[-1]: out.pop()
    return caminho(out, True) if len(out) >= 3 else ""

C, N, D = [], [], []
for idx, (ext, todos) in enumerate(poligonos):
    d = "".join(x for x in (rel(anel_simplificado(r)) for r in ext) if x)
    if d:
        C.append(cods[idx]); N.append(nomes.get(str(cods[idx]), str(cods[idx]))); D.append(d)
    if idx % 500 == 0: print("  simplificando", idx, end="\r")

# linha unica com todas as divisas de estado e a costa
linhas = "".join(caminho(g, False) for g in (grade(p) for p in arcos_borda.values()) if len(g) >= 2)

os.makedirs(OUT, exist_ok=True)
json.dump({"vb": f"0 0 1000 {H}", "lab": lab, "linhas": linhas, "proj": [K, minx, miny, S]}, open(os.path.join(OUT, "estados.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
json.dump({"c": C, "n": N, "d": D}, open(os.path.join(OUT, "municipios.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
compartilhadas = sum(1 for s in dono.values() if len(s) > 1); total = len(dono)
print(f"\nok: {len(C)} municipios | arcos {len(cache_arco)} (borda: {len(arcos_borda)}) | arestas compartilhadas {compartilhadas}/{total} ({100 * compartilhadas // total}%)")
for nome in ("municipios.json", "estados.json"):
    print(nome, os.path.getsize(os.path.join(OUT, nome)) // 1024, "KB")

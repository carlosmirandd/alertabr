#!/usr/bin/env python3
"""Baixa as malhas do IBGE (estados e municípios) e gera dois arquivos compactos em data/:
  estados.json    -> contorno dos 27 estados (SVG, viewBox 1000 x ~1031) e posição das siglas
  municipios.json -> {c: códigos IBGE, n: nomes, d: caminhos SVG relativos} dos 5.570 municípios
Uso: python build_geo.py      (precisa de internet; leva ~1 minuto; só biblioteca padrão)
Dados: IBGE (malhas territoriais), uso livre com citação da fonte."""
import json, math, gzip, os, urllib.request

UA = {"User-Agent": "alertabr/1.0"}
UF = {"11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO", "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA", "31": "MG", "32": "ES", "33": "RJ", "35": "SP", "41": "PR", "42": "SC", "43": "RS", "50": "MS", "51": "MT", "52": "GO", "53": "DF"}
API = "https://servicodados.ibge.gov.br/api"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "site", "data")

def baixa(url):
    b = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90).read()
    if b[:2] == bytes([31, 139]): b = gzip.decompress(b)
    return json.loads(b.decode("utf-8"))

def aneis(geom):
    polys = [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
    return [poly[0] for poly in polys]  # só o anel externo de cada polígono

# --- estados: define a projeção (equiretangular corrigida pela latitude média do Brasil) ---
estados = baixa(f"{API}/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=UF")
K = math.cos(math.radians(-15))
pts = [c for f in estados["features"] for r in aneis(f["geometry"]) for c in r]
minx = min(p[0] for p in pts) * K; maxx = max(p[0] for p in pts) * K; miny = min(-p[1] for p in pts); maxy = max(-p[1] for p in pts)
S = 1000 / (maxx - minx); H = math.ceil((maxy - miny) * S)
P = lambda c: ((c[0] * K - minx) * S, (-c[1] - miny) * S)

def dp(p, eps):  # Douglas-Peucker
    if len(p) < 3: return p
    a, b = p[0], p[-1]; den = math.hypot(b[0] - a[0], b[1] - a[1]) or 1e-9; dmax, idx = 0, 0
    for i in range(1, len(p) - 1):
        x, y = p[i]; d = abs((b[1] - a[1]) * x - (b[0] - a[0]) * y + b[0] * a[1] - b[1] * a[0]) / den
        if d > dmax: dmax, idx = d, i
    return dp(p[:idx + 1], eps)[:-1] + dp(p[idx:], eps) if dmax > eps else [a, b]

def simplifica(ring, eps):
    q = [P(c) for c in ring[:-1]]
    if len(q) <= 6: return q
    h = len(q) // 2; r = dp(q[:h + 1], eps)[:-1] + dp(q[h:] + [q[0]], eps)
    return r[:-1] if r[-1] == q[0] and len(r) > 3 else r

def centro(r):
    A = sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1)) / 2
    if not A: return abs(A), r[0]
    cx = sum((r[i][0] + r[i + 1][0]) * (r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]) for i in range(len(r) - 1)) / (6 * A)
    cy = sum((r[i][1] + r[i + 1][1]) * (r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]) for i in range(len(r) - 1)) / (6 * A)
    return abs(A), (cx, cy)

est = {"vb": f"0 0 1000 {H}", "d": {}, "lab": {}}
for f in estados["features"]:
    u = UF[f["properties"]["codarea"]]; partes = []; melhor = (0, None)
    for ring in aneis(f["geometry"]):
        r = simplifica(ring, 0.9)
        if len(r) < 3: continue
        partes.append("M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in r) + "Z")
        a, c = centro(r + [r[0]])
        if a > melhor[0]: melhor = (a, c)
    est["d"][u] = "".join(partes); est["lab"][u] = [round(melhor[1][0]), round(melhor[1][1])]
os.makedirs(OUT, exist_ok=True)
json.dump(est, open(os.path.join(OUT, "estados.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("estados.json ok:", len(est["d"]), "estados")

# --- municípios: caminhos relativos (menores), um por município, ordenados pelo código IBGE ---
def caminho_rel(ring, eps):
    r = [(round(x * 10), round(y * 10)) for x, y in simplifica(ring, eps)]
    out = [r[0]]
    for p in r[1:]:
        if p != out[-1]: out.append(p)
    if len(out) < 3: return ""
    return "M%g,%g" % (out[0][0] / 10, out[0][1] / 10) + "".join("l%g,%g" % ((b[0] - a[0]) / 10, (b[1] - a[1]) / 10) for a, b in zip(out, out[1:])) + "z"

nomes = {str(x["id"]): x["nome"] for x in baixa(f"{API}/v1/localidades/municipios")}
feats = []
for cod in UF:
    if cod == "53":  # o DF tem um município só: usa o contorno do estado
        for f in estados["features"]:
            if f["properties"]["codarea"] == "53": feats.append({"properties": {"codarea": "5300108"}, "geometry": f["geometry"]})
        continue
    feats += baixa(f"{API}/v3/malhas/estados/{cod}?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio")["features"]
    print("  malha", UF[cod], end="\r")
feats.sort(key=lambda f: f["properties"]["codarea"])
C, N, D = [], [], []
for f in feats:
    code = f["properties"]["codarea"]; p = "".join(x for x in (caminho_rel(r, 0.28) for r in aneis(f["geometry"])) if x)
    if p: C.append(int(code)); N.append(nomes.get(code, code)); D.append(p)
json.dump({"c": C, "n": N, "d": D}, open(os.path.join(OUT, "municipios.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("municipios.json ok:", len(C), "municípios")

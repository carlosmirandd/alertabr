#!/usr/bin/env python3
"""Gera os ícones do app instalável (PWA) em site/icons/. Uso: python scripts/icones.py  (precisa do Pillow)"""
import os
from PIL import Image, ImageDraw

SAIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "site", "icons")
FUNDO, ALERTA = (20, 17, 15, 255), (245, 165, 36, 255)
os.makedirs(SAIDA, exist_ok=True)

def icone(tam, arredondado, escala):
    s = 4  # desenha em 4x e reduz para suavizar as bordas
    T = tam * s
    im = Image.new("RGBA", (T, T), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    if arredondado: d.rounded_rectangle([0, 0, T - 1, T - 1], radius=int(T * 0.22), fill=FUNDO)
    else: d.rectangle([0, 0, T, T], fill=FUNDO)
    cx, cy, L = T / 2, T * 0.53, T * escala  # triângulo de aviso
    topo = (cx, cy - L * 0.52); esq = (cx - L * 0.58, cy + L * 0.42); dir_ = (cx + L * 0.58, cy + L * 0.42)
    d.polygon([topo, esq, dir_], fill=ALERTA)
    # cantos arredondados do triângulo: círculos nas pontas
    r = L * 0.05
    for p in (topo, esq, dir_): d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=ALERTA)
    # ponto de exclamação
    w = L * 0.085
    d.rounded_rectangle([cx - w, cy - L * 0.16, cx + w, cy + L * 0.12], radius=w, fill=FUNDO)
    d.ellipse([cx - w * 1.05, cy + L * 0.19, cx + w * 1.05, cy + L * 0.19 + w * 2.1], fill=FUNDO)
    return im.resize((tam, tam), Image.LANCZOS)

icone(192, True, 0.66).save(os.path.join(SAIDA, "icon-192.png"))
icone(512, True, 0.66).save(os.path.join(SAIDA, "icon-512.png"))
icone(512, False, 0.5).save(os.path.join(SAIDA, "icon-maskable-512.png"))   # ocupa o miolo seguro (80 %)
icone(180, False, 0.62).save(os.path.join(SAIDA, "apple-touch-icon.png"))   # o iOS arredonda sozinho
open(os.path.join(SAIDA, "favicon.svg"), "w", encoding="utf8").write(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#14110f"/><path d="M16 5 28 26H4z" fill="#f5a524"/><rect x="14.6" y="13" width="2.8" height="7" rx="1.4" fill="#14110f"/><circle cx="16" cy="23" r="1.6" fill="#14110f"/></svg>')
print("ok:", sorted(os.listdir(SAIDA)))

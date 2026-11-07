# Arquitetura e decisões

## Formato do `estado.json`

```jsonc
{
  "v": 1,
  "gerado": 1794024571878,            // ms (UTC) em que o relay montou o arquivo
  "fontes": { "inmet": { "ok": true }, "inpe": { "ok": true } },
  "resumo": { "focos": 23116, "alertas": 6 },
  "alertas": [ { "id": 28644, "t": "Tempestade", "sev": 3, "cor": "#F80703", "ini": "2026-11-07 00:00", "fim": "2026-11-07 23:59",
                 "uf": "Santa Catarina,Rio Grande do Sul", "h": 0, "r": ["riscos"], "i": ["o que fazer"], "n": 325 } ],
  "s": [0, 0, 3, ...],                // severidade máxima de HOJE por município (0-3), 5.570 posições
  "f": [0, 12, 0, ...],               // focos nas últimas 24 h por município
  "frp": { "123": 480 },              // potência radiativa (MW) somada, só onde há focos
  "m": { "123": [0, 4] }              // município -> posições em "alertas" (hoje e próximos dias)
}
```

`h`: 0 = vale hoje, 1 = dias seguintes. `sev`: 1 perigo potencial, 2 perigo, 3 grande perigo.

## Por que um relay e não só funções de borda

- O CSV diário do INPE passa de vários MB em temporada de queimadas. Funções gratuitas têm ~10 ms de CPU.
- Fontes públicas podem bloquear IPs de datacenter ou limitar chamadas; um relay único, com retentativas e "último dado bom", protege a fonte e o site.
- O navegador baixa ~100 KB (gzip menor) em vez de vários arquivos.

## Mapa

- `geo/build_geo.py` baixa as malhas do IBGE (estados e municípios), projeta (equiretangular corrigida pela latitude de −15°), simplifica com Douglas-Peucker e grava caminhos SVG **relativos** (menores). Ordem = código IBGE crescente.
- `site/mapa.js` converte cada caminho em `Path2D`, calcula a caixa de cada um uma vez, e usa:
  - culling por caixa; um único `fill` por município, com traço da mesma cor para cobrir frestas;
  - CSS `transform` durante gestos e redesenho após 110 ms parado;
  - teste de clique com `isPointInPath` só nos candidatos da caixa, em um canvas auxiliar sem transformação.

## Segurança

- Texto vindo das fontes (avisos, notícias) é sempre escapado antes de entrar no HTML; links de notícia só passam se forem `https`.
- `/api/noticias` só consulta um host fixo (sem SSRF) e limita o tamanho da busca.

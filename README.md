# alertabr

[![CI](https://github.com/carlosmirandd/alertabr/actions/workflows/ci.yml/badge.svg)](https://github.com/carlosmirandd/alertabr/actions/workflows/ci.yml) ![licença MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-green) ![sem dependências](https://img.shields.io/badge/depend%C3%AAncias-0-blue)

Mapa ao vivo dos **avisos do INMET** e dos **focos de calor do INPE** em todos os **5.570 municípios** do Brasil, com **notícias locais** e **cartões prontos para compartilhar** (WhatsApp, stories).

Em desastres, a informação oficial fica espalhada entre INMET, INPE, Defesa Civil e jornais locais. O alertabr junta tudo em uma tela: você busca a sua cidade e vê o que está valendo agora, o que fazer e o que a imprensa local está dizendo, e gera uma imagem para mandar para a família.

- Sem build, sem framework, sem chave de API: HTML + JS puro, um relay em Node e uma função de borda.
- Feito para não travar: o mapa usa `<canvas>` e só redesenha o que está na tela.

## O que tem

| Peça | Onde | O que faz |
|---|---|---|
| **Relay** | `relay/` | Lê INMET e INPE, cruza com os códigos IBGE e publica **um** `estado.json` compacto (~100 KB). Mantém o último dado bom de cada fonte se uma cair. |
| **Mapa** | `site/mapa.js`, `geo/` | Mapa por município em canvas: zoom, arrastar, pinça, clique, busca, camadas Alertas / Focos de calor. A malha vem do IBGE e é simplificada por `geo/build_geo.py`. |
| **Radar de notícias** | `functions/api/noticias.js` | Busca no Google Notícias por município e tema, junta títulos parecidos, cache de 10 min na borda. |
| **Cartões** | `site/cartao.js` | PNG 1080×1080 (post) ou 1080×1920 (stories) desenhado no navegador, com o contorno do município, risco, o que fazer e a fonte. |

## Como funciona

```
INMET (avisos) ─┐
                ├─►  relay/relay.mjs  ──►  estado.json (R2 / CDN)  ──►  site estático
INPE  (focos)  ─┘     (a cada 5 min)                                    (lê a cada 60 s,
                                                                         pausa com a aba escondida)
Google Notícias ─────────────────────►  /api/noticias (cache de borda) ─►  aba Notícias
```

Pontos de design que importam para o desempenho:

- **Um arquivo só.** Os vetores `s` (severidade) e `f` (focos) têm 5.570 posições, na mesma ordem de `site/data/municipios.json`. O navegador não recebe nomes nem códigos de novo.
- **Quem processa é o relay**, não o navegador nem a função de borda (o CSV de focos tem vários MB e estouraria o limite de CPU de uma função gratuita).
- **Leitura em cascata**: R2 → `/api/estado` → cópia local do deploy. Se uma falhar, a próxima assume.
- **Mapa em canvas** com caixa de cada município (só desenha o visível), imagem em cache movida por CSS durante gestos e redesenho só quando para, teto de pixels no canvas (telas 4K não pesam).

## Rodar localmente

Precisa de Node 20+ (e Python 3 só se quiser refazer a malha).

```bash
npm run semente   # baixa INMET + INPE e grava site/data/estado.json
npm run dev       # http://localhost:8788
npm test
```

`npm run geo` refaz `site/data/municipios.json` e `estados.json` a partir do IBGE (já vêm no repositório).

## Publicar (Cloudflare)

O relay grava no R2 e o site lê dali.

```bash
npx wrangler r2 bucket create alertabr
npx wrangler r2 bucket dev-url enable alertabr          # mostra o endereço público https://pub-xxxx.r2.dev
npx wrangler r2 bucket cors set alertabr --file cors.json
npx wrangler pages project create alertabr --production-branch main
```

Coloque o endereço público em `FEED` (`site/config.js`), por exemplo `https://pub-xxxx.r2.dev/estado.json`, e então:

```bash
npx wrangler pages deploy site --project-name alertabr   # o site fica em https://alertabr.pages.dev
node relay/relay.mjs                                      # deixe rodando
```

O endereço `r2.dev` serve para começar, mas a Cloudflare o limita; para uso intenso, ligue um domínio seu ao bucket e use esse endereço em `FEED`. Variáveis do relay: `BUCKET` (padrão `alertabr`), `CHAVE` (padrão `estado.json`), `INTERVALO` em segundos (padrão 300).

Para rodar o relay sem o seu computador, veja `.github/workflows/relay.yml` (agendamento desligado por padrão; não foi testado a partir dos IPs do GitHub).

## Limites e cuidados

- **Não substitui a Defesa Civil.** É uma camada de visualização sobre dados públicos. Em emergência: 199 (Defesa Civil) e 193 (Bombeiros).
- **Focos de calor são detecções de satélite**, não incêndios confirmados. Um mesmo fogo pode gerar mais de uma detecção.
- Os avisos do INMET valem para o dia (aba "Próximos dias" mostra os futuros). O site avisa quando os dados estão velhos ou quando uma fonte está fora do ar.
- O contorno dos municípios é simplificado para ficar leve; pequenas frestas entre vizinhos são esperadas.
- Os endereços do INMET e do INPE não são APIs documentadas com contrato; se mudarem, o relay falha de forma visível (`INMET`/`INPE fora do ar` no topo da página).

## Contribuindo

PRs e ideias são bem-vindos: veja [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) e o [código de conduta](CODE_OF_CONDUCT.md).

## Fontes e licenças

- Avisos: [INMET](https://alertas2.inmet.gov.br/) · Focos: [INPE Queimadas](https://terrabrasilis.dpi.inpe.br/queimadas/portal/) · Malhas e nomes: [IBGE](https://www.ibge.gov.br/) · Notícias: Google Notícias (somente títulos e links).
- Detalhes de cada fonte e atribuição em [DADOS.md](DADOS.md).
- Código sob licença MIT (`LICENSE`).

# alertabr

[![CI](https://github.com/carlosmirandd/alertabr/actions/workflows/ci.yml/badge.svg)](https://github.com/carlosmirandd/alertabr/actions/workflows/ci.yml) ![licença MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-green) ![PWA](https://img.shields.io/badge/PWA-instal%C3%A1vel-5a0fc8)

Mapa ao vivo dos **avisos do INMET** e dos **focos de calor do INPE** em todos os **5.570 municípios** do Brasil, com **notícias locais** e **cartões prontos para compartilhar** (WhatsApp, stories).

Em desastres, a informação oficial fica espalhada entre INMET, INPE, Defesa Civil e jornais locais. O alertabr junta tudo em uma tela: você busca a sua cidade e vê o que está valendo agora, o que fazer e o que a imprensa local está dizendo, e gera uma imagem para mandar para a família.

- Sem build, sem framework, sem chave de API: HTML + JS puro, um relay em Node e uma função de borda. A única biblioteca é o [MapLibre GL](https://maplibre.org) (já incluída em `site/vendor/`, licença BSD-3).
- Feito para não travar: o mapa roda na **GPU** (WebGL/MapLibre) e as cores são trocadas por "estado de feição", sem refazer geometria. Sem WebGL, cai para um mapa em `<canvas>`.
- **App instalável (PWA)**: abre pela tela inicial, em tela cheia, e mostra o último dado salvo mesmo sem internet.

## O que tem

| Peça | Onde | O que faz |
|---|---|---|
| **Relay** | `relay/` | Lê INMET e INPE, cruza com os códigos IBGE e publica **um** `estado.json` compacto (~100 KB). Mantém o último dado bom de cada fonte se uma cair. |
| **Mapa** | `site/mapa-gl.js` (WebGL), `site/mapa.js` (reserva em canvas), `geo/` | Mapa por município: zoom, arrastar, pinça, clique, busca, nomes de cidades, camadas Alertas / Focos de calor. A malha vem do IBGE, é simplificada por `geo/build_geo.py` e vira tiles vetoriais estáticos com `geo/tiles.mjs`: o navegador baixa só os pedaços visíveis. |
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

## Rodar no seu computador (sem Cloudflare)

Não precisa de conta em nada: o site, o relay e as notícias rodam localmente.

**Requisitos:** [Node.js](https://nodejs.org) 20 ou mais novo e Git. Python 3 só se quiser refazer a malha dos municípios.

```bash
git clone https://github.com/carlosmirandd/alertabr
cd alertabr
npm run semente    # baixa INMET + INPE e grava site/data/estado.json (leva alguns segundos)
npm run dev        # sobe o site em http://localhost:8788
```

Abra http://localhost:8788. Em `localhost` o site lê o `site/data/estado.json` do seu computador (para testar com o feed publicado, abra `http://localhost:8788/?feed=1`).

**Manter os dados atualizados enquanto você usa**, em um segundo terminal:

```bash
node relay/relay.mjs --out site/data     # atualiza o arquivo a cada 5 min
```

Para atualizar mais rápido (mínimo 60 s), defina `INTERVALO`. No PowerShell: `$env:INTERVALO=120; node relay/relay.mjs --out site/data`. No Linux/macOS: `INTERVALO=120 node relay/relay.mjs --out site/data`. A página relê o arquivo a cada 60 s.

**Outras coisas úteis:**

| Comando | Para quê |
|---|---|
| `npm run dev -- 3000` | usar outra porta |
| `npm test` | testes rápidos (sem dependências) |
| `npm run geo` | refaz a malha dos municípios a partir do IBGE (Python 3; cache em `geo/.cache`) e depois os tiles |
| `npm run tiles` | gera os tiles vetoriais do mapa (`site/tiles/`), o índice leve `site/data/mun.json` e o contorno do esqueleto no `index.html` (precisa de `npm install` uma vez) |
| `npx wrangler pages dev site` | testar com o ambiente real da Cloudflare (funções), se você tiver o wrangler |

As **notícias** funcionam no `npm run dev`: ele executa a mesma função de `functions/api/noticias.js`. Se você hospedar a pasta `site/` em um servidor estático qualquer (sem funções), tudo funciona, menos a aba Notícias.

## App instalável (PWA)

O site tem `manifest.webmanifest`, ícones (`site/icons/`, gerados por `python scripts/icones.py`) e um service worker (`site/sw.js`). No celular, use "Adicionar à tela inicial"; no computador, o ícone de instalar na barra de endereço. O service worker guarda o site e a geometria e, para os dados ao vivo, tenta a rede primeiro e usa a última cópia se estiver offline. Ele só é registrado fora do `localhost`. Para forçar uma atualização geral do cache, troque `VERSAO` em `sw.js`.

## Relay confiável na nuvem

O agendamento do GitHub Actions costuma atrasar ou pular execuções. Para atualizar a cada 5 minutos de forma confiável, use o worker da Cloudflare em `worker-cron/`, que só pede ao GitHub para rodar o fluxo `relay`:

```bash
cd worker-cron
npx wrangler secret put GH_TOKEN     # token fino do GitHub, só neste repositório, permissão "Actions: Read and write"
npx wrangler deploy
```

## Notícias e outros alertas

O relay também publica `noticias.json` (no mesmo bucket do `estado.json`):

- **Feeds** (`relay/feeds.json`): Agência Brasil, Cemaden, Ministério da Integração, INPE, MetSul, ((o))eco, CNN Brasil, Folha e o g1 de cada um dos 27 estados. Cada fonte tem os campos `licenca` (anote ali os termos de uso) e `ativo` (ponha `false` para desligar uma fonte). Só título, link e nome do veículo são guardados.
- **Filtro de assunto** (`shared/relevancia.mjs`): só passam chuva, alagamento, queimada/foco de calor, calor/frio/seca e outros riscos (terremoto, ciclone, tornado, calamidade...). Esporte, famosos e figuras de linguagem ("chuva de críticas") caem fora. A função `/api/noticias` (Google/Bing) usa o mesmo filtro.
- **Município**: cada notícia é ligada aos municípios citados no título/resumo (nomes repetidos só valem com a sigla do estado ou estado citado; palavras comuns em minúscula não contam).
- **Outras instituições**: [GDACS](https://www.gdacs.org/) (ONU/UE: terremotos, ciclones, enchentes, secas e incêndios de grande porte que atingem o Brasil) e [USGS](https://earthquake.usgs.gov/) (terremotos no Brasil), mostrados no chip "Outros riscos".
- O site mostra primeiro os feeds e completa com a busca do Google/Bing. Para desligar a busca, tire o `fetch("/api/noticias")` do `site/app.js` (função `pintaNoticias`) ou apague a pasta `functions/`.

## Previsão do tempo por município

O cartão animado do município mostra o tempo de verdade (temperatura, condição, vento, umidade e 3 dias), vindo do MET Norway pela função `functions/api/tempo.js` (cache de 30 min na borda). O aviso do INMET entra como etiqueta no mesmo cartão. Na visão do Brasil ou de um estado o cartão mostra o aviso mais grave. Se a previsão falhar, o cartão diz isso e oferece "Tentar de novo"; o resto do site segue normal.

## Motor de notícias por cidade

- **Memória de 7 dias:** os feeds só trazem as últimas dezenas de matérias; o relay guarda o que já coletou (7 dias se cita município, 3 se não) relendo o `noticias.json` público a cada rodada.
- **Lugar:** nome oficial no título manda; apelidos e perífrases ("BH", "capital paulista", "Rio" em feed do RJ, "capital" em feed regional) valem quando não há nome oficial.
- **Peso (`p`, 0 a 10):** termos de impacto (mortes, desabrigados, emergência, tornado...) e de alerta, e fonte oficial.
- **Ordem no site:** recência (meia-vida de 36 h) + peso + número de veículos + cidade no título. Notícias de municípios a até 50 km aparecem em "Na região", com cidade e distância.

## Anúncios (Google AdSense)

Tudo vem desligado. Para ligar, edite `ADS` em `site/config.js` (`cliente`, `slotDesk` 728×90 e `slotMovel` 320×50) e o ID em `site/ads.txt`. Para só ver o espaço, abra o site com `?ads=demo`.

- Uma faixa fixa no rodapé, separada do mapa e dos botões (o CSS reserva o espaço, nada fica por baixo).
- O script do AdSense está no `<head>` do `index.html` (carrega na abertura). Um aviso curto, que não bloqueia nada, deixa a pessoa pedir anúncios "Sem personalização" (a página recarrega e passa a pedir só contextuais).
- Páginas `sobre.html` e `privacidade.html` (revise o texto com quem cuida da parte jurídica antes de divulgar).

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

Para rodar o relay sem o seu computador, use `.github/workflows/relay.yml` (a cada 10 min no GitHub Actions; precisa dos secrets `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`). Repositório público não consome minutos do plano.

## Limites e cuidados

- **Não substitui a Defesa Civil.** É uma camada de visualização sobre dados públicos. Em emergência: 199 (Defesa Civil) e 193 (Bombeiros).
- **Focos de calor são detecções de satélite**, não incêndios confirmados. Um mesmo fogo pode gerar mais de uma detecção.
- Os avisos do INMET valem para o dia (aba "Próximos dias" mostra os futuros). O site avisa quando os dados estão velhos ou quando uma fonte está fora do ar.
- O contorno dos municípios é simplificado para ficar leve; pequenas frestas entre vizinhos são esperadas.
- Os endereços do INMET e do INPE não são APIs documentadas com contrato; se mudarem, o relay falha de forma visível (`INMET`/`INPE fora do ar` no topo da página).

## Contribuindo

PRs e ideias são bem-vindos: veja [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) e o [código de conduta](CODE_OF_CONDUCT.md).

## Fontes e licenças

- Avisos: [INMET](https://alertas2.inmet.gov.br/) · Focos: [INPE Queimadas](https://terrabrasilis.dpi.inpe.br/queimadas/portal/) · Malhas e nomes: [IBGE](https://www.ibge.gov.br/) · Notícias: feeds de veículos e órgãos oficiais e buscas do Google/Bing Notícias (somente títulos e links) · Outros alertas: GDACS e USGS.
- Detalhes de cada fonte e atribuição em [DADOS.md](DADOS.md).
- Código sob licença MIT (`LICENSE`).

# Diagnóstico do alertabr

Data: 07/11/2026. Diagnóstico feito sem alterar código.

**Como foi medido**
- Site local (`node scripts/dev.mjs`), visto em 375×812, 768×1024 e 1440×900, nos temas claro e escuro.
- Medidas de layout por script no navegador interno (cortes de texto, alvos de toque, rolagem horizontal, repetições).
- Tempos do mapa no Chrome Canary. Num iframe de mesma origem, cronometrei os eventos do MapLibre desde o início do carregamento.
- Contraste calculado pela fórmula WCAG. Daltonismo simulado com as matrizes de Machado (2009).

**Limites da medição**
- Não há limitação de rede nem de processador nesta máquina. Os tempos abaixo são de um **PC com a rede local**. O celular em 4G fica bem pior; a estimativa está no P0-1.
- Não houve teste com leitor de tela real. A análise de acessibilidade foi feita pelo DOM.

Gravidade:
- **P0:** quebra uma função ou passa informação errada.
- **P1:** atrapalha o uso.
- **P2:** acabamento.

---

## P0 — quebra função ou informa errado

### P0-1. O mapa leva de 4 a 6 s para aparecer, mesmo num PC sem latência
- **Onde:** `site/mapa-gl.js` (fontes GeoJSON `mun`, `uf`, `rot`, `ufr`), `site/data/municipios.json`, `site/app.js` (`init`).
- **O que acontece** (Canary, rede local, PC):

  | etapa | 375px | 1440px |
  |---|---|---|
  | objeto do mapa criado | 0,51 s | 0,42 s |
  | estilo carregado (`load`) | 1,33 s | 2,05 s |
  | municípios processados pelo geojson-vt | 2,36 s | 3,21 s |
  | **primeiro município desenhado** | **3,29 s** | **4,08 s** |
  | mapa pronto (`idle`) | 4,21 s | 5,00 s |

- **Causas:**
  1. `municipios.json` tem **2,5 MB (667 KB compactado) e 245 mil pontos**. Ele vem em caminhos SVG por município, então cada divisa entre vizinhos vai **duas vezes**. A topologia de arcos compartilhados já existe em `geo/build_geo.py`, mas não é usada no arquivo enviado.
  2. O navegador converte tudo de SVG para GeoJSON em graus no processador principal (≈0,4 s num PC). Depois o MapLibre fatia os 245 mil pontos em tiles no worker (geojson-vt, ≈1,1 s). Num celular isso fica 3 a 5 vezes mais lento.
  3. Antes de qualquer pixel do mapa, o navegador baixa e processa ~900 KB compactados: o MapLibre (211 KB) mais a geometria.
- **Estimativa no celular em 4G:** só o download leva 2 a 5 s no "4G lento" de referência (~1,6 Mbps). Somando o processamento ×3–5, dá **8 a 15 s** de mapa vazio. Isso bate com "continuava vazio depois de 3 s".
- **Por que importa:** o mapa é o produto. Alguém abrindo durante um temporal vê uma tela vazia.
- **Correção proposta**, sem trocar o MapLibre:
  - **a)** Esqueleto imediato. Desenhar o contorno dos estados (`estados.json`, 45 KB compactado) já no primeiro quadro, como SVG simples, com o texto "Carregando municípios…". Some quando o mapa desenhar.
  - **b)** Geometria em dois níveis.
    - Um arquivo **leve** de municípios para a visão do Brasil (simplificação mais forte, meta ≤ 150 KB compactado).
    - O arquivo detalhado só depois, em segundo plano, ou só quando o zoom pedir.
    - Os dois já em longitude/latitude e quantizados, para o navegador não precisar converter.
  - **c)** Usar os arcos compartilhados (TopoJSON) no arquivo enviado. Isso tira as divisas duplicadas e deve cortar o tamanho pela metade.
  - **d)** Alternativa mais forte, se (b) e (c) não chegarem a 2,5 s: **tiles vetoriais estáticos** gerados offline. O MapLibre continua o mesmo; só a fonte muda de `geojson` para `vector`. Isso elimina o fatiamento no navegador, e o celular baixa só os tiles visíveis. Exige uma ferramenta de geração de tiles. **Pergunto antes**, porque muda o formato dos dados e o build.

### P0-2. Os dados de alerta só começam a baixar depois de o mapa ser montado
- **Onde:** `site/app.js` → `init()`. A ordem é `await` geometria → `new Mapa(...)` → `await atualiza()`.
- **O que acontece:**
  - O `estado.json` começa a baixar em **0,6 a 1,4 s**, sempre depois da geometria e da conversão.
  - Os painéis mostram "Buscando os dados mais recentes…" sem necessidade.
  - Se a geometria falhar, os alertas **nunca** carregam, porque o `init` termina com `return`.
- **Por que importa:** a informação mais importante (o que está acontecendo agora) espera a parte mais lenta. Uma falha no mapa derruba também os números.
- **Correção:** buscar `estado.json` em paralelo com a geometria e preencher os painéis assim que chegar. O mapa recebe as cores quando ficar pronto. Uma falha da geometria mostra erro só no mapa, com "Tentar de novo".

### P0-3. A gravidade no mapa depende só de cores que daltônicos não distinguem
- **Onde:** os tokens `--s-1/--s-2/--s-3` em `site/style.css` e o mapa (`site/mapa-gl.js`).
- **O que acontece:**
  - No mapa, a gravidade é **só cor**, sem padrão nem rótulo.
  - Na simulação, o vermelho, o laranja e o amarelo viram tons de oliva e mostarda.

    | simulação | vermelho × laranja | laranja × amarelo |
    |---|---|---|
    | protanopia | 2,33:1 | 1,60:1 |
    | deuteranopia | 1,68:1 | 1,39:1 |

  - Perigo e Perigo potencial ficam praticamente iguais.
- **Por que importa:** cerca de 8% dos homens têm alguma deficiência de cor vermelho-verde. É informação de risco passada errada.
- **Correção:**
  - Tokens com nomes de função (`--sev-grande`, `--sev-perigo`, `--sev-potencial`, `--sev-nenhum`).
  - Luminosidades bem separadas entre os três níveis (escuro, médio, claro), para funcionarem também em escala de cinza.
  - No mapa, o Grande perigo ganha **hachura**, e a legenda e as listas sempre trazem o rótulo do INMET.
  - Reteste com a mesma simulação.

### P0-4. Amarelo e laranja ilegíveis no tema claro
- **Onde:** `--s-1: #f2c200` e `--s-2: #f28c00` no tema claro. São usados em pontos, barras e bordas.
- **O que acontece:**

  | cor | sobre o fundo `#f5f2ec` | sobre o cartão branco | mínimo para ícone/borda |
  |---|---|---|---|
  | amarelo | 1,50:1 | 1,68:1 | 3:1 |
  | laranja | 2,20:1 | 2,46:1 | 3:1 |

  O cinza neutro do mapa contra o fundo dá 1,33:1, então os municípios sem aviso quase não se separam do "mar".
- **Por que importa:** o "Perigo potencial" some na tela clara, justamente a que mais se usa ao ar livre.
- **Correção:**
  - Variantes escuras para o tema claro (amarelo-mostarda e laranja queimado), com ≥ 3:1 para elementos gráficos.
  - Contorno escuro nos pontos de cor.
  - Mar e terra neutra com mais diferença entre si.

### P0-5. "Ver o Brasil todo" usa ícone de localização, e não existe botão de localização
- **Onde:** `#zBr` em `site/index.html` (ícone `#i-pino`).
- **O que acontece:**
  - O botão com cara de "minha localização" só volta para o Brasil.
  - Não há geolocalização no site.
  - O pedido exige tratar permissão negada, tempo esgotado e localização fora do Brasil, e isso não existe.
- **Por que importa:** a pessoa toca esperando ver a própria cidade e nada acontece. É uma função que parece quebrada.
- **Correção:**
  - Criar o botão **"Minha localização"** com `navigator.geolocation`. Ele acha o município pelo ponto, testando o ponto dentro do polígono com os limites já carregados.
  - Mensagens próprias para permissão negada, tempo esgotado, fora do Brasil e navegador sem suporte.
  - Trocar o ícone do "Ver o Brasil todo" por um ícone de enquadrar.

---

## P1 — atrapalha o uso

### P1-1. No desktop o mapa fica com 33% da tela, cercado por 5 painéis
- **Onde:** layout `.corpo` em `site/style.css` (bloco desktop) e `insets()` em `app.js`.
- **O que acontece:**
  - Em 1440×900, os painéis em volta do mapa são o card do clima, a lista de avisos, o "Brasil agora", as notícias e o cartão para compartilhar.
  - A área livre do mapa medida é **33% da tela**, com 346 px ocupados à esquerda, 366 px à direita e 275 px no topo.
- **Por que importa:** o protagonista vira miniatura e o olho não sabe por onde começar.
- **Correção:**
  - **Uma** coluna lateral à esquerda (~380 px) com abas ou seções empilhadas: resumo, avisos, notícias e compartilhar.
  - O mapa ocupa todo o resto.
  - A barra de busca e as camadas viram uma pílula fina sobre o mapa. A legenda vai para o canto do mapa.
  - Meta: mapa com ≥ 70% da tela.

### P1-2. No celular os cartões e a folha não seguem o padrão de bottom sheet
- **Onde:** `.painel` em modo compacto e `painelAltura()`.
- **O que acontece:**
  - Os dois cartões fixos ocupam ~25% da altura embaixo.
  - O "Ver tudo" abre uma folha cheia.
  - Não dá para arrastar e não há altura intermediária.
- **Correção:** uma folha única com 3 alturas: espiada com o resumo de 1 linha, metade e cheia. Ela abre pelo puxador, por toque e por arraste, com o mapa sempre atrás.

### P1-3. Os mesmos números aparecem em 3 a 5 lugares
- **O que acontece:**
  - Em 1440px o número 325 aparece **5 vezes**: na faixa de contagem, no bloco "Grande" do card do clima, na pílula "Tempestade 325", no subtítulo "325 municípios" e na lista de avisos.
  - O "Brasil agora" repete o card do clima.
- **Correção:**
  - A contagem por gravidade fica num lugar só, o resumo.
  - O card do clima deixa de repetir os números.
  - A lista de avisos mostra o **tipo do aviso**, a gravidade e quantos municípios cada aviso cobre. Isso é diferente da contagem por gravidade.

### P1-4. Textos cortados com "…" sem forma de ver
- **Onde e o que acontece:**
  - **375px:** nas linhas da lista, "Grande perigo · Santa Catarina,Rio Gr…", "Perigo potencial · Goiás,Minas Gerais,P…" e "Declínio de Temperatura" ficam cortados. Na faixa de contagens, "Potencial 2.7…" sai pela direita da tela (a faixa rola de lado sem indicação). A faixa de pílulas do card do clima também é cortada sem indicação.
  - **1440px:** a lista já quebra linha, corrigido no commit `9ff83e9`. Ainda cortam "Declínio de Temperatura" no card do clima e notícias com mais de 3 linhas.
- **Correção:**
  - Estados abreviados de forma pensada: "SC, RS, PR" ou "GO, MG e mais 11", com o texto inteiro ao tocar ou no detalhe.
  - A faixa de contagens cabe em 375px, em 3 colunas iguais com número em cima e rótulo embaixo, ou em 2 linhas.

### P1-5. Rótulos do card do clima cortados ("FOCOS D…")
- **Onde:** `.blocos .bl span` no `.ceu`, em larguras intermediárias do desktop.
- **Correção:** rótulos curtos e oficiais, como "Focos (24 h)", com quebra permitida. Ou tirar os blocos, que são repetidos (P1-3).

### P1-6. Falhas não têm "Tentar de novo", e o painel principal fica preso em "Buscando…"
- **Onde:** `pintaAgora()` (sem dados → "Buscando os dados mais recentes…" para sempre), `pintaNoticias()` (erro mostra o link do Google, mas não tenta de novo) e `init()`.
- **O que acontece:** se as três fontes do `estado.json` falharem, o painel continua dizendo "Buscando…" e só o ponto de status fica vermelho. Não há estado de erro com botão.
- **Correção:** cada bloco tem 4 estados (carregando, vazio, erro com mensagem e "Tentar de novo", com dados) e falha sozinho:
  - **Alertas e focos:** mapa e resumo.
  - **Notícias.**
  - **Outros riscos:** GDACS e USGS.

  Hoje INMET e INPE já são isolados no relay. O que falta é na interface.

### P1-7. A URL não guarda aba nem camada, e o "voltar" sai do site
- **Onde:** `seleciona()` e `selecionaUf()` usam `history.replaceState`. A camada só é lida de `?camada=` na abertura. A aba e o tema das notícias não ficam na URL.
- **O que acontece:**
  - Escolher Campinas e depois Curitiba e apertar "voltar" sai do site.
  - Um link compartilhado com "Focos de calor" ligado abre em "Alertas".
- **Correção:**
  - Estado na URL, por exemplo `#m=3509502&camada=focos&aba=noticias`.
  - `pushState` em cada mudança de município, estado ou camada, e `popstate` para restaurar.
  - Abrir exatamente o que está na URL.

### P1-8. A busca não tolera erro de digitação e não diz quando não acha
- **O que acontece** (testado no Canary):
  - "sao paulo", "Sao Joao del Rei" e "florianopolis" funcionam, porque o acento já é ignorado.
  - **"sao paolo"**, **"florianopolsi"** e "xyzw" não retornam nada e **sem nenhuma mensagem**.
  - Setas e Enter já funcionam.
- **Correção:**
  - Tolerância a erro leve: distância de edição até 1 ou 2, conforme o tamanho, aplicada aos nomes normalizados.
  - Mensagem "Nenhum município encontrado".
  - `aria-activedescendant` para leitores de tela.

### P1-9. O estado de carregamento do mapa é só um texto pequeno no meio
- **Onde:** `#carrega`, texto "Carregando o mapa…" em `--on3` no centro.
- **O que acontece:** no celular ele fica entre a faixa e os cartões e passa despercebido. Não há forma nem animação.
- **Correção:** o esqueleto do P0-1a.

### P1-10. Alvos de toque menores que 44 px no celular
- **Medido em 375px:**

  | elemento | tamanho |
  |---|---|
  | Alertas | 72×36 |
  | Focos | 64×36 |
  | busca | 40×40 |
  | tema | 40×40 |
  | faixa de contagens | 40 de altura |
  | zoom +, −, Brasil | 40×40 |
  | "Ver tudo" | 101×34 |
  | linhas da lista | 40 de altura |

- **Correção:** mínimo de 44×44, com área de toque ampliada por padding quando o visual precisar ser menor.

### P1-11. `aria-live` no resumo inteiro
- **Onde:** `<section class="resumo" aria-live="polite">`.
- **O que acontece:** a cada atualização (60 s), o leitor de tela relê o título, o subtítulo e os 4 contadores.
- **Correção:** `aria-live` só numa frase curta de mudança, como "Atualizado há 1 min. 3 avisos novos". Os contadores ficam sem live.

### P1-12. O mapa não tem foco visível pelo teclado
- **Onde:** `.mapa .maplibregl-canvas { outline: none; }`.
- **Correção:** foco visível no mapa. Atalhos (+/−, setas) já vêm do MapLibre e devem ser listados numa dica.

---

## P2 — acabamento

- **P2-1. Escala tipográfica solta:** o CSS tem 22 tamanhos de fonte diferentes (`font-size`) e mais 8 em `font:` abreviado. A meta são 4 tamanhos (12/14/16/24) mais o número de destaque, todos `tabular-nums`.
- **P2-2. Raios e sombras variados:** há 16 valores diferentes de `border-radius`. A meta é um raio para painéis, um para controles e um para pílulas, e uma sombra só.
- **P2-3. Cores em hexadecimal fora dos tokens:**

  | arquivo | hex soltos |
  |---|---|
  | `app.js` | 5 (escala de focos `COR_FOGO`) |
  | `cartao.js` | 13 |
  | `mapa.js` | 2 |
  | `mapa-gl.js` | 1 |

  Tudo passa a vir dos tokens. O cartão lê os mesmos tokens com valores fixos para a imagem.
- **P2-4. Fonte do cartão diferente da página:** `cartao.js` pede "Geist", que não é carregada, e cai na fonte do sistema. A prévia e o PNG saem iguais, porque são o mesmo canvas. Mesmo assim, padronizar a família e esperar `document.fonts.ready` antes de desenhar.
- **P2-5. Compartilhar:** já usa a Web Share API com arquivo e baixa o PNG quando não existe. Falta avisar "Imagem baixada" quando cai na alternativa, e testar em iOS e Android.
- **P2-6. Texto do status estranho:** "Dados de há 19 h" deveria ser "Atualizado há 19 h · pode estar desatualizado". O limite de "velho" está em 25 min e passa a 30 min, como pedido.
- **P2-7. Efeitos decorativos:** a chuva animada, o vidro e os gradientes do card do clima. Já respeitam `prefers-reduced-motion`, mas o card disputa atenção com o mapa. Proposta: o card perde o fundo animado no desktop (coluna única) e fica só como cabeçalho discreto no celular.
- **P2-8. Mensagens e títulos:** padronizar em frases curtas e usar os rótulos do INMET ("Grande perigo", "Perigo", "Perigo potencial"). Hoje aparecem "Grande" e "Potencial" soltos.
- **P2-9. Anúncio e consentimento:** ficam fora deste trabalho, mas a nova coluna lateral e a folha precisam continuar respeitando a faixa do anúncio.

---

## Ordem proposta de correção (um commit por tema)

1. **P0-2:** dados em paralelo e falhas isoladas, junto com o P1-6 (4 estados por bloco).
2. **P0-1:** esqueleto imediato; geometria leve em dois níveis com arcos compartilhados; medição no Canary (meta: primeiro desenho < 2,5 s).
3. **P0-3 e P0-4:** tokens `--sev-*`, contraste nos dois temas, hachura no Grande perigo, reteste de daltonismo.
4. **P0-5:** botão "Minha localização" com os 4 tratamentos.
5. **P1-1, P1-2 e P1-3:** layout com coluna única no desktop, bottom sheet de 3 alturas no celular e números num lugar só.
6. **P1-4 e P1-5:** textos sem corte.
7. **P1-7:** URL com estado completo e "voltar".
8. **P1-8:** busca tolerante e "Nenhum município encontrado".
9. **P1-10, P1-11 e P1-12:** toque, `aria-live` e foco.
10. **P2:** tipografia, espaçamento, raios, tokens no cartão e textos.

Depois de cada etapa: 375, 768 e 1440 nos dois temas, console sem erros e prints de 375 e 1440 na entrega.

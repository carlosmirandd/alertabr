# Fontes de dados e atribuição

| Dado | Fonte | Uso |
|---|---|---|
| Avisos meteorológicos | [INMET](https://alertas2.inmet.gov.br/) — avisos ativos | Dado público do governo federal; sem contrato formal de API. |
| Focos de calor | [INPE · Programa Queimadas](https://terrabrasilis.dpi.inpe.br/queimadas/portal/) — CSV diário | Dados abertos; citar a fonte. Detecções de satélite, não incêndios confirmados. |
| Malhas e nomes de municípios | [IBGE](https://www.ibge.gov.br/) — API de malhas e de localidades | Dados abertos; citar a fonte. Geometria simplificada para a web. |
| Previsão do tempo por município | [MET Norway · Locationforecast 2.0](https://api.met.no/weatherapi/locationforecast/2.0/documentation) via `functions/api/tempo.js` | Dados CC BY 4.0 (citar "MET Norway"). Os termos pedem User-Agent identificado, coordenadas com até 4 casas e respeito ao cache: por isso só a função chama a API, com cache de 30 min. **Confirme nos termos (api.met.no/doc/TermsOfService) o uso em site com anúncios.** |
| Notícias | Feeds RSS/Atom listados em `relay/feeds.json` (Agência Brasil, Cemaden, MDR, INPE, MetSul, ((o))eco, CNN Brasil, Folha, g1 por estado) | Só títulos, links e nome do veículo. **Cada fonte tem termos próprios: confira e anote em `licenca` antes de divulgar/monetizar.** Os direitos pertencem aos veículos. |
| Notícias (complemento) | Google Notícias e Bing Notícias (RSS de busca) | Termos de uso limitam a fins não comerciais; desative antes de monetizar. |
| Terremotos, ciclones, enchentes, incêndios | [GDACS](https://www.gdacs.org/) (ONU/UE) e [USGS](https://earthquake.usgs.gov/) | Dados abertos; citar a fonte. Confira os termos de cada um. |

Este projeto não é afiliado nem endossado por INMET, INPE, IBGE, MET Norway, GDACS, USGS, Google ou pelos veículos citados. Em emergência: 199 (Defesa Civil) e 193 (Bombeiros).

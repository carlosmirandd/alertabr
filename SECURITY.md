# Segurança

## Como reportar uma vulnerabilidade

Não abra uma issue pública. Use **Security → Report a vulnerability** neste repositório (aviso privado do GitHub). Respondemos assim que possível e creditamos quem reportar, se quiser.

## O que está no escopo

- Injeção de HTML/JS por texto vindo de fontes externas (avisos, notícias).
- Falhas em `functions/api/*` (por exemplo, consultar hosts que não deveriam).
- Qualquer vazamento de credenciais em código, workflow ou histórico.

## Notas

- O projeto **não usa chaves de API**. O único segredo possível é o token da Cloudflare usado no GitHub Actions opcional; ele deve ficar apenas em *Secrets* do repositório, com permissão mínima (R2).
- As fontes (INMET, INPE, IBGE, Google Notícias) são externas e não controladas por este projeto.

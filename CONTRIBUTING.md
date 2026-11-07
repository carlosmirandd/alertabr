# Como contribuir

Obrigado por ajudar! O alertabr é pequeno de propósito: HTML + JS puro, sem build e sem dependências. Contribuições que mantêm isso são as mais fáceis de aceitar.

## Começando

```bash
git clone https://github.com/carlosmirandd/alertabr && cd alertabr
npm run semente   # baixa INMET + INPE e grava site/data/estado.json
npm run dev       # http://localhost:8788
npm test
```

Precisa só de Node 20+. Python 3 é necessário apenas para refazer a malha (`npm run geo`).

## O que ajuda

- Corrigir erros nos dados ou nas fontes (se o INMET ou o INPE mudar o formato, o relay deve falhar de forma clara).
- Desempenho do mapa em celulares fracos.
- Acessibilidade (teclado, leitor de tela, contraste).
- Novas fontes oficiais por município (ex.: CEMADEN, Defesa Civil), sempre com link para a fonte e sem exigir chave.
- Traduções e melhorias nos cartões.

## Regras do projeto

- **Só dados oficiais e verificáveis.** Nada de estimativa própria apresentada como fato. Cite a fonte na interface.
- **Sem dependências novas** sem uma boa razão. Se precisar, explique no PR.
- **Texto vindo de fora é sempre escapado** antes de ir para o HTML (veja `esc()` em `site/app.js`).
- Rode `npm test` antes de abrir o PR e descreva como testou a mudança (de preferência com uma captura de tela se mexer na interface).

## Pull requests

1. Abra uma issue antes de mudanças grandes, para alinharmos a ideia.
2. Um PR por assunto, com mensagem de commit clara.
3. Ao contribuir, você concorda que seu código é licenciado sob a MIT (`LICENSE`).

Dúvidas de segurança: veja `SECURITY.md`. Convivência: veja `CODE_OF_CONDUCT.md`.

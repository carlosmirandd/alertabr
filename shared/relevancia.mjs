// Filtro de assunto das notícias: só passa o que tem a ver com alertas, chuva, queimadas, calor/frio extremo, seca e outros riscos naturais.
// Usado pelo relay (feeds próprios) e pela função /api/noticias (Google/Bing), para as duas listas seguirem a mesma regra.
export const sem = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Cada tema é um regex sobre o texto sem acento e em minúsculas.
const TEMAS = {
  chuva: /\b(chuv|temporal|temporais|tempestade|alagament|enchente|inundac|deslizament|enxurrada|granizo|vendaval|ventania|trovoada|cheia dos|cheia do|transbord|nivel do rio|risco geologico|desmoronament|bolsao de chuva|ressaca|ciclone|microexplosao|tornado)/,
  fogo: /\b(queimad|foco de calor|focos de calor|fumaca|incendio(s)? (florestal|florestais|em vegetacao|em mata|em area de mata|em area verde|no mato|em canavial|em pastagem|em parque)|incendio(s)? (de|na|no) (vegetacao|mata|floresta|cerrado|pantanal|amazonia)|fogo (na|no|em) (mata|vegetacao|floresta|cerrado|pantanal|area)|prevfogo|brigadista|combate (ao|aos) (fogo|incendio))/,
  calor: /\b(onda de calor|calor extremo|calor intenso|calorao|(?<!lei )seca\b|estiagem|baixa umidade|umidade relativa|umidade do ar|crise hidrica|geada|onda de frio|frio intenso|massa de ar polar|massa de ar seco|temperatura(s)? (recorde|minima|maxima)|friagem|tempo seco|risco de incendio)/,
  outros: /\b(terremoto|tremor de terra|abalo sismico|sismo|sismologi|tsunami|furacao|ciclone tropical|erupcao|vulcao|rompimento de barragem|barragem (em risco|rompe)|estado de emergencia|situacao de emergencia|calamidade|desastre natural|desastres naturais|eventos extremos|evento extremo|tromba d.agua)/,
};
// Termos que, sozinhos, já bastam para a notícia ser considerada (mesmo sem tema fechado).
const GERAL = /\b(defesa civil|inmet|cemaden|inpe|alerta de (chuva|tempestade|ventania|vendaval|granizo|calor|frio|baixa umidade|onda|ressaca|risco|inundacao|deslizamento|incendio|seca|geada|perigo)|aviso de (chuva|tempestade|ventania|vendaval|granizo|calor|frio|baixa umidade|ressaca|perigo)|aviso meteorologico|alerta meteorologico|alerta laranja|alerta vermelho|alerta amarelo|alerta de perigo|grande perigo)/;
// O que tira a notícia da lista quando o assunto é outro (esporte, famosos, figuras de linguagem...), a não ser que ela tenha um termo FORTE.
const RUIM = /\b(futebol|brasileirao|libertadores|campeonato|rodada|torcida|rebaixa|gol de|gols de|bbb|big brother|novela|horoscopo|famoso|celebridade|show|festival|carnaval|filme|serie|cantor|cantora|ator |atriz|bolsa de valores|ibovespa|dolar|mega-sena|loteria|aposta|eleicao|eleicoes|candidato|chuva de (premios|criticas|gols|ofertas|prata|estrelas|meteoros|confete|elogios|dinheiro|votos)|gp|interlagos|black friday|promocao|promocoes|oferta|ofertas|desconto|caravana|liquidacao|formula 1|f1|pole|grid|toni tornado|bailes|pegar fogo|pega fogo|fogo cruzado|fogo amigo|esquenta)\b/;
// Fora do escopo SEMPRE (vale mesmo com termo forte): guerra e conflitos no exterior. "Defesa Civil de Gaza" não é a nossa.
const FORA = /\b(gaza|israel|israelense|palestin|hamas|hezbollah|cisjordania|libano|siria|ucrania|ucraniano|russia|russo|kiev|moscou|iemen|iraque|bombardeio|bombardeia|missil|misseis|drone|ataque aereo|ataque israelense|ataque russo|guerra)\b/;
const FORTE = /\b(defesa civil|alagament|enchente|deslizament|queimad|foco de calor|focos de calor|inmet|cemaden|estado de emergencia|situacao de emergencia|calamidade|onda de calor|estiagem|inundac|alerta de|aviso de|desabament)/;

// Retorna os temas encontrados ("chuva","fogo","calor","outros"); "geral" quando só há termos amplos (conta apenas em "Tudo").
export function temasDe(titulo, resumo = "") {
  const t = sem(titulo), out = [];
  // só o título decide o assunto (o resumo trazia falsos positivos, ex.: "queimaduras", "bailes ... Toni Tornado")
  for (const [k, re] of Object.entries(TEMAS)) if (re.test(t)) out.push(k);
  if (!out.length && GERAL.test(t)) out.push("geral");
  return out;
}
// Passa quando há tema e o título não é de outro assunto.
export function relevante(titulo, resumo = "") {
  const t = sem(titulo), tm = temasDe(titulo, resumo);
  if (!tm.length) return false;
  if (FORA.test(t)) return false;
  if (RUIM.test(t) && !FORTE.test(t)) return false;
  return true;
}

// Configuração do site. Troque FEED pelo endereço público onde o relay publica o estado.json.
window.ALERTABR = {
  FEED: "https://pub-33706c14dd8f4dbfb388f6403dcd5912.r2.dev/estado.json", // endereço público do estado.json no R2 (ex.: https://pub-xxxx.r2.dev/estado.json). Vazio = usa só /api/estado e a cópia local
  RESERVA: "/api/estado",                                              // função do site (se o R2 falhar por CORS/rede)
  LOCAL: "data/estado.json",                                           // cópia incluída no deploy (último recurso)
  INTERVALO: 60000,                                                    // ms entre leituras (pausa com a aba escondida)
  VELHO: 25 * 60 * 1000,                                               // dados mais velhos que isso ganham aviso
};

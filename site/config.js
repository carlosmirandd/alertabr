// Configuração do site. Troque FEED pelo endereço público onde o relay publica o estado.json.
window.ALERTABR = {
  FEED: "https://pub-33706c14dd8f4dbfb388f6403dcd5912.r2.dev/estado.json", // endereço público do estado.json no R2 (ex.: https://pub-xxxx.r2.dev/estado.json). Vazio = usa só /api/estado e a cópia local
  NOTICIAS: "https://pub-33706c14dd8f4dbfb388f6403dcd5912.r2.dev/noticias.json", // notícias e eventos coletados pelo relay (feeds de veículos e órgãos oficiais)
  LOCAL_NOTICIAS: "data/noticias.json",                                 // cópia incluída no deploy (último recurso e uso local)
  RESERVA: "/api/estado",                                              // função do site (se o R2 falhar por CORS/rede)
  LOCAL: "data/estado.json",                                           // cópia incluída no deploy (último recurso)
  INTERVALO: 60000,                                                    // ms entre leituras (pausa com a aba escondida)
  VELHO: 30 * 60 * 1000,                                               // dados mais velhos que isso ganham aviso
  // Anúncios (Google AdSense). Enquanto "cliente" estiver vazio NADA de anúncio é carregado e a faixa não aparece.
  //   cliente: "ca-pub-0000000000000000"   (seu ID de editor)      slotDesk: unidade 728x90      slotMovel: unidade 320x50
  // Para ver o espaço sem conta no AdSense, abra o site com ?ads=demo
  ADS: { cliente: "ca-pub-9830692597088821", slotDesk: "", slotMovel: "" }, // os anúncios só aparecem quando os dois slots (unidades 728x90 e 320x50) forem preenchidos
};

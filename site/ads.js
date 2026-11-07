/* Anúncios (Google AdSense) do alertabr.
   - Só roda se config.js tiver ADS.cliente + o slot do tamanho certo, ou com ?ads=demo (mostra o espaço sem carregar nada do Google).
   - Antes da escolha do visitante nada do Google é carregado. "Aceitar" = anúncios personalizados; "Sem personalização" = anúncios contextuais.
   - A faixa é FIXA no rodapé (728x90 no computador, 320x50 no celular), separada do mapa e dos botões: não cobre nada e evita clique por engano.
   - O espaço é reservado pelo CSS (--safe-b inclui --ad-h), então os cartões e a folha do celular ficam sempre acima da faixa. */
(function () {
  "use strict";
  var C = window.ALERTABR || {}, A = C.ADS || {}, demo = /[?&]ads=demo\b/.test(location.search);
  var movel = window.matchMedia("(max-width:727px)").matches, slot = movel ? A.slotMovel : A.slotDesk;
  if (!demo && !(A.cliente && slot)) return;
  var CH = "alertabr-consent", de = document.documentElement, h = movel ? 50 : 90;
  var guarda = function (v) { try { v === null ? localStorage.removeItem(CH) : localStorage.setItem(CH, v); } catch (e) { /* sem armazenamento: pergunta de novo na próxima visita */ } };
  var lê = function () { try { return localStorage.getItem(CH); } catch (e) { return null; } };

  var barra = document.createElement("aside");
  barra.className = "anuncio"; barra.setAttribute("aria-label", "Publicidade");
  de.style.setProperty("--ad-h", h + "px"); de.classList.add("com-ads");
  document.addEventListener("DOMContentLoaded", function () { document.body.appendChild(barra); });
  if (document.body) document.body.appendChild(barra);

  function carrega(personalizado) {
    if (demo && !A.cliente) { barra.innerHTML = '<div class="ad-demo"><small>Publicidade</small><b>Espaço do anúncio ' + (movel ? "320×50" : "728×90") + ' (modo demonstração)</b></div>'; return; }
    window.adsbygoogle = window.adsbygoogle || [];
    if (!personalizado) window.adsbygoogle.requestNonPersonalizedAds = 1;
    var s = document.createElement("script"); s.async = true; s.crossOrigin = "anonymous";
    s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(A.cliente);
    document.head.appendChild(s);
    barra.innerHTML = '<ins class="adsbygoogle" style="display:inline-block;width:' + (movel ? 320 : 728) + "px;height:" + h + 'px" data-ad-client="' + A.cliente + '" data-ad-slot="' + slot + '"></ins><small class="ad-rot">Publicidade</small>';
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* anúncio bloqueado: a faixa fica vazia */ }
  }

  function pergunta() {
    var b = document.createElement("div"); b.className = "consent"; b.setAttribute("role", "dialog"); b.setAttribute("aria-label", "Privacidade e anúncios");
    b.innerHTML = '<p>O alertabr é gratuito e se mantém com anúncios do Google. Eles usam cookies para mostrar anúncios e medir resultados. Veja a <a href="privacidade.html">política de privacidade</a>.</p>' +
      '<div><button type="button" class="btn" data-c="p">Aceitar</button><button type="button" class="btn sec" data-c="n">Sem personalização</button></div>';
    b.addEventListener("click", function (e) { var t = e.target.closest("[data-c]"); if (!t) return; var p = t.dataset.c === "p"; guarda(p ? "p" : "n"); b.remove(); carrega(p); });
    document.addEventListener("DOMContentLoaded", function () { document.body.appendChild(b); });
    if (document.body) document.body.appendChild(b);
  }
  var v = lê(); if (v === "p" || v === "n") carrega(v === "p"); else pergunta();
})();

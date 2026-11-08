/* Anúncios (Google AdSense) do alertabr.
   - Só roda se config.js tiver ADS.cliente + o slot do tamanho certo, ou com ?ads=demo (mostra o espaço sem carregar nada do Google).
   - O script do Google carrega na abertura da página (<head>). Padrão = anúncios personalizados; quem escolher "Sem personalização" recebe anúncios contextuais.
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

  // O script do AdSense já vem no <head> do index.html (carrega na abertura da página). Aqui só desenhamos a faixa e escolhemos o tipo de anúncio.
  function carrega(personalizado) {
    if (demo && (!A.cliente || !slot)) { barra.innerHTML = '<div class="ad-demo"><small>Publicidade</small><b>Espaço do anúncio ' + (movel ? "320×50" : "728×90") + ' (modo demonstração)</b></div>'; return; }
    window.adsbygoogle = window.adsbygoogle || [];
    if (!personalizado) window.adsbygoogle.requestNonPersonalizedAds = 1;
    barra.innerHTML = '<ins class="adsbygoogle" style="display:inline-block;width:' + (movel ? 320 : 728) + "px;height:" + h + 'px" data-ad-client="' + A.cliente + '" data-ad-slot="' + slot + '"></ins><small class="ad-rot">Publicidade</small>';
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* anúncio bloqueado: a faixa fica vazia */ }
  }

  // Aviso curto (não bloqueia nada): o anúncio já carregou. Quem quiser pode pedir anúncios sem personalização (vale a partir do recarregamento).
  function aviso() {
    var b = document.createElement("div"); b.className = "consent"; b.setAttribute("role", "region"); b.setAttribute("aria-label", "Anúncios e privacidade");
    b.innerHTML = '<p>O alertabr é gratuito e se mantém com anúncios do Google, que usam cookies. Veja a <a href="privacidade.html">política de privacidade</a>.</p>' +
      '<div><button type="button" class="btn" data-c="p">Entendi</button><button type="button" class="btn sec" data-c="n">Sem personalização</button></div>';
    b.addEventListener("click", function (e) { var t = e.target.closest("[data-c]"); if (!t) return; guarda(t.dataset.c); b.remove(); if (t.dataset.c === "n") location.reload(); });
    document.addEventListener("DOMContentLoaded", function () { document.body.appendChild(b); });
    if (document.body) document.body.appendChild(b);
  }
  var v = lê(); carrega(v !== "n"); if (v !== "p" && v !== "n") aviso();
})();

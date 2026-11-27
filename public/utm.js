/*
 * Repassa as UTMs da página de vendas para os links do checkout Wiapy.
 * Uso: <script src="https://SEU-PAINEL.vercel.app/utm.js" defer></script>
 * Opcional: data-dominios="wiapy,pay.meusite.com" para dizer quais links são de checkout
 * (padrão: qualquer link que contenha "wiapy").
 */
(function () {
  var KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"];
  var STORE = "painel_utms";
  var DAYS = 30;
  var me = document.currentScript;
  var domains = ((me && me.getAttribute("data-dominios")) || "wiapy")
    .split(",").map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);

  function read() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORE) || "null");
      if (saved && saved.exp > Date.now()) return saved.v;
    } catch { /* ignora */ }
    return {};
  }

  // UTMs da URL atual têm prioridade (último clique no anúncio).
  var url = new URLSearchParams(location.search);
  var fromUrl = {};
  var has = false;
  KEYS.forEach(function (k) {
    var v = url.get(k);
    if (v) { fromUrl[k] = v; has = true; }
  });
  var utms = has ? fromUrl : read();
  if (has) {
    try { localStorage.setItem(STORE, JSON.stringify({ v: fromUrl, exp: Date.now() + DAYS * 864e5 })); } catch { /* ignora */ }
  }

  function isCheckout(href) {
    var h = (href || "").toLowerCase();
    return domains.some(function (d) { return h.indexOf(d) !== -1; });
  }

  function decorate(a) {
    if (!a || !a.href || !isCheckout(a.href)) return;
    try {
      var u = new URL(a.href);
      Object.keys(utms).forEach(function (k) {
        if (!u.searchParams.get(k)) u.searchParams.set(k, utms[k]);
      });
      a.href = u.toString();
    } catch { /* ignora */ }
  }

  function run() {
    if (!Object.keys(utms).length) return;
    var links = document.querySelectorAll("a[href]");
    for (var i = 0; i < links.length; i++) decorate(links[i]);
  }

  // Garante também em links criados depois (botões de construtores de página).
  document.addEventListener("click", function (e) {
    var el = e.target;
    while (el && el.tagName !== "A") el = el.parentElement;
    if (el) decorate(el);
  }, true);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
  window.addEventListener("load", run);
})();

// ═══════════════════════════════════════════════════════════════
// b.492 — APERTURA SU UNA TAB PRECISA, appoggiata al BizCard originale.
// Stesso patto di bartalk-doc.js: questo file e un'AGGIUNTA, il codice
// del BizCard resta intatto. Con ?tab=contacts (o export, settings)
// nell'indirizzo, al caricamento si preme la tab chiesta — lo stesso
// click che farebbe il dito. Senza il parametro non succede niente.
// ═══════════════════════════════════════════════════════════════
(function () {
  var qs = new URLSearchParams(location.search);
  var tab = qs.get('tab');
  if (!tab || tab === 'scanner') return; // com'era: si apre sulla scansione
  var premi = function (tentativi) {
    var bottone = document.querySelector('[data-tab="' + tab + '"]');
    if (bottone) { bottone.click(); return; }
    if (tentativi > 0) setTimeout(function () { premi(tentativi - 1); }, 200);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { premi(10); });
  } else {
    premi(10);
  }
})();

// ═══════════════════════════════════════════════════════════════
// b.346 — MODO DOCUMENTI di BarTalk, APPOGGIATO al BizCard originale.
// Questo file e l'UNICA aggiunta: il codice del BizCard resta intatto.
// Si attiva solo con ?doc=1 nell'indirizzo. Cattura il testo che i
// motori originali producono (avvolgendo classifyBlocks, che tutti i
// percorsi — Camera, Remoto, File, Smart Scan — chiamano alla fine) e
// mostra una barra "Invia a BarTalk": il testo torna all'app aperta
// (BroadcastChannel + localStorage come ripiego), con la destinazione
// chiesta nell'indirizzo (?dest=materiali|impara|amico|tavolo).
// ═══════════════════════════════════════════════════════════════
(function () {
  var qs = new URLSearchParams(location.search);
  if (qs.get('doc') !== '1') return; // biglietti da visita: tutto come prima

  var dest = qs.get('dest') || 'materiali';
  var ultimoTesto = '';

  // Avvolge la classificazione finale: ogni scansione completata passa da qui.
  var attacca = function () {
    if (typeof window.classifyBlocks !== 'function') { setTimeout(attacca, 300); return; }
    var originale = window.classifyBlocks;
    window.classifyBlocks = function (testo) {
      ultimoTesto = ultimoTesto ? (ultimoTesto + '\n\n' + String(testo || '')) : String(testo || '');
      aggiornaBarra();
      return originale.apply(this, arguments);
    };
  };
  attacca();

  // La barra fissa in basso, nei colori di BarTalk.
  var barra = document.createElement('div');
  barra.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9999;display:none;align-items:center;gap:10px;' +
    'padding:12px 16px;padding-bottom:calc(12px + env(safe-area-inset-bottom,0px));background:#0b0b18;border-top:1px solid #26264a;' +
    'font-family:-apple-system,BlinkMacSystemFont,sans-serif;';
  barra.innerHTML =
    '<span id="btDocInfo" style="flex:1;color:#a8a8c0;font-size:13px">Documento: nessun testo ancora</span>' +
    '<button id="btDocAzzera" style="padding:10px 14px;border-radius:10px;border:1px solid #334;background:transparent;color:#a8a8c0;font-weight:700;cursor:pointer">Azzera</button>' +
    '<button id="btDocInvia" style="padding:10px 18px;border-radius:10px;border:none;background:linear-gradient(135deg,#8b5cf6,#06b6d4);color:#fff;font-weight:800;cursor:pointer" disabled>Invia a BarTalk</button>';
  document.body.appendChild(barra);
  document.body.style.paddingBottom = '70px';

  function aggiornaBarra() {
    barra.style.display = 'flex';
    var n = ultimoTesto.length;
    document.getElementById('btDocInfo').textContent = n
      ? 'Documento: ' + n + ' caratteri acquisiti (' + ultimoTesto.split('\n').filter(function (r) { return r.trim(); }).length + ' righe)'
      : 'Documento: nessun testo ancora';
    document.getElementById('btDocInvia').disabled = !n;
  }
  aggiornaBarra();

  document.getElementById('btDocAzzera').addEventListener('click', function () {
    ultimoTesto = '';
    aggiornaBarra();
  });

  document.getElementById('btDocInvia').addEventListener('click', function () {
    if (!ultimoTesto) return;
    var pacco = { testo: ultimoTesto, dest: dest, quando: Date.now() };
    try { new BroadcastChannel('vt-scan').postMessage(pacco); } catch (e) { /* canale non supportato: resta il ripiego sotto */ }
    try { localStorage.setItem('vt-scan-risultato', JSON.stringify(pacco)); } catch (e) { /* memoria piena o negata: il canale sopra basta */ }
    var b = document.getElementById('btDocInvia');
    b.textContent = 'Inviato — torna a BarTalk';
    b.disabled = true;
    setTimeout(function () { b.textContent = 'Invia a BarTalk'; aggiornaBarra(); }, 2500);
  });
})();

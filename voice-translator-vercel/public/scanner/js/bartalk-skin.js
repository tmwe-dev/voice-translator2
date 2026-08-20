// b.346 — carica la pelle grafica di BarTalk SOLO se richiesta con
// ?skin=bartalk: il BizCard originale resta identico a se stesso.
(function () {
  if (new URLSearchParams(location.search).get('skin') !== 'bartalk') return;
  var l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = '/scanner/bartalk-skin.css';
  document.head.appendChild(l);
})();

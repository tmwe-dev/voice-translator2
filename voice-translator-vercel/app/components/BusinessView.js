'use client';
import { memo, useState } from 'react';
import { FONT } from '../lib/constants.js';
import Icon from './Icon.js';
import { COLONNA } from '../lib/righello.js';
import { useApp } from '../contexts/AppContext.js';

// ═══════════════════════════════════════════════════════════════
// b.346 — SEZIONE BUSINESS (Luca): parallela e INDIPENDENTE dalle
// altre sezioni, pensata come CASA DEGLI STRUMENTI di lavoro. Il
// primo e il BizCard Scanner INTERO (scansione biglietti, rubrica
// contatti, esportazione), copiato tale e quale in /scanner e qui
// incorniciato con la pelle grafica di BarTalk (?skin=bartalk, solo
// colori: la logica resta l'originale). Altri strumenti si
// aggiungeranno come nuove voci di STRUMENTI.
// ═══════════════════════════════════════════════════════════════

// ═══ b.492 — TAVOLA 05 DEL TEMPLATE: «Strumenti, non riquadri.
// Ognuno dice cosa fa in una riga.» La SCANSIONE e la cosa grande in
// cima (e il motivo per cui si apre questa pagina); la RUBRICA e una
// riga e apre i contatti dello scanner (ponte additivo bartalk-tab.js,
// il codice BizCard resta intatto); PeepOff resta una riga.
// SCOSTAMENTO DICHIARATO: la scheda «Il tuo biglietto da visita» del
// template non c'e — quella funzione nel sistema non esiste ancora, e
// una scheda senza niente dietro e una scatola vuota (regola 2). ═══
const STRUMENTI = [
  {
    id: 'bizcard',
    // b.370 — il NOME e un marchio e resta com'e in tutte le lingue;
    // la DESCRIZIONE no, quella e una frase e va tradotta.
    nome: 'BizCard Scanner',
    descKey: 'bizcardDesc',
    url: '/scanner/index.html?skin=bartalk',
    icona: 'credit',
    // b.415 — la fotocamera SERVE qui: si inquadra un biglietto.
    permessi: 'camera',
  },
  // b.349 — PEEPOFF, l'app sorella: messaggi che non passano mai da un
  // server. L'indirizzo e la tua email con # al posto di @.
  {
    id: 'peepoff',
    nomeKey: 'peepoffName',
    descKey: 'peepoffDesc',
    url: '/posta',
    icona: 'lock',
    // b.415 — PeepOff non inquadra e non registra niente: prima gli si
    // davano fotocamera e microfono lo stesso, perche l'attributo era
    // scritto una volta sola per tutti. Un permesso concesso a chi non
    // lo usa e solo una cosa in piu che puo andare storta.
    permessi: '',
  },
];

// b.370 — QUI DENTRO NON SI PARLA PIU ITALIANO A NESSUNO. Luca ha
// aperto questa schermata col telefono in thailandese e ha trovato
// cinque frasi in italiano: erano scritte a mano e non passavano dal
// traduttore. La prova di guardia non le aveva viste perche guarda solo
// quindici lingue su trentotto (vedi il registro di bordo).
function BusinessView({ onBack }) {
  // b.479 — i colori arrivano dal tema (S), non da una tavolozza fissa:
  // con PALETTE questa schermata restava scura anche sui temi chiari.
  const { L, S } = useApp();
  const nomeDi = (s) => (s.nomeKey ? L(s.nomeKey) : s.nome);
  const [aperto, setAperto] = useState(null); // strumento aperto | null = elenco
  // b.492 — Aa come su ogni pagina: ingrandisce i testi dell'elenco.
  const [zoomTesto, setZoomTesto] = useState(0);
  const ingr = 1 + zoomTesto * 0.15;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: S.colors.bg }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderBottom: `1px solid ${S.colors.headerBorder}`, flexShrink: 0 }}>
        {/* b.479 — il tasto indietro era alto 32: sotto i 44 il dito sbaglia bersaglio. */}
        <button onClick={() => (aperto ? setAperto(null) : onBack())} aria-label={L('backWord')}
          style={{ background: 'none', border: `1px solid ${S.colors.cardBorder}`, borderRadius: 12, width: 44, height: 44, flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="back" size={16} color={S.colors.textPrimary} />
        </button>
        {/* b.479 — il nome della sezione era scritto a mano: la chiave esiste gia. */}
        <div style={{ fontFamily: FONT, color: S.colors.textPrimary, flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{L('businessEntry')}{aperto ? ` — ${aperto.titolo || nomeDi(aperto)}` : ''}</div>
          <div style={{ fontSize: 11, color: S.colors.textMuted }}>
            {aperto ? L(aperto.descKey) : L('businessSubtitle')}
          </div>
        </div>
        {/* b.492 — tavola 05: Aa in testata, come ovunque. */}
        {!aperto && (
          <button onClick={() => setZoomTesto((v) => (v >= 3 ? 0 : v + 1))}
            title={L('textBigger')} aria-label={L('textBigger')}
            style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, cursor: 'pointer',
              background: zoomTesto ? `${S.colors.accent1 || '#5b8cff'}22` : 'none',
              border: `1px solid ${S.colors.cardBorder}`, color: S.colors.textSecondary,
              fontFamily: FONT, fontSize: 15, fontWeight: 600 }}>
            Aa
          </button>
        )}
      </div>

      {!aperto && (
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', ...COLONNA }}>
          {/* b.492 — LA COSA GRANDE IN CIMA: la scansione. E il motivo
              per cui si apre questa pagina (tavola 05). */}
          <button onClick={() => setAperto({ ...STRUMENTI[0], titolo: L('scanCardTitle'), descKey: 'scanCardDesc' })}
            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 20, borderRadius: 16, cursor: 'pointer', textAlign: 'left',
              background: S.colors.cardBg, border: `1px solid ${S.colors.cardBorder}`, fontFamily: FONT }}>
            <span style={{ width: 56, height: 56, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: S.colors.accentGradient, flexShrink: 0 }}>
              <Icon name="credit" size={26} color={S.colors.bg} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 600, color: S.colors.textPrimary, fontSize: 17 * ingr }}>{L('scanCardTitle')}</span>
              <span style={{ display: 'block', fontSize: 12.5 * ingr, color: S.colors.textMuted, marginTop: 2 }}>{L('scanCardDesc')}</span>
            </span>
            <Icon name="chevRight" size={16} color={S.colors.textMuted} />
          </button>

          {/* Le righe, come sulla Home: stessa forma, stesso gesto. */}
          {[
            { id: 'rubrica', icona: 'user', titolo: L('addressBook'), desc: L('addressBookDesc'),
              apri: () => setAperto({ ...STRUMENTI[0], url: '/scanner/index.html?skin=bartalk&tab=contacts', titolo: L('addressBook'), descKey: 'addressBookDesc' }) },
            { id: 'peepoff', icona: 'lock', titolo: L('peepoffName'), desc: L('peepoffDesc'),
              apri: () => setAperto(STRUMENTI[1]) },
          ].map((r) => (
            <button key={r.id} onClick={r.apri}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, borderRadius: 14, cursor: 'pointer', textAlign: 'left',
                background: S.colors.cardBg, border: `1px solid ${S.colors.cardBorder}`, fontFamily: FONT }}>
              <span style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: S.colors.overlayBg, border: `1px solid ${S.colors.cardBorder}`, flexShrink: 0 }}>
                <Icon name={r.icona} size={18} color={S.colors.textSecondary} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 500, color: S.colors.textPrimary, fontSize: 15 * ingr }}>{r.titolo}</span>
                <span style={{ display: 'block', fontSize: 12 * ingr, color: S.colors.textMuted }}>{r.desc}</span>
              </span>
              <Icon name="chevRight" size={16} color={S.colors.textMuted} />
            </button>
          ))}
          <div style={{ padding: 14, borderRadius: 14, border: `1px dashed ${S.colors.cardBorder}`, color: S.colors.textMuted, fontSize: 13, fontFamily: FONT, textAlign: 'center' }}>
            {L('moreToolsSoon')}
          </div>
        </div>
      )}

      {aperto && (
        // b.415 — GLI STRUMENTI STANNO IN UNA STANZA CON MENO PORTE.
        //
        // L'audit: «gli strumenti vengono caricati in iframe same-origin
        // senza sandbox. Non e una vulnerabilita immediata, ma un XSS in
        // uno strumento legacy ha conseguenze maggiori».
        //
        // ONESTA SU COSA QUESTO FA E NON FA. `allow-same-origin` c'e e
        // deve esserci: gli strumenti sono NOSTRI e hanno bisogno del
        // deposito del telefono e delle nostre rotte. Quindi questo NON
        // e un isolamento di origine — quello si ottiene solo mettendoli
        // su un sottodominio dedicato, che e infrastruttura e sta a Luca.
        //
        // Cio che toglie davvero, e non e poco: senza
        // `allow-top-navigation` uno strumento non puo portare TUTTA
        // l'applicazione altrove (che e il modo in cui un XSS diventa una
        // pagina di phishing), e senza `allow-downloads` non puo far
        // partire scaricamenti da solo. E il permesso della fotocamera
        // ora lo ha solo chi la usa.
        <iframe src={aperto.url} title={nomeDi(aperto)}
          allow={aperto.permessi || ''}
          sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
          referrerPolicy="no-referrer"
          style={{ flex: 1, width: '100%', border: 'none', display: 'block', background: S.colors.bg }} />
      )}
    </div>
  );
}

export default memo(BusinessView);

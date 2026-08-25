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
          <div style={{ fontWeight: 600, fontSize: 15 }}>{L('businessEntry')}{aperto ? ` — ${nomeDi(aperto)}` : ''}</div>
          <div style={{ fontSize: 11, color: S.colors.textMuted }}>
            {aperto ? L(aperto.descKey) : L('businessSubtitle')}
          </div>
        </div>
      </div>

      {!aperto && (
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', ...COLONNA }}>
          {STRUMENTI.map((s) => (
            <button key={s.id} onClick={() => setAperto(s)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, borderRadius: 14, cursor: 'pointer', textAlign: 'left',
                background: S.colors.cardBg, border: `1px solid ${S.colors.cardBorder}`, fontFamily: FONT }}>
              <span style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: S.colors.accentGradient, flexShrink: 0 }}>
                <Icon name={s.icona} size={20} color={S.colors.bg} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                {/* b.479 — se tutto pesa niente pesa: il titolo di riga sta a 500. */}
                <span style={{ display: 'block', fontWeight: 500, color: S.colors.textPrimary, fontSize: 15 }}>{nomeDi(s)}</span>
                <span style={{ display: 'block', fontSize: 12, color: S.colors.textMuted }}>{L(s.descKey)}</span>
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

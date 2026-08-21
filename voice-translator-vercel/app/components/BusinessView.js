'use client';
import { memo, useState } from 'react';
import { FONT } from '../lib/constants.js';
import { PALETTE } from '../lib/palette.js';
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
  },
  // b.349 — PEEPOFF, l'app sorella: messaggi che non passano mai da un
  // server. L'indirizzo e la tua email con # al posto di @.
  {
    id: 'peepoff',
    nomeKey: 'peepoffName',
    descKey: 'peepoffDesc',
    url: '/posta',
    icona: 'lock',
  },
];

// b.370 — QUI DENTRO NON SI PARLA PIU ITALIANO A NESSUNO. Luca ha
// aperto questa schermata col telefono in thailandese e ha trovato
// cinque frasi in italiano: erano scritte a mano e non passavano dal
// traduttore. La prova di guardia non le aveva viste perche guarda solo
// quindici lingue su trentotto (vedi il registro di bordo).
function BusinessView({ onBack }) {
  const { L } = useApp();
  const nomeDi = (s) => (s.nomeKey ? L(s.nomeKey) : s.nome);
  const [aperto, setAperto] = useState(null); // strumento aperto | null = elenco

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: PALETTE.bgDeep }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <button onClick={() => (aperto ? setAperto(null) : onBack())} aria-label={L('backWord')}
          style={{ background: 'none', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10, padding: '8px 10px', cursor: 'pointer', display: 'flex' }}>
          <Icon name="back" size={16} color={PALETTE.grayLight} />
        </button>
        <div style={{ fontFamily: FONT, color: PALETTE.grayLight, flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>Business{aperto ? ` — ${nomeDi(aperto)}` : ''}</div>
          <div style={{ fontSize: 11, color: 'rgba(238,242,255,0.55)' }}>
            {aperto ? L(aperto.descKey) : L('businessSubtitle')}
          </div>
        </div>
      </div>

      {!aperto && (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', ...COLONNA }}>
          {STRUMENTI.map((s) => (
            <button key={s.id} onClick={() => setAperto(s)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, borderRadius: 14, cursor: 'pointer', textAlign: 'left',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', fontFamily: FONT }}>
              <span style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `linear-gradient(135deg, ${PALETTE.purple}, ${PALETTE.cyan})`, flexShrink: 0 }}>
                <Icon name={s.icona} size={20} color="#04121c" />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 800, color: PALETTE.grayLight, fontSize: 15 }}>{nomeDi(s)}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'rgba(238,242,255,0.55)' }}>{L(s.descKey)}</span>
              </span>
              <Icon name="chevRight" size={16} color="rgba(238,242,255,0.4)" />
            </button>
          ))}
          <div style={{ padding: 14, borderRadius: 14, border: '1px dashed rgba(255,255,255,0.15)', color: 'rgba(238,242,255,0.45)', fontSize: 13, fontFamily: FONT, textAlign: 'center' }}>
            {L('moreToolsSoon')}
          </div>
        </div>
      )}

      {aperto && (
        <iframe src={aperto.url} title={nomeDi(aperto)}
          allow="camera; microphone"
          style={{ flex: 1, width: '100%', border: 'none', display: 'block', background: PALETTE.bgDeep }} />
      )}
    </div>
  );
}

export default memo(BusinessView);

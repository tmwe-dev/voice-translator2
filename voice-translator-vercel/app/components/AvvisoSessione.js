'use client';
import { useEffect, useState } from 'react';
import { FONT } from '../lib/constants.js';
import { ascoltaSessione } from '../lib/sessioneCaduta.js';
import { t, preloadLang, linguaInterfacciaFuoriContesto } from '../lib/i18n.js';

// ═══════════════════════════════════════════════════════════════
// L'AVVISO CHE LA SESSIONE E' CADUTA.
//
// b.387, secondo collaudo di Luca: la sessione scade durante l'uso e da
// quel momento il server rifiuta tutto — ma l'app continua a mostrare
// nome, email e credito come se niente fosse. Chi usa vede solo
// «Qualcosa e andato storto» su ogni cosa che tocca, e non ha modo di
// capire che la cura e una sola: rientrare.
//
// Sta in un posto fisso e lo dice UNA volta, invece di lasciare che ogni
// schermata inventi il suo errore. E dice la cosa vera — non «errore»,
// ma «la sessione e scaduta» — perche il motivo il server ce lo manda da
// sempre, e veniva buttato via.
//
// Non spinge giu niente: e appoggiato sopra, in alto, e sparisce da solo
// quando si rientra.
// ═══════════════════════════════════════════════════════════════

// b.387 — QUESTO COMPONENTE VIVE FUORI DAL PROVIDER. Sta in page.js
// sopra la schermata, accanto agli avvisi di rete: la lingua se la legge
// da se, come fanno gia Toast e NetworkStatus. Ci sono cascato usando
// useApp(): la compilazione e passata e la pagina non si costruiva piu.
export default function AvvisoSessione() {
  const [caduta, setCaduta] = useState(false);
  const [lingua, setLingua] = useState('en');

  useEffect(() => ascoltaSessione(setCaduta), []);
  useEffect(() => { const l = linguaInterfacciaFuoriContesto(); setLingua(l); preloadLang(l); }, []);

  if (!caduta) return null;

  return (
    <div role="alert" style={{
      position: 'fixed', left: '50%', transform: 'translateX(-50%)',
      top: 'max(10px, env(safe-area-inset-top))', zIndex: 300,
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 12px 10px 16px', borderRadius: 999,
      background: 'rgba(8,11,22,0.96)', backdropFilter: 'blur(14px)',
      border: '1px solid rgba(224,138,94,0.55)',
      boxShadow: '0 8px 30px rgba(0,0,0,0.5)', fontFamily: FONT,
      maxWidth: 'min(420px, calc(100vw - 24px))',
    }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#e08a5e' }}>
        {t(lingua, 'sessionExpired')}
      </span>
      <button onClick={() => { try { window.location.reload(); } catch { /* niente da fare */ } }}
        style={{
          padding: '7px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
          background: '#e08a5e', color: '#1a0d06', fontSize: 12.5, fontWeight: 600,
          fontFamily: FONT, flexShrink: 0,
        }}>
        {t(lingua, 'signInAgain')}
      </button>
    </div>
  );
}

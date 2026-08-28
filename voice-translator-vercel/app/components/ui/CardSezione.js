'use client';
// ═══════════════════════════════════════════════════════════════
// LA CARD DI VETRO DELLA SIDEBAR — una sola, per tutte e tre.
//
// b.550. Nata in b.535 dentro MondoNews, sulla scelta di Luca dal
// ventaglio («Card di vetro con icona») e sul suo ordine di allora:
// «questa sezione non rispecchia la grafica, e' brutto, smorto e non
// piacevole... non ci sono le icone magari blu, e non e' chiaro cosa
// puoi fare». Poi era rimasta li: le sidebar di Stanze e del Mondo
// restavano al vecchio disegno, e lo scheletro unico promesso in b.524
// («le side bar delle tre pagine hanno la stessa selezione campi?????»)
// tornava a essere due cose diverse.
//
// Adesso vive qui, in un posto solo: chip con icona blu, titolo bianco,
// didascalia leggibile (mai grigio smorto su fondo scuro), contenuto
// dentro. Chi la cambia, la cambia per tutte e tre.
// ═══════════════════════════════════════════════════════════════
import { FONT } from '../../lib/constants.js';
import Icon from '../Icon.js';

export default function CardSezione({ icona, titolo, sotto, C, children }) {
  const bordo = C?.cardBorder || 'rgba(255,255,255,0.10)';
  const accent = C?.accent || C?.accent1 || '#5b8cff';
  return (
    <div style={{
      background: 'rgba(255,255,255,0.035)', border: `1px solid ${bordo}`,
      borderRadius: 14, padding: '12px 12px 13px', marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          width: 30, height: 30, borderRadius: 9, flexShrink: 0,
          background: `${accent}16`, border: `1px solid ${accent}3a`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name={icona} size={15} color={accent} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#fff', fontFamily: FONT }}>{titolo}</div>
          {sotto && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.62)', fontFamily: FONT, marginTop: 1 }}>{sotto}</div>}
        </div>
      </div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );
}

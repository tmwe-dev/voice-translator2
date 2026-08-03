import { NextResponse } from 'next/server';
import { saldo, usoOggiEMese, storicoAcquisti } from '../../../wallet/contabilita.js';
import { coloreBatteria, formattaDurata, BATTERIA } from '../../../wallet/tariffe.js';

// GET /api/wallet/saldo?utente=email — legge saldo e uso.
// Non modifica niente: si puo' chiamare quanto si vuole.
export async function GET(req) {
  try {
    const utente = new URL(req.url).searchParams.get('utente');
    if (!utente) return NextResponse.json({ error: 'utente mancante' }, { status: 400 });

    const secondi = await saldo(utente);
    const uso = await usoOggiEMese(utente);
    // Storico ricariche (acquisti, voucher, regali, bonus) per il popup
    const storico = (await storicoAcquisti(utente, 10)).map(r => ({
      quando: String(r.created_at).slice(0, 10),
      tipo: r.tipo,
      testo: '+' + formattaDurata(r.secondi),
      euro: r.dettaglio?.euro ? `€${Number(r.dettaglio.euro).toFixed(2).replace('.', ',')}` : null,
    }));

    return NextResponse.json({
      storico,
      secondi,
      testo: formattaDurata(secondi),
      colore: coloreBatteria(secondi),
      percento: Math.min(100, Math.round((secondi / BATTERIA.riferimentoSecondi) * 100)),
      oggi: formattaDurata(uso.oggi),
      mese: formattaDurata(uso.mese),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

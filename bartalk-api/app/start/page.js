const box = { border: '1px solid #e5e7eb', borderRadius: 16, padding: 20, marginBottom: 16, background: '#fff' };
const code = { display: 'block', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', background: '#0f172a', color: '#f8fafc', padding: 16, borderRadius: 12, fontSize: 14, lineHeight: 1.55 };
const link = { color: '#0f5bd8', fontWeight: 650 };

export default function Start() {
  return <main style={{ maxWidth: 980, margin: '42px auto', padding: '0 20px 64px', fontFamily: 'system-ui, sans-serif', color: '#111827', lineHeight: 1.55 }}>
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#64748b' }}>BarTalk Public API v1</div>
      <h1 style={{ fontSize: 38, margin: '6px 0 8px', lineHeight: 1.08 }}>Start here</h1>
      <p style={{ fontSize: 18, color: '#475569', maxWidth: 760 }}>Questa pagina è il punto di ingresso unico da condividere con uno sviluppatore, Lovable, Claude, Codex o qualsiasi altro builder.</p>
    </div>

    <section style={box}>
      <h2 style={{ marginTop: 0 }}>La sola istruzione da dare a un AI builder</h2>
      <code style={code}>Leggi https://bartalk-api-tmweapps-projects.vercel.app/llms.txt e costruisci l'applicazione usando esclusivamente la BarTalk Public API v1 e la relativa OpenAPI. Non collegarti direttamente al BarTalk Core.</code>
      <p style={{ marginBottom: 0, color: '#64748b' }}>Se il dominio cambia, usa sempre il file <code>/llms.txt</code> sul dominio ufficiale della API: contiene link relativi al runtime corrente.</p>
    </section>

    <section style={box}>
      <h2 style={{ marginTop: 0 }}>Indirizzi ufficiali</h2>
      <p><a style={link} href="/llms.txt">/llms.txt</a> — istruzioni compatte per AI e agenti.</p>
      <p><a style={link} href="/quickstart.md">/quickstart.md</a> — guida Markdown pronta da leggere o importare.</p>
      <p><a style={link} href="/openapi">/openapi</a> — contratto OpenAPI 3.1, fonte tecnica autorevole.</p>
      <p><a style={link} href="/developer.json">/developer.json</a> — manifest machine-readable.</p>
      <p><a style={link} href="/docs">/docs</a> — documentazione completa e lista endpoint.</p>
      <p><a style={link} href="/api/v1/health">/api/v1/health</a> — readiness reale del gateway.</p>
    </section>

    <section style={box}>
      <h2 style={{ marginTop: 0 }}>Regola di distribuzione</h2>
      <p>Non devi consegnare codice, segreti o una tua sessione personale. Dai il link <strong>/start</strong> oppure <strong>/llms.txt</strong>. Chi integra deve usare una sessione BarTalk autorizzata e ottenere una propria API key tramite <code>POST /api/v1/auth/exchange</code>.</p>
      <p style={{ marginBottom: 0 }}><strong>Mai condividere:</strong> <code>BARTALK_API_SIGNING_SECRET</code>, sessioni personali, chiavi interne del Core o URL interni non presenti in OpenAPI.</p>
    </section>

    <section style={box}>
      <h2 style={{ marginTop: 0 }}>Per uno sviluppatore umano</h2>
      <ol style={{ paddingLeft: 22 }}>
        <li>Aprire <a style={link} href="/quickstart.md">quickstart.md</a>.</li>
        <li>Leggere <a style={link} href="/openapi">OpenAPI</a>.</li>
        <li>Verificare <code>GET /api/v1/health</code>.</li>
        <li>Scambiare una sessione BarTalk autorizzata su <code>POST /api/v1/auth/exchange</code>.</li>
        <li>Conservare la chiave <code>bt_live_*</code> solo server-side.</li>
        <li>Usare esclusivamente gli endpoint presenti nella OpenAPI corrente.</li>
      </ol>
    </section>

    <section style={{ ...box, background: '#f8fafc' }}>
      <h2 style={{ marginTop: 0 }}>Sorgente</h2>
      <p style={{ marginBottom: 0 }}>Il gateway pubblico vive esclusivamente nella branch <code>bartalk-api-v1</code>, cartella <code>bartalk-api/</code>. Il Core <code>voice-translator-vercel/</code> non fa parte del pacchetto di integrazione pubblico.</p>
    </section>
  </main>;
}

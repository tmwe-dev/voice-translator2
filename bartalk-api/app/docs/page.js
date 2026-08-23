import { ROUTES } from '../../lib/routes.js';

export default function Docs() {
  return <main style={{maxWidth:1100,margin:'40px auto',padding:'0 20px',fontFamily:'system-ui',lineHeight:1.55}}>
    <h1>BarTalk API v1</h1>
    <p>Gateway isolato sul Core b.420: autentica, applica scope, verifica la sessione e inoltra soltanto capability operative.</p>
    <p><a href="/openapi">OpenAPI 3.1 JSON</a> · <a href="/api/v1/health">Readiness</a></p>

    <h2>Autenticazione</h2>
    <ol>
      <li>Accedi a BarTalk e ottieni una sessione valida.</li>
      <li>Invia <code>POST /api/v1/auth/exchange</code> con <code>Authorization: Bearer &lt;sessione BarTalk&gt;</code>.</li>
      <li>Usa la chiave <code>bt_live_...</code> come Bearer per le chiamate successive.</li>
    </ol>
    <p>TTL massimo 7 giorni. Gli scope di default sono least-privilege; <code>scopes: []</code> crea davvero una chiave senza privilegi.</p>

    <h2>Stanze</h2>
    <p>La API key non sostituisce la membership: <code>roomSessionToken</code>/<code>X-Room-Session</code> resta il capability token della stanza e viene validato dal Core.</p>

    <h2>Endpoint ({ROUTES.length})</h2>
    <div style={{overflowX:'auto'}}>
      <table style={{borderCollapse:'collapse',width:'100%',fontSize:14}}>
        <thead><tr><th style={th}>Metodo</th><th style={th}>Percorso</th><th style={th}>Scope</th><th style={th}>Core</th></tr></thead>
        <tbody>{ROUTES.map((r,i)=><tr key={`${r.method}-${r.pattern}-${i}`}>
          <td style={td}><code>{r.method}</code></td>
          <td style={td}><code>/api/v1{r.pattern}</code></td>
          <td style={td}>{r.public ? 'pubblico' : <code>{r.scope || 'API key'}</code>}</td>
          <td style={td}><code>{r.local ? `gateway:${r.local}` : r.upstream}</code></td>
        </tr>)}</tbody>
      </table>
    </div>

    <h2>Garanzie</h2>
    <ul>
      <li>La business logic resta nel Core.</li>
      <li>Logout/scadenza/cancellazione della sessione BarTalk revocano anche le route che non ricevono direttamente il token account.</li>
      <li>Path, <code>fixedBody</code> e query fissate dal gateway sono autoritativi.</li>
      <li>I rate limit pubblici sono separati per client.</li>
      <li>JSON e multipart sono limitati sui byte reali.</li>
      <li>Audio e NDJSON vengono inoltrati senza reinterpretazione.</li>
      <li>Admin, debug, test, cron, webhook, Stripe raw e mutazioni finanziarie non idempotenti non sono pubblicati.</li>
      <li>Preferenze server, provider vault e glossari legacy restano fuori finche il relativo schema Core non e realmente operativo.</li>
    </ul>
  </main>;
}
const th={textAlign:'left',borderBottom:'1px solid #ccc',padding:'8px'};
const td={borderBottom:'1px solid #eee',padding:'8px',verticalAlign:'top'};

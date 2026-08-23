import { ROUTES } from '../../lib/routes.js';

export default function Docs() {
  return <main style={{maxWidth:1100,margin:'40px auto',padding:'0 20px',fontFamily:'system-ui',lineHeight:1.55}}>
    <h1>BarTalk API v1</h1>
    <p>Gateway isolato: autentica, applica scope e inoltra al BarTalk Core. Non contiene copie del traduttore, del wallet, della memoria o dei Compagni.</p>
    <p><a href="/openapi">OpenAPI 3.1 JSON</a></p>

    <h2>Autenticazione</h2>
    <ol>
      <li>Accedi normalmente a BarTalk e ottieni una sessione valida.</li>
      <li>Invia <code>POST /api/v1/auth/exchange</code> con <code>Authorization: Bearer &lt;sessione BarTalk&gt;</code>.</li>
      <li>Usa la chiave restituita <code>bt_live_...</code> come Bearer per le successive chiamate.</li>
    </ol>
    <p>Se non chiedi scope espliciti la chiave nasce in least-privilege: le scritture sensibili, il wallet e il BYOK richiedono scope dedicati.</p>

    <h2>Stanze</h2>
    <p>Le operazioni di stanza mantengono il secondo livello di identita del Core: <code>roomSessionToken</code> nel JSON oppure <code>X-Room-Session</code> per le GET che lo prevedono. La API key non sostituisce la membership della stanza.</p>

    <h2>Endpoint ({ROUTES.length})</h2>
    <div style={{overflowX:'auto'}}>
      <table style={{borderCollapse:'collapse',width:'100%',fontSize:14}}>
        <thead><tr><th style={th}>Metodo</th><th style={th}>Percorso</th><th style={th}>Scope</th><th style={th}>Core</th></tr></thead>
        <tbody>{ROUTES.map((r,i)=><tr key={`${r.method}-${r.pattern}-${i}`}>
          <td style={td}><code>{r.method}</code></td>
          <td style={td}><code>/api/v1{r.pattern}</code></td>
          <td style={td}>{r.public ? 'pubblico' : <code>{r.scope || 'API key'}</code>}</td>
          <td style={td}><code>{r.local ? 'gateway' : r.upstream}</code></td>
        </tr>)}</tbody>
      </table>
    </div>

    <h2>Garanzie architetturali</h2>
    <ul>
      <li>La business logic resta nel Core.</li>
      <li>Il client non puo sostituire il token account: il gateway sovrascrive <code>token</code>/<code>userToken</code> quando il Core li usa.</li>
      <li><code>fixedBody</code> e le query fissate dal gateway sono autoritative e non sovrascrivibili dal client.</li>
      <li>La sessione stanza resta separata e viene nuovamente validata dal Core.</li>
      <li>I rate limit del gateway si sommano a quelli autorevoli del Core.</li>
      <li>Audio e NDJSON vengono inoltrati come stream, senza reinterpretare il contenuto.</li>
      <li>Admin, debug, test, cron, webhook e Stripe raw non sono pubblicati. La ricarica passa solo dalla capability wallet autenticata.</li>
      <li>L'invio regalo non e esposto finche il Core non offre idempotenza della mutazione.</li>
    </ul>
  </main>;
}
const th={textAlign:'left',borderBottom:'1px solid #ccc',padding:'8px'};
const td={borderBottom:'1px solid #eee',padding:'8px',verticalAlign:'top'};

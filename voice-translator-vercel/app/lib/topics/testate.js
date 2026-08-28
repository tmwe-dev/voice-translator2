// ═══════════════════════════════════════════════════════════════
// LE TESTATE — il seme del registro, scritto a mano (b.565)
//
// Il registro impara da solo (b.553: due comparse e una testata entra),
// ma parte da zero e ci mette settimane. Questo elenco e' la spinta
// iniziale: centoventi testate vere, in venti lingue, col loro paese.
//
// PERCHE' A MANO. E' l'unica parte del progetto che non si programma:
// riconoscere una testata seria da un aggregatore o da un sito che
// copia e incolla e' un giudizio, non un algoritmo. Sbagliare qui si
// paga in tutto il resto — il registro impara SOPRA queste, e una
// fonte sbagliata in cima insegna male per mesi.
//
// COSA C'E' E COSA NO: agenzie, quotidiani nazionali, radiotelevisioni
// pubbliche, qualche rivista di settore riconosciuta. NON aggregatori
// (ci ridarebbero i contenuti altrui), non siti che vivono di
// riassunti, nessuna testata senza una redazione con un nome sopra.
//
// L'EQUILIBRIO E' VOLUTO: nessun paese ha piu di dieci voci, e le
// lingue non europee pesano quanto le europee. La «quota di mondo»
// (regia.js) pesca da qui: se questo elenco fosse tutto occidentale,
// il mondo che mostriamo sarebbe finto.
//
// File PURO: nessun import.
// ═══════════════════════════════════════════════════════════════

export const TESTATE = [
  { d: 'ansa.it', n: 'ANSA', p: 'IT', l: 'it' },
  { d: 'repubblica.it', n: 'la Repubblica', p: 'IT', l: 'it' },
  { d: 'corriere.it', n: 'Corriere della Sera', p: 'IT', l: 'it' },
  { d: 'ilsole24ore.com', n: 'Il Sole 24 Ore', p: 'IT', l: 'it' },
  { d: 'rainews.it', n: 'Rai News', p: 'IT', l: 'it' },
  { d: 'ilpost.it', n: 'Il Post', p: 'IT', l: 'it' },
  { d: 'lastampa.it', n: 'La Stampa', p: 'IT', l: 'it' },
  { d: 'agi.it', n: 'AGI', p: 'IT', l: 'it' },
  { d: 'internazionale.it', n: 'Internazionale', p: 'IT', l: 'it' },
  { d: 'wired.it', n: 'Wired Italia', p: 'IT', l: 'it' },

  { d: 'bbc.com', n: 'BBC', p: 'GB', l: 'en' },
  { d: 'theguardian.com', n: 'The Guardian', p: 'GB', l: 'en' },
  { d: 'ft.com', n: 'Financial Times', p: 'GB', l: 'en' },
  { d: 'economist.com', n: 'The Economist', p: 'GB', l: 'en' },
  { d: 'independent.co.uk', n: 'The Independent', p: 'GB', l: 'en' },
  { d: 'telegraph.co.uk', n: 'The Telegraph', p: 'GB', l: 'en' },
  { d: 'rte.ie', n: 'RTE', p: 'IE', l: 'en' },
  { d: 'irishtimes.com', n: 'The Irish Times', p: 'IE', l: 'en' },

  { d: 'apnews.com', n: 'Associated Press', p: 'US', l: 'en' },
  { d: 'reuters.com', n: 'Reuters', p: 'US', l: 'en' },
  { d: 'nytimes.com', n: 'The New York Times', p: 'US', l: 'en' },
  { d: 'washingtonpost.com', n: 'The Washington Post', p: 'US', l: 'en' },
  { d: 'npr.org', n: 'NPR', p: 'US', l: 'en' },
  { d: 'wsj.com', n: 'The Wall Street Journal', p: 'US', l: 'en' },
  { d: 'theatlantic.com', n: 'The Atlantic', p: 'US', l: 'en' },
  { d: 'arstechnica.com', n: 'Ars Technica', p: 'US', l: 'en' },
  { d: 'cbc.ca', n: 'CBC', p: 'CA', l: 'en' },
  { d: 'theglobeandmail.com', n: 'The Globe and Mail', p: 'CA', l: 'en' },

  { d: 'lemonde.fr', n: 'Le Monde', p: 'FR', l: 'fr' },
  { d: 'lefigaro.fr', n: 'Le Figaro', p: 'FR', l: 'fr' },
  { d: 'liberation.fr', n: 'Liberation', p: 'FR', l: 'fr' },
  { d: 'francetvinfo.fr', n: 'France Info', p: 'FR', l: 'fr' },
  { d: 'france24.com', n: 'France 24', p: 'FR', l: 'fr' },
  { d: 'rfi.fr', n: 'RFI', p: 'FR', l: 'fr' },
  { d: 'lesechos.fr', n: 'Les Echos', p: 'FR', l: 'fr' },
  { d: 'rtbf.be', n: 'RTBF', p: 'BE', l: 'fr' },

  { d: 'spiegel.de', n: 'Der Spiegel', p: 'DE', l: 'de' },
  { d: 'zeit.de', n: 'Die Zeit', p: 'DE', l: 'de' },
  { d: 'faz.net', n: 'FAZ', p: 'DE', l: 'de' },
  { d: 'sueddeutsche.de', n: 'Sueddeutsche Zeitung', p: 'DE', l: 'de' },
  { d: 'tagesschau.de', n: 'Tagesschau', p: 'DE', l: 'de' },
  { d: 'dw.com', n: 'Deutsche Welle', p: 'DE', l: 'de' },
  { d: 'derstandard.at', n: 'Der Standard', p: 'AT', l: 'de' },
  { d: 'nzz.ch', n: 'Neue Zuercher Zeitung', p: 'CH', l: 'de' },

  { d: 'elpais.com', n: 'El Pais', p: 'ES', l: 'es' },
  { d: 'elmundo.es', n: 'El Mundo', p: 'ES', l: 'es' },
  { d: 'rtve.es', n: 'RTVE', p: 'ES', l: 'es' },
  { d: 'lavanguardia.com', n: 'La Vanguardia', p: 'ES', l: 'es' },
  { d: 'eldiario.es', n: 'elDiario.es', p: 'ES', l: 'es' },
  { d: 'clarin.com', n: 'Clarin', p: 'AR', l: 'es' },
  { d: 'lanacion.com.ar', n: 'La Nacion', p: 'AR', l: 'es' },
  { d: 'eluniversal.com.mx', n: 'El Universal', p: 'MX', l: 'es' },
  { d: 'milenio.com', n: 'Milenio', p: 'MX', l: 'es' },
  { d: 'emol.com', n: 'Emol', p: 'CL', l: 'es' },
  { d: 'eltiempo.com', n: 'El Tiempo', p: 'CO', l: 'es' },

  { d: 'publico.pt', n: 'Publico', p: 'PT', l: 'pt' },
  { d: 'expresso.pt', n: 'Expresso', p: 'PT', l: 'pt' },
  { d: 'rtp.pt', n: 'RTP', p: 'PT', l: 'pt' },
  { d: 'folha.uol.com.br', n: 'Folha de S.Paulo', p: 'BR', l: 'pt' },
  { d: 'estadao.com.br', n: 'Estadao', p: 'BR', l: 'pt' },
  { d: 'agenciabrasil.ebc.com.br', n: 'Agencia Brasil', p: 'BR', l: 'pt' },

  { d: 'nos.nl', n: 'NOS', p: 'NL', l: 'nl' },
  { d: 'nrc.nl', n: 'NRC', p: 'NL', l: 'nl' },
  { d: 'svt.se', n: 'SVT', p: 'SE', l: 'sv' },
  { d: 'dn.se', n: 'Dagens Nyheter', p: 'SE', l: 'sv' },
  { d: 'nrk.no', n: 'NRK', p: 'NO', l: 'nb' },
  { d: 'dr.dk', n: 'DR', p: 'DK', l: 'da' },
  { d: 'yle.fi', n: 'Yle', p: 'FI', l: 'fi' },
  { d: 'wyborcza.pl', n: 'Gazeta Wyborcza', p: 'PL', l: 'pl' },
  { d: 'tvn24.pl', n: 'TVN24', p: 'PL', l: 'pl' },

  { d: 'idnes.cz', n: 'iDNES', p: 'CZ', l: 'cs' },
  { d: 'ceskatelevize.cz', n: 'Ceska televize', p: 'CZ', l: 'cs' },
  { d: 'telex.hu', n: 'Telex', p: 'HU', l: 'hu' },
  { d: 'digi24.ro', n: 'Digi24', p: 'RO', l: 'ro' },
  { d: 'dnevnik.bg', n: 'Dnevnik', p: 'BG', l: 'bg' },
  { d: 'jutarnji.hr', n: 'Jutarnji list', p: 'HR', l: 'hr' },
  { d: 'pravda.com.ua', n: 'Ukrainska Pravda', p: 'UA', l: 'uk' },
  { d: 'suspilne.media', n: 'Suspilne', p: 'UA', l: 'uk' },
  { d: 'kathimerini.gr', n: 'Kathimerini', p: 'GR', l: 'el' },
  { d: 'ertnews.gr', n: 'ERT', p: 'GR', l: 'el' },

  { d: 'aljazeera.net', n: 'Al Jazeera', p: 'QA', l: 'ar' },
  { d: 'alarabiya.net', n: 'Al Arabiya', p: 'AE', l: 'ar' },
  { d: 'youm7.com', n: 'Youm7', p: 'EG', l: 'ar' },
  { d: 'skynewsarabia.com', n: 'Sky News Arabia', p: 'AE', l: 'ar' },
  { d: 'haaretz.co.il', n: 'Haaretz', p: 'IL', l: 'he' },
  { d: 'ynet.co.il', n: 'ynet', p: 'IL', l: 'he' },
  { d: 'hurriyet.com.tr', n: 'Hurriyet', p: 'TR', l: 'tr' },
  { d: 'aa.com.tr', n: 'Anadolu Ajansi', p: 'TR', l: 'tr' },
  { d: 'news24.com', n: 'News24', p: 'ZA', l: 'en' },
  { d: 'nation.africa', n: 'Nation', p: 'KE', l: 'en' },
  { d: 'premiumtimesng.com', n: 'Premium Times', p: 'NG', l: 'en' },
  { d: 'mg.co.za', n: 'Mail and Guardian', p: 'ZA', l: 'en' },

  { d: 'nhk.or.jp', n: 'NHK', p: 'JP', l: 'ja' },
  { d: 'asahi.com', n: 'Asahi Shimbun', p: 'JP', l: 'ja' },
  { d: 'nikkei.com', n: 'Nikkei', p: 'JP', l: 'ja' },
  { d: 'japantimes.co.jp', n: 'The Japan Times', p: 'JP', l: 'en' },
  { d: 'yna.co.kr', n: 'Yonhap', p: 'KR', l: 'ko' },
  { d: 'koreaherald.com', n: 'The Korea Herald', p: 'KR', l: 'en' },
  { d: 'scmp.com', n: 'South China Morning Post', p: 'HK', l: 'en' },
  { d: 'cna.com.tw', n: 'CNA Taiwan', p: 'TW', l: 'zh' },
  { d: 'straitstimes.com', n: 'The Straits Times', p: 'SG', l: 'en' },

  { d: 'thehindu.com', n: 'The Hindu', p: 'IN', l: 'en' },
  { d: 'indianexpress.com', n: 'The Indian Express', p: 'IN', l: 'en' },
  { d: 'ndtv.com', n: 'NDTV', p: 'IN', l: 'en' },
  { d: 'aajtak.in', n: 'Aaj Tak', p: 'IN', l: 'hi' },
  { d: 'prothomalo.com', n: 'Prothom Alo', p: 'BD', l: 'bn' },
  { d: 'dawn.com', n: 'Dawn', p: 'PK', l: 'en' },
  { d: 'thairath.co.th', n: 'Thairath', p: 'TH', l: 'th' },
  { d: 'bangkokpost.com', n: 'Bangkok Post', p: 'TH', l: 'en' },
  { d: 'vnexpress.net', n: 'VnExpress', p: 'VN', l: 'vi' },
  { d: 'kompas.com', n: 'Kompas', p: 'ID', l: 'id' },
  { d: 'thejakartapost.com', n: 'The Jakarta Post', p: 'ID', l: 'en' },
  { d: 'inquirer.net', n: 'Philippine Daily Inquirer', p: 'PH', l: 'en' },

  { d: 'abc.net.au', n: 'ABC News', p: 'AU', l: 'en' },
  { d: 'smh.com.au', n: 'The Sydney Morning Herald', p: 'AU', l: 'en' },
  { d: 'rnz.co.nz', n: 'RNZ', p: 'NZ', l: 'en' },
];

/** Le testate di un Paese (sigla a due lettere). */
export function testateDelPaese(paese) {
  const p = String(paese || '').toUpperCase().slice(0, 2);
  return p ? TESTATE.filter((t) => t.p === p) : [];
}

/** Le testate che scrivono in una lingua. */
export function testateDellaLingua(lingua) {
  const l = String(lingua || '').toLowerCase().slice(0, 2);
  return l ? TESTATE.filter((t) => t.l === l) : [];
}

/**
 * Le voci pronte per il registro (`mondo_fonti_viste`).
 * Entrano con DUE apparizioni: la stessa dignita di una fonte che si e'
 * fatta notare da sola. Non di piu — il merito se lo devono guadagnare
 * facendosi leggere, come tutte le altre.
 */
export function perIlRegistro(elenco = TESTATE) {
  return elenco.map((t) => ({ dominio: t.d, nome: t.n, quante: 2 }));
}

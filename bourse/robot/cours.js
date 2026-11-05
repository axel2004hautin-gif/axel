#!/usr/bin/env node
// Robot des cours de Boussole Bourse.
// Lit le portefeuille, récupère les cours (Tradegate, prix de vente en direct, pour les actions et
// les ETF ; Yahoo Finance s'ils n'y sont pas ; CoinGecko pour les cryptos), convertit en euros, et
// prépare deux documents à écrire dans la page :
//   - marche.json : les cours de chaque ligne, les symboles trouvés et les erreurs ;
//   - historique.json : l'historique du patrimoine avec le relevé du jour.
// Usage : node cours.js <portefeuille.json> <marche.json|-> <historique.json|-> <dossier de sortie>
// Les fichiers d'entrée sont les documents tels que la page les enregistre ; « - » = absent.
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const [fPortefeuille, fMarche, fHistorique, dossier] = process.argv.slice(2);
if (!fPortefeuille || !dossier) {
  console.error("Usage : node cours.js <portefeuille.json> <marche.json|-> <historique.json|-> <dossier de sortie>");
  process.exit(2);
}
const lire = f => {
  if (!f || f === "-" || !fs.existsSync(f)) return null;
  const o = JSON.parse(fs.readFileSync(f, "utf8"));
  return o && o.data && typeof o.data === "object" && !Array.isArray(o.data) && ("lignes" in o.data || "cours" in o.data || "points" in o.data) ? o.data : o;
};
const portefeuille = lire(fPortefeuille) || {};
const marchePrecedent = lire(fMarche) || {};
const historique = lire(fHistorique) || { points: [] };

const num = v => { const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const cleLigne = l => String(l.symbole || l.code || l.nom || "").trim().toLowerCase();
const estCrypto = l => l.type === "Crypto" || l.enveloppe === "Crypto" || l.classe === "crypto";
const nomPropre = s => String(s || "").replace(/\(exemple\)/gi, "").trim();
const attendre = ms => { const fin = Date.now() + ms; while (Date.now() < fin) { /* pause courte entre deux appels */ } };

function getJSON(url) {
  for (let essai = 0; essai < 3; essai++) {
    try {
      const sortie = execFileSync("curl", ["-sS", "-m", "20", "-A", "Mozilla/5.0 (Boussole Bourse)", "-H", "Accept: application/json", "-w", "\n%{http_code}", url], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
      const i = sortie.lastIndexOf("\n");
      const code = Number(sortie.slice(i + 1)), corps = sortie.slice(0, i);
      if (code === 200) return JSON.parse(corps);
      if (code === 404) return null;
    } catch (_) { /* nouvel essai */ }
    attendre(1500 * (essai + 1));
  }
  return null;
}
const YAHOO = ["https://query2.finance.yahoo.com", "https://query1.finance.yahoo.com"];
function yahoo(chemin) {
  for (const base of YAHOO) { const r = getJSON(base + chemin); if (r) return r; }
  return null;
}
function coteYahoo(symbole) {
  const r = yahoo(`/v8/finance/chart/${encodeURIComponent(symbole)}?range=1d&interval=1d`);
  const m = r && r.chart && r.chart.result && r.chart.result[0] && r.chart.result[0].meta;
  if (!m || !(m.regularMarketPrice > 0)) return null;
  return { symbole: m.symbol, prix: m.regularMarketPrice, veille: m.chartPreviousClose || m.previousClose || null, devise: m.currency || "EUR",
    nom: m.longName || m.shortName || "", date: m.regularMarketTime ? new Date(m.regularMarketTime * 1000).toISOString() : new Date().toISOString() };
}
// Places préférées : Paris d'abord (PEA), puis les autres places européennes, puis le reste.
const PLACES = ["PAR", "AMS", "BRU", "GER", "FRA", "MIL", "MCE", "EBS", "VIE", "LIS", "NMS", "NYQ", "NGM", "PCX", "LSE"];
function chercherYahoo(requete, ligne) {
  const r = yahoo(`/v1/finance/search?q=${encodeURIComponent(requete)}&quotesCount=10&newsCount=0`);
  const q = (r && r.quotes || []).filter(x => x.symbol && ["ETF", "EQUITY", "MUTUALFUND", "INDEX"].includes(x.quoteType));
  if (!q.length) return null;
  const typeVoulu = ligne.type === "ETF" ? "ETF" : ligne.type === "Action" ? "EQUITY" : null;
  const rang = x => {
    let s = PLACES.indexOf(x.exchange); s = s < 0 ? 50 : s;
    if (typeVoulu && x.quoteType !== typeVoulu) s += 20;
    if (x.quoteType === "MUTUALFUND") s += 30;
    return s;
  };
  return q.sort((a, b) => rang(a) - rang(b))[0].symbol;
}
const tauxDevise = {};
function versEuros(prix, devise) {
  if (prix == null) return null;
  let d = devise || "EUR", p = prix;
  if (d === "GBp" || d === "GBX") { p = p / 100; d = "GBP"; }
  if (d === "ZAc") { p = p / 100; d = "ZAR"; }
  if (d === "EUR") return p;
  if (!(d in tauxDevise)) { const c = coteYahoo(`EUR${d}=X`); tauxDevise[d] = c ? c.prix : null; }
  return tauxDevise[d] ? p / tauxDevise[d] : null;
}
function idCoinGecko(ligne) {
  const requete = (ligne.symbole || ligne.code || nomPropre(ligne.nom)).replace(/[-/]?(EUR|USD|USDT)$/i, "");
  const r = getJSON(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(requete)}`);
  const coins = (r && r.coins) || [];
  const exact = coins.filter(c => c.symbol && c.symbol.toLowerCase() === requete.toLowerCase());
  const liste = (exact.length ? exact : coins).sort((a, b) => (a.market_cap_rank || 1e9) - (b.market_cap_rank || 1e9));
  return liste[0] ? liste[0].id : null;
}

const lignes = Array.isArray(portefeuille.lignes) ? portefeuille.lignes : [];
const anciensSymboles = marchePrecedent.symboles || {};
const anciensCours = marchePrecedent.cours || {};
const marche = { maj: new Date().toISOString(), sources: [], cours: {}, symboles: {}, erreurs: [] };
const sources = new Set();

// Tradegate : prix de vente (bid) en direct, en euros, à partir de l'ISIN. C'est le prix le plus
// proche de celui qu'affiche Trade Republic pour valoriser un portefeuille, à toute heure.
const nombre = v => {
  if (typeof v === "number") return v;
  const t = String(v ?? "").trim();
  const n = parseFloat(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : null;
};
const estIsin = c => /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(c || "");
function tradegate(isin) {
  const r = getJSON(`https://www.tradegatebsx.com/refresh.php?isin=${isin}`);
  if (!r) return null;
  const bid = nombre(r.bid), last = nombre(r.last), close = nombre(r.close);
  const prix = bid > 0 ? bid : last > 0 ? last : null;
  if (!prix) return null;
  return { prix, veille: close > 0 ? close : null, date: new Date().toISOString() };
}
// ISIN à partir du nom, via la recherche de Lang & Schwarz (la place de Trade Republic).
function isinParNom(ligne) {
  const r = getJSON(`https://www.ls-tc.de/_rpc/json/.lstc/instrument/search/main?q=${encodeURIComponent(nomPropre(ligne.nom))}&localeId=2`);
  const liste = Array.isArray(r) ? r.filter(x => estIsin(x.isin)) : [];
  const cat = { ETF: "ETF", Action: "Aktie", Fonds: "Fonds" }[ligne.type];
  const x = (cat && liste.find(x => x.categoryName === cat)) || liste.find(x => ["Aktie", "ETF", "Fonds"].includes(x.categoryName));
  return x ? x.isin : null;
}

// 1. Résoudre chaque ligne (réutilisé d'une fois sur l'autre tant que la ligne ne change pas).
const cryptos = [];
for (const l of lignes) {
  const cle = cleLigne(l);
  const ancien = anciensSymboles[l.id];
  // Réutilisé seulement s'il a été trouvé par cette version du robot (v: 2, avec Tradegate).
  if (ancien && ancien.v === 2 && ancien.cle === cle && (ancien.symbole || ancien.isin)) { marche.symboles[l.id] = ancien; if (ancien.source === "CoinGecko") cryptos.push(l); continue; }
  if (estCrypto(l) && !/\.[A-Z]{1,3}$/.test(l.symbole || "")) {
    const id = l.symbole && /^[a-z0-9-]+$/.test(l.symbole) && l.symbole.length > 5 ? l.symbole : idCoinGecko(l);
    if (id) { marche.symboles[l.id] = { symbole: id, cle, source: "CoinGecko", v: 2 }; cryptos.push(l); }
    else marche.erreurs.push({ ligne: l.nom, message: "Crypto introuvable sur CoinGecko : indique son symbole (BTC, ETH…)." });
    continue;
  }
  // ISIN : celui de la ligne, sinon trouvé par le nom (sauf si un symbole Yahoo est imposé).
  const isin = estIsin(l.code) ? l.code : estIsin(l.symbole) ? l.symbole : !l.symbole ? isinParNom(l) : null;
  let symbole = null;
  if (l.symbole && !estIsin(l.symbole)) symbole = l.symbole.trim();
  else if (!isin) {
    for (const e of [l.code, nomPropre(l.nom)].filter(Boolean)) { symbole = chercherYahoo(e, l); if (symbole) break; }
  }
  if (isin || symbole) marche.symboles[l.id] = { symbole: symbole || "", isin: isin || "", cle, source: isin ? "Tradegate" : "Yahoo Finance", v: 2 };
  else marche.erreurs.push({ ligne: l.nom, message: "Introuvable : ajoute l'ISIN de la ligne (ex. IE0002XZSHO1) ou son symbole Yahoo Finance (ex. CW8.PA)." });
}

// 2. Cours des actions et ETF : Tradegate d'abord, Yahoo Finance sinon.
for (const l of lignes) {
  const s = marche.symboles[l.id];
  if (!s || s.source === "CoinGecko") continue;
  if (s.isin) {
    const t = tradegate(s.isin);
    if (t) {
      marche.cours[l.id] = { symbole: s.isin, nom: "", prix: t.prix, veille: t.veille, devise: "EUR", prixDevise: t.prix, date: t.date, source: "Tradegate", cle: s.cle };
      sources.add("Tradegate");
      continue;
    }
  }
  // Yahoo Finance : le cours le plus récent entre la place principale et, pour un ISIN, Stuttgart.
  let symbole = s.symbole;
  if (!symbole) { symbole = chercherYahoo(s.isin, l) || chercherYahoo(nomPropre(l.nom), l); if (symbole) s.symbole = symbole; }
  if (!symbole) { marche.erreurs.push({ ligne: l.nom, message: "Pas de cours sur Tradegate ni sur Yahoo Finance." }); if (anciensCours[l.id]) marche.cours[l.id] = anciensCours[l.id]; continue; }
  const candidats = [symbole];
  if (s.isin && !symbole.endsWith(".SG")) candidats.push(s.isin + ".SG");
  const cotes = candidats.map(coteYahoo).filter(Boolean);
  const c = cotes.sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0] || null;
  if (!c) { marche.erreurs.push({ ligne: l.nom, message: `Pas de cours pour ${symbole} aujourd'hui.` }); if (anciensCours[l.id]) marche.cours[l.id] = anciensCours[l.id]; continue; }
  const prix = versEuros(c.prix, c.devise), veille = c.veille != null ? versEuros(c.veille, c.devise) : null;
  if (prix == null) { marche.erreurs.push({ ligne: l.nom, message: `Conversion ${c.devise} → EUR impossible.` }); continue; }
  marche.cours[l.id] = { symbole: c.symbole, nom: c.nom, prix: Math.round(prix * 10000) / 10000, veille: veille != null ? Math.round(veille * 10000) / 10000 : null,
    devise: c.devise, prixDevise: c.prix, date: c.date, source: "Yahoo Finance", cle: s.cle };
  sources.add("Yahoo Finance");
}

// 3. Cours des cryptos, en une seule requête.
if (cryptos.length) {
  const ids = [...new Set(cryptos.map(l => marche.symboles[l.id].symbole))];
  const r = getJSON(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=eur&include_24hr_change=true&include_last_updated_at=true`);
  for (const l of cryptos) {
    const s = marche.symboles[l.id], c = r && r[s.symbole];
    if (!c || !(c.eur > 0)) { marche.erreurs.push({ ligne: l.nom, message: `Pas de cours CoinGecko pour ${s.symbole}.` }); if (anciensCours[l.id]) marche.cours[l.id] = anciensCours[l.id]; continue; }
    const variation = num(c.eur_24h_change);
    marche.cours[l.id] = { symbole: s.symbole, nom: s.symbole, prix: c.eur, veille: variation ? Math.round(c.eur / (1 + variation / 100) * 10000) / 10000 : null,
      devise: "EUR", prixDevise: c.eur, date: c.last_updated_at ? new Date(c.last_updated_at * 1000).toISOString() : marche.maj, source: "CoinGecko", cle: s.cle };
    sources.add("CoinGecko");
  }
}
marche.sources = [...sources];

// 4. Relevé du jour dans l'historique (comme la page : un point par jour, pas pendant l'exemple).
const comptes = Array.isArray(portefeuille.comptes) ? portefeuille.comptes : [];
const exemple = portefeuille.exemple || comptes.some(c => /^cx\d/.test(c.id || ""));
let historiqueEcrit = false;
if (!exemple) {
  const r2 = x => Math.round(x * 100) / 100;
  let bourse = 0, crypto = 0, investi = 0;
  for (const l of lignes) {
    const c = marche.cours[l.id];
    const manuelPlusRecent = l.coursManuelLe && c && c.date && l.coursManuelLe > c.date;
    const prix = c && c.prix > 0 && !manuelPlusRecent ? c.prix : null;
    let valeur;
    if (l.sansQuantite) valeur = prix && l.refPrix > 0 ? num(l.cours) * prix / l.refPrix : num(l.cours);
    else valeur = num(l.quantite) * (prix != null ? prix : num(l.cours));
    if (estCrypto(l)) crypto += valeur; else bourse += valeur;
    investi += l.sansQuantite ? num(l.pru) : num(l.quantite) * num(l.pru);
  }
  // Ancien format de la page : un seul montant d'épargne de précaution, sans comptes.
  const ancien = !Array.isArray(portefeuille.comptes) && num(portefeuille.precaution) > 0 ? num(portefeuille.precaution) : 0;
  const epargne = comptes.reduce((s, c) => s + num(c.solde), 0) + ancien;
  const precaution = comptes.filter(c => c.precaution).reduce((s, c) => s + num(c.solde), 0) + ancien;
  if (epargne + bourse + crypto > 0 || (historique.points || []).length) {
    const date = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const pt = { date, epargne: r2(epargne), precaution: r2(precaution), bourse: r2(bourse), crypto: r2(crypto), investi: r2(investi) };
    const pts = (historique.points || []).filter(p => p && p.date !== date);
    pts.push(pt);
    pts.sort((a, b) => (a.date < b.date ? -1 : 1));
    historique.points = pts.length > 1000 ? pts.filter((_, i) => i >= 500 || i % 2 === 0) : pts;
    historiqueEcrit = true;
  }
}

fs.mkdirSync(dossier, { recursive: true });
fs.writeFileSync(path.join(dossier, "marche.json"), JSON.stringify(marche));
if (historiqueEcrit) fs.writeFileSync(path.join(dossier, "historique.json"), JSON.stringify({ points: historique.points }));
console.log(JSON.stringify({
  lignes: lignes.length, cours: Object.keys(marche.cours).length, erreurs: marche.erreurs,
  historique: historiqueEcrit ? "historique.json à écrire" : "rien à écrire (pas de données réelles)",
  fichiers: [path.join(dossier, "marche.json")].concat(historiqueEcrit ? [path.join(dossier, "historique.json")] : [])
}, null, 1));

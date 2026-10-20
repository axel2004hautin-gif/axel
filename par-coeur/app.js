// Articles par cœur : apprendre ses articles par cœur (matières, coupes, arguments) et s'entraîner en quiz.
// Logique de par-coeur/index.html. Les articles vivent dans la base partagée de la page publiée ; la progression
// de chacun dans son espace privé. Ouverte en fichier, la page garde tout dans le navigateur (sans photos).
(() => {
  "use strict";
  const SAV = window.SAVOIR, COMPO = window.COMPOSITION;

  // ---------- outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // Typographie française à l'affichage : espace insécable avant : ; ? ! » et les unités.
  const typo = s => String(s ?? "").replace(/ ([:;?!»])/g, "\u00a0$1").replace(/« /g, "«\u00a0").replace(/(\d) (%|°C|€|cm)/g, "$1\u00a0$2");
  const t = s => esc(typo(s));
  const norm = COMPO.norm;
  const clef = s => norm(s).replace(/[^a-z0-9]+/g, " ").trim();
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
  // Après deux-points, une phrase reprend en minuscule (sauf un sigle : « W32 », « PU »).
  const minus = s => s && /^[A-ZÀ-Ý][a-zà-ÿ]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
  const pluriel = (n, mot, motPluriel) => `${n} ${n > 1 ? (motPluriel || mot + "s") : mot}`;
  const unique = l => [...new Set(l)];
  function melanger(l) { const a = [...l]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const tirer = l => l[Math.floor(Math.random() * l.length)];
  const attendre = ms => new Promise(r => setTimeout(r, ms));
  const lireStockage = (cle, defaut) => { try { const v = localStorage.getItem(cle); return v ? JSON.parse(v) : defaut; } catch (_) { return defaut; } };
  const ecrireStockage = (cle, v) => { try { localStorage.setItem(cle, JSON.stringify(v)); } catch (_) { /* stockage indisponible */ } };
  const texte = (v, max = 300) => typeof v === "string" ? v.trim().slice(0, max) : "";
  const listeTextes = (v, max = 30, long = 200) => Array.isArray(v) ? unique(v.filter(x => typeof x === "string" && x.trim()).map(x => x.trim().slice(0, long))).slice(0, max) : [];
  const lignes = s => String(s || "").split("\n").map(x => x.replace(/^\s*[-•·*]\s*/, "").trim()).filter(Boolean);
  const arrondi = n => Math.round(n * 100) / 100;
  function lireMontant(v) {
    if (typeof v === "number") return isFinite(v) && v >= 0 ? arrondi(v) : null;
    let s = String(v ?? "").replace(/[^\d,.]/g, "");
    if (!s) return null;
    if (s.includes(",") && s.includes(".")) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
    else s = s.replace(",", ".");
    const x = parseFloat(s);
    return isFinite(x) && x >= 0 ? arrondi(x) : null;
  }
  const euro = n => { const v = arrondi(n); const d = Number.isInteger(v) ? 0 : 2; return v.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: d, maximumFractionDigits: d }); };
  const slug = s => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  const jourIso = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const numJour = iso => { const [a, m, j] = iso.split("-").map(Number); return Math.round(Date.UTC(a, m - 1, j) / 86400000); };
  const isoDeNum = n => new Date(n * 86400000).toISOString().slice(0, 10);
  const auj = () => numJour(jourIso());
  const nomJourCourt = n => new Date(n * 86400000).toLocaleDateString("fr-FR", { weekday: "narrow", timeZone: "UTC" }).toUpperCase();
  const quandRevision = d => { const e = d - auj(); return e <= 0 ? "aujourd'hui" : e === 1 ? "demain" : e < 7 ? new Date(d * 86400000).toLocaleDateString("fr-FR", { weekday: "long", timeZone: "UTC" }) : `dans ${e} jours`; };

  // Un message en bas de l'écran. Avec une action (« Annuler »), il reste 8 secondes ; quand il disparaît ou qu'un
  // autre le remplace, `expire` termine ce qui attendait (supprimer les photos pour de bon).
  let minuteurToast = null, toastEnCours = null;
  function toast(msg, action) {
    const el = $("#toast");
    const precedent = toastEnCours; toastEnCours = null;
    clearTimeout(minuteurToast);
    if (precedent && precedent.expire) precedent.expire();
    toastEnCours = action || null;
    el.innerHTML = `<span>${t(msg)}</span>${action ? `<button type="button" class="toast-action">${t(action.libelle)}</button>` : ""}`;
    el.hidden = false;
    if (action) el.querySelector(".toast-action").addEventListener("click", () => {
      clearTimeout(minuteurToast); toastEnCours = null; el.hidden = true; action.faire();
    });
    minuteurToast = setTimeout(() => {
      el.hidden = true;
      const fini = toastEnCours; toastEnCours = null;
      if (fini && fini.expire) fini.expire();
    }, action ? 8000 : 3000);
  }

  const ICONE = {
    accueil: `<svg class="picto" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.5 12 5l8 6.5V20h-5.5v-5h-5v5H4z"/></svg>`,
    articles: `<svg class="picto" viewBox="0 0 24 24" aria-hidden="true"><path d="M10.2 5.6a1.9 1.9 0 1 1 2.5 1.8c-.5.2-.7.6-.7 1.1v.8M12 9.3 3.6 15.2a1.4 1.4 0 0 0 .8 2.5h15.2a1.4 1.4 0 0 0 .8-2.5z"/></svg>`,
    quiz: `<svg class="picto" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.8v.4M12 17.2v.1"/></svg>`,
    matieres: `<svg class="picto" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v14H5z"/><path d="M5 12l7-7M5 19 19 5M12 19l7-7"/></svg>`,
    loupe: `<svg class="picto" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.6-4.6"/></svg>`,
    croix: `<svg class="picto" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>`,
    gauche: `<svg class="picto" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>`,
    plus: `<svg class="picto" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`,
    lien: `<svg class="picto" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M17 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h4"/></svg>`,
    coche: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>`,
    rate: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>`,
  };

  // Symboles d'entretien, dessinés dans un carré de 48 × 48 : "bac:30", "bac:40:1", "bac:main", "fer:2", "rond:P"…
  function symboleSVG(spec) {
    const [forme, a, b] = String(spec).split(":");
    const X = `<path d="M8 10 40 42M40 10 8 42"/>`;
    const point = (x, y) => `<circle cx="${x}" cy="${y}" r="1.9" fill="currentColor" stroke="none"/>`;
    const lettre = (s, y, taille) => `<text x="24" y="${y}" text-anchor="middle" font-size="${taille}" font-family="IBM Plex Mono, ui-monospace, monospace" font-weight="600" fill="currentColor" stroke="none">${esc(s)}</text>`;
    let c = "";
    if (forme === "bac") {
      c = `<path d="M6 17 10.5 39h27L42 17"/><path d="M6 17c2-2.6 4-2.6 6 0s4 2.6 6 0 4-2.6 6 0 4 2.6 6 0 4-2.6 6 0 4 2.6 6 0"/>`;
      if (a === "main") c += `<path d="M17 33v-8M20.4 32V22M23.8 32v-10.5M27.2 32v-8.5M17 33c1.6 3 4.4 4 7.4 3.4 2.6-.6 4.3-2.3 5.4-5.2l2.6-4.4"/>`;
      else if (a === "barre") c += X;
      else c += lettre(a, 33.5, 11);
      if (b === "1") c += `<path d="M10 44h28"/>`;
      if (b === "2") c += `<path d="M10 43h28M10 46.6h28"/>`;
    } else if (forme === "triangle") c = `<path d="M24 8 42 38H6z"/>` + (a === "barre" ? X : "");
    else if (forme === "carre-rond") c = `<path d="M8 8h32v32H8z"/><circle cx="24" cy="24" r="11"/>` + (a === "barre" ? X : a === "1" ? point(24, 24) : point(20.5, 24) + point(27.5, 24));
    else if (forme === "carre") c = `<path d="M8 8h32v32H8z"/>` + (a === "plat" ? `<path d="M14 24h20"/>` : `<path d="M8 9.5Q24 26 40 9.5"/>`);
    else if (forme === "fer") c = `<path d="M6 35l5-13c.7-2 2.2-3 4.5-3H38c1.9 0 3 1.3 3 3.5V35z"/><path d="M18 19c1-4.2 3.6-6 7.5-6H36c1.8 0 3 1.2 3 3v3"/>` + (a === "barre" ? X : a === "1" ? point(25, 28.5) : point(21, 28.5) + point(29, 28.5));
    else if (forme === "rond") c = `<circle cx="24" cy="24" r="15"/>` + (a === "barre" ? X : lettre(a, 29, 14));
    return `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${c}</svg>`;
  }

  // ---------- vocabulaire du rayon ----------
  const CATEGORIES = [
    { id: "t-shirts", nom: "T-shirts", un: "un t-shirt", type: "haut" },
    { id: "polos", nom: "Polos", un: "un polo", type: "haut" },
    { id: "chemises", nom: "Chemises", un: "une chemise", type: "haut" },
    { id: "pulls", nom: "Pulls et gilets", un: "un pull", type: "haut" },
    { id: "sweats", nom: "Sweats et hoodies", un: "un sweat", type: "haut" },
    { id: "vestes", nom: "Vestes et blousons", un: "une veste", type: "dessus" },
    { id: "manteaux", nom: "Manteaux et parkas", un: "un manteau", type: "dessus" },
    { id: "jeans", nom: "Jeans", un: "un jean", type: "bas" },
    { id: "pantalons", nom: "Pantalons et chinos", un: "un pantalon", type: "bas" },
    { id: "shorts", nom: "Shorts et bermudas", un: "un short", type: "bas" },
    { id: "joggings", nom: "Joggings", un: "un jogging", type: "bas" },
    { id: "sous-vetements", nom: "Sous-vêtements et chaussettes", un: "un sous-vêtement", type: "autre" },
    { id: "chaussures", nom: "Chaussures", un: "une paire de chaussures", type: "pieds" },
    { id: "accessoires", nom: "Accessoires", un: "un accessoire", type: "accessoire" },
  ];
  const CAT = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
  // Catégories du catalogue Rayon Homme, regroupées ici.
  const ANCIENNES = { baskets: "chaussures", boots: "chaussures", "chaussures-ville": "chaussures", sandales: "chaussures", ceintures: "accessoires",
    casquettes: "accessoires", echarpes: "accessoires", sacs: "accessoires", "autres-accessoires": "accessoires" };
  const GROUPE = type => type === "bas" ? "bas" : (type === "haut" || type === "dessus") ? "hauts" : null;
  const NOM_GROUPE = { bas: "un jean ou un pantalon", hauts: "un haut" };
  const FIBRE = COMPO.FIBRE, FAMILLES = SAV.familles;
  const COUPES = SAV.coupes, COLS = SAV.coupes.cols;
  const SYMBOLE = Object.fromEntries(SAV.symboles.map(s => [s.id, s]));
  const MANCHES = ["Longues", "Courtes", "Sans manches", "Trois-quarts"];
  const TAILLANT = { petit: "Taille petit", normal: "Taille normalement", grand: "Taille grand" };
  function indexAlias(liste) {
    const l = [];
    for (const e of liste) for (const a of [e.nom, ...(e.alias || [])]) l.push([clef(a), e]);
    return l.sort((x, y) => y[0].length - x[0].length);
  }
  const IDX = { bas: indexAlias(COUPES.bas), hauts: indexAlias(COUPES.hauts), cols: indexAlias(COLS) };
  // « Fuselé (taper) », « Slim, taille élastique » ou « 1/4 zip » : retrouve l'entrée du lexique.
  function trouver(index, valeur) {
    const v = clef(valeur);
    if (!v) return null;
    for (const [a, e] of index) if (v === a) return e;
    for (const [a, e] of index) if (a.length >= 3 && (" " + v + " ").includes(" " + a + " ")) return e;
    return null;
  }
  const FEMININ = ["laine", "merinos", "viscose"];
  const voyelle = n => /^[aeiouyéèêh]/.test(n);
  const nomF = id => FIBRE[id].nom.toLowerCase();
  const partitif = id => id === "plume" ? "des plumes" : voyelle(nomF(id)) ? "de l'" + nomF(id) : (FEMININ.includes(id) ? "de la " : "du ") + nomF(id);
  const negatif = id => id === "plume" ? "de plumes" : voyelle(nomF(id)) ? "d'" + nomF(id) : "de " + nomF(id);
  const defini = id => id === "plume" ? "les plumes" : voyelle(nomF(id)) ? "l'" + nomF(id) : (FEMININ.includes(id) ? "la " : "le ") + nomF(id);

  // ---------- état ----------
  const S = { articles: {}, charge: false, progres: null };
  const C = { mode: "attente", db: null, user: null, assets: null, sample: null, downloads: null, moi: null, peutEcrire: true,
    sampleImages: false, maxImages: 0, files: new Map(), progresRecu: false };
  const V = { page: "accueil", fiche: null, retour: "articles", photoFiche: 0, filtres: { q: "", cat: "", marque: "", manque: false }, tri: "nom",
    matTab: "fibres", matQ: "", matFocus: null, couche: null, armeSupprFiche: false, armeReset: false };
  let F = null, Q = null;
  const CLE_LOCAL = "par-coeur:articles";
  const cleProgres = () => "par-coeur:progres:" + (C.moi || "local");

  // ---------- articles ----------
  const CHAMPS = ["marque", "nom", "categorie", "couleur", "ref", "prix", "lien", "coupe", "encolure", "manches", "taillant",
    "composition", "entretien", "description", "points", "aRetenir", "photos", "creeLe", "modifieLe"];
  function lireArticle(id, v) {
    v = v && typeof v === "object" ? v : {};
    let cat = texte(v.categorie, 40);
    cat = CAT[cat] ? cat : ANCIENNES[cat] || "";
    const a = {
      id, marque: texte(v.marque, 60), nom: texte(v.nom, 120), categorie: cat, couleur: texte(v.couleur, 60), ref: texte(v.ref, 80),
      prix: typeof v.prix === "number" && isFinite(v.prix) && v.prix >= 0 ? arrondi(v.prix) : null,
      lien: /^https?:\/\//i.test(texte(v.lien, 800)) ? texte(v.lien, 800) : "",
      coupe: texte(v.coupe, 60), encolure: texte(v.encolure, 60), manches: texte(v.manches, 40),
      taillant: TAILLANT[v.taillant] ? v.taillant : "",
      composition: texte(v.composition, 400), entretien: texte(v.entretien, 300), description: texte(v.description, 1500),
      points: listeTextes(v.points, 8, 260), aRetenir: texte(v.aRetenir, 300),
      photos: listeTextes(v.photos, 12, 300).filter(p => /^asset:[A-Za-z0-9_-]{8,64}$/.test(p) || /^images\/[\w.-]+$/.test(p)),
      creeLe: texte(v.creeLe, 40), modifieLe: texte(v.modifieLe, 40),
    };
    deriver(a);
    return a;
  }
  function deriver(a) {
    a._lu = COMPO.lire(a.composition);
    a._princ = COMPO.principale(a._lu);
    a._compoTexte = a._princ ? COMPO.formaterFibres(a._princ.fibres) : "";
    a._modele = clef(a.marque) + "|" + clef(a.nom);
    a._type = CAT[a.categorie]?.type || "";
    a._groupe = GROUPE(a._type);
    a._coupe = a._groupe ? trouver(IDX[a._groupe], a.coupe) : null;
    a._col = a._groupe === "hauts" ? trouver(IDX.cols, a.encolure) : null;
  }
  function serialiser(a) { const o = {}; for (const k of CHAMPS) o[k] = Array.isArray(a[k]) ? [...a[k]] : a[k]; return o; }
  const titre = a => [a.marque, a.nom].filter(Boolean).join(" ") || "Article sans nom";
  const titreCouleur = a => titre(a) + (a.couleur ? " · " + a.couleur : "");
  const photoSrc = ref => ref.startsWith("asset:") ? "/_blob/" + ref.slice(6) : ref;
  const sansPhoto = (txt = "Pas de photo") => `<span class="sans-photo">${t(txt)}</span>`;
  const img = (a, cls = "", alt = "") => a.photos.length
    ? `<img src="${esc(photoSrc(a.photos[0]))}" alt="${esc(alt)}" loading="lazy" decoding="async"${cls ? ` class="${cls}"` : ""}>` : sansPhoto();
  function manques(a) {
    const m = [];
    if (!a._princ) m.push("composition");
    if (a._groupe && !a._coupe) m.push("coupe");
    if (a._groupe === "hauts" && !a._col) m.push("col");
    if (!a.photos.length) m.push("photo");
    return m;
  }
  const quizzable = a => !!(a._princ || a._coupe || a._col);

  let _idx = null;
  const invalider = () => { _idx = null; };
  function idx() {
    if (_idx) return _idx;
    const liste = Object.values(S.articles).sort((x, y) => (clef(x.marque) + " " + clef(x.nom) + " " + clef(x.couleur)).localeCompare(clef(y.marque) + " " + clef(y.nom) + " " + clef(y.couleur), "fr"));
    const parModele = {};
    for (const a of liste) (parModele[a._modele] ||= []).push(a);
    const recherche = Object.fromEntries(liste.map(a => [a.id, clef([a.marque, a.nom, a.couleur, a.ref, CAT[a.categorie]?.nom, a.coupe, a.encolure, a._compoTexte].join(" "))]));
    const marques = unique(liste.map(a => a.marque).filter(Boolean)).sort((x, y) => x.localeCompare(y, "fr"));
    const avecFibre = {};
    for (const a of liste) for (const f of (a._princ?.fibres || [])) if (!(avecFibre[f.id] ||= []).includes(a)) avecFibre[f.id].push(a);
    return _idx = { liste, parModele, recherche, marques, avecFibre };
  }
  const freres = a => (idx().parModele[a._modele] || []).filter(x => x.id !== a.id);

  // ---------- écritures dans la base ----------
  // Une écriture à la fois par document, dans l'ordre des gestes ; une coupure passagère est retentée une fois.
  function ecrireBrut(chemin, corps) {
    const faire = () => (corps ? C.db.doc(chemin).set(corps) : C.db.doc(chemin).delete());
    const avant = C.files.get(chemin) || Promise.resolve();
    const suite = avant.catch(() => {}).then(faire)
      .catch(e => { if (e && e.code === "unavailable") return attendre(400 + Math.random() * 800).then(faire); throw e; });
    C.files.set(chemin, suite.catch(() => {}));
    return suite;
  }
  function enregistrerLocal() {
    ecrireStockage(CLE_LOCAL, Object.fromEntries(Object.values(S.articles).map(a => [a.id, serialiser(a)])));
  }
  function ecrire(chemin, corps) {
    if (C.mode === "local") { enregistrerLocal(); return Promise.resolve(true); }
    if (C.mode !== "distant") { toast("Connexion en cours : réessaie dans un instant."); return Promise.resolve(false); }
    return ecrireBrut(chemin, corps).then(() => true, e => { erreurEcriture(e); return false; });
  }
  // Beaucoup d'écritures d'un coup (coloris, restauration) : l'une après l'autre, en ralentissant si la base le demande.
  async function ecrireTout(ops, progression) {
    if (C.mode === "local") { enregistrerLocal(); if (progression) progression(ops.length, ops.length); return { ok: ops.length, echecs: 0 }; }
    let ok = 0, echecs = 0;
    for (let i = 0; i < ops.length; i++) {
      for (let essai = 0; ; essai++) {
        try { await ecrireBrut(ops[i][0], ops[i][1]); ok++; break; }
        catch (e) {
          const code = e && e.code;
          if ((code === "resource_exhausted" || code === "unavailable") && essai < 4) { await attendre(700 * (essai + 1)); continue; }
          echecs++;
          if (["invalid_argument", "not_granted", "quota_exceeded", "revoked"].includes(code)) { erreurEcriture(e); return { ok, echecs: echecs + ops.length - i - 1 }; }
          break;
        }
      }
      if (progression) progression(i + 1, ops.length);
    }
    return { ok, echecs };
  }
  function erreurEcriture(e) {
    const code = e && e.code;
    if (code === "invalid_argument" || code === "not_granted") {
      C.peutEcrire = false; planifier();
      toast("Tu peux réviser ces articles, mais pas les modifier.");
    } else if (code === "quota_exceeded") toast("La base de la page est pleine : supprime des articles.");
    else toast("Pas enregistré. Vérifie ta connexion et réessaie.");
  }

  // ---------- progression (boîtes de révision) ----------
  // Boîte 0 : à revoir aujourd'hui ; chaque bonne réponse le jour prévu fait monter d'une boîte et espace la révision.
  const INTERVALLES = [0, 1, 3, 7, 14, 30];
  const progresVide = () => ({ v: 1, items: {}, jours: {}, records: {} });
  function lireProgres(v) {
    const p = progresVide();
    if (!v || typeof v !== "object") return p;
    const ent = x => Math.round(Number(x) || 0);
    if (v.items && typeof v.items === "object") for (const [k, it] of Object.entries(v.items)) {
      if (!it || typeof it !== "object" || k.length > 220) continue;
      const n = Math.max(0, ent(it.n));
      p.items[k] = { b: Math.max(0, Math.min(5, ent(it.b))), d: ent(it.d), n, ok: Math.max(0, Math.min(n, ent(it.ok))), t: Math.max(0, ent(it.t)) };
    }
    if (v.jours && typeof v.jours === "object") for (const [k, j] of Object.entries(v.jours)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && Array.isArray(j)) p.jours[k] = [Math.max(0, ent(j[0])), Math.max(0, ent(j[1]))];
    }
    if (v.records && typeof v.records === "object") for (const [k, r] of Object.entries(v.records)) if (typeof r === "number" && isFinite(r)) p.records[k] = r;
    return p;
  }
  // Deux appareils : on garde, pour chaque question, la réponse la plus récente.
  function fusionner(a, b) {
    const p = lireProgres(a);
    const q = lireProgres(b);
    for (const [k, it] of Object.entries(q.items)) if (!p.items[k] || it.t > p.items[k].t) p.items[k] = it;
    for (const [k, j] of Object.entries(q.jours)) { const x = p.jours[k]; p.jours[k] = !x || j[0] > x[0] ? j : x; }
    for (const [k, r] of Object.entries(q.records)) p.records[k] = Math.max(p.records[k] || 0, r);
    return p;
  }
  const memeProgres = (a, b) => JSON.stringify(lireProgres(a)) === JSON.stringify(lireProgres(b));
  const item = cle => S.progres.items[cle] || null;
  const estDu = cle => { const it = item(cle); return !it || it.d <= auj(); };
  function etat(cle) {
    const it = item(cle);
    if (!it || !it.n) return "nouveau";
    if (it.b >= 4) return "maitrise";
    if (it.b === 0) return "a-revoir";
    return "en-cours";
  }
  const LIBELLE_ETAT = { nouveau: "Nouveau", "a-revoir": "À revoir", "en-cours": "En cours", maitrise: "Maîtrisé" };
  // resultat : true, false, ou "presque" (carte mémoire à moitié sue : on ne monte pas, on revoit demain).
  function noter(cle, resultat) {
    const p = S.progres, a = auj();
    const ancien = p.items[cle];
    const it = ancien ? { ...ancien } : { b: 0, d: a, n: 0, ok: 0, t: 0 };
    const prevu = !ancien || it.d <= a;
    it.n++;
    if (resultat === true) { it.ok++; if (prevu) { it.b = Math.min(5, it.b + 1); it.d = a + INTERVALLES[it.b]; } }
    else if (resultat === "presque") { if (prevu) it.d = a + 1; }
    else { it.b = 0; it.d = a; }
    it.t = Date.now();
    p.items[cle] = it;
    compterJour(resultat === true);
  }
  function compterJour(juste) {
    const j = jourIso(), p = S.progres;
    const x = p.jours[j] ? [...p.jours[j]] : [0, 0];
    x[0]++; if (juste) x[1]++;
    p.jours[j] = x;
    // On garde un peu plus d'un an d'historique.
    const cles = Object.keys(p.jours).sort();
    while (cles.length > 400) delete p.jours[cles.shift()];
    planifierProgres();
  }
  let minuteurProgres = null;
  function planifierProgres() { clearTimeout(minuteurProgres); minuteurProgres = setTimeout(enregistrerProgres, 1200); }
  function enregistrerProgres() {
    clearTimeout(minuteurProgres); minuteurProgres = null;
    const corps = JSON.parse(JSON.stringify(S.progres));
    ecrireStockage(cleProgres(), corps);
    if (C.mode === "distant" && C.moi) ecrireBrut(`data/users/${C.moi}/progres`, corps).catch(() => { /* reste dans le navigateur */ });
  }
  addEventListener("pagehide", () => { if (minuteurProgres) enregistrerProgres(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && minuteurProgres) enregistrerProgres(); });

  function statistiques() {
    const L = idx().liste.filter(quizzable);
    const a = auj();
    const maitrises = L.filter(x => etat("a:" + x.id) === "maitrise").length;
    let aRevoir = 0;
    for (const [k, it] of Object.entries(S.progres.items)) if (it.n && it.d <= a && (!k.startsWith("a:") || S.articles[k.slice(2)])) aRevoir++;
    let serie = 0;
    for (let n = a - (S.progres.jours[isoDeNum(a)] ? 0 : 1); S.progres.jours[isoDeNum(n)]?.[0] > 0; n--) serie++;
    let q7 = 0, ok7 = 0;
    for (let n = a - 6; n <= a; n++) { const j = S.progres.jours[isoDeNum(n)]; if (j) { q7 += j[0]; ok7 += j[1]; } }
    return { total: L.length, maitrises, aRevoir, serie, q7, reussite7: q7 ? Math.round(ok7 / q7 * 100) : null };
  }

  // ---------- générateurs de questions ----------
  // Une question : {cle, genre: "choix"|"vf"|"saisie"|"carte"|"accroche", type, article?, contexte?, enonce, options?, vrai?,
  //   symbole?, explication, bonneTexte, refaire}. cle : la boîte de révision qu'elle fait avancer.
  const formaterLu = texteCompo => { const p = COMPO.principale(COMPO.lire(texteCompo)); return p ? COMPO.formaterFibres(p.fibres) : ""; };
  const TYPIQUES = {
    jeans: ["100 % coton", "99 % coton, 1 % élasthanne", "98 % coton, 2 % élasthanne", "92 % coton, 6 % polyester, 2 % élasthanne", "80 % coton, 19 % polyester, 1 % élasthanne",
      "70 % coton, 29 % lyocell, 1 % élasthanne", "79 % coton, 20 % polyester, 1 % élastomultiester", "93 % coton, 6 % élastomultiester, 1 % élasthanne"],
    pantalons: ["98 % coton, 2 % élasthanne", "97 % coton, 3 % élasthanne", "65 % polyester, 35 % viscose", "100 % lin", "55 % lin, 45 % coton", "100 % coton", "63 % polyester, 33 % viscose, 4 % élasthanne"],
    shorts: ["100 % coton", "98 % coton, 2 % élasthanne", "55 % lin, 45 % coton", "100 % polyester"],
    joggings: ["80 % coton, 20 % polyester", "100 % coton", "60 % coton, 40 % polyester", "100 % polyester"],
    pulls: ["100 % coton", "100 % laine mérinos", "50 % coton, 50 % acrylique", "70 % coton, 30 % polyamide", "60 % coton, 40 % polyester", "80 % laine, 20 % polyamide",
      "100 % acrylique", "90 % coton, 10 % cachemire", "50 % laine, 50 % acrylique"],
    sweats: ["80 % coton, 20 % polyester", "100 % coton", "60 % coton, 40 % polyester", "70 % coton, 30 % polyester recyclé", "100 % coton bio"],
    "t-shirts": ["100 % coton", "100 % coton bio", "60 % coton, 40 % polyester", "95 % coton, 5 % élasthanne", "50 % coton, 50 % modal"],
    polos: ["100 % coton", "95 % coton, 5 % élasthanne", "65 % coton, 35 % polyester", "100 % coton bio"],
    chemises: ["100 % coton", "97 % coton, 3 % élasthanne", "100 % lin", "55 % lin, 45 % coton", "60 % coton, 40 % polyester"],
    vestes: ["100 % polyamide", "100 % polyester", "100 % coton", "98 % coton, 2 % élasthanne", "100 % cuir"],
    manteaux: ["100 % polyamide", "100 % polyester", "80 % laine, 20 % polyamide", "60 % laine, 40 % polyester"],
    _: ["100 % coton", "100 % polyester", "98 % coton, 2 % élasthanne", "60 % coton, 40 % polyester", "100 % polyamide"],
  };
  const typiques = cat => (TYPIQUES[cat] || TYPIQUES._).map(formaterLu).filter(Boolean);
  const VOISINES = { elasthanne: ["elastomultiester"], elastomultiester: ["elasthanne"], lyocell: ["viscose", "modal", "polyester"], viscose: ["lyocell", "modal", "polyester"],
    modal: ["viscose", "lyocell"], polyester: ["polyamide", "viscose"], polyamide: ["polyester", "elasthanne"], laine: ["acrylique", "polyamide"], acrylique: ["laine", "polyamide"],
    cachemire: ["laine"], merinos: ["laine", "acrylique"], lin: ["coton"], chanvre: ["lin"], coton: ["lin", "polyester"] };
  // Des compositions proches de la bonne, mais fausses : pourcentages décalés, une fibre remplacée, enlevée ou ajoutée.
  function variantes(fibres) {
    const base = fibres.map(f => ({ id: f.id, pct: f.pct, bio: f.bio, recycle: f.recycle }));
    const res = [];
    const copie = () => base.map(f => ({ ...f }));
    if (base.length >= 2) {
      for (const k of [1, 2, 3, 5, 8]) {
        const v = copie();
        const petit = v[v.length - 1];
        if (petit.pct + k < v[0].pct - k) { v[0].pct -= k; petit.pct += k; res.push(v); }
        const w = copie(); const p2 = w[w.length - 1];
        if (p2.pct - k >= 1) { w[0].pct += k; p2.pct -= k; res.push(w); }
      }
      // La plus petite fibre enlevée.
      const sans = copie(); const enleve = sans.pop(); sans[0].pct += enleve.pct; res.push(sans);
    }
    base.forEach((f, i) => {
      if (i === 0 && base.length > 1) return;
      for (const autre of VOISINES[f.id] || []) {
        if (base.some(x => x.id === autre)) continue;
        const v = copie(); v[i] = { id: autre, pct: f.pct }; res.push(v);
      }
    });
    if (!base.some(f => f.id === "elasthanne") && base[0].pct > 3) { const v = copie(); v[0].pct -= 2; v.push({ id: "elasthanne", pct: 2 }); res.push(v); }
    return res.map(v => v.filter(f => f.pct > 0).sort((x, y) => y.pct - x.pct));
  }
  function expliquerCompo(a) {
    const p = a._princ;
    const apports = p.fibres.map(f => `${cap(defini(f.id))} : ${FIBRE[f.id].apporte}.`).join(" ");
    return `${titreCouleur(a)} : ${a._compoTexte}. ${apports}`;
  }
  function genCompo(a) {
    if (!a._princ) return null;
    const juste = a._compoTexte;
    const fausses = [];
    const ajouter = c => { if (c && c !== juste && !fausses.includes(c)) fausses.push(c); };
    const autres = idx().liste.filter(x => x.id !== a.id && x._princ && x._compoTexte !== juste && (x._groupe === a._groupe || !a._groupe));
    const memeModele = autres.filter(x => x._modele === a._modele);
    if (memeModele.length) ajouter(tirer(memeModele)._compoTexte);
    const vars = melanger(variantes(a._princ.fibres).map(COMPO.formaterFibres));
    if (vars.length) ajouter(vars[0]);
    for (const c of [...melanger([...autres.map(x => x._compoTexte), ...typiques(a.categorie)]), ...vars]) { if (fausses.length >= 3) break; ajouter(c); }
    if (fausses.length < 3) return null;
    const options = melanger([{ texte: juste, juste: true }, ...fausses.slice(0, 3).map(x => ({ texte: x, juste: false }))]);
    return { cle: "a:" + a.id, genre: "choix", type: "compo", article: a, enonce: "Quelle est sa composition ?", options, style: "compo",
      explication: expliquerCompo(a), bonneTexte: juste, refaire: () => genCompo(a) };
  }
  const PLAUSIBLES = { bas: ["coton", "elasthanne", "polyester", "lyocell", "viscose", "elastomultiester", "lin", "polyamide"],
    hauts: ["coton", "polyester", "acrylique", "laine", "polyamide", "elasthanne", "viscose", "cachemire", "merinos", "modal", "lin"],
    _: ["coton", "polyester", "elasthanne", "polyamide", "viscose"] };
  function genVF(a, fibreImposee) {
    if (!a._princ) return null;
    const presentes = a._princ.fibres.map(f => f.id);
    let id = fibreImposee, vrai;
    if (id) vrai = presentes.includes(id);
    else {
      vrai = Math.random() < 0.5;
      if (vrai) id = tirer(presentes);
      else { const absentes = PLAUSIBLES[a._groupe || "_"].filter(x => !presentes.includes(x)); if (!absentes.length) return null; id = tirer(absentes); }
    }
    const pct = COMPO.pct(a._princ, id);
    const explication = vrai
      ? `Oui : ${a._compoTexte}. ${cap(defini(id))} lui apporte ${FIBRE[id].apporte}.`
      : `Non : ${a._compoTexte}. Pas ${negatif(id)}.`;
    return { cle: "a:" + a.id, genre: "vf", type: "vf", article: a, enonce: `Il contient ${partitif(id)}.`, vrai, explication,
      bonneTexte: vrai ? "Vrai" : "Faux", refaire: () => genVF(a, id) };
  }
  function genCoupe(a) {
    if (!a._coupe) return null;
    const autres = melanger(COUPES[a._groupe].filter(c => c.nom !== a._coupe.nom)).slice(0, 3);
    if (autres.length < 3) return null;
    const options = melanger([{ texte: a._coupe.nom, juste: true }, ...autres.map(c => ({ texte: c.nom, juste: false }))]);
    const levis = /levi/i.test(a.marque) && a._coupe.levis ? ` Chez Levi's : ${a._coupe.levis}.` : "";
    return { cle: "a:" + a.id, genre: "choix", type: "coupe", article: a, enonce: "Quelle est sa coupe ?", options,
      explication: `${a._coupe.nom} : ${minus(a._coupe.def)}${levis}`, bonneTexte: a._coupe.nom, refaire: () => genCoupe(a) };
  }
  function genCol(a) {
    if (!a._col) return null;
    const autres = melanger(COLS.filter(c => c.id !== a._col.id)).slice(0, 3);
    const options = melanger([{ texte: a._col.nom, juste: true }, ...autres.map(c => ({ texte: c.nom, juste: false }))]);
    return { cle: "a:" + a.id, genre: "choix", type: "col", article: a, enonce: "Comment s'appelle son col ?", options,
      explication: `${a._col.nom} : ${minus(a._col.def)}`, bonneTexte: a._col.nom, refaire: () => genCol(a) };
  }

  // « Lequel… ? » : parmi les coloris d'un même modèle, ou des articles de la même catégorie, un seul répond.
  const optionArticle = (x, juste) => ({ texte: titreCouleur(x), juste, article: x });
  function genLequel(a) {
    if (!a._princ) return null;
    const ensembles = [];
    const coloris = freres(a).filter(x => x._princ);
    if (coloris.length) ensembles.push({ liste: coloris, nom: `ces ${a.nom || "coloris"}` });
    const memeCat = idx().liste.filter(x => x.id !== a.id && x._princ && x.categorie === a.categorie && x._modele !== a._modele);
    if (memeCat.length >= 2) ensembles.push({ liste: [...coloris, ...memeCat], nom: `ces ${(CAT[a.categorie]?.nom || "articles").toLowerCase()}` });
    for (const ens of melanger(ensembles)) {
      const crit = [];
      for (const f of a._princ.fibres) {
        const sans = ens.liste.filter(x => !COMPO.pct(x._princ, f.id));
        if (sans.length) crit.push({ enonce: `Lequel de ${ens.nom} contient ${partitif(f.id)} ?`, autres: sans, pourquoi: `${COMPO.nombre(f.pct)} % ${nomF(f.id)}` });
        const moins = ens.liste.filter(x => COMPO.pct(x._princ, f.id) < f.pct - 0.5);
        if (moins.length && f.pct < 100) crit.push({ enonce: `Lequel de ${ens.nom} a le plus ${negatif(f.id)} ?`, autres: moins, pourquoi: `${COMPO.nombre(f.pct)} % ${nomF(f.id)}`, plus: f.id });
      }
      if (a._princ.fibres.length === 1) {
        const f = a._princ.fibres[0];
        const pasPur = ens.liste.filter(x => x._princ.fibres.length > 1);
        if (pasPur.length) crit.push({ enonce: `Lequel de ${ens.nom} est 100 % ${nomF(f.id)} ?`, autres: pasPur, pourquoi: `100 % ${nomF(f.id)}` });
      }
      // « Le plus de… » n'a de sens que si tous les autres choix en ont moins.
      const valides = crit.filter(c => c.autres.length >= 1);
      if (!valides.length) continue;
      const c = tirer(valides);
      const distracteurs = melanger(c.autres).slice(0, 3);
      if (c.plus) {
        const max = Math.max(...distracteurs.map(x => COMPO.pct(x._princ, c.plus)));
        if (max >= COMPO.pct(a._princ, c.plus)) continue;
      }
      const options = melanger([optionArticle(a, true), ...distracteurs.map(x => optionArticle(x, false))]);
      const detail = distracteurs.map(x => `${x.couleur || titre(x)} : ${x._compoTexte}`).join(" ; ");
      return { cle: "a:" + a.id, genre: "choix", type: "lequel", article: a, contexte: false, enonce: c.enonce, options, style: "article",
        explication: `${titreCouleur(a)} : ${a._compoTexte}. Les autres : ${detail}.`, bonneTexte: titreCouleur(a), refaire: () => genLequel(a) };
    }
    return null;
  }
  // « Le client demande… » : un besoin, et l'article qui y répond le mieux, nettement.
  const pctTot = (p, ids, poids = {}) => ids.reduce((s, id) => s + COMPO.pct(p, id) * (poids[id] ?? 1), 0);
  const BESOINS = [
    { id: "stretch", min: 1, marge: 0.9, score: p => pctTot(p, ["elasthanne", "elastomultiester"], { elastomultiester: 0.6 }),
      demande: un => `Un client veut ${un} avec du stretch, pour être à l'aise toute la journée.`,
      raison: a => `${COMPO.nombre(COMPO.pct(a._princ, "elasthanne") + COMPO.pct(a._princ, "elastomultiester"))} % de fibre élastique. ${cap(defini("elasthanne"))} : ${FIBRE.elasthanne.apporte}.` },
    { id: "naturel", min: 100, marge: 100, score: p => p.fibres.every(f => ["vegetale", "animale"].includes(FIBRE[f.id].famille)) ? 100 : 0,
      demande: un => `Un client veut ${un} uniquement en fibres naturelles.`,
      raison: () => "C'est le seul sans aucune fibre synthétique ni artificielle." },
    { id: "doux", min: 10, marge: 10, score: p => pctTot(p, ["lyocell", "modal", "viscose", "cachemire", "merinos"], { merinos: 0.5 }),
      demande: un => `Un client cherche ${un} au toucher très doux et fluide.`,
      raison: a => { const f = a._princ.fibres.find(x => ["lyocell", "modal", "viscose", "cachemire", "merinos"].includes(x.id)); return f ? `${COMPO.nombre(f.pct)} % ${nomF(f.id)} : ${FIBRE[f.id].apporte}.` : ""; } },
    { id: "tenue", min: 15, marge: 10, score: p => pctTot(p, ["polyester", "polyamide", "elastomultiester"]),
      demande: un => `Un client veut ${un} qui garde sa forme, se froisse peu et sèche vite.`,
      raison: a => `Le plus de fibres synthétiques (${COMPO.nombre(pctTot(a._princ, ["polyester", "polyamide", "elastomultiester"]))} %) : ${FIBRE.polyester.apporte}.` },
    { id: "chaud", min: 20, marge: 20, groupes: ["hauts"], score: p => pctTot(p, ["laine", "merinos", "cachemire", "acrylique", "duvet"], { acrylique: 0.5 }),
      demande: un => `Un client cherche ${un} vraiment chaud pour l'hiver.`,
      raison: a => { const f = a._princ.fibres.find(x => ["laine", "merinos", "cachemire", "acrylique", "duvet"].includes(x.id)); return f ? `${COMPO.nombre(f.pct)} % ${nomF(f.id)} : ${FIBRE[f.id].apporte}.` : ""; } },
    { id: "frais", min: 90, marge: 25, score: p => pctTot(p, ["lin", "chanvre"]) * 2 + pctTot(p, ["coton", "lyocell", "modal", "viscose"]) - 1.5 * pctTot(p, ["polyester", "polyamide", "acrylique"]),
      demande: un => `Un client a toujours chaud : il cherche ${un} frais et respirant.`,
      raison: a => `${a._compoTexte} : des fibres qui respirent, peu ou pas de synthétique.` },
  ];
  function genClient(a) {
    if (!a._princ) return null;
    let pool = idx().liste.filter(x => x.id !== a.id && x._princ && x.categorie === a.categorie);
    let un = CAT[a.categorie]?.un || "un article";
    if (pool.length < 2 && a._groupe) { pool = idx().liste.filter(x => x.id !== a.id && x._princ && x._groupe === a._groupe); un = NOM_GROUPE[a._groupe]; }
    if (pool.length < 2) return null;
    for (const b of melanger(BESOINS)) {
      if (b.groupes && !b.groupes.includes(a._groupe)) continue;
      const s = b.score(a._princ);
      if (s < b.min) continue;
      const moins = pool.filter(x => b.score(x._princ) <= s - b.marge);
      if (moins.length < 2) continue;
      const distracteurs = melanger(moins).slice(0, 3);
      const options = melanger([optionArticle(a, true), ...distracteurs.map(x => optionArticle(x, false))]);
      return { cle: "a:" + a.id, genre: "choix", type: "client", article: a, contexte: false, enonce: b.demande(un) + " Lequel lui proposes-tu ?", options, style: "article",
        explication: `${titreCouleur(a)} : ${a._compoTexte}. ${b.raison(a)}`, bonneTexte: titreCouleur(a), refaire: () => genClient(a) };
    }
    return null;
  }
  const genLequelOuClient = a => Math.random() < 0.5 ? (genClient(a) || genLequel(a)) : (genLequel(a) || genClient(a));
  function genSaisie(a) {
    if (!a._princ) return null;
    return { cle: "a:" + a.id, genre: "saisie", type: "saisie", article: a, enonce: "Écris sa composition de tête.", attendu: a._princ,
      explication: expliquerCompo(a), bonneTexte: a._compoTexte, refaire: () => genSaisie(a) };
  }
  // Même fibres et pourcentages à 1 point près : juste. Mêmes fibres, pourcentages proches : presque.
  function corrigerSaisie(q, valeur) {
    const lu = COMPO.lire(valeur, { sansPourcent: true });
    const p = COMPO.principale(lu);
    const attendu = {};
    for (const f of q.attendu.fibres) attendu[f.id] = (attendu[f.id] || 0) + f.pct;
    const donne = {};
    for (const f of (p ? p.fibres : [])) donne[f.id] = (donne[f.id] || 0) + f.pct;
    const ids = unique([...Object.keys(attendu), ...Object.keys(donne)]);
    const memes = ids.every(id => attendu[id] && donne[id]);
    const ecart = memes ? Math.max(...ids.map(id => Math.abs(attendu[id] - donne[id]))) : 99;
    const resultat = memes && ecart <= 1 ? true : memes && ecart <= 5 ? "presque" : false;
    return { resultat, lu: p ? COMPO.formaterFibres(p.fibres) : "", manquantes: Object.keys(attendu).filter(id => !donne[id]), enTrop: Object.keys(donne).filter(id => !attendu[id]) };
  }
  function genCarte(a) {
    if (!quizzable(a)) return null;
    return { cle: "a:" + a.id, genre: "carte", type: "carte", article: a, enonce: "Récite tout ce que tu sais : composition, coupe, col, un argument.", refaire: () => genCarte(a) };
  }
  const SITUATIONS = [
    "Il tient l'article devant lui, face au miroir.",
    "Il tâte la matière entre ses doigts.",
    "Il soulève la pile pour chercher sa taille.",
    "Il hésite entre deux coloris de cet article.",
    "Il retourne l'étiquette de composition.",
    "Il regarde le prix sur l'étiquette, puis repose l'article.",
    "Sa compagne lui montre l'article : « Ça t'irait bien. » Lui ne dit rien.",
    "Il est revenu deux fois devant cet article.",
  ];
  function genAccroche(a) {
    if (!C.sample) return null;
    return { genre: "accroche", type: "accroche", article: a, situation: tirer(SITUATIONS), enonce: "Ta première phrase au client ?", refaire: () => genAccroche(a) };
  }

  // ---------- questions de base (sans tes articles) ----------
  const PROCHES = [["viscose", "modal", "lyocell"], ["elasthanne", "elastomultiester"], ["laine", "merinos", "cachemire", "acrylique"], ["duvet", "plume"], ["lin", "chanvre"], ["cuir", "polyurethane"], ["polyester", "polyamide"]];
  const proches = (x, y) => x === y || PROCHES.some(g => g.includes(x) && g.includes(y));
  const CIBLES = { chaleur: ["laine", "merinos", "cachemire"], respire: ["lin", "coton", "chanvre", "laine", "merinos"], stretch: ["elasthanne"],
    infroissable: ["polyester", "polyamide", "laine"], solidite: ["polyamide", "polyester", "lin", "chanvre"] };
  const COURANTES = ["coton", "lin", "chanvre", "laine", "merinos", "cachemire", "viscose", "modal", "lyocell", "polyester", "polyamide", "acrylique", "elasthanne"];
  const CRITERE = Object.fromEntries(SAV.criteres.map(c => [c.id, c]));
  function choixBase(cle, theme, enonce, bonne, fausses, explication, extra = {}) {
    if (fausses.length < 3) return null;
    const options = melanger([{ texte: bonne, juste: true }, ...fausses.slice(0, 3).map(x => ({ texte: x, juste: false }))]);
    return { cle, genre: "choix", type: "base", theme, enonce, options, explication, bonneTexte: bonne, ...extra };
  }
  function baseStatique(q) {
    const extra = { symbole: q.symbole };
    if (q.type === "vf") return { cle: "b:" + q.id, genre: "vf", type: "base", theme: q.theme, enonce: q.q, vrai: q.vrai, explication: q.pourquoi, bonneTexte: q.vrai ? "Vrai" : "Faux", ...extra };
    return choixBase("b:" + q.id, q.theme, q.q, q.bonne, melanger(q.fausses), q.pourquoi, extra);
  }
  // Chaque élément : {cle, theme, fabriquer}. La question est fabriquée au moment de la poser (options mélangées).
  const ELEMENTS_BASE = (() => {
    const l = [];
    for (const q of SAV.questions) l.push({ cle: "b:" + q.id, theme: q.theme, fabriquer: () => baseStatique(q) });
    for (const f of SAV.fibres) {
      if (f.id === "plume") continue;
      l.push({ cle: "g:famille:" + f.id, theme: "fibres", fabriquer: () => {
        const fam = FAMILLES[f.famille];
        const options = melanger(Object.entries(FAMILLES).map(([k, x]) => ({ texte: x.nom, juste: k === f.famille })));
        return { cle: "g:famille:" + f.id, genre: "choix", type: "base", theme: "fibres", enonce: `À quelle famille appartient ${defini(f.id)} ?`, options,
          explication: `${cap(defini(f.id))} est une fibre ${fam.court} : ${f.origine.charAt(0).toLowerCase() + f.origine.slice(1)}. ${fam.explication}`, bonneTexte: fam.nom };
      } });
      l.push({ cle: "g:origine:" + f.id, theme: "fibres", fabriquer: () => {
        const parSource = {};
        for (const x of melanger(SAV.fibres.filter(x => x.source !== f.source && x.id !== "plume"))) parSource[x.source] ||= x.origine;
        return choixBase("g:origine:" + f.id, "fibres", `D'où vient ${defini(f.id)} ?`, f.origine, melanger(Object.values(parSource)), `${f.origine}. ${f.enBref}`);
      } });
      l.push({ cle: "g:apport:" + f.id, theme: "fibres", fabriquer: () => {
        const autres = melanger(SAV.fibres.filter(x => !proches(x.id, f.id))).map(x => x.apporte);
        return choixBase("g:apport:" + f.id, "fibres", `Dans un mélange, que t'apporte surtout ${defini(f.id)} ?`, f.apporte, unique(autres), `${cap(defini(f.id))} : ${minus(f.enBref)} ${f.aDire ? "À dire : « " + f.aDire + " »" : ""}`);
      } });
    }
    for (const [crit, cibles] of Object.entries(CIBLES)) for (const id of cibles) {
      l.push({ cle: `g:critere:${crit}:${id}`, theme: "fibres", fabriquer: () => {
        const autres = melanger(COURANTES.filter(x => x !== id && FIBRE[x].notes[crit] === 1 && !proches(x, id))).map(x => FIBRE[x].nom);
        return choixBase(`g:critere:${crit}:${id}`, "fibres", `Laquelle de ces matières est ${CRITERE[crit].plus} ?`, FIBRE[id].nom, autres,
          `${FIBRE[id].nom} : ${minus(FIBRE[id].enBref)}`);
      } });
    }
    for (const g of ["bas", "hauts"]) for (const c of COUPES[g]) {
      l.push({ cle: "g:coupe:" + c.id, theme: "coupes", fabriquer: () => {
        const autres = melanger(COUPES[g].filter(x => x.nom !== c.nom)).map(x => x.nom);
        return choixBase("g:coupe:" + c.id, "coupes", `${g === "bas" ? "Pour un jean ou un pantalon" : "Pour un haut"}, quelle coupe correspond à : « ${c.def} » ?`, c.nom, autres,
          `${c.nom}${c.levis ? " (Levi's " + c.levis + ")" : ""}. À dire : « ${c.aDire} »`);
      } });
    }
    for (const c of COLS) l.push({ cle: "g:col:" + c.id, theme: "coupes", fabriquer: () => {
      const autres = melanger(COLS.filter(x => x.id !== c.id)).map(x => x.nom);
      return choixBase("g:col:" + c.id, "coupes", `Quel col correspond à : « ${c.def} » ?`, c.nom, autres, `${c.nom}. À dire : « ${c.aDire} »`);
    } });
    for (const n of SAV.levis.filter(x => !SAV.questions.some(q => q.id === "levis-" + x.num))) l.push({ cle: "g:levis:" + n.num, theme: "coupes", fabriquer: () => {
      const autres = melanger(SAV.levis.filter(x => x.num !== n.num)).map(x => x.def);
      return choixBase("g:levis:" + n.num, "coupes", `Le Levi's ${n.num}, c'est…`, n.def, autres, `${n.num} ${n.nom} : ${minus(n.def)}`);
    } });
    for (const x of SAV.tissus.filter(x => !["jauge", "deperlant", "garnissage"].includes(x.id))) l.push({ cle: "g:tissu:" + x.id, theme: "tissus", fabriquer: () => {
      const autres = melanger(SAV.tissus.filter(y => y.id !== x.id && !["jauge", "deperlant", "garnissage"].includes(y.id))).map(y => y.nom);
      return choixBase("g:tissu:" + x.id, "tissus", `De quel tissu ou de quelle maille s'agit-il ? « ${x.enBref} »`, x.nom, autres, `${x.nom} : ${minus(x.reconnaitre)} Usages : ${minus(x.usages)}`);
    } });
    const conv = SAV.tailles.conversion;
    conv.forEach(([w, fr], i) => l.push({ cle: "g:taille:" + w, theme: "tailles", fabriquer: () => {
      const voisins = conv.filter((_, j) => j !== i).sort((x, y) => Math.abs(conv.indexOf(x) - i) - Math.abs(conv.indexOf(y) - i)).slice(0, 5).map(x => x[1]);
      return choixBase("g:taille:" + w, "tailles", `Un ${w} correspond environ à quelle taille française ?`, fr, melanger(voisins), `${w} → ${fr}. ${SAV.tailles.regle}`);
    } }));
    const dejaPoses = new Set(SAV.questions.map(q => q.symbole).filter(Boolean));
    for (const s of SAV.symboles.filter(s => !dejaPoses.has(s.id))) l.push({ cle: "g:symbole:" + s.id, theme: "entretien", fabriquer: () => {
      const memes = melanger(SAV.symboles.filter(x => x.id !== s.id && x.groupe === s.groupe));
      const autres = melanger(SAV.symboles.filter(x => x.groupe !== s.groupe));
      return choixBase("g:symbole:" + s.id, "entretien", "Que veut dire ce symbole ?", s.nom, unique([...memes, ...autres].map(x => x.nom)), `${s.groupe} : ${minus(s.nom)}.`, { symbole: s.id });
    } });
    return l;
  })();
  const THEMES = [{ id: "fibres", nom: "Fibres" }, { id: "tissus", nom: "Tissus et mailles" }, { id: "coupes", nom: "Coupes et cols" }, { id: "tailles", nom: "Tailles" }, { id: "entretien", nom: "Entretien" }];

  // ---------- séries de questions ----------
  // Les articles à revoir d'abord (boîte la plus basse), puis les nouveaux, puis les autres.
  function prioriser(liste, cleDe) {
    const a = auj();
    return liste.map(x => {
      const it = item(cleDe(x));
      const r = Math.random();
      const rang = !it || !it.n ? 1 + r * 0.5 : it.d <= a ? it.b * 0.1 + r * 0.05 : 2 + Math.min(60, it.d - a) * 0.02 + r * 0.01;
      return { x, rang };
    }).sort((p, q) => p.rang - q.rang).map(p => p.x);
  }
  function remplir(candidats, gen, max) {
    const qs = [];
    for (const c of candidats) { if (qs.length >= max) break; const q = gen(c); if (q) qs.push(q); }
    return qs;
  }
  // Une question au hasard parmi celles que l'article permet (la composition revient le plus souvent).
  function questionArticle(a) {
    const choix = [[genCompo, 4], [genVF, 2], [genCoupe, 2], [genCol, 1], [genLequelOuClient, 2]];
    const essais = melanger(choix.flatMap(([g, n]) => Array(n).fill(g)));
    for (const g of unique(essais)) { const q = g(a); if (q) return q; }
    return null;
  }
  const elementsBase = theme => ELEMENTS_BASE.filter(e => !theme || e.theme === theme);
  function serieBase(theme, max) {
    const liste = prioriser(elementsBase(theme), e => e.cle);
    // Pas plus de 4 questions toutes neuves d'affilée dans une série : on mélange l'ordre de départ.
    return remplir(liste, e => e.fabriquer(), max);
  }
  function planSeance() {
    const arts = idx().liste.filter(quizzable);
    const a = auj();
    const vus = arts.filter(x => item("a:" + x.id)?.n);
    const dus = vus.filter(x => item("a:" + x.id).d <= a);
    const nouveaux = arts.filter(x => !item("a:" + x.id)?.n);
    const aRevoir = Math.min(7, dus.length);
    const nbNouveaux = Math.min(4, 7 - aRevoir, nouveaux.length);
    let complement = 0;
    if (arts.length && aRevoir + nbNouveaux < 4) complement = Math.min(4 - aRevoir - nbNouveaux, vus.length - dus.length);
    const articles = aRevoir + nbNouveaux + complement;
    return { aRevoir, nouveaux: nbNouveaux, articles, bases: 10 - articles };
  }
  function seanceDuJour() {
    const plan = planSeance();
    const arts = idx().liste.filter(quizzable);
    const a = auj();
    const ordonnes = prioriser(arts, x => "a:" + x.id);
    const dus = ordonnes.filter(x => item("a:" + x.id)?.n && item("a:" + x.id).d <= a).slice(0, plan.aRevoir);
    const nouveaux = ordonnes.filter(x => !item("a:" + x.id)?.n).slice(0, plan.nouveaux);
    const autres = ordonnes.filter(x => !dus.includes(x) && !nouveaux.includes(x)).slice(0, plan.articles - dus.length - nouveaux.length);
    const qa = remplir([...dus, ...nouveaux, ...autres], questionArticle, plan.articles);
    const qb = serieBase(null, 10 - qa.length);
    // On alterne : deux questions d'articles, une question de base.
    const res = [];
    while (qa.length || qb.length) { if (qa.length) res.push(qa.shift()); if (qa.length) res.push(qa.shift()); if (qb.length) res.push(qb.shift()); }
    return res;
  }
  function serieArticle(a) {
    const qs = [genCompo(a), genVF(a), genCoupe(a), genCol(a), genLequelOuClient(a), genSaisie(a)].filter(Boolean);
    const vf2 = a._princ ? genVF(a) : null;
    if (vf2 && qs.length < 6 && vf2.enonce !== qs.find(q => q.type === "vf")?.enonce) qs.push(vf2);
    return melanger(qs).slice(0, 6);
  }
  function questionSprint() {
    const arts = idx().liste.filter(quizzable);
    for (let i = 0; i < 6; i++) {
      if (arts.length && Math.random() < 0.55) {
        const a = tirer(arts);
        const g = tirer([genCompo, genVF, genCoupe, genCol, genLequelOuClient]);
        const q = g(a);
        if (q) return q;
      } else {
        const e = tirer(ELEMENTS_BASE);
        const q = e.fabriquer();
        if (q) return q;
      }
    }
    return tirer(ELEMENTS_BASE).fabriquer();
  }
  const MODES = [
    { id: "jour", nom: "Séance du jour", desc: "Dix questions choisies pour toi : ce que tu dois revoir aujourd'hui, des nouveaux articles et les bases." },
    { id: "compo", nom: "Composition", desc: "La photo d'un article : trouve sa composition exacte parmi quatre.", besoin: "compo" },
    { id: "vf", nom: "Vrai ou faux", desc: "« Il contient du lyocell. » Vrai ou faux ?", besoin: "compo" },
    { id: "coupe", nom: "Coupes et cols", desc: "Reconnais la coupe et le col de tes articles.", besoin: "coupe" },
    { id: "lequel", nom: "Le bon article", desc: "Un client a une demande, ou plusieurs coloris se ressemblent : choisis le bon.", besoin: "lequel" },
    { id: "saisie", nom: "De tête", desc: "Écris la composition sans aucune aide. Le niveau expert.", besoin: "compo" },
    { id: "cartes", nom: "Cartes mémoire", desc: "Regarde l'article, récite tout ce que tu sais, retourne la carte et note-toi.", besoin: "carte" },
    { id: "bases", nom: "Les bases", desc: "Fibres, tissus, coupes, tailles et entretien : tout ce qu'un vendeur doit savoir, sans tes articles." },
    { id: "sprint", nom: "Sprint 60 secondes", desc: "Le plus de bonnes réponses possible en une minute. Bats ton record." },
    { id: "accroche", nom: "Accroche", desc: "Une situation, un article : écris ta première phrase au client. Claude la note avec ta méthode.", besoin: "accroche" },
  ];
  const MODE = Object.fromEntries(MODES.map(m => [m.id, m]));
  function construireSerie(mode, opts = {}) {
    const L = idx().liste;
    const tri = l => prioriser(l, x => "a:" + x.id);
    switch (mode) {
      case "jour": return seanceDuJour();
      case "compo": return remplir(tri(L.filter(x => x._princ)), genCompo, 10);
      case "vf": {
        const l = tri(L.filter(x => x._princ));
        const qs = remplir(l, genVF, 10);
        if (qs.length < 10 && l.length) for (const a of melanger(l)) { if (qs.length >= 10 || qs.length >= l.length * 2) break; const q = genVF(a); if (q && !qs.some(x => x.article === a && x.enonce === q.enonce)) qs.push(q); }
        return melanger(qs);
      }
      case "coupe": {
        const qs = remplir(tri(L.filter(x => x._coupe || x._col)), a => (a._coupe && a._col ? tirer([genCoupe, genCol]) : a._coupe ? genCoupe : genCol)(a), 10);
        if (qs.length < 6) qs.push(...serieBase("coupes", 10 - qs.length));
        return qs;
      }
      case "lequel": return remplir(tri(L.filter(x => x._princ)), genLequelOuClient, 8);
      case "saisie": return remplir(tri(L.filter(x => x._princ)), genSaisie, 8);
      case "cartes": return remplir(tri(L.filter(quizzable)), genCarte, 15);
      case "bases": return serieBase(opts.theme || null, 10);
      case "sprint": return [questionSprint()];
      case "accroche": return remplir(melanger(L.filter(x => x._princ || x._coupe || x.points.length)), genAccroche, 5);
      case "article": { const a = S.articles[opts.id]; return a ? serieArticle(a) : []; }
      case "erreurs": return (opts.questions || []).map(q => (q.refaire ? q.refaire() : null) || q).filter(Boolean);
      default: return [];
    }
  }
  function disponibles(mode) {
    const L = idx().liste;
    switch (mode) {
      case "jour": case "bases": case "sprint": return Infinity;
      case "compo": case "vf": case "saisie": return L.filter(x => x._princ).length;
      case "coupe": return L.filter(x => x._coupe || x._col).length;
      case "lequel": return L.filter(x => x._princ && (genLequel(x) || genClient(x))).length;
      case "cartes": return L.filter(quizzable).length;
      case "accroche": return C.sample ? L.filter(x => x._princ || x._coupe || x.points.length).length : 0;
      default: return 0;
    }
  }
  function titreMode(mode, opts) {
    if (mode === "article") { const a = S.articles[opts.id]; return a ? "Réviser : " + (a.nom || titre(a)) : "Réviser"; }
    if (mode === "erreurs") return "Tes erreurs";
    if (mode === "bases" && opts.theme) return THEMES.find(x => x.id === opts.theme)?.nom || "Les bases";
    return MODE[mode]?.nom || "Quiz";
  }
  function messageIndispo(mode) {
    if (mode === "accroche" && !C.sample) return "Claude n'est pas disponible sur cette page.";
    if (mode === "lequel") return "Il faut au moins deux coloris ou trois articles d'une même catégorie avec leur composition.";
    if (mode === "coupe") return "Ajoute la coupe ou le col de tes articles pour ce quiz.";
    return "Ajoute d'abord la composition de quelques articles.";
  }

  // ---------- déroulé d'un quiz ----------
  function demarrerQuiz(mode, opts = {}) {
    const questions = construireSerie(mode, opts);
    if (!questions.length) { toast(messageIndispo(mode)); return; }
    if (Q) arreterQuiz();
    Q = { mode, opts, titre: titreMode(mode, opts), questions, i: 0, reponses: [], etape: "question", retourne: false,
      sprint: mode === "sprint" ? { fin: Date.now() + 60000, score: 0, total: 0 } : null, minuteur: null, avance: null, attente: null, record: false };
    ouvrirCouche("quiz");
    if (Q.sprint) Q.minuteur = setInterval(tictac, 250);
    renderQuiz();
  }
  function arreterQuiz() {
    if (!Q) return;
    clearInterval(Q.minuteur); clearTimeout(Q.avance);
    if (Q.attente) Q.attente.abort();
  }
  function tictac() {
    if (!Q || !Q.sprint) return;
    const reste = Math.max(0, Q.sprint.fin - Date.now());
    const el = $("#qz-chrono");
    if (el) { el.textContent = Math.ceil(reste / 1000) + " s"; el.classList.toggle("fin-proche", reste <= 10000); }
    if (reste <= 0 && Q.etape === "question") finir();
  }
  function repondre(valeur) {
    if (!Q || Q.etape !== "question") return;
    const q = Q.questions[Q.i];
    let juste, detail = null;
    if (q.genre === "choix") juste = !!q.options[valeur]?.juste;
    else if (q.genre === "vf") juste = valeur === q.vrai;
    else if (q.genre === "saisie") { detail = corrigerSaisie(q, valeur); juste = detail.resultat; }
    else if (q.genre === "carte") juste = valeur;
    else return;
    q.reponse = { valeur, juste, detail };
    if (q.cle) noter(q.cle, juste);
    else compterJour(juste === true);
    Q.reponses.push({ q, juste });
    if (Q.sprint) { Q.sprint.total++; if (juste === true) Q.sprint.score++; }
    Q.etape = "retour";
    if (q.genre === "carte") { suivant(); return; }
    renderQuiz();
    if (Q.sprint) { clearTimeout(Q.avance); Q.avance = setTimeout(suivant, juste === true ? 650 : 1600); }
    else $("#qz-suivant")?.focus({ preventScroll: true });
  }
  function suivant() {
    if (!Q) return;
    clearTimeout(Q.avance);
    if (Q.sprint) {
      if (Date.now() >= Q.sprint.fin) { finir(); return; }
      const q = questionSprint();
      if (q) Q.questions.push(q);
    }
    if (Q.i + 1 >= Q.questions.length) { finir(); return; }
    Q.i++; Q.etape = "question"; Q.retourne = false;
    renderQuiz();
    $(".qz-corps button.opt, #qz-saisie, #qz-phrase, #qz-retourner")?.focus({ preventScroll: true });
  }
  function finir() {
    if (!Q) return;
    clearInterval(Q.minuteur); clearTimeout(Q.avance);
    if (Q.sprint) {
      const ancien = S.progres.records.sprint || 0;
      if (Q.sprint.score > ancien) { S.progres.records.sprint = Q.sprint.score; Q.record = ancien > 0 || Q.sprint.score > 0; planifierProgres(); }
    }
    Q.etape = "fin";
    renderQuiz();
    $("#qz-fin-titre")?.focus({ preventScroll: true });
    planifier();
  }

  // Accroche : Claude note la première phrase avec la méthode travaillée (ce que tu vois, ce que tu sais, une question A ou B).
  function ficheTexte(a) {
    return [
      `Article : ${titreCouleur(a)}`, CAT[a.categorie] && `Catégorie : ${CAT[a.categorie].nom}`,
      a._compoTexte && `Composition : ${COMPO.formater(a._lu)}`, a.coupe && `Coupe : ${a.coupe}${a._coupe ? " (" + a._coupe.def + ")" : ""}`,
      a.encolure && `Col : ${a.encolure}`, TAILLANT[a.taillant] && TAILLANT[a.taillant], a.prix != null && `Prix : ${euro(a.prix)}`,
      a.entretien && `Entretien : ${a.entretien}`, a.points.length && `Arguments : ${a.points.join(" / ")}`, a.description && `Description : ${a.description.slice(0, 600)}`,
    ].filter(Boolean).join("\n");
  }
  const PROMPT_ACCROCHE = (a, situation, phrase) => `Tu es coach de vente dans le prêt-à-porter homme. Un vendeur s'entraîne à aborder un client sans qu'il réponde « je regarde ».
Sa méthode, en trois temps :
1. Ce qu'il voit : la phrase répond au geste du client.
2. Ce qu'il sait : une information vraie sur l'article, que le client ne peut pas voir seul (matière, coupe, comment ça taille…).
3. Une seule question, sur le client, de préférence de type « A ou B » (« plutôt ajusté ou à l'aise ? »), à laquelle il ne peut pas répondre « non » ni « je regarde ».
À éviter : « n'hésitez pas », « vous pouvez essayer », « je peux vous aider ? », « vous cherchez quelque chose ? », « je vois que… », plusieurs questions d'affilée, une information inventée ou fausse.

La fiche de l'article :
${ficheTexte(a)}

La situation : ${situation}
La phrase du vendeur : « ${phrase.slice(0, 600)} »

Réponds uniquement avec un objet JSON de cette forme :
{"note": 7, "signal": true, "info": true, "infoExacte": true, "question": "AouB", "plusieursQuestions": false, "aEviter": "", "reponseClient": "", "conseil": "", "exemple": ""}
- note : de 0 à 10.
- signal : la phrase répond-elle au geste du client ?
- info : contient-elle une vraie information sur l'article ?
- infoExacte : true si l'information est conforme à la fiche, false si elle la contredit, null s'il n'y a pas d'information ou si la fiche ne permet pas de vérifier.
- question : "aucune", "fermee" (on peut y répondre non), "ouverte" ou "AouB".
- plusieursQuestions : true si la phrase pose plus d'une question.
- aEviter : la formule à éviter trouvée dans la phrase, mot pour mot, sinon "".
- reponseClient : ce que le client répondrait, en une phrase réaliste.
- conseil : une ou deux phrases, en tutoyant le vendeur, sur ce qu'il doit changer en priorité.
- exemple : une meilleure phrase pour cette situation, fidèle à la fiche (n'invente aucune information).`;
  async function noterAccroche() {
    if (!Q || Q.etape !== "question" || Q.attente || !C.sample) return;
    const q = Q.questions[Q.i];
    const champ = $("#qz-phrase");
    const phrase = (champ?.value || "").trim();
    if (phrase.length < 6) { const m = $("#qz-message"); if (m) m.textContent = "Écris d'abord ta phrase."; champ?.focus(); return; }
    q.phrase = phrase;
    const pourQ = Q, ctl = Q.attente = new AbortController();
    renderQuiz();
    try {
      const r = await C.sample.json(PROMPT_ACCROCHE(q.article, q.situation, phrase), { signal: ctl.signal, cache: false });
      if (Q !== pourQ) return;
      const note = Math.max(0, Math.min(10, Math.round(Number(r?.note))));
      if (!isFinite(note)) throw { code: "invalid_json" };
      q.eval = {
        note, signal: r.signal === true, info: r.info === true, infoExacte: r.infoExacte === true ? true : r.infoExacte === false ? false : null,
        question: ["aucune", "fermee", "ouverte", "AouB"].includes(r.question) ? r.question : "aucune", plusieurs: r.plusieursQuestions === true,
        aEviter: texte(r.aEviter, 120), reponseClient: texte(r.reponseClient, 300), conseil: texte(r.conseil, 500), exemple: texte(r.exemple, 400),
      };
      const juste = note >= 7;
      q.reponse = { valeur: phrase, juste };
      compterJour(juste);
      Q.reponses.push({ q, juste });
      Q.etape = "retour";
    } catch (e) {
      if (Q !== pourQ) return;
      q.erreurClaude = e && e.code === "cancelled" ? "" : messageClaude(e);
    } finally {
      if (Q === pourQ) { Q.attente = null; renderQuiz(); }
    }
  }
  function messageClaude(e) {
    const c = e && e.code;
    if (c === "not_granted" || c === "sampling_disabled" || c === "not_declared") return "Claude n'est pas autorisé pour cette page.";
    if (c === "rate_limited") return "Trop de demandes d'un coup : réessaie dans une minute.";
    if (c === "images_unavailable" || c === "image_rejected" || c === "photo") return "Claude ne peut pas lire cette photo ici.";
    if (c === "invalid_json") return "Claude n'a pas répondu comme prévu : réessaie.";
    if (c === "prompt_too_large") return "Le texte est trop long : colle seulement la partie utile de la fiche.";
    return "Claude n'a pas pu répondre. Réessaie dans un instant.";
  }

  // ---------- rendu ----------
  function remplacer(el, html) {
    const actif = document.activeElement;
    const id = actif && el.contains(actif) && actif.id ? actif.id : null;
    let sel = null;
    if (id && typeof actif.selectionStart === "number") { try { sel = [actif.selectionStart, actif.selectionEnd]; } catch (_) { /* champ sans sélection */ } }
    el.innerHTML = html;
    if (id) {
      const n = document.getElementById(id);
      if (n) { n.focus({ preventScroll: true }); if (sel && typeof n.setSelectionRange === "function") { try { n.setSelectionRange(sel[0], sel[1]); } catch (_) { /* idem */ } } }
    }
  }
  let rafRender = 0;
  function planifier() { if (rafRender) return; rafRender = requestAnimationFrame(() => { rafRender = 0; render(); }); }
  function renderNav() {
    const st = S.charge ? statistiques() : null;
    const onglets = [["accueil", "Accueil"], ["articles", "Articles"], ["quiz", "Quiz"], ["matieres", "Matières"]];
    const actif = V.page === "fiche" ? "articles" : V.page;
    $("#nav").innerHTML = onglets.map(([id, nom]) => `<button type="button" data-nav="${id}"${actif === id ? ' aria-current="page"' : ""}>${ICONE[id]}<span>${nom}</span>${id === "quiz" && st && st.aRevoir ? `<span class="compte" aria-label="${st.aRevoir} à revoir">${st.aRevoir}</span>` : ""}</button>`).join("");
  }
  function render() {
    renderNav();
    const pages = { accueil: pageAccueil, articles: pageArticles, fiche: pageFiche, quiz: pageQuiz, matieres: pageMatieres };
    remplacer($("#page"), (pages[V.page] || pageAccueil)() + piedHTML());
    if (V.matFocus && V.page === "matieres") {
      const cible = document.getElementById("savoir-" + V.matFocus);
      V.matFocus = null;
      if (cible) cible.scrollIntoView({ block: "start" });
    }
  }
  function piedHTML() {
    const etat = C.mode === "local" ? "Ouverte hors de claude.ai : tes articles et ta progression restent sur cet appareil."
      : C.mode === "distant" ? (C.moi ? "Ta progression est enregistrée dans ton espace : elle te suit sur ton téléphone et ton ordinateur." : "Ta progression reste sur cet appareil.")
      : "Connexion…";
    return `<footer class="pied"><span>${t(etat)}</span><span>Un outil d'entraînement personnel, sans lien officiel avec les marques citées.</span></footer>`;
  }
  const chargementHTML = () => `<div class="vide-etat"><p class="sur-titre">Chargement</p><p>Tes articles arrivent…</p></div>`;
  function pastilleEtat(a) { const e = etat("a:" + a.id); return `<span class="pastille ${e}">${LIBELLE_ETAT[e]}</span>`; }
  function etiquetteHTML(a) {
    if (!a._lu.parties.length) return `<div class="etiquette"><span class="vide">Composition à compléter</span></div>`;
    const multi = a._lu.parties.length > 1 || !!a._lu.parties[0].nom;
    let h = "";
    for (const p of a._lu.parties) {
      if (multi) h += `<span class="ligne partie">${t(p.nom || "Tissu")}</span>`;
      for (const f of p.fibres) h += `<span class="ligne">${t(`${COMPO.nombre(f.pct)} % ${COMPO.nomFibre(f)}`)}</span>`;
      for (const x of p.inconnues) h += `<span class="ligne">${t(x)}</span>`;
    }
    return `<div class="etiquette" role="img" aria-label="${esc("Composition : " + COMPO.formater(a._lu))}">${h}</div>`;
  }
  // Ce qu'il faut retenir d'un article : la note du vendeur, sinon la fibre qui le distingue.
  function aRetenir(a) {
    if (a.aRetenir) return a.aRetenir;
    if (!a._princ) return a._coupe ? `${a._coupe.nom} : ${minus(a._coupe.def)}` : "";
    const fibres = a._princ.fibres;
    const speciale = fibres.find(f => f.id !== "coton") || fibres[0];
    return `${COMPO.nombre(speciale.pct)} % ${nomF(speciale.id)} : ${FIBRE[speciale.id].apporte}.`;
  }

  // ---------- page d'accueil ----------
  function articleVedette() {
    const l = prioriser(idx().liste.filter(x => x._princ), x => "a:" + x.id);
    return l[0] || null;
  }
  function grapheHTML() {
    const a = auj();
    const jours = Array.from({ length: 14 }, (_, i) => a - 13 + i);
    const valeurs = jours.map(n => S.progres.jours[isoDeNum(n)] || [0, 0]);
    const max = Math.max(4, ...valeurs.map(v => v[0]));
    const L = 300, H = 96, bas = 76, haut = 14, pas = L / 14, larg = pas * 0.58;
    let barres = "";
    jours.forEach((n, i) => {
      const [q, ok] = valeurs[i];
      const x = i * pas + (pas - larg) / 2;
      const hq = q ? Math.max(2, (bas - haut) * q / max) : 0, hok = ok ? Math.max(2, (bas - haut) * ok / max) : 0;
      barres += `<rect x="${x.toFixed(1)}" y="${(bas - hq).toFixed(1)}" width="${larg.toFixed(1)}" height="${hq.toFixed(1)}" rx="1.5" style="fill:var(--surface-2)"/>`;
      barres += `<rect x="${x.toFixed(1)}" y="${(bas - hok).toFixed(1)}" width="${larg.toFixed(1)}" height="${hok.toFixed(1)}" rx="1.5" style="fill:var(--cuivre)"/>`;
      barres += `<text x="${(i * pas + pas / 2).toFixed(1)}" y="${H - 4}" text-anchor="middle" font-size="9" font-family="IBM Plex Mono, monospace" style="fill:var(--encre-2)">${nomJourCourt(n)}</text>`;
      if (n === a) barres += `<rect x="${(i * pas + 1).toFixed(1)}" y="${haut - 6}" width="${(pas - 2).toFixed(1)}" height="${bas - haut + 8}" rx="3" style="fill:none;stroke:var(--trait)" stroke-dasharray="3 2"/>`;
    });
    const total = valeurs.reduce((s, v) => s + v[0], 0);
    const repere = total ? `<text x="0" y="9" font-size="9" font-family="IBM Plex Mono, monospace" style="fill:var(--encre-2)">${max} questions</text>`
      : `<text x="${L / 2}" y="${(bas + haut) / 2 + 3}" text-anchor="middle" font-size="11" font-family="Schibsted Grotesk, system-ui, sans-serif" style="fill:var(--encre-2)">Tes réponses s'afficheront ici, jour après jour.</text>`;
    return `<div class="graphe"><p class="sur-titre">Tes 14 derniers jours</p>
      <svg viewBox="0 0 ${L} ${H}" role="img" aria-label="${total} réponses en 14 jours"><line x1="0" x2="${L}" y1="${bas + 0.5}" y2="${bas + 0.5}" style="stroke:var(--trait)"/>${barres}${repere}</svg>
      <p class="legende"><span><i style="background: var(--surface-2)"></i>Questions</span><span><i style="background: var(--cuivre)"></i>Bonnes réponses</span></p></div>`;
  }
  function pageAccueil() {
    if (!S.charge) return chargementHTML();
    const L = idx().liste;
    const st = statistiques();
    const plan = planSeance();
    const v = articleVedette();
    const date = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    const morceaux = [];
    if (plan.aRevoir) morceaux.push(pluriel(plan.aRevoir, "article à revoir", "articles à revoir"));
    if (plan.nouveaux) morceaux.push(pluriel(plan.nouveaux, "nouvel article", "nouveaux articles"));
    if (plan.articles - plan.aRevoir - plan.nouveaux > 0) morceaux.push(pluriel(plan.articles - plan.aRevoir - plan.nouveaux, "article déjà vu", "articles déjà vus"));
    if (plan.bases) morceaux.push(pluriel(plan.bases, "question de base", "questions de base"));
    const resume = `10 questions, environ 4 minutes : ${morceaux.join(", ")}.`;
    const vedette = v ? `<figure style="margin:0">${etiquetteHTML(v)}<figcaption class="petit discret" style="margin-top:10px;text-align:center">${t(titreCouleur(v))}</figcaption></figure>`
      : `<div class="etiquette"><span class="ligne partie">Exemple</span><span class="ligne">98 % coton</span><span class="ligne">2 % élasthanne</span></div>`;
    const retenir = v ? `<p class="a-retenir"><b>À retenir :</b> ${t(aRetenir(v))} <button type="button" class="btn btn-discret petit" data-action="fiche" data-id="${esc(v.id)}">Voir la fiche</button></p>`
      : `<p class="a-retenir"><b>Pour commencer :</b> ajoute tes articles avec leur composition. En attendant, la séance porte sur les bases : fibres, tissus, coupes et entretien.</p>`;
    const aCompleter = L.filter(a => manques(a).some(m => m !== "photo"));
    const completer = aCompleter.length ? `<section><div class="titre-section"><h2>Fiches à compléter</h2><button type="button" class="btn btn-discret" data-action="voir-manques">Voir les ${aCompleter.length}</button></div>
      <p class="discret" style="margin-bottom:12px">Sans composition ni coupe, un article n'entre pas dans les quiz. Ouvre le site de la marque, copie la fiche produit : Claude remplit le reste.</p>
      <ul class="liste-completer">${aCompleter.slice(0, 5).map(a => `<li><button type="button" data-action="modifier" data-id="${esc(a.id)}">${a.photos.length ? `<img src="${esc(photoSrc(a.photos[0]))}" alt="" loading="lazy">` : sansPhoto("")}
        <span class="txt"><b>${t(titre(a))}</b><span class="petit discret">${t(a.couleur || "")}${a.couleur ? " · " : ""}il manque : ${t(manques(a).filter(m => m !== "photo").join(", "))}</span></span><span class="pastille alerte">Compléter</span></button></li>`).join("")}</ul></section>` : "";
    const vide = !L.length ? `<section><div class="vide-etat"><h2>Ton rayon est vide</h2><p>Ajoute ton premier article : une photo, le texte de sa fiche sur le site de la marque, et Claude remplit la composition, la coupe et les arguments.</p>
      ${C.peutEcrire ? `<button type="button" class="btn btn-primaire" data-action="ajouter">${ICONE.plus}Ajouter un article</button>` : ""}</div></section>` : "";
    return `<div class="accueil">
      <section class="seance" aria-labelledby="titre-seance">
        <div class="seance-haut">
          <div><p class="sur-titre">${t(cap(date))}</p><h1 id="titre-seance">Ta séance du jour</h1><p class="resume">${t(resume)}</p></div>
          ${vedette}
        </div>
        ${retenir}
        <div class="rangee"><button type="button" class="btn btn-primaire btn-grand" data-action="quiz" data-mode="jour">Commencer la séance</button><button type="button" class="btn" data-nav="quiz">Choisir un autre quiz</button></div>
      </section>
      <aside aria-label="Ta progression">
        <div class="tuiles">
          <div class="tuile"><p class="sur-titre">Maîtrisés</p><p class="valeur">${st.maitrises}<small> / ${st.total}</small></p><p class="detail">articles que tu sais par cœur</p></div>
          <div class="tuile"><p class="sur-titre">À revoir</p><p class="valeur">${st.aRevoir}</p><p class="detail">questions prévues aujourd'hui</p></div>
          <div class="tuile"><p class="sur-titre">Série</p><p class="valeur">${st.serie}<small> ${st.serie > 1 ? "jours" : "jour"}</small></p><p class="detail">de suite avec au moins une question</p></div>
          <div class="tuile"><p class="sur-titre">Réussite</p><p class="valeur">${st.reussite7 == null ? "–" : st.reussite7 + "<small> %</small>"}</p><p class="detail">${st.q7 ? `sur ${pluriel(st.q7, "réponse")} en 7 jours` : "pas encore de réponse cette semaine"}</p></div>
        </div>
        ${grapheHTML()}
      </aside>
    </div>
    ${vide}${completer}
    <section><div class="titre-section"><h2>Réviser un thème</h2></div>
      <div class="rangee">${THEMES.map(x => `<button type="button" class="puce" data-action="quiz" data-mode="bases" data-theme="${x.id}">${t(x.nom)}</button>`).join("")}
      <button type="button" class="puce" data-action="quiz" data-mode="sprint">Sprint 60 secondes${S.progres.records.sprint ? ` · record ${S.progres.records.sprint}` : ""}</button></div></section>`;
  }

  // ---------- page des articles ----------
  function resultatsArticles() {
    const f = V.filtres, q = clef(f.q).split(" ").filter(Boolean);
    let l = idx().liste.filter(a => (!f.cat || a.categorie === f.cat) && (!f.marque || a.marque === f.marque) && (!f.manque || manques(a).length)
      && q.every(m => idx().recherche[a.id].includes(m)));
    if (V.tri === "recent") l = [...l].sort((x, y) => (y.modifieLe || "").localeCompare(x.modifieLe || ""));
    else if (V.tri === "maitrise") { const rang = { "a-revoir": 0, nouveau: 1, "en-cours": 2, maitrise: 3 }; l = [...l].sort((x, y) => rang[etat("a:" + x.id)] - rang[etat("a:" + y.id)]); }
    return l;
  }
  function carteArticle(a) {
    const m = manques(a).filter(x => x !== "photo");
    return `<button type="button" class="carte-article" data-action="fiche" data-id="${esc(a.id)}">
      <span class="visuel">${img(a)}${quizzable(a) ? pastilleEtat(a) : ""}</span>
      <span class="infos"><span class="marque-art">${t(a.marque || CAT[a.categorie]?.nom || "")}</span><span class="nom">${t(a.nom || "Sans nom")}</span><span class="couleur">${t(a.couleur)}</span>
      ${a._compoTexte ? `<span class="etiquette-mini">${t(a._compoTexte)}</span>` : ""}${m.length ? `<span class="manque"><span class="pastille alerte">Manque : ${t(m.join(", "))}</span></span>` : ""}</span></button>`;
  }
  function listeArticlesHTML() {
    const l = resultatsArticles();
    if (!idx().liste.length) return `<div class="vide-etat"><h2>Aucun article pour l'instant</h2><p>Commence par les articles que tu vends le plus. Pour chacun : une photo, et le texte de sa fiche copiée sur le site de la marque.</p>
      ${C.peutEcrire ? `<button type="button" class="btn btn-primaire" data-action="ajouter">${ICONE.plus}Ajouter un article</button>` : ""}</div>`;
    if (!l.length) return `<div class="vide-etat"><p>Aucun article ne correspond.</p><button type="button" class="btn" data-action="effacer-filtres">Tout afficher</button></div>`;
    return `<div class="grille-articles">${l.map(carteArticle).join("")}</div>`;
  }
  function majListe() {
    const el = $("#liste-articles");
    if (el) el.innerHTML = listeArticlesHTML();
    const n = $("#nb-resultats");
    if (n) n.textContent = pluriel(resultatsArticles().length, "article");
  }
  function pageArticles() {
    if (!S.charge) return chargementHTML();
    const L = idx().liste;
    const avecCompo = L.filter(a => a._princ).length;
    const cats = CATEGORIES.filter(c => L.some(a => a.categorie === c.id));
    const nbManques = L.filter(a => manques(a).length).length;
    const f = V.filtres;
    return `<div class="tete-page"><div><p class="sur-titre">Tes articles</p><h1>Le rayon</h1>
      <p>${pluriel(L.length, "article")}, dont ${avecCompo} avec leur composition. Plus une fiche est complète, plus elle revient dans les quiz.</p></div>
      ${C.peutEcrire ? `<button type="button" class="btn btn-primaire" data-action="ajouter">${ICONE.plus}Ajouter un article</button>` : ""}</div>
      <div class="outils">
        <div class="outils-ligne">
          <label class="recherche"><span class="visuellement-cache">Rechercher</span>${ICONE.loupe}<input type="search" id="q-articles" placeholder="Marque, modèle, couleur, matière…" value="${esc(f.q)}" autocomplete="off"></label>
          ${idx().marques.length > 1 ? `<label><span class="visuellement-cache">Marque</span><select id="marque-articles"><option value="">Toutes les marques</option>${idx().marques.map(m => `<option${m === f.marque ? " selected" : ""}>${esc(m)}</option>`).join("")}</select></label>` : ""}
          <label><span class="visuellement-cache">Trier</span><select id="tri-articles"><option value="nom"${V.tri === "nom" ? " selected" : ""}>Par marque et modèle</option><option value="recent"${V.tri === "recent" ? " selected" : ""}>Modifiés récemment</option><option value="maitrise"${V.tri === "maitrise" ? " selected" : ""}>À revoir d'abord</option></select></label>
        </div>
        <div class="defile" role="group" aria-label="Catégories">
          <button type="button" class="puce" data-action="filtre-cat" data-v="" aria-pressed="${!f.cat}">Tout</button>
          ${cats.map(c => `<button type="button" class="puce" data-action="filtre-cat" data-v="${c.id}" aria-pressed="${f.cat === c.id}">${t(c.nom)}</button>`).join("")}
          ${nbManques ? `<button type="button" class="puce" data-action="filtre-manque" aria-pressed="${f.manque}">À compléter · ${nbManques}</button>` : ""}
        </div>
        <p class="petit discret" id="nb-resultats">${pluriel(resultatsArticles().length, "article")}</p>
      </div>
      <div id="liste-articles">${listeArticlesHTML()}</div>
      ${L.length || C.peutEcrire ? `<section class="donnees"><div class="titre-section"><h2>Tes données</h2></div><div class="rangee">
        ${C.downloads && L.length ? `<button type="button" class="btn" data-action="sauvegarder">Sauvegarder mes articles</button><button type="button" class="btn" data-action="exporter">Exporter en tableur</button>` : ""}
        ${C.peutEcrire ? `<label class="btn" for="restaurer-fichier">Restaurer une sauvegarde</label><input type="file" id="restaurer-fichier" accept="application/json,.json" hidden>` : ""}
        <button type="button" class="btn btn-discret${V.armeReset ? " btn-danger arme" : ""}" data-action="reset-progres">${V.armeReset ? "Confirmer : tout remettre à zéro" : "Remettre ma progression à zéro"}</button></div>
        <p class="petit discret" style="margin-top:10px">La sauvegarde garde tes fiches (sans les photos) dans un fichier que tu peux restaurer ici.</p></section>` : ""}`;
  }

  // ---------- fiche d'un article ----------
  function pageFiche() {
    const a = S.articles[V.fiche];
    if (!S.charge) return chargementHTML();
    if (!a) return `<div class="vide-etat"><p>Cet article n'existe plus.</p><button type="button" class="btn" data-nav="articles">Voir les articles</button></div>`;
    const i = Math.min(V.photoFiche, Math.max(0, a.photos.length - 1));
    const it = item("a:" + a.id);
    const e = etat("a:" + a.id);
    const galerie = `<div class="galerie"><div class="principale">${a.photos.length ? `<img src="${esc(photoSrc(a.photos[i]))}" alt="${esc(titreCouleur(a))}">` : sansPhoto()}</div>
      ${a.photos.length > 1 ? `<div class="vignettes">${a.photos.map((p, j) => `<button type="button" data-action="photo-fiche" data-v="${j}" aria-pressed="${j === i}" aria-label="Photo ${j + 1}"><img src="${esc(photoSrc(p))}" alt="" loading="lazy"></button>`).join("")}</div>` : ""}</div>`;
    const infos = [CAT[a.categorie]?.nom, a.couleur, a.ref && "Réf. " + a.ref, a.prix != null && euro(a.prix)].filter(Boolean);
    const apports = a._princ ? `<ul class="apports">${a._princ.fibres.map(f => `<li><span class="pct">${t(COMPO.nombre(f.pct) + " %")}</span><span><button type="button" data-action="voir-fibre" data-v="${f.id}">${t(FIBRE[f.id].nom)}</button> : ${t(FIBRE[f.id].apporte)}</span></li>`).join("")}</ul>` : `<p class="discret">Ajoute la composition pour voir ce que chaque matière apporte.</p>`;
    const defs = [];
    if (a.coupe) defs.push(["Coupe", `${t(a.coupe)}${a._coupe && clef(a._coupe.nom) !== clef(a.coupe) ? ` <span class="discret">(${t(a._coupe.nom)})</span>` : ""}${a._coupe ? `<br><span class="petit discret">${t(a._coupe.def)}</span>` : ""}`]);
    if (a.encolure) defs.push(["Col", `${t(a.encolure)}${a._col ? `<br><span class="petit discret">${t(a._col.def)}</span>` : ""}`]);
    if (a.manches) defs.push(["Manches", t(a.manches)]);
    if (a.taillant) defs.push(["Taille", t(TAILLANT[a.taillant])]);
    if (a.entretien) defs.push(["Entretien", t(a.entretien)]);
    let domaine = "";
    try { domaine = a.lien ? new URL(a.lien).hostname.replace(/^www\./, "") : ""; } catch (_) { domaine = ""; }
    const maitrise = quizzable(a) ? `<div class="maitrise-art"><span class="pastille ${e}">${LIBELLE_ETAT[e]}</span>
      <span class="petit">${it && it.n ? `${pluriel(it.n, "réponse")}, ${pluriel(it.ok, "juste")} · prochaine révision ${quandRevision(it.d)}` : "Pas encore révisé"}</span>
      <button type="button" class="btn btn-primaire" data-action="reviser" data-id="${esc(a.id)}">Réviser cet article</button></div>` : "";
    return `<button type="button" class="btn btn-discret retour" data-action="retour">${ICONE.gauche}Retour</button>
      <div class="fiche">${galerie}
      <div class="fiche-infos">
        <div class="fiche-titre"><p class="sur-titre">${t(a.marque || "Sans marque")}</p><h1>${t(a.nom || "Sans nom")}</h1>
          <p class="ligne-info">${infos.map(x => `<span>${t(x)}</span>`).join("")}</p>
          <div class="rangee">${C.peutEcrire ? `<button type="button" class="btn" data-action="modifier" data-id="${esc(a.id)}">Modifier la fiche</button>` : ""}
          ${a.lien ? `<a class="btn" href="${esc(a.lien)}" target="_blank" rel="noopener">${ICONE.lien}${t(domaine || "Site de la marque")}</a>` : ""}</div></div>
        ${maitrise}
        <div class="duo"><div class="bloc"><h2>Composition</h2>${etiquetteHTML(a)}${a._lu.parties.length && !a._lu.ok ? `<p class="petit" style="color:var(--alerte)">Le total ne fait pas 100 % : vérifie l'étiquette.</p>` : ""}</div>
          <div class="bloc"><h2>Ce que ça apporte</h2>${apports}</div></div>
        ${defs.length ? `<div class="bloc"><h2>Coupe et détails</h2><dl class="infos-def">${defs.map(([k, x]) => `<dt>${t(k)}</dt><dd>${x}</dd>`).join("")}</dl></div>` : ""}
        ${a.aRetenir || a._princ ? `<div class="bloc"><h2>À retenir</h2><p class="citation">${t(aRetenir(a))}</p></div>` : ""}
        ${a.points.length ? `<div class="bloc"><h2>Arguments à dire</h2><ul class="liste-points">${a.points.map(p => `<li>${t(p)}</li>`).join("")}</ul></div>` : ""}
        ${a.description ? `<div class="bloc"><h2>Description</h2><p>${t(a.description)}</p></div>` : ""}
        ${C.peutEcrire ? `<div class="rangee"><button type="button" class="btn btn-danger${V.armeSupprFiche ? " arme" : ""}" data-action="supprimer-fiche" data-id="${esc(a.id)}">${V.armeSupprFiche ? "Confirmer la suppression" : "Supprimer l'article"}</button></div>` : ""}
      </div></div>`;
  }

  // ---------- page des quiz ----------
  function pageQuiz() {
    if (!S.charge) return chargementHTML();
    const st = statistiques();
    const plan = planSeance();
    const cartes = MODES.filter(m => m.id !== "jour").map(m => {
      const n = disponibles(m.id);
      const ok = n > 0;
      const info = m.id === "sprint" ? (S.progres.records.sprint ? `Record : ${S.progres.records.sprint} bonnes réponses` : "Pas encore de record")
        : m.id === "bases" ? `${ELEMENTS_BASE.length} questions` : m.id === "accroche" && !C.sample ? "Claude indisponible ici"
        : ok ? `${pluriel(n, "article")} prêt${n > 1 ? "s" : ""}` : m.id === "lequel" ? "Il faut plus d'articles complets" : "Ajoute des compositions";
      if (m.id === "bases") return `<div class="carte-mode large"><span class="titre-mode">${t(m.nom)}</span><span class="desc-mode">${t(m.desc)}</span>
        <span class="themes">${THEMES.map(x => `<button type="button" class="puce" data-action="quiz" data-mode="bases" data-theme="${x.id}">${t(x.nom)}</button>`).join("")}</span>
        <span class="pied-mode"><button type="button" class="btn btn-primaire" data-action="quiz" data-mode="bases">Tout mélanger</button><span>${t(info)}</span></span></div>`;
      return `<button type="button" class="carte-mode${["sprint", "accroche"].includes(m.id) ? " large" : ""}" data-action="quiz" data-mode="${m.id}"${ok ? "" : " disabled"}><span class="titre-mode">${t(m.nom)}</span><span class="desc-mode">${t(m.desc)}</span><span class="pied-mode">${t(info)}</span></button>`;
    }).join("");
    return `<div class="tete-page"><div><p class="sur-titre">S'entraîner</p><h1>Les quiz</h1><p>Chaque réponse fait avancer tes boîtes de révision : ce que tu sais revient de moins en moins souvent, ce que tu rates revient demain.</p></div></div>
      <div class="modes">
        <button type="button" class="carte-mode vedette" data-action="quiz" data-mode="jour"><span class="vedette-texte"><span class="titre-mode">Séance du jour</span><span class="desc-mode">${t(MODE.jour.desc)}</span>
          <span class="pied-mode">${st.aRevoir ? `${pluriel(st.aRevoir, "question")} à revoir aujourd'hui · ` : ""}${plan.articles} sur tes articles, ${plan.bases} sur les bases</span></span><span class="faux-btn">Commencer</span></button>
        ${cartes}
      </div>`;
  }

  // ---------- matières, tissus, coupes ----------
  const ONGLETS_MAT = [["fibres", "Fibres"], ["tissus", "Tissus et mailles"], ["coupes", "Coupes et cols"], ["entretien", "Tailles et entretien"]];
  function jaugesHTML(f) {
    return `<div class="jauges">${SAV.criteres.filter(c => f.notes[c.id]).map(c => `<div class="jauge"><span>${t(c.nom)}</span><span class="barres" role="img" aria-label="${c.nom} : ${f.notes[c.id]} sur 3">${[1, 2, 3].map(n => `<i${n <= f.notes[c.id] ? ' class="plein"' : ""}></i>`).join("")}</span></div>`).join("")}</div>`;
  }
  const filtreMat = txt => { const q = clef(V.matQ).split(" ").filter(Boolean); return !q.length || q.every(m => clef(txt).includes(m)); };
  function carteFibre(f) {
    const dans = idx().avecFibre[f.id] || [];
    return `<article class="carte-savoir" id="savoir-${f.id}"><div class="entete-carte"><h3>${t(f.nom)}</h3><span class="pastille">${t(FAMILLES[f.famille].court)}</span></div>
      <p class="bref">${t(f.enBref)}</p><p class="petit discret">Origine : ${t(f.origine.charAt(0).toLowerCase() + f.origine.slice(1))}.</p>${jaugesHTML(f)}
      <div class="deux-listes"><div><h4>Atouts</h4><ul>${f.atouts.map(x => `<li>${t(x)}</li>`).join("")}</ul></div><div><h4>Attention</h4><ul>${f.limites.map(x => `<li>${t(x)}</li>`).join("")}</ul></div></div>
      <p class="citation">« ${t(f.aDire)} »</p><p class="petit"><b>Entretien :</b> ${t(f.entretien)}</p>${f.plus ? `<p class="petit discret">${t(f.plus)}</p>` : ""}
      ${dans.length ? `<div><p class="sur-titre" style="margin-bottom:6px">Dans ton rayon</p><div class="dans-rayon">${dans.slice(0, 12).map(a => `<button type="button" class="puce" data-action="fiche" data-id="${esc(a.id)}">${t(`${a.nom || titre(a)}${a.couleur ? " · " + a.couleur : ""} · ${COMPO.nombre(COMPO.pct(a._princ, f.id))} %`)}</button>`).join("")}</div></div>` : ""}</article>`;
  }
  function contenuMatieres() {
    const tab = V.matTab;
    const bouton = theme => `<button type="button" class="btn" data-action="quiz" data-mode="bases" data-theme="${theme}">Réviser ce thème</button>`;
    if (tab === "fibres") {
      const groupes = Object.entries(FAMILLES).map(([k, fam]) => {
        const l = SAV.fibres.filter(f => f.famille === k && filtreMat([f.nom, ...f.alias, f.enBref, f.aDire].join(" ")));
        return l.length ? `<div class="groupe-savoir"><h2>${t(fam.nom)}</h2><p class="discret" style="margin:-6px 0 14px">${t(fam.explication)}</p><div class="grille-savoir">${l.map(carteFibre).join("")}</div></div>` : "";
      }).join("");
      return `<div class="titre-section"><p class="discret">Ce que chaque fibre apporte, ses limites et la phrase à dire au client.</p>${bouton("fibres")}</div>${groupes || `<p class="discret">Aucune fibre ne correspond.</p>`}`;
    }
    if (tab === "tissus") {
      const l = SAV.tissus.filter(x => filtreMat([x.nom, x.enBref, x.usages].join(" ")));
      return `<div class="titre-section"><p class="discret">Comment les reconnaître au toucher et à l'œil, et où on les trouve.</p>${bouton("tissus")}</div>
        <div class="grille-savoir">${l.map(x => `<article class="carte-savoir" id="savoir-${x.id}"><div class="entete-carte"><h3>${t(x.nom)}</h3><span class="pastille">${t(x.type)}</span></div>
        <p class="bref">${t(x.enBref)}</p><p class="petit"><b>Le reconnaître :</b> ${t(x.reconnaitre)}</p><p class="petit"><b>On le trouve sur :</b> ${t(x.usages)}</p>
        <p class="citation">« ${t(x.aDire)} »</p>${x.conseil ? `<p class="petit discret">${t(x.conseil)}</p>` : ""}</article>`).join("") || `<p class="discret">Aucun tissu ne correspond.</p>`}</div>`;
    }
    if (tab === "coupes") {
      const carte = c => `<article class="carte-savoir" id="savoir-${c.id}"><div class="entete-carte"><h3>${t(c.nom)}</h3>${c.levis ? `<span class="pastille">Levi's ${t(c.levis)}</span>` : ""}</div><p class="bref">${t(c.def)}</p>${c.aDire ? `<p class="citation">« ${t(c.aDire)} »</p>` : ""}</article>`;
      const groupe = (nom, l) => { const f = l.filter(c => filtreMat([c.nom, ...(c.alias || []), c.def].join(" "))); return f.length ? `<div class="groupe-savoir"><h2>${t(nom)}</h2><div class="grille-savoir">${f.map(carte).join("")}</div></div>` : ""; };
      const levis = SAV.levis.filter(x => filtreMat(`levis ${x.num} ${x.nom} ${x.def}`));
      return `<div class="titre-section"><p class="discret">Les mots des étiquettes et des sites, traduits en ce que le client va sentir.</p>${bouton("coupes")}</div>
        ${groupe("Jeans et pantalons", COUPES.bas)}${groupe("Hauts", COUPES.hauts)}${groupe("Cols", COLS)}${groupe("Manches", COUPES.manches)}
        ${levis.length ? `<div class="groupe-savoir"><h2>Les numéros Levi's</h2><div class="tableau-defile"><table class="conv"><thead><tr><th>Numéro</th><th>Nom</th><th style="text-align:left">Ce que c'est</th></tr></thead><tbody>
          ${levis.map(x => `<tr><td>${t(x.num)}</td><td>${t(x.nom)}</td><td style="text-align:left;font-family:var(--f-texte)">${t(x.def)}</td></tr>`).join("")}</tbody></table></div></div>` : ""}`;
    }
    const tl = SAV.tailles;
    const groupes = unique(SAV.symboles.map(s => s.groupe));
    return `<div class="titre-section"><p class="discret">Les tailles des jeans et les symboles des étiquettes d'entretien.</p><span class="rangee">${bouton("tailles")}${bouton("entretien")}</span></div>
      <div class="groupe-savoir"><h2>Les tailles W et L</h2><p style="max-width:65ch">${t(tl.wl)}</p><p style="max-width:65ch;margin-top:6px"><b>${t(tl.regle)}</b></p>
        <div class="tableau-defile" style="margin-top:14px"><table class="conv"><tbody><tr><th>W</th>${tl.conversion.map(c => `<td>${t(c[0])}</td>`).join("")}</tr><tr><th>FR</th>${tl.conversion.map(c => `<td>${t(c[1])}</td>`).join("")}</tr></tbody></table></div>
        <ul class="liste-points" style="margin-top:14px">${tl.longueurs.map(l => `<li><b>${t(l[0])}</b> : ${t(l[1])}</li>`).join("")}</ul>
        <ul class="liste-points" style="margin-top:10px">${tl.taillant.map(l => `<li><b>${t(l[0])}</b> : ${t(l[1])}</li>`).join("")}</ul></div>
      <div class="groupe-savoir"><h2>Les symboles d'entretien</h2>${groupes.map(g => `<p class="sur-titre" style="margin:16px 0 8px">${t(g)}</p><div class="symboles">${SAV.symboles.filter(s => s.groupe === g).map(s => `<div class="symbole">${symboleSVG(s.svg)}<p>${t(s.nom)}</p></div>`).join("")}</div>`).join("")}</div>`;
  }
  function majMatieres() { const el = $("#contenu-matieres"); if (el) el.innerHTML = contenuMatieres(); }
  function pageMatieres() {
    return `<div class="tete-page"><div><p class="sur-titre">Le savoir du vendeur</p><h1>Matières et coupes</h1><p>Tout ce qu'il faut pour répondre à « c'est quoi, le lyocell ? » sans hésiter. Chaque fiche finit par une phrase prête à dire.</p></div></div>
      <div class="onglets" role="tablist" aria-label="Thèmes">${ONGLETS_MAT.map(([id, nom]) => `<button type="button" role="tab" data-action="tab-mat" data-v="${id}" aria-selected="${V.matTab === id}">${t(nom)}</button>`).join("")}</div>
      ${V.matTab !== "entretien" ? `<div class="outils-ligne" style="margin-bottom:18px"><label class="recherche"><span class="visuellement-cache">Rechercher</span>${ICONE.loupe}<input type="search" id="q-matieres" placeholder="Lyocell, piqué, fuselé…" value="${esc(V.matQ)}" autocomplete="off"></label></div>` : ""}
      <div id="contenu-matieres">${contenuMatieres()}</div>`;
  }

  // ---------- couche : formulaire et quiz ----------
  function ouvrirCouche(type) {
    if (!V.couche) V.focusAvant = document.activeElement;
    V.couche = type;
    const c = $("#couche");
    c.hidden = false;
    document.documentElement.style.overflow = "hidden";
  }
  function fermerCouche() {
    if (Q) { arreterQuiz(); Q = null; }
    if (F) { if (F.analyse) F.analyse.abort(); for (const p of F.photos) if (p.url) URL.revokeObjectURL(p.url); F = null; }
    V.couche = null;
    const c = $("#couche");
    c.hidden = true; c.innerHTML = "";
    document.documentElement.style.overflow = "";
    planifier();
    const avant = V.focusAvant; V.focusAvant = null;
    if (avant && document.contains(avant)) avant.focus({ preventScroll: true });
  }

  // ---------- quiz : affichage ----------
  function contexteArticle(a) {
    return `<div class="qz-contexte"><div class="qz-photo">${a.photos.length ? `<img src="${esc(photoSrc(a.photos[0]))}" alt="">` : sansPhoto()}</div>
      <div class="titre-art"><span class="sur-titre">${t(a.marque || CAT[a.categorie]?.nom || "")}</span><b>${t(a.nom || "Sans nom")}</b><span class="discret">${t(a.couleur)}</span></div></div>`;
  }
  const LETTRES = ["A", "B", "C", "D", "E"];
  function optionsHTML(q) {
    const fini = Q.etape !== "question";
    const choisi = q.reponse?.valeur;
    return `<div class="qz-options" role="group" aria-labelledby="qz-enonce">${q.options.map((o, i) => {
      const cls = ["opt", q.style === "compo" ? "compo" : "", q.style === "article" ? "opt-art" : "", fini && o.juste ? "juste" : "", fini && i === choisi && !o.juste ? "faux" : ""].filter(Boolean).join(" ");
      const visuel = q.style === "article" ? (o.article.photos.length ? `<img src="${esc(photoSrc(o.article.photos[0]))}" alt="">` : sansPhoto("")) : "";
      const libelle = q.style === "article" ? `<span><span class="marque-opt">${t(o.article.nom || titre(o.article))}</span><br><span class="discret">${t(o.article.couleur || o.article.marque)}</span></span>` : `<span>${t(o.texte)}</span>`;
      const mark = fini && o.juste ? `<span class="visuellement-cache">Bonne réponse</span>` : fini && i === choisi ? `<span class="visuellement-cache">Ta réponse</span>` : "";
      return `<button type="button" class="${cls}" data-q="choix" data-v="${i}"${fini ? " disabled" : ""}><span class="lettre">${LETTRES[i]}</span>${visuel}${libelle}${mark}</button>`;
    }).join("")}</div>`;
  }
  function retourHTML(q) {
    const r = q.reponse;
    if (!r) return "";
    const juste = r.juste === true;
    let detail = "";
    if (q.genre === "saisie" && r.detail) {
      const d = r.detail;
      detail = `<p><b>Bonne réponse :</b> ${t(q.bonneTexte)}</p>${d.lu ? `<p><b>Ta réponse lue :</b> ${t(d.lu)}</p>` : `<p>Je n'ai reconnu aucune matière dans ta réponse.</p>`}`;
      if (d.resultat === "presque") detail += `<p>Les bonnes matières : vérifie les pourcentages.</p>`;
      else if (!juste && (d.manquantes.length || d.enTrop.length)) detail += `<p>${d.manquantes.length ? `Il manque : ${t(d.manquantes.map(nomF).join(", "))}. ` : ""}${d.enTrop.length ? `En trop : ${t(d.enTrop.map(nomF).join(", "))}.` : ""}</p>`;
    } else if (!juste && q.genre !== "accroche") detail = `<p><b>Bonne réponse :</b> ${t(q.bonneTexte)}</p>`;
    const verdict = juste ? "Bonne réponse" : r.juste === "presque" ? "Presque" : "Pas tout à fait";
    const derniere = !Q.sprint && Q.i + 1 >= Q.questions.length;
    return `<div class="qz-retour ${juste ? "juste" : "faux"}" role="status"><p class="verdict">${juste ? ICONE.coche : ICONE.rate}${verdict}</p>${detail}${q.explication ? `<p>${t(q.explication)}</p>` : ""}</div>
      ${Q.sprint ? "" : `<div class="qz-actions"><button type="button" class="btn btn-primaire btn-grand" id="qz-suivant" data-q="suivant">${derniere ? "Voir mon score" : "Question suivante"}</button>
      ${q.article && !Q.sprint ? `<button type="button" class="btn btn-discret" data-q="fiche" data-id="${esc(q.article.id)}">Voir la fiche</button>` : ""}</div>`}`;
  }
  function accrocheHTML(q) {
    const a = q.article;
    let h = contexteArticle(a) + `<div class="qz-situation"><p class="sur-titre">La situation</p><p>${t(q.situation)}</p></div>`;
    if (Q.etape === "question") {
      h += `<div class="champ"><label for="qz-phrase">${t(q.enonce)}</label><textarea id="qz-phrase" placeholder="Ce que tu dis au client, mot pour mot." ${Q.attente ? "disabled" : ""}>${esc(q.phrase || "")}</textarea>
        <span class="aide">Rappel : ce que tu vois, ce que tu sais, une seule question « A ou B ».</span></div>
        <p class="message petit${q.erreurClaude ? " erreur" : ""}" id="qz-message" role="status">${Q.attente ? "Claude lit ta phrase…" : t(q.erreurClaude || "")}</p>
        <div class="qz-actions">${Q.attente ? `<button type="button" class="btn" data-q="stop">Arrêter</button>` : `<button type="button" class="btn btn-primaire btn-grand" data-q="noter">Faire noter par Claude</button><button type="button" class="btn btn-discret" data-q="passer">Autre situation</button>`}</div>`;
      return h;
    }
    const ev = q.eval;
    const ligne = (ok, txt) => `<li><span class="${ok ? "ok" : "ko"}">${ok ? "✓" : "✗"}</span><span>${t(txt)}</span></li>`;
    const libQuestion = { aucune: "Pas de question à la fin", fermee: "Question fermée : il peut répondre « non »", ouverte: "Question ouverte : bien, une « A ou B » serait encore plus simple", AouB: "Une question « A ou B »" };
    h += `<p class="citation">« ${t(q.phrase)} »</p>
      <div class="qz-retour ${ev.note >= 7 ? "juste" : "faux"}"><div class="note-accroche"><b>${ev.note}</b><span>/ 10</span></div>
      <ul class="criteres-accroche">${ligne(ev.signal, ev.signal ? "Tu réponds à son geste" : "Tu ne réponds pas à son geste")}
        ${ligne(ev.info && ev.infoExacte !== false, !ev.info ? "Pas d'information sur l'article" : ev.infoExacte === false ? "L'information ne correspond pas à la fiche" : "Une vraie information sur l'article")}
        ${ligne(ev.question === "AouB" || ev.question === "ouverte", libQuestion[ev.question])}
        ${ev.plusieurs ? ligne(false, "Plusieurs questions d'affilée : une seule suffit") : ""}
        ${ev.aEviter ? ligne(false, `À éviter : « ${ev.aEviter} »`) : ""}</ul>
      ${ev.reponseClient ? `<p><b>Le client :</b> « ${t(ev.reponseClient)} »</p>` : ""}${ev.conseil ? `<p>${t(ev.conseil)}</p>` : ""}${ev.exemple ? `<p><b>Exemple :</b> « ${t(ev.exemple)} »</p>` : ""}</div>
      <div class="qz-actions"><button type="button" class="btn btn-primaire btn-grand" id="qz-suivant" data-q="suivant">${Q.i + 1 >= Q.questions.length ? "Voir mon score" : "Situation suivante"}</button><button type="button" class="btn btn-discret" data-q="refaire-accroche">Réessayer cette situation</button></div>`;
    return h;
  }
  function carteHTML(q) {
    const a = q.article;
    let h = contexteArticle(a) + `<div class="carte-memoire"><p class="qz-question" id="qz-enonce">${t(q.enonce)}</p>`;
    if (!Q.retourne) return h + `<button type="button" class="btn btn-primaire btn-grand" id="qz-retourner" data-q="retourner">Retourner la carte</button></div>`;
    const defs = [];
    if (a.coupe) defs.push(["Coupe", a.coupe + (a._coupe ? " : " + minus(a._coupe.def) : "")]);
    if (a.encolure) defs.push(["Col", a.encolure]);
    if (a.taillant) defs.push(["Taille", TAILLANT[a.taillant]]);
    h += `<div class="verso">${a._lu.parties.length ? etiquetteHTML(a) : ""}${defs.length ? `<dl class="infos-def">${defs.map(([k, x]) => `<dt>${t(k)}</dt><dd>${t(x)}</dd>`).join("")}</dl>` : ""}
      ${a.points.length ? `<ul class="liste-points">${a.points.slice(0, 2).map(p => `<li>${t(p)}</li>`).join("")}</ul>` : ""}${a.aRetenir || a._princ ? `<p class="citation">${t(aRetenir(a))}</p>` : ""}</div>
      <p class="petit discret">Sois honnête : tu avais tout ?</p>
      <div class="trois-boutons"><button type="button" class="btn" data-q="carte" data-v="non">Je ne savais pas</button><button type="button" class="btn" data-q="carte" data-v="presque">À moitié</button><button type="button" class="btn btn-primaire" data-q="carte" data-v="oui">Je savais</button></div></div>`;
    return h;
  }
  function corpsQuestion(q) {
    if (q.genre === "accroche") return accrocheHTML(q);
    if (q.genre === "carte") return carteHTML(q);
    let h = "";
    if (q.article && q.contexte !== false) h += contexteArticle(q.article);
    if (q.symbole && SYMBOLE[q.symbole]) h += `<div class="qz-symbole">${symboleSVG(SYMBOLE[q.symbole].svg)}</div>`;
    h += `<p class="qz-question" id="qz-enonce">${t(q.enonce)}</p>`;
    if (q.genre === "choix") h += optionsHTML(q);
    else if (q.genre === "vf") {
      const fini = Q.etape !== "question", v = q.reponse?.valeur;
      const bouton = (val, lib, l) => `<button type="button" class="opt opt-vf${fini && val === q.vrai ? " juste" : ""}${fini && val === v && val !== q.vrai ? " faux" : ""}" data-q="vf" data-v="${val}"${fini ? " disabled" : ""}><span class="lettre">${l}</span><span>${lib}</span></button>`;
      h += `<div class="qz-vf">${bouton(true, "Vrai", "V")}${bouton(false, "Faux", "F")}</div>`;
    } else if (q.genre === "saisie") {
      const fini = Q.etape !== "question";
      h += `<form class="champ" data-q="form-saisie"><label for="qz-saisie" class="visuellement-cache">Composition</label>
        <input type="text" id="qz-saisie" placeholder="Par exemple : 98 % coton, 2 % élasthanne" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(q.reponse?.valeur || "")}"${fini ? " disabled" : ""}>
        ${fini ? "" : `<div class="qz-actions"><button type="submit" class="btn btn-primaire btn-grand">Valider</button><button type="button" class="btn btn-discret" data-q="je-ne-sais-pas">Je ne sais pas</button></div>`}</form>`;
    }
    if (Q.etape === "retour") h += retourHTML(q);
    return h;
  }
  function finHTML() {
    const total = Q.reponses.length;
    const justes = Q.reponses.filter(r => r.juste === true).length;
    const erreurs = Q.reponses.filter(r => r.juste !== true && r.q.genre !== "carte");
    const cartesRatees = Q.reponses.filter(r => r.juste !== true && r.q.genre === "carte");
    const ratio = total ? justes / total : 0;
    const message = !total ? "Aucune réponse cette fois." : ratio === 1 ? "Sans faute : tu les connais par cœur." : ratio >= 0.8 ? "Très bien : encore un peu, et c'est acquis."
      : ratio >= 0.5 ? "En bonne voie : tes erreurs reviendront dans les prochaines séances." : "Pas de panique : chaque erreur reviendra jusqu'à ce que tu la saches.";
    const score = Q.sprint ? `<p class="score">${Q.sprint.score}<small> bonnes réponses</small></p><p>${Q.record ? "Nouveau record !" : `Ton record : ${S.progres.records.sprint || 0}.`} ${pluriel(Q.sprint.total, "question")} en 60 secondes.</p>`
      : `<p class="score">${justes}<small> / ${total}</small></p><p>${t(message)}</p>`;
    const aRefaire = [...erreurs, ...cartesRatees].map(r => r.q).filter(q => q.refaire);
    return `<div class="qz-fin"><p class="sur-titre" id="qz-fin-titre" tabindex="-1">${Q.sprint ? "Temps écoulé" : "Série terminée"}</p>${score}
      <div class="rangee">${aRefaire.length && !Q.sprint ? `<button type="button" class="btn btn-primaire" data-q="rejouer-erreurs">Rejouer mes erreurs (${aRefaire.length})</button>` : ""}
        <button type="button" class="btn${aRefaire.length && !Q.sprint ? "" : " btn-primaire"}" data-q="recommencer">${Q.sprint ? "Relancer un sprint" : "Une autre série"}</button><button type="button" class="btn btn-discret" data-q="fermer">Terminer</button></div>
      ${erreurs.length ? `<h3>À revoir</h3><ul class="erreurs">${erreurs.map(r => `<li><span class="petit discret">${t(r.q.article && r.q.contexte !== false ? titreCouleur(r.q.article) : THEMES.find(x => x.id === r.q.theme)?.nom || "")}</span>
        <span>${t(r.q.genre === "accroche" ? r.q.situation : r.q.enonce)}</span><span class="bonne">${t(r.q.genre === "accroche" ? `Note : ${r.q.eval?.note ?? "–"} / 10` : r.q.bonneTexte || "")}</span></li>`).join("")}</ul>` : ""}</div>`;
  }
  function renderQuiz() {
    if (!Q || V.couche !== "quiz") return;
    const q = Q.questions[Q.i];
    const n = Q.questions.length;
    const progres = Q.etape === "fin" ? 100 : Q.sprint ? Math.min(100, (60000 - Math.max(0, Q.sprint.fin - Date.now())) / 600) : ((Q.i + (Q.etape === "retour" ? 1 : 0)) / n * 100);
    const compteur = Q.etape === "fin" ? "" : Q.sprint ? `<span class="compteur">${Q.sprint.score} juste${Q.sprint.score > 1 ? "s" : ""}</span>` : `<span class="compteur">${Q.i + 1} / ${n}</span>`;
    const chrono = Q.sprint && Q.etape !== "fin" ? `<span class="chrono" id="qz-chrono" aria-live="off">${Math.ceil(Math.max(0, Q.sprint.fin - Date.now()) / 1000)} s</span>` : "";
    const html = `<div class="qz" role="dialog" aria-modal="true" aria-labelledby="qz-titre">
      <div class="qz-entete"><div><span class="mode" id="qz-titre">${t(Q.titre)}</span>${compteur}</div>
        <span class="rangee">${chrono}<button type="button" class="btn btn-icone" data-q="fermer" aria-label="Fermer le quiz">${ICONE.croix}</button></span>
        <div class="qz-progres" aria-hidden="true"><i style="width:${progres.toFixed(1)}%"></i></div></div>
      <div class="qz-corps">${Q.etape === "fin" ? finHTML() : corpsQuestion(q)}</div></div>`;
    remplacer($("#couche"), html);
  }
  function clicQuiz(b) {
    if (!Q) { if (b.dataset.q === "fermer") fermerCouche(); return; }
    const q = Q.questions[Q.i];
    switch (b.dataset.q) {
      case "fermer": fermerCouche(); return;
      case "choix": repondre(Number(b.dataset.v)); return;
      case "vf": repondre(b.dataset.v === "true"); return;
      case "suivant": suivant(); return;
      case "je-ne-sais-pas": repondre(""); return;
      case "retourner": Q.retourne = true; renderQuiz(); $(".trois-boutons .btn-primaire")?.focus({ preventScroll: true }); return;
      case "carte": repondre(b.dataset.v === "oui" ? true : b.dataset.v === "presque" ? "presque" : false); return;
      case "noter": noterAccroche(); return;
      case "stop": if (Q.attente) Q.attente.abort(); return;
      case "passer": { q.phrase = $("#qz-phrase")?.value || ""; const nq = genAccroche(q.article); if (nq) { Q.questions[Q.i] = { ...nq, phrase: q.phrase }; } renderQuiz(); return; }
      case "refaire-accroche": { const phrase = q.phrase; Q.questions[Q.i] = { ...q, eval: null, reponse: null, erreurClaude: "", phrase }; Q.reponses = Q.reponses.filter(r => r.q !== q); Q.etape = "question"; renderQuiz(); $("#qz-phrase")?.focus(); return; }
      case "fiche": { const id = b.dataset.id; fermerCouche(); allerFiche(id); return; }
      case "rejouer-erreurs": {
        const qs = Q.reponses.filter(r => r.juste !== true).map(r => r.q).filter(x => x.refaire);
        const mode = Q.mode;
        arreterQuiz(); Q = null;
        demarrerQuiz("erreurs", { questions: qs, depuis: mode });
        return;
      }
      case "recommencer": { const { mode, opts } = Q; arreterQuiz(); Q = null; demarrerQuiz(mode === "erreurs" ? (opts.depuis || "jour") : mode, mode === "erreurs" ? {} : opts); return; }
      default:
    }
  }
  function toucheQuiz(e) {
    if (!Q || e.ctrlKey || e.metaKey || e.altKey) return;
    const dansChamp = e.target.closest("input, textarea, select");
    const q = Q.questions[Q.i];
    if (Q.etape === "retour" && e.key === "Enter" && !dansChamp && !e.target.closest("button")) { e.preventDefault(); suivant(); return; }
    if (Q.etape !== "question" || dansChamp) return;
    const k = e.key.toLowerCase();
    if (q.genre === "choix") {
      const i = ["1", "2", "3", "4"].indexOf(k) >= 0 ? ["1", "2", "3", "4"].indexOf(k) : ["a", "b", "c", "d"].indexOf(k);
      if (i >= 0 && i < q.options.length) { e.preventDefault(); repondre(i); }
    } else if (q.genre === "vf") {
      if (k === "v") { e.preventDefault(); repondre(true); } else if (k === "f") { e.preventDefault(); repondre(false); }
    }
  }

  // ---------- formulaire d'article ----------
  const nouvelArticle = () => lireArticle(null, {});
  function ouvrirFormulaire(id, opts = {}) {
    const existant = id ? S.articles[id] : null;
    const base = existant || (opts.base ? lireArticle(null, { ...serialiser(opts.base), couleur: "", ref: "", lien: "", photos: [], aRetenir: "", creeLe: "", modifieLe: "" }) : nouvelArticle());
    const a = lireArticle(existant ? existant.id : null, serialiser(base));
    F = { id: existant ? existant.id : null, a, photos: a.photos.map(ref => ({ ref })), retirees: [], points: a.points.join("\n"), modifie: false,
      message: opts.message || "", erreur: false, envoi: false, analyse: null, texteSite: "", etiquette: null, propager: false, armeSuppr: false, armeFermer: false };
    ouvrirCouche("form");
    renderForm();
    setTimeout(() => { if (F && !existant && !opts.base && matchMedia("(pointer: fine)").matches) $("#f-site")?.focus(); }, 30);
  }
  const optionsListe = l => l.map(x => `<option value="${esc(x)}"></option>`).join("");
  function noteCompo(lu) {
    if (lu.vide) return ["", "Recopie l'étiquette, par exemple « 98 % coton, 2 % élasthanne »."];
    const inconnues = lu.parties.flatMap(p => p.inconnues);
    if (inconnues.length) return ["alerte", `Pas reconnu : « ${inconnues.slice(0, 2).join(" », « ")} ». Écris la matière en entier, avec son pourcentage.`];
    const mauvais = lu.parties.find(p => Math.abs(p.total - 100) > 1);
    if (mauvais) return ["alerte", `${mauvais.nom ? cap(mauvais.nom) + " : " : ""}le total fait ${COMPO.nombre(mauvais.total)} %. Vérifie les pourcentages.`];
    const n = lu.parties.reduce((s, p) => s + p.fibres.length, 0);
    return ["ok", `Lu : ${pluriel(n, "matière")}${lu.parties.length > 1 ? ` en ${lu.parties.length} parties` : ""}, total 100 %.`];
  }
  function apercuHTML() {
    const lu = COMPO.lire(F.a.composition);
    const faux = { _lu: lu };
    const [cls, txt] = noteCompo(lu);
    return `${etiquetteHTML(faux)}<p class="note ${cls}" id="f-note-compo">${t(txt)}</p>`;
  }
  function photosFormHTML() {
    return F.photos.map((p, i) => `<div class="photo-form"><img src="${esc(p.url || photoSrc(p.ref))}" alt="Photo ${i + 1}">${i === 0 ? `<span class="pastille premiere">Principale</span>` : ""}
      <div class="actions-photo">${i ? `<button type="button" data-f="photo-premiere" data-v="${i}">Principale</button>` : "<span></span>"}<button type="button" data-f="photo-retirer" data-v="${i}" aria-label="Retirer la photo ${i + 1}">Retirer</button></div></div>`).join("")
      + (C.assets || C.mode === "local" ? `<label class="ajout-photo" for="f-photos">${ICONE.plus}<span>Ajouter des photos</span></label>` : `<p class="petit discret">Les photos ne peuvent pas être ajoutées depuis cette vue.</p>`);
  }
  function formHTML() {
    const a = F.a;
    const g = GROUPE(CAT[a.categorie]?.type);
    const coupes = g ? COUPES[g].map(c => c.nom) : unique([...COUPES.bas, ...COUPES.hauts].map(c => c.nom));
    const nbFreres = F.id ? freres(a).length : 0;
    const champ = (id, libelle, valeur, extra = "", aide = "") => `<div class="champ"><label for="f-${id}">${libelle}</label><input type="text" id="f-${id}" data-champ="${id}" value="${esc(valeur)}" ${extra}>${aide ? `<span class="aide">${aide}</span>` : ""}</div>`;
    const claude = C.sample ? `<div class="rapide"><h3>Remplir vite avec Claude</h3>
        <p>Sur le site de la marque, sélectionne tout le texte de la fiche produit, copie-le et colle-le ici. Claude remplit les champs vides : tu n'as plus qu'à vérifier.</p>
        <div class="champ"><label for="f-site">Texte de la fiche produit</label><textarea id="f-site" data-f-texte placeholder="Colle ici le texte copié sur le site de la marque">${esc(F.texteSite)}</textarea></div>
        <div class="rangee"><button type="button" class="btn btn-primaire" data-f="claude-texte"${F.analyse ? " disabled" : ""}>Remplir avec le texte</button>
        ${C.sampleImages ? `<label class="btn" for="f-etiquette">Photo de l'étiquette</label><input type="file" id="f-etiquette" accept="image/*" hidden>
          <button type="button" class="btn" data-f="claude-photo"${F.analyse ? " disabled" : ""}>Lire les photos</button>` : ""}
        ${F.analyse ? `<button type="button" class="btn btn-discret" data-f="stop">Arrêter</button>` : ""}</div>
        ${C.sampleImages ? `<p class="petit">${F.etiquette ? `Étiquette prête : ${t(F.etiquette.name || "photo")}. Elle sert seulement à Claude, elle n'est pas enregistrée.` : "En magasin : photographie l'étiquette de composition, Claude la recopie."}</p>` : ""}
      </div>` : "";
    return `<div class="panneau" role="dialog" aria-modal="true" aria-labelledby="f-titre">
      <div class="panneau-entete"><h2 id="f-titre">${F.id ? "Modifier la fiche" : "Nouvel article"}</h2><button type="button" class="btn btn-icone" data-f="fermer" aria-label="Fermer">${ICONE.croix}</button></div>
      <div class="panneau-corps">
        ${claude}
        <div class="f-section"><h3>Photos</h3><div class="photos-form" id="f-photos-liste">${photosFormHTML()}</div><input type="file" id="f-photos" accept="image/*" multiple hidden></div>
        <div class="f-section"><h3>L'essentiel</h3><div class="f-grille">
          ${champ("marque", "Marque", a.marque, `list="f-liste-marques" autocomplete="off"`)}<datalist id="f-liste-marques">${optionsListe(idx().marques)}</datalist>
          ${champ("nom", "Modèle", a.nom, `autocomplete="off" placeholder="Jean 502 Taper"`)}
          <div class="champ"><label for="f-categorie">Catégorie</label><select id="f-categorie" data-champ="categorie"><option value="">Choisis…</option>${CATEGORIES.map(c => `<option value="${c.id}"${a.categorie === c.id ? " selected" : ""}>${esc(c.nom)}</option>`).join("")}</select></div>
          ${champ("couleur", "Couleur", a.couleur, `autocomplete="off" placeholder="Bleu marine"`)}
          ${champ("ref", "Référence", a.ref, `autocomplete="off"`)}
          ${champ("prix", "Prix (€)", a.prix == null ? "" : String(a.prix).replace(".", ","), `inputmode="decimal" autocomplete="off"`)}
          <div class="champ large"><label for="f-lien">Lien vers la fiche de la marque</label><input type="url" id="f-lien" data-champ="lien" value="${esc(a.lien)}" placeholder="https://…" autocomplete="off"></div>
        </div></div>
        <div class="f-section"><h3>Matière</h3><div class="apercu"><div id="f-apercu">${apercuHTML()}</div>
          <div class="f-grille" style="grid-template-columns:minmax(0,1fr)">
            <div class="champ"><label for="f-composition">Composition</label><textarea id="f-composition" data-champ="composition" style="min-height:76px" placeholder="67 % coton, 32 % lyocell, 1 % élasthanne">${esc(a.composition)}</textarea>
              <span class="aide">Plusieurs parties : « Tissu : 100 % polyamide ; Garnissage : 90 % duvet, 10 % plumes ».</span></div>
            ${champ("entretien", "Entretien", a.entretien, `autocomplete="off" placeholder="Machine à 30 °C, pas de sèche-linge"`)}
          </div></div></div>
        <div class="f-section"><h3>Coupe et taille</h3><div class="f-grille">
          ${champ("coupe", "Coupe", a.coupe, `list="f-liste-coupes" autocomplete="off"`)}<datalist id="f-liste-coupes">${optionsListe(coupes)}</datalist>
          ${g === "hauts" || a.encolure ? `${champ("encolure", "Col", a.encolure, `list="f-liste-cols" autocomplete="off"`)}<datalist id="f-liste-cols">${optionsListe(COLS.map(c => c.nom))}</datalist>` : ""}
          ${g === "hauts" || a.manches ? `<div class="champ"><label for="f-manches">Manches</label><select id="f-manches" data-champ="manches"><option value="">–</option>${MANCHES.map(m => `<option${a.manches === m ? " selected" : ""}>${esc(m)}</option>`).join("")}</select></div>` : ""}
          <div class="champ large"><span id="f-taillant-lib" style="font-weight:600;font-size:.92rem">Comment il taille</span><div class="segments" role="group" aria-labelledby="f-taillant-lib">
            ${[["", "Je ne sais pas"], ["petit", "Petit"], ["normal", "Normalement"], ["grand", "Grand"]].map(([v, l]) => `<button type="button" data-f="taillant" data-v="${v}" aria-pressed="${a.taillant === v}">${l}</button>`).join("")}</div></div>
        </div></div>
        <div class="f-section"><h3>Pour vendre</h3><div class="f-grille" style="grid-template-columns:minmax(0,1fr)">
          <div class="champ"><label for="f-points">Arguments à dire <span class="aide">un par ligne</span></label><textarea id="f-points" data-f-points>${esc(F.points)}</textarea></div>
          ${champ("aRetenir", "À retenir", a.aRetenir, `autocomplete="off" placeholder="Le seul 502 avec du lyocell : plus doux et plus fluide"`, "Ta phrase-clé pour t'en souvenir. Elle s'affiche dans les quiz.")}
          <div class="champ"><label for="f-description">Description</label><textarea id="f-description" data-champ="description">${esc(a.description)}</textarea></div>
        </div></div>
        ${nbFreres ? `<label class="case"><input type="checkbox" id="f-propager"${F.propager ? " checked" : ""}><span>Remplir aussi les champs vides des ${pluriel(nbFreres, "autre coloris", "autres coloris")} de ce modèle (composition, coupe, col, entretien, arguments). Rien de ce qui est déjà rempli n'est remplacé.</span></label>` : ""}
      </div>
      <div class="panneau-pied"><p class="message${F.erreur ? " erreur" : ""}" id="f-message" role="status">${t(F.message)}</p>
        ${F.id ? `<button type="button" class="btn btn-danger${F.armeSuppr ? " arme" : ""}" data-f="supprimer">${F.armeSuppr ? "Confirmer la suppression" : "Supprimer"}</button>` : ""}
        <button type="button" class="btn" data-f="enregistrer-coloris"${F.envoi ? " disabled" : ""}>Enregistrer et créer un autre coloris</button>
        <button type="button" class="btn btn-primaire" data-f="enregistrer"${F.envoi ? " disabled" : ""}>Enregistrer</button></div></div>`;
  }
  function renderForm() { if (F && V.couche === "form") remplacer($("#couche"), formHTML()); }
  function etatForm(message, erreur = false) {
    if (!F) return;
    F.message = message; F.erreur = erreur;
    const el = $("#f-message");
    if (el) { el.textContent = typo(message); el.classList.toggle("erreur", erreur); }
  }
  function saisieFormulaire(el) {
    const a = F.a;
    if (el.dataset.champ) {
      const c = el.dataset.champ;
      if (c === "prix") a.prix = el.value.trim() ? lireMontant(el.value) : null;
      else a[c] = el.value;
      F.modifie = true; F.armeFermer = false;
      if (c === "composition") { const ap = $("#f-apercu"); if (ap) ap.innerHTML = apercuHTML(); }
    } else if ("fTexte" in el.dataset) F.texteSite = el.value;
    else if ("fPoints" in el.dataset) { F.points = el.value; F.modifie = true; }
  }
  function changementFormulaire(el) {
    if (el.id === "f-photos") { ajouterPhotos(el.files); el.value = ""; return; }
    if (el.id === "f-etiquette") { F.etiquette = el.files && el.files[0] ? el.files[0] : null; el.value = ""; renderForm(); return; }
    if (el.id === "f-propager") { F.propager = el.checked; return; }
    if (el.dataset.champ === "categorie" || el.dataset.champ === "manches") { F.a[el.dataset.champ] = el.value; F.modifie = true; if (el.dataset.champ === "categorie") renderForm(); }
  }
  async function preparerPhoto(fichier) {
    const { image, url } = await new Promise((ok, ko) => {
      const u = URL.createObjectURL(fichier);
      const im = new Image();
      im.onload = () => ok({ image: im, url: u });
      im.onerror = () => { URL.revokeObjectURL(u); ko({ code: "photo" }); };
      im.src = u;
    });
    const k = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
    const toile = document.createElement("canvas");
    toile.width = Math.round(image.naturalWidth * k); toile.height = Math.round(image.naturalHeight * k);
    toile.getContext("2d").drawImage(image, 0, 0, toile.width, toile.height);
    URL.revokeObjectURL(url);
    const blob = await new Promise(ok => toile.toBlob(ok, "image/jpeg", 0.82));
    if (!blob) throw { code: "photo" };
    return { blob, url: URL.createObjectURL(blob) };
  }
  async function ajouterPhotos(fichiers) {
    const liste = Array.from(fichiers || []).slice(0, Math.max(0, 8 - F.photos.length));
    if (!liste.length) { if (fichiers && fichiers.length) etatForm("Huit photos au plus par article.", true); return; }
    etatForm("Préparation des photos…");
    const pourForm = F;
    let echecs = 0;
    for (const f of liste) {
      try { const p = await preparerPhoto(f); if (F !== pourForm) { URL.revokeObjectURL(p.url); return; } F.photos.push(p); }
      catch (_) { echecs++; }
    }
    if (F !== pourForm) return;
    F.modifie = true;
    const el = $("#f-photos-liste");
    if (el) el.innerHTML = photosFormHTML();
    etatForm(echecs ? `${pluriel(echecs, "photo")} n'a pas pu être lue (format non pris en charge).` : "", !!echecs);
  }
  // ---------- Claude : remplir la fiche ----------
  const NOMS_COUPES = unique([...COUPES.bas, ...COUPES.hauts].map(c => c.nom));
  const FORME_JSON = `{"marque": "", "nom": "", "categorie": "", "couleur": "", "ref": "", "prix": null, "coupe": "", "encolure": "", "manches": "", "taillant": "", "composition": "", "entretien": "", "description": "", "points": []}`;
  const REGLES_CHAMPS = `- categorie : un identifiant parmi ${CATEGORIES.map(c => c.id).join(", ")}.
- nom : le nom du modèle, sans la marque ni la couleur (ex. « Jean 502 Taper », « Pull col rond en coton »).
- couleur : la couleur en français, courte (ex. « Bleu marine »).
- prix : le prix en euros, en nombre (ex. 89.9), sinon null.
- coupe : une valeur parmi ${NOMS_COUPES.join(", ")}. Traduis : taper = Fuselé, straight = Droit, loose = Large, relaxed = Relaxed, regular = Regular.
- encolure : une valeur parmi ${COLS.map(c => c.nom).join(", ")} pour un haut ou une veste, sinon "".
- manches : une valeur parmi ${MANCHES.join(", ")} pour un haut, sinon "".
- taillant : "petit", "normal" ou "grand", seulement si c'est dit explicitement, sinon "".
- composition : en français, sous la forme « 98 % coton, 2 % élasthanne ». S'il y a plusieurs parties (doublure, garnissage, poches), sépare-les par « ; » en commençant par le tissu principal, ex. « Tissu : 100 % polyamide ; Garnissage : 90 % duvet, 10 % plumes ».`;
  const PROMPT_TEXTE = txt => `Tu aides un vendeur du rayon Homme d'un magasin de prêt-à-porter multimarque à remplir la fiche d'un article, à partir du texte qu'il a copié sur le site de la marque.

Texte copié :
"""
${txt}
"""

Réponds uniquement avec un objet JSON de cette forme :
${FORME_JSON}
Règles :
- Ne reprends que ce que dit le texte. Laisse "" (ou null) tout ce qu'il ne dit pas. N'invente rien.
${REGLES_CHAMPS}
- entretien : les consignes de lavage du texte, courtes (ex. « Machine à 30 °C, pas de sèche-linge »), sinon "".
- description : deux phrases au plus, reformulées à partir du texte, en vouvoyant le client.
- points : 3 à 5 arguments de vente courts tirés du texte (matière, coupe, détails), à dire au client en magasin.`;
  const PROMPT_PHOTO = (n, etiquette) => `${n > 1 ? `Voici ${n} photos` : "Voici une photo"} prises au rayon Homme d'un magasin de prêt-à-porter multimarque${etiquette ? ". La première montre l'étiquette de composition ou d'entretien de l'article" : ""}${n > (etiquette ? 1 : 0) ? ". Les autres montrent l'article lui-même" : ""}.
Remplis sa fiche. Réponds uniquement avec un objet JSON de cette forme :
${FORME_JSON}
Règles :
- Ne remplis que ce qui se lit ou se voit sur les photos. Laisse "" (ou null) le reste. N'invente aucune caractéristique technique.
${REGLES_CHAMPS}
- composition : recopie exactement l'étiquette si elle est lisible.
- entretien : traduis les symboles d'entretien lisibles en consignes courtes (ex. « Lavage à 30 °C, pas de sèche-linge, repassage doux »).
- marque, ref, prix : seulement s'ils sont lisibles.
- nom : le nom du modèle s'il est lisible, sinon un nom court et descriptif.
- description : une phrase neutre sur ce qui se voit.
- points : laisse [] sauf si une étiquette donne des arguments.`;
  function appliquerAnalyse(r) {
    if (!r || typeof r !== "object" || Array.isArray(r)) return 0;
    const a = F.a;
    let n = 0;
    const remplir = (cle, v) => { if (v && !String(a[cle] || "").trim()) { a[cle] = v; n++; } };
    remplir("marque", texte(r.marque, 60));
    remplir("nom", texte(r.nom, 120));
    remplir("categorie", CAT[r.categorie] ? r.categorie : ANCIENNES[r.categorie] || "");
    remplir("couleur", texte(r.couleur, 60));
    remplir("ref", texte(r.ref, 80));
    if (a.prix == null) { const p = lireMontant(r.prix); if (p) { a.prix = p; n++; } }
    const g = GROUPE(CAT[a.categorie]?.type);
    const coupe = texte(r.coupe, 60);
    if (coupe) { const e = g ? trouver(IDX[g], coupe) : trouver(IDX.bas, coupe) || trouver(IDX.hauts, coupe); remplir("coupe", e ? e.nom : coupe); }
    const col = texte(r.encolure, 60);
    if (col) { const e = trouver(IDX.cols, col); remplir("encolure", e ? e.nom : col); }
    remplir("manches", MANCHES.includes(r.manches) ? r.manches : "");
    if (!a.taillant && TAILLANT[r.taillant]) { a.taillant = r.taillant; n++; }
    const compo = texte(r.composition, 400);
    if (compo) { const lu = COMPO.lire(compo); remplir("composition", lu.parties.length && lu.parties.every(p => p.fibres.length && !p.inconnues.length) ? COMPO.formater(lu) : compo); }
    remplir("entretien", texte(r.entretien, 300));
    remplir("description", texte(r.description, 1500));
    const points = listeTextes(r.points, 6, 260);
    if (!F.points.trim() && points.length) { F.points = points.join("\n"); n++; }
    return n;
  }
  async function analyser(faire) {
    if (!F || F.analyse || !C.sample) return;
    const pourForm = F, ctl = F.analyse = new AbortController();
    F.message = "Claude lit la fiche…"; F.erreur = false;
    renderForm();
    try {
      const r = await faire(ctl.signal);
      if (F !== pourForm) return;
      const n = appliquerAnalyse(r);
      F.modifie = F.modifie || n > 0;
      F.message = n ? `Claude a rempli ${pluriel(n, "champ")} : vérifie avant d'enregistrer.` : "Claude n'a rien ajouté : les champs étaient déjà remplis, ou rien n'était lisible.";
      F.erreur = false;
    } catch (e) {
      if (F !== pourForm) return;
      if (e && e.code === "cancelled") { F.message = ""; return; }
      F.message = messageClaude(e); F.erreur = true;
    } finally {
      if (F === pourForm) { F.analyse = null; renderForm(); }
    }
  }
  function remplirAvecTexte() {
    const txt = (F.texteSite || "").trim();
    if (txt.length < 20) { etatForm("Colle d'abord le texte de la fiche produit, copié sur le site de la marque.", true); $("#f-site")?.focus(); return; }
    analyser(signal => C.sample.json(PROMPT_TEXTE(txt.slice(0, 15000)), { signal, modelTier: "quick" }));
  }
  async function blobsPhotos(max) {
    const blobs = [];
    if (F.etiquette) blobs.push(F.etiquette);
    for (const p of F.photos) {
      if (blobs.length >= max) break;
      if (p.blob) { blobs.push(p.blob); continue; }
      try { const r = await fetch(photoSrc(p.ref)); if (r.ok) blobs.push(await r.blob()); } catch (_) { /* photo inaccessible */ }
    }
    if (!blobs.length) throw { code: "photo" };
    return blobs;
  }
  function lirePhotosAvecClaude() {
    if (!F.etiquette && !F.photos.length) { etatForm("Ajoute une photo de l'article ou de son étiquette.", true); return; }
    analyser(async signal => {
      const blobs = await blobsPhotos(Math.max(1, Math.min(4, C.maxImages || 1)));
      return C.sample.json(PROMPT_PHOTO(blobs.length, !!F.etiquette), { images: blobs, signal });
    });
  }

  // ---------- enregistrer, supprimer ----------
  function nouvelIdArticle(a) {
    const base = slug([a.marque, a.nom, a.couleur].filter(Boolean).join(" ")) || "article";
    let id;
    do id = `${base}-${Math.random().toString(36).slice(2, 6)}`; while (S.articles[id]);
    return id;
  }
  async function enregistrerFormulaire(ensuite) {
    if (!F || F.envoi) return;
    const a = F.a;
    for (const k of ["marque", "nom", "couleur", "coupe", "encolure", "ref", "entretien", "aRetenir", "lien"]) a[k] = String(a[k] || "").trim();
    if (!a.nom) { etatForm("Donne au moins le nom du modèle.", true); $("#f-nom")?.focus(); return; }
    if (!a.categorie) { etatForm("Choisis une catégorie.", true); $("#f-categorie")?.focus(); return; }
    if (a.lien && !/^https?:\/\//i.test(a.lien)) { etatForm("Le lien doit commencer par https://", true); $("#f-lien")?.focus(); return; }
    const lu = COMPO.lire(a.composition);
    if (lu.parties.length && lu.parties.every(p => p.fibres.length && !p.inconnues.length)) a.composition = COMPO.formater(lu);
    const pourForm = F;
    F.envoi = true; F.armeSuppr = false; F.armeFermer = false;
    renderForm(); etatForm("Enregistrement…");
    try {
      const nouvelles = F.photos.filter(p => p.blob).length;
      let n = 0;
      for (const p of F.photos) {
        if (!p.blob) continue;
        if (!C.assets) throw { code: "not_granted" };
        n++; etatForm(`Envoi des photos… ${n} sur ${nouvelles}`);
        const res = await C.assets.upload(p.blob, { type: "image/jpeg" });
        // Une photo envoyée devient une photo enregistrée : un nouvel essai ne la renverra pas.
        p.ref = "asset:" + res.id; delete p.blob;
      }
      const maintenant = new Date().toISOString();
      const id = F.id || nouvelIdArticle(a);
      a.photos = F.photos.map(p => p.ref).filter(Boolean);
      a.points = lignes(F.points).slice(0, 8);
      a.creeLe = a.creeLe || maintenant;
      a.modifieLe = maintenant;
      const propre = lireArticle(id, serialiser(a));
      S.articles[id] = propre; invalider();
      const ok = await ecrire("articles/" + id, serialiser(propre));
      if (!ok) throw { code: "ecriture" };
      if (C.assets) for (const ref of F.retirees) if (ref.startsWith("asset:")) C.assets.delete(ref.slice(6)).catch(() => {});
      let completes = 0;
      if (F.propager) {
        const ops = [];
        for (const x of freres(propre)) {
          const c = serialiser(x);
          let change = false;
          for (const k of ["composition", "coupe", "encolure", "manches", "entretien", "taillant"]) if (!String(c[k] || "").trim() && propre[k]) { c[k] = propre[k]; change = true; }
          if (!c.points.length && propre.points.length) { c.points = [...propre.points]; change = true; }
          if (change) { c.modifieLe = maintenant; const l = lireArticle(x.id, c); S.articles[x.id] = l; ops.push(["articles/" + x.id, serialiser(l)]); }
        }
        invalider();
        if (ops.length) { const r = await ecrireTout(ops, (i, nb) => etatForm(`Mise à jour des coloris… ${i} sur ${nb}`)); completes = r.ok; }
      }
      if (F !== pourForm) return;
      const etaitNouveau = !F.id;
      const annonce = (etaitNouveau ? "Article ajouté" : "Fiche enregistrée") + (completes ? `, et ${pluriel(completes, "autre coloris complété", "autres coloris complétés")}` : "");
      if (ensuite === "coloris") {
        for (const p of F.photos) if (p.url) URL.revokeObjectURL(p.url);
        F = null;
        ouvrirFormulaire(null, { base: propre, message: `${annonce}. Même modèle, nouveau coloris : change la couleur, la référence et les photos.` });
        planifier();
        $("#f-couleur")?.focus();
        return;
      }
      fermerCouche();
      toast(annonce);
      if (etaitNouveau || V.page !== "fiche" || V.fiche !== id) allerFiche(id); else render();
    } catch (e) {
      if (F !== pourForm) return;
      F.envoi = false;
      F.message = e && e.code === "ecriture" ? "Pas enregistré. Vérifie ta connexion et réessaie."
        : e && (e.code === "too_large" || e.code === "quota_or_state") ? "La photo n'a pas pu être envoyée : trop lourde, ou l'espace photo de la page est plein."
        : e && e.code === "not_granted" ? "Tu n'as pas le droit d'ajouter des photos à cette page."
        : "La photo n'a pas pu être envoyée. Réessaie.";
      F.erreur = true;
      renderForm();
    }
  }
  async function supprimerArticle(id) {
    const a = S.articles[id];
    if (!a) return;
    const copie = serialiser(a);
    delete S.articles[id]; invalider();
    const ok = await ecrire("articles/" + id, null);
    if (!ok) { S.articles[id] = lireArticle(id, copie); invalider(); planifier(); return; }
    planifier();
    toast(`« ${titre(a)} » supprimé`, {
      libelle: "Annuler",
      faire: async () => { S.articles[id] = lireArticle(id, copie); invalider(); planifier(); if (await ecrire("articles/" + id, copie)) toast("Article restauré"); },
      expire: () => { if (C.assets) for (const ref of copie.photos) if (ref.startsWith("asset:")) C.assets.delete(ref.slice(6)).catch(() => {}); },
    });
  }
  function clicFormulaire(b) {
    const f = b.dataset.f;
    if (!f) return;
    if (f !== "fermer") F.armeFermer = false;
    if (f !== "supprimer" && F.armeSuppr) { F.armeSuppr = false; const s = $('[data-f="supprimer"]', $("#couche")); if (s) { s.classList.remove("arme"); s.textContent = "Supprimer"; } }
    switch (f) {
      case "fermer": fermerFormulaire(); return;
      case "photo-premiere": { const [p] = F.photos.splice(Number(b.dataset.v), 1); F.photos.unshift(p); F.modifie = true; $("#f-photos-liste").innerHTML = photosFormHTML(); return; }
      case "photo-retirer": { const [p] = F.photos.splice(Number(b.dataset.v), 1); if (p.url) URL.revokeObjectURL(p.url); if (p.ref) F.retirees.push(p.ref); F.modifie = true; $("#f-photos-liste").innerHTML = photosFormHTML(); return; }
      case "taillant": F.a.taillant = b.dataset.v; F.modifie = true; $$('[data-f="taillant"]', $("#couche")).forEach(x => x.setAttribute("aria-pressed", String(x.dataset.v === F.a.taillant))); return;
      case "claude-texte": remplirAvecTexte(); return;
      case "claude-photo": lirePhotosAvecClaude(); return;
      case "stop": if (F.analyse) F.analyse.abort(); return;
      case "enregistrer": enregistrerFormulaire(); return;
      case "enregistrer-coloris": enregistrerFormulaire("coloris"); return;
      case "supprimer": {
        if (!F.armeSuppr) { F.armeSuppr = true; b.classList.add("arme"); b.textContent = "Confirmer la suppression"; etatForm("La fiche et ses photos seront supprimées. Tu pourras annuler pendant quelques secondes."); return; }
        const id = F.id;
        fermerCouche();
        if (V.page === "fiche" && V.fiche === id) aller(V.retour || "articles");
        supprimerArticle(id);
        return;
      }
      default:
    }
  }
  function fermerFormulaire() {
    if (!F) return;
    if (F.modifie && !F.armeFermer && !F.envoi) { F.armeFermer = true; etatForm("Modifications non enregistrées : touche encore la croix pour fermer sans enregistrer.", true); return; }
    fermerCouche();
  }

  // ---------- sauvegarde ----------
  async function sauvegarder() {
    if (!C.downloads) return;
    const contenu = { app: "par-coeur", version: 1, date: new Date().toISOString(), articles: Object.fromEntries(idx().liste.map(a => [a.id, serialiser(a)])) };
    try { await C.downloads.save({ filename: `par-coeur-articles-${jourIso()}.json`, data: JSON.stringify(contenu, null, 1) }); toast("Sauvegarde prête"); }
    catch (e) { if (e && e.code !== "declined") toast("La sauvegarde n'a pas pu être proposée ici."); }
  }
  const cellule = v => { const s = String(v ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  async function exporterCSV() {
    if (!C.downloads) return;
    const entetes = ["Marque", "Modèle", "Catégorie", "Couleur", "Référence", "Prix", "Coupe", "Col", "Manches", "Taille", "Composition", "Entretien", "Arguments", "À retenir", "Description", "Lien", "Maîtrise"];
    const rangs = idx().liste.map(a => [a.marque, a.nom, CAT[a.categorie]?.nom || "", a.couleur, a.ref, a.prix == null ? "" : String(a.prix).replace(".", ","), a.coupe, a.encolure, a.manches,
      TAILLANT[a.taillant] || "", a.composition, a.entretien, a.points.join(" / "), a.aRetenir, a.description, a.lien, LIBELLE_ETAT[etat("a:" + a.id)]]);
    const csv = "﻿" + [entetes, ...rangs].map(r => r.map(cellule).join(";")).join("\r\n");
    try { await C.downloads.save({ filename: `par-coeur-articles-${jourIso()}.csv`, data: csv }); toast("Tableur prêt"); }
    catch (e) { if (e && e.code !== "declined") toast("L'export n'a pas pu être proposé ici."); }
  }
  async function lireSauvegarde(fichier) {
    if (!fichier || !C.peutEcrire) return;
    let d;
    try { d = JSON.parse(await fichier.text()); } catch (_) { toast("Ce fichier n'est pas une sauvegarde lisible."); return; }
    const src = d && typeof d === "object" && d.articles && typeof d.articles === "object" ? d.articles : null;
    if (!src) { toast("Ce fichier n'est pas une sauvegarde d'Articles par cœur."); return; }
    const ops = [];
    for (const [id, v] of Object.entries(src)) {
      if (!/^[A-Za-z0-9_.~:@+-]{1,120}$/.test(id) || id === "." || id === "..") continue;
      const a = lireArticle(id, v);
      if (!a.nom) continue;
      S.articles[id] = a;
      ops.push(["articles/" + id, serialiser(a)]);
    }
    invalider(); planifier();
    if (!ops.length) { toast("Aucun article à restaurer dans ce fichier."); return; }
    toast(`Restauration de ${pluriel(ops.length, "article")}…`);
    const r = await ecrireTout(ops);
    toast(r.echecs ? `${pluriel(r.ok, "article restauré", "articles restaurés")}, ${r.echecs} en échec.` : `${pluriel(r.ok, "article restauré", "articles restaurés")}.`);
  }

  // ---------- navigation ----------
  function aller(page, extra = {}) {
    if (page === "fiche" && V.page !== "fiche") V.retour = V.page;
    V.page = page; V.armeSupprFiche = false; V.armeReset = false;
    Object.assign(V, extra);
    const versFibre = !!extra.matFocus;
    if (!versFibre) window.scrollTo(0, 0);
    $("#page").focus({ preventScroll: true });
    render();
  }
  const allerFiche = id => aller("fiche", { fiche: id, photoFiche: 0 });
  document.addEventListener("click", e => {
    const b = e.target.closest("button, [data-nav], [data-action], label");
    if (!b) return;
    if (b.closest("#couche")) {
      if (V.couche === "form" && F && b.matches("button")) clicFormulaire(b);
      else if (V.couche === "quiz" && b.matches("button")) clicQuiz(b);
      return;
    }
    if (b.dataset.nav) { e.preventDefault(); aller(b.dataset.nav); return; }
    const act = b.dataset.action;
    if (!act) return;
    e.stopPropagation();
    switch (act) {
      case "quiz": e.preventDefault(); demarrerQuiz(b.dataset.mode, { theme: b.dataset.theme || null }); return;
      case "fiche": allerFiche(b.dataset.id); return;
      case "retour": aller(V.retour && V.retour !== "fiche" ? V.retour : "articles"); return;
      case "ajouter": ouvrirFormulaire(null); return;
      case "modifier": ouvrirFormulaire(b.dataset.id); return;
      case "reviser": demarrerQuiz("article", { id: b.dataset.id }); return;
      case "photo-fiche": V.photoFiche = Number(b.dataset.v) || 0; render(); return;
      case "filtre-cat": V.filtres.cat = b.dataset.v; render(); return;
      case "filtre-manque": V.filtres.manque = !V.filtres.manque; render(); return;
      case "voir-manques": V.filtres = { q: "", cat: "", marque: "", manque: true }; aller("articles"); return;
      case "effacer-filtres": V.filtres = { q: "", cat: "", marque: "", manque: false }; render(); return;
      case "tab-mat": V.matTab = b.dataset.v; V.matQ = ""; render(); return;
      case "voir-fibre": V.matTab = "fibres"; V.matQ = ""; aller("matieres", { matFocus: b.dataset.v }); return;
      case "supprimer-fiche": {
        if (!V.armeSupprFiche) { V.armeSupprFiche = true; render(); return; }
        const id = b.dataset.id;
        V.armeSupprFiche = false;
        aller(V.retour && V.retour !== "fiche" ? V.retour : "articles");
        supprimerArticle(id);
        return;
      }
      case "sauvegarder": sauvegarder(); return;
      case "exporter": exporterCSV(); return;
      case "reset-progres": {
        if (!V.armeReset) { V.armeReset = true; render(); return; }
        V.armeReset = false;
        const avant = S.progres;
        S.progres = progresVide();
        enregistrerProgres(); render();
        toast("Progression remise à zéro", { libelle: "Annuler", faire: () => { S.progres = avant; enregistrerProgres(); render(); } });
        return;
      }
      default:
    }
  });
  document.addEventListener("input", e => {
    const el = e.target;
    if (el.closest("#couche")) { if (V.couche === "form" && F) saisieFormulaire(el); return; }
    if (el.id === "q-articles") { V.filtres.q = el.value; majListe(); }
    else if (el.id === "q-matieres") { V.matQ = el.value; majMatieres(); }
  });
  document.addEventListener("change", e => {
    const el = e.target;
    if (el.closest("#couche")) { if (V.couche === "form" && F) changementFormulaire(el); return; }
    if (el.id === "tri-articles") { V.tri = el.value; majListe(); }
    else if (el.id === "marque-articles") { V.filtres.marque = el.value; majListe(); }
    else if (el.id === "restaurer-fichier") { lireSauvegarde(el.files && el.files[0]); el.value = ""; }
  });
  document.addEventListener("submit", e => {
    if (e.target.matches('[data-q="form-saisie"]')) { e.preventDefault(); const v = $("#qz-saisie")?.value || ""; if (v.trim()) repondre(v); else $("#qz-saisie")?.focus(); }
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && V.couche) { e.preventDefault(); if (V.couche === "form") fermerFormulaire(); else fermerCouche(); return; }
    if (V.couche === "quiz") toucheQuiz(e);
  });

  // ---------- démarrage ----------
  function lireHash() {
    const h = decodeURIComponent((location.hash || "").slice(1));
    if (["accueil", "articles", "quiz", "matieres"].includes(h)) V.page = h;
    else if (h.startsWith("a-")) { V.page = "fiche"; V.fiche = h.slice(2); }
  }
  function modeLocal() {
    C.mode = "local"; C.peutEcrire = true;
    const d = lireStockage(CLE_LOCAL, {});
    S.articles = Object.fromEntries(Object.entries(d && typeof d === "object" ? d : {}).map(([id, v]) => [id, lireArticle(id, v)]));
    S.progres = lireProgres(lireStockage(cleProgres(), null));
    S.charge = true; invalider(); render();
  }
  async function demarrer() {
    lireHash();
    S.progres = lireProgres(lireStockage(cleProgres(), null));
    render();
    if (!(window.claude && typeof window.claude.use === "function")) { modeLocal(); return; }
    const utiliser = nom => window.claude.use(nom).catch(() => null);
    const [db, user] = await Promise.all([utiliser("db"), utiliser("user")]);
    if (!db) { modeLocal(); return; }
    C.db = db; C.user = user; C.mode = "distant";
    if (user) {
      const [moi, ecriture] = await Promise.all([user.id().catch(() => null), user.can("data.write").catch(() => null)]);
      C.moi = moi;
      // null : la plateforme ne dit rien ; on garde les commandes, une écriture refusée tranchera.
      C.peutEcrire = ecriture !== false;
    }
    S.progres = lireProgres(lireStockage(cleProgres(), null));
    render();
    db.collection("articles").onSnapshot(snap => {
      const m = {};
      for (const d of snap.docs) m[d.id] = lireArticle(d.id, d.data());
      S.articles = m; S.charge = true; invalider(); planifier();
      if (V.couche === "quiz") renderNav();
    }, () => { toast("Connexion perdue : recharge la page."); });
    if (C.moi) {
      db.doc(`data/users/${C.moi}/progres`).onSnapshot(snap => {
        const distant = snap.exists ? snap.data() : null;
        const fusion = fusionner(S.progres, distant);
        const premier = !C.progresRecu;
        C.progresRecu = true;
        S.progres = fusion;
        ecrireStockage(cleProgres(), fusion);
        // Une seule fois, au chargement : ce que ce navigateur avait de plus récent part dans l'espace de la personne.
        if (premier && !memeProgres(fusion, distant)) planifierProgres();
        planifier();
      }, () => {});
    }
    utiliser("assets").then(a => { C.assets = a; if (V.couche === "form") { const el = $("#f-photos-liste"); if (el) el.innerHTML = photosFormHTML(); } });
    utiliser("sample").then(async s => {
      if (typeof s !== "function") return;
      C.sample = s;
      const limites = await s.limits().catch(() => null);
      C.sampleImages = !!(limites && limites.images);
      C.maxImages = limites && limites.images ? limites.images.maxCount : 0;
      planifier();
      if (V.couche === "form") renderForm();
    });
    utiliser("downloads").then(d => { C.downloads = d; planifier(); });
  }
  demarrer();
})();

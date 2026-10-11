// Garde-robe Blue Box : logique de la page (index.html). Données de départ dans garde-robe.js.
(function () {
  "use strict";

  const D = window.GARDE_ROBE;
  const T = D.teintes;
  const CAT = Object.fromEntries(D.categories.map(c => [c.id, c]));
  const ORDRE_CAT = Object.fromEntries(D.categories.map((c, i) => [c.id, i]));
  const ENCOLURES = { zip: "Zippé", rond: "Col rond", polo: "Col polo", v: "Col V", capuche: "Capuche", roule: "Col roulé" };
  const NIVEAUX = {
    2: { nom: "Valeur sûre", cls: "ok", sym: "●●" },
    1: { nom: "Possible", cls: "maybe", sym: "●" },
    0: { nom: "À éviter", cls: "no", sym: "×" },
  };
  const JOURS = [["lun", "Lundi"], ["mar", "Mardi"], ["mer", "Mercredi"], ["jeu", "Jeudi"], ["ven", "Vendredi"], ["sam", "Samedi"], ["dim", "Dimanche"]];
  const AUJ = JOURS[(new Date().getDay() + 6) % 7];
  // D'avril à septembre, les t-shirts passent devant les pulls ; le reste de l'année, l'inverse.
  // En une couche, les t-shirts passent devant les pulls ; avec plusieurs couches, l'inverse.
  const horsSaison = () => (etat.couches === 1 ? ["pulls", "sweats"] : ["t-shirts", "polos", "shorts"]);
  const CLE = "garde-robe-bluebox:v1";
  const ID_ASSET = /^[A-Za-z0-9_-]{8,64}$/;
  const PHOTO_ABSENTE = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 5"><rect width="4" height="5" fill="#9aa3b5" fill-opacity=".25"/></svg>');

  const F = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const sansAccents = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const possede = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const singulier = c => CAT[c].nom.replace(/aux$/, "au").replace(/s$/, "");
  const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? "s" : ""}`;
  const pastille = a => `<i class="pastille" style="background:${esc(T[a.teinte].hex)}"></i>`;
  const role = a => CAT[a.categorie].role;

  // ---------- pièces : celles de garde-robe.js + celles ajoutées depuis la page ----------
  // Superpositions : un t-shirt, une chemise ou un polo peut se glisser sous un pull ou un sweat ;
  // un t-shirt peut aussi se porter sous une chemise ouverte.
  const SOUS_CATS = ["t-shirts", "chemises", "polos"];
  const PULL_CATS = ["pulls", "sweats"];
  let ajoutes = [];
  let ARTICLES, PAR_ID, BAS, HAUTS, SOUS, PIEDS, DESSUS;
  function indexer() {
    ARTICLES = D.articles.concat(ajoutes)
      .map((a, i) => [a, i])
      .sort((x, y) => ORDRE_CAT[x[0].categorie] - ORDRE_CAT[y[0].categorie] || x[1] - y[1])
      .map(x => x[0]);
    PAR_ID = Object.fromEntries(ARTICLES.map(a => [a.id, a]));
    const parRole = r => ARTICLES.filter(a => role(a) === r);
    BAS = parRole("bas"); HAUTS = parRole("haut"); PIEDS = parRole("pieds"); DESSUS = parRole("dessus");
    SOUS = ARTICLES.filter(a => SOUS_CATS.includes(a.categorie));
  }

  // Nom court d'une pièce ; « t‑shirt » garde son trait d'union en fin de ligne.
  const court = a => nomCourt(a).replace(/-/g, "\u2011");
  function nomCourt(a) {
    const c = a.couleur.toLowerCase();
    if (role(a) === "bas") {
      const m = a.modele.replace(/^(pantalon|jean|short)s? /i, "").split(" ")[0].replace("™", "");
      return (m || singulier(a.categorie)) + " " + c;
    }
    if (a.categorie === "pulls") return (ENCOLURES[a.encolure] || "Pull") + " " + c;
    if (role(a) === "pieds" || role(a) === "aucun") return (a.modele || singulier(a.categorie)) + " " + c;
    return singulier(a.categorie) + " " + c;
  }
  const nomComplet = a => `${a.marque} ${a.modele || singulier(a.categorie)} ${a.couleur}`;
  const majuscule = s => s.charAt(0).toUpperCase() + s.slice(1);

  // ---------- accords de couleurs ----------
  // Le tableau de garde-robe.js d'abord, puis des règles générales pour les couleurs qu'il ne couvre pas.
  const RANG_CLARTE = { clair: 0, moyen: 1, fonce: 2 };
  function accordGeneral(b, h) {
    const tb = T[b.teinte], th = T[h.teinte];
    if (tb.famille === "motif" || th.famille === "motif") {
      return tb.famille === th.famille
        ? { score: 1, note: "Deux motifs ensemble : à doser." }
        : { score: 2, note: "Un motif avec une pièce unie : ça reste lisible." };
    }
    if (b.teinte === h.teinte) return { score: 1, note: "Même couleur en haut et en bas : un ton sur ton à assumer." };
    if (tb.clarte === "fonce" && th.clarte === "fonce") {
      return tb.famille === th.famille
        ? { score: 0, note: "Deux teintes foncées proches : elles se confondent." }
        : { score: 1, note: "Haut et bas foncés : l'ensemble est très sombre." };
    }
    if (tb.clarte === "clair" && th.clarte === "clair" && tb.famille === th.famille) {
      return { score: 1, note: "Deux tons clairs proches : peu de contraste." };
    }
    if (!tb.neutre && !th.neutre) return { score: 1, note: "Deux couleurs franches ensemble : à doser." };
    return { score: 2, note: "" };
  }
  // Pourquoi une paire haut + bas fonctionne, quand rien de plus précis n'est écrit.
  function raisonPositive(b, h) {
    const tb = T[b.teinte], th = T[h.teinte];
    if (!th.neutre && tb.neutre) return "Une couleur franche en haut, une base neutre en bas.";
    if (th.neutre && !tb.neutre) return "Le bas apporte la couleur, le haut reste neutre.";
    if (RANG_CLARTE[th.clarte] > RANG_CLARTE[tb.clarte]) return "Haut plus foncé que le bas : un contraste net.";
    if (RANG_CLARTE[th.clarte] < RANG_CLARTE[tb.clarte]) return "Haut plus clair que le bas : un contraste net.";
    return "Deux neutres de même intensité : sobre et facile.";
  }
  function evaluer(b, h) {
    const table = D.accords[b.teinte];
    const r = table && possede(table, h.teinte)
      ? { score: table[h.teinte], note: D.notesAccord[b.teinte + "/" + h.teinte] || "" }
      : accordGeneral(b, h);
    if (r.score === 2 && !r.note) r.note = raisonPositive(b, h);
    return r;
  }
  const accord = (b, h) => evaluer(b, h).score;

  // ---------- superpositions ----------
  const aUnCol = a => a.categorie === "chemises" || a.categorie === "polos";
  const peutEtreDessous = a => SOUS_CATS.includes(a.categorie);
  const accepteDessous = h => PULL_CATS.includes(h.categorie) || h.categorie === "chemises";
  function accepte(h, s) {
    if (!h || !s || s.id === h.id) return false;
    if (PULL_CATS.includes(h.categorie)) return peutEtreDessous(s);
    if (h.categorie === "chemises") return s.categorie === "t-shirts";
    return false;
  }
  const pire = (x, y) => (y.score < x.score ? y : x);
  // Une sous-couche sous un haut : la forme des cols, puis ce qui dépasse (col, poignets, ouverture).
  // Deux couleurs « franches » : ni neutres, ni claires (un bleu ciel ou un rose pâle passe partout).
  const franche = t => !t.neutre && t.clarte !== "clair";
  function superposer(s, h) {
    if (!accepte(h, s)) return { score: 0, note: "Cette pièce ne se porte pas sous ce haut." };
    const ts = T[s.teinte], th = T[h.teinte];
    if (h.categorie === "chemises") {
      const r = { score: 2, note: "Chemise portée ouverte sur le t-shirt : décontracté." };
      if (ts.famille === "motif" && th.famille === "motif") return pire(r, { score: 1, note: "Deux motifs l'un sur l'autre : à doser." });
      if (s.teinte === h.teinte && ts.famille !== "motif") return pire(r, { score: 1, note: "Même couleur : la chemise ouverte se fond sur le t-shirt." });
      if (ts.clarte === "fonce" && th.clarte === "fonce") return pire(r, { score: 1, note: "Deux teintes foncées : peu de contraste entre chemise et t-shirt." });
      if (franche(ts) && franche(th)) return pire(r, { score: 1, note: "Chemise et t-shirt tous deux colorés : à doser." });
      return r;
    }
    const sous = "sous le " + singulier(h.categorie).toLowerCase();
    if (!aUnCol(s)) {
      if (h.encolure === "zip" && franche(ts)) return { score: 1, note: "Un t-shirt coloré se voit dans l'ouverture du zip." };
      if (h.encolure === "v") return franche(ts)
        ? { score: 1, note: "Un t-shirt coloré se voit dans le col V." }
        : { score: 2, note: "Le t-shirt se devine juste dans le col V." };
      return { score: 2, note: `Le t-shirt reste discret ${sous}.` };
    }
    if (h.encolure === "polo") return { score: 0, note: "Deux cols l'un sur l'autre : à éviter." };
    if (h.encolure === "roule") return { score: 0, note: "Un col ne passe pas sous un col roulé." };
    const r = h.encolure === "capuche" ? { score: 1, note: "Un col sous une capuche : possible, mais chargé." }
      : h.encolure === "zip" ? { score: 2, note: "Le col se glisse dans l'ouverture du zip." }
      : h.encolure === "v" ? { score: 2, note: "Le col V laisse voir le col de la sous-couche." }
      : { score: 2, note: `Col sorti ${h.encolure === "rond" ? "sur le col rond" : sous} : le classique.` };
    if (ts.famille === "motif" && th.famille === "motif") return pire(r, { score: 1, note: "Deux motifs superposés : à doser." });
    if (s.teinte === h.teinte && ts.famille !== "motif") return pire(r, { score: 1, note: "Même couleur dessus et dessous : le col disparaît." });
    if (ts.clarte === "fonce" && th.clarte === "fonce") return pire(r, { score: 1, note: "Deux teintes foncées : le col se voit à peine." });
    if (franche(ts) && franche(th)) return pire(r, { score: 1, note: "Deux couleurs franches superposées : à doser." });
    return r;
  }
  const estDenim = a => a.teinte.startsWith("denim-") || /\b(jean|denim|trucker)\b/i.test(a.modele);
  // Une veste, un blouson ou un manteau par-dessus : contre le haut et la sous-couche, et contre le
  // bas pour le jean sur jean (seulement entre deux denims bleus : un jean gris ou noir va très bien).
  function surcouche(d, h, b, s) {
    const td = T[d.teinte], th = T[h.teinte];
    if (estDenim(d) && estDenim(b) && td.famille === "bleu" && T[b.teinte].famille === "bleu") {
      return d.teinte === b.teinte
        ? { score: 0, note: "Jean sur jean du même bleu : à éviter." }
        : { score: 1, note: "Jean sur jean : ça passe seulement avec deux bleus bien différents." };
    }
    if (td.famille === "motif" && (th.famille === "motif" || (s && T[s.teinte].famille === "motif"))) {
      return { score: 1, note: "Deux motifs visibles l'un sur l'autre : à doser." };
    }
    if (d.teinte === h.teinte && td.famille !== "motif") return { score: 1, note: "Même couleur que le haut : la couche s'y fond." };
    if (franche(td) && franche(th)) return { score: 1, note: "Couche et haut tous deux colorés : à doser." };
    if (td.clarte !== th.clarte) return { score: 2, note: "Encadre le haut par contraste." };
    return { score: 2, note: "Une couche neutre qui ne casse pas la tenue." };
  }
  // Chaussures ou accessoire de couleur : une seule touche de couleur ressort, deux se disputent
  // (même deux rouges différents) ; la même couleur que le haut fait un rappel voulu.
  function touche(x, t) {
    if (!franche(T[x.teinte])) return null;
    const couleurs = [t.haut, t.dessous, t.dessus].map(id => PAR_ID[id]).filter(a => a && franche(T[a.teinte]));
    if (couleurs.some(a => a.teinte !== x.teinte)) return { score: 1, note: "Deux couleurs franches avec le haut : à doser." };
    if (couleurs.length) return { score: 2, note: "Rappel de la couleur du haut : l'ensemble reste cohérent." };
    return { score: 2, note: "Une seule touche de couleur : elle ressort sur une base neutre." };
  }

  // Évaluation d'une tenue complète : le niveau est celui de son accord le plus faible.
  function noterTenue(t) {
    const b = PAR_ID[t.bas], h = PAR_ID[t.haut], s = PAR_ID[t.dessous], d = PAR_ID[t.dessus];
    const raisons = [];
    const e = evaluer(b, h);
    raisons.push({ score: e.score, titre: `${majuscule(court(h))} + ${court(b)}.`, note: e.note });
    if (s) { const x = superposer(s, h); raisons.push({ score: x.score, titre: `${majuscule(court(s))} en sous-couche.`, note: x.note }); }
    if (d) { const x = surcouche(d, h, b, s); raisons.push({ score: x.score, titre: `${majuscule(court(d))} par-dessus.`, note: x.note }); }
    [["pieds", "aux pieds"], ["accessoire", "en accessoire"]].forEach(([k, ou]) => {
      const a = PAR_ID[t[k]], x = a && touche(a, t);
      if (x) raisons.push({ score: x.score, titre: `${majuscule(court(a))} ${ou}.`, note: x.note });
    });
    const g = gout("hb:" + t.haut + "|" + t.bas);
    if (g > 0) raisons.push({ score: 2, titre: "Ton goût.", note: "Tu as aimé ce haut avec ce bas." });
    if (g < 0) raisons.push({ score: 1, titre: "Ton goût.", note: "Tu as noté « pas pour moi » pour ce haut avec ce bas." });
    return { niveau: Math.min(...raisons.map(r => r.score)), raisons };
  }

  // ---------- données personnelles : journal, état des pièces, favoris, goûts ----------
  // Dans la page publiée, elles vivent dans la base (seul le propriétaire écrit) ; dans le fichier
  // ouvert en local, dans le navigateur. Tout ce qui vient de la base est vérifié avant usage.
  const CLE_DONNEES = "garde-robe-bluebox:donnees";
  // "local" : navigateur ; "attente" : la base n'a pas encore répondu ; "base" : propriétaire ;
  // "lecture" : quelqu'un d'autre regarde la page, sans pouvoir écrire.
  let modeDonnees = window.claude && typeof window.claude.use === "function" ? "attente" : "local";
  let peutEcrireDonnees = false;
  const donnees = { journal: {}, pieces: {}, favoris: {}, gouts: {} };
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const METEOS = {
    froid: { nom: "Froid", couches: 3, aide: "Froid : sous-couche, pull et veste ou manteau." },
    frais: { nom: "Frais", couches: 2, aide: "Frais : sous-couche et pull." },
    doux: { nom: "Doux", couches: 1, aide: "Doux : un seul haut." },
    pluie: { nom: "Pluie", couches: 3, aide: "Pluie : bas foncés, blouson ou manteau plutôt que veste, pas de daim aux pieds." },
  };
  const nombre = (v, min, max) => (typeof v === "number" && isFinite(v) && v >= min && v <= max ? v : null);

  function lireEntreeJournal(id, d) {
    if (!DATE_RE.test(id) || !d) return null;
    const tenue = nettoyerTenue(d.tenue);
    return tenue ? { date: id, tenue, meteo: possede(METEOS, d.meteo) ? d.meteo : null } : null;
  }
  function lireMeta(id, d) {
    if (!d) return null;
    return {
      lavage: d.lavage === true,
      prix: nombre(d.prix, 0, 100000),
      achatLe: typeof d.achatLe === "string" && DATE_RE.test(d.achatLe) ? d.achatLe : null,
      taille: texte(d.taille, 20),
    };
  }
  function lireFavori(id, d) {
    const tenue = d && nettoyerTenue(d.tenue);
    return tenue ? { tenue, ajouteLe: texte(d.ajouteLe, 40) } : null;
  }
  function lireGouts(d) {
    const g = {};
    if (d && d.paires && typeof d.paires === "object") {
      for (const [k, v] of Object.entries(d.paires)) {
        if (k.length <= 200 && Number.isInteger(v) && v >= -3 && v <= 3 && v) g[k] = v;
      }
    }
    return g;
  }
  const LECTEURS = { journal: lireEntreeJournal, pieces: lireMeta, favoris: lireFavori };

  function lireDonneesLocales() {
    try {
      const e = JSON.parse(localStorage.getItem(CLE_DONNEES)) || {};
      for (const nom of ["journal", "pieces", "favoris"]) {
        for (const [id, d] of Object.entries(e[nom] || {})) {
          const x = LECTEURS[nom](id, d);
          if (x) donnees[nom][id] = x;
        }
      }
      donnees.gouts = lireGouts(e.gouts);
    } catch (_) { /* rien d'enregistré */ }
  }
  function ecrireDonneesLocales() {
    try {
      localStorage.setItem(CLE_DONNEES, JSON.stringify({
        journal: donnees.journal, pieces: donnees.pieces, favoris: donnees.favoris, gouts: { paires: donnees.gouts },
      }));
    } catch (_) { /* stockage indisponible */ }
  }

  const peutNoter = () => modeDonnees === "local" || (modeDonnees === "base" && peutEcrireDonnees);
  function versBase(collection, v) {
    const maintenant = new Date().toISOString();
    if (collection === "journal") return { date: v.date, tenue: v.tenue, meteo: v.meteo || null, majLe: maintenant };
    if (collection === "pieces") return { lavage: !!v.lavage, prix: v.prix === null || v.prix === undefined ? null : v.prix, achatLe: v.achatLe || null, taille: v.taille || "", majLe: maintenant };
    if (collection === "favoris") return { tenue: v.tenue, ajouteLe: v.ajouteLe || maintenant };
    if (collection === "gouts") return { paires: v.paires, majLe: maintenant };
    return JSON.parse(JSON.stringify(v));
  }
  function appliquerLocal(collection, id, v) {
    if (collection === "gouts") donnees.gouts = v ? Object.assign({}, v.paires) : {};
    else if (possede(donnees, collection)) {
      if (v) donnees[collection][id] = v; else delete donnees[collection][id];
      if (collection === "journal") indexerJournal();
    }
  }
  const filesEcriture = new Map();
  // Enregistre (ou supprime avec null) un document : l'écran change tout de suite, la base suit,
  // une écriture à la fois par document.
  function enregistrer(collection, id, valeur) {
    if (!peutNoter() && collection !== "etat") return Promise.reject({ code: "lecture" });
    appliquerLocal(collection, id, valeur);
    if (modeDonnees === "local") { if (collection !== "etat") ecrireDonneesLocales(); return Promise.resolve(); }
    if (modeDonnees !== "base" || !peutEcrireDonnees) return Promise.reject({ code: "lecture" });
    const chemin = collection + "/" + id;
    const corps = valeur ? versBase(collection, valeur) : null;
    const avant = filesEcriture.get(chemin) || Promise.resolve();
    const suite = avant.catch(() => {}).then(() => appel(() => (corps ? db.doc(chemin).set(corps) : db.doc(chemin).delete()), ["unavailable"]));
    filesEcriture.set(chemin, suite);
    return suite.catch(err => {
      toast(CODES_DROITS.includes(err && err.code) ? "Seul le propriétaire de la page peut enregistrer." : "L'enregistrement n'a pas abouti. Réessaie dans un instant.", "erreur");
      throw err;
    });
  }

  // Journal : nombre de ports, dernier port, et fraîcheur sur deux semaines pour la rotation.
  let RECENCE = new Map(), PORTS = new Map(), DERNIER = new Map();
  const midi = date => Date.parse(date + "T12:00:00");
  const ecartJours = (a, b) => Math.round((midi(a) - midi(b)) / 864e5);
  function indexerJournal() {
    RECENCE = new Map(); PORTS = new Map(); DERNIER = new Map();
    for (const e of Object.values(donnees.journal)) {
      const jours = ecartJours(AUJ_DATE, e.date);
      for (const k of SLOTS) {
        const id = e.tenue[k];
        if (!id) continue;
        PORTS.set(id, (PORTS.get(id) || 0) + 1);
        if (!DERNIER.has(id) || DERNIER.get(id) < e.date) DERNIER.set(id, e.date);
        if (jours >= 1 && jours <= 14 && (!RECENCE.has(id) || RECENCE.get(id) > jours)) RECENCE.set(id, jours);
      }
    }
  }
  // 1 pour une pièce portée hier, proche de 0 pour une pièce portée il y a deux semaines.
  const fraicheur = id => (RECENCE.has(id) ? (15 - RECENCE.get(id)) / 14 : 0);
  const auLavage = id => !!(id && donnees.pieces[id] && donnees.pieces[id].lavage);
  const dispo = a => !!a && !auLavage(a.id);
  const gout = cle => donnees.gouts[cle] || 0;
  const meteoDuJour = () => (etat.meteo && etat.meteo.date === AUJ_DATE ? etat.meteo.valeur : null);
  const cleTenue = t => SLOTS.map(k => t[k] || "").join("|");
  // Identifiant stable d'une tenue (pour les favoris), sans l'accessoire.
  function idTenue(t) {
    let h = 5381;
    const s = ["bas", "haut", "dessous", "dessus", "pieds"].map(k => t[k] || "").join("|");
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return "f" + h.toString(36);
  }
  const copieTenue = t => { const n = {}; SLOTS.forEach(k => { if (t[k]) n[k] = t[k]; }); return n; };
  // Les jours de la semaine en cours, du lundi au dimanche, en dates.
  const INDEX_AUJ = JOURS.findIndex(x => x[0] === AUJ[0]);
  function dateSemaine(i) {
    const d = new Date(midi(AUJ_DATE));
    d.setDate(d.getDate() + i - INDEX_AUJ);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  const dateLongue = date => new Date(midi(date)).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  let toastMinuteur = null;
  function toast(msg, type) {
    const el = F("toast");
    el.textContent = msg;
    el.classList.toggle("erreur", type === "erreur");
    el.hidden = false;
    clearTimeout(toastMinuteur);
    toastMinuteur = setTimeout(() => { el.hidden = true; }, 4000);
  }
  let renduPrevu = false;
  function planifierRendu() {
    if (renduPrevu) return;
    renduPrevu = true;
    setTimeout(() => { renduPrevu = false; rendreTout(); }, 0);
  }

  // ---------- état local (jours cochés, couches, semaine composée) ----------
  const SLOTS = ["bas", "haut", "dessous", "dessus", "pieds", "accessoire"];
  // Couches en haut du corps : 1 = un haut, 2 = sous-couche + pull, 3 = + veste, blouson ou manteau.
  // Par défaut selon le mois : 3 d'octobre à mars, 2 en avril et septembre, 1 de mai à août.
  function couchesDeSaison() {
    const m = new Date().getMonth();
    return m >= 9 || m <= 2 ? 3 : m === 3 || m === 8 ? 2 : 1;
  }
  const AUJ_DATE = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`)(new Date());
  // Une tenue lue du stockage : seulement des ids (une chaîne vide = couche volontairement absente).
  function nettoyerTenue(t) {
    if (!t || typeof t.bas !== "string" || typeof t.haut !== "string") return null;
    const n = {};
    SLOTS.forEach(k => { if (typeof t[k] === "string") n[k] = t[k]; });
    return n;
  }
  function lireEtat(e) {
    {
      if (!e || !Array.isArray(e.jours)) return null;
      const jours = JOURS.map(x => x[0]).filter(j => e.jours.includes(j));
      const plan = {};
      for (const j of jours) {
        const t = nettoyerTenue(e.plan && e.plan[j]);
        if (t) plan[j] = t;
      }
      // Le nombre de couches suit la saison tant qu'il n'a pas été choisi à la main.
      const choisies = e.couchesChoisies === true && [1, 2, 3].includes(e.couches);
      const idee = e.idee && e.idee.date === AUJ_DATE ? nettoyerTenue(e.idee.t) : null;
      const portee = e.portee && e.portee.date === AUJ_DATE && typeof e.portee.id === "string" ? { date: AUJ_DATE, id: e.portee.id } : null;
      const meteo = e.meteo && e.meteo.date === AUJ_DATE && possede(METEOS, e.meteo.valeur) ? { date: AUJ_DATE, valeur: e.meteo.valeur } : null;
      return {
        jours, plan,
        couches: choisies ? e.couches : couchesDeSaison(), couchesChoisies: choisies,
        idee: idee ? { date: AUJ_DATE, t: idee } : null, portee, meteo,
        majLe: nombre(e.majLe, 0, 1e15) || 0,
      };
    }
  }
  function lire() {
    try { return lireEtat(JSON.parse(localStorage.getItem(CLE))); } catch (_) { return null; }
  }
  function sauverLocal() {
    try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch (_) { /* stockage indisponible */ }
  }
  // La semaine est partagée entre appareils par la base. L'heure de modification les départage ;
  // une semaine composée automatiquement avant d'avoir lu la base n'écrase pas celle qui y est.
  let syncPrete = false, minuteurSync = null;
  function ecrire() {
    if (modeDonnees === "local" || modeDonnees === "lecture" || syncPrete) etat.majLe = Date.now();
    sauverLocal();
    programmerSync();
  }
  function programmerSync() {
    if (modeDonnees !== "base" || !peutEcrireDonnees || !syncPrete) return;
    clearTimeout(minuteurSync);
    minuteurSync = setTimeout(() => { enregistrer("etat", "semaine", etat).catch(() => {}); }, 700);
  }
  const cleEtat = e => JSON.stringify([e.jours, e.plan, e.couches, e.couchesChoisies, e.idee, e.portee, e.meteo]);
  function surEtatDistant(snap) {
    const definitif = !(snap.metadata && snap.metadata.fromCache);
    const distant = snap.exists ? lireEtat(snap.data()) : null;
    const majDistant = distant ? distant.majLe : 0;
    if (distant && (majDistant > (etat.majLe || 0) || modeDonnees === "lecture")) {
      if (cleEtat(distant) !== cleEtat(etat)) {
        etat = distant;
        sauverLocal();
        if (etatAjouts === "ok") reconcilier();
        planifierRendu();
      } else etat.majLe = majDistant;
    }
    if (definitif && modeDonnees === "base" && !syncPrete) {
      syncPrete = true;
      if (!distant || majDistant < (etat.majLe || 0)) { etat.majLe = etat.majLe || Date.now(); programmerSync(); }
    }
  }

  let etat = lire() || { jours: ["lun", "mar", "mer", "jeu", "ven", "sam"], plan: {}, couches: couchesDeSaison(), couchesChoisies: false, idee: null, portee: null, meteo: null, majLe: 0 };
  let apercu = null;       // tenue choisie dans un tableau d'accords
  // Idée du jour (quand aujourd'hui n'est pas coché) et pièce « portée aujourd'hui » : gardées pour la journée.
  const ideeDuJour = () => (etat.idee && etat.idee.date === AUJ_DATE ? etat.idee.t : null);
  const poserIdee = t => { etat.idee = t ? { date: AUJ_DATE, t } : null; };
  const porteeId = () => (etat.portee && etat.portee.date === AUJ_DATE && PAR_ID[etat.portee.id] ? etat.portee.id : null);
  const contient = (t, id) => !!(t && id && SLOTS.some(k => t[k] === id));
  let filtre = "tout";
  let choix = { id: null, rang: 0, filtre: "tout" };  // « Je veux porter… »
  // Pièces ajoutées depuis la page : "chargement" tant que la base n'a pas répondu de façon
  // définitive, "ok" ensuite, "indisponible" si elle ne répond pas. Tant que ce n'est pas "ok",
  // une tenue de la semaine qui cite une pièce inconnue est gardée telle quelle, jamais effacée.
  let etatAjouts = window.claude && typeof window.claude.use === "function" ? "chargement" : "ok";

  const aRole = (id, r) => !!PAR_ID[id] && role(PAR_ID[id]) === r;
  const valide = t => !!(t && aRole(t.bas, "bas") && aRole(t.haut, "haut"));

  // ---------- composition des tenues ----------
  // Une tenue : { bas, haut, dessous?, dessus?, pieds?, accessoire? } (ids des pièces).
  // Sous la pluie, pas de daim ni de toile aux pieds.
  const craintLaPluie = a => meteoDuJour() === "pluie" && /\b(daim|suede|toile|canvas)\b/i.test(sansAccents(a.modele + " " + a.coupe));
  function choisirParmi(liste, usage, voisinsIds, alea) {
    let choix, max = -Infinity;
    for (const a of liste) {
      if (!dispo(a)) continue;
      let n = (alea ? Math.random() * 2 : 0) - (usage.get(a.id) || 0) * 5;
      if (voisinsIds.includes(a.id)) n -= 3;
      if (craintLaPluie(a)) n -= 10;
      if (n > max) { max = n; choix = a.id; }
    }
    return choix;
  }
  // Sans hasard : des chaussures neutres et d'une autre couleur que le bas.
  function chaussuresPour(b) {
    let choix, max = -Infinity;
    for (const p of PIEDS) {
      if (!dispo(p)) continue;
      const n = (T[p.teinte].neutre ? 2 : 0) + (p.teinte !== b.teinte ? 1 : 0) - (craintLaPluie(p) ? 10 : 0);
      if (n > max) { max = n; choix = p.id; }
    }
    return choix;
  }
  // Toutes les tenues qui respectent les contraintes (pièces imposées), de la meilleure à la moins bonne.
  function generer(contraintes, ctx, alea) {
    const c = contraintes || {};
    // Pièces au lavage ou écartées : jamais proposées, sauf si elles sont imposées.
    const exclus = ctx.exclus || new Set();
    const libre = a => !!a && dispo(a) && !exclus.has(a.id);
    const listeBas = c.bas ? [PAR_ID[c.bas]] : BAS.filter(libre);
    const listeHauts = c.haut ? [PAR_ID[c.haut]] : HAUTS.filter(libre);
    const sousImpose = c.dessous ? PAR_ID[c.dessous] : null;
    const dessusImpose = c.dessus ? PAR_ID[c.dessus] : null;
    const voisinsSous = ctx.voisins.map(v => v.dessous);
    const hors = horsSaison();
    const pluie = meteoDuJour() === "pluie";
    const res = [];
    for (const h of listeHauts) {
      if (!h || ctx.hautsPris.has(h.id)) continue;
      let sous = [null];
      if (sousImpose) { if (!accepte(h, sousImpose)) continue; sous = [sousImpose]; }
      else if (etat.couches >= 2 && accepteDessous(h)) sous = sous.concat(SOUS.filter(s => libre(s) && accepte(h, s)));
      const dessus = dessusImpose ? [dessusImpose] : etat.couches >= 3 ? [null].concat(DESSUS.filter(libre)) : [null];
      // Une couche manquante ne compte que si ce haut pouvait la recevoir.
      const objectif = 1 + (sous.length > 1 || sousImpose ? 1 : 0) + (dessus.length > 1 || dessusImpose ? 1 : 0);
      for (const b of listeBas) {
        if (!b) continue;
        if (ctx.actuel && ctx.actuel.bas === b.id && ctx.actuel.haut === h.id) continue;
        const s1 = accord(b, h);
        if (!s1) continue;
        let base = s1 * 10 - (ctx.usageBas.get(b.id) || 0) * 12;
        if (hors.includes(h.categorie)) base -= 6;
        if (hors.includes(b.categorie)) base -= 6;
        if (etat.couches >= 2 && PULL_CATS.includes(h.categorie)) base += 3; // en hiver, le pull mène
        // Rotation sur deux semaines d'après le journal, et goûts notés (J'aime / Pas pour moi).
        base -= fraicheur(h.id) * 10 + fraicheur(b.id) * 6;
        const gHB = gout("hb:" + h.id + "|" + b.id);
        if (gHB <= -2) continue;
        base += gHB * 3;
        if (pluie && T[b.teinte].clarte === "clair") base -= 12; // les bas clairs craignent les éclaboussures
        for (const v of ctx.voisins) {
          const hv = PAR_ID[v.haut];
          if (v.bas === b.id) base -= 15;
          if (hv && hv.categorie === h.categorie && hv.encolure === h.encolure) base -= 3;
          if (hv && hv.teinte === h.teinte) base -= 4;
        }
        if (ctx.actuel) {
          if (ctx.actuel.haut === h.id) base -= 8;
          if (ctx.actuel.bas === b.id) base -= 4;
        }
        for (const s of sous) {
          let ns = base;
          if (s) {
            const s2 = superposer(s, h).score;
            if (!s2) continue;
            ns += s2 * 6 - (ctx.usageDessous.get(s.id) || 0) * 6 - (voisinsSous.includes(s.id) ? 4 : 0);
            if (ctx.hautsAilleurs.has(s.id)) ns -= 8; // déjà portée en haut un autre jour
            const gSH = gout("sh:" + s.id + "|" + h.id);
            if (gSH <= -2) continue;
            ns += gSH * 2 - fraicheur(s.id) * 5;
          }
          for (const d of dessus) {
            let n = ns;
            if (d) {
              const s3 = surcouche(d, h, b, s).score;
              if (!s3) continue;
              n += s3 * 4 - (ctx.usageDessus.get(d.id) || 0) * 2 - fraicheur(d.id);
              const gDH = gout("dh:" + d.id + "|" + h.id);
              if (gDH <= -2) continue;
              n += gDH * 2;
              if (pluie) n += d.categorie === "vestes" ? -3 : 3;
            }
            const couches = 1 + (s ? 1 : 0) + (d ? 1 : 0);
            if (couches < objectif) n -= (objectif - couches) * 9;
            if (alea) n += Math.random() * 4;
            // Une chaîne vide marque une couche laissée de côté exprès : elle ne sera pas complétée plus tard.
            const t = { bas: b.id, haut: h.id };
            if (s) t.dessous = s.id; else if (sous.length > 1) t.dessous = "";
            if (d) t.dessus = d.id; else if (dessus.length > 1) t.dessus = "";
            res.push({ n, t });
          }
        }
      }
    }
    return res.sort((x, y) => y.n - x.n);
  }

  function composer(ctx) {
    const r = generer({}, ctx, true)[0];
    if (!r) return null;
    const p = choisirParmi(PIEDS, ctx.usagePieds, ctx.voisins.map(v => v.pieds), true);
    if (p) r.t.pieds = p;
    return r.t;
  }
  // Si tous les hauts sont déjà pris dans la semaine, on accepte d'en reporter un.
  const composerAvecRepli = ctx => composer(ctx) || composer(Object.assign({}, ctx, { hautsPris: new Set() }));

  // La meilleure pièce d'une liste selon un score d'accord, en faisant tourner les pièces.
  function meilleurePiece(liste, score, usage, poids, voisinsIds) {
    let choix = null, max = -Infinity;
    for (const a of liste) {
      if (!dispo(a)) continue;
      const s = score(a);
      if (!s) continue;
      let n = s * 10 - (usage.get(a.id) || 0) * poids + Math.random() * 3;
      if (voisinsIds.includes(a.id)) n -= 4;
      if (n > max) { max = n; choix = a.id; }
    }
    return choix;
  }
  // Complète une tenue sans toucher à son haut ni à son bas : pièces disparues retirées, puis
  // sous-couche et par-dessus selon les couches choisies, et chaussures.
  function completer(t, ctx) {
    let change = false;
    const h = PAR_ID[t.haut], b = PAR_ID[t.bas];
    const retirer = k => { delete t[k]; change = true; };
    // Une couche devenue impossible ou « à éviter » (pièce supprimée ou modifiée) est retirée…
    if (t.dessous && (!accepte(h, PAR_ID[t.dessous]) || !superposer(PAR_ID[t.dessous], h).score)) retirer("dessous");
    if (t.dessus && (!aRole(t.dessus, "dessus") || !surcouche(PAR_ID[t.dessus], h, b, PAR_ID[t.dessous]).score)) retirer("dessus");
    if (t.pieds && !aRole(t.pieds, "pieds")) retirer("pieds");
    if (t.accessoire && !PAR_ID[t.accessoire]) retirer("accessoire");
    // … puis remplacée ; une couche laissée de côté exprès (chaîne vide) le reste.
    if (t.dessous === undefined && etat.couches >= 2 && accepteDessous(h)) {
      const s = meilleurePiece(SOUS.filter(x => accepte(h, x)), x => superposer(x, h).score, ctx.usageDessous, 6, ctx.voisins.map(v => v.dessous));
      if (s) { t.dessous = s; change = true; }
    }
    if (t.dessus === undefined && etat.couches >= 3) {
      const d = meilleurePiece(DESSUS, x => surcouche(x, h, b, PAR_ID[t.dessous]).score, ctx.usageDessus, 2, ctx.voisins.map(v => v.dessus));
      if (d) { t.dessus = d; change = true; }
    }
    if (!t.pieds && PIEDS.length) {
      t.pieds = choisirParmi(PIEDS, ctx.usagePieds, ctx.voisins.map(v => v.pieds), true);
      change = true;
    }
    return change;
  }

  function compter(entrees, cle) {
    const m = new Map();
    entrees.forEach(t => { if (t[cle]) m.set(t[cle], (m.get(t[cle]) || 0) + 1); });
    return m;
  }
  const ctxVide = actuel => ({
    hautsPris: new Set(), hautsAilleurs: new Set(), usageBas: new Map(), usageDessous: new Map(), usageDessus: new Map(), usagePieds: new Map(),
    voisins: [], actuel: actuel || null, exclus: new Set(),
  });
  function contexteJour(j, actuel) {
    const ordre = JOURS.map(x => x[0]).filter(x => x === j || valide(etat.plan[x]));
    const i = ordre.indexOf(j);
    const autres = ordre.filter(x => x !== j).map(x => etat.plan[x]);
    return {
      // Une pièce portée en haut ou en sous-couche un autre jour n'est pas reprise comme haut.
      hautsPris: new Set(autres.flatMap(t => [t.haut, t.dessous]).filter(Boolean)),
      hautsAilleurs: new Set(autres.map(t => t.haut)),
      usageBas: compter(autres, "bas"),
      usageDessous: compter(autres, "dessous"),
      usageDessus: compter(autres, "dessus"),
      usagePieds: compter(autres, "pieds"),
      voisins: [etat.plan[ordre[i - 1]], etat.plan[ordre[i + 1]]].filter(Boolean),
      actuel: actuel || null,
      exclus: new Set(),
    };
  }
  function composerJour(j, actuel) {
    const t = composerAvecRepli(contexteJour(j, actuel));
    if (t) etat.plan[j] = t;
    else if (!actuel) delete etat.plan[j];
  }
  function composerSemaine() {
    etat.plan = {};
    JOURS.forEach(([j]) => { if (etat.jours.includes(j)) composerJour(j, null); });
    ecrire();
  }
  // Remet la semaine d'aplomb quand des pièces arrivent, changent ou disparaissent.
  function reconcilier() {
    const sur = etatAjouts === "ok";
    let change = false;
    for (const [j] of JOURS) {
      const t = etat.plan[j];
      if (!etat.jours.includes(j)) {
        if (t) { delete etat.plan[j]; change = true; }
        continue;
      }
      if (!t) { composerJour(j, null); change = true; continue; }
      if (!sur) continue; // ses pièces sont peut-être seulement pas encore chargées
      if (!valide(t)) { delete etat.plan[j]; composerJour(j, null); change = true; continue; }
      if (retirerCouchesEnTrop(t)) change = true;
      if (completer(t, contexteJour(j, null))) change = true;
    }
    if (sur) {
      if (apercu && !valide(apercu)) apercu = null;
      if (apercu) completer(apercu, ctxVide());
      const idee = ideeDuJour();
      if (idee && valide(idee) && (retirerCouchesEnTrop(idee) | completer(idee, ctxVide()))) change = true;
      if (choix.id && !PAR_ID[choix.id]) choix = { id: null, rang: 0, filtre: choix.filtre };
      if (etat.portee && !porteeId()) { etat.portee = null; change = true; }
      if (remplacerIndispo()) change = true;
    }
    if (change) ecrire();
  }
  // Une tenue qui contient une pièce au lavage : on recompose si c'est le haut ou le bas, sinon on
  // remplace seulement la pièce. Les jours passés et la tenue déjà notée aujourd'hui ne bougent pas.
  function reparer(t, ctx, recomposer) {
    if (auLavage(t.haut) || auLavage(t.bas)) { recomposer(); return true; }
    let change = false;
    for (const k of ["dessous", "dessus", "pieds", "accessoire"]) if (t[k] && auLavage(t[k])) { delete t[k]; change = true; }
    if (change) completer(t, ctx);
    return change;
  }
  function remplacerIndispo() {
    let change = false;
    const noteAujourdhui = !!donnees.journal[AUJ_DATE];
    JOURS.forEach(([j], i) => {
      const t = etat.plan[j];
      if (i < INDEX_AUJ || !valide(t) || (i === INDEX_AUJ && noteAujourdhui)) return;
      if (reparer(t, contexteJour(j, null), () => composerJour(j, null))) change = true;
    });
    const idee = ideeDuJour();
    if (!noteAujourdhui && valide(idee) && reparer(idee, ctxVide(), () => poserIdee(composerAvecRepli(ctxVide())))) change = true;
    if (etat.portee && auLavage(etat.portee.id)) { etat.portee = null; change = true; }
    return change;
  }
  // « Changer » sur une pièce de la tenue : la suivante qui va le mieux avec les autres pièces.
  function remplacerPiece(t, k, ctx) {
    const garder = {};
    ["bas", "haut", "dessous", "dessus"].forEach(x => { if (x !== k && t[x]) garder[x] = t[x]; });
    ctx.exclus = new Set([t[k]]);
    if (k === "pieds") {
      const p = choisirParmi(PIEDS.filter(x => x.id !== t.pieds), ctx.usagePieds, [], true);
      if (!p) return null;
      return Object.assign(copieTenue(t), { pieds: p });
    }
    if (k === "accessoire") { const n = copieTenue(t); delete n.accessoire; return n; }
    // Le haut change : la sous-couche peut ne plus convenir, on la laisse choisir à nouveau.
    if (k === "haut") delete garder.dessous;
    // On garde les autres couches tant que c'est possible, sinon on les laisse se rechoisir.
    const convient = x => (k === "dessous" || k === "dessus" ? !!x.t[k] : true);
    const relacher = ["dessus", "dessous"].filter(x => x !== k && garder[x]);
    let liste = generer(garder, ctx, true);
    while (!liste.some(convient) && relacher.length) { delete garder[relacher.shift()]; liste = generer(garder, ctx, true); }
    const r = liste.find(convient);
    if (!r) return null;
    const n = Object.assign({}, r.t);
    ["pieds", "accessoire"].forEach(x => { if (t[x] && x !== k) n[x] = t[x]; });
    if (!n.pieds && PIEDS.length) n.pieds = chaussuresPour(PAR_ID[n.bas]);
    return n;
  }
  // Couches au-delà du réglage (par exemple quand la saison change) ; la pièce portée aujourd'hui reste.
  function retirerCouchesEnTrop(t) {
    const garder = porteeId();
    let change = false;
    if (etat.couches < 2 && t.dessous !== undefined && t.dessous !== garder) { delete t.dessous; change = true; }
    if (etat.couches < 3 && t.dessus !== undefined && t.dessus !== garder) { delete t.dessus; change = true; }
    return change;
  }
  function changerCouches(n) {
    if (![1, 2, 3].includes(n) || n === etat.couches) return;
    etat.couches = n;
    etat.couchesChoisies = true;
    const sur = etatAjouts === "ok";
    const pid = porteeId();
    const ajuster = (t, ctx) => {
      if (!valide(t)) return t;
      // La tenue portée aujourd'hui est recomposée autour de la pièce choisie.
      if (sur && pid && contient(t, pid)) {
        const n2 = suggestionsAutour(PAR_ID[pid])[0];
        if (n2) return n2;
      }
      if (n < 2 || t.dessous === "") delete t.dessous;
      if (n < 3 || t.dessus === "") delete t.dessus;
      // Pendant le chargement, les pièces ajoutées sont inconnues : on ne complète qu'ensuite.
      if (sur) completer(t, ctx);
      return t;
    };
    JOURS.forEach(([j]) => { if (etat.plan[j]) etat.plan[j] = ajuster(etat.plan[j], contexteJour(j, null)); });
    if (ideeDuJour()) poserIdee(ajuster(ideeDuJour(), ctxVide()));
    if (apercu) apercu = ajuster(apercu, ctxVide());
    choix.rang = 0;
    ecrire();
  }

  // « Je veux porter… » : les meilleures tenues autour d'une pièce, sans hasard, toutes différentes.
  function suggestionsAutour(a) {
    const r = role(a);
    const essais = r === "bas" ? [{ bas: a.id }]
      : r === "haut" ? [{ haut: a.id }].concat(etat.couches >= 2 && peutEtreDessous(a) ? [{ dessous: a.id }] : [])
      : r === "dessus" ? [{ dessus: a.id }]
      : [{}]; // chaussures et accessoires : les tenues où leur couleur trouve sa place
    let toutes = essais.flatMap(c => generer(c, ctxVide(), false));
    if (r === "pieds" || r === "aucun") {
      toutes = toutes.map(x => { const k = touche(a, x.t); return { n: x.n + (k ? k.score : 2) * 6, t: x.t }; });
    }
    toutes.sort((x, y) => y.n - x.n);
    // Choix glouton : chaque suggestion paie les pièces déjà vues dans les précédentes,
    // pour varier le bas, le haut, la sous-couche et le par-dessus.
    const vus = { bas: new Map(), haut: new Map(), dessous: new Map(), dessus: new Map() };
    const poids = { bas: 8, haut: 7, dessous: 6, dessus: 3 };
    const pris = new Set(), liste = [];
    const candidats = toutes.slice(0, 400);
    while (liste.length < 5) {
      let meilleur = null, max = -Infinity;
      for (const x of candidats) {
        if (pris.has(x)) continue;
        let n = x.n;
        for (const k in vus) if (x.t[k]) n -= (vus[k].get(x.t[k]) || 0) * poids[k];
        if (n > max) { max = n; meilleur = x; }
      }
      if (!meilleur) break;
      pris.add(meilleur);
      for (const k in vus) if (meilleur.t[k]) vus[k].set(meilleur.t[k], (vus[k].get(meilleur.t[k]) || 0) + 1);
      const t = Object.assign({}, meilleur.t);
      if (r === "pieds") t.pieds = a.id;
      else if (PIEDS.length) t.pieds = chaussuresPour(PAR_ID[t.bas]);
      if (r === "aucun") t.accessoire = a.id;
      liste.push(t);
    }
    return liste;
  }
  // La meilleure tenue qui contient des pièces imposées (cases des tableaux d'accords).
  function meilleureAvec(contraintes) {
    const r = generer(contraintes, ctxVide(), false)[0];
    if (!r && contraintes.dessous) {
      // Superposition « à éviter » : on la montre quand même, sur la meilleure tenue de ce haut.
      const t = meilleureAvec({ haut: contraintes.haut });
      if (t) t.dessous = contraintes.dessous;
      return t;
    }
    const t = r ? Object.assign({}, r.t) : Object.assign({}, contraintes);
    if (!valide(t)) return null;
    if (!r) completer(t, ctxVide());
    else if (PIEDS.length) t.pieds = chaussuresPour(PAR_ID[t.bas]);
    return t;
  }

  // ---------- rendu ----------
  function rendreTete() {
    const marques = {};
    ARTICLES.forEach(a => { marques[a.marque] = (marques[a.marque] || 0) + 1; });
    const parMarque = Object.entries(marques).sort((x, y) => y[1] - x[1]).map(([m, n]) => `${esc(m)} ${n}`).join(" · ");
    let possibles = 0, sures = 0, superpositions = 0;
    BAS.forEach(b => HAUTS.forEach(h => { const s = accord(b, h); if (s > 0) possibles++; if (s === 2) sures++; }));
    HAUTS.forEach(h => SOUS.forEach(s => { if (accepte(h, s) && superposer(s, h).score > 0) superpositions++; }));
    F("sur-titre").textContent = `Achats magasin depuis ${D.depuis}`;
    F("resume").innerHTML =
      `<strong>${pluriel(ARTICLES.length, "pièce")}</strong> (${parMarque}). De quoi composer <strong>${pluriel(possibles, "tenue")}</strong> haut + bas, dont ${sures} valeur${sures > 1 ? "s" : ""} sûre${sures > 1 ? "s" : ""}` +
      (superpositions ? `, et ${pluriel(superpositions, "superposition")} sous-couche + haut. ` : ". ") +
      (PIEDS.length
        ? `Avec ${PIEDS.length > 1 ? "tes chaussures" : "ta paire de chaussures"}, chaque tenue peut être 100&nbsp;% magasin.`
        : `Il manque encore les chaussures pour une tenue 100&nbsp;% magasin.`);
    F("couverture").innerHTML = D.categories.map(c => {
      const n = ARTICLES.filter(a => a.categorie === c.id).length;
      if (c.optionnelle && !n) return "";
      return `<li class="${n ? "oui" : "non"}">${esc(c.nom)} <b>${n}</b></li>`;
    }).join("");
    F("date-du-jour").textContent = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  }

  function slot(a, etiquette, opts) {
    const o = opts || {};
    // Sur la tenue du jour : changer cette pièce seulement, ou la mettre au lavage (et la remplacer).
    const actions = o.k ? `<span class="slot-actions">
        <button class="lien-action" type="button" id="slot-changer-${o.k}" data-action="slot-changer" data-slot="${o.k}">Changer</button>
        ${peutNoter() && o.k !== "accessoire" ? `<button class="lien-action" type="button" id="slot-lavage-${o.k}" data-action="slot-lavage" data-slot="${o.k}">Au lavage</button>` : ""}
      </span>` : "";
    return `<figure class="slot${o.large ? " large" : ""}${o.mienne ? " mienne" : ""}${auLavage(a.id) ? " lavage" : ""}">
      <span class="couche">${esc(etiquette)}</span>
      <img src="${esc(a.image)}" alt="${esc(nomComplet(a))}" width="480" height="600">
      <figcaption>
        <span class="eyebrow">${esc(a.marque)}</span>
        <strong>${esc(a.modele || singulier(a.categorie))}</strong>
        <span class="couleur">${pastille(a)}${esc(a.couleur)}</span>
        ${o.mienne ? `<span class="tag-ajout">Ta pièce</span>` : ""}
        ${auLavage(a.id) ? `<span class="tag-ajout">Au lavage</span>` : ""}
        ${actions}
      </figcaption>
    </figure>`;
  }
  // Les pièces d'une tenue dans l'ordre où on les enfile : couches de la peau vers l'extérieur,
  // puis le bas, les chaussures et l'accessoire.
  function piecesTenue(t) {
    const couches = [["dessous", "Sous-couche"], ["haut", null], ["dessus", "Par-dessus"]].filter(([k]) => PAR_ID[t[k]]);
    const pieces = couches.map(([k, nom], i) => {
      const a = PAR_ID[t[k]];
      const libelle = nom || singulier(a.categorie);
      return { a, k, etiquette: couches.length > 1 ? `${i + 1} · ${libelle}` : libelle };
    });
    pieces.push({ a: PAR_ID[t.bas], k: "bas", etiquette: "Bas" });
    if (PAR_ID[t.pieds]) pieces.push({ a: PAR_ID[t.pieds], k: "pieds", etiquette: "Chaussures" });
    if (PAR_ID[t.accessoire]) pieces.push({ a: PAR_ID[t.accessoire], k: "accessoire", etiquette: "Accessoire" });
    return pieces;
  }
  const CHAUSSURES_A_TROUVER = `<div class="slot pieds">
      <span class="eyebrow">Chaussures</span>
      <strong>Pas encore de paire du magasin</strong>
      <p>C'est la prochaine pièce à trouver. <a href="#completer">Voir l'idée</a></p>
    </div>`;
  // Sur téléphone, deux pièces par ligne : une pièce seule sur sa ligne prend toute la largeur.
  function grilleTenue(t, mienne, avecActions) {
    const pieces = piecesTenue(t);
    const k = pieces.length;
    let html = pieces.map((p, i) => slot(p.a, p.etiquette, { large: k % 2 === 1 && i === k - 1, mienne: p.a.id === mienne, k: avecActions ? p.k : null })).join("");
    if (!PAR_ID[t.pieds]) html += CHAUSSURES_A_TROUVER;
    return { html, n: k + (PAR_ID[t.pieds] ? 0 : 1) };
  }
  function listeRaisons(ev) {
    return ev.raisons.map(r => {
      const niv = NIVEAUX[r.score];
      return `<li><span class="badge ${niv.cls}" title="${niv.nom}">${niv.sym}</span><span><b>${esc(r.titre)}</b> ${esc(r.note)}</span></li>`;
    }).join("");
  }
  function badgesTenue(t, ev) {
    const niv = NIVEAUX[ev.niveau];
    return `<span class="badge ${niv.cls}">${niv.sym} ${niv.nom}</span>` +
      (PAR_ID[t.pieds] ? `<span class="badge complet">100&nbsp;% magasin</span>` : "");
  }
  function aideCouches() {
    if (etat.couches >= 2 && !SOUS.length) return "Ajoute des chemises ou des t-shirts pour avoir une sous-couche.";
    if (etat.couches >= 3 && !DESSUS.length) return "Ajoute une veste, un blouson ou un manteau pour la 3e couche.";
    return "";
  }
  function rendreCouches(suffixe) {
    [1, 2, 3].forEach(n => { F(`couches-${suffixe}-${n}`).checked = etat.couches === n; });
    F(`couches-aide-${suffixe}`).textContent = aideCouches();
  }

  function tenueAffichee() {
    const pid = porteeId();
    const autour = t => (contient(t, pid) ? `Composée autour de : ${nomComplet(PAR_ID[pid])}.` : null);
    if (apercu && valide(apercu)) return { t: apercu, contexte: "Choisie dans un tableau d'accords." };
    apercu = null;
    const prevue = etat.plan[AUJ[0]];
    let contexte = `${AUJ[1]} n'est pas coché dans ta semaine, voici quand même une idée.`;
    if (etat.jours.includes(AUJ[0]) && prevue) {
      if (valide(prevue)) return { t: prevue, contexte: autour(prevue) || `Prévue dans ta semaine pour ${AUJ[1].toLowerCase()}.` };
      if (etatAjouts === "chargement") return null;
      contexte = "Ta tenue prévue aujourd'hui utilise une pièce ajoutée qui n'a pas pu être chargée. Voici une autre idée.";
    }
    let t = ideeDuJour();
    if (!valide(t)) {
      if (t && etatAjouts === "chargement") return null; // l'idée enregistrée attend ses pièces ajoutées
      t = composerAvecRepli(ctxVide());
      poserIdee(t);
      ecrire();
    }
    return t ? { t, contexte: autour(t) || contexte } : null;
  }

  function rendreTenue() {
    rendreCouches("tenue");
    const r = tenueAffichee();
    if (!r) {
      F("tenue-slots").style.setProperty("--n", 1);
      F("tenue-slots").innerHTML = `<p class="vide">Chargement des pièces ajoutées…</p>`;
      F("tenue-verdict").innerHTML = "";
      F("tenue-actions").innerHTML = "";
      F("tenue-raisons").innerHTML = "";
      return;
    }
    const { t, contexte } = r;
    const g = grilleTenue(t, null, !apercu), ev = noterTenue(t);
    F("tenue-slots").style.setProperty("--n", g.n);
    F("tenue-slots").dataset.n = g.n;
    F("tenue-slots").innerHTML = g.html;
    const note = donnees.journal[AUJ_DATE];
    const dejaNotee = note && cleTenue(note.tenue) === cleTenue(t);
    F("tenue-verdict").innerHTML = badgesTenue(t, ev) +
      (dejaNotee ? `<span class="badge porte">Portée aujourd'hui</span>` : "") +
      (donnees.favoris[idTenue(t)] ? `<span class="badge favori">Favori</span>` : "") + `<p>${esc(contexte)}</p>`;
    F("tenue-raisons").innerHTML = listeRaisons(ev);
    const ecrit = peutNoter();
    const boutons = [];
    if (apercu) boutons.push(`<button class="btn" type="button" id="retour-tenue" data-action="retour">Revenir à la tenue du jour</button>`);
    else if (ecrit) {
      boutons.push(dejaNotee
        ? `<button class="btn" type="button" id="porte" data-action="porte" aria-pressed="true">Portée ✓ (annuler)</button>`
        : `<button class="btn primaire" type="button" id="porte" data-action="porte" aria-pressed="false">${note ? "Remplacer dans le journal" : "Je l'ai portée"}</button>`);
    }
    if (ecrit) {
      boutons.push(`<button class="btn" type="button" id="favori-tenue" data-action="favori" data-cible="tenue" aria-pressed="${!!donnees.favoris[idTenue(t)]}">Favori</button>`);
      boutons.push(`<button class="btn" type="button" id="aime-tenue" data-action="aime" data-cible="tenue">J'aime</button>`);
      if (!apercu) boutons.push(`<button class="btn" type="button" id="aime-pas" data-action="aime-pas">Pas pour moi</button>`);
    }
    if (!apercu) boutons.push(`<button class="btn${ecrit ? "" : " primaire"}" type="button" id="autre-tenue" data-action="autre">Autre tenue</button>`);
    F("tenue-actions").innerHTML = boutons.join("");
  }
  function rendreMeteo() {
    const m = meteoDuJour();
    Object.keys(METEOS).forEach(v => { F("meteo-" + v).checked = m === v; });
    F("meteo-aide").textContent = m ? METEOS[m].aide : "Choisis la météo du jour : elle règle les couches et, sous la pluie, écarte les bas clairs.";
  }

  // Une ligne compacte : vignettes superposées, noms, niveau, et un bouton.
  function ligneTenue(t, eyebrow, bouton, classe) {
    const b = PAR_ID[t.bas], h = PAR_ID[t.haut], s = PAR_ID[t.dessous], d = PAR_ID[t.dessus];
    const niv = NIVEAUX[noterTenue(t).niveau];
    const vignettes = piecesTenue(t).map(p => `<img src="${esc(p.a.image)}" alt="" width="40" height="50" loading="lazy">`).join("");
    return `<li class="${classe || ""}">
      <div class="vignettes">${vignettes}</div>
      <div class="ligne-corps">
        ${eyebrow}
        <span class="noms">${esc(h.marque)} ${esc(court(h).toLowerCase())}${s ? ` <span>sur</span> ${esc(court(s).toLowerCase())}` : ""} <span>+</span> ${esc(b.marque)} ${esc(court(b))}${d ? ` <span>·</span> ${esc(court(d).toLowerCase())}` : ""}</span>
        <span><span class="badge ${niv.cls}">${niv.sym} ${niv.nom}</span></span>
      </div>
      ${bouton}
    </li>`;
  }

  function rendreSemaine() {
    JOURS.forEach(([j]) => { F("jour-" + j).checked = etat.jours.includes(j); });
    F("intro-semaine").textContent = "Coche tes jours de travail. Chaque jour reçoit un haut différent, et les bas tournent pour montrer toute la collection. " +
      (etat.couches === 1 ? "En une couche, les t-shirts passent avant les pulls." : "Avec plusieurs couches, les pulls passent avant les t-shirts portés seuls.");
    const jours = JOURS.filter(([j]) => etat.jours.includes(j) && etat.plan[j]);
    const liste = F("liste-semaine");
    if (!jours.length) {
      liste.innerHTML = `<li class="vide">Coche au moins un jour de travail pour composer ta semaine.</li>`;
      F("bilan-semaine").textContent = "";
      return;
    }
    liste.innerHTML = jours.map(([j, nomJour]) => {
      const t = etat.plan[j];
      const auj = j === AUJ[0];
      const eyebrow = `<span class="eyebrow">${esc(nomJour)}${auj ? " · aujourd'hui" : ""}</span>`;
      const i = JOURS.findIndex(x => x[0] === j), date = dateSemaine(i), note = donnees.journal[date];
      const porte = peutNoter() && i <= INDEX_AUJ && valide(t)
        ? `<button class="btn" type="button" id="porte-${j}" data-action="porte-jour" data-jour="${j}" aria-pressed="${!!note && cleTenue(note.tenue) === cleTenue(t)}" aria-label="Noter la tenue de ${esc(nomJour.toLowerCase())} comme portée">Portée</button>` : "";
      const bouton = `<span class="ligne-actions">${porte}<button class="btn" type="button" id="changer-${j}" data-action="changer" data-jour="${j}" aria-label="Changer la tenue de ${esc(nomJour.toLowerCase())}">Changer</button></span>`;
      if (!valide(t)) {
        const message = etatAjouts === "chargement"
          ? "Chargement des pièces ajoutées…"
          : "Cette tenue utilise une pièce ajoutée qui n'a pas pu être chargée.";
        return `<li class="${auj ? "aujourdhui" : ""}"><div class="vignettes"></div><div class="ligne-corps">${eyebrow}<span class="noms"><span>${message}</span></span></div>${etatAjouts === "chargement" ? "<span></span>" : bouton}</li>`;
      }
      return ligneTenue(t, eyebrow, bouton, auj ? "aujourdhui" : "");
    }).join("");
    const valides = jours.map(([j]) => etat.plan[j]).filter(valide);
    const hauts = new Set(valides.map(t => t.haut)).size;
    const bas = new Set(valides.map(t => t.bas)).size;
    const sous = new Set(valides.map(t => t.dessous).filter(Boolean)).size;
    F("bilan-semaine").textContent =
      `Cette semaine : ${hauts} haut${hauts > 1 ? "s" : ""} sur ${HAUTS.length} et ${bas} bas sur ${BAS.length} mis en avant` +
      (SOUS.length ? `, avec ${sous} sous-couche${sous > 1 ? "s" : ""} sur ${SOUS.length}.` : ".");
  }

  function rendreChoix() {
    rendreCouches("choix");
    const presentes = D.categories.filter(c => ARTICLES.some(a => a.categorie === c.id));
    if (choix.filtre !== "tout" && !presentes.some(c => c.id === choix.filtre)) choix.filtre = "tout";
    F("choix-filtres").innerHTML = [{ id: "tout", nom: "Tout" }].concat(presentes).map(c =>
      `<button type="button" id="choix-filtre-${c.id}" data-action="choix-filtre" data-filtre="${c.id}" aria-pressed="${c.id === choix.filtre}">${esc(c.nom)}</button>`
    ).join("");
    F("choix-pieces").innerHTML = ARTICLES.filter(a => choix.filtre === "tout" || a.categorie === choix.filtre).map(a =>
      `<button type="button" class="piece${auLavage(a.id) ? " lavage" : ""}" id="piece-${esc(a.id)}" data-action="choisir" data-id="${esc(a.id)}" aria-pressed="${a.id === choix.id}" title="${esc(nomComplet(a) + (auLavage(a.id) ? " (au lavage)" : ""))}" aria-label="${esc(nomComplet(a) + (auLavage(a.id) ? ", au lavage" : ""))}">
        <img src="${esc(a.image)}" alt="" width="56" height="70" loading="lazy">
      </button>`
    ).join("");
    const zone = F("choix-resultat");
    const a = PAR_ID[choix.id];
    if (!a) {
      zone.innerHTML = `<p class="vide">Touche la pièce qui te fait envie : la meilleure tenue autour d'elle s'affiche ici, avec d'autres idées.</p>`;
      return;
    }
    const liste = suggestionsAutour(a);
    if (!liste.length) {
      zone.innerHTML = `<p class="vide">Aucune tenue ne fonctionne autour de ${esc(nomComplet(a))} pour l'instant.</p>`;
      return;
    }
    if (choix.rang >= liste.length) choix.rang = 0;
    const t = liste[choix.rang];
    const g = grilleTenue(t, a.id), ev = noterTenue(t);
    const autres = liste.map((x, i) => [x, i]).filter(([, i]) => i !== choix.rang);
    zone.innerHTML = `
      <p class="choix-tete">Autour de : <strong>${esc(nomComplet(a))}</strong>${auLavage(a.id) ? " (cette pièce est au lavage)" : ""}</p>
      <div class="tenue" style="--n:${g.n}" data-n="${g.n}">${g.html}</div>
      <div class="verdict">
        <div class="verdict-texte">${badgesTenue(t, ev)}<p>Suggestion ${choix.rang + 1} sur ${liste.length}</p></div>
        <div class="actions">
          ${liste.length > 1 ? `<button class="btn" type="button" id="choix-autre" data-action="choix-autre">Autre suggestion</button>` : ""}
          ${peutNoter() ? `<button class="btn" type="button" id="favori-choix" data-action="favori" data-cible="choix" aria-pressed="${!!donnees.favoris[idTenue(t)]}">Favori</button>` : ""}
          <button class="btn primaire" type="button" id="choix-porter" data-action="choix-porter">Porter aujourd'hui</button>
        </div>
      </div>
      <ul class="raisons">${listeRaisons(ev)}</ul>
      ${autres.length ? `<h3 class="sous-titre">Autres idées autour de cette pièce</h3>
        <ol class="semaine">${autres.map(([x, i]) => ligneTenue(x, `<span class="eyebrow">Suggestion ${i + 1}</span>`,
          `<button class="btn" type="button" id="choix-voir-${i}" data-action="choix-voir" data-rang="${i}">Voir</button>`)).join("")}</ol>` : ""}`;
  }

  function rendreFavoris() {
    const liste = Object.entries(donnees.favoris).sort((x, y) => (y[1].ajouteLe || "").localeCompare(x[1].ajouteLe || ""));
    F("compte-favoris").textContent = pluriel(liste.length, "tenue");
    if (!liste.length) {
      F("liste-favoris").innerHTML = `<li class="vide">${peutNoter() ? "Touche « Favori » sur une tenue qui te plaît pour la retrouver ici." : "Aucune tenue favorite pour l'instant."}</li>`;
      return;
    }
    F("liste-favoris").innerHTML = liste.map(([id, f]) => {
      const retirer = peutNoter() ? `<button class="btn" type="button" id="fav-retirer-${id}" data-action="fav-retirer" data-id="${id}">Retirer</button>` : "";
      const eyebrow = `<span class="eyebrow">Favori${f.ajouteLe ? " depuis le " + esc(dateCourte(f.ajouteLe)) : ""}</span>`;
      if (!valide(f.tenue)) {
        return `<li><div class="vignettes"></div><div class="ligne-corps">${eyebrow}<span class="noms"><span>${etatAjouts === "chargement" ? "Chargement des pièces ajoutées…" : "Une pièce de cette tenue n'existe plus."}</span></span></div><span class="ligne-actions">${retirer}</span></li>`;
      }
      return ligneTenue(f.tenue, eyebrow, `<span class="ligne-actions"><button class="btn" type="button" id="fav-porter-${id}" data-action="fav-porter" data-id="${id}">Porter aujourd'hui</button>${retirer}</span>`);
    }).join("");
  }

  let moisJournal = AUJ_DATE.slice(0, 7);
  let jourJournal = AUJ_DATE;
  function rendreJournal() {
    const [an, mois] = moisJournal.split("-").map(Number);
    const premier = new Date(an, mois - 1, 1, 12);
    const nbJours = new Date(an, mois, 0).getDate();
    const decalage = (premier.getDay() + 6) % 7;
    const nomMois = premier.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    F("journal-mois").textContent = majuscule(nomMois);
    F("journal-suiv").disabled = moisJournal >= AUJ_DATE.slice(0, 7);
    const cases = ["L", "M", "M", "J", "V", "S", "D"].map(l => `<span class="jour-nom" aria-hidden="true">${l}</span>`);
    for (let i = 0; i < decalage; i++) cases.push(`<span class="jour-vide"></span>`);
    const duMois = [];
    for (let d = 1; d <= nbJours; d++) {
      const date = `${moisJournal}-${String(d).padStart(2, "0")}`;
      const e = donnees.journal[date];
      if (e) duMois.push(e);
      const h = e && PAR_ID[e.tenue.haut];
      cases.push(`<button type="button" class="jour${e ? " note" : ""}${date === AUJ_DATE ? " aujourdhui" : ""}" id="journal-${date}" data-action="journal-jour" data-date="${date}" aria-pressed="${date === jourJournal}" aria-label="${esc(dateLongue(date))}${e ? ", tenue notée" : ""}"${date > AUJ_DATE ? " disabled" : ""}>
        <span class="num">${d}</span>${h ? `<img src="${esc(h.image)}" alt="" width="36" height="45">` : ""}</button>`);
    }
    F("journal-grille").innerHTML = cases.join("");
    const pieces = new Set();
    duMois.forEach(e => SLOTS.forEach(k => { if (e.tenue[k]) pieces.add(e.tenue[k]); }));
    F("journal-bilan").textContent = duMois.length
      ? `${pluriel(duMois.length, "tenue")} notée${duMois.length > 1 ? "s" : ""} en ${nomMois.split(" ")[0]} · ${pluriel(pieces.size, "pièce")} différente${pieces.size > 1 ? "s" : ""} portée${pieces.size > 1 ? "s" : ""}.`
      : `Rien de noté en ${nomMois.split(" ")[0]} pour l'instant.`;
    // Détail du jour choisi
    const e = donnees.journal[jourJournal];
    let detail = `<h3 class="sous-titre">${esc(majuscule(dateLongue(jourJournal)))}</h3>`;
    if (e && valide(e.tenue)) {
      const g = grilleTenue(e.tenue, null), ev = noterTenue(e.tenue);
      detail += `<div class="tenue" style="--n:${g.n}" data-n="${g.n}">${g.html}</div>
        <div class="verdict"><div class="verdict-texte">${badgesTenue(e.tenue, ev)}${e.meteo ? `<p>Météo : ${esc(METEOS[e.meteo].nom.toLowerCase())}</p>` : ""}</div>
        <div class="actions">${peutNoter() ? `<button class="btn" type="button" id="journal-favori" data-action="favori" data-cible="journal" aria-pressed="${!!donnees.favoris[idTenue(e.tenue)]}">Favori</button>
          <button class="btn" type="button" id="journal-retirer" data-action="journal-retirer">Retirer du journal</button>` : ""}
          ${jourJournal !== AUJ_DATE ? `<button class="btn" type="button" id="journal-reporter" data-action="journal-reporter">Porter à nouveau aujourd'hui</button>` : ""}</div></div>`;
    } else if (e) {
      detail += `<p class="vide">${etatAjouts === "chargement" ? "Chargement des pièces ajoutées…" : "Une pièce de cette tenue n'existe plus."}</p>`;
    } else {
      detail += `<p class="vide">Rien de noté ce jour-là.${jourJournal === AUJ_DATE && peutNoter() ? " Touche « Je l'ai portée » sur la tenue du jour." : ""}</p>`;
    }
    F("journal-detail").innerHTML = detail;
    // Pièces oubliées : pas portées depuis trois semaines (ou jamais notées)
    const notees = Object.keys(donnees.journal).length;
    if (!notees) {
      F("oubliees").innerHTML = `<li class="vide">Note tes tenues quelques jours : la page te montrera ici les pièces que tu ne portes plus.</li>`;
      return;
    }
    const oubliees = ARTICLES.filter(a => role(a) !== "aucun" && dispo(a)).map(a => {
      const der = DERNIER.get(a.id);
      return { a, jours: der ? ecartJours(AUJ_DATE, der) : Infinity };
    }).filter(x => x.jours >= 21).sort((x, y) => y.jours - x.jours).slice(0, 8);
    F("oubliees").innerHTML = oubliees.length
      ? oubliees.map(({ a, jours }) => `<li>
          <img src="${esc(a.image)}" alt="" width="40" height="50" loading="lazy">
          <span><strong>${esc(nomComplet(a))}</strong><span class="mono">${jours === Infinity ? "Jamais notée dans le journal" : `Pas portée depuis ${jours} jours`}</span></span>
          <button class="btn petit" type="button" id="oubliee-${esc(a.id)}" data-action="choisir" data-id="${esc(a.id)}" data-depuis="catalogue">Porter avec…</button>
        </li>`).join("")
      : `<li class="vide">Aucune pièce oubliée : tout a été porté ces trois dernières semaines.</li>`;
  }

  function dateCourte(iso) {
    const d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  }

  let confirmation = null;       // pièce dont on confirme la suppression
  let erreurSuppression = null;  // { id, message } quand la suppression a échoué

  function fiche(a) {
    const r = role(a);
    const assoc = [];
    if (r === "bas") assoc.push(`Va avec ${HAUTS.filter(h => accord(a, h) > 0).length} hauts sur ${HAUTS.length}`);
    if (r === "haut") assoc.push(`Va avec ${BAS.filter(b => accord(b, a) > 0).length} bas sur ${BAS.length}`);
    if (peutEtreDessous(a)) {
      const n = HAUTS.filter(h => accepte(h, a) && superposer(a, h).score > 0).length;
      if (n) assoc.push(`se glisse sous ${pluriel(n, "haut")}`);
    }
    if (accepteDessous(a) && SOUS.length) {
      const n = SOUS.filter(s => accepte(a, s) && superposer(s, a).score > 0).length;
      if (n) assoc.push(`accepte ${pluriel(n, "sous-couche")}`);
    }
    const texteLien = a.ajoute ? `Fiche · ${a.site} ↗` : a.officiel ? `Fiche ${a.site} ↗` : `Fiche revendeur · ${a.site} ↗`;
    const lavage = peutNoter() && r !== "aucun"
      ? `<button class="btn petit" type="button" id="lavage-${esc(a.id)}" data-action="lavage" data-id="${esc(a.id)}" aria-pressed="${auLavage(a.id)}">Au lavage</button>` : "";
    const porter = `<button class="btn petit" type="button" id="porter-${esc(a.id)}" data-action="choisir" data-id="${esc(a.id)}" data-depuis="catalogue">Porter avec…</button>` + lavage;
    const ports = PORTS.get(a.id) || 0;
    let actions = `<div class="fiche-actions">${porter}</div>`;
    if (a.ajoute && peutEcrire) {
      actions = confirmation === a.id
        ? `<div class="fiche-actions"><p>Supprimer cette pièce et sa photo ?</p>
            ${erreurSuppression && erreurSuppression.id === a.id ? `<p class="form-erreur" role="alert">${esc(erreurSuppression.message)}</p>` : ""}
            <button class="btn petit danger plein" type="button" id="oui-${esc(a.id)}" data-action="confirmer-suppression" data-id="${esc(a.id)}">Supprimer</button>
            <button class="btn petit" type="button" id="non-${esc(a.id)}" data-action="annuler-suppression">Garder</button></div>`
        : `<div class="fiche-actions">${porter}
            <button class="btn petit" type="button" id="modifier-${esc(a.id)}" data-action="modifier" data-id="${esc(a.id)}">Modifier</button>
            <button class="btn petit danger" type="button" id="supprimer-${esc(a.id)}" data-action="supprimer" data-id="${esc(a.id)}">Supprimer</button></div>`;
    }
    return `<article class="fiche${auLavage(a.id) ? " lavage" : ""}">
      <img src="${esc(a.image)}" alt="${esc(nomComplet(a))}" width="480" height="600" loading="lazy">
      <div class="fiche-corps">
        <span class="eyebrow">${esc(a.marque)} · ${esc(singulier(a.categorie))}</span>
        <strong>${esc(a.modele || singulier(a.categorie))}</strong>
        <span class="couleur">${pastille(a)}${esc(a.couleur)}</span>
        ${a.coupe ? `<span class="coupe">${esc(a.coupe)}</span>` : ""}
        ${a.ref ? `<span class="mono">Réf. ${esc(a.ref)}</span>` : ""}
        ${a.ajoute ? `<span class="tag-ajout">Ajouté${a.ajouteLe ? " le " + esc(dateCourte(a.ajouteLe)) : ""}</span>` : ""}
        ${assoc.length ? `<span class="assoc">${majuscule(assoc.join(" · ").toLowerCase())}</span>` : ""}
        ${ports ? `<span class="assoc">Portée ${ports} fois · dernière fois le ${esc(dateCourte(DERNIER.get(a.id)))}</span>` : ""}
        ${auLavage(a.id) ? `<span class="tag-ajout">Au lavage</span>` : ""}
        ${a.lien ? `<a href="${esc(a.lien)}" target="_blank" rel="noopener noreferrer">${esc(texteLien)}</a>` : ""}
        ${actions}
      </div>
    </article>`;
  }

  function rendreCatalogue() {
    const presentes = D.categories.filter(c => ARTICLES.some(a => a.categorie === c.id));
    if (filtre !== "tout" && !presentes.some(c => c.id === filtre)) filtre = "tout";
    const options = [{ id: "tout", nom: "Tout", n: ARTICLES.length }]
      .concat(presentes.map(c => ({ id: c.id, nom: c.nom, n: ARTICLES.filter(a => a.categorie === c.id).length })));
    F("filtres").innerHTML = options.map(o =>
      `<button type="button" id="filtre-${o.id}" data-action="filtre" data-filtre="${o.id}" aria-pressed="${o.id === filtre}">${esc(o.nom)}<b>${o.n}</b></button>`
    ).join("");
    const liste = ARTICLES.filter(a => filtre === "tout" || a.categorie === filtre);
    F("compte-catalogue").textContent = pluriel(liste.length, "pièce");
    F("grille").innerHTML = liste.map(fiche).join("");
  }

  function tableAccords(lignes, colonnes, note, action, attributs, coin) {
    const tete = `<thead><tr><th scope="col" class="coin eyebrow">${coin}</th>${colonnes.map(h =>
      `<th scope="col"><img src="${esc(h.image)}" alt="" width="40" height="50" loading="lazy">${esc(court(h))}</th>`
    ).join("")}</tr></thead>`;
    const corps = `<tbody>${lignes.map(l => `<tr>
      <th scope="row"><span class="lig"><img src="${esc(l.image)}" alt="" width="32" height="40" loading="lazy">${esc(court(l))}</span></th>
      ${colonnes.map(c => {
        const score = note(l, c);
        if (score === null) return `<td><span class="cell na" title="Ne se porte pas ainsi">–</span></td>`;
        const niv = NIVEAUX[score];
        const label = `${court(c)} avec ${court(l)} : ${niv.nom}`;
        return `<td><button class="cell ${niv.cls}" type="button" data-action="${action}" ${attributs(l, c)} title="${esc(label)}" aria-label="${esc(label)}">${niv.sym}</button></td>`;
      }).join("")}
    </tr>`).join("")}</tbody>`;
    return tete + corps;
  }

  function rendreAccords() {
    let possibles = 0;
    BAS.forEach(b => HAUTS.forEach(h => { if (accord(b, h) > 0) possibles++; }));
    F("compte-accords").textContent = `${possibles} tenues possibles sur ${BAS.length * HAUTS.length}`;
    F("table-accords").innerHTML = tableAccords(BAS, HAUTS, accord, "voir",
      (b, h) => `data-bas="${esc(b.id)}" data-haut="${esc(h.id)}"`, "Bas \\ Haut");
    const porteurs = HAUTS.filter(accepteDessous);
    const avecSous = SOUS.length && porteurs.length;
    F("superpositions-vide").hidden = !!avecSous;
    F("superpositions-table").hidden = !avecSous;
    if (avecSous) {
      F("table-superpositions").innerHTML = tableAccords(SOUS, porteurs, (s, h) => (accepte(h, s) ? superposer(s, h).score : null), "voir-sup",
        (s, h) => `data-dessous="${esc(s.id)}" data-haut="${esc(h.id)}"`, "Sous-couche \\ Haut");
    }
  }

  function rendreCompleter() {
    const vides = D.aCompleter.filter(p => !ARTICLES.some(a => a.categorie === p.categorie));
    const coeur = D.categories.filter(c => !c.optionnelle);
    const couvertes = coeur.filter(c => ARTICLES.some(a => a.categorie === c.id)).length;
    F("compte-completer").textContent = `${couvertes} catégories couvertes sur ${coeur.length}`;
    F("priorites").innerHTML = vides.length
      ? vides.map((p, i) => `<li>
          <span class="rang" aria-hidden="true">${i + 1}</span>
          <h3>${esc(CAT[p.categorie].nom)} <span class="mono">0 pièce</span></h3>
          <p>${esc(p.pourquoi)}</p>
          <p class="idee"><b>Idée :</b> ${esc(p.idee)}</p>
        </li>`).join("")
      : `<li class="vide">Toutes les catégories sont couvertes : tu peux t'habiller 100&nbsp;% magasin de la tête aux pieds.</li>`;
  }

  function rendre(...parties) {
    const focus = document.activeElement && document.activeElement.id;
    parties.forEach(f => f());
    if (focus) {
      const el = F(focus);
      if (el && el !== document.activeElement) el.focus({ preventScroll: true });
    }
  }
  const rendreTout = () => rendre(rendreTete, rendreMeteo, rendreTenue, rendreChoix, rendreFavoris, rendreSemaine, rendreJournal, rendreCatalogue, rendreAccords, rendreCompleter);

  // Une photo stockée qui ne répond plus est remplacée par un aplat.
  document.addEventListener("error", e => {
    const img = e.target;
    if (img && img.tagName === "IMG" && img.src !== PHOTO_ABSENTE && img.getAttribute("src")) img.src = PHOTO_ABSENTE;
  }, true);

  // ---------- capacités de la page publiée : base de données et stockage des photos ----------
  let db = null, assets = null, peutEcrire = false;

  function texte(v, max) { return typeof v === "string" ? v.trim().slice(0, max) : ""; }
  const SUIVI = /^(utm_.*|fbclid|gclid|gclsrc|gbraid|wbraid|dclid|msclkid|igshid|_kx|mc_eid|srsltid|gad_source|gad_campaignid|pk_.*|cmpid|referer)$/i;
  function lienSur(v) {
    try {
      const u = new URL(String(v));
      if (u.protocol !== "https:" && u.protocol !== "http:") return null;
      [...u.searchParams.keys()].forEach(k => { if (SUIVI.test(k)) u.searchParams.delete(k); });
      return u.href;
    } catch (_) { return null; }
  }
  // Les documents de la base sont des données : tout est vérifié avant affichage.
  function depuisDb(doc) {
    const d = doc.exists ? doc.data() : null;
    if (!d) return null;
    const categorie = texte(d.categorie, 40), teinte = texte(d.teinte, 40), imageId = texte(d.image, 64);
    if (!possede(CAT, categorie) || !possede(T, teinte) || !ID_ASSET.test(imageId)) return null;
    const marque = texte(d.marque, 60), couleur = texte(d.couleur, 40);
    if (!marque || !couleur) return null;
    const lien = d.lien ? lienSur(d.lien) : null;
    // Les pièces enregistrées avant qu'un col soit reconnu retrouvent leur encolure depuis le modèle.
    const encolure = texte(d.encolure, 20) || devinerEncolure(texte(d.modele, 80), categorie) || "";
    return {
      id: "achat-" + doc.id, docId: doc.id, ajoute: true,
      categorie, marque, modele: texte(d.modele, 80), coupe: texte(d.coupe, 80), couleur, teinte,
      encolure: possede(ENCOLURES, encolure) ? encolure : undefined,
      ref: null, lien, site: lien ? new URL(lien).hostname.replace(/^www\./, "") : "",
      image: "/_blob/" + imageId, imageId, titre: texte(d.titre, 200), ajouteLe: texte(d.ajouteLe, 40),
    };
  }

  function surSnapshot(snap) {
    ajoutes = snap.docs.map(depuisDb).filter(Boolean)
      .sort((x, y) => x.ajouteLe.localeCompare(y.ajouteLe) || x.docId.localeCompare(y.docId));
    indexer();
    if (confirmation && !PAR_ID[confirmation]) confirmation = null;
    // Un instantané « fromCache » n'est pas encore définitif : il sert à l'affichage, pas à trancher.
    if (!(snap.metadata && snap.metadata.fromCache)) etatAjouts = "ok";
    if (etatAjouts === "ok" && edition && !PAR_ID[edition.id] && !envoiEnCours) {
      fermerPanneau();
      annonce("La pièce que tu modifiais a été supprimée.");
    }
    reconcilier();
    rendreTout();
  }

  // Écriture refusée pour des raisons de droits : la page repasse en lecture seule pour cette visite.
  function passerEnLecture() {
    peutEcrire = false;
    F("ouvrir-ajout").hidden = true;
    F("achat-envoyer").disabled = true;
    rendre(rendreCatalogue);
  }

  let reabonne = false;
  function abonner() {
    db.collection("achats").onSnapshot(surSnapshot, err => {
      if (err && err.code === "unavailable" && !reabonne) { reabonne = true; abonner(); return; }
      if (etatAjouts !== "ok") etatAjouts = "indisponible";
      if (!envoiEnCours) F("ajouter").hidden = true;
      peutEcrire = false;
      F("ouvrir-ajout").hidden = true;
      annonce("Les pièces ajoutées depuis la page ne se mettent plus à jour. Recharge la page pour les retrouver et en ajouter d'autres.");
      reconcilier();
      rendreTout();
    });
  }

  async function brancher() {
    const c = window.claude;
    if (!c || typeof c.use !== "function") return;
    let ns = [null, null, null];
    try { ns = await Promise.all([c.use("db"), c.use("assets"), c.use("user")]); } catch (_) { /* vue sans capacités */ }
    [db, assets] = ns;
    const user = ns[2];
    if (!db) {
      // Sans base, la page garde les données personnelles dans ce navigateur.
      etatAjouts = "indisponible";
      modeDonnees = "local";
      lireDonneesLocales();
      indexerJournal();
      reconcilier(); rendreTout();
      return;
    }
    abonner();
    // Sans la capacité user, la page ne sait pas qui regarde : elle ne propose pas l'écriture.
    const proprio = user ? await user.isOwner() : false;
    peutEcrireDonnees = proprio;
    modeDonnees = proprio ? "base" : "lecture";
    abonnerDonnees();
    peutEcrire = !!assets && proprio;
    F("ouvrir-ajout").hidden = !peutEcrire;
    if (peutEcrire) rendre(rendreCatalogue);
  }

  function abonnerDonnees() {
    const collection = nom => db.collection(nom).onSnapshot(snap => {
      const m = {};
      snap.docs.forEach(doc => { const x = doc.exists && LECTEURS[nom](doc.id, doc.data()); if (x) m[doc.id] = x; });
      donnees[nom] = m;
      if (nom === "journal") indexerJournal();
      if (nom === "pieces" && etatAjouts === "ok") reconcilier();
      planifierRendu();
    }, () => toast("Une partie de tes données n'a pas pu être chargée. Recharge la page.", "erreur"));
    ["journal", "pieces", "favoris"].forEach(collection);
    db.doc("gouts/accords").onSnapshot(snap => { donnees.gouts = lireGouts(snap.exists ? snap.data() : null); planifierRendu(); }, () => {});
    db.doc("etat/semaine").onSnapshot(surEtatDistant, () => {});
  }

  function annonce(msg, type) {
    F("annonce").textContent = msg;
    F("annonce").classList.toggle("ok", type === "ok");
  }

  // ---------- formulaire « Ajouter un achat » ----------
  const MOTS_CATEGORIE = [
    [/^(pantalons?|chinos?|cargos?|joggings?)$/, "pantalons"],
    [/^jeans?$/, "jeans"],
    [/^(pulls?|pull-overs?|pullovers?|gilets?|cardigans?|mailles?)$/, "pulls"],
    [/^(t-?shirts?|tee-?shirts?|tees?|debardeurs?)$/, "t-shirts"],
    [/^chemises?$/, "chemises"],
    [/^(vestes?|blazers?|surchemises?)$/, "vestes"],
    [/^(blousons?|doudounes?|bombers?|coupe-vents?|perfectos?)$/, "blousons"],
    [/^(manteaux|manteau|parkas?|cabans?|trenchs?|pardessus)$/, "manteaux"],
    [/^(chaussures?|baskets?|sneakers?|boots?|bottines?|mocassins?)$/, "chaussures"],
    [/^(sweats?|sweat-shirts?|sweatshirts?|hoodies?)$/, "sweats"],
    [/^polos?$/, "polos"],
    [/^(shorts?|bermudas?)$/, "shorts"],
    [/^(accessoires?|casquettes?|bonnets?|ceintures?|echarpes?|sacs?|chaussettes?|portefeuilles?)$/, "accessoires"],
  ];
  function devinerCategorie(mot) {
    const m = sansAccents(mot);
    for (const [re, id] of MOTS_CATEGORIE) if (re.test(m) || re.test(m.split(" ")[0])) return id;
    return "";
  }
  function devinerTeinte(couleur, categorie, modele) {
    const c = sansAccents(couleur);
    if (!c) return "";
    // Un jean, ou une pièce en denim (veste en jean, trucker), prend les teintes de denim.
    const jean = categorie === "jeans" || /\b(jean|denim|trucker)\b/.test(sansAccents(modele || ""));
    const haut = possede(CAT, categorie) && CAT[categorie].role === "haut";
    const regles = [
      ["carreaux|raye|rayee|rayures|motif|imprime|vichy|tartan|ecossais|camouflage|fleuri", "motif"],
      ["blanc casse|ecru|creme|ivoire|off.?white", "ecru"],
      ["marine|navy|bleu nuit|bleu fonce|brut|indigo|rinse", jean ? "denim-brut" : "marine"],
      ["bleu clair|bleu ciel|ciel|bleu pale|delave clair|bleach", jean ? "denim-clair" : "bleu-ciel"],
      ["bleu|denim|stone", jean ? "denim-moyen" : "bleu"],
      ["gris clair|gris perle|perle", "gris-clair"],
      ["gris fonce|anthracite|charbon", "gris-fonce"],
      ["gris|grise|chine", "gris-moyen"],
      ["noir|noire|black", "noir"],
      ["blanc|blanche|white", "blanc"],
      ["bordeaux|lie de vin|prune|burgundy|grenat", "bordeaux"],
      ["rose|pink", "rose"],
      ["rouge|red", "rouge"],
      ["vert|verte|kaki|olive|sapin|green", "vert"],
      ["marron|chocolat|brun|cognac|tabac|brown", "marron"],
      ["^beige$", haut ? "ecru" : "beige"],
      ["beige|camel|sable|taupe|mastic", "beige"],
      ["jaune|moutarde|yellow", "jaune"],
      ["orange|rouille|brique", "orange"],
      ["violet|violette|mauve|lilas|lavande", "violet"],
    ];
    for (const [mots, t] of regles) if (new RegExp("\\b(" + mots + ")s?\\b").test(c)) return t;
    return "";
  }
  function devinerEncolure(modele, categorie) {
    if (categorie !== "pulls" && categorie !== "sweats") return undefined;
    const m = sansAccents(modele);
    if (/zip|camionneur/.test(m)) return "zip";
    if (/polo/.test(m)) return "polo";
    if (/col v\b|v-neck/.test(m)) return "v";
    if (/capuche|hood/.test(m)) return "capuche";
    if (/roule|turtle|cheminee|col montant/.test(m)) return "roule";
    if (/rond|crew/.test(m)) return "rond";
    return undefined;
  }
  const COULEUR_EN_TETE = /^(noire?|blanc|blanche|bleu|gris|grise|beige|rouge|rose|verte?|kaki|marine|bordeaux|ecru|creme|ivoire|marron|chocolat|camel|sable|taupe|jaune|moutarde|orange|violet|mauve|brut|anthracite|olive|black|white|navy|carreaux|raye|rayee|rayures|vichy|motif)s?\b/;
  // « Tommy Jeans - Pull - 1_4 zip - Noir.png » → marque, catégorie, modèle, couleur.
  function analyserTitre(titre) {
    const t = titre.replace(/\.(png|jpe?g|webp|gif|heic|heif)$/i, "").replace(/(\d)_(\d)/g, "$1/$2").trim();
    const parts = t.split(/\s+[-–—]\s+/).map(s => s.trim()).filter(Boolean);
    const r = { marque: parts[0] || "", categorie: "", modele: "", couleur: "" };
    if (parts.length >= 2) r.categorie = devinerCategorie(parts[1]);
    if (parts.length >= 4) {
      r.couleur = parts[parts.length - 1];
      r.modele = parts.slice(2, -1).join(" - ");
    } else if (parts.length === 3) {
      // « Marque - Catégorie - X » : X est la couleur seulement s'il commence par un mot de couleur.
      if (COULEUR_EN_TETE.test(sansAccents(parts[2]))) r.couleur = parts[2]; else r.modele = parts[2];
    }
    return r;
  }

  const CHAMPS = ["achat-marque", "achat-categorie", "achat-modele", "achat-couleur", "achat-teinte", "achat-coupe", "achat-lien"];
  const touches = new Set();   // champs modifiés à la main : le titre ne les écrase plus
  let edition = null;          // pièce en cours de modification
  let photo = null;            // { img, url, w, h, fond }
  let cadrage = { zoom: 1, x: 0, y: 0 };
  let envoiEnCours = false;
  let titreAuto = "";          // titre posé à partir du nom de fichier, remplaçable par la photo suivante

  function remplirListes() {
    F("achat-categorie").innerHTML = `<option value="">Choisir…</option>` +
      D.categories.map(c => `<option value="${esc(c.id)}">${esc(c.nom)}</option>`).join("");
    F("achat-teinte").innerHTML = `<option value="">Choisir…</option>` +
      Object.entries(T).map(([id, t]) => `<option value="${esc(id)}">${esc(t.nom)}</option>`).join("");
  }
  function majPastille() {
    const t = F("achat-teinte").value;
    F("achat-teinte-pastille").style.background = possede(T, t) ? T[t].hex : "transparent";
  }
  function poser(id, v) { if (!touches.has(id)) F(id).value = v; }
  function teinteAuto() {
    if (!touches.has("achat-teinte")) F("achat-teinte").value = devinerTeinte(F("achat-couleur").value, F("achat-categorie").value, F("achat-modele").value);
    majPastille();
  }
  function depuisTitre() {
    const r = analyserTitre(F("achat-titre").value);
    poser("achat-marque", r.marque);
    poser("achat-categorie", r.categorie);
    poser("achat-modele", r.modele);
    poser("achat-couleur", r.couleur);
    teinteAuto();
  }
  function erreur(msg) { F("achat-erreur").textContent = msg; }
  function succes(msg) { F("achat-ok").textContent = msg; }

  // Recadrage : la photo couvre un cadre 4:5 de 480 × 600 px, déplaçable et zoomable.
  const SORTIE = { w: 480, h: 600 };
  function bornerCadrage() {
    const s = Math.max(SORTIE.w / photo.w, SORTIE.h / photo.h) * cadrage.zoom;
    const mx = Math.abs(photo.w * s - SORTIE.w) / 2, my = Math.abs(photo.h * s - SORTIE.h) / 2;
    cadrage.x = Math.max(-mx, Math.min(mx, cadrage.x));
    cadrage.y = Math.max(-my, Math.min(my, cadrage.y));
    return s;
  }
  function dessiner() {
    if (!photo) return;
    const s = bornerCadrage();
    const ctx = F("apercu-photo").getContext("2d");
    const dw = photo.w * s, dh = photo.h * s;
    ctx.fillStyle = photo.fond;
    ctx.fillRect(0, 0, SORTIE.w, SORTIE.h);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(photo.img, (SORTIE.w - dw) / 2 + cadrage.x, (SORTIE.h - dh) / 2 + cadrage.y, dw, dh);
  }
  function couleurDeFond(img) {
    try {
      const c = document.createElement("canvas");
      c.width = 8; c.height = 8;
      const x = c.getContext("2d");
      x.fillStyle = "#ffffff";
      x.fillRect(0, 0, 8, 8);
      x.drawImage(img, 0, 0, 8, 8);
      const px = [[0, 0], [7, 0], [0, 7], [7, 7]].map(([i, j]) => x.getImageData(i, j, 1, 1).data);
      const moy = k => Math.round(px.reduce((s, p) => s + p[k], 0) / px.length);
      return `rgb(${moy(0)}, ${moy(1)}, ${moy(2)})`;
    } catch (_) { return "#ffffff"; }
  }
  function oublierPhoto() {
    if (photo) URL.revokeObjectURL(photo.url);
    photo = null;
    F("cadre").hidden = true;
  }
  function chargerPhoto(fichier) {
    erreur("");
    if (!/^image\//.test(fichier.type) && !/\.(png|jpe?g|webp|gif|heic|heif)$/i.test(fichier.name)) {
      erreur("Choisis un fichier image (PNG ou JPEG).");
      return;
    }
    oublierPhoto();
    const url = URL.createObjectURL(fichier);
    const img = new Image();
    img.onload = () => {
      photo = { img, url, w: img.naturalWidth, h: img.naturalHeight, fond: couleurDeFond(img) };
      cadrage = { zoom: 1, x: 0, y: 0 };
      F("achat-zoom").value = "1";
      F("cadre").hidden = false;
      dessiner();
      // Le nom de fichier ne sert de titre que s'il suit le format Canva (pas « IMG_2041 »).
      const actuel = F("achat-titre").value.trim();
      if (!actuel || actuel === titreAuto) {
        const nom = fichier.name.replace(/\.[^.]+$/, "").replace(/(\d)_(\d)/g, "$1/$2").trim();
        titreAuto = /\s[-–—]\s/.test(nom) ? nom : "";
        F("achat-titre").value = titreAuto;
        depuisTitre();
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      erreur("Cette photo n'a pas pu être lue. Essaie avec une capture en PNG ou en JPEG.");
    };
    img.src = url;
  }
  function exporterPhoto() {
    return new Promise((ok, ko) => F("apercu-photo").toBlob(b => (b ? ok(b) : ko({ code: "export" })), "image/jpeg", 0.86));
  }

  function reinitialiser() {
    F("form-achat").reset();
    touches.clear();
    oublierPhoto();
    edition = null;
    titreAuto = "";
    F("photo-actuelle").hidden = true;
    F("titre-ajouter").textContent = "Ajouter un achat";
    F("achat-envoyer").textContent = "Ajouter à la garde-robe";
    erreur("");
    majPastille();
  }
  function ouvrirPanneau() {
    F("ajouter").hidden = false;
    F("ajouter").scrollIntoView({ block: "start" });
    F(edition ? "achat-titre" : "achat-photo").focus({ preventScroll: true });
  }
  function fermerPanneau() {
    reinitialiser();
    succes("");
    F("ajouter").hidden = true;
    F("ouvrir-ajout").focus({ preventScroll: true });
  }
  function ouvrirEdition(a) {
    reinitialiser();
    succes("");
    edition = a;
    F("achat-titre").value = a.titre;
    const valeurs = { "achat-marque": a.marque, "achat-categorie": a.categorie, "achat-modele": a.modele, "achat-couleur": a.couleur, "achat-teinte": a.teinte, "achat-coupe": a.coupe, "achat-lien": a.lien || "" };
    CHAMPS.forEach(id => { F(id).value = valeurs[id]; touches.add(id); });
    majPastille();
    F("photo-actuelle-img").src = a.image;
    F("photo-actuelle").hidden = false;
    F("titre-ajouter").textContent = "Modifier une pièce";
    F("achat-envoyer").textContent = "Enregistrer";
    ouvrirPanneau();
  }

  function lireFormulaire() {
    const v = {
      marque: F("achat-marque").value.trim(),
      categorie: F("achat-categorie").value,
      modele: F("achat-modele").value.trim(),
      couleur: F("achat-couleur").value.trim(),
      teinte: F("achat-teinte").value,
      coupe: F("achat-coupe").value.trim(),
      lien: F("achat-lien").value.trim(),
    };
    if (!v.marque) return { manque: "Indique la marque." };
    if (!possede(CAT, v.categorie)) return { manque: "Choisis la catégorie." };
    if (!v.couleur) return { manque: "Indique la couleur." };
    if (!possede(T, v.teinte)) return { manque: "Choisis la couleur utilisée pour les accords." };
    if (v.lien && !lienSur(v.lien)) return { manque: "Le lien doit commencer par https://." };
    if (!photo && !edition) return { manque: "Ajoute une photo." };
    v.lien = v.lien ? lienSur(v.lien) : "";
    v.titre = F("achat-titre").value.trim() ||
      [v.marque, singulier(v.categorie), v.modele, v.couleur].filter(Boolean).join(" - ");
    return { v };
  }

  const pause = ms => new Promise(r => setTimeout(r, ms));
  // Un seul nouvel essai, et seulement pour les pannes passagères.
  async function appel(fn, codesPassagers) {
    try { return await fn(); } catch (e) {
      if (!e || !codesPassagers.includes(e.code)) throw e;
      await pause(400 + Math.random() * 600);
      return fn();
    }
  }
  function messageErreur(e) {
    const code = e && e.code;
    const messages = {
      too_large: "La photo est trop lourde. Choisis une image plus petite.",
      unsupported_type: "Ce format de photo n'est pas accepté. Utilise un PNG ou un JPEG.",
      quota_or_state: "Le stockage des photos de la page est plein. Supprime des pièces avant d'en ajouter.",
      quota_exceeded: "La base de la page est pleine. Supprime des pièces avant d'en ajouter.",
      rate_limited: "Trop d'envois d'un coup. Attends un instant puis réessaie.",
      resource_exhausted: "Trop d'envois d'un coup. Attends un instant puis réessaie.",
      upstream_auth: "Ta session a expiré. Recharge la page puis réessaie.",
      revoked: "L'accès à la page a changé. Recharge-la.",
      invalid_argument: "L'enregistrement a été refusé : seul le propriétaire de la page peut ajouter ou modifier des pièces.",
      not_granted: "L'ajout de pièces n'est pas disponible dans cette vue de la page.",
      capability_disabled: "L'ajout de pièces n'est pas disponible dans cette vue de la page.",
      capability_removed: "L'ajout de pièces n'est pas disponible dans cette vue de la page.",
      export: "La photo recadrée n'a pas pu être préparée. Choisis-la à nouveau.",
    };
    return messages[code] || "L'enregistrement n'a pas abouti. Réessaie dans un instant.";
  }

  const CODES_DROITS = ["invalid_argument", "not_granted", "capability_disabled", "capability_removed"];

  // Supprime une photo qu'aucune pièce ne cite plus ; prévient si le stockage refuse.
  function supprimerPhoto(id, silencieux) {
    return appel(() => assets.delete(id), ["store_unavailable", "rate_limited"]).catch(() => {
      if (!silencieux) annonce("La pièce est à jour, mais son ancienne photo n'a pas pu être effacée du stockage de la page.");
    });
  }

  function occupe(oui) {
    envoiEnCours = oui;
    F("achat-envoyer").disabled = oui || !peutEcrire;
    F("achat-envoyer").textContent = oui ? "Envoi…" : edition ? "Enregistrer" : "Ajouter à la garde-robe";
    F("fermer-ajout").disabled = oui;
    F("achat-annuler").disabled = oui;
  }

  async function envoyer(e) {
    e.preventDefault();
    if (envoiEnCours || !db || !assets || !peutEcrire) return;
    const { v, manque } = lireFormulaire();
    if (manque) { erreur(manque); succes(""); return; }
    const enEdition = edition;
    const courant = enEdition ? PAR_ID[enEdition.id] : null;
    if (enEdition && !courant) { erreur("Cette pièce a été supprimée entre-temps : il n'y a plus rien à modifier."); return; }
    occupe(true);
    erreur(""); succes("");
    let nouvelleImage = null, ref = null, corps = null, aboutie = false, echec = null;
    try {
      if (photo) {
        const blob = await exporterPhoto();
        nouvelleImage = (await appel(() => assets.upload(blob, { type: "image/jpeg" }), ["store_unavailable"])).id;
      }
      const maintenant = new Date().toISOString();
      corps = {
        titre: v.titre, marque: v.marque, categorie: v.categorie, modele: v.modele,
        couleur: v.couleur, teinte: v.teinte, coupe: v.coupe, lien: v.lien,
        image: nouvelleImage || courant.imageId,
        encolure: devinerEncolure(v.modele, v.categorie) || null,
      };
      if (enEdition) corps.modifieLe = maintenant; else corps.ajouteLe = maintenant;
      // Une modification passe par update, qui refuse de recréer une pièce supprimée entre-temps.
      ref = enEdition ? db.doc("achats/" + enEdition.docId) : db.collection("achats").doc();
      await appel(() => (enEdition ? ref.update(corps) : ref.set(corps)), ["unavailable"]);
      aboutie = true;
    } catch (err) {
      echec = err;
      // Une écriture peut aboutir même si sa réponse se perd : on relit le document avant de conclure.
      if (ref && corps) {
        const lu = await ref.get().catch(() => null);
        const d = lu && lu.exists ? lu.data() : null;
        const repere = enEdition ? "modifieLe" : "ajouteLe";
        if (d && d[repere] === corps[repere] && d.image === corps.image) aboutie = true;
        else if (nouvelleImage && lu) supprimerPhoto(nouvelleImage, true);
      } else if (nouvelleImage) {
        supprimerPhoto(nouvelleImage, true);
      }
    }
    occupe(false);
    if (!aboutie) {
      if (enEdition && !PAR_ID[enEdition.id]) erreur("Cette pièce a été supprimée entre-temps : il n'y a plus rien à modifier.");
      else erreur(messageErreur(echec));
      if (echec && CODES_DROITS.includes(echec.code)) passerEnLecture();
      return;
    }
    if (enEdition && nouvelleImage) supprimerPhoto(courant.imageId);
    const nom = [v.marque, v.modele || singulier(v.categorie), v.couleur].join(" ");
    reinitialiser();
    if (enEdition) {
      F("ajouter").hidden = true;
      annonce(`Modifié : ${nom}.`, "ok");
      const fiche = F("modifier-" + enEdition.id);
      if (fiche) {
        fiche.focus({ preventScroll: true });
        fiche.closest(".fiche").scrollIntoView({ block: "center" });
      }
    } else {
      succes(CAT[v.categorie].role === "aucun"
        ? `Ajouté : ${nom}. La pièce est dans le catalogue.`
        : `Ajouté : ${nom}. La pièce est dans le catalogue et entre dans la composition des tenues.`);
      F("achat-photo").focus({ preventScroll: true });
    }
  }

  async function supprimer(id) {
    const a = PAR_ID[id];
    if (!a || !a.ajoute || !db || !peutEcrire) return;
    erreurSuppression = null;
    if (envoiEnCours && edition && edition.docId === a.docId) {
      erreurSuppression = { id, message: "Attends la fin de l'enregistrement de cette pièce avant de la supprimer." };
      return;
    }
    try {
      await appel(() => db.doc("achats/" + a.docId).delete(), ["unavailable"]);
    } catch (err) {
      erreurSuppression = {
        id,
        message: err && CODES_DROITS.includes(err.code)
          ? "Tu n'as pas le droit de supprimer des pièces de cette page."
          : "La pièce n'a pas pu être supprimée. Réessaie dans un instant.",
      };
      if (err && CODES_DROITS.includes(err.code)) passerEnLecture();
      return;
    }
    confirmation = null;
    if (edition && edition.id === id) { fermerPanneau(); annonce("La pièce que tu modifiais a été supprimée."); }
    if (assets) {
      appel(() => assets.delete(a.imageId), ["store_unavailable", "rate_limited"])
        .catch(() => annonce("La pièce est supprimée, mais sa photo n'a pas pu être effacée du stockage de la page."));
    }
  }

  // Glisser pour cadrer (souris et doigt), flèches au clavier.
  (function cadrageInteractif() {
    const cv = F("apercu-photo");
    const doigts = new Map();
    let geste = null;
    const ZOOM_MIN = 0.5, ZOOM_MAX = 3;
    function zoomer(z) {
      z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
      // Le décalage suit le zoom pour que le point centré reste au centre.
      cadrage.x *= z / cadrage.zoom;
      cadrage.y *= z / cadrage.zoom;
      cadrage.zoom = z;
      F("achat-zoom").value = String(z);
      dessiner();
    }
    function demarrer() {
      const pts = [...doigts.values()];
      const k = SORTIE.w / cv.clientWidth;
      if (pts.length === 1) geste = { type: "glisser", x: pts[0].x, y: pts[0].y, cx: cadrage.x, cy: cadrage.y, k };
      else if (pts.length === 2) geste = { type: "pincer", d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1, z: cadrage.zoom };
      else geste = null;
    }
    cv.addEventListener("pointerdown", e => {
      if (!photo || doigts.size >= 2) return;
      doigts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { cv.setPointerCapture(e.pointerId); } catch (_) { /* pointeur déjà relâché */ }
      demarrer();
    });
    cv.addEventListener("pointermove", e => {
      if (!doigts.has(e.pointerId) || !geste) return;
      doigts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const pts = [...doigts.values()];
      if (geste.type === "glisser") {
        cadrage.x = geste.cx + (pts[0].x - geste.x) * geste.k;
        cadrage.y = geste.cy + (pts[0].y - geste.y) * geste.k;
        dessiner();
      } else if (geste.type === "pincer" && pts.length === 2) {
        zoomer(geste.z * Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) / geste.d);
      }
    });
    const fin = e => {
      if (!doigts.delete(e.pointerId)) return;
      demarrer(); // le doigt restant reprend le glisser là où en est la photo
    };
    cv.addEventListener("pointerup", fin);
    cv.addEventListener("pointercancel", fin);
    cv.addEventListener("keydown", e => {
      const pas = e.shiftKey ? 40 : 10;
      const d = { ArrowLeft: [-pas, 0], ArrowRight: [pas, 0], ArrowUp: [0, -pas], ArrowDown: [0, pas] }[e.key];
      if (!d || !photo) return;
      e.preventDefault();
      cadrage.x += d[0]; cadrage.y += d[1];
      dessiner();
    });
    F("achat-zoom").addEventListener("input", e => { if (photo) zoomer(Number(e.target.value) || 1); });
  })();

  F("achat-photo").addEventListener("change", e => { const f = e.target.files && e.target.files[0]; if (f) chargerPhoto(f); });
  const depot = F("depot");
  depot.addEventListener("dragover", e => { e.preventDefault(); depot.classList.add("survol"); });
  depot.addEventListener("dragleave", () => depot.classList.remove("survol"));
  depot.addEventListener("drop", e => {
    e.preventDefault();
    depot.classList.remove("survol");
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) chargerPhoto(f);
  });
  F("achat-titre").addEventListener("input", depuisTitre);
  CHAMPS.forEach(id => F(id).addEventListener("input", () => {
    touches.add(id);
    if (id === "achat-couleur" || id === "achat-categorie" || id === "achat-modele") teinteAuto();
    if (id === "achat-teinte") majPastille();
  }));
  F("form-achat").addEventListener("submit", envoyer);

  // ---------- interactions ----------
  F("jours").addEventListener("change", e => {
    const j = e.target.value;
    if (e.target.checked) {
      if (!etat.jours.includes(j)) etat.jours.push(j);
      // Cocher aujourd'hui garde la tenue déjà affichée (l'idée du jour, ou la tenue portée).
      if (j === AUJ[0] && valide(ideeDuJour())) { etat.plan[j] = ideeDuJour(); poserIdee(null); }
      else composerJour(j, null);
    } else {
      etat.jours = etat.jours.filter(x => x !== j);
      delete etat.plan[j];
    }
    ecrire();
    rendre(rendreSemaine, rendreTenue);
  });

  // Mettre une tenue pour aujourd'hui (depuis « Je veux porter », un favori ou le journal).
  function porterAujourdhui(t, pieceId) {
    apercu = null;
    const n = copieTenue(t);
    if (etat.jours.includes(AUJ[0])) etat.plan[AUJ[0]] = n;
    else poserIdee(n);
    etat.portee = pieceId ? { date: AUJ_DATE, id: pieceId } : null;
    ecrire();
    rendre(rendreTenue, rendreSemaine);
    F("tenue").scrollIntoView({ block: "start" });
    const b = F("autre-tenue");
    if (b) b.focus({ preventScroll: true });
  }
  // La tenue affichée dans une section : tenue du jour, suggestion de « Je veux porter », jour du journal.
  function tenueDe(cible) {
    if (cible === "choix") { const a = PAR_ID[choix.id]; return a ? suggestionsAutour(a)[choix.rang] : null; }
    if (cible === "journal") { const e = donnees.journal[jourJournal]; return e ? e.tenue : null; }
    const r = tenueAffichee();
    return r ? r.t : null;
  }
  // La tenue du jour modifiable : celle de la semaine si aujourd'hui est coché, sinon l'idée du jour.
  function remplacerTenueDuJour(n) {
    if (etat.jours.includes(AUJ[0]) && valide(etat.plan[AUJ[0]])) etat.plan[AUJ[0]] = n;
    else poserIdee(n);
  }
  function noterGouts(t, delta) {
    const paires = Object.assign({}, donnees.gouts);
    const cles = ["hb:" + t.haut + "|" + t.bas];
    if (t.dessous) cles.push("sh:" + t.dessous + "|" + t.haut);
    if (t.dessus) cles.push("dh:" + t.dessus + "|" + t.haut);
    cles.forEach(c => { const v = Math.max(-3, Math.min(3, (paires[c] || 0) + delta)); if (v) paires[c] = v; else delete paires[c]; });
    return enregistrer("gouts", "accords", { paires });
  }
  function basculerJournal(date, t) {
    const e = donnees.journal[date];
    if (e && cleTenue(e.tenue) === cleTenue(t)) {
      enregistrer("journal", date, null).catch(() => {});
      toast("Retirée du journal.");
    } else {
      enregistrer("journal", date, { date, tenue: copieTenue(t), meteo: date === AUJ_DATE ? meteoDuJour() : null }).catch(() => {});
      toast(e ? "Journal mis à jour." : "Notée dans le journal.");
    }
  }

  F("meteo").addEventListener("change", e => {
    const v = e.target.value;
    if (!possede(METEOS, v)) return;
    etat.meteo = { date: AUJ_DATE, valeur: v };
    changerCouches(METEOS[v].couches);
    // La tenue du jour s'adapte, sauf si elle est déjà notée ou choisie autour d'une pièce.
    const t = tenueAffichee();
    if (t && !donnees.journal[AUJ_DATE] && !porteeId() && !apercu) {
      if (etat.jours.includes(AUJ[0]) && valide(etat.plan[AUJ[0]])) composerJour(AUJ[0], null);
      else poserIdee(composerAvecRepli(ctxVide()));
    }
    ecrire();
    rendre(rendreMeteo, rendreTenue, rendreChoix, rendreSemaine);
  });

  ["tenue", "choix"].forEach(suffixe => F(`couches-${suffixe}`).addEventListener("change", e => {
    // Le réglage touché reste sous le doigt même si la tenue au-dessus change de hauteur.
    const repere = F(`couches-${suffixe}`), avant = repere.getBoundingClientRect().top;
    changerCouches(Number(e.target.value));
    rendre(rendreTenue, rendreChoix, rendreSemaine);
    window.scrollBy(0, repere.getBoundingClientRect().top - avant);
  }));

  function choisirPiece(id, depuisCatalogue) {
    if (!PAR_ID[id]) return;
    choix.id = id;
    choix.rang = 0;
    if (depuisCatalogue && choix.filtre !== "tout" && PAR_ID[id].categorie !== choix.filtre) choix.filtre = "tout";
    rendre(rendreChoix);
    if (depuisCatalogue) {
      // Depuis le catalogue, on arrive directement sur la tenue proposée.
      F("choix-resultat").scrollIntoView({ block: "start" });
      const b = F("piece-" + id);
      if (b) b.focus({ preventScroll: true });
    } else if (F("choix-resultat").getBoundingClientRect().top > window.innerHeight * 0.7) {
      // Sur téléphone, la tenue s'affiche sous la grille : on l'amène à l'écran.
      F("choix-resultat").scrollIntoView({ block: "start" });
    }
  }

  document.addEventListener("click", e => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const action = el.dataset.action;
    // Pendant un envoi, le formulaire ne se ferme pas et ne change pas de pièce.
    if (envoiEnCours && ["ouvrir-ajout", "fermer-ajout", "annuler-ajout", "modifier"].includes(action)) return;
    if (action === "recomposer") { composerSemaine(); rendre(rendreSemaine, rendreTenue); }
    else if (action === "changer") {
      const j = el.dataset.jour;
      if (valide(etat.plan[j])) composerJour(j, etat.plan[j]);
      else if (etatAjouts !== "chargement") { delete etat.plan[j]; composerJour(j, null); }
      else return;
      ecrire();
      rendre(rendreSemaine, rendreTenue);
    }
    else if (action === "autre") {
      etat.portee = null;
      apercu = null;
      if (etat.jours.includes(AUJ[0]) && valide(etat.plan[AUJ[0]])) composerJour(AUJ[0], etat.plan[AUJ[0]]);
      else poserIdee(composer(ctxVide(ideeDuJour())) || ideeDuJour());
      ecrire();
      rendre(rendreSemaine, rendreTenue);
    }
    else if (action === "retour") {
      apercu = null;
      rendre(rendreTenue);
      const b = F("autre-tenue");
      if (b) b.focus({ preventScroll: true });
    }
    else if (action === "voir" || action === "voir-sup") {
      const contraintes = action === "voir"
        ? { bas: el.dataset.bas, haut: el.dataset.haut }
        : { dessous: el.dataset.dessous, haut: el.dataset.haut };
      const t = meilleureAvec(contraintes);
      if (!t) return;
      apercu = t;
      rendre(rendreTenue);
      F("tenue").scrollIntoView({ block: "start" });
    }
    else if (action === "choisir") choisirPiece(el.dataset.id, el.dataset.depuis === "catalogue");
    else if (action === "choix-filtre") { choix.filtre = el.dataset.filtre; rendre(rendreChoix); }
    else if (action === "choix-autre") { choix.rang++; rendre(rendreChoix); }
    else if (action === "choix-voir") {
      choix.rang = Number(el.dataset.rang) || 0;
      rendre(rendreChoix);
      F("choix-resultat").scrollIntoView({ block: "start" });
      const b = F("choix-porter");
      if (b) b.focus({ preventScroll: true });
    }
    else if (action === "choix-porter") {
      const a = PAR_ID[choix.id];
      const t = a ? suggestionsAutour(a)[choix.rang] : null;
      if (t) porterAujourdhui(t, a.id);
    }
    else if (action === "porte") {
      const r = tenueAffichee();
      if (r) { basculerJournal(AUJ_DATE, r.t); rendre(rendreTenue, rendreSemaine, rendreJournal, rendreCatalogue); }
    }
    else if (action === "porte-jour") {
      const j = el.dataset.jour, i = JOURS.findIndex(x => x[0] === j);
      if (valide(etat.plan[j]) && i <= INDEX_AUJ) { basculerJournal(dateSemaine(i), etat.plan[j]); rendre(rendreTenue, rendreSemaine, rendreJournal, rendreCatalogue); }
    }
    else if (action === "favori") {
      const t = tenueDe(el.dataset.cible);
      if (!t || !valide(t)) return;
      const id = idTenue(t);
      if (donnees.favoris[id]) { enregistrer("favoris", id, null).catch(() => {}); toast("Retirée des favoris."); }
      else { enregistrer("favoris", id, { tenue: copieTenue(t), ajouteLe: new Date().toISOString() }).catch(() => {}); toast("Ajoutée aux favoris."); }
      rendre(rendreTenue, rendreChoix, rendreFavoris, rendreJournal);
    }
    else if (action === "aime") {
      const t = tenueDe(el.dataset.cible);
      if (t && valide(t)) { noterGouts(t, 1).catch(() => {}); toast("Noté : ces associations reviendront plus souvent."); rendre(rendreTenue); }
    }
    else if (action === "aime-pas") {
      const r = tenueAffichee();
      if (!r) return;
      noterGouts(r.t, -1).catch(() => {});
      etat.portee = null;
      if (etat.jours.includes(AUJ[0]) && valide(etat.plan[AUJ[0]])) composerJour(AUJ[0], etat.plan[AUJ[0]]);
      else poserIdee(composer(ctxVide(ideeDuJour())) || ideeDuJour());
      ecrire();
      toast("Noté : ces associations reviendront moins souvent. Voici une autre tenue.");
      rendre(rendreSemaine, rendreTenue);
    }
    else if (action === "slot-changer" || action === "slot-lavage") {
      const r = tenueAffichee();
      const k = el.dataset.slot;
      if (!r || apercu || !r.t[k]) return;
      const t = r.t, id = t[k];
      const ctx = etat.jours.includes(AUJ[0]) && valide(etat.plan[AUJ[0]]) ? contexteJour(AUJ[0], null) : ctxVide();
      if (action === "slot-lavage") {
        const meta = Object.assign({ lavage: false, prix: null, achatLe: null, taille: "" }, donnees.pieces[id], { lavage: true });
        enregistrer("pieces", id, meta).catch(() => {});
      }
      const n = remplacerPiece(t, k, ctx);
      if (n) {
        if (etat.portee && etat.portee.id === id) etat.portee = null;
        remplacerTenueDuJour(n);
        if (action === "slot-lavage") reconcilier();
        ecrire();
        toast(action === "slot-lavage" ? `${nomComplet(PAR_ID[id])} est au lavage : pièce remplacée.` : "Pièce changée.");
      } else {
        if (action === "slot-lavage") { reconcilier(); ecrire(); }
        toast(action === "slot-lavage" ? `${nomComplet(PAR_ID[id])} est au lavage, mais rien ne la remplace.` : "Aucune autre pièce ne va à cette place.");
      }
      rendreTout();
      const b = F(`slot-changer-${k}`);
      if (b) b.focus({ preventScroll: true });
    }
    else if (action === "lavage") {
      const id = el.dataset.id;
      if (!PAR_ID[id]) return;
      const lavage = !auLavage(id);
      const meta = Object.assign({ lavage: false, prix: null, achatLe: null, taille: "" }, donnees.pieces[id], { lavage });
      enregistrer("pieces", id, meta).catch(() => {});
      if (lavage) reconcilier();
      toast(lavage ? `${nomComplet(PAR_ID[id])} est au lavage : elle sort des tenues.` : `${nomComplet(PAR_ID[id])} est de retour.`);
      rendreTout();
    }
    else if (action === "journal-prec" || action === "journal-suiv") {
      const [an, mois] = moisJournal.split("-").map(Number);
      const d = new Date(an, mois - 1 + (action === "journal-prec" ? -1 : 1), 1, 12);
      moisJournal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      rendre(rendreJournal);
    }
    else if (action === "journal-jour") { jourJournal = el.dataset.date; rendre(rendreJournal); }
    else if (action === "journal-retirer") {
      if (!donnees.journal[jourJournal]) return;
      enregistrer("journal", jourJournal, null).catch(() => {});
      toast("Retirée du journal.");
      rendre(rendreTenue, rendreSemaine, rendreJournal, rendreCatalogue);
    }
    else if (action === "journal-reporter") {
      const e = donnees.journal[jourJournal];
      if (e && valide(e.tenue)) porterAujourdhui(e.tenue, null);
    }
    else if (action === "fav-porter") {
      const f = donnees.favoris[el.dataset.id];
      if (f && valide(f.tenue)) porterAujourdhui(f.tenue, null);
    }
    else if (action === "fav-retirer") {
      enregistrer("favoris", el.dataset.id, null).catch(() => {});
      toast("Retirée des favoris.");
      rendre(rendreTenue, rendreChoix, rendreFavoris, rendreJournal);
    }
    else if (action === "filtre") { filtre = el.dataset.filtre; rendre(rendreCatalogue); }
    else if (action === "ouvrir-ajout") { reinitialiser(); succes(""); ouvrirPanneau(); }
    else if (action === "fermer-ajout" || action === "annuler-ajout") fermerPanneau();
    else if (action === "modifier") { const a = PAR_ID[el.dataset.id]; if (a && a.ajoute && peutEcrire) ouvrirEdition(a); }
    else if (action === "supprimer") {
      confirmation = el.dataset.id; erreurSuppression = null;
      rendre(rendreCatalogue);
      const b = F("non-" + confirmation); if (b) b.focus();
    }
    else if (action === "annuler-suppression") {
      const id = confirmation; confirmation = null; erreurSuppression = null;
      rendre(rendreCatalogue);
      const b = F("supprimer-" + id); if (b) b.focus();
    }
    else if (action === "confirmer-suppression") {
      const id = el.dataset.id;
      el.disabled = true;
      supprimer(id).then(() => {
        rendre(rendreCatalogue);
        // Le focus va sur la confirmation s'il y a une erreur, sinon sur le filtre du catalogue.
        const b = F(erreurSuppression ? "oui-" + id : "filtre-" + filtre);
        if (b) b.focus({ preventScroll: !erreurSuppression });
      });
    }
  });

  // ---------- démarrage ----------
  if (modeDonnees === "local") lireDonneesLocales();
  indexerJournal();
  indexer();
  remplirListes();
  reconcilier();
  rendreTout();
  brancher();
  // Si la base tarde trop, on cesse d'afficher « Chargement » (sans rien effacer de la semaine).
  setTimeout(() => {
    if (etatAjouts === "chargement") { etatAjouts = "indisponible"; reconcilier(); rendreTout(); }
  }, 12000);
})();

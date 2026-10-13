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
  const horsSaison = n => (n === 1 ? ["pulls", "sweats"] : ["t-shirts", "polos", "shorts"]);
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
    PAR_ID = Object.assign(Object.create(null), Object.fromEntries(ARTICLES.map(a => [a.id, a])));
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
  const vide = () => Object.create(null);
  const donnees = { journal: vide(), pieces: vide(), favoris: vide(), gouts: vide(), envies: vide(), reglages: { remise: 0, budget: 0 }, operation: null, lookbook: vide() };
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
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
    const tenue = d && nettoyerTenue(d.tenue);
    return tenue ? { tenue, ajouteLe: texte(d.ajouteLe, 40) } : null;
  }
  function lireGouts(d) {
    const g = vide();
    if (d && d.paires && typeof d.paires === "object") {
      for (const [k, v] of Object.entries(d.paires)) {
        if (k.length <= 200 && Number.isInteger(v) && v >= -3 && v <= 3 && v) g[k] = v;
      }
    }
    return g;
  }
  let journalLu = false;             // premier instantané du journal reçu (page publiée)
  const journalPret = () => modeDonnees === "local" || journalLu;
  let goutsPrets = false;            // goûts lus de façon définitive (page publiée)
  let reglagesLus = false;           // réglages lus de façon définitive (page publiée)
  const goutsDisponibles = () => modeDonnees !== "base" || goutsPrets;
  // Une envie : une pièce repérée au magasin, pas encore achetée.
  const ID_DOC = /^[A-Za-z0-9_-]{1,64}$/;
  function lireEnvie(id, d) {
    if (!ID_DOC.test(id) || !d) return null;
    const categorie = texte(d.categorie, 40), teinte = texte(d.teinte, 40), encolure = texte(d.encolure, 20);
    if (!possede(CAT, categorie) || !possede(T, teinte)) return null;
    return {
      titre: texte(d.titre, 200), categorie, teinte, encolure: possede(ENCOLURES, encolure) ? encolure : "",
      marque: texte(d.marque, 60), modele: texte(d.modele, 80), couleur: texte(d.couleur, 40),
      prix: nombre(d.prix, 0, 100000), lien: (d.lien && lienSur(d.lien)) || "", ajouteLe: texte(d.ajouteLe, 40),
    };
  }
  function lireReglages(d) {
    return {
      remise: d && Number.isInteger(d.remise) && d.remise >= 0 && d.remise <= 90 ? d.remise : 0,
      budget: (d && nombre(d.budget, 0, 100000)) || 0,
    };
  }
  function lireOperation(d) {
    const marque = d ? texte(d.marque, 60) : "";
    if (!marque) return null;
    return { marque, titre: texte(d.titre, 80), fin: typeof d.fin === "string" && DATE_RE.test(d.fin) ? d.fin : null };
  }
  function lireLook(id, d) {
    if (!ID_DOC.test(id) || !d) return null;
    const image = texte(d.image, 64), date = texte(d.date, 10);
    if (!ID_ASSET.test(image) || !DATE_RE.test(date)) return null;
    return { image, date, legende: texte(d.legende, 140), ajouteLe: texte(d.ajouteLe, 40) };
  }
  const LECTEURS = { journal: lireEntreeJournal, pieces: lireMeta, favoris: lireFavori, envies: lireEnvie, lookbook: lireLook };

  function lireDonneesLocales() {
    try {
      const e = JSON.parse(localStorage.getItem(CLE_DONNEES)) || {};
      for (const nom of ["journal", "pieces", "favoris", "envies"]) {
        for (const [id, d] of Object.entries(e[nom] || {})) {
          const x = LECTEURS[nom](id, d);
          if (x) donnees[nom][id] = x;
        }
      }
      donnees.gouts = lireGouts(e.gouts);
      donnees.reglages = lireReglages(e.reglages);
      donnees.operation = lireOperation(e.operation);
    } catch (_) { /* rien d'enregistré */ }
  }
  function ecrireDonneesLocales() {
    try {
      localStorage.setItem(CLE_DONNEES, JSON.stringify({
        journal: donnees.journal, pieces: donnees.pieces, favoris: donnees.favoris, gouts: { paires: donnees.gouts },
        envies: donnees.envies, reglages: donnees.reglages, operation: donnees.operation,
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
    if (collection === "envies") {
      return {
        titre: v.titre || "", categorie: v.categorie, teinte: v.teinte, encolure: v.encolure || null,
        marque: v.marque || "", modele: v.modele || "", couleur: v.couleur || "",
        prix: v.prix === null || v.prix === undefined ? null : v.prix, lien: v.lien || "", ajouteLe: v.ajouteLe || maintenant,
      };
    }
    if (collection === "reglages") return { remise: v.remise || 0, budget: v.budget || 0, majLe: maintenant };
    if (collection === "vitrine") return { marque: v.marque, titre: v.titre || "", fin: v.fin || null, majLe: maintenant };
    if (collection === "lookbook") return { image: v.image, date: v.date, legende: v.legende || "", ajouteLe: v.ajouteLe || maintenant };
    return JSON.parse(JSON.stringify(v));
  }
  function appliquerLocal(collection, id, v) {
    if (collection === "gouts") donnees.gouts = Object.assign(vide(), v ? v.paires : null);
    else if (collection === "reglages") donnees.reglages = lireReglages(v);
    else if (collection === "vitrine") donnees.operation = lireOperation(v);
    else if (possede(donnees, collection)) {
      if (v) donnees[collection][id] = v; else delete donnees[collection][id];
      if (collection === "journal") indexerJournal();
    }
  }
  function valeurLocale(collection, id) {
    if (collection === "gouts") return { paires: Object.assign({}, donnees.gouts) };
    if (collection === "reglages") return Object.assign({}, donnees.reglages);
    if (collection === "vitrine") return donnees.operation;
    return possede(donnees, collection) && possede(donnees[collection], id) ? donnees[collection][id] : null;
  }
  const filesEcriture = new Map();
  // Enregistre (ou supprime avec null) un document : l'écran change tout de suite, la base suit,
  // une écriture à la fois par document.
  function enregistrer(collection, id, valeur) {
    if (!peutNoter() && collection !== "etat") return Promise.reject({ code: "lecture" });
    const precedente = valeurLocale(collection, id);
    appliquerLocal(collection, id, valeur);
    if (modeDonnees === "local") { if (collection !== "etat") ecrireDonneesLocales(); return Promise.resolve(); }
    if (modeDonnees !== "base" || !peutEcrireDonnees) return Promise.reject({ code: "lecture" });
    const chemin = collection + "/" + id;
    const corps = valeur ? versBase(collection, valeur) : null;
    const avant = filesEcriture.get(chemin) || Promise.resolve();
    const suite = avant.catch(() => {}).then(() => appel(() => (corps ? db.doc(chemin).set(corps) : db.doc(chemin).delete()), ["unavailable"]));
    filesEcriture.set(chemin, suite);
    const resultat = suite.catch(err => {
      // Rien n'a été enregistré : l'écran revient à l'état d'avant, puis à ce que la base contient
      // vraiment (une écriture précédente de la file, ou une réponse perdue, a pu aboutir).
      if (filesEcriture.get(chemin) === suite) { appliquerLocal(collection, id, precedente); planifierRendu(); relire(collection, id); }
      toast(CODES_DROITS.includes(err && err.code) ? "Seul le propriétaire de la page peut enregistrer." : "L'enregistrement n'a pas abouti. Réessaie dans un instant.", "erreur");
      throw err;
    });
    const fin = () => {
      if (filesEcriture.get(chemin) !== suite) return;
      filesEcriture.delete(chemin);
      // Un instantané arrivé pendant l'écriture (un autre appareil) est appliqué maintenant.
      const suspendu = enSuspens.get(chemin);
      if (suspendu) { enSuspens.delete(chemin); suspendu(); }
    };
    suite.then(fin, fin);
    return resultat;
  }
  const enAttente = chemin => filesEcriture.has(chemin);
  const enSuspens = new Map();
  // Instantané d'un document : différé tant qu'une écriture locale de ce document est en cours.
  function surDocument(chemin, appliquer) {
    return snap => {
      if (enAttente(chemin)) { enSuspens.set(chemin, () => appliquer(snap)); return; }
      appliquer(snap);
    };
  }
  // Relit un document après un échec : l'écran montre ce que la base contient vraiment.
  function relire(collection, id) {
    if (!db || collection === "etat") return;
    const chemin = collection + "/" + id;
    db.doc(chemin).get().then(s => {
      if (enAttente(chemin)) return;
      const d = s.exists ? s.data() : null;
      const v = possede(LECTEURS, collection) ? (d && LECTEURS[collection](id, d)) : collection === "gouts" ? { paires: lireGouts(d) } : d;
      appliquerLocal(collection, id, v || null);
      planifierRendu();
    }).catch(() => {});
  }

  // Journal : nombre de ports, dernier port, et fraîcheur sur deux semaines pour la rotation.
  let RECENCE = new Map(), PORTS = new Map(), DERNIER = new Map();
  const midi = date => Date.parse(date + "T12:00:00");
  const ecartJours = (a, b) => Math.round((midi(a) - midi(b)) / 864e5);
  let versionJournal = 0;
  function indexerJournal() {
    versionJournal++;
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
  // Le document favori d'une tenue : d'abord sous son id habituel, sinon par le contenu de la tenue
  // (un favori écrit hors de la page peut porter un autre id).
  function favoriDe(t) {
    const id = idTenue(t);
    if (donnees.favoris[id]) return id;
    return Object.keys(donnees.favoris).find(k => idTenue(donnees.favoris[k].tenue) === id) || null;
  }
  // Identifiant stable d'une tenue (pour les favoris), sans l'accessoire.
  function idTenue(t) {
    let h = 5381;
    const s = ["bas", "haut", "dessous", "dessus", "pieds"].map(k => t[k] || "").join("|");
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return "f" + h.toString(36);
  }
  const copieTenue = t => { const n = {}; SLOTS.forEach(k => { if (typeof t[k] === "string") n[k] = t[k]; }); return n; };
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
  // Couches d'un jour : la météo ne règle que celles d'aujourd'hui ; les autres jours suivent le
  // réglage fait à la main, sinon la saison.
  const couchesHorsMeteo = () => (etat.couchesChoisies && [1, 2, 3].includes(etat.couchesManuelles) ? etat.couchesManuelles : couchesDeSaison());
  const couchesLe = date => (!date || date === AUJ_DATE ? etat.couches : couchesHorsMeteo());
  const dateDe = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const AUJ_DATE = dateDe(new Date());
  // Une page restée ouverte passe minuit : elle se recharge plutôt que d'écrire sur la veille.
  let rechargement = false;
  // Une saisie en cours (achat, simulateur, question au styliste, opération, photo du lookbook)
  // n'est jamais perdue : on la laisse finir, la page se recharge au geste suivant.
  const ZONES_SAISIE = ["ajouter", "form-simul", "form-styliste", "form-operation", "form-look"];
  // Un ajout commencé : une modification, une photo choisie ou un champ rempli (la date est remplie d'office).
  function ajoutCommence() {
    if (!F("ajouter") || F("ajouter").hidden) return false;
    if (edition || photo || envieAchetee) return true;
    return ["achat-titre", "achat-marque", "achat-categorie", "achat-modele", "achat-couleur", "achat-teinte", "achat-coupe", "achat-lien", "achat-prix", "achat-taille"]
      .some(id => F(id) && F(id).value && F(id).value.trim());
  }
  function saisieEnCours() {
    const rempli = id => F(id) && F(id).value && F(id).value.trim();
    return ajoutCommence() || rempli("simul-titre") || rempli("simul-prix") || rempli("styliste-question")
      || (typeof opBrouillon !== "undefined" && opBrouillon) || (F("look-photo") && F("look-photo").files && F("look-photo").files.length > 0);
  }
  let avertiDate = false;
  function jourChange(e) {
    if (rechargement || dateDe(new Date()) === AUJ_DATE) return rechargement;
    if (saisieEnCours()) {
      // Sans geste (retour sur l'onglet, données reçues) : on attend, sans rien appliquer ni envoyer.
      if (!e) return true;
      // Dans la zone de saisie, le geste passe (ajouter l'achat, envoyer la question…).
      // Les onglets passent aussi : ils mènent à la saisie restée dans un autre onglet, sans rien écrire.
      if (e.target && e.target.closest && (e.target.closest("#onglets") || ZONES_SAISIE.some(z => e.target.closest("#" + z)))) return false;
      // Ailleurs : un avertissement d'abord ; au geste suivant, la page se met à jour.
      if (!avertiDate) { avertiDate = true; toast("La date a changé : termine ta saisie. Au prochain geste ailleurs, la page se mettra à jour."); return true; }
    }
    rechargement = true;
    try { history.replaceState(null, "", location.pathname + location.search); history.scrollRestoration = "manual"; } catch (_) { /* adresse inchangée */ }
    location.reload();
    return true;
  }
  // Une tenue lue du stockage : seulement des ids (une chaîne vide = couche volontairement absente).
  function nettoyerTenue(t) {
    if (!t || typeof t.bas !== "string" || typeof t.haut !== "string") return null;
    const n = {};
    SLOTS.forEach(k => { if (typeof t[k] === "string" && /^[A-Za-z0-9_.~:@+-]{0,210}$/.test(t[k])) n[k] = t[k]; });
    if (!n.bas || !n.haut) return null;
    return n;
  }
  function lireEtat(e) {
    {
      if (!e || !Array.isArray(e.jours)) return null;
      const jours = JOURS.map(x => x[0]).filter(j => e.jours.includes(j));
      // La semaine composée est celle de ce lundi : celle d'une semaine passée repart de zéro (les
      // jours déjà portés reprennent la tenue notée au journal, les autres suivent la rotation).
      const lundi = dateSemaine(0);
      // (Une semaine enregistrée avant ce repère est datée par sa dernière modification, si elle en a une.)
      const modifiee = nombre(e.majLe, 0, 1e15) || 0;
      const memeSemaine = e.semaine === lundi || (e.semaine === undefined && (!modifiee || modifiee >= Date.parse(lundi + "T00:00:00")));
      const plan = {};
      for (const j of memeSemaine ? jours : []) {
        const t = nettoyerTenue(e.plan && e.plan[j]);
        if (t) plan[j] = t;
      }
      // Le nombre de couches suit la saison tant qu'il n'a pas été choisi à la main ; la météo
      // l'impose pour son jour seulement.
      const valeur = n => [1, 2, 3].includes(n);
      const choisies = e.couchesChoisies === true && valeur(e.couches);
      const manuelles = choisies ? (valeur(e.couchesManuelles) ? e.couchesManuelles : e.couches) : null;
      const idee = e.idee && e.idee.date === AUJ_DATE ? nettoyerTenue(e.idee.t) : null;
      const portee = e.portee && e.portee.date === AUJ_DATE && typeof e.portee.id === "string" ? { date: AUJ_DATE, id: e.portee.id } : null;
      const meteo = e.meteo && e.meteo.date === AUJ_DATE && possede(METEOS, e.meteo.valeur) ? { date: AUJ_DATE, valeur: e.meteo.valeur } : null;
      const choisie = e.choisie && e.choisie.date === AUJ_DATE ? { date: AUJ_DATE } : null;
      return {
        jours, plan, semaine: lundi,
        couches: meteo && e.couchesMeteo === AUJ_DATE && valeur(e.couches) ? e.couches : choisies ? manuelles : couchesDeSaison(),
        couchesChoisies: choisies, couchesManuelles: manuelles, couchesMeteo: meteo && e.couchesMeteo === AUJ_DATE ? AUJ_DATE : null,
        idee: idee ? { date: AUJ_DATE, t: idee } : null, portee, meteo, choisie,
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
  let syncPrete = false, minuteurSync = null, gesteAvantSync = false;
  function ecrire() {
    if (modeDonnees === "local" || modeDonnees === "lecture" || syncPrete) etat.majLe = Math.max(Date.now(), (etat.majLe || 0) + 1);
    sauverLocal();
    programmerSync();
  }
  function programmerSync() {
    if (modeDonnees !== "base" || !peutEcrireDonnees || !syncPrete || jourChange()) return;
    clearTimeout(minuteurSync);
    minuteurSync = setTimeout(() => { enregistrer("etat", "semaine", etat).catch(() => {}); }, 700);
  }
  const cleEtat = e => JSON.stringify([e.jours, e.plan, e.couches, e.couchesChoisies, e.couchesManuelles, e.couchesMeteo, e.idee, e.portee, e.meteo, e.choisie]);
  function surEtatDistant(snap) {
    if (jourChange()) return; // la page se recharge (ou attend la fin d'une saisie) avant de lire quoi que ce soit
    const definitif = !(snap.metadata && snap.metadata.fromCache);
    const distant = snap.exists ? lireEtat(snap.data()) : null;
    const majDistant = distant ? distant.majLe : 0;
    if (distant && (majDistant > (etat.majLe || 0) || modeDonnees === "lecture")) {
      if (cleEtat(distant) !== cleEtat(etat)) {
        if (!syncPrete && gesteAvantSync && modeDonnees === "base") toast("Ta semaine vient d'être mise à jour depuis ton autre appareil : refais ton dernier choix si besoin.");
        etat = distant;
        composeeAvantBase = false; // la semaine vient de la base, pas d'une composition à l'aveugle
        joursAveugles.clear();
        sauverLocal();
        if (etatAjouts === "ok") reconcilier(true);
        planifierRendu();
      } else etat.majLe = majDistant;
    }
    if (definitif && modeDonnees === "base" && !syncPrete) {
      syncPrete = true;
      if (!distant || majDistant < (etat.majLe || 0)) { etat.majLe = etat.majLe || Date.now(); programmerSync(); }
      // Même version des deux côtés, mais ce navigateur a avancé (un geste, ou une tenue composée
      // pendant le chargement) : il l'envoie, pour que les deux appareils montrent la même semaine.
      else if (majDistant === (etat.majLe || 0) && cleEtat(distant) !== cleEtat(etat)) {
        etat.majLe = Math.max(Date.now(), majDistant + 1);
        sauverLocal();
        programmerSync();
      }
    }
  }

  let etat = lire() || { jours: ["lun", "mar", "mer", "jeu", "ven", "sam"], plan: {}, semaine: dateSemaine(0), couches: couchesDeSaison(), couchesChoisies: false, idee: null, portee: null, meteo: null, majLe: 0 };
  let apercu = null;       // tenue choisie dans un tableau d'accords
  let caseApercu = "";     // sélecteur de la case touchée, pour y revenir
  // Idée du jour (quand aujourd'hui n'est pas coché) et pièce « portée aujourd'hui » : gardées pour la journée.
  const ideeDuJour = () => (etat.idee && etat.idee.date === AUJ_DATE ? etat.idee.t : null);
  const poserIdee = t => { etat.idee = t ? { date: AUJ_DATE, t } : null; };
  const tenueDuJourBrute = () => (etat.jours.includes(AUJ[0]) && valide(etat.plan[AUJ[0]]) ? etat.plan[AUJ[0]] : ideeDuJour());
  // La tenue du jour a été choisie à la main : la page ne la recompose plus d'elle-même aujourd'hui.
  const choisieAujourdhui = () => !!(etat.choisie && etat.choisie.date === AUJ_DATE);
  const porteeId = () => (etat.portee && etat.portee.date === AUJ_DATE && PAR_ID[etat.portee.id] && contient(tenueDuJourBrute(), etat.portee.id) ? etat.portee.id : null);
  const contient = (t, id) => !!(t && id && SLOTS.some(k => t[k] === id));
  // La tenue affichée est-elle celle notée au journal aujourd'hui ?
  const noteeAujourdhui = t => { const e = donnees.journal[AUJ_DATE]; return !!(e && t && cleTenue(e.tenue) === cleTenue(t)); };
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
  function choisirParmi(liste, usage, voisinsIds, alea, date) {
    let choix, max = -Infinity;
    const op = bonusOperation(date);
    for (const a of liste) {
      if (!dispo(a)) continue;
      // Pendant une opération, les chaussures de la marque reviennent chaque jour (+30 contre 5 par
      // jour déjà porté) ; sous la pluie, le daim et la toile restent au placard (-40).
      let n = (alea ? Math.random() * 2 : 0) - (usage.get(a.id) || 0) * 5 + op(a) * 30;
      if (voisinsIds.includes(a.id)) n -= 3;
      if (craintLaPluie(a)) n -= 40;
      if (n > max) { max = n; choix = a.id; }
    }
    return choix;
  }
  // Sans hasard : des chaussures neutres et d'une autre couleur que le bas.
  function chaussuresPour(b) {
    let choix, max = -Infinity;
    for (const p of PIEDS) {
      if (!dispo(p)) continue;
      const n = (T[p.teinte].neutre ? 2 : 0) + (p.teinte !== b.teinte ? 1 : 0) - (craintLaPluie(p) ? 10 : 0) + bonusOperation()(p) * 5;
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
    const nc = couchesLe(ctx.date);
    const hors = horsSaison(nc);
    const pluie = ctx.pluie !== undefined ? ctx.pluie : meteoDuJour() === "pluie";
    const op = bonusOperation(ctx.date);
    const res = [];
    for (const h of listeHauts) {
      if (!h || (!c.haut && ctx.hautsPris.has(h.id))) continue;
      let sous = [null];
      if (sousImpose) { if (!accepte(h, sousImpose)) continue; sous = [sousImpose]; }
      else if (nc >= 2 && accepteDessous(h)) sous = sous.concat(SOUS.filter(s => libre(s) && accepte(h, s)));
      const dessus = dessusImpose ? [dessusImpose] : nc >= 3 ? [null].concat(DESSUS.filter(libre)) : [null];
      // Une couche manquante ne compte que si ce haut pouvait la recevoir.
      const objectif = 1 + (sous.length > 1 || sousImpose ? 1 : 0) + (dessus.length > 1 || dessusImpose ? 1 : 0);
      for (const b of listeBas) {
        if (!b) continue;
        if (ctx.actuel && ctx.actuel.bas === b.id && ctx.actuel.haut === h.id) continue;
        const s1 = accord(b, h);
        if (!s1) continue;
        // Pendant une opération, un bas de la marque peut revenir plusieurs jours : la rotation compte 4 fois moins.
        const rotation = op(b) ? 0.25 : 1;
        let base = s1 * 10 - (ctx.usageBas.get(b.id) || 0) * 12 * rotation;
        if (hors.includes(h.categorie)) base -= 6;
        if (hors.includes(b.categorie)) base -= 6;
        if (nc >= 2 && PULL_CATS.includes(h.categorie)) base += 3; // en hiver, le pull mène
        // Rotation sur deux semaines d'après le journal, et goûts notés (J'aime / Pas pour moi).
        base -= fraicheur(h.id) * 10 + fraicheur(b.id) * 6;
        const gHB = gout("hb:" + h.id + "|" + b.id);
        if (gHB <= -2) continue;
        base += gHB * 3;
        // L'opération du moment passe avant la rotation de la semaine (bas déjà porté -12, la veille -15).
        base += op(h) * 12 + op(b) * 40;
        // Les bas clairs craignent les éclaboussures : la pluie passe avant tout le reste, rotation de la
        // semaine et opération magasin (+40) comprises, même avec un meilleur accord (jusqu'à +20).
        if (pluie && T[b.teinte].clarte === "clair") base -= 80;
        for (const v of ctx.voisins) {
          const hv = PAR_ID[v.haut];
          if (v.bas === b.id) base -= 15 * rotation;
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
            ns += gSH * 2 - fraicheur(s.id) * 5 + op(s) * 4;
          }
          for (const d of dessus) {
            let n = ns;
            if (d) {
              const s3 = surcouche(d, h, b, s).score;
              if (!s3) continue;
              n += s3 * 4 - (ctx.usageDessus.get(d.id) || 0) * 2 - fraicheur(d.id);
              const gDH = gout("dh:" + d.id + "|" + h.id);
              if (gDH <= -2) continue;
              n += gDH * 2 + op(d) * 8;
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
    const p = choisirParmi(PIEDS, ctx.usagePieds, ctx.voisins.map(v => v.pieds), true, ctx.date);
    if (p) r.t.pieds = p;
    return r.t;
  }
  // Si tous les hauts sont déjà pris dans la semaine, on accepte d'en reporter un.
  const composerAvecRepli = ctx => composer(ctx) || composer(Object.assign({}, ctx, { hautsPris: new Set() }));

  // La meilleure pièce d'une liste selon un score d'accord, en faisant tourner les pièces.
  function meilleurePiece(liste, score, usage, poids, voisinsIds, bonus) {
    let choix = null, max = -Infinity;
    for (const a of liste) {
      if (!dispo(a)) continue;
      const s = score(a);
      if (!s) continue;
      let n = s * 10 - (usage.get(a.id) || 0) * poids + Math.random() * 3 + (bonus ? bonus(a) : 0);
      if (voisinsIds.includes(a.id)) n -= 4;
      if (n > max) { max = n; choix = a.id; }
    }
    return choix;
  }
  // Complète une tenue sans toucher à son haut ni à son bas : pièces disparues retirées, puis
  // sous-couche et par-dessus selon les couches choisies, et chaussures.
  function completer(t, ctx) {
    let change = false;
    // Les mêmes préférences que generer : l'opération du moment, et sous la pluie blouson ou manteau.
    const op = bonusOperation(ctx.date);
    const pluie = ctx.pluie !== undefined ? ctx.pluie : meteoDuJour() === "pluie";
    const h = PAR_ID[t.haut], b = PAR_ID[t.bas];
    const retirer = k => { delete t[k]; change = true; };
    // Une couche devenue impossible ou « à éviter » (pièce supprimée ou modifiée) est retirée…
    if (t.dessous && (!accepte(h, PAR_ID[t.dessous]) || !superposer(PAR_ID[t.dessous], h).score)) retirer("dessous");
    if (t.dessus && (!aRole(t.dessus, "dessus") || !surcouche(PAR_ID[t.dessus], h, b, PAR_ID[t.dessous]).score)) retirer("dessus");
    if (t.pieds && !aRole(t.pieds, "pieds")) retirer("pieds");
    if (t.accessoire && !aRole(t.accessoire, "aucun")) retirer("accessoire");
    // … puis remplacée ; une couche laissée de côté exprès (chaîne vide) le reste.
    if (t.dessous === undefined && couchesLe(ctx.date) >= 2 && accepteDessous(h)) {
      const s = meilleurePiece(SOUS.filter(x => accepte(h, x) && gout("sh:" + x.id + "|" + h.id) > -2), x => superposer(x, h).score, ctx.usageDessous, 6, ctx.voisins.map(v => v.dessous), x => op(x) * 4);
      if (s) { t.dessous = s; change = true; }
    }
    if (t.dessus === undefined && couchesLe(ctx.date) >= 3) {
      const d = meilleurePiece(DESSUS.filter(x => gout("dh:" + x.id + "|" + h.id) > -2), x => surcouche(x, h, b, PAR_ID[t.dessous]).score, ctx.usageDessus, 2, ctx.voisins.map(v => v.dessus),
        x => op(x) * 8 + (pluie ? (x.categorie === "vestes" ? -3 : 3) : 0));
      if (d) { t.dessus = d; change = true; }
    }
    if (!t.pieds && PIEDS.length) {
      const p = choisirParmi(PIEDS, ctx.usagePieds, ctx.voisins.map(v => v.pieds), true, ctx.date);
      if (p) { t.pieds = p; change = true; }
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
      pluie: j === AUJ[0] && meteoDuJour() === "pluie",
      date: dateSemaine(JOURS.findIndex(x => x[0] === j)),
    };
  }
  function composerJour(j, actuel) {
    const t = composerAvecRepli(contexteJour(j, actuel));
    if (t) etat.plan[j] = t;
    else if (!actuel) delete etat.plan[j];
  }
  // La tenue notée au journal pour un jour de la semaine déjà commencé (aujourd'hui compris).
  function tenueDuJournal(i) {
    const e = i >= 0 && i <= INDEX_AUJ ? donnees.journal[dateSemaine(i)] : null;
    return e && valide(e.tenue) ? copieTenue(e.tenue) : null;
  }
  function composerSemaine() {
    etat.plan = {};
    etat.choisie = null;
    // Les jours déjà portés gardent la tenue notée au journal.
    JOURS.forEach(([j], i) => {
      const e = i <= INDEX_AUJ ? donnees.journal[dateSemaine(i)] : null;
      if (etat.jours.includes(j) && e && valide(e.tenue)) etat.plan[j] = copieTenue(e.tenue);
    });
    JOURS.forEach(([j]) => { if (etat.jours.includes(j) && !etat.plan[j]) composerJour(j, null); });
    ecrire();
  }
  // Remet la semaine d'aplomb quand des pièces arrivent, changent ou disparaissent.
  function reconcilier(distant) {
    const sur = etatAjouts === "ok";
    let change = false;
    for (const [i, [j]] of JOURS.entries()) {
      const t = etat.plan[j];
      if (!etat.jours.includes(j)) {
        if (t) { delete etat.plan[j]; change = true; }
        continue;
      }
      if (!t) {
        // Un jour déjà porté reprend la tenue notée ; un jour passé attend que le journal soit lu.
        const notee = tenueDuJournal(i);
        if (notee) etat.plan[j] = notee;
        else if (i < INDEX_AUJ && !journalPret()) continue;
        else { composerJour(j, null); noterAveugle(j); }
        change = true;
        continue;
      }
      if (!sur) continue; // ses pièces sont peut-être seulement pas encore chargées
      if (!valide(t)) { delete etat.plan[j]; composerJour(j, null); change = true; continue; }
      // Jours passés, tenue notée ou choisie aujourd'hui : on n'y touche plus.
      const fige = i < INDEX_AUJ || noteeAujourdhui(t) || (i === INDEX_AUJ && choisieAujourdhui());
      if (!fige && retirerCouchesEnTrop(t, couchesLe(dateSemaine(i)))) change = true;
      if (!fige && completer(t, contexteJour(j, null))) change = true;
    }
    if (sur) {
      if (apercu && !valide(apercu)) apercu = null;
      if (apercu) completer(apercu, ctxVide());
      const idee = ideeDuJour();
      if (idee && valide(idee) && !noteeAujourdhui(idee) && !choisieAujourdhui() && (retirerCouchesEnTrop(idee) | completer(idee, ctxVide()))) change = true;
      if (choix.id && !PAR_ID[choix.id]) choix = { id: null, rang: 0, filtre: choix.filtre };
      if (etat.portee && !porteeId()) { etat.portee = null; change = true; }
      if (remplacerIndispo()) change = true;
    }
    // Venue d'un autre appareil, la donnée y a déjà été réparée : on n'envoie rien en retour.
    if (change) { if (distant) sauverLocal(); else ecrire(); }
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
  // Seules les pièces au lavage sont remplacées, la pièce choisie reste.
  function reparerAutour(t, ctx, pid) {
    let n = t, change = false;
    for (const k of SLOTS) {
      if (!n[k] || n[k] === pid || !auLavage(n[k])) continue;
      const r = remplacerPiece(n, k, Object.assign({}, ctx), pid);
      if (r) n = r;
      else if (k !== "bas" && k !== "haut") { n = copieTenue(n); delete n[k]; }
      else continue;
      change = true;
    }
    return change ? n : null;
  }
  function remplacerIndispo() {
    if (!journalPret()) return false;
    let change = false;
    // La pièce choisie (« Je veux porter ») : si elle-même part au lavage, la tenue est recomposée.
    if (etat.portee && auLavage(etat.portee.id)) { etat.portee = null; change = true; }
    const pid = porteeId();
    JOURS.forEach(([j], i) => {
      const t = etat.plan[j];
      if (i < INDEX_AUJ || !valide(t) || (i === INDEX_AUJ && noteeAujourdhui(t))) return;
      if (i === INDEX_AUJ && ((pid && contient(t, pid)) || choisieAujourdhui())) {
        const n = reparerAutour(t, contexteJour(j, null), pid);
        if (n) { etat.plan[j] = n; change = true; }
        return;
      }
      if (reparer(t, contexteJour(j, null), () => composerJour(j, null))) change = true;
    });
    const idee = ideeDuJour();
    if (!noteeAujourdhui(idee) && valide(idee) && ((pid && contient(idee, pid)) || choisieAujourdhui())) {
      const n = reparerAutour(idee, ctxVide(), pid);
      if (n) { poserIdee(n); change = true; }
    } else if (!noteeAujourdhui(idee) && valide(idee) && reparer(idee, ctxVide(), () => poserIdee(composerAvecRepli(ctxVide())))) change = true;
    if (etat.portee && auLavage(etat.portee.id)) { etat.portee = null; change = true; }
    return change;
  }
  // « Changer » sur une pièce de la tenue : la suivante qui va le mieux avec les autres pièces.
  function remplacerPiece(t, k, ctx, garderId) {
    const garder = {};
    ["bas", "haut", "dessous", "dessus"].forEach(x => { if (x !== k && t[x]) garder[x] = t[x]; });
    ctx.exclus = new Set([t[k]]);
    if (k === "pieds") {
      const p = choisirParmi(PIEDS.filter(x => x.id !== t.pieds), ctx.usagePieds, [], true, ctx.date);
      if (!p) return null;
      return Object.assign(copieTenue(t), { pieds: p });
    }
    if (k === "accessoire") {
      // Un autre accessoire : d'abord ceux dont la couleur ne se dispute pas avec le haut.
      const rang = x => { const s = touche(x, t); return (s ? s.score : 2) + Math.random(); };
      const autres = ARTICLES.filter(x => role(x) === "aucun" && x.id !== t.accessoire && dispo(x)).sort((x, y) => rang(y) - rang(x));
      return autres.length ? Object.assign(copieTenue(t), { accessoire: autres[0].id }) : null;
    }
    // Le haut change : la sous-couche peut ne plus convenir, on la laisse choisir à nouveau.
    if (k === "haut" && garder.dessous !== garderId) delete garder.dessous;
    // On garde les autres couches tant que c'est possible, sinon on les laisse se rechoisir.
    const convient = x => (k === "dessous" || k === "dessus" ? !!x.t[k] : true);
    const relacher = ["dessus", "dessous"].filter(x => x !== k && garder[x] && garder[x] !== garderId);
    let liste = generer(garder, ctx, true);
    while (!liste.some(convient) && relacher.length) { delete garder[relacher.shift()]; liste = generer(garder, ctx, true); }
    const r = liste.find(convient);
    if (!r && (k === "dessous" || k === "dessus")) {
      // Le réglage de couches est plus bas que la tenue : on choisit la couche directement.
      const h = PAR_ID[t.haut], b = PAR_ID[t.bas];
      const id = k === "dessous"
        ? meilleurePiece(SOUS.filter(x => x.id !== t[k] && accepte(h, x) && gout("sh:" + x.id + "|" + h.id) > -2), x => superposer(x, h).score, ctx.usageDessous, 6, [])
        : meilleurePiece(DESSUS.filter(x => x.id !== t[k] && gout("dh:" + x.id + "|" + h.id) > -2), x => surcouche(x, h, b, PAR_ID[t.dessous]).score, ctx.usageDessus, 2, []);
      return id ? Object.assign(copieTenue(t), { [k]: id }) : null;
    }
    if (!r) return null;
    const n = Object.assign({}, r.t);
    ["pieds", "accessoire"].forEach(x => { if (t[x] && x !== k) n[x] = t[x]; });
    if (!n.pieds && PIEDS.length) n.pieds = chaussuresPour(PAR_ID[n.bas]);
    return n;
  }
  // Couches au-delà du réglage (par exemple quand la saison change) ; la pièce portée aujourd'hui reste.
  function retirerCouchesEnTrop(t, n = etat.couches) {
    const garder = porteeId();
    let change = false;
    if (n < 2 && t.dessous !== undefined && t.dessous !== garder) { delete t.dessous; change = true; }
    if (n < 3 && t.dessus !== undefined && t.dessus !== garder) { delete t.dessus; change = true; }
    return change;
  }
  function changerCouches(n, parMeteo) {
    if (![1, 2, 3].includes(n)) return;
    // Un choix à la main est gardé ; celui de la météo ne vaut que pour aujourd'hui.
    const reglage = () => JSON.stringify([etat.couchesChoisies, etat.couchesManuelles, etat.couchesMeteo]);
    const avant = reglage();
    if (parMeteo) etat.couchesMeteo = AUJ_DATE;
    else { etat.couchesChoisies = true; etat.couchesManuelles = n; etat.couchesMeteo = null; }
    if (n === etat.couches) { if (reglage() !== avant) ecrire(); return; }
    etat.couches = n;
    const sur = etatAjouts === "ok";
    const pid = porteeId();
    const ajuster = (t, ctx) => {
      if (!valide(t) || noteeAujourdhui(t)) return t;
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
    // Les jours déjà passés gardent la tenue qu'ils avaient ; la météo ne touche qu'aujourd'hui.
    JOURS.forEach(([j], i) => { if (etat.plan[j] && (parMeteo ? i === INDEX_AUJ : i >= INDEX_AUJ)) etat.plan[j] = ajuster(etat.plan[j], contexteJour(j, null)); });
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
      (superpositions ? `, et ${pluriel(superpositions, "combinaison")} sous-couche + haut. ` : ". ") +
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
        <button class="lien-action" type="button" id="slot-changer-${o.k}" data-action="slot-changer" data-slot="${o.k}" aria-label="Changer : ${esc(nomComplet(a))}">Changer</button>
        ${peutNoter() && o.k !== "accessoire" ? `<button class="lien-action" type="button" id="slot-lavage-${o.k}" data-action="slot-lavage" data-slot="${o.k}" aria-label="Mettre au lavage : ${esc(nomComplet(a))}">Au lavage</button>` : ""}
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
    if (aRole(t.accessoire, "aucun")) pieces.push({ a: PAR_ID[t.accessoire], k: "accessoire", etiquette: "Accessoire" });
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
    // Pas de paire du magasin : la prochaine à trouver ; des paires, mais toutes au lavage : on le dit.
    const encart = PAR_ID[t.pieds] ? "" : !PIEDS.length ? CHAUSSURES_A_TROUVER
      : !PIEDS.some(dispo) ? `<div class="slot pieds"><span class="eyebrow">Chaussures</span><strong>Au lavage</strong><p>Ta paire du magasin revient bientôt.</p></div>` : "";
    html += encart;
    return { html, n: k + (encart ? 1 : 0) };
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

  let ideeProvisoire = null;
  function tenueAffichee() {
    const pid = porteeId();
    const autour = t => (contient(t, pid) ? `Composée autour de : ${nomComplet(PAR_ID[pid])}.` : null);
    if (apercu && valide(apercu)) return { t: apercu, contexte: "Choisie dans « Ce qui va ensemble »." };
    apercu = null;
    const prevue = etat.plan[AUJ[0]];
    let contexte = etat.jours.includes(AUJ[0]) ? "Pas de tenue prévue aujourd'hui dans ta semaine : voici une idée."
      : `${AUJ[1]} n'est pas coché dans ta semaine, voici quand même une idée.`;
    if (etat.jours.includes(AUJ[0]) && prevue) {
      if (valide(prevue)) return { t: prevue, contexte: autour(prevue) || `Prévue dans ta semaine pour ${AUJ[1].toLowerCase()}.` };
      if (etatAjouts === "chargement") return null;
      contexte = "Ta tenue prévue aujourd'hui utilise une pièce ajoutée qui n'a pas pu être chargée. Voici une autre idée.";
    }
    let t = ideeDuJour();
    if (!valide(t)) {
      if (t && etatAjouts === "chargement") return null; // l'idée enregistrée attend ses pièces ajoutées
      if (t && etatAjouts === "indisponible") {
        // Les pièces ajoutées n'ont pas pu être chargées : on montre une autre idée sans toucher
        // à celle enregistrée, qui reviendra telle quelle quand la base répondra.
        if (!valide(ideeProvisoire)) ideeProvisoire = composerAvecRepli(ctxVide());
        return ideeProvisoire ? { t: ideeProvisoire, contexte: "Ta tenue utilise une pièce ajoutée qui n'a pas pu être chargée. Voici une autre idée en attendant." } : null;
      }
      t = composerAvecRepli(ctxVide());
      poserIdee(t);
      noterAveugle(AUJ[0]);
      ecrire();
    }
    return t ? { t, contexte: autour(t) || contexte } : null;
  }

  function rendreTenue() {
    rendreCouches("tenue");
    const r = tenueAffichee();
    if (!r) {
      F("tenue-slots").style.setProperty("--n", 1);
      F("tenue-slots").innerHTML = `<p class="vide">${etatAjouts === "chargement" ? "Chargement des pièces ajoutées…" : "Aucune tenue possible : trop de pièces sont au lavage."}</p>`;
      F("tenue-verdict").innerHTML = "";
      F("tenue-actions").innerHTML = "";
      F("tenue-raisons").innerHTML = "";
      F("tenue-plus").innerHTML = "";
      rendreAvis();
      return;
    }
    const { t, contexte } = r;
    const g = grilleTenue(t, null, !apercu), ev = noterTenue(t);
    rendreBandeau();
    if ((carte && carte.cle !== cleTenue(t)) || (carteEnCours && carteEnCours !== cleTenue(t))) fermerCarte();
    F("tenue-slots").style.setProperty("--n", g.n);
    F("tenue-slots").dataset.n = g.n;
    F("tenue-slots").innerHTML = g.html;
    const note = donnees.journal[AUJ_DATE];
    const dejaNotee = note && cleTenue(note.tenue) === cleTenue(t);
    F("tenue-verdict").innerHTML = badgesTenue(t, ev) +
      (dejaNotee ? `<span class="badge porte">Portée aujourd'hui</span>` : "") +
      (favoriDe(t) ? `<span class="badge favori">Favori</span>` : "") + `<p>${esc(contexte)}</p>`;
    F("tenue-raisons").innerHTML = listeRaisons(ev);
    const ecrit = peutNoter();
    const boutons = [];
    if (apercu) boutons.push(`<button class="btn" type="button" id="retour-tenue" data-action="retour">Revenir à ma tenue</button>`,
      `<button class="btn" type="button" id="revoir-accords" data-action="revoir-accords">Revoir « Ce qui va ensemble »</button>`);
    else if (ecrit) {
      boutons.push(dejaNotee
        ? `<button class="btn" type="button" id="porte" data-action="porte" aria-pressed="true">Portée ✓ (annuler)</button>`
        : `<button class="btn primaire" type="button" id="porte" data-action="porte" aria-pressed="false">${note ? "Noter celle-ci à la place" : "Je l'ai portée"}</button>`);
    }
    if (ecrit) {
      boutons.push(`<button class="btn" type="button" id="favori-tenue" data-action="favori" data-cible="tenue" aria-pressed="${!!favoriDe(t)}">Favori</button>`);
      boutons.push(`<button class="btn" type="button" id="aime-tenue" data-action="aime" data-cible="tenue">J'aime</button>`);
      if (!apercu) boutons.push(`<button class="btn" type="button" id="aime-pas" data-action="aime-pas">Pas pour moi</button>`);
    }
    if (!apercu) boutons.push(`<button class="btn${ecrit ? "" : " primaire"}" type="button" id="autre-tenue" data-action="autre">Autre tenue</button>`);
    // L'avis d'abord : s'il ne vaut plus pour cette tenue, il s'efface et le bouton revient.
    rendreAvis();
    // Au bout de la rangée, plus discrets : ce qu'on fait de la tenue au-delà de la porter.
    const plus = apercu ? [] : [`<button class="lien-action" type="button" id="carte-tenue" data-action="carte">Carte à partager</button>`];
    if (sample && !apercu) plus.push(`<button class="lien-action" type="button" id="avis-tenue" data-action="avis-tenue" aria-disabled="${!!(avis && avis.enCours)}">Avis du styliste</button>`);
    F("tenue-actions").innerHTML = boutons.join("") + (plus.length ? `<span class="tenue-liens">${plus.join("")}</span>` : "");
    F("tenue-plus").innerHTML = "";
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
    F("intro-semaine").textContent = "Coche tes jours de travail : chaque jour reçoit sa tenue, et les pièces tournent pour que toute la collection passe dans la semaine. " +
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
        ? (note && cleTenue(note.tenue) !== cleTenue(t)
          ? `<button class="btn" type="button" id="porte-${j}" data-action="porte-jour" data-jour="${j}" aria-label="Remplacer la tenue notée de ${esc(nomJour.toLowerCase())} par celle-ci">Remplacer</button>`
          : `<button class="btn" type="button" id="porte-${j}" data-action="porte-jour" data-jour="${j}" aria-pressed="${!!note}" aria-label="Noter la tenue de ${esc(nomJour.toLowerCase())} comme portée">Portée</button>`) : "";
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
          ${peutNoter() ? `<button class="btn" type="button" id="favori-choix" data-action="favori" data-cible="choix" aria-pressed="${!!favoriDe(t)}">Favori</button>` : ""}
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
      const retirer = peutNoter() ? `<button class="btn" type="button" id="fav-retirer-${esc(id)}" data-action="fav-retirer" data-id="${esc(id)}">Retirer</button>` : "";
      const eyebrow = `<span class="eyebrow">Favori${f.ajouteLe ? " depuis le " + esc(dateCourte(f.ajouteLe)) : ""}</span>`;
      if (!valide(f.tenue)) {
        return `<li><div class="vignettes"></div><div class="ligne-corps">${eyebrow}<span class="noms"><span>${etatAjouts === "chargement" ? "Chargement des pièces ajoutées…" : "Une pièce de cette tenue n'existe plus."}</span></span></div><span class="ligne-actions">${retirer}</span></li>`;
      }
      return ligneTenue(f.tenue, eyebrow, `<span class="ligne-actions"><button class="btn" type="button" id="fav-porter-${esc(id)}" data-action="fav-porter" data-id="${esc(id)}">Porter aujourd'hui</button>${retirer}</span>`);
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
    duMois.forEach(e => SLOTS.forEach(k => { if (PAR_ID[e.tenue[k]]) pieces.add(e.tenue[k]); }));
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
        <div class="actions">${peutNoter() ? `<button class="btn" type="button" id="journal-favori" data-action="favori" data-cible="journal" aria-pressed="${!!favoriDe(e.tenue)}">Favori</button>
          <button class="btn" type="button" id="journal-retirer" data-action="journal-retirer">Retirer du journal</button>` : ""}
          ${jourJournal !== AUJ_DATE ? `<button class="btn" type="button" id="journal-reporter" data-action="journal-reporter">Porter à nouveau aujourd'hui</button>` : ""}</div></div>`;
    } else if (e) {
      detail += `<p class="vide">${etatAjouts === "chargement" ? "Chargement des pièces ajoutées…" : "Une pièce de cette tenue n'existe plus."}</p>` +
        (peutNoter() && etatAjouts !== "chargement" ? `<div class="actions"><button class="btn" type="button" id="journal-retirer" data-action="journal-retirer">Retirer du journal</button></div>` : "");
    } else {
      detail += `<p class="vide">Rien de noté ce jour-là.${jourJournal === AUJ_DATE && peutNoter() ? " Touche « Je l'ai portée » sous ta tenue, dans « Aujourd'hui »." : ""}</p>`;
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
          <span><strong>${esc(nomComplet(a))}</strong><span class="mono">${jours === Infinity ? "Jamais notée" : `Pas portée depuis ${jours} jours`}</span></span>
          <button class="btn petit" type="button" id="oubliee-${esc(a.id)}" data-action="choisir" data-id="${esc(a.id)}" data-depuis="catalogue">Porter avec…</button>
        </li>`).join("")
      : `<li class="vide">Aucune pièce oubliée : tout a été porté ces trois dernières semaines.</li>`;
  }

  function dateCourte(iso) {
    const d = new Date(DATE_RE.test(iso) ? midi(iso) : iso);
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
    const m = donnees.pieces[a.id] || {};
    const achat = [
      m.prix === null || m.prix === undefined ? "" : `Payée ${euros(m.prix)}${ports ? ` · ${euros(Math.round(m.prix / ports * 100) / 100)} par jour porté` : ""}`,
      m.taille ? "taille " + m.taille : "",
    ].filter(Boolean).join(" · ");
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
        ${achat ? `<span class="assoc">${esc(achat)}</span>` : ""}
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

  // ---------- acheter malin : simulateur, meilleurs achats, envies, budget, coût par port ----------
  // Une pièce envisagée n'a pas de photo : une silhouette de sa couleur la remplace.
  const SILHOUETTES = {
    haut: "M30 18 L42 12 Q50 17 58 12 L70 18 L84 36 L73 42 L69 35 L69 92 L31 92 L31 35 L27 42 L16 36 Z",
    bas: "M31 8 L69 8 L73 96 L56 96 L50 38 L44 96 L27 96 Z",
    dessus: "M29 16 L43 10 L50 34 L57 10 L71 16 L86 38 L75 44 L71 37 L71 94 L29 94 L29 37 L25 44 L14 38 Z M50 34 L50 94",
    pieds: "M12 66 Q14 50 30 48 L46 46 Q56 57 73 59 Q88 61 90 73 L90 80 L12 80 Z",
    aucun: "M24 58 Q24 30 50 30 Q76 30 76 58 L88 62 L88 68 L24 68 Z",
  };
  function silhouette(categorie, teinte) {
    const motif = teinte === "motif";
    const remplissage = motif ? "url(#m)" : /^#[0-9a-f]{6}$/i.test(T[teinte].hex) ? T[teinte].hex : "#9aa0a8";
    const defs = motif ? `<defs><pattern id="m" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#e9e7e2"/><rect width="3" height="6" fill="#8a8a8d"/></pattern></defs>` : "";
    const forme = SILHOUETTES[CAT[categorie].role] || SILHOUETTES.haut;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 125">${defs}<rect width="100" height="125" fill="#eceff3"/><g transform="translate(0 14)"><path d="${forme}" fill="${remplissage}" stroke="#7d8492" stroke-width="1.2" stroke-linejoin="round"/></g></svg>`;
    return "data:image/svg+xml," + encodeURIComponent(svg);
  }
  // Une pièce envisagée (simulateur ou envie), sous la forme d'un article.
  function pieceEnvisagee(v, id) {
    if (!v || !possede(CAT, v.categorie) || !possede(T, v.teinte)) return null;
    const pull = PULL_CATS.includes(v.categorie);
    return {
      id: id || "simulation", envisagee: true, categorie: v.categorie, teinte: v.teinte,
      encolure: pull && possede(ENCOLURES, v.encolure) ? v.encolure : undefined,
      marque: v.marque || "", modele: v.modele || "", couleur: v.couleur || T[v.teinte].nom,
      coupe: "", lien: v.lien || null, image: silhouette(v.categorie, v.teinte),
    };
  }
  // Ce qu'une pièce ajouterait : paires haut + bas, superpositions, tenues qu'elle peut couvrir.
  function apport(p) {
    const r = role(p);
    const res = { hb: 0, sures: 0, sup: 0, dessus: 0, pieds: 0, total: 0 };
    if (r === "haut") BAS.forEach(b => { const s = accord(b, p); if (s) { res.hb++; if (s === 2) res.sures++; } });
    if (r === "bas") HAUTS.forEach(h => { const s = accord(p, h); if (s) { res.hb++; if (s === 2) res.sures++; } });
    if (peutEtreDessous(p)) HAUTS.forEach(h => { if (accepte(h, p) && superposer(p, h).score) res.sup++; });
    if (accepteDessous(p)) SOUS.forEach(s => { if (accepte(p, s) && superposer(s, p).score) res.sup++; });
    if (r === "dessus" || r === "pieds") {
      BAS.forEach(b => HAUTS.forEach(h => {
        if (!accord(b, h)) return;
        if (r === "dessus") { if (surcouche(p, h, b).score) res.dessus++; return; }
        const k = touche(p, { bas: b.id, haut: h.id });
        if (!k || k.score === 2) res.pieds++;
      }));
    }
    res.total = res.hb + res.sup + (DESSUS.length ? 0 : res.dessus) + (PIEDS.length ? 0 : res.pieds);
    // Pour classer : une valeur sûre compte double ; une première paire de chaussures ou une
    // première veste comptent pour toutes les tenues qu'elles complètent.
    res.valeur = res.sures * 2 + (res.hb - res.sures) + res.sup * 1.5
      + res.dessus * (DESSUS.length ? 0.05 : 0.2)
      + (r === "pieds" ? (PIEDS.length ? res.pieds * 0.05 : 1000 + res.pieds) : 0);
    return res;
  }
  function texteApport(p, a) {
    const r = role(p), morceaux = [];
    if (a.hb) morceaux.push(`+${pluriel(a.hb, "tenue")} haut + bas${a.sures ? `, dont ${pluriel(a.sures, "valeur")} sûre${a.sures > 1 ? "s" : ""}` : ""}`);
    if (a.sup) morceaux.push(`+${pluriel(a.sup, "combinaison")} sous-couche + haut`);
    if (r === "dessus" && a.dessus) morceaux.push(DESSUS.length ? `par-dessus possible sur ${pluriel(a.dessus, "tenue")}` : `ta première couche par-dessus, pour ${pluriel(a.dessus, "tenue")}`);
    if (r === "pieds" && a.pieds) morceaux.push(PIEDS.length ? `une paire de plus pour ${pluriel(a.pieds, "tenue")}` : `${pluriel(a.pieds, "tenue")} deviennent 100 % magasin`);
    if (r === "aucun") morceaux.push("un accessoire pour relever tes tenues");
    return morceaux.length ? morceaux.join(" · ") : "aucune nouvelle tenue avec ce que tu as";
  }
  // Un calcul fait avec la pièce glissée un instant dans la garde-robe.
  function avecPieceEnvisagee(p, fn) {
    const sauve = ajoutes;
    ajoutes = ajoutes.concat([p]);
    indexer();
    try { return fn(); } finally { ajoutes = sauve; indexer(); }
  }
  const CANDIDATS = [
    ["t-shirts"], ["chemises"], ["polos"], ["pulls", "rond"], ["pulls", "zip"], ["pulls", "v"], ["sweats", "capuche"],
    ["vestes"], ["blousons"], ["manteaux"], ["chaussures"], ["pantalons"], ["jeans"],
  ];
  const TEINTES_PIEDS = ["blanc", "noir", "marron", "ecru", "beige", "gris-clair", "gris-fonce", "marine"];
  function teinteCandidate(categorie, teinte) {
    if (teinte === "motif") return categorie === "chemises";
    if (teinte.startsWith("denim-")) return categorie === "jeans" || categorie === "vestes";
    if (categorie === "jeans") return ["noir", "gris-moyen", "gris-clair", "blanc"].includes(teinte);
    if (categorie === "chaussures") return TEINTES_PIEDS.includes(teinte);
    return true;
  }
  // Les achats qui rapporteraient le plus, sans une pièce que tu as déjà dans la même couleur.
  function meilleursAchats() {
    const res = [];
    for (const [categorie, encolure] of CANDIDATS) {
      for (const teinte of Object.keys(T)) {
        if (!teinteCandidate(categorie, teinte)) continue;
        if (ARTICLES.some(a => a.categorie === categorie && a.teinte === teinte && (!encolure || a.encolure === encolure))) continue;
        const p = pieceEnvisagee({ categorie, teinte, encolure, modele: encolure ? ENCOLURES[encolure] : "" });
        const a = apport(p);
        // À valeur égale, la couleur la plus classique d'abord (pour les chaussures).
        if (categorie === "chaussures") a.valeur += (TEINTES_PIEDS.length - TEINTES_PIEDS.indexOf(teinte)) * 0.01;
        if (a.total > 0) res.push({ p, a });
      }
    }
    res.sort((x, y) => y.a.valeur - x.a.valeur);
    const parCat = {}, choisis = [];
    for (const x of res) {
      const k = x.p.categorie;
      if ((parCat[k] || 0) >= 2) continue;
      parCat[k] = (parCat[k] || 0) + 1;
      choisis.push(x);
      if (choisis.length === 6) break;
    }
    return choisis;
  }
  function nomEnvisage(p) {
    if (p.marque) return `${p.marque} ${p.modele || singulier(p.categorie)} ${p.couleur.toLowerCase()}`;
    const base = role(p) === "pieds" ? CAT[p.categorie].nom
      : p.encolure ? `${singulier(p.categorie)} ${ENCOLURES[p.encolure].toLowerCase()}` : singulier(p.categorie);
    return `${base} · ${p.couleur.toLowerCase()}`;
  }
  const euros = n => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
  const remise = () => donnees.reglages.remise || 0;
  const prixRemise = prix => Math.round(prix * (100 - remise())) / 100;
  // Dépensé dans un mois : les prix payés des pièces achetées ce mois-là.
  function depensesDuMois(mois) {
    let total = 0, n = 0;
    for (const [id, m] of Object.entries(donnees.pieces)) {
      if (PAR_ID[id] && m.prix !== null && m.achatLe && m.achatLe.startsWith(mois)) { total += m.prix; n++; }
    }
    return { total: Math.round(total * 100) / 100, n };
  }
  // Un montant tapé : « 59,90 » ou « 59.90 » ; null si vide ou invalide.
  function lireMontant(v, max) {
    const s = String(v || "").trim().replace(/\s|€/g, "").replace(",", ".");
    if (!s) return null;
    const n = Number(s);
    return isFinite(n) && n >= 0 && n <= max ? Math.round(n * 100) / 100 : undefined;
  }
  const saisie = n => String(n).replace(".", ",");   // un montant tel qu'on le tape en français
  const idNouveau = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  // Simulateur « Et si j'achetais… »
  const simulTouches = new Set();
  let simulAnalyse = null;
  function remplirListesAcheter() {
    F("simul-categorie").innerHTML = `<option value="">Choisir…</option>` +
      D.categories.map(c => `<option value="${esc(c.id)}">${esc(c.nom)}</option>`).join("");
    F("simul-teinte").innerHTML = `<option value="">Choisir…</option>` +
      Object.entries(T).map(([id, t]) => `<option value="${esc(id)}">${esc(t.nom)}</option>`).join("");
    F("simul-col").innerHTML = `<option value="">Peu importe</option>` +
      Object.entries(ENCOLURES).map(([id, nom]) => `<option value="${esc(id)}">${esc(nom)}</option>`).join("");
  }
  function simulDepuisTitre() {
    // Seul un titre au format Canva (« Marque - Catégorie - Modèle - Couleur ») est analysé ;
    // un nom libre reste un simple libellé.
    const titre = F("simul-titre").value;
    const analyse = /\s[-–—]\s/.test(titre) ? analyserTitre(titre) : null;
    simulAnalyse = analyse && analyse.categorie ? analyse : null;
    if (!simulAnalyse) return;
    const r = simulAnalyse;
    if (!simulTouches.has("simul-categorie") && r.categorie) F("simul-categorie").value = r.categorie;
    const cat = F("simul-categorie").value;
    if (!simulTouches.has("simul-teinte") && r.couleur) F("simul-teinte").value = devinerTeinte(r.couleur, cat, r.modele) || "";
    if (!simulTouches.has("simul-col")) F("simul-col").value = devinerEncolure(r.modele, cat) || "";
  }
  function pieceDuSimulateur() {
    const r = simulAnalyse || {};
    const encolure = PULL_CATS.includes(F("simul-categorie").value) ? F("simul-col").value : "";
    return pieceEnvisagee({
      categorie: F("simul-categorie").value, teinte: F("simul-teinte").value, encolure,
      marque: r.marque, modele: r.modele || (encolure ? ENCOLURES[encolure] : ""), couleur: r.couleur,
    });
  }
  function viderSimulateur() {
    F("form-simul").reset();
    simulTouches.clear();
    simulAnalyse = null;
    F("simul-erreur").textContent = "";
  }
  function rendreSimulateur() {
    const teinte = F("simul-teinte").value, categorie = F("simul-categorie").value;
    F("simul-pastille").style.background = possede(T, teinte) ? T[teinte].hex : "transparent";
    F("champ-simul-col").hidden = !PULL_CATS.includes(categorie);
    F("simul-envie").disabled = !peutNoter();
    const zone = F("simul-resultat");
    const p = pieceDuSimulateur();
    if (!p) {
      zone.innerHTML = `<p class="vide">Choisis une catégorie et une couleur, ou colle un titre au format Canva : la page calcule les tenues que la pièce t'ouvrirait.</p>`;
      return;
    }
    const a = apport(p);
    const memes = ARTICLES.filter(x => x.categorie === p.categorie && x.teinte === p.teinte && (!p.encolure || x.encolure === p.encolure));
    const vide = !ARTICLES.some(x => x.categorie === p.categorie);
    const prix = lireMontant(F("simul-prix").value, 100000);
    const tenues = avecPieceEnvisagee(p, () => suggestionsAutour(PAR_ID[p.id]).slice(0, 3)
      .map((t, i) => ligneTenue(t, `<span class="eyebrow">Tenue ${i + 1} avec cette pièce</span>`, "")).join(""));
    const lignePrix = prix ? `<p class="mono">${esc(euros(prixRemise(prix)))}${remise() ? ` avec ta remise de ${remise()} %` : ""}${a.total ? ` · ${esc(euros(prixRemise(prix) / a.total))} par nouvelle tenue` : ""}</p>` : "";
    zone.innerHTML = `
      <div class="simul-tete">
        <img src="${esc(p.image)}" alt="" width="64" height="80">
        <div>
          <strong>${esc(majuscule(nomEnvisage(p)))}</strong>
          <p class="apport">${esc(majuscule(texteApport(p, a)))}.</p>
          ${lignePrix}
          ${vide ? `<p><span class="badge complet">Première pièce en ${esc(CAT[p.categorie].nom.toLowerCase())}</span></p>` : ""}
          ${memes.length ? `<p class="aide">Tu as déjà ${memes.length > 1 ? `${memes.length} pièces` : "une pièce"} de ce type dans cette couleur.</p>` : ""}
        </div>
      </div>
      ${tenues ? `<ol class="semaine">${tenues}</ol>` : `<p class="vide">Aucune tenue complète ne se forme avec cette pièce et ce que tu as.</p>`}`;
  }
  // Ces calculs ne dépendent que de la garde-robe : gardés d'un rendu à l'autre tant qu'elle ne change pas.
  const memo = new Map();
  function memoiser(nom, cle, calcul) {
    const m = memo.get(nom);
    if (m && m.cle === cle) return m.val;
    const val = calcul();
    memo.set(nom, { cle, val });
    return val;
  }
  const cleGarderobe = () => ARTICLES.map(a => [a.id, a.categorie, a.marque, a.teinte, a.encolure || ""].join(":")).join("|");
  function rendreMeilleursAchats() {
    const liste = memoiser("meilleurs-achats", cleGarderobe(), meilleursAchats);
    F("meilleurs-achats").innerHTML = liste.length ? liste.map(({ p, a }, i) => `<li>
        <span class="rang" aria-hidden="true">${i + 1}</span>
        <img src="${esc(p.image)}" alt="" width="40" height="50">
        <span class="classement-corps"><strong>${esc(majuscule(nomEnvisage(p)))}</strong><span class="aide">${esc(majuscule(texteApport(p, a)))}</span></span>
        <button class="btn petit" type="button" id="simuler-${i}" data-action="simuler" data-categorie="${esc(p.categorie)}" data-teinte="${esc(p.teinte)}" data-col="${esc(p.encolure || "")}">Simuler</button>
      </li>`).join("") : `<li class="vide">Ta garde-robe couvre déjà toutes les couleurs utiles.</li>`;
  }
  function rendreEnvies() {
    const garderobe = cleGarderobe();
    const envies = Object.entries(donnees.envies).map(([id, e]) => {
      const p = pieceEnvisagee(e, "envie-" + id);
      return p ? { id, e, p, a: memoiser("envie-" + id, garderobe + JSON.stringify([e.categorie, e.teinte, e.encolure]), () => apport(p)) } : null;
    }).filter(Boolean);
    // Le meilleur rapport d'abord : prix remisé par nouvelle tenue ; sans prix, à la fin.
    const ratio = x => (x.e.prix && x.a.total ? prixRemise(x.e.prix) / x.a.total : Infinity);
    envies.sort((x, y) => ratio(x) - ratio(y) || y.a.valeur - x.a.valeur || x.e.ajouteLe.localeCompare(y.e.ajouteLe));
    F("compte-envies").textContent = envies.length ? pluriel(envies.length, "envie") : "";
    F("liste-envies").innerHTML = envies.length ? envies.map(({ id, e, p, a }) => {
      const prix = e.prix
        ? `${esc(euros(prixRemise(e.prix)))}${remise() ? ` <s>${esc(euros(e.prix))}</s>` : ""}${a.total ? ` · ${esc(euros(prixRemise(e.prix) / a.total))} par nouvelle tenue` : ""}`
        : "Prix non indiqué";
      return `<li class="sans-rang">
        <img src="${esc(p.image)}" alt="" width="40" height="50">
        <span class="classement-corps">
          <strong>${esc(e.titre || majuscule(nomEnvisage(p)))}</strong>
          <span class="mono">${prix}</span>
          <span class="aide">${esc(majuscule(texteApport(p, a)))}</span>
          ${e.lien ? `<a href="${esc(e.lien)}" target="_blank" rel="noopener noreferrer">Voir la fiche ↗</a>` : ""}
        </span>
        <span class="ligne-actions">
          <button class="btn petit" type="button" id="envie-simuler-${esc(id)}" data-action="envie-simuler" data-id="${esc(id)}">Simuler</button>
          ${peutEcrire && peutNoter() ? `<button class="btn petit primaire" type="button" id="envie-achetee-${esc(id)}" data-action="envie-achetee" data-id="${esc(id)}">Je l'ai acheté</button>` : ""}
          ${peutNoter() ? `<button class="btn petit danger" type="button" id="envie-retirer-${esc(id)}" data-action="envie-retirer" data-id="${esc(id)}">Retirer</button>` : ""}
        </span>
      </li>`;
    }).join("") : `<li class="vide">${peutNoter() ? "Ajoute ici les pièces repérées au magasin avec « Avant d'acheter » : elles se classent selon ce qu'elles t'apporteraient pour leur prix." : "Aucune envie pour l'instant."}</li>`;
  }
  function rendreBudget() {
    const r = donnees.reglages;
    if (document.activeElement !== F("reglage-remise")) F("reglage-remise").value = r.remise ? String(r.remise) : "";
    if (document.activeElement !== F("reglage-budget")) F("reglage-budget").value = r.budget ? saisie(r.budget) : "";
    // Pas de saisie avant la lecture des réglages enregistrés : l'autre valeur serait remise à 0.
    F("reglage-remise").disabled = F("reglage-budget").disabled = !peutNoter() || (modeDonnees === "base" && !reglagesLus);
    const nomMois = new Date(midi(AUJ_DATE)).toLocaleDateString("fr-FR", { month: "long" });
    const d = depensesDuMois(AUJ_DATE.slice(0, 7));
    const depense = d.n ? `${esc(euros(d.total))} dépensés en ${nomMois} (${pluriel(d.n, "pièce")})` : `Rien de noté en ${nomMois}`;
    if (!r.budget) {
      F("budget-jauge").innerHTML = `<p class="aide">${depense}.${peutNoter() ? " Indique un budget par mois pour suivre tes achats ; le prix payé se note à l'ajout d'une pièce ou dans « Rentabilité »." : " Aucun budget indiqué."}</p>`;
      return;
    }
    const part = Math.min(1, d.total / r.budget), reste = Math.round((r.budget - d.total) * 100) / 100;
    F("budget-jauge").innerHTML = `
      <p>${d.n ? `<strong>${esc(euros(d.total))}</strong> dépensés` : "Rien de dépensé"} en ${nomMois} sur ${esc(euros(r.budget))} · ${reste >= 0 ? `reste ${esc(euros(reste))}` : `dépassé de ${esc(euros(-reste))}`}</p>
      <div class="jauge${reste < 0 ? " depasse" : ""}" role="meter" aria-valuemin="0" aria-valuemax="${r.budget}" aria-valuenow="${Math.min(d.total, r.budget)}" aria-label="Budget de ${nomMois} dépensé"><span style="width:${(part * 100).toFixed(1)}%"></span></div>`;
  }

  // Coût par port : le prix payé divisé par le nombre de ports notés au journal.
  let editionCout = null;   // pièce dont on note le prix, la taille et la date d'achat
  let erreurCout = "";
  function formCout(a) {
    const m = donnees.pieces[a.id] || {};
    return `<form class="cout-form" id="cout-form" data-id="${esc(a.id)}" novalidate>
      <div class="champ"><label for="cout-prix">Prix payé (€)</label><input type="text" id="cout-prix" inputmode="decimal" autocomplete="off" maxlength="12" placeholder="59,90" value="${m.prix === null || m.prix === undefined ? "" : esc(saisie(m.prix))}"></div>
      <div class="champ"><label for="cout-date">Acheté le</label><input type="date" id="cout-date" max="${AUJ_DATE}" value="${esc(m.achatLe || "")}"></div>
      <div class="champ"><label for="cout-taille">Taille</label><input type="text" id="cout-taille" maxlength="20" autocomplete="off" value="${esc(m.taille || "")}" placeholder="M, 32/32…"></div>
      <p class="form-erreur" role="alert">${esc(erreurCout)}</p>
      <div class="actions">
        <button class="btn petit primaire" type="submit" id="cout-enregistrer">Enregistrer</button>
        <button class="btn petit" type="button" id="cout-annuler" data-action="cout-annuler">Annuler</button>
      </div>
    </form>`;
  }
  function rendreCoutPort() {
    const lignes = ARTICLES.map(a => {
      const m = donnees.pieces[a.id] || {};
      const ports = PORTS.get(a.id) || 0;
      const prix = m.prix === null || m.prix === undefined ? null : m.prix;
      return { a, m, ports, prix, cout: prix === null ? null : ports ? prix / ports : prix };
    });
    const avecPrix = lignes.filter(x => x.prix !== null);
    const total = avecPrix.reduce((s, x) => s + x.prix, 0);
    const ports = avecPrix.reduce((s, x) => s + x.ports, 0);
    F("cout-bilan").textContent = avecPrix.length
      ? `${euros(Math.round(total * 100) / 100)} pour ${pluriel(avecPrix.length, "pièce")} au prix noté · ${pluriel(ports, "jour")} porté${ports > 1 ? "s" : ""}${ports ? ` · ${euros(Math.round(total / ports * 100) / 100)} par jour porté en moyenne` : ""}.`
      : "Aucun prix noté pour l'instant.";
    // Pendant la saisie, la liste ne se redessine pas sous les doigts.
    const form = F("cout-form");
    if (form && form.contains(document.activeElement) && editionCout === form.dataset.id) return;
    // Les pièces au coût par port le plus élevé d'abord : ce sont elles qu'il faut sortir.
    const avec = lignes.filter(x => x.prix !== null), sans = lignes.filter(x => x.prix === null);
    avec.sort((x, y) => y.cout - x.cout || ORDRE_CAT[x.a.categorie] - ORDRE_CAT[y.a.categorie]);
    const ligne = ({ a, m, ports, prix, cout }) => {
      const details = [m.taille ? "Taille " + m.taille : "", m.achatLe ? "achetée le " + dateCourte(m.achatLe) : ""].filter(Boolean).join(" · ");
      const ligneCout = prix === null ? "Prix non noté"
        : ports ? `${euros(Math.round(cout * 100) / 100)} par jour porté · ${euros(prix)}, portée ${ports} fois`
        : `${euros(prix)} · pas encore portée`;
      return `<li class="sans-rang">
        <img src="${esc(a.image)}" alt="" width="40" height="50" loading="lazy">
        <span class="classement-corps">
          <strong>${esc(a.marque)} ${esc(role(a) === "bas" ? court(a) : court(a).toLowerCase())}</strong>
          <span class="mono">${esc(ligneCout)}</span>
          ${details ? `<span class="aide">${esc(majuscule(details))}</span>` : ""}
        </span>
        ${peutNoter() && editionCout !== a.id ? `<button class="btn petit" type="button" id="cout-modifier-${esc(a.id)}" data-action="cout-modifier" data-id="${esc(a.id)}">${prix === null ? "Noter le prix" : "Modifier"}</button>` : "<span></span>"}
        ${editionCout === a.id ? formCout(a) : ""}
      </li>`;
    };
    F("cout-port").innerHTML = avec.length ? avec.map(ligne).join("")
      : `<li class="vide">${peutNoter() ? "Note le prix payé d'une pièce pour voir ce qu'elle te coûte chaque fois que tu la portes." : "Aucun prix noté pour l'instant."}</li>`;
    F("cout-sans").hidden = !sans.length;
    F("cout-sans-titre").textContent = `${pluriel(sans.length, "pièce")} sans prix noté`;
    F("cout-sans-prix").innerHTML = sans.map(ligne).join("");
    if (editionCout && sans.some(x => x.a.id === editionCout)) F("cout-sans").open = true;
  }
  function rendreAcheter() {
    rendreBudget();
    rendreSimulateur();
    rendreMeilleursAchats();
    rendreEnvies();
    rendreCoutPort();
  }

  // ---------- styliste : Claude dans la page, sur le compte de la personne qui regarde ----------
  // Chaque demande part d'un clic ; la première demande d'une visite demande l'accord de la personne.
  let sample = null;                   // la fonction de la capacité, ou null : pas de styliste ici
  let etatStyliste = window.claude && typeof window.claude.use === "function" ? "attente" : "absent";
  let stylisteImages = false;          // cette vue peut montrer une photo à Claude
  const CODES_ABSENCE = ["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"];
  function messageStyliste(e) {
    return {
      rate_limited: "Trop de demandes d'un coup : réessaie dans un moment.",
      session_expired: "Ta session Claude a expiré : recharge la page.",
      refused: "Claude n'a pas voulu répondre à cette demande : reformule-la.",
      empty_completion: "Pas de réponse : reformule ta question plus simplement.",
      prompt_too_large: "La demande est trop longue : raccourcis-la.",
      image_rejected: "Cette photo n'a pas pu être lue : choisis-en une autre.",
      images_unavailable: "Cette vue ne peut pas montrer de photo à Claude.",
      invalid_json: "La photo n'a pas pu être analysée. Réessaie.",
    }[e && e.code] || "La réponse a été interrompue. Réessaie dans un instant.";
  }
  // Un refus définitif (accès refusé, Claude indisponible) retire le styliste de la vue.
  function echecStyliste(e) {
    const code = e && e.code;
    if (CODES_ABSENCE.includes(code)) {
      sample = null; stylisteImages = false; etatStyliste = "refuse";
      if (ctlStyliste) ctlStyliste.abort();
      rendreBoutonPhoto();
      planifierRendu();
      return "";
    }
    if (code === "images_unavailable") { stylisteImages = false; planifierRendu(); }
    return code === "cancelled" ? "" : messageStyliste(e);
  }

  // Ce que Claude sait : la garde-robe, l'état des pièces, la semaine passée, la météo, les envies.
  function lignePiece(a) {
    const ports = PORTS.get(a.id) || 0;
    return `- ${a.id} : ${singulier(a.categorie).toLowerCase()} ${a.marque} ${a.modele || ""} ${a.couleur}`.replace(/\s+/g, " ") +
      ` (teinte ${T[a.teinte].nom.toLowerCase()}${a.encolure ? ", " + ENCOLURES[a.encolure].toLowerCase() : ""})` +
      `${auLavage(a.id) ? " · AU LAVAGE" : ""} · ${ports ? `portée ${ports} fois` : "jamais portée"}`;
  }
  const decrireTenue = t => SLOTS.filter(k => t[k] && PAR_ID[t[k]]).map(k => `${k} = ${t[k]}`).join(", ");
  function contexteStyliste() {
    const m = meteoDuJour();
    const recents = Object.values(donnees.journal)
      .filter(e => { const n = ecartJours(AUJ_DATE, e.date); return n >= 0 && n <= 7; })
      .sort((x, y) => y.date.localeCompare(x.date))
      .map(e => `- ${e.date} : ${decrireTenue(e.tenue)}`);
    const pasPourMoi = Object.entries(donnees.gouts).filter(([, v]) => v <= -2).slice(0, 30)
      .map(([k]) => "- " + k.slice(3).split("|").join(" avec "));
    const envies = Object.values(donnees.envies).slice(0, 15)
      .map(e => `- ${e.titre || `${singulier(e.categorie).toLowerCase()} ${T[e.teinte].nom.toLowerCase()}`}${e.prix ? ` (${euros(e.prix)})` : ""}`);
    return [
      `Aujourd'hui : ${dateLongue(AUJ_DATE)}.${m ? ` Météo : ${METEOS[m].nom.toLowerCase()}.` : ""} Tenues en ${pluriel(etat.couches, "couche")} en haut.`,
      "Garde-robe (identifiant : pièce) :", ...ARTICLES.map(lignePiece),
      recents.length ? "Tenues portées ces 7 derniers jours :\n" + recents.join("\n") : "Rien de noté au journal ces 7 derniers jours.",
      envies.length ? "Pièces repérées au magasin, pas encore achetées :\n" + envies.join("\n") : "",
      operationActive() ? `Opération magasin en cours : mets la marque ${operationActive().marque} en avant dans tes tenues${operationActive().fin ? ` (jusqu'au ${operationActive().fin})` : ""}.` : "",
      m === "pluie" ? "Il pleut : pas de bas clair (beige, gris clair, jean clair)." : "",
      pasPourMoi.length ? "Associations notées « pas pour moi », à ne jamais proposer :\n" + pasPourMoi.join("\n") : "",
    ].filter(Boolean).join("\n");
  }
  const CONSIGNES = `Tu es le styliste personnel d'une personne qui travaille dans un magasin de prêt-à-porter Blue Box. Au travail, elle ne porte que des pièces achetées au magasin, pour mettre la collection en valeur ; c'est aussi son style.
Réponds en français, en la tutoyant, de façon concrète et brève (8 phrases au plus), en texte simple : pas de titres ni de gras ; des tirets si tu fais une liste.
Appuie-toi sur sa garde-robe ci-dessous. Ne propose que des pièces de la liste, sauf si on te demande quoi acheter. N'utilise jamais une pièce marquée AU LAVAGE ; évite celles portées ces derniers jours quand c'est possible.
Quand tu proposes une tenue faite de ses pièces, termine ta réponse par une ligne par tenue (trois au plus), exactement au format :
TENUE: bas=<id>; haut=<id>; dessous=<id>; dessus=<id>; pieds=<id>
avec seulement des identifiants de la liste, en omettant les places vides (dessous : la pièce portée sous le haut ; dessus : veste, blouson ou manteau).`;

  // Les tenues proposées par Claude : lues dans les lignes « TENUE: », vérifiées avant d'être montrées.
  // Seule la forme machine exacte compte (« Tenue : … » en prose reste du texte).
  const LIGNE_TENUE = /^TENUE:\s*((?:bas|haut|dessous|dessus|pieds)=.*)$/gm;
  function tenuesDansTexte(texte) {
    const res = [];
    for (const [, corps] of String(texte).matchAll(LIGNE_TENUE)) {
      const t = {};
      let inconnue = false;
      corps.split(";").forEach(morceau => {
        const [k, v] = morceau.split("=").map(x => (x || "").trim());
        if (!["bas", "haut", "dessous", "dessus", "pieds"].includes(k)) return;
        // Une place laissée vide (« pieds= », « dessus=aucun ») est simplement absente.
        if (k !== "bas" && k !== "haut" && /^(|aucun|aucune|rien|-|none|null)$/i.test(v)) return;
        // Une pièce inventée invalide toute la ligne : pas de tenue amputée en silence.
        if (possede(PAR_ID, v)) t[k] = v; else inconnue = true;
      });
      if (!inconnue && tenueCoherente(t) && !res.some(x => cleTenue(x) === cleTenue(t))) res.push(t);
    }
    return res.slice(0, 3);
  }
  function tenueCoherente(t) {
    const h = PAR_ID[t.haut], s = PAR_ID[t.dessous], d = PAR_ID[t.dessus], p = PAR_ID[t.pieds];
    return valide(t) && (!s || accepte(h, s)) && (!d || role(d) === "dessus") && (!p || role(p) === "pieds")
      && SLOTS.every(k => !t[k] || !auLavage(t[k]));
  }
  // Le texte affiché, sans les lignes « TENUE: » (ni leur début pendant que la réponse s'écrit).
  function texteVisible(texte) {
    let s = String(texte).replace(LIGNE_TENUE, "");
    const fin = s.slice(s.lastIndexOf("\n") + 1);
    if (fin && (fin.startsWith("TENUE:") || "TENUE:".startsWith(fin))) s = s.slice(0, s.lastIndexOf("\n") + 1);
    return s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\n{3,}/g, "\n\n").trim();
  }
  function tenuesProposees(tenuesBrutes, prefixe) {
    // Revérifiées à chaque rendu : une pièce partie au lavage depuis la réponse retire la tenue.
    const tenues = tenuesBrutes.map((t, i) => ({ t, i })).filter(x => tenueCoherente(x.t));
    return tenues.length ? `<ol class="semaine">${tenues.map(({ t, i }) => ligneTenue(t,
      `<span class="eyebrow">Proposée par le styliste</span>`,
      `<span class="ligne-actions"><button class="btn petit" type="button" id="${prefixe}-${i}" data-action="styliste-porter" data-source="${prefixe}" data-i="${i}">Porter aujourd'hui</button></span>`)).join("")}</ol>` : "";
  }

  // Conversation : gardée le temps de la visite ; Claude ne se souvient de rien entre deux demandes.
  let conversation = [];               // { role: "user" | "assistant", texte, tenues?, erreur?, enCours? }
  let ctlStyliste = null;
  const IDEES = [
    "Quelle tenue pour une grosse journée en magasin ?",
    "Qu'est-ce que je devrais acheter ensuite ?",
    "Comment varier avec mes pulls zippés ?",
    "Quelles pièces je ne mets pas assez ?",
  ];
  function rendreStyliste() {
    const pret = etatStyliste === "pret";
    F("styliste-zone").hidden = !pret;
    F("styliste-absent").hidden = pret || etatStyliste === "attente";
    F("styliste-absent").textContent = etatStyliste === "refuse"
      ? "Le styliste n'est pas disponible : Claude n'est pas autorisé pour cette page ou ce compte."
      : "Le styliste fonctionne dans la page publiée, ouverte sur Claude.";
    F("styliste-nouveau").hidden = !pret || !conversation.length;
    if (!pret) return;
    const enCours = !!ctlStyliste;
    F("styliste-idees").innerHTML = IDEES.map((q, i) =>
      `<button class="puce-idee" type="button" id="idee-${i}" data-action="styliste-idee" data-i="${i}"${enCours ? " disabled" : ""}>${esc(q)}</button>`).join("");
    // aria-disabled plutôt que disabled : le bouton garde le focus pendant la réponse.
    F("styliste-envoyer").setAttribute("aria-disabled", String(enCours));
    F("styliste-stop").hidden = !enCours;
    F("conversation").innerHTML = conversation.map((m, i) => m.role === "user"
      ? `<li class="message moi${m.exclue ? " exclue" : ""}"><p>${esc(m.texte)}</p></li>`
      : `<li class="message claude">
          <p${m.enCours && !m.texte ? ` class="reflexion"` : ""}>${esc(m.enCours && !m.texte ? "Le styliste réfléchit…" : texteVisible(m.texte))}</p>
          ${m.erreur ? `<p class="form-erreur">${esc(m.erreur)}</p>` : ""}
          ${m.enCours ? "" : tenuesProposees(m.tenues || [], "conv-" + i)}
        </li>`).join("");
  }
  async function demanderStyliste(question) {
    question = String(question || "").trim().slice(0, 1000);
    if (!question || !sample || ctlStyliste) return;
    conversation.push({ role: "user", texte: question });
    const reponse = { role: "assistant", texte: "", enCours: true };
    conversation.push(reponse);
    // Les consignes et la garde-robe ouvrent toujours l'échange ; les plus anciens messages tombent.
    const tours = conversation.slice(0, -1).filter(m => !m.exclue && m.texte).slice(-10)
      .map(m => ({ role: m.role, content: m.texte }))
      .filter(m => m.content);
    while (tours.length && tours[0].role !== "user") tours.shift();
    const entree = [{ role: "user", content: CONSIGNES + "\n\n" + contexteStyliste() }].concat(tours);
    const ctl = ctlStyliste = new AbortController();
    rendre(rendreStyliste);
    try {
      const r = await sample(entree, {
        signal: ctl.signal, cache: false,
        onText: ({ text }) => { reponse.texte = text; rendreMessageEnCours(reponse); },
      });
      reponse.texte = r.text;
      if (r.truncated) reponse.erreur = "Réponse coupée : pose une question plus courte.";
    } catch (e) {
      reponse.texte = e && e.text ? e.text : "";
      reponse.erreur = echecStyliste(e) || (e && e.code === "cancelled" ? "Arrêtée." : "");
      reponse.interrompue = true;
      // Claude a refusé cette question : la renvoyer ferait refuser toutes les suivantes.
      if (e && e.code === "refused") { const q = conversation[conversation.indexOf(reponse) - 1]; if (q) q.exclue = true; }
    }
    reponse.enCours = false;
    // Une réponse coupée ou interrompue peut finir au milieu d'une ligne TENUE : on n'en lit aucune.
    reponse.tenues = reponse.interrompue || reponse.erreur ? [] : tenuesDansTexte(reponse.texte);
    if (ctlStyliste === ctl) ctlStyliste = null;
    // Le focus était sur « Arrêter » ou « Demander » : il passe à la réponse plutôt que de se perdre.
    const actif = document.activeElement;
    const perdu = !actif || actif === document.body || ["styliste-stop", "styliste-envoyer"].includes(actif.id);
    rendre(rendreStyliste);
    if (perdu && etatStyliste === "pret") {
      const li = F("conversation").lastElementChild;
      const b = li && li.querySelector("button");
      if (b) b.focus({ preventScroll: true });
      else if (li) { li.tabIndex = -1; li.focus({ preventScroll: true }); }
    }
  }
  // Pendant l'écriture, seul le dernier message change : le reste de la page ne bouge pas.
  function rendreMessageEnCours(m) {
    const li = F("conversation").lastElementChild;
    const p = li && li.querySelector("p");
    if (!p || conversation[conversation.length - 1] !== m) return;
    p.classList.remove("reflexion");
    p.textContent = texteVisible(m.texte) || "…";
  }

  // Avis du styliste sur la tenue du jour : court, rapide, pour la tenue affichée seulement.
  let avis = null;                     // { cle, texte, tenues, erreur, enCours, ctl }
  async function demanderAvis() {
    const r = tenueAffichee();
    if (!sample || !r || (avis && avis.enCours)) return;
    const t = r.t, ev = noterTenue(t);
    const courant = avis = { cle: cleTenue(t), texte: "", tenues: [], erreur: "", enCours: true, ctl: new AbortController() };
    rendre(rendreTenue);
    const consigne = `${CONSIGNES}\n\n${contexteStyliste()}\n\nLa page propose cette tenue pour aujourd'hui : ${decrireTenue(t)}.\n` +
      `Son verdict : ${NIVEAUX[ev.niveau].nom}. ${ev.raisons.map(x => x.titre + " " + x.note).join(" ")}\n` +
      `Donne ton avis en trois phrases au plus : ce qui fonctionne, ce qui pourrait coincer, et une retouche simple avec ses pièces si elle améliore la tenue (dans ce cas seulement, ajoute la ligne TENUE de la variante).`;
    try {
      const res = await sample(consigne, {
        signal: courant.ctl.signal, modelTier: "quick",
        onText: ({ text }) => {
          courant.texte = text;
          // Seul le texte change : le bouton « Arrêter » reste en place (focus et clics gardés).
          const p = avis === courant && F("avis-styliste").querySelector(".avis-texte");
          if (p) { p.classList.remove("reflexion"); p.textContent = texteVisible(text) || "…"; }
        },
      });
      courant.texte = res.text;
      if (res.truncated) { courant.interrompu = true; courant.erreur = "Avis coupé : redemande-le dans un instant."; }
    } catch (e) {
      courant.texte = e && e.text ? e.text : "";
      courant.erreur = echecStyliste(e);
      courant.interrompu = true;
    }
    courant.enCours = false;
    courant.tenues = courant.interrompu ? [] : tenuesDansTexte(courant.texte).filter(x => cleTenue(x) !== courant.cle);
    if (avis !== courant) return;
    const surStop = document.activeElement && document.activeElement.id === "avis-stop";
    rendre(rendreTenue);
    if (surStop) { const b = F("avis-0") || F("avis-tenue"); if (b) b.focus({ preventScroll: true }); }
  }
  function rendreAvis() {
    const zone = F("avis-styliste");
    const r = tenueAffichee();
    // L'avis ne vaut que pour la tenue qu'il commente.
    if (avis && (!r || cleTenue(r.t) !== avis.cle)) { if (avis.enCours) avis.ctl.abort(); avis = null; }
    if (!avis || !sample && !avis.texte && !avis.erreur) { zone.hidden = true; zone.innerHTML = ""; return; }
    zone.hidden = false;
    zone.innerHTML = `<p class="eyebrow">Avis du styliste</p>
      <p class="avis-texte${avis.enCours && !avis.texte ? " reflexion" : ""}">${esc(avis.enCours && !avis.texte ? "Le styliste regarde ta tenue…" : texteVisible(avis.texte))}</p>
      ${avis.erreur ? `<p class="form-erreur">${esc(avis.erreur)}</p>` : ""}
      ${avis.enCours ? `<button class="btn petit" type="button" id="avis-stop" data-action="avis-stop">Arrêter</button>` : tenuesProposees(avis.tenues, "avis")}`;
  }

  // Reconnaissance de la photo à l'ajout : Claude remplit les champs encore vides.
  let analysePhoto = null;             // AbortController de l'analyse en cours
  function rendreBoutonPhoto() {
    const b = F("achat-claude");
    // En modification, les champs sont déjà remplis : Claude n'aurait rien à compléter.
    b.hidden = !(sample && stylisteImages && photo && !edition);
    b.disabled = !!analysePhoto || envoiEnCours;
    b.textContent = analysePhoto ? "Claude regarde la photo…" : "Remplir avec Claude";
  }
  const PROMPT_PHOTO = () => `Voici la photo d'un vêtement, d'une paire de chaussures ou d'un accessoire acheté dans un magasin de prêt-à-porter. Identifie-le pour remplir une fiche.
Réponds uniquement par un objet JSON de cette forme :
{"categorie": "...", "teinte": "...", "couleur": "...", "modele": "...", "marque": "...", "coupe": "..."}
- categorie : un identifiant parmi ${D.categories.map(c => c.id).join(", ")}
- teinte : la couleur dominante, un identifiant parmi ${Object.keys(T).join(", ")} (motif pour des carreaux ou des rayures)
- couleur : la couleur comme sur une étiquette, en français, courte (ex. « Bleu marine », « Écru »)
- modele : le type ou le col, court (ex. « Oxford », « 1/4 zip », « Col rond », « Slim »), sinon ""
- marque : seulement si un logo ou une étiquette est lisible sur la photo, sinon ""
- coupe : si elle se voit (ex. « Droite », « Ajustée »), sinon ""`;
  async function analyserPhoto() {
    if (!sample || !stylisteImages || !photo || analysePhoto || envoiEnCours) return;
    const pourPhoto = photo;
    const ctl = analysePhoto = new AbortController();
    F("achat-claude-etat").textContent = "";
    rendreBoutonPhoto();
    let message = "";
    try {
      const blob = await exporterPhoto();
      const r = await sample.json(PROMPT_PHOTO(), { images: [blob], modelTier: "quick", signal: ctl.signal });
      // La photo a pu changer, ou le formulaire se fermer, pendant l'analyse.
      if (photo !== pourPhoto) return;
      const { n, utiles } = remplirDepuisPhoto(r);
      message = n ? `Claude a rempli ${pluriel(n, "champ")} : vérifie avant d'ajouter.`
        : utiles ? "Les champs étaient déjà remplis : rien n'a changé."
        : "Claude n'a pas reconnu la pièce : remplis les champs à la main.";
    } catch (e) {
      if (photo !== pourPhoto) return;
      if (e && e.code === "capability_removed") {
        // sample.json absent de cette vue : seule la reconnaissance de photo disparaît.
        stylisteImages = false;
        message = "La reconnaissance de photo n'est pas disponible dans cette vue.";
      } else message = e && e.code === "export" ? messageErreur(e) : echecStyliste(e);
    } finally {
      if (analysePhoto === ctl) analysePhoto = null;
      rendreBoutonPhoto();
    }
    F("achat-claude-etat").textContent = message;
  }
  function remplirDepuisPhoto(r) {
    if (!r || typeof r !== "object" || Array.isArray(r)) return { n: 0, utiles: 0 };
    const categorie = possede(CAT, r.categorie) ? r.categorie : "";
    const valeurs = {
      "achat-categorie": categorie, "achat-teinte": possede(T, r.teinte) ? r.teinte : "",
      "achat-couleur": texte(r.couleur, 40), "achat-modele": texte(r.modele, 80),
      "achat-marque": texte(r.marque, 60), "achat-coupe": texte(r.coupe, 80),
    };
    let n = 0, utiles = 0;
    for (const [id, v] of Object.entries(valeurs)) {
      if (!v) continue;
      utiles++;
      // Un champ rempli par Claude est traité comme rempli à la main : le titre ne l'écrase plus.
      if (!touches.has(id) && !F(id).value.trim()) { F(id).value = v; touches.add(id); n++; }
    }
    majPastille();
    return { n, utiles };
  }

  async function brancherTelechargements() {
    if (!window.claude || typeof window.claude.use !== "function") return;
    try { downloads = await window.claude.use("downloads"); } catch (_) { downloads = null; }
    if (downloads) rendre(rendreStats);
  }
  async function brancherStyliste() {
    if (etatStyliste !== "attente") return;
    let s = null;
    try { s = await window.claude.use("sample"); } catch (_) { s = null; }
    if (typeof s !== "function") { etatStyliste = "absent"; rendre(rendreStyliste); return; }
    sample = s;
    const limites = await s.limits().catch(() => null);
    stylisteImages = !!(limites && limites.images);
    etatStyliste = "pret";
    rendre(rendreStyliste, rendreTenue, rendreBoutonPhoto);
  }

  // ---------- mettre en avant : opération magasin, carte à partager, lookbook, statistiques ----------
  let downloads = null;                // capacité d'enregistrement de fichiers, ou null
  // Opération magasin : une marque mise en avant jusqu'à une date ; les tenues la favorisent.
  let opBrouillon = false;             // le formulaire de l'opération a été touché depuis le dernier envoi
  // Active à une date (aujourd'hui par défaut) : pas encore finie, et la marque a encore une pièce
  // qui entre dans les tenues (un accessoire seul ne peut pas être mis en avant).
  const marquePortable = m => ARTICLES.some(a => a.marque === m && role(a) !== "aucun");
  const operationEnCours = (op, date) => !op.fin || (date || AUJ_DATE) <= op.fin;
  function operationActive(date) {
    const op = donnees.operation;
    return op && operationEnCours(op, date) && marquePortable(op.marque) ? op : null;
  }
  let composeeAvantBase = false;       // tenue du jour composée avant que l'opération soit lue
  const joursAveugles = new Set();     // jours suivants composés avant que l'opération soit lue
  let operationLue = false;
  // Composée avant de connaître l'opération : elle la suivra quand l'opération arrivera.
  function noterAveugle(j) {
    if (operationLue || modeDonnees === "local") return;
    if (j === AUJ[0]) composeeAvantBase = true; else joursAveugles.add(j);
  }
  // L'opération (puis le journal) arrive : les tenues composées à l'aveugle la suivent. Une semaine
  // venue de la base entre-temps efface ces marques (surEtatDistant) ; une tenue choisie ou notée
  // n'est jamais recomposée (recomposerAujourdhui). Vrai si la page vient d'être redessinée.
  function suivreOperation() {
    if (!operationLue || !journalPret()) return false;
    const aveugles = [...joursAveugles];
    joursAveugles.clear();
    let change = false;
    aveugles.forEach(j => {
      const i = JOURS.findIndex(x => x[0] === j);
      if (i > INDEX_AUJ && etat.jours.includes(j) && valide(etat.plan[j]) && operationActive(dateSemaine(i))) { composerJour(j, null); change = true; }
    });
    if (change) ecrire();
    if (!composeeAvantBase) return false;
    composeeAvantBase = false;
    if (!operationActive()) return false;
    recomposerAujourdhui();
    return true;
  }
  const marques = () => [...new Set(ARTICLES.filter(a => role(a) !== "aucun").map(a => a.marque))].sort((x, y) => x.localeCompare(y, "fr"));
  function rendreOperation() {
    const op = donnees.operation, active = operationActive();
    const liste = marques();
    // Une saisie en cours n'est jamais écrasée par un rendu (instantané de la base, autre appareil).
    const choisie = opBrouillon ? F("op-marque").value : op ? op.marque : "";
    F("op-marque").innerHTML = `<option value="">Choisir…</option>` + liste.concat(op && !liste.includes(op.marque) ? [op.marque] : [])
      .map(m => `<option value="${esc(m)}"${m === choisie ? " selected" : ""}>${esc(m)}</option>`).join("");
    if (!opBrouillon) {
      F("op-titre").value = op ? op.titre : "";
      F("op-fin").value = op && op.fin ? op.fin : "";
    }
    ["op-marque", "op-titre", "op-fin", "op-enregistrer"].forEach(id => { F(id).disabled = !peutNoter() || (modeDonnees === "base" && !operationLue); });
    F("op-arreter").hidden = !op || !peutNoter();
    // « 16 oct. » finit déjà par un point : pas de second point derrière.
    const phrase = s => s.replace(/\.?$/, ".");
    F("op-etat").textContent = active
      ? phrase(`En cours : ${active.titre || active.marque}${active.fin ? `, jusqu'au ${dateCourte(active.fin)}` : ""}`) + ` Les tenues mettent ${active.marque} en avant.`
      : op && operationEnCours(op) ? `En pause : plus aucune pièce ${op.marque} à porter dans la garde-robe.`
      : op ? phrase(`${op.titre ? "« " + op.titre + " »" : "La mise en avant de " + op.marque} est terminée${op.fin ? ` depuis le ${dateCourte(op.fin)}` : ""}`) : "Aucune marque mise en avant.";
    rendreBandeau();
  }
  function rendreBandeau() {
    const active = operationActive(), bandeau = F("operation-bandeau");
    bandeau.hidden = !active;
    bandeau.textContent = active ? `${active.titre ? active.titre + " : les" : "Les"} tenues mettent ${active.marque} en avant.` : "";
  }
  // Un point de plus par pièce de la marque mise en avant, pondéré par sa place dans la tenue.
  function bonusOperation(date) {
    const op = operationActive(date);
    return op ? a => (a && a.marque === op.marque ? 1 : 0) : () => 0;
  }

  // Carte à partager : la tenue dessinée en 1080 × 1350, prête pour une story ou un message.
  let carte = null;                    // { url, blob, nom }
  function chargerImage(src) {
    return new Promise(ok => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => ok(null);
      img.src = src;
    });
  }
  function couvrir(g, img, x, y, w, h) {
    const r = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const sw = w / r, sh = h / r;
    g.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
  }
  function arrondi(g, x, y, w, h, r) {
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
  }
  // Sans photos (fichier local, ou photos protégées) : une silhouette de la couleur de la pièce.
  function silhouetteCanvas(g, a, x, y, w, h) {
    const motif = a.teinte === "motif";
    const hex = !motif && /^#[0-9a-f]{6}$/i.test(T[a.teinte].hex) ? T[a.teinte].hex : "#9aa0a8";
    const s = Math.min(w * 0.8 / 100, h * 0.8 / 110);
    g.save();
    g.translate(x + (w - 100 * s) / 2, y + (h - 110 * s) / 2);
    g.scale(s, s);
    const p = new Path2D(SILHOUETTES[role(a)] || SILHOUETTES.haut);
    g.fillStyle = hex; g.fill(p);
    g.lineWidth = 1.2; g.strokeStyle = "#7d8492"; g.stroke(p);
    g.restore();
  }
  async function dessinerCarte(t, sansPhotos) {
    const W = 1080, H = 1350, M = 64, GAP = 24;
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const g = cv.getContext("2d");
    const css = getComputedStyle(document.documentElement);
    const police = (v, repli) => css.getPropertyValue(v).trim() || repli;
    const fDisplay = police("--f-display", "system-ui, sans-serif"), fBody = police("--f-body", "system-ui, sans-serif"), fMono = police("--f-mono", "monospace");
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const couper = (s, max) => {
      if (g.measureText(s).width <= max) return s;
      while (s.length > 1 && g.measureText(s + "…").width > max) s = s.slice(0, -1);
      return s + "…";
    };
    g.fillStyle = "#f3f1ec"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#5b6170"; g.font = `600 26px ${fMono}`;
    g.fillText("TENUE DU JOUR · 100 % BLUE BOX", M, M + 26);
    g.fillStyle = "#14161c"; g.font = `800 60px ${fDisplay}`;
    g.fillText(couper(majuscule(dateLongue(AUJ_DATE)), W - 2 * M), M, M + 104);
    // Les pièces, de haut en bas : une rangée jusqu'à trois, deux rangées au-delà.
    const pieces = piecesTenue(t);
    const n = pieces.length, cols = n <= 3 ? n : n === 4 ? 2 : 3, rangs = Math.ceil(n / cols);
    const haut0 = M + 150, bas0 = H - M - 110, LABEL = 84;
    let w = (W - 2 * M - (cols - 1) * GAP) / cols;
    const h = Math.min(w * 1.25, (bas0 - haut0 - rangs * LABEL - (rangs - 1) * GAP) / rangs);
    // Hauteur limitée : la case se rétrécit pour garder les photos en 4:5 (cols et bas visibles).
    if (h < w * 1.25) w = h / 1.25;
    const images = sansPhotos ? [] : await Promise.all(pieces.map(p => chargerImage(p.a.image)));
    pieces.forEach((p, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      const dansRang = Math.min(cols, n - r * cols);
      const decale = (W - 2 * M - (dansRang * w + (dansRang - 1) * GAP)) / 2;
      const x = M + decale + c * (w + GAP), y = haut0 + r * (h + LABEL + GAP);
      g.save();
      arrondi(g, x, y, w, h, 18);
      g.fillStyle = "#ffffff"; g.fill(); g.clip();
      if (images[i]) couvrir(g, images[i], x, y, w, h);
      else silhouetteCanvas(g, p.a, x, y, w, h);
      g.restore();
      g.fillStyle = "#5b6170"; g.font = `600 22px ${fMono}`;
      g.fillText(couper(p.a.marque.toUpperCase(), w), x, y + h + 34);
      g.fillStyle = "#14161c"; g.font = `600 28px ${fBody}`;
      g.fillText(couper(majuscule(court(p.a)), w), x, y + h + 70);
    });
    const niv = NIVEAUX[noterTenue(t).niveau];
    const op = operationActive();
    g.fillStyle = "#14161c"; g.font = `700 30px ${fBody}`;
    g.fillText(`${niv.sym} ${niv.nom}`, M, H - M - 40);
    if (op) {
      g.fillStyle = "#5b6170"; g.font = `600 24px ${fMono}`;
      g.fillText(couper((op.titre || "Opération " + op.marque).toUpperCase(), W - 2 * M), M, H - M);
    }
    return new Promise((ok, ko) => {
      try { cv.toBlob(b => (b ? ok(b) : ko({ code: "export" })), "image/jpeg", 0.9); }
      catch (e) { ko({ code: e && e.name === "SecurityError" ? "protegee" : "export" }); }
    });
  }
  let jetonCarte = 0, carteEnCours = null;
  async function creerCarte() {
    const r = tenueAffichee();
    if (!r) return;
    const jeton = ++jetonCarte;
    carteEnCours = cleTenue(r.t);
    F("carte-zone").hidden = false;
    F("carte-aide").textContent = "Préparation de la carte…";
    F("carte-enregistrer").hidden = true;
    try {
      // Dans le fichier local, les photos ne peuvent pas être recopiées : silhouettes d'emblée.
      let blob;
      try { blob = await dessinerCarte(r.t, location.protocol === "file:"); }
      catch (e) { if (e && e.code === "protegee") blob = await dessinerCarte(r.t, true); else throw e; }
      // La tenue a changé pendant le dessin : cette carte ne correspond plus à rien.
      if (jeton !== jetonCarte) return;
      carteEnCours = null;
      if (carte) URL.revokeObjectURL(carte.url);
      carte = { blob, url: URL.createObjectURL(blob), nom: `tenue-${AUJ_DATE}.jpg`, cle: cleTenue(r.t) };
      F("carte-img").src = carte.url;
      F("carte-img").hidden = false;
      F("carte-enregistrer").hidden = !downloads;
      F("carte-aide").textContent = downloads ? "" : "Appuie longuement sur l'image (ou clic droit) pour l'enregistrer.";
      (downloads ? F("carte-enregistrer") : F("carte-fermer")).focus({ preventScroll: true });
      montrer(F("carte-zone"), { block: "nearest" });
    } catch (_) {
      if (jeton !== jetonCarte) return;
      carteEnCours = null;
      F("carte-img").hidden = true;
      F("carte-aide").textContent = "La carte n'a pas pu être dessinée. Réessaie, ou fais une capture d'écran de la tenue.";
    }
  }
  function fermerCarte() {
    jetonCarte++;
    carteEnCours = null;
    F("carte-zone").hidden = true;
    F("carte-img").removeAttribute("src");
    if (carte) URL.revokeObjectURL(carte.url);
    carte = null;
  }
  const MESSAGES_TELECHARGEMENT = {
    declined: "",
    rate_limited: "Une demande d'enregistrement est déjà ouverte.",
    too_large: "Le fichier est trop lourd pour être enregistré ici.",
    extension_not_enabled: "Ce format de fichier n'est pas disponible ici.",
    rejected_extension: "Ce format de fichier n'est pas disponible ici.",
    bad_request: "L'enregistrement n'a pas abouti.",
    transform_error: "L'enregistrement n'a pas abouti.",
  };
  async function enregistrerFichier(nom, data, zone) {
    if (!downloads) return;
    try {
      await downloads.save({ filename: nom, data });
      if (zone) zone.textContent = "Enregistré.";
    } catch (e) {
      const code = e && e.code;
      if (!possede(MESSAGES_TELECHARGEMENT, code)) {
        // unavailable, not_granted, capability_* et tout code inconnu : plus d'enregistrement dans cette vue.
        downloads = null;
        F("carte-enregistrer").hidden = true;
        if (!F("carte-zone").hidden) F("carte-aide").textContent = "Appuie longuement sur l'image (ou clic droit) pour l'enregistrer.";
        if (zone && zone !== F("carte-aide")) zone.textContent = "L'enregistrement n'est pas disponible ici.";
        planifierRendu();
        return;
      }
      if (zone) zone.textContent = MESSAGES_TELECHARGEMENT[code];
    }
  }

  // Lookbook : les photos de toi en tenue, rangées par date, liées au journal du jour.
  let lookConfirme = null, lookEnvoi = false;
  function rendreLookbook() {
    const ok = peutEcrire && peutNoter();
    F("form-look").hidden = !ok;
    F("look-indispo").textContent = ok ? "" : modeDonnees === "local"
      ? "Les photos en tenue fonctionnent dans la page publiée sur Claude, où elles sont stockées."
      : modeDonnees === "lecture" ? "" : "Chargement…";
    if (ok && !F("look-date").value) F("look-date").value = AUJ_DATE;
    F("look-envoyer").disabled = lookEnvoi;
    F("look-envoyer").textContent = lookEnvoi ? "Envoi…" : "Ajouter la photo";
    const looks = Object.entries(donnees.lookbook).sort((x, y) => y[1].date.localeCompare(x[1].date) || y[1].ajouteLe.localeCompare(x[1].ajouteLe));
    F("compte-lookbook").textContent = looks.length ? pluriel(looks.length, "photo") : "";
    F("lookbook").innerHTML = looks.length ? looks.map(([id, l]) => {
      const e = donnees.journal[l.date];
      const vignettes = e && valide(e.tenue) ? piecesTenue(e.tenue).map(p => `<img src="${esc(p.a.image)}" alt="" width="28" height="35" loading="lazy">`).join("") : "";
      const actions = !ok ? "" : lookConfirme === id
        ? `<span class="ligne-actions"><button class="btn petit danger plein" type="button" id="look-oui-${esc(id)}" data-action="look-supprimer" data-id="${esc(id)}">Supprimer</button><button class="btn petit" type="button" id="look-non-${esc(id)}" data-action="look-garder" data-id="${esc(id)}">Garder</button></span>`
        : `<button class="lien-action" type="button" id="look-retirer-${esc(id)}" data-action="look-retirer" data-id="${esc(id)}">Retirer</button>`;
      return `<li>
        <img class="look-photo" src="/_blob/${esc(l.image)}" alt="${esc(l.legende || "Tenue du " + dateLongue(l.date))}" width="540" height="675" loading="lazy">
        <div class="look-corps">
          <span class="eyebrow">${esc(majuscule(dateLongue(l.date)))}</span>
          ${l.legende ? `<span>${esc(l.legende)}</span>` : ""}
          ${vignettes ? `<span class="vignettes look-tenue" title="Tenue notée ce jour-là">${vignettes}</span>` : ""}
          ${actions}
        </div>
      </li>`;
    }).join("") : `<li class="vide">${ok ? "Ajoute une photo de toi en tenue : elle se range ici avec la tenue notée ce jour-là." : "Aucune photo pour l'instant."}</li>`;
  }
  // La photo est réduite à 1350 px de haut au plus avant l'envoi.
  function reduirePhoto(fichier) {
    return new Promise((ok, ko) => {
      const url = URL.createObjectURL(fichier);
      const img = new Image();
      img.onload = () => {
        const r = Math.min(1, 1350 / Math.max(img.naturalWidth, img.naturalHeight));
        const cv = document.createElement("canvas");
        cv.width = Math.round(img.naturalWidth * r); cv.height = Math.round(img.naturalHeight * r);
        const g = cv.getContext("2d");
        g.fillStyle = "#ffffff"; g.fillRect(0, 0, cv.width, cv.height); // un PNG détouré ne vire pas au noir
        g.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob(b => (b ? ok(b) : ko({ code: "export" })), "image/jpeg", 0.85);
      };
      img.onerror = () => { URL.revokeObjectURL(url); ko({ code: "lecture" }); };
      img.src = url;
    });
  }
  async function ajouterLook(e) {
    e.preventDefault();
    if (lookEnvoi || !peutEcrire || !peutNoter()) return;
    const fichier = F("look-photo").files && F("look-photo").files[0];
    const date = F("look-date").value;
    const msg = !fichier ? "Choisis une photo."
      : !DATE_RE.test(date) || date > AUJ_DATE ? "Choisis une date passée ou aujourd'hui." : "";
    F("look-erreur").textContent = msg;
    if (msg) return;
    lookEnvoi = true;
    rendreLookbook();
    let imageId = null, id = null, valeur = null;
    const reussi = () => {
      F("form-look").reset();
      F("look-date").value = AUJ_DATE;
      toast("Photo ajoutée à tes photos en tenue.");
    };
    try {
      const blob = await reduirePhoto(fichier);
      imageId = (await appel(() => assets.upload(blob, { type: "image/jpeg" }), ["store_unavailable"])).id;
      id = idNouveau();
      valeur = { image: imageId, date, legende: F("look-legende").value.trim().slice(0, 140), ajouteLe: new Date().toISOString() };
      await enregistrer("lookbook", id, valeur);
      reussi();
    } catch (err) {
      // Une écriture peut aboutir même si sa réponse se perd : on relit avant d'effacer la photo.
      let ecrit = false;
      if (imageId && id && db) {
        const lu = await db.doc("lookbook/" + id).get().catch(() => null);
        if (lu && lu.exists && lu.data().image === imageId) ecrit = true;
        else if (lu) supprimerPhoto(imageId, true);
        // Sans réponse, la photo reste : mieux vaut une image en trop qu'une entrée sans image.
      } else if (imageId) supprimerPhoto(imageId, true);
      if (ecrit) { appliquerLocal("lookbook", id, valeur); reussi(); }
      else {
        F("look-erreur").textContent = messageLook(err);
        if (err && CODES_DROITS.includes(err.code)) passerEnLecture();
      }
    } finally {
      lookEnvoi = false;
      rendre(rendreLookbook);
    }
  }
  function messageLook(err) {
    const code = err && err.code;
    if (code === "lecture") return "Cette photo n'a pas pu être lue. Essaie en JPEG ou en PNG.";
    if (code === "quota_or_state") return "Le stockage des photos est plein : retire des photos en tenue avant d'en ajouter.";
    if (CODES_DROITS.includes(code)) return "Seul le propriétaire de la page peut ajouter des photos en tenue.";
    return messageErreur(err);
  }
  async function supprimerLook(id) {
    const l = donnees.lookbook[id];
    if (!l) return;
    lookConfirme = null;
    try {
      await enregistrer("lookbook", id, null);
      if (!imageCitee(l.image, null, id)) supprimerPhoto(l.image, true);
    } catch (_) { /* le toast d'enregistrer prévient déjà */ }
    rendre(rendreLookbook);
  }

  // Statistiques tirées du journal.
  function barres(lignes) {
    if (!lignes.length) return `<p class="aide">Les pièces notées ont été supprimées depuis.</p>`;
    const max = lignes[0].n;
    return `<ol class="barres">${lignes.map(x => `<li title="${esc(x.nom)} : ${esc(x.valeur || String(x.n))}">
      <span class="barre-nom">${x.pastille || ""}${esc(x.nom)}</span>
      <span class="barre" aria-hidden="true"><i style="width:${max ? Math.max(2, x.n / max * 100).toFixed(1) : 0}%"></i></span>
      <b>${esc(x.valeur || String(x.n))}</b>
    </li>`).join("")}</ol>`;
  }
  function statistiques() {
    // Une pièce supprimée depuis ne fait pas disparaître la journée : seules ses lignes sont sautées.
    const entrees = Object.values(donnees.journal);
    const ports = new Map(), parMarque = new Map(), parTeinte = new Map(), parMois = new Map();
    for (const e of entrees) {
      parMois.set(e.date.slice(0, 7), (parMois.get(e.date.slice(0, 7)) || 0) + 1);
      for (const k of SLOTS) {
        const a = PAR_ID[e.tenue[k]];
        if (!a) continue;
        ports.set(a.id, (ports.get(a.id) || 0) + 1);
        parMarque.set(a.marque, (parMarque.get(a.marque) || 0) + 1);
      }
      const h = PAR_ID[e.tenue.haut];
      if (h) parTeinte.set(h.teinte, (parTeinte.get(h.teinte) || 0) + 1);
    }
    return { entrees, ports, parMarque, parTeinte, parMois };
  }
  function rendreStats() {
    const s = memoiser("stats", versionJournal + "|" + cleGarderobe(), statistiques);
    F("export-journal").hidden = !downloads || !s.entrees.length;
    if (!s.entrees.length) {
      F("stats").innerHTML = `<p class="vide">Note tes tenues avec « Je l'ai portée » : tes chiffres apparaissent ici dès le premier jour.</p>`;
      return;
    }
    const portables = ARTICLES.filter(a => role(a) !== "aucun");
    const portees = portables.filter(a => s.ports.has(a.id)).length;
    const mois = AUJ_DATE.slice(0, 7);
    const top = [...s.ports.entries()].map(([id, n]) => ({ a: PAR_ID[id], n })).sort((x, y) => y.n - x.n).slice(0, 5);
    const totalPorts = [...s.parMarque.values()].reduce((x, y) => x + y, 0);
    const marquesL = [...s.parMarque.entries()].sort((x, y) => y[1] - x[1])
      .map(([nom, n]) => ({ nom, n, valeur: Math.round(n / totalPorts * 100) + " %" }));
    const teintes = [...s.parTeinte.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6)
      .map(([t, n]) => ({ nom: T[t].nom, n, pastille: `<i class="pastille" style="background:${esc(T[t].hex)}"></i>` }));
    // Les six derniers mois, même vides.
    const moisL = [];
    const d = new Date(midi(AUJ_DATE)); d.setDate(1);
    for (let i = 0; i < 6; i++) {
      const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      moisL.unshift({ cle, nom: d.toLocaleDateString("fr-FR", { month: "short" }), n: s.parMois.get(cle) || 0 });
      d.setMonth(d.getMonth() - 1);
    }
    const maxMois = Math.max(1, ...moisL.map(x => x.n));
    F("stats").innerHTML = `
      <div class="chiffres">
        <p><b>${s.entrees.length}</b><span>${s.entrees.length > 1 ? "jours notés" : "jour noté"}</span></p>
        <p><b>${s.parMois.get(mois) || 0}</b><span>ce mois-ci</span></p>
        <p><b>${portees}/${portables.length}</b><span>pièces déjà portées</span></p>
        <p><b>${Object.keys(donnees.favoris).length}</b><span>${Object.keys(donnees.favoris).length > 1 ? "tenues favorites" : "tenue favorite"}</span></p>
      </div>
      <div class="stats-grille">
        <div><h4>Les plus portées</h4>${barres(top.map(x => ({ nom: `${x.a.marque} ${role(x.a) === "bas" ? court(x.a) : court(x.a).toLowerCase()}`, n: x.n, valeur: x.n + " fois" })))}</div>
        <div><h4>Par marque</h4>${barres(marquesL)}</div>
        <div><h4>Couleurs des hauts</h4>${barres(teintes)}</div>
        <div><h4>Jours notés par mois</h4>
          <ol class="colonnes">${moisL.map(x => `<li title="${esc(x.nom)} : ${pluriel(x.n, "jour")}"><b>${x.n}</b><span class="colonne" aria-hidden="true"><i style="height:${(x.n / maxMois * 100).toFixed(1)}%"></i></span><span>${esc(x.nom)}</span></li>`).join("")}</ol>
        </div>
      </div>`;
  }
  // Le journal en tableur (séparateur « ; » et BOM pour que les accents s'ouvrent bien).
  function journalCsv() {
    // Une valeur qui commence par = + - @ serait lue comme une formule par le tableur.
    const champ = v => { let s = String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
    const tete = ["Date", "Météo", "Bas", "Haut", "Sous-couche", "Par-dessus", "Chaussures", "Accessoire"];
    const nom = id => (!id ? "" : PAR_ID[id] ? nomComplet(PAR_ID[id]) : "(pièce supprimée)");
    const lignes = Object.values(donnees.journal).sort((x, y) => x.date.localeCompare(y.date))
      .map(e => [e.date, e.meteo ? METEOS[e.meteo].nom : "", ...["bas", "haut", "dessous", "dessus", "pieds", "accessoire"].map(k => nom(e.tenue[k]))]);
    return "﻿" + [tete].concat(lignes).map(l => l.map(champ).join(";")).join("\r\n") + "\r\n";
  }
  function rendreVitrine() {
    rendreOperation();
    rendreLookbook();
    rendreStats();
  }

  function rendre(...parties) {
    const focus = document.activeElement && document.activeElement.id;
    parties.forEach(f => f());
    if (focus) {
      const el = F(focus);
      if (el && el !== document.activeElement) el.focus({ preventScroll: true });
    }
  }
  const rendreTout = () => rendre(rendreTete, rendreMeteo, rendreTenue, rendreChoix, rendreFavoris, rendreSemaine, rendreJournal, rendreCatalogue, rendreAccords, rendreCompleter, rendreAcheter, rendreStyliste, rendreVitrine);

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
      const m = vide();
      snap.docs.forEach(doc => { const x = doc.exists && LECTEURS[nom](doc.id, doc.data()); if (x) m[doc.id] = x; });
      donnees[nom] = m;
      if (nom === "journal") { indexerJournal(); journalLu = true; if (suivreOperation()) return; }
      if ((nom === "pieces" || nom === "journal") && etatAjouts === "ok") reconcilier(true);
      planifierRendu();
    }, () => toast("Une partie de tes données n'a pas pu être chargée. Recharge la page.", "erreur"));
    ["journal", "pieces", "favoris", "envies", "lookbook"].forEach(collection);
    db.doc("vitrine/operation").onSnapshot(surDocument("vitrine/operation", snap => {
      donnees.operation = lireOperation(snap.exists ? snap.data() : null);
      // La tenue du jour a été composée avant de connaître l'opération : elle la suit maintenant.
      if (!(snap.metadata && snap.metadata.fromCache)) { operationLue = true; if (suivreOperation()) return; }
      planifierRendu();
    }), () => {});
    db.doc("reglages/general").onSnapshot(surDocument("reglages/general", snap => {
      donnees.reglages = lireReglages(snap.exists ? snap.data() : null);
      if (!(snap.metadata && snap.metadata.fromCache)) reglagesLus = true;
      planifierRendu();
    }), () => {});
    db.doc("gouts/accords").onSnapshot(surDocument("gouts/accords", snap => {
      donnees.gouts = lireGouts(snap.exists ? snap.data() : null);
      if (!(snap.metadata && snap.metadata.fromCache)) goutsPrets = true;
      planifierRendu();
    }), () => { goutsPrets = false; });
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
  let envieAchetee = null;     // envie à retirer une fois la pièce ajoutée

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
    if (analysePhoto) analysePhoto.abort();
    F("achat-claude-etat").textContent = "";
    rendreBoutonPhoto();
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
      rendreBoutonPhoto();
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
    envieAchetee = null;
    F("achat-date").value = AUJ_DATE;
    F("achat-date").max = AUJ_DATE;
    F("titre-ajouter").textContent = "Ajouter un achat";
    F("achat-envoyer").textContent = "Ajouter à la garde-robe";
    erreur("");
    majPastille();
  }
  function ouvrirPanneau() {
    F("ajouter").hidden = false;
    montrer(F("ajouter"), { block: "start" });
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
    const m = donnees.pieces[a.id] || {};
    F("achat-prix").value = m.prix === null || m.prix === undefined ? "" : saisie(m.prix);
    F("achat-date").value = m.achatLe || "";
    F("achat-taille").value = m.taille || "";
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
    if (!possede(T, v.teinte)) return { manque: "Choisis la couleur de référence." };
    if (v.lien && !lienSur(v.lien)) return { manque: "Le lien doit commencer par https://." };
    if (!photo && !edition) return { manque: "Ajoute une photo." };
    v.prix = lireMontant(F("achat-prix").value, 100000);
    if (v.prix === undefined) return { manque: "Le prix payé doit être un nombre, par exemple 59,90." };
    v.achatLe = DATE_RE.test(F("achat-date").value) ? F("achat-date").value : null;
    if (v.achatLe && v.achatLe > AUJ_DATE) return { manque: "La date d'achat ne peut pas être dans le futur." };
    v.taille = F("achat-taille").value.trim().slice(0, 20);
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

  // Une image encore citée par une autre pièce ou par le lookbook ne doit pas être effacée.
  function imageCitee(id, saufDocId, saufLook) {
    return ajoutes.some(a => a.imageId === id && a.docId !== saufDocId)
      || Object.entries(donnees.lookbook || {}).some(([k, l]) => l.image === id && k !== saufLook);
  }
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
    rendreBoutonPhoto();
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
    if (enEdition && nouvelleImage && !imageCitee(courant.imageId, courant.docId)) supprimerPhoto(courant.imageId);
    noterAchat(enEdition ? enEdition.id : "achat-" + ref.id, v);
    if (envieAchetee && !enEdition) enregistrer("envies", envieAchetee, null).catch(() => {});
    const nom = [v.marque, v.modele || singulier(v.categorie), v.couleur].join(" ");
    reinitialiser();
    if (enEdition) {
      F("ajouter").hidden = true;
      annonce(`Modifié : ${nom}.`, "ok");
      const fiche = F("modifier-" + enEdition.id);
      if (fiche) {
        fiche.focus({ preventScroll: true });
        montrer(fiche.closest(".fiche"), { block: "center" });
      }
    } else {
      succes(CAT[v.categorie].role === "aucun"
        ? `Ajouté : ${nom}. La pièce est dans « Mes vêtements ».`
        : `Ajouté : ${nom}. La pièce est dans « Mes vêtements » et entre dans la composition des tenues.`);
      F("achat-photo").focus({ preventScroll: true });
    }
  }

  // Prix payé, date d'achat et taille vivent avec l'état de la pièce (comme le lavage).
  function noterAchat(id, v) {
    if (!peutNoter()) return;
    const avant = donnees.pieces[id] || { lavage: false, prix: null, achatLe: null, taille: "" };
    if (avant.prix === v.prix && avant.achatLe === v.achatLe && (avant.taille || "") === v.taille) return;
    enregistrer("pieces", id, Object.assign({}, avant, { prix: v.prix, achatLe: v.achatLe, taille: v.taille })).catch(() => {});
  }
  function ouvrirAchatDepuisEnvie(id) {
    const e = donnees.envies[id];
    if (!e || !peutEcrire) return;
    reinitialiser();
    succes("");
    const modele = e.modele || (e.encolure ? ENCOLURES[e.encolure] : "");
    const valeurs = { "achat-marque": e.marque, "achat-categorie": e.categorie, "achat-modele": modele, "achat-couleur": e.couleur || T[e.teinte].nom, "achat-teinte": e.teinte, "achat-lien": e.lien };
    F("achat-titre").value = e.titre;
    CHAMPS.forEach(c => { if (valeurs[c]) { F(c).value = valeurs[c]; touches.add(c); } });
    majPastille();
    if (e.prix) F("achat-prix").value = saisie(prixRemise(e.prix));
    envieAchetee = id;
    F("titre-ajouter").textContent = "Ajouter un achat de tes envies";
    ouvrirPanneau();
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
    if (assets && !imageCitee(a.imageId, a.docId)) {
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
      else {
        // Un jour déjà porté reprend la tenue notée au journal.
        const notee = tenueDuJournal(JOURS.findIndex(x => x[0] === j));
        if (notee) etat.plan[j] = notee; else composerJour(j, null);
      }
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
    // Une pièce qu'on choisit de porter n'est plus au lavage.
    const sorties = SLOTS.map(k => t[k]).filter(id => id && auLavage(id) && PAR_ID[id]);
    let n = copieTenue(t);
    if (peutNoter()) {
      sorties.forEach(id => enregistrer("pieces", id, Object.assign({}, donnees.pieces[id], { lavage: false })).catch(() => {}));
      if (sorties.length) toast(`De retour du lavage : ${sorties.map(id => nomComplet(PAR_ID[id])).join(", ")}.`);
    } else if (sorties.length) n = reparerAutour(n, ctxVide(), pieceId) || n; // en lecture, rien ne sort du lavage
    // La tenue choisie ne change plus d'elle-même : couches absentes marquées vides, chaussures ajoutées.
    if (n.dessous === undefined && accepteDessous(PAR_ID[n.haut])) n.dessous = "";
    if (n.dessus === undefined) n.dessus = "";
    if (!n.pieds && PIEDS.some(dispo)) { const p = chaussuresPour(PAR_ID[n.bas]); if (p) n.pieds = p; }
    if (etat.jours.includes(AUJ[0])) etat.plan[AUJ[0]] = n;
    else poserIdee(n);
    etat.portee = pieceId ? { date: AUJ_DATE, id: pieceId } : null;
    etat.choisie = { date: AUJ_DATE };
    ecrire();
    rendre(rendreTenue, rendreSemaine);
    montrer(F("tenue"), { block: "start" });
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
    const paires = Object.assign(vide(), donnees.gouts);
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
      toast("Tenue retirée.");
    } else {
      enregistrer("journal", date, { date, tenue: copieTenue(t), meteo: date === AUJ_DATE ? meteoDuJour() : null }).catch(() => {});
      toast(e ? "Tenue remplacée." : "Tenue notée.");
    }
  }

  F("meteo").addEventListener("change", e => {
    const v = e.target.value;
    if (!possede(METEOS, v)) return;
    etat.meteo = { date: AUJ_DATE, valeur: v };
    changerCouches(METEOS[v].couches, true);
    // La tenue du jour s'adapte, sauf si elle est déjà notée ou choisie autour d'une pièce.
    const prevue = etat.jours.includes(AUJ[0]) && valide(etat.plan[AUJ[0]]) ? etat.plan[AUJ[0]] : ideeDuJour();
    if (valide(prevue) && !noteeAujourdhui(prevue) && !porteeId() && !choisieAujourdhui()) {
      if (etat.jours.includes(AUJ[0]) && valide(etat.plan[AUJ[0]])) composerJour(AUJ[0], null);
      else poserIdee(composerAvecRepli(ctxVide()));
    } else if (v === "pluie" && valide(prevue) && !noteeAujourdhui(prevue) && T[PAR_ID[prevue.bas].teinte].clarte === "clair" && prevue.bas !== porteeId()) {
      // Tenue choisie à la main : on garde le choix, seul le bas clair laisse la place à un bas foncé.
      const ctx = etat.jours.includes(AUJ[0]) && valide(etat.plan[AUJ[0]]) ? contexteJour(AUJ[0], null) : ctxVide();
      const n = remplacerPiece(prevue, "bas", ctx, porteeId());
      if (n && T[PAR_ID[n.bas].teinte].clarte !== "clair") { remplacerTenueDuJour(n); toast("Pluie : bas clair remplacé par un bas foncé."); }
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
      montrer(F("choix-resultat"), { block: "start" });
      const b = F("piece-" + id);
      if (b) b.focus({ preventScroll: true });
    } else if (F("choix-resultat").getBoundingClientRect().top > window.innerHeight * 0.7) {
      // Sur téléphone, la tenue s'affiche sous la grille : on l'amène à l'écran.
      montrer(F("choix-resultat"), { block: "start" });
    }
  }

  // Acheter malin
  F("form-simul").addEventListener("input", e => {
    const id = e.target.id;
    if (id === "simul-titre") simulDepuisTitre();
    else if (e.target.tagName === "SELECT") simulTouches.add(id);
    F("simul-erreur").textContent = "";
    rendre(rendreSimulateur);
  });
  F("form-simul").addEventListener("submit", e => {
    e.preventDefault();
    if (!peutNoter()) return;
    const p = pieceDuSimulateur();
    const prix = lireMontant(F("simul-prix").value, 100000);
    const lien = F("simul-lien").value.trim();
    const erreurSimul = !p ? "Choisis au moins la catégorie et la couleur."
      : prix === undefined ? "Le prix doit être un nombre, par exemple 59,90."
      : lien && !lienSur(lien) ? "Le lien doit commencer par https://." : "";
    F("simul-erreur").textContent = erreurSimul;
    if (erreurSimul) return;
    const r = simulAnalyse || {};
    enregistrer("envies", idNouveau(), {
      titre: F("simul-titre").value.trim().slice(0, 200), categorie: p.categorie, teinte: p.teinte, encolure: p.encolure || "",
      marque: (r.marque || "").slice(0, 60), modele: (r.modele || (p.encolure ? ENCOLURES[p.encolure] : "")).slice(0, 80), couleur: (r.couleur || "").slice(0, 40),
      prix, lien: lien ? lienSur(lien) : "", ajouteLe: new Date().toISOString(),
    }).catch(() => {});
    viderSimulateur();
    toast("Ajoutée à tes envies.");
    rendre(rendreAcheter);
  });
  ["reglage-remise", "reglage-budget"].forEach(id => F(id).addEventListener("change", () => {
    if (!peutNoter()) return;
    // Seul le champ touché change : l'autre vient des données, pas de l'écran.
    const remiseChamp = id === "reglage-remise";
    const v = lireMontant(F(id).value, remiseChamp ? 90 : 100000);
    if (v === undefined) {
      toast(remiseChamp ? "La remise va de 0 à 90 %." : "Le budget doit être un nombre positif.", "erreur");
      rendre(rendreBudget);
      return;
    }
    const r = Object.assign({}, donnees.reglages, remiseChamp ? { remise: Math.round(v || 0) } : { budget: v || 0 });
    if (r.remise === donnees.reglages.remise && r.budget === donnees.reglages.budget) return;
    enregistrer("reglages", "general", r).catch(() => {});
    rendre(rendreAcheter);
  }));
  F("onglet-shopping").addEventListener("submit", e => {
    if (e.target.id !== "cout-form") return;
    e.preventDefault();
    const id = e.target.dataset.id;
    if (!PAR_ID[id] || !peutNoter()) return;
    const prix = lireMontant(F("cout-prix").value, 100000);
    const date = F("cout-date").value;
    erreurCout = prix === undefined ? "Le prix doit être un nombre, par exemple 59,90."
      : date && (!DATE_RE.test(date) || date > AUJ_DATE) ? "La date d'achat ne peut pas être dans le futur." : "";
    if (erreurCout) { rendreErreurCout(); return; }
    noterAchat(id, { prix, achatLe: date || null, taille: F("cout-taille").value.trim().slice(0, 20) });
    editionCout = null;
    rendre(rendreAcheter, rendreCatalogue);
    const b = F("cout-modifier-" + id); if (b) b.focus({ preventScroll: true });
  });
  function rendreErreurCout() {
    const p = F("cout-form") && F("cout-form").querySelector(".form-erreur");
    if (p) p.textContent = erreurCout;
  }

  // Mettre en avant
  F("form-operation").addEventListener("submit", e => {
    e.preventDefault();
    if (!peutNoter()) return;
    const marque = F("op-marque").value, fin = F("op-fin").value;
    const msg = !marque ? "Choisis la marque à mettre en avant."
      : fin && (!DATE_RE.test(fin) || fin < AUJ_DATE) ? "La date de fin doit être aujourd'hui ou plus tard." : "";
    F("op-erreur").textContent = msg;
    if (msg) return;
    opBrouillon = false;
    const avant = (operationActive() || {}).marque, ancienne = donnees.operation;
    enregistrer("vitrine", "operation", { marque, titre: F("op-titre").value.trim().slice(0, 80), fin: fin || null }).catch(() => {});
    recomposerJoursSuivants(ancienne);
    // Un simple changement de nom ne change rien aux tenues : on ne recompose pas.
    if ((operationActive() || {}).marque !== avant) recomposerAujourdhui(); else rendre(rendreTenue, rendreVitrine, rendreSemaine);
    toast(`C'est fait : les tenues mettent ${marque} en avant.`);
  });
  ["input", "change"].forEach(type => F("form-operation").addEventListener(type, () => { opBrouillon = true; }));
  F("op-marque").addEventListener("change", () => {
    if (!F("op-titre").value.trim() && F("op-marque").value) F("op-titre").placeholder = "Semaine " + F("op-marque").value;
  });
  // Les jours suivants de la semaine dont la marque mise en avant change (lancement, autre marque,
  // nouvelle date de fin, arrêt) sont recomposés ; les autres gardent leur tenue.
  function recomposerJoursSuivants(ancienne) {
    const marqueLe = (op, d) => (op && operationEnCours(op, d) && marquePortable(op.marque) ? op.marque : null);
    let change = false;
    JOURS.forEach(([j], i) => {
      const d = dateSemaine(i);
      if (i <= INDEX_AUJ || !etat.jours.includes(j) || marqueLe(ancienne, d) === marqueLe(donnees.operation, d)) return;
      composerJour(j, null);
      change = true;
    });
    if (change) ecrire();
  }
  // La tenue du jour suit l'opération, sauf si elle est déjà notée ou choisie autour d'une pièce.
  function recomposerAujourdhui() {
    const prevue = etat.jours.includes(AUJ[0]) && valide(etat.plan[AUJ[0]]) ? etat.plan[AUJ[0]] : ideeDuJour();
    if (valide(prevue) && journalPret() && !noteeAujourdhui(prevue) && !porteeId() && !choisieAujourdhui()) {
      if (etat.jours.includes(AUJ[0]) && valide(etat.plan[AUJ[0]])) composerJour(AUJ[0], null);
      else poserIdee(composerAvecRepli(ctxVide()));
      ecrire();
    }
    rendre(rendreTenue, rendreSemaine, rendreVitrine);
  }
  F("form-look").addEventListener("submit", ajouterLook);

  // Styliste
  F("form-styliste").addEventListener("submit", e => {
    e.preventDefault();
    const q = F("styliste-question").value;
    if (!q.trim() || ctlStyliste) return;
    F("styliste-question").value = "";
    demanderStyliste(q);
    const li = F("conversation").lastElementChild;
    if (li) montrer(li, { block: "nearest" });
  });
  F("styliste-question").addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); F("form-styliste").requestSubmit(); }
  });

  document.addEventListener("click", e => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const action = el.dataset.action;
    // Pendant un envoi, le formulaire ne se ferme pas et ne change pas de pièce.
    if (envoiEnCours && ["ouvrir-ajout", "fermer-ajout", "annuler-ajout", "modifier", "envie-achetee"].includes(action)) return;
    if (action === "recomposer") { composerSemaine(); rendre(rendreSemaine, rendreTenue); }
    else if (action === "changer") {
      const j = el.dataset.jour;
      if (j === AUJ[0]) etat.choisie = null;
      if (valide(etat.plan[j])) composerJour(j, etat.plan[j]);
      else if (etatAjouts !== "chargement") { delete etat.plan[j]; composerJour(j, null); }
      else return;
      ecrire();
      rendre(rendreSemaine, rendreTenue);
    }
    else if (action === "autre") {
      etat.portee = null;
      etat.choisie = null;
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
      caseApercu = `[data-action="${action}"]` + Object.keys(contraintes).map(k => `[data-${k}="${CSS.escape(contraintes[k])}"]`).join("");
      rendre(rendreTenue);
      montrer(F("tenue"), { block: "start" });
    }
    else if (action === "revoir-accords") {
      const c = caseApercu && document.querySelector(caseApercu);
      montrer(c || F("accords"), { block: "center" });
      if (c) c.focus({ preventScroll: true });
    }
    else if (action === "choisir") choisirPiece(el.dataset.id, el.dataset.depuis === "catalogue");
    else if (action === "choix-filtre") { choix.filtre = el.dataset.filtre; rendre(rendreChoix); }
    else if (action === "choix-autre") { choix.rang++; rendre(rendreChoix); }
    else if (action === "choix-voir") {
      choix.rang = Number(el.dataset.rang) || 0;
      rendre(rendreChoix);
      montrer(F("choix-resultat"), { block: "start" });
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
      const existant = favoriDe(t), id = existant || idTenue(t);
      if (existant) { enregistrer("favoris", id, null).catch(() => {}); toast("Retirée des favoris."); }
      else { enregistrer("favoris", id, { tenue: copieTenue(t), ajouteLe: new Date().toISOString() }).catch(() => {}); toast("Ajoutée aux favoris."); }
      rendre(rendreTenue, rendreChoix, rendreFavoris, rendreJournal);
    }
    else if ((action === "aime" || action === "aime-pas") && !goutsDisponibles()) toast("Tes goûts sont encore en chargement : réessaie dans un instant.", "erreur");
    else if (action === "aime") {
      const t = tenueDe(el.dataset.cible);
      if (t && valide(t)) { noterGouts(t, 1).catch(() => {}); toast("Noté : ces associations reviendront plus souvent."); rendre(rendreTenue); }
    }
    else if (action === "aime-pas") {
      const r = tenueAffichee();
      if (!r) return;
      noterGouts(r.t, -1).catch(() => {});
      etat.portee = null;
      etat.choisie = null;
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
        if (noteeAujourdhui(t)) {
          // Déjà portée aujourd'hui : la tenue notée reste telle quelle, la pièce sort des prochaines.
          reconcilier();
          toast(`Au lavage : ${nomComplet(PAR_ID[id])}. Ta tenue d'aujourd'hui reste notée.`);
          rendreTout();
          const b = F(`slot-changer-${k}`);
          if (b) b.focus({ preventScroll: true });
          return;
        }
      }
      const n = remplacerPiece(t, k, ctx, porteeId());
      if (n) {
        if (etat.portee && etat.portee.id === id) etat.portee = null;
        remplacerTenueDuJour(n);
        if (action === "slot-lavage") reconcilier();
        ecrire();
        toast(action === "slot-lavage" ? `Au lavage : ${nomComplet(PAR_ID[id])}. La tenue a été ajustée.` : "Pièce changée.");
      } else {
        if (action === "slot-lavage") { reconcilier(); ecrire(); }
        toast(action === "slot-lavage" ? `Au lavage : ${nomComplet(PAR_ID[id])}. Aucune pièce disponible pour la remplacer.` : "Aucune autre pièce ne va à cette place.");
      }
      rendreTout();
      const b = F(`slot-changer-${k}`) || F("autre-tenue") || F("porte");
      if (b) b.focus({ preventScroll: true });
    }
    else if (action === "lavage") {
      const id = el.dataset.id;
      if (!PAR_ID[id]) return;
      const lavage = !auLavage(id);
      const meta = Object.assign({ lavage: false, prix: null, achatLe: null, taille: "" }, donnees.pieces[id], { lavage });
      enregistrer("pieces", id, meta).catch(() => {});
      reconcilier();
      toast(lavage ? `Au lavage : ${nomComplet(PAR_ID[id])}. Hors des tenues jusqu'à son retour.` : `De retour du lavage : ${nomComplet(PAR_ID[id])}.`);
      rendreTout();
    }
    else if (action === "journal-prec" || action === "journal-suiv") {
      const [an, mois] = moisJournal.split("-").map(Number);
      const d = new Date(an, mois - 1 + (action === "journal-prec" ? -1 : 1), 1, 12);
      moisJournal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      rendre(rendreJournal);
      if (F(action).disabled) F(action === "journal-suiv" ? "journal-prec" : "journal-suiv").focus({ preventScroll: true });
    }
    else if (action === "journal-jour") { jourJournal = el.dataset.date; rendre(rendreJournal); }
    else if (action === "journal-retirer") {
      if (!donnees.journal[jourJournal]) return;
      enregistrer("journal", jourJournal, null).catch(() => {});
      toast("Tenue retirée.");
      rendre(rendreTenue, rendreSemaine, rendreJournal, rendreCatalogue);
      const b = F("journal-" + jourJournal); if (b) b.focus({ preventScroll: true });
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
      const suivant = el.closest("li") && (el.closest("li").nextElementSibling || el.closest("li").previousElementSibling);
      const cible = suivant && suivant.querySelector("[data-action=fav-retirer]") ? suivant.querySelector("[data-action=fav-retirer]").id : null;
      enregistrer("favoris", el.dataset.id, null).catch(() => {});
      toast("Retirée des favoris.");
      rendre(rendreTenue, rendreChoix, rendreFavoris, rendreJournal);
      const b = (cible && F(cible)) || F("titre-favoris");
      if (b) { if (!b.matches("button")) b.tabIndex = -1; b.focus({ preventScroll: true }); }
    }
    else if (action === "filtre") { filtre = el.dataset.filtre; rendre(rendreCatalogue); }
    else if (action === "styliste-idee") {
      const q = IDEES[Number(el.dataset.i)];
      if (q && !ctlStyliste) { demanderStyliste(q); F("styliste-stop").focus({ preventScroll: true }); }
    }
    else if (action === "styliste-stop") { if (ctlStyliste) ctlStyliste.abort(); F("styliste-question").focus(); }
    else if (action === "styliste-nouveau") {
      if (ctlStyliste) ctlStyliste.abort();
      ctlStyliste = null;
      conversation = [];
      rendre(rendreStyliste);
      F("styliste-question").focus();
    }
    else if (action === "styliste-porter") {
      const source = el.dataset.source || "";
      const liste = source === "avis" ? (avis ? avis.tenues : [])
        : /^conv-\d+$/.test(source) && conversation[Number(source.slice(5))] ? conversation[Number(source.slice(5))].tenues || [] : [];
      const t = liste[Number(el.dataset.i)];
      if (t && tenueCoherente(t)) porterAujourdhui(t, null);
      else if (t) { toast("Cette tenue n'est plus possible (une pièce est au lavage ou a changé)."); rendre(rendreStyliste, rendreTenue); }
    }
    else if (action === "avis-tenue") demanderAvis();
    else if (action === "avis-stop") { if (avis && avis.enCours) avis.ctl.abort(); }
    else if (action === "achat-claude") analyserPhoto();
    else if (action === "op-arreter") {
      opBrouillon = false;
      const avant = (operationActive() || {}).marque, ancienne = donnees.operation;
      enregistrer("vitrine", "operation", null).catch(() => {});
      F("op-erreur").textContent = "";
      recomposerJoursSuivants(ancienne);
      if (avant) recomposerAujourdhui(); else rendre(rendreTenue, rendreVitrine, rendreSemaine);
      toast("Plus aucune marque mise en avant.");
      F("op-marque").focus();
    }
    else if (action === "carte") creerCarte();
    else if (action === "carte-fermer") { fermerCarte(); const b = F("carte-tenue"); if (b) b.focus({ preventScroll: true }); }
    else if (action === "carte-enregistrer") { if (carte) enregistrerFichier(carte.nom, carte.blob, F("carte-aide")); }
    else if (action === "look-retirer") { lookConfirme = el.dataset.id; rendre(rendreLookbook); const b = F("look-non-" + lookConfirme); if (b) b.focus(); }
    else if (action === "look-garder") { const id = lookConfirme; lookConfirme = null; rendre(rendreLookbook); const b = F("look-retirer-" + id); if (b) b.focus(); }
    else if (action === "look-supprimer") { supprimerLook(el.dataset.id); F("look-photo").focus({ preventScroll: true }); }
    else if (action === "export-journal") enregistrerFichier(`journal-tenues-${AUJ_DATE}.csv`, journalCsv(), F("export-etat"));
    else if (action === "simul-effacer") { viderSimulateur(); rendre(rendreSimulateur); F("simul-titre").focus(); }
    else if (action === "simuler" || action === "envie-simuler") {
      const e2 = action === "envie-simuler" ? donnees.envies[el.dataset.id] : null;
      if (action === "envie-simuler" && !e2) return;
      viderSimulateur();
      const v = e2 || { titre: "", categorie: el.dataset.categorie, teinte: el.dataset.teinte, encolure: el.dataset.col, prix: null, lien: "" };
      F("simul-titre").value = v.titre;
      if (v.titre) simulDepuisTitre();
      F("simul-categorie").value = v.categorie;
      F("simul-teinte").value = v.teinte;
      F("simul-col").value = v.encolure || "";
      ["simul-categorie", "simul-teinte", "simul-col"].forEach(c => simulTouches.add(c));
      F("simul-prix").value = v.prix ? saisie(v.prix) : "";
      F("simul-lien").value = v.lien || "";
      rendre(rendreSimulateur);
      montrer(F("acheter"), { block: "start" });
      F("simul-prix").focus({ preventScroll: true });
    }
    else if (action === "envie-achetee") ouvrirAchatDepuisEnvie(el.dataset.id);
    else if (action === "envie-retirer") {
      enregistrer("envies", el.dataset.id, null).catch(() => {});
      toast("Retirée de tes envies.");
      rendre(rendreAcheter);
      const b = F("liste-envies").querySelector("button");
      (b || F("simul-titre")).focus({ preventScroll: true });
    }
    else if (action === "cout-modifier") {
      editionCout = el.dataset.id; erreurCout = "";
      rendre(rendreCoutPort);
      const c = F("cout-prix"); if (c) c.focus();
    }
    else if (action === "cout-annuler") {
      const id = editionCout; editionCout = null; erreurCout = "";
      rendre(rendreCoutPort);
      const b = F("cout-modifier-" + id); if (b) b.focus();
    }
    else if (action === "ouvrir-ajout") { if (F("ajouter").hidden || edition) reinitialiser(); succes(""); ouvrirPanneau(); }
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

  // ---------- onglets ----------
  // Cinq onglets, un seul affiché. Tout ce qui mène ailleurs (« Porter avec… », une case des accords,
  // « Je l'ai acheté », un lien) ouvre d'abord l'onglet de sa destination.
  const ONGLETS = ["aujourdhui", "semaine", "vetements", "shopping", "magasin"];
  let ongletActif = "aujourdhui";
  let parHistorique = false;     // changement venu de l'adresse (Précédent, lien direct) : rien à ajouter
  const ongletDe = el => { const p = el && el.closest && el.closest(".onglet"); return p ? p.id.slice("onglet-".length) : null; };
  const enHaut = doux => window.scrollTo({ top: 0, behavior: doux && !matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "instant" });
  // Vrai si l'onglet vient de changer.
  function afficherOnglet(nom) {
    if (!ONGLETS.includes(nom) || nom === ongletActif) return false;
    ongletActif = nom;
    ONGLETS.forEach(n => {
      const actif = n === nom, b = F("tab-" + n);
      F("onglet-" + n).hidden = !actif;
      b.setAttribute("aria-selected", String(actif));
      b.tabIndex = actif ? 0 : -1;
    });
    // L'adresse garde l'onglet : « Précédent » y revient, un rechargement aussi.
    try { if (!parHistorique) history.pushState(null, "", "#" + nom); } catch (_) { /* adresse inchangée */ }
    return true;
  }
  function montrer(el, opts) {
    if (!el) return;
    afficherOnglet(ongletDe(el));
    el.scrollIntoView(opts || { block: "start" });
  }
  // Un onglet touché s'ouvre en haut ; l'onglet déjà ouvert remonte en haut.
  function allerA(cible) {
    if (ONGLETS.includes(cible)) { enHaut(!afficherOnglet(cible)); return true; }
    const el = cible && F(cible);
    if (el && ongletDe(el)) { montrer(el); return true; }
    return false;
  }
  F("onglets").addEventListener("click", e => {
    const b = e.target.closest("[data-onglet]");
    if (b) allerA(b.dataset.onglet);
  });
  F("onglets").addEventListener("keydown", e => {
    const i = ONGLETS.indexOf(ongletActif), n = ONGLETS.length;
    const j = { ArrowRight: (i + 1) % n, ArrowLeft: (i + n - 1) % n, Home: 0, End: n - 1 }[e.key];
    if (j === undefined) return;
    e.preventDefault();
    allerA(ONGLETS[j]);
    F("tab-" + ONGLETS[j]).focus();
  });
  // Les liens internes (« Voir l'idée », le nom de la page) passent par les onglets.
  document.addEventListener("click", e => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (a && allerA(a.getAttribute("href").slice(1))) e.preventDefault();
  });
  const cibleAdresse = () => { try { return decodeURIComponent(location.hash.slice(1)); } catch (_) { return ""; } };
  // Une adresse sans onglet (retour au tout début de l'historique) ramène à « Aujourd'hui ».
  const depuisAdresse = () => { parHistorique = true; try { allerA(cibleAdresse() || ONGLETS[0]); } finally { parHistorique = false; } };
  window.addEventListener("hashchange", depuisAdresse);
  if (cibleAdresse()) depuisAdresse();

  // Au retour sur la page, et avant chaque geste : si la date a changé, on recharge d'abord.
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") jourChange(); });
  window.addEventListener("focus", () => jourChange());
  window.addEventListener("pageshow", () => jourChange());
  ["click", "change", "submit"].forEach(type => document.addEventListener(type, e => {
    if (jourChange(e)) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (modeDonnees !== "local" && !syncPrete) gesteAvantSync = true;
  }, true));

  // ---------- démarrage ----------
  if (modeDonnees === "local") lireDonneesLocales();
  indexerJournal();
  indexer();
  remplirListes();
  remplirListesAcheter();
  reconcilier();
  rendreTout();
  brancher();
  brancherStyliste();
  brancherTelechargements();
  // Si la base tarde trop, on cesse d'afficher « Chargement » (sans rien effacer de la semaine).
  setTimeout(() => {
    if (etatAjouts === "chargement") { etatAjouts = "indisponible"; reconcilier(); rendreTout(); }
  }, 12000);
})();

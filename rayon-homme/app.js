// Rayon Homme : le catalogue de travail du rayon Homme, rangé comme un site de marque.
// Logique de rayon-homme/index.html. Articles, remarques et réglages vivent dans la base de la page
// publiée ; ouverte en fichier, la page les garde dans le navigateur (sans photos).
(() => {
  "use strict";

  // ---------- outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = s => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’`]/g, "'").replace(/\s+/g, " ").trim();
  const arrondi = n => Math.round(n * 100) / 100;
  const euro = n => { const v = arrondi(n); const d = Number.isInteger(v) ? 0 : 2; return v.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: d, maximumFractionDigits: d }); };
  const pluriel = (n, mot, motPluriel) => `${n} ${n > 1 ? (motPluriel || mot + "s") : mot}`;
  const unique = l => [...new Set(l)];
  const nouvelId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const slug = s => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  const aujourdhui = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const versDate = iso => { const [a, m, j] = iso.split("-").map(Number); return new Date(a, m - 1, j); };
  const joursDepuis = iso => { const auj = new Date(); auj.setHours(0, 0, 0, 0); return Math.round((auj - versDate(iso)) / 86400000); };
  const dateLongue = iso => versDate(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const dateHeure = iso => { const d = new Date(iso); return isNaN(d) ? "" : `${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`; };
  const prixSaisi = v => { const x = parseFloat(String(v ?? "").replace(",", ".")); return isFinite(x) && x >= 0 ? arrondi(x) : null; };
  const lignes = s => String(s || "").split("\n").map(x => x.trim()).filter(Boolean);
  const lireStockage = (cle, defaut) => { try { const v = localStorage.getItem(cle); return v ? JSON.parse(v) : defaut; } catch (_) { return defaut; } };
  const ecrireStockage = (cle, v) => { try { localStorage.setItem(cle, JSON.stringify(v)); } catch (_) { /* stockage indisponible */ } };
  const texte = (v, max = 300) => typeof v === "string" ? v.trim().slice(0, max) : "";
  const listeTextes = (v, max = 30, long = 120) => Array.isArray(v) ? unique(v.filter(x => typeof x === "string" && x.trim()).map(x => x.trim().slice(0, long))).slice(0, max) : [];
  const montant = v => typeof v === "number" && isFinite(v) && v >= 0 ? arrondi(v) : null;
  const attendre = ms => new Promise(r => setTimeout(r, ms));
  // Un montant écrit à la française ou non : « 89,90 € », « 1 299,00 », « 89.9 ».
  function lireMontant(v) {
    if (typeof v === "number") return montant(v);
    let s = String(v ?? "").replace(/[^\d,.]/g, "");
    if (!s) return null;
    if (s.includes(",") && s.includes(".")) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
    else s = s.replace(",", ".");
    const x = parseFloat(s);
    return isFinite(x) && x >= 0 ? arrondi(x) : null;
  }
  // « 2026-10-19 » ou « 19/10/2026 » ; autre chose : vide.
  function lireDate(v) {
    const s = String(v ?? "").trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
    return m ? `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
  }
  // Adresse de la page publiée : sert au lien direct vers une fiche (#p-identifiant).
  const ADRESSE_PAGE = "https://claude.ai/artifact/2FF2gNvSR1b9WYtDET6Nzr";

  // Un message en bas de l'écran. Avec une action (« Annuler »), il reste 8 secondes ; quand il disparaît ou qu'un
  // autre message le remplace, `expire` termine ce qui attendait (par exemple supprimer les photos pour de bon).
  let minuteurToast = null, toastEnCours = null;
  function toast(t, action) {
    const el = $("#toast");
    const precedent = toastEnCours; toastEnCours = null;
    clearTimeout(minuteurToast);
    if (precedent && precedent.expire) precedent.expire();
    toastEnCours = action || null;
    el.innerHTML = `<span>${esc(t)}</span>${action ? `<button type="button" class="toast-action">${esc(action.libelle)}</button>` : ""}`;
    el.hidden = false;
    if (action) el.querySelector(".toast-action").addEventListener("click", () => {
      clearTimeout(minuteurToast); toastEnCours = null; el.hidden = true; action.faire();
    });
    minuteurToast = setTimeout(() => {
      el.hidden = true;
      const fini = toastEnCours; toastEnCours = null;
      if (fini && fini.expire) fini.expire();
    }, action ? 8000 : 2800);
  }

  const SVG = {
    coeur: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/></svg>`,
    croix: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>`,
    loupe: `<svg class="picto" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.6-4.6"/></svg>`,
    droite: `<svg class="picto" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>`,
    gauche: `<svg class="picto" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>`,
  };

  // ---------- vocabulaire du rayon ----------
  // type : sert aux tailles proposées, aux champs affichés (col, manches) et à « Complétez le look ».
  const SECTIONS = [
    { id: "vetements", nom: "Vêtements", categories: [
      { id: "t-shirts", nom: "T-shirts", type: "haut" },
      { id: "polos", nom: "Polos", type: "haut" },
      { id: "chemises", nom: "Chemises", type: "haut" },
      { id: "pulls", nom: "Pulls & Gilets", type: "haut" },
      { id: "sweats", nom: "Sweats & Hoodies", type: "haut" },
      { id: "vestes", nom: "Vestes & Blousons", type: "dessus" },
      { id: "manteaux", nom: "Manteaux & Parkas", type: "dessus" },
      { id: "jeans", nom: "Jeans", type: "bas" },
      { id: "pantalons", nom: "Pantalons & Chinos", type: "bas" },
      { id: "shorts", nom: "Shorts & Bermudas", type: "bas" },
      { id: "joggings", nom: "Joggings & Survêtements", type: "jogging" },
      { id: "sous-vetements", nom: "Sous-vêtements & Chaussettes", type: "autre" },
    ] },
    { id: "chaussures", nom: "Chaussures", categories: [
      { id: "baskets", nom: "Baskets", type: "pieds" },
      { id: "boots", nom: "Boots & Bottines", type: "pieds" },
      { id: "chaussures-ville", nom: "Chaussures de ville", type: "pieds" },
      { id: "sandales", nom: "Sandales & Claquettes", type: "pieds" },
    ] },
    { id: "accessoires", nom: "Accessoires", categories: [
      { id: "ceintures", nom: "Ceintures", type: "accessoire" },
      { id: "casquettes", nom: "Casquettes & Bonnets", type: "accessoire" },
      { id: "echarpes", nom: "Écharpes & Gants", type: "accessoire" },
      { id: "sacs", nom: "Sacs & Maroquinerie", type: "accessoire" },
      { id: "autres-accessoires", nom: "Autres accessoires", type: "accessoire" },
    ] },
  ];
  const CATEGORIES = SECTIONS.flatMap(s => s.categories.map(c => ({ ...c, section: s.id })));
  const CAT = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
  const SECTION = Object.fromEntries(SECTIONS.map(s => [s.id, s]));

  const LETTRES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL"];
  const GAMMES = {
    haut: LETTRES, dessus: LETTRES, jogging: LETTRES, autre: LETTRES,
    bas: ["W28", "W29", "W30", "W31", "W32", "W33", "W34", "W36", "W38"],
    pieds: ["39", "40", "41", "42", "43", "44", "45", "46"],
    accessoire: ["TU", "S", "M", "L", "XL"],
  };
  const ORDRE_TAILLES = unique(["TU", ...LETTRES, ...GAMMES.bas, ...GAMMES.pieds]);
  const comparerTailles = (x, y) => {
    const i = ORDRE_TAILLES.indexOf(x), j = ORDRE_TAILLES.indexOf(y);
    if (i >= 0 && j >= 0) return i - j;
    if (i >= 0) return -1;
    if (j >= 0) return 1;
    return x.localeCompare(y, "fr", { numeric: true });
  };

  const COULEURS = [
    { id: "noir", nom: "Noir", hex: "#141416" },
    { id: "anthracite", nom: "Anthracite", hex: "#3d4148" },
    { id: "gris", nom: "Gris", hex: "#8b9099" },
    { id: "gris-clair", nom: "Gris clair", hex: "#c9ccd1" },
    { id: "blanc", nom: "Blanc", hex: "#ffffff" },
    { id: "ecru", nom: "Écru", hex: "#efe7d6" },
    { id: "beige", nom: "Beige", hex: "#d5c3a3" },
    { id: "camel", nom: "Camel", hex: "#b4814e" },
    { id: "marron", nom: "Marron", hex: "#6a4630" },
    { id: "kaki", nom: "Kaki", hex: "#6b6a3f" },
    { id: "vert", nom: "Vert", hex: "#2f6b4f" },
    { id: "marine", nom: "Marine", hex: "#1c2740" },
    { id: "bleu", nom: "Bleu", hex: "#3461a8" },
    { id: "bleu-clair", nom: "Bleu clair", hex: "#93b3d8" },
    { id: "bordeaux", nom: "Bordeaux", hex: "#6c1f2f" },
    { id: "rouge", nom: "Rouge", hex: "#c1272d" },
    { id: "rose", nom: "Rose", hex: "#e9a7b9" },
    { id: "jaune", nom: "Jaune", hex: "#e3bf2b" },
    { id: "orange", nom: "Orange", hex: "#e07a2c" },
    { id: "violet", nom: "Violet", hex: "#6b4f9c" },
    { id: "multicolore", nom: "Multicolore", hex: "conic-gradient(#c1272d, #e3bf2b, #2f6b4f, #3461a8, #6b4f9c, #c1272d)" },
  ];
  const COULEUR = Object.fromEntries(COULEURS.map(c => [c.id, c]));
  // La famille de couleur se devine depuis le nom écrit sur l'étiquette ; l'ordre compte (« bleu marine » avant « bleu »).
  const DEVINER_COULEUR = [
    [/multi|imprime|raye|rayure|carreau|motif|camo/, "multicolore"],
    [/anthracite|charbon/, "anthracite"],
    [/gris clair|perle/, "gris-clair"],
    [/gris|argent/, "gris"],
    [/noir|black/, "noir"],
    [/ecru|creme|casse|ivoire/, "ecru"],
    [/blanc|white/, "blanc"],
    [/beige|sable|stone|taupe/, "beige"],
    [/camel|cognac|caramel|tabac/, "camel"],
    [/marron|chocolat|brun/, "marron"],
    [/kaki|khaki|olive/, "kaki"],
    [/vert|sapin|emeraude/, "vert"],
    [/marine|navy|nuit/, "marine"],
    [/bleu clair|ciel|delave clair/, "bleu-clair"],
    [/bleu|indigo|denim|brut|cobalt/, "bleu"],
    [/bordeaux|burgundy|prune/, "bordeaux"],
    [/rouge/, "rouge"],
    [/rose|saumon/, "rose"],
    [/jaune|moutarde/, "jaune"],
    [/orange|rouille/, "orange"],
    [/violet|mauve|lilas/, "violet"],
  ];
  const devinerCouleur = t => { const n = norm(t); if (!n) return null; for (const [re, id] of DEVINER_COULEUR) if (re.test(n)) return id; return null; };

  const COUPES = ["Skinny", "Slim", "Fuselé", "Droit", "Regular", "Relaxed", "Large", "Oversize", "Bootcut", "Boxy", "Cintré"];
  const MATIERES = ["Coton", "Coton bio", "Denim", "Lin", "Laine", "Mérinos", "Cachemire", "Molleton", "Velours", "Cuir", "Daim", "Polyester", "Nylon", "Viscose", "Élasthanne", "Polaire", "Duvet"];
  const ENCOLURES = ["Col rond", "Col V", "Col camionneur", "Col montant", "Col roulé", "Col polo", "Col chemise", "Col mao", "Capuche"];
  const MANCHES = ["Courtes", "Longues", "Sans manches"];
  const STYLES = ["Casual", "Streetwear", "Chic décontracté", "Habillé", "Sport", "Outdoor", "Workwear", "Vintage"];
  const TAILLANTS = [
    { id: "petit", nom: "Taille petit", conseil: "Conseille une taille au-dessus." },
    { id: "normal", nom: "Taille normalement", conseil: "Le client prend sa taille habituelle." },
    { id: "grand", nom: "Taille grand", conseil: "Conseille une taille en dessous." },
  ];
  const TAILLANT = Object.fromEntries(TAILLANTS.map(t => [t.id, t]));
  const ETATS = { dispo: "Disponible", faible: "Dernières pièces", rupture: "Rupture" };
  const SUIVANT_ETAT = { dispo: "faible", faible: "rupture", rupture: "dispo" };
  const TRANCHES = [
    { id: "0-40", nom: "Moins de 40 €", min: 0, max: 40 },
    { id: "40-70", nom: "40 à 70 €", min: 40, max: 70 },
    { id: "70-100", nom: "70 à 100 €", min: 70, max: 100 },
    { id: "100-150", nom: "100 à 150 €", min: 100, max: 150 },
    { id: "150+", nom: "150 € et plus", min: 150, max: Infinity },
  ];
  const TRIS = [["pertinence", "Pertinence"], ["nouveautes", "Nouveautés"], ["prix-asc", "Prix croissant"], ["prix-desc", "Prix décroissant"], ["marque", "Marque de A à Z"], ["note", "Mieux notés"], ["remarques", "Plus de remarques"]];
  const REMARQUES_RAPIDES = ["Taille petit", "Taille grand", "Se vend bien", "Les clients hésitent sur le prix", "Retour client", "Réassort demandé", "Défaut repéré", "À mettre en vitrine"];
  const REPERES = [
    ["promo", "En promotion"], ["nouveau", "Nouveauté"], ["coeur", "Coup de cœur"], ["remarques", "Avec remarques"],
    ["note4", "Ma note : 4 ★ et plus"], ["dispo", "Disponible"], ["rupture", "En rupture"], ["completer", "Fiche à compléter"],
  ];
  const REPERE = Object.fromEntries(REPERES);

  const saisonParDefaut = () => { const d = new Date(), m = d.getMonth() + 1, a = d.getFullYear(); return m >= 8 ? `Automne-Hiver ${a}` : m === 1 ? `Automne-Hiver ${a - 1}` : `Printemps-Été ${a}`; };
  const SAISONS = () => unique([saisonParDefaut(), "Automne-Hiver 2026", "Printemps-Été 2026", "Printemps-Été 2027", "Permanent"]);

  // ---------- articles : lecture et écriture ----------
  function articleVide() {
    return { id: null, marque: "", nom: "", categorie: "", couleur: "", teinte: "", prix: null, prixPromo: null, tailles: [], taillant: "",
      coupe: "", matieres: [], composition: "", encolure: "", manches: "", saison: "", styles: [], arrivee: "", coupDeCoeur: false,
      description: "", points: [], entretien: "", complements: [], ref: "", lien: "", site: "", photos: [], note: null, creeLe: null, modifieLe: null, stockLe: null };
  }
  // Les documents de la base sont relus champ par champ : une valeur inattendue ne casse pas la page.
  function lireArticle(id, v) {
    const a = articleVide();
    a.id = id;
    if (!v || typeof v !== "object") return a;
    a.marque = texte(v.marque, 80); a.nom = texte(v.nom, 160);
    a.categorie = CAT[v.categorie] ? v.categorie : "";
    a.couleur = texte(v.couleur, 60); a.teinte = COULEUR[v.teinte] ? v.teinte : "";
    a.prix = montant(v.prix); a.prixPromo = montant(v.prixPromo);
    a.tailles = Array.isArray(v.tailles)
      ? v.tailles.filter(t => t && typeof t.t === "string" && t.t.trim()).map(t => ({ t: t.t.trim().slice(0, 20), e: ETATS[t.e] ? t.e : "dispo" })).slice(0, 40)
      : [];
    a.taillant = TAILLANT[v.taillant] ? v.taillant : "";
    a.coupe = texte(v.coupe, 60); a.matieres = listeTextes(v.matieres, 12, 40); a.composition = texte(v.composition, 200);
    a.encolure = texte(v.encolure, 40); a.manches = texte(v.manches, 30); a.saison = texte(v.saison, 60); a.styles = listeTextes(v.styles, 12, 40);
    a.arrivee = /^\d{4}-\d{2}-\d{2}$/.test(v.arrivee || "") ? v.arrivee : "";
    a.coupDeCoeur = v.coupDeCoeur === true;
    a.description = texte(v.description, 3000); a.points = listeTextes(v.points, 20, 300); a.entretien = texte(v.entretien, 300);
    a.complements = listeTextes(v.complements, 12, 120); a.ref = texte(v.ref, 80);
    a.lien = /^https?:\/\//i.test(v.lien || "") ? texte(v.lien, 800) : ""; a.site = texte(v.site, 60);
    a.photos = listeTextes(v.photos, 12, 200).filter(p => /^(asset:[A-Za-z0-9_-]{6,80}|images\/[A-Za-z0-9._-]+\.(jpe?g|png|webp))$/i.test(p));
    a.note = [1, 2, 3, 4, 5].includes(v.note) ? v.note : null;
    a.creeLe = texte(v.creeLe, 40) || null; a.modifieLe = texte(v.modifieLe, 40) || null; a.stockLe = texte(v.stockLe, 40) || null;
    return a;
  }
  function serialiser(a) {
    const { id, ...reste } = a;
    return JSON.parse(JSON.stringify(reste));
  }
  function lireRemarque(id, v) {
    if (!v || typeof v !== "object" || typeof v.article !== "string" || typeof v.texte !== "string" || !v.texte.trim()) return null;
    return { id, article: v.article, texte: v.texte.slice(0, 2000), date: texte(v.date, 40) || "", auteur: texte(v.auteur, 80) || null };
  }
  function lireReglages(v) {
    const r = v && typeof v === "object" ? v : {};
    const jours = Number(r.joursNouveaute);
    return { bandeau: texte(r.bandeau, 140), saisonCourante: texte(r.saisonCourante, 60), joursNouveaute: Number.isInteger(jours) && jours >= 1 && jours <= 180 ? jours : 30 };
  }

  const photoSrc = p => p.startsWith("asset:") ? "/_blob/" + p.slice(6) : p;
  const titreArticle = a => [a.marque, a.nom].filter(Boolean).join(" ") || "Article";
  const enPromo = a => a.prixPromo != null && a.prix != null && a.prixPromo < a.prix;
  const prixEffectif = a => enPromo(a) ? a.prixPromo : a.prix;
  const remise = a => enPromo(a) ? Math.round((1 - a.prixPromo / a.prix) * 100) : 0;
  const estNouveau = a => { if (!a.arrivee) return false; const j = joursDepuis(a.arrivee); return j >= 0 && j <= S.reglages.joursNouveaute; };
  // Un article sans taille notée n'a pas d'état de stock.
  function etatStock(a) {
    if (!a.tailles.length) return null;
    const restantes = a.tailles.filter(t => t.e !== "rupture");
    if (!restantes.length) return "rupture";
    if (restantes.length === 1 || restantes.every(t => t.e === "faible")) return "faible";
    return "dispo";
  }
  const manques = a => [!a.photos.length && "photo", a.prix == null && "prix", !a.tailles.length && "tailles", !a.marque && "marque"].filter(Boolean);
  const cleModele = a => norm(a.marque) + "|" + norm(a.nom);
  const scorePertinence = a => (a.coupDeCoeur ? 4 : 0) + (estNouveau(a) ? 3 : 0) + (enPromo(a) ? 1 : 0) + (a.photos.length ? 1 : 0) + (a.note || 0) / 5 - (etatStock(a) === "rupture" ? 3 : 0);

  // ---------- état ----------
  const CLE_LOCAL = "rayon-homme-v1", CLE_FAVORIS = "rayon-homme-favoris", CLE_VUS = "rayon-homme-vus", CLE_DERNIER = "rayon-homme-dernier";
  const S = { articles: {}, remarques: {}, reglages: lireReglages(null), favoris: new Set(listeTextes(lireStockage(CLE_FAVORIS, []), 500)), charge: false };
  const C = { mode: "attente", db: null, user: null, moi: null, proprio: false, peutEcrire: false, assets: null, sample: null, sampleImages: false, downloads: null, files: new Map(), noms: {} };
  const V = {
    route: { page: "accueil" }, pile: [], listes: {},
    ouverts: new Set(["categorie", "marque", "couleur", "taille", "prix", "reperes"]),
    accordeons: new Set(["description"]),
    menu: null, couche: null, tiroirNiveau: null, retourFocus: null,
    recherche: "", galerie: 0, stock: false, remarque: {},
    edition: null,            // remarque en cours de modification : { id, texte }
    selection: null,          // articles cochés sur une liste (mode « Sélectionner »)
    armeSerie: false,         // suppression de la sélection à confirmer
    comparaison: [],          // articles comparés côte à côte
    conseil: { demande: "", dispo: true, enCours: false, reponse: null, erreur: "", ctl: null },
    filtreRemarques: "", limiteRemarques: 40,
  };
  let F = null;       // formulaire d'article ouvert
  let IMP = null, RES = null, COPIE = null;   // import d'un tableur, restauration, texte à copier à la main
  let minuteurOuverture = null, minuteurFermeture = null;   // méga-menu au survol
  const survol = matchMedia("(hover: hover) and (pointer: fine)");
  let R = null;       // réglages du site en cours de modification

  // ---------- index (recalculé à chaque changement de données) ----------
  let IDX = null;
  const invalider = () => { IDX = null; };
  function idx() {
    if (IDX) return IDX;
    const liste = Object.values(S.articles);
    const freres = new Map();
    for (const a of liste) { const k = cleModele(a); if (!freres.has(k)) freres.set(k, []); freres.get(k).push(a.id); }
    const remParArticle = {};
    for (const r of Object.values(S.remarques)) (remParArticle[r.article] || (remParArticle[r.article] = [])).push(r);
    for (const k in remParArticle) remParArticle[k].sort((x, y) => y.date.localeCompare(x.date));
    const recherche = {};
    for (const a of liste) {
      const cat = CAT[a.categorie];
      recherche[a.id] = norm([a.marque, a.nom, a.couleur, COULEUR[a.teinte]?.nom, cat?.nom, cat && SECTION[cat.section].nom, a.coupe, a.matieres.join(" "),
        a.composition, a.encolure, a.manches, a.saison, a.styles.join(" "), a.ref, a.description, a.points.join(" "),
        (remParArticle[a.id] || []).map(r => r.texte).join(" ")].filter(Boolean).join(" "));
    }
    const marques = {}, parCat = {}, parSection = {};
    for (const a of liste) {
      if (a.marque) marques[a.marque] = (marques[a.marque] || 0) + 1;
      if (a.categorie) { parCat[a.categorie] = (parCat[a.categorie] || 0) + 1; const s = CAT[a.categorie].section; parSection[s] = (parSection[s] || 0) + 1; }
    }
    IDX = { liste, freres, remParArticle, recherche, marques, parCat, parSection };
    return IDX;
  }
  const nbRemarques = a => idx().remParArticle[a.id]?.length || 0;
  const freresDe = a => (idx().freres.get(cleModele(a)) || []).map(id => S.articles[id]).filter(Boolean).sort((x, y) => (x.couleur || "").localeCompare(y.couleur || "", "fr"));

  // ---------- filtres ----------
  const ordreSelon = liste => (x, y) => { const i = liste.indexOf(x), j = liste.indexOf(y); return (i < 0 ? 999 : i) - (j < 0 ? 999 : j) || String(x).localeCompare(String(y), "fr"); };
  const alpha = (x, y) => String(x).localeCompare(String(y), "fr");
  function reperesDe(a) {
    const r = [];
    if (enPromo(a)) r.push("promo");
    if (estNouveau(a)) r.push("nouveau");
    if (a.coupDeCoeur) r.push("coeur");
    if (nbRemarques(a)) r.push("remarques");
    if ((a.note || 0) >= 4) r.push("note4");
    const s = etatStock(a);
    if (s && s !== "rupture") r.push("dispo");
    if (s === "rupture") r.push("rupture");
    if (C.peutEcrire && manques(a).length) r.push("completer");
    return r;
  }
  const FACETTES = [
    { id: "categorie", nom: "Catégorie", valeurs: a => a.categorie ? [a.categorie] : [], libelle: v => CAT[v]?.nom || v, ordre: ordreSelon(CATEGORIES.map(c => c.id)) },
    { id: "marque", nom: "Marque", valeurs: a => a.marque ? [a.marque] : [], ordre: alpha },
    { id: "couleur", nom: "Couleur", type: "couleur", valeurs: a => a.teinte ? [a.teinte] : [], libelle: v => COULEUR[v]?.nom || v, ordre: ordreSelon(COULEURS.map(c => c.id)) },
    { id: "taille", nom: "Taille disponible", type: "taille", valeurs: a => a.tailles.filter(t => t.e !== "rupture").map(t => t.t), ordre: comparerTailles },
    { id: "prix", nom: "Prix", valeurs: a => { const p = prixEffectif(a); const t = p == null ? null : TRANCHES.find(x => p >= x.min && p < x.max); return t ? [t.id] : []; }, libelle: v => TRANCHES.find(t => t.id === v)?.nom || v, ordre: ordreSelon(TRANCHES.map(t => t.id)) },
    { id: "coupe", nom: "Coupe", valeurs: a => a.coupe ? [a.coupe] : [], ordre: ordreSelon(COUPES) },
    { id: "matiere", nom: "Matière", valeurs: a => a.matieres, ordre: ordreSelon(MATIERES) },
    { id: "encolure", nom: "Col", valeurs: a => a.encolure ? [a.encolure] : [], ordre: ordreSelon(ENCOLURES) },
    { id: "manches", nom: "Manches", valeurs: a => a.manches ? [a.manches] : [], ordre: ordreSelon(MANCHES) },
    { id: "taillant", nom: "Taillant", valeurs: a => a.taillant ? [a.taillant] : [], libelle: v => TAILLANT[v]?.nom || v, ordre: ordreSelon(TAILLANTS.map(t => t.id)) },
    { id: "saison", nom: "Collection", valeurs: a => a.saison ? [a.saison] : [], ordre: alpha },
    { id: "style", nom: "Style", valeurs: a => a.styles, ordre: ordreSelon(STYLES) },
    // Mes repères se cumulent (« coup de cœur » ET « disponible »), contrairement aux autres filtres.
    { id: "reperes", nom: "Mes repères", valeurs: reperesDe, libelle: v => REPERE[v] || v, ordre: ordreSelon(REPERES.map(r => r[0])), cumul: true, toujours: true },
  ];
  const FACETTE = Object.fromEntries(FACETTES.map(f => [f.id, f]));
  const libelleFiltre = (f, v) => f.libelle ? f.libelle(v) : v;

  function filtrer(liste, filtres, sauf) {
    return liste.filter(a => FACETTES.every(f => {
      if (f.id === sauf) return true;
      const choix = filtres[f.id];
      if (!choix || !choix.size) return true;
      const vals = f.valeurs(a);
      return f.cumul ? [...choix].every(v => vals.includes(v)) : vals.some(v => choix.has(v));
    }));
  }

  function baseDeRoute(r) {
    const L = idx().liste;
    switch (r.type) {
      case "section": return L.filter(a => CAT[a.categorie]?.section === r.valeur);
      case "categorie": return L.filter(a => a.categorie === r.valeur);
      case "marque": return L.filter(a => a.marque === r.valeur);
      case "nouveautes": return L.filter(estNouveau);
      case "promos": return L.filter(enPromo);
      case "coups": return L.filter(a => a.coupDeCoeur);
      case "favoris": return L.filter(a => S.favoris.has(a.id));
      case "a-completer": return L.filter(a => manques(a).length);
      case "recherche": { const q = norm(r.valeur).split(" ").filter(Boolean); return L.filter(a => q.every(m => idx().recherche[a.id].includes(m))); }
      default: return L;
    }
  }

  function trier(liste, tri, route) {
    const nom = a => norm(titreArticle(a) + " " + a.couleur);
    let bonus = () => 0;
    if (route && route.type === "recherche") {
      const q = norm(route.valeur).split(" ").filter(Boolean);
      bonus = a => q.every(m => norm(titreArticle(a)).includes(m)) ? 5 : 0;
    }
    const cmp = {
      pertinence: (a, b) => (scorePertinence(b) + bonus(b)) - (scorePertinence(a) + bonus(a)) || nom(a).localeCompare(nom(b)),
      nouveautes: (a, b) => (b.arrivee || b.creeLe || "").localeCompare(a.arrivee || a.creeLe || "") || nom(a).localeCompare(nom(b)),
      "prix-asc": (a, b) => (prixEffectif(a) ?? Infinity) - (prixEffectif(b) ?? Infinity) || nom(a).localeCompare(nom(b)),
      "prix-desc": (a, b) => (prixEffectif(b) ?? -1) - (prixEffectif(a) ?? -1) || nom(a).localeCompare(nom(b)),
      marque: (a, b) => norm(a.marque).localeCompare(norm(b.marque)) || nom(a).localeCompare(nom(b)),
      note: (a, b) => (b.note || 0) - (a.note || 0) || nom(a).localeCompare(nom(b)),
      remarques: (a, b) => nbRemarques(b) - nbRemarques(a) || nom(a).localeCompare(nom(b)),
    }[tri] || ((a, b) => nom(a).localeCompare(nom(b)));
    return [...liste].sort(cmp);
  }

  // ---------- données : base de la page ou navigateur ----------
  function enregistrerLocal() {
    ecrireStockage(CLE_LOCAL, {
      articles: Object.fromEntries(Object.values(S.articles).map(a => [a.id, serialiser(a)])),
      remarques: Object.fromEntries(Object.values(S.remarques).map(r => [r.id, { article: r.article, texte: r.texte, date: r.date, auteur: r.auteur }])),
      reglages: S.reglages,
    });
  }
  function chargerLocal() {
    const d = lireStockage(CLE_LOCAL, null);
    if (!d || typeof d !== "object") return;
    S.articles = Object.fromEntries(Object.entries(d.articles || {}).map(([id, v]) => [id, lireArticle(id, v)]));
    S.remarques = Object.fromEntries(Object.entries(d.remarques || {}).map(([id, v]) => [id, lireRemarque(id, v)]).filter(e => e[1]));
    S.reglages = lireReglages(d.reglages);
  }

  // Une écriture à la fois par document, dans l'ordre des gestes ; une coupure passagère est retentée une fois.
  function ecrireBrut(chemin, corps) {
    const faire = () => (corps ? C.db.doc(chemin).set(corps) : C.db.doc(chemin).delete());
    const avant = C.files.get(chemin) || Promise.resolve();
    const suite = avant.catch(() => {}).then(faire)
      .catch(e => { if (e && e.code === "unavailable") return attendre(400 + Math.random() * 800).then(faire); throw e; });
    C.files.set(chemin, suite.catch(() => {}));
    return suite;
  }
  function ecrire(chemin, corps) {
    if (C.mode === "local") { enregistrerLocal(); return Promise.resolve(true); }
    if (C.mode !== "distant") { toast("Connexion en cours : réessaie dans un instant."); return Promise.resolve(false); }
    return ecrireBrut(chemin, corps).then(() => true, e => { erreurEcriture(e); return false; });
  }
  // Beaucoup d'écritures d'un coup (import, sauvegarde, sélection) : l'une après l'autre, en ralentissant
  // quand la base le demande. ops : [[chemin, document ou null], …]
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
          // Un refus qui vaudra pour toutes les écritures suivantes : inutile de continuer.
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
      toast("Tu peux consulter ce catalogue, mais pas le modifier.");
    } else if (code === "quota_exceeded") toast("La base du catalogue est pleine : supprime des articles ou des remarques.");
    else toast("Pas enregistré. Vérifie ta connexion et réessaie.");
  }

  function sauverArticle(a) {
    a.modifieLe = new Date().toISOString();
    S.articles[a.id] = a; invalider(); planifier();
    return ecrire("articles/" + a.id, serialiser(a));
  }

  // Les favoris sont propres à chaque personne : rangés dans son espace privé de la base quand il existe.
  function enregistrerFavoris() {
    const liste = [...S.favoris];
    ecrireStockage(CLE_FAVORIS, liste);
    if (C.mode === "distant" && C.moi) C.db.doc(`data/users/${C.moi}/prefs`).set({ favoris: liste }).catch(() => {});
  }
  function basculerFavori(id) {
    const a = S.articles[id]; if (!a) return;
    const ajoute = !S.favoris.has(id);
    if (ajoute) S.favoris.add(id); else S.favoris.delete(id);
    enregistrerFavoris();
    render();
    toast(ajoute ? "Ajouté à tes favoris" : "Retiré de tes favoris");
  }

  function noter(id, n) {
    const a = S.articles[id]; if (!a || !C.peutEcrire) return;
    sauverArticle({ ...a, note: a.note === n ? null : n });
  }
  function changerEtatTaille(id, taille) {
    const a = S.articles[id]; if (!a || !C.peutEcrire) return;
    const tailles = a.tailles.map(t => t.t === taille ? { t: t.t, e: SUIVANT_ETAT[t.e] } : t);
    sauverArticle({ ...a, tailles, stockLe: new Date().toISOString() });
  }

  function ajouterRemarque(articleId) {
    const t = (V.remarque[articleId] || "").trim();
    if (!t) { $("#remarque-texte")?.focus(); return; }
    const id = nouvelId();
    const doc = { article: articleId, texte: t.slice(0, 2000), date: new Date().toISOString(), auteur: C.moi || null };  // même forme que docRemarque
    S.remarques[id] = { id, ...doc };
    V.remarque[articleId] = "";
    invalider(); render();
    ecrire("remarques/" + id, doc);
    toast("Remarque ajoutée");
  }
  const docRemarque = r => ({ article: r.article, texte: r.texte, date: r.date, auteur: r.auteur, ...(r.modifieLe ? { modifieLe: r.modifieLe } : {}) });
  function supprimerRemarque(id) {
    const r = S.remarques[id]; if (!r) return;
    if (V.edition && V.edition.id === id) V.edition = null;
    delete S.remarques[id]; invalider(); render();
    ecrire("remarques/" + id, null);
    toast("Remarque supprimée", { libelle: "Annuler", faire: () => { S.remarques[id] = r; invalider(); render(); ecrire("remarques/" + id, docRemarque(r)); } });
  }
  function modifierRemarque(id) {
    const r = S.remarques[id]; if (!r) return;
    V.edition = { id, texte: r.texte };
    render();
    const champ = $("#remarque-edition");
    if (champ) { champ.focus(); champ.setSelectionRange(champ.value.length, champ.value.length); }
  }
  function enregistrerRemarque() {
    const e = V.edition; if (!e) return;
    const r = S.remarques[e.id], t = e.texte.trim();
    if (!r) { V.edition = null; render(); return; }
    if (!t) { $("#remarque-edition")?.focus(); return; }
    const nouvelle = { ...r, texte: t.slice(0, 2000), modifieLe: new Date().toISOString() };
    S.remarques[e.id] = nouvelle; V.edition = null; invalider(); render();
    ecrire("remarques/" + e.id, docRemarque(nouvelle));
    toast("Remarque modifiée");
  }
  function insererRemarque(debut) {
    const id = V.route.id, champ = $("#remarque-texte");
    const actuel = (champ ? champ.value : V.remarque[id] || "").replace(/\s+$/, "");
    V.remarque[id] = (actuel ? actuel + "\n" : "") + debut + " : ";
    if (champ) { champ.value = V.remarque[id]; champ.focus(); champ.setSelectionRange(champ.value.length, champ.value.length); }
  }

  async function supprimerArticle(id) {
    const a = S.articles[id]; if (!a) return null;
    const remarques = Object.values(S.remarques).filter(r => r.article === id);
    const favori = S.favoris.has(id);
    delete S.articles[id];
    for (const r of remarques) delete S.remarques[r.id];
    if (favori) { S.favoris.delete(id); enregistrerFavoris(); }
    invalider();
    const ok = await ecrire("articles/" + id, null);
    for (const r of remarques) ecrire("remarques/" + r.id, null);
    return ok ? { a, remarques, favori } : null;
  }
  function restaurerArticles(liste) {
    for (const { a, remarques, favori } of liste) {
      S.articles[a.id] = a; ecrire("articles/" + a.id, serialiser(a));
      for (const r of remarques) { S.remarques[r.id] = r; ecrire("remarques/" + r.id, docRemarque(r)); }
      if (favori) S.favoris.add(a.id);
    }
    if (liste.some(x => x.favori)) enregistrerFavoris();
    invalider(); render();
    toast(liste.length > 1 ? `${liste.length} articles remis dans le rayon` : "Article remis dans le rayon");
  }
  // Les photos envoyées pour un article ne servent qu'à lui : elles partent quand l'annulation n'est plus possible.
  function supprimerPhotos(liste) {
    if (!C.assets) return;
    for (const { a } of liste) for (const p of a.photos) if (p.startsWith("asset:")) C.assets.delete(p.slice(6)).catch(() => {});
  }
  function annoncerSuppression(liste, nom) {
    if (!liste.length) { toast("Pas supprimé. Vérifie ta connexion et réessaie."); return; }
    toast(liste.length > 1 ? `${liste.length} articles supprimés` : `« ${nom || titreArticle(liste[0].a)} » supprimé`,
      { libelle: "Annuler", faire: () => restaurerArticles(liste), expire: () => supprimerPhotos(liste) });
  }

  // ---------- navigation (dans la page : l'adresse ne change jamais) ----------
  function cleRoute(r) { return r.page === "liste" ? `liste:${r.type}${r.valeur != null ? ":" + r.valeur : ""}` : r.page === "produit" ? "produit:" + r.id : r.page; }
  const PAGES_OUTILS = { conseil: "Conseiller un client", stock: "Stock et réassort", remarques: "Mes remarques", comparer: "Comparer" };
  function lireRoute(s) {
    const [page, type, ...reste] = String(s).split(":");
    if (PAGES_OUTILS[page]) return { page };
    if (page === "produit") return { page: "produit", id: [type, ...reste].join(":") };
    if (page === "liste") return { page: "liste", type: type || "tout", valeur: reste.length ? reste.join(":") : undefined };
    return { page: "accueil" };
  }
  function etatListe(r) {
    const k = cleRoute(r);
    return V.listes[k] || (V.listes[k] = { filtres: {}, tri: r.type === "nouveautes" ? "nouveautes" : "pertinence", limite: 24 });
  }
  function appliquerPreset(r, preset) {
    const E = etatListe(r), [cle, valeur] = preset.split(":");
    E.filtres = {}; E.limite = 24; E.tri = "pertinence";
    if (cle === "tri") E.tri = valeur;
    else if (FACETTE[cle]) E.filtres[cle] = new Set([valeur]);
  }
  function aller(r, { remplacer = false } = {}) {
    // Un clic sur le menu ne doit pas le rouvrir par-dessus la page d'arrivée.
    clearTimeout(minuteurOuverture);
    fermerCouches({ sansFocus: true });
    if (!remplacer) { V.pile.push({ route: V.route, y: window.scrollY }); if (V.pile.length > 40) V.pile.shift(); }
    V.route = r; V.galerie = 0; V.stock = false; V.menu = null; V.edition = null; V.selection = null; V.armeSerie = false;
    if (r.page === "produit") memoriserVu(r.id);
    render();
    window.scrollTo(0, 0);
    $("#contenu").focus({ preventScroll: true });
  }
  function retour() {
    const p = V.pile.pop();
    if (!p) { aller({ page: "accueil" }, { remplacer: true }); return; }
    fermerCouches({ sansFocus: true });
    V.route = p.route; V.galerie = 0; V.stock = false; V.menu = null; V.edition = null; V.selection = null; V.armeSerie = false;
    render();
    window.scrollTo(0, p.y);
  }
  function memoriserVu(id) {
    const vus = listeTextes(lireStockage(CLE_VUS, []), 20).filter(x => x !== id);
    vus.unshift(id);
    ecrireStockage(CLE_VUS, vus.slice(0, 12));
  }
  const articlesVus = sauf => listeTextes(lireStockage(CLE_VUS, []), 20).filter(id => id !== sauf && S.articles[id]).map(id => S.articles[id]);

  // ---------- rendu : outils communs ----------
  // Remplace un bloc en gardant le champ actif (et sa sélection) et le défilement des panneaux.
  function remplacer(el, html) {
    const actif = document.activeElement;
    let cible = null, selection = null;
    if (actif && actif !== el && el.contains(actif)) {
      cible = actif.id ? "#" + CSS.escape(actif.id) : actif.dataset.cle ? `[data-cle="${CSS.escape(actif.dataset.cle)}"]` : null;
      try { if (typeof actif.selectionStart === "number") selection = [actif.selectionStart, actif.selectionEnd]; } catch (_) { /* champ sans sélection */ }
    }
    const defilements = $$(".dialogue-corps, .tiroir-corps, .cote", el).map(x => x.scrollTop);
    el.innerHTML = html;
    $$(".dialogue-corps, .tiroir-corps, .cote", el).forEach((x, i) => { if (defilements[i]) x.scrollTop = defilements[i]; });
    if (cible) {
      const n = $(cible, el);
      if (n) { n.focus({ preventScroll: true }); if (selection) try { n.setSelectionRange(selection[0], selection[1]); } catch (_) { /* champ sans sélection */ } }
    }
  }
  let rendrePrevu = false;
  function planifier() {
    if (rendrePrevu) return;
    rendrePrevu = true;
    requestAnimationFrame(() => { rendrePrevu = false; render(); });
  }

  function prixHTML(a) {
    if (a.prix == null) return `<p class="prix"><span class="manque">Prix à renseigner</span></p>`;
    if (enPromo(a)) return `<p class="prix"><span class="actuel promo">${euro(a.prixPromo)}</span><s>${euro(a.prix)}</s><span class="remise">−${remise(a)} %</span></p>`;
    return `<p class="prix"><span class="actuel">${euro(a.prix)}</span></p>`;
  }
  const etoilesMini = n => `<span class="etoiles-mini" aria-label="Ma note : ${n} sur 5">${"★".repeat(n)}<span style="color:var(--trait)">${"★".repeat(5 - n)}</span></span>`;
  const fondCouleur = id => COULEUR[id]?.hex || "var(--fond-3)";

  function carte(a, opts = {}) {
    const [p1, p2] = a.photos;
    const freres = freresDe(a);
    const stock = etatStock(a);
    const nbR = nbRemarques(a);
    const fav = S.favoris.has(a.id);
    const badges = [
      estNouveau(a) && `<span class="badge">Nouveau</span>`,
      enPromo(a) && `<span class="badge promo">−${remise(a)} %</span>`,
      a.coupDeCoeur && `<span class="badge coeur">Coup de cœur</span>`,
      stock === "rupture" && `<span class="badge rupture">Rupture</span>`,
    ].filter(Boolean).join("");
    const route = esc("produit:" + a.id);
    const pied = [
      freres.length > 1 && `<span class="freres" aria-label="${freres.length} coloris">${freres.slice(0, 6).map(f => `<span class="frere${f.id === a.id ? " courant" : ""}" style="background:${fondCouleur(f.teinte)}" title="${esc(f.couleur || "")}"></span>`).join("")}${freres.length > 6 ? `<span>+${freres.length - 6}</span>` : ""}</span>`,
      a.note && etoilesMini(a.note),
      nbR && `<span>${pluriel(nbR, "remarque")}</span>`,
      stock === "faible" && `<span class="stock-pastille faible">Dernières pièces</span>`,
    ].filter(Boolean).join("");
    const manque = opts.manques ? manques(a) : [];
    const sel = opts.selection, choisi = !!(sel && sel.has(a.id));
    const lien = sel ? `data-action="choisir" data-id="${esc(a.id)}" aria-pressed="${choisi}"` : `data-route="${route}"`;
    return `<article class="carte${choisi ? " choisie" : ""}">
      <div class="carte-visuel">
        <button class="carte-lien" type="button" ${lien} data-cle="${sel ? "choisir:" : "voir:"}${esc(a.id)}" aria-label="${sel ? (choisi ? "Désélectionner " : "Sélectionner ") : ""}${esc(titreArticle(a))}${a.couleur ? ", " + esc(a.couleur) : ""}">
          ${p1 ? `<img src="${esc(photoSrc(p1))}" alt="" loading="lazy">${p2 ? `<img class="seconde" src="${esc(photoSrc(p2))}" alt="" loading="lazy">` : ""}`
            : `<span class="sans-photo">${esc(a.marque || CAT[a.categorie]?.nom || "Sans photo")}</span>`}
        </button>
        ${badges ? `<div class="badges">${badges}</div>` : ""}
        ${sel ? `<span class="coche${choisi ? " oui" : ""}" aria-hidden="true"></span>`
          : `<button class="coeur-btn" type="button" data-action="favori" data-id="${esc(a.id)}" data-cle="fav:${esc(a.id)}" aria-pressed="${fav}" aria-label="${fav ? "Retirer des favoris" : "Ajouter aux favoris"}">${SVG.coeur}</button>`}
      </div>
      <div class="carte-infos">
        <p class="carte-marque">${esc(a.marque || "Sans marque")}</p>
        <button class="carte-nom" type="button" ${lien} tabindex="${sel ? "-1" : "0"}">${esc(a.nom || "Article sans nom")}</button>
        <p class="carte-couleur">${esc(a.couleur || COULEUR[a.teinte]?.nom || "")}${freres.length > 1 ? ` · ${freres.length} coloris` : ""}</p>
        ${prixHTML(a)}
        ${pied ? `<div class="carte-pied">${pied}</div>` : ""}
        ${manque.length ? `<p class="manques">À compléter : ${manque.join(", ")}</p>` : ""}
      </div>
    </article>`;
  }
  const rail = (titre, articles, lien) => articles.length ? `<section class="section-accueil">
      <div class="section-tete"><h2>${esc(titre)}</h2>${lien ? `<button class="lien" type="button" data-route="${esc(lien)}">Tout voir</button>` : ""}</div>
      <div class="rail">${articles.map(a => carte(a)).join("")}</div>
    </section>` : "";

  function tuileCategorie(c, n) {
    const a = idx().liste.filter(x => x.categorie === c.id && x.photos.length).sort((x, y) => scorePertinence(y) - scorePertinence(x) || x.id.localeCompare(y.id))[0];
    return `<button class="tuile" type="button" data-route="liste:categorie:${c.id}">
      <span class="tuile-visuel">${a ? `<img src="${esc(photoSrc(a.photos[0]))}" alt="" loading="lazy">` : `<span class="monogramme">${esc(c.nom)}</span>`}</span>
      <span class="tuile-nom">${esc(c.nom)} <span>${n}</span></span>
    </button>`;
  }
  const chargementHTML = () => `<div class="chargement" aria-label="Chargement du catalogue"><div></div><div></div><div></div><div></div></div>`;

  // ---------- page : accueil ----------
  function vedettes(n) {
    const avec = idx().liste.filter(a => a.photos.length).sort((x, y) => scorePertinence(y) - scorePertinence(x) || x.id.localeCompare(y.id));
    const choisis = [], cats = new Set();
    for (const a of avec) { if (choisis.length >= n) break; if (!cats.has(a.categorie)) { choisis.push(a); cats.add(a.categorie); } }
    for (const a of avec) { if (choisis.length >= n) break; if (!choisis.includes(a)) choisis.push(a); }
    return choisis;
  }
  function pageAccueil() {
    if (!S.charge) return chargementHTML();
    const I = idx(), L = I.liste;
    const saison = S.reglages.saisonCourante || saisonParDefaut();
    if (!L.length) {
      return `<section class="hero"><div class="hero-texte"><p class="surtitre">${esc(saison)}</p><h1>La collection Homme</h1>
        <p class="discret">Le rayon est vide. Ajoute les articles un par un : chacun aura sa fiche, ses filtres et tes remarques, comme sur un site de marque.</p>
        ${C.peutEcrire ? `<div class="hero-cta"><button class="btn plein" type="button" data-action="ajouter">Ajouter le premier article</button></div>` : ""}</div></section>`;
    }
    const photos = vedettes(3);
    const nbMarques = Object.keys(I.marques).length;
    const nouveautes = trier(L.filter(estNouveau), "nouveautes").slice(0, 12);
    const coups = trier(L.filter(a => a.coupDeCoeur), "pertinence").slice(0, 12);
    const promos = trier(L.filter(enPromo), "pertinence").slice(0, 12);
    const vus = articlesVus().slice(0, 12);
    const categories = CATEGORIES.filter(c => I.parCat[c.id]);
    const aCompleter = C.peutEcrire ? L.filter(a => manques(a).length) : [];
    const compteManque = m => aCompleter.filter(a => manques(a).includes(m)).length;
    return `<section class="hero">
        <div class="hero-texte">
          <p class="surtitre">${esc(saison)}</p>
          <h1>La collection Homme</h1>
          <p class="discret">${pluriel(L.length, "article")}${nbMarques ? `, ${pluriel(nbMarques, "marque")}` : ""}. Filtre par taille, coupe, couleur ou prix, et garde tes remarques sur chaque pièce.</p>
          <div class="hero-cta">
            <button class="btn plein" type="button" data-route="liste:tout">Voir tout le rayon</button>
            ${C.sample ? `<button class="btn contour" type="button" data-route="conseil">Conseiller un client</button>` : ""}
            ${nouveautes.length ? `<button class="btn contour" type="button" data-route="liste:nouveautes">Nouveautés</button>` : promos.length ? `<button class="btn contour" type="button" data-route="liste:promos">Promotions</button>` : ""}
          </div>
        </div>
        ${photos.length ? `<div class="hero-photos">${photos.map(a => `<button type="button" data-route="${esc("produit:" + a.id)}" aria-label="${esc(titreArticle(a))}"><img src="${esc(photoSrc(a.photos[0]))}" alt=""></button>`).join("")}</div>` : ""}
      </section>
      <section class="section-accueil">
        <div class="section-tete"><h2>Les catégories</h2></div>
        <div class="tuiles" style="--n:${Math.min(4, categories.length)}">${categories.map(c => tuileCategorie(c, I.parCat[c.id])).join("")}</div>
      </section>
      ${rail("Nouveautés", nouveautes, "liste:nouveautes")}
      ${rail("Coups de cœur", coups, "liste:coups")}
      ${rail("En promotion", promos, "liste:promos")}
      ${!nouveautes.length && !coups.length ? rail("Dans le rayon", trier(L, "pertinence").slice(0, 12), "liste:tout") : ""}
      ${rail("Vus récemment", vus)}
      <section class="section-accueil"><div class="section-tete"><h2>Mes outils</h2></div>
        <div class="raccourcis">
          <button class="raccourci" type="button" data-route="conseil"><strong>Conseiller un client</strong><span>Décris sa demande, Claude choisit dans le rayon</span></button>
          <button class="raccourci" type="button" data-route="stock"><strong>Stock et réassort</strong><span>${aReassortir().length ? pluriel(aReassortir().length, "article à réassortir", "articles à réassortir") : "Rien à réassortir"}</span></button>
          <button class="raccourci" type="button" data-route="remarques"><strong>Mes remarques</strong><span>${Object.keys(S.remarques).length ? pluriel(Object.keys(S.remarques).length, "remarque") : "Pas encore de remarque"}</span></button>
          <button class="raccourci" type="button" data-route="liste:favoris"><strong>Mes favoris</strong><span>${S.favoris.size ? pluriel(S.favoris.size, "article") : "Touche le cœur d'un article"}</span></button>
        </div>
      </section>
      ${nbMarques ? `<section class="section-accueil"><div class="section-tete"><h2>Les marques</h2></div>
        <div class="marques">${Object.entries(I.marques).sort((x, y) => alpha(x[0], y[0])).map(([m, n]) => `<button class="marque-tuile" type="button" data-route="${esc("liste:marque:" + m)}">${esc(m)} <span>${n}</span></button>`).join("")}</div></section>` : ""}
      ${aCompleter.length ? `<section class="section-accueil"><div class="a-completer">
          <div><p class="surtitre">Fiches à compléter</p><p>${pluriel(aCompleter.length, "article")} sans toutes leurs informations.</p>
          <ul>${[["photo", "sans photo"], ["prix", "sans prix"], ["tailles", "sans tailles"], ["marque", "sans marque"]].map(([m, t]) => compteManque(m) ? `<li>${compteManque(m)} ${t}</li>` : "").join("")}</ul></div>
          <button class="btn contour" type="button" data-route="liste:a-completer">Compléter les fiches</button>
        </div></section>` : ""}`;
  }

  // ---------- page : liste d'articles ----------
  function titreRoute(r) {
    switch (r.type) {
      case "section": return SECTION[r.valeur]?.nom || "Rayon";
      case "categorie": return CAT[r.valeur]?.nom || "Catégorie";
      case "marque": return r.valeur;
      case "nouveautes": return "Nouveautés";
      case "promos": return "Promotions";
      case "coups": return "Coups de cœur";
      case "favoris": return "Mes favoris";
      case "a-completer": return "Fiches à compléter";
      case "recherche": return "Recherche";
      default: return "Tout le rayon";
    }
  }
  function filHTML(r) {
    const morceaux = [`<li><button type="button" data-route="accueil">Accueil</button></li>`];
    if (r.page === "liste") {
      if (r.type === "categorie" && CAT[r.valeur]) { const s = SECTION[CAT[r.valeur].section]; morceaux.push(`<li><button type="button" data-route="liste:section:${s.id}">${esc(s.nom)}</button></li>`); }
      if (r.type === "marque") morceaux.push(`<li><button type="button" data-action="menu" data-menu="marques">Marques</button></li>`);
      morceaux.push(`<li aria-current="page">${esc(titreRoute(r))}</li>`);
    } else if (PAGES_OUTILS[r.page]) morceaux.push(`<li aria-current="page">${esc(PAGES_OUTILS[r.page])}</li>`);
    return `<nav aria-label="Fil d'Ariane"><ol class="fil">${morceaux.join("")}</ol></nav>`;
  }

  function facettesHTML(base, E) {
    return FACETTES.map(f => {
      const choix = E.filtres[f.id] || new Set();
      const comptes = new Map();
      for (const a of filtrer(base, E.filtres, f.id)) for (const v of unique(f.valeurs(a))) comptes.set(v, (comptes.get(v) || 0) + 1);
      for (const v of choix) if (!comptes.has(v)) comptes.set(v, 0);
      const vals = [...comptes.keys()].sort(f.ordre || alpha);
      // Un filtre reste affiché tant que la page offre au moins deux choix, même quand d'autres filtres le réduisent.
      const choixPage = unique(base.flatMap(a => f.valeurs(a))).length;
      if (!vals.length || (choixPage < 2 && !choix.size && !f.toujours)) return "";
      const ouvert = V.ouverts.has(f.id) || choix.size > 0;
      const bouton = (v, contenu, classe) => `<button type="button" class="${classe}" data-action="filtre" data-f="${f.id}" data-v="${esc(v)}" data-cle="${esc(`filtre:${f.id}:${v}`)}" aria-pressed="${choix.has(v)}">${contenu}</button>`;
      let corps;
      if (f.type === "couleur") corps = `<div class="couleurs-facette">${vals.map(v => bouton(v, `<span class="rond" style="background:${fondCouleur(v)}"></span>${esc(libelleFiltre(f, v))} <span class="discret">(${comptes.get(v)})</span>`, "pastille-filtre")).join("")}</div>`;
      else if (f.type === "taille") corps = `<div class="tailles-facette">${vals.map(v => bouton(v, esc(v), "taille-filtre")).join("")}</div>`;
      else corps = `<div class="options">${vals.map(v => bouton(v, `<span class="case"></span>${esc(libelleFiltre(f, v))}<span class="compte">${comptes.get(v)}</span>`, "option")).join("")}</div>`;
      return `<details class="facette" data-facette="${f.id}" ${ouvert ? "open" : ""}><summary>${esc(f.nom)}${choix.size ? `<span class="nb">${choix.size}</span>` : ""}</summary>${corps}</details>`;
    }).join("") || `<p class="discret petit" style="padding-top:12px">Pas de filtre pour ces articles.</p>`;
  }

  function videHTML(r, base) {
    if (base.length) return `<div class="vide-liste"><p>Aucun article ne correspond à ces filtres.</p><button class="btn contour" type="button" data-action="filtres-effacer">Effacer les filtres</button></div>`;
    const ajout = C.peutEcrire ? `<button class="btn plein" type="button" data-action="ajouter"${r.type === "categorie" ? ` data-categorie="${esc(r.valeur)}"` : ""}>Ajouter un article</button>` : "";
    const textes = {
      categorie: `Pas encore d'article dans « ${esc(CAT[r.valeur]?.nom || "")} ».`,
      section: `Pas encore d'article dans cette section.`,
      favoris: "Touche le cœur d'un article pour le retrouver ici.",
      nouveautes: `Aucune nouveauté. Un article reste « nouveau » ${S.reglages.joursNouveaute} jours après sa date d'arrivée en magasin.`,
      promos: "Aucun article en promotion. Indique un prix promo dans la fiche d'un article pour le voir ici.",
      coups: "Aucun coup de cœur. Coche « Coup de cœur » dans la fiche des articles à mettre en avant.",
      "a-completer": "Toutes les fiches sont complètes.",
      recherche: `Aucun résultat pour « ${esc(r.valeur || "")} ». Essaie une marque, une couleur, un modèle ou un mot d'une remarque.`,
    };
    return `<div class="vide-liste"><p>${textes[r.type] || "Aucun article pour l'instant."}</p>${["favoris", "promos", "coups", "a-completer", "nouveautes", "recherche"].includes(r.type) ? "" : ajout}</div>`;
  }

  function pageListe() {
    if (!S.charge) return chargementHTML();
    const r = V.route, E = etatListe(r);
    const base = baseDeRoute(r);
    const resultats = trier(filtrer(base, E.filtres), E.tri, r);
    const nbActifs = Object.values(E.filtres).reduce((n, s) => n + s.size, 0);
    // Pastilles de navigation : les catégories de la section, ou les catégories sœurs.
    let pastilles = "";
    const sectionId = r.type === "section" ? r.valeur : r.type === "categorie" ? CAT[r.valeur]?.section : null;
    if (sectionId) {
      const s = SECTION[sectionId];
      const cats = s.categories.filter(c => idx().parCat[c.id]);
      if (cats.length) pastilles = `<div class="sous-categories">${[
        `<button class="puce" type="button" data-route="liste:section:${s.id}" aria-pressed="${r.type === "section"}">Tout</button>`,
        ...cats.map(c => `<button class="puce" type="button" data-route="liste:categorie:${c.id}" aria-pressed="${r.type === "categorie" && r.valeur === c.id}">${esc(c.nom)} <span class="discret">${idx().parCat[c.id]}</span></button>`),
      ].join("")}</div>`;
    }
    const actifs = [];
    for (const f of FACETTES) for (const v of E.filtres[f.id] || []) actifs.push(`<button class="actif" type="button" data-action="filtre" data-f="${f.id}" data-v="${esc(v)}">${esc(f.nom)} : ${esc(libelleFiltre(f, v))} <span aria-hidden="true">×</span><span class="sr">(retirer)</span></button>`);
    if (actifs.length) actifs.push(`<button class="lien petit" type="button" data-action="filtres-effacer">Tout effacer</button>`);
    const visibles = resultats.slice(0, E.limite);
    const sousTitre = r.type === "recherche" ? `${pluriel(resultats.length, "résultat")} pour « ${esc(r.valeur)} »` : pluriel(resultats.length, "article");
    return `${filHTML(r)}
      <div class="liste-tete">
        <div><h1>${esc(titreRoute(r))}</h1><p class="discret">${sousTitre}</p></div>
        ${C.peutEcrire && r.type === "categorie" ? `<button class="btn leger" type="button" data-action="ajouter" data-categorie="${esc(r.valeur)}">+ Ajouter dans ${esc(CAT[r.valeur]?.nom || "")}</button>` : ""}
      </div>
      ${pastilles}
      <div class="liste-corps">
        <aside class="cote" aria-label="Filtres">${base.length ? facettesHTML(base, E) : ""}</aside>
        <div>
          <div class="barre-outils">
            <button class="btn leger btn-filtres" type="button" data-action="filtres">Filtrer${nbActifs ? ` (${nbActifs})` : ""}</button>
            ${C.peutEcrire && resultats.length ? `<button class="btn leger" type="button" data-action="selection" aria-pressed="${!!V.selection}">${V.selection ? "Terminer la sélection" : "Sélectionner"}</button>` : "<span></span>"}
            <div class="champ" style="grid-template-columns:auto auto;align-items:center"><label for="tri" class="discret">Trier par</label>
              <select id="tri">${TRIS.map(([v, t]) => `<option value="${v}"${E.tri === v ? " selected" : ""}>${t}</option>`).join("")}</select></div>
          </div>
          ${actifs.length ? `<div class="actifs">${actifs.join("")}</div>` : ""}
          <div class="grille">${visibles.map(a => carte(a, { manques: r.type === "a-completer", selection: V.selection })).join("") || videHTML(r, base)}</div>
          ${resultats.length > E.limite ? `<div class="plus"><p class="discret petit">${visibles.length} sur ${resultats.length}</p><button class="btn contour" type="button" data-action="plus" data-cle="plus">Afficher plus</button></div>` : ""}
        </div>
      </div>
      ${V.selection ? barreSelection(resultats) : ""}`;
  }

  // ---------- sélection de plusieurs articles ----------
  function barreSelection(resultats) {
    const n = [...V.selection].filter(id => S.articles[id]).length;
    const tous = resultats.length > 0 && resultats.every(a => V.selection.has(a.id));
    return `<div class="barre-selection" role="region" aria-label="Articles sélectionnés"><div class="conteneur barre-selection-in">
      <strong aria-live="polite">${n ? pluriel(n, "article sélectionné", "articles sélectionnés") : "Touche les articles à sélectionner"}</strong>
      <button class="btn leger" type="button" data-action="selection-tout">${tous ? "Tout désélectionner" : `Tout sélectionner (${resultats.length})`}</button>
      <button class="btn leger" type="button" data-action="serie"${n ? "" : " disabled"}>Modifier…</button>
      <button class="btn leger" type="button" data-action="comparer"${n >= 2 && n <= 4 ? "" : " disabled"} title="De 2 à 4 articles">Comparer</button>
      <button class="btn danger${V.armeSerie ? " arme" : ""}" type="button" data-action="selection-supprimer"${n ? "" : " disabled"}>${V.armeSerie ? `Confirmer la suppression (${n})` : "Supprimer"}</button>
      <button class="btn plein" type="button" data-action="selection">Terminer</button>
    </div></div>`;
  }
  function choisir(id) {
    if (!V.selection) return;
    if (V.selection.has(id)) V.selection.delete(id); else V.selection.add(id);
    V.armeSerie = false; render();
  }
  function toutChoisir() {
    if (!V.selection || V.route.page !== "liste") return;
    const resultats = filtrer(baseDeRoute(V.route), etatListe(V.route).filtres);
    if (resultats.every(a => V.selection.has(a.id))) V.selection.clear(); else for (const a of resultats) V.selection.add(a.id);
    V.armeSerie = false; render();
  }
  async function supprimerSelection() {
    if (!V.selection) return;
    if (!V.armeSerie) { V.armeSerie = true; render(); return; }
    const ids = [...V.selection].filter(id => S.articles[id]);
    V.armeSerie = false; V.selection = new Set();
    render();
    const supprimes = [];
    for (const id of ids) { const s = await supprimerArticle(id); if (s) supprimes.push(s); }
    render();
    annoncerSuppression(supprimes);
  }
  function ouvrirComparaison() {
    const ids = [...(V.selection || [])].filter(id => S.articles[id]).slice(0, 4);
    if (ids.length < 2) return;
    V.comparaison = ids;
    aller({ page: "comparer" });
  }

  // Modifier toute la sélection : promo, collection, arrivée, mise en avant, stock.
  function serieHTML() {
    const n = V.selection ? V.selection.size : 0;
    return `<div class="dialogue-voile"><div class="dialogue" role="dialog" aria-modal="true" aria-labelledby="serie-titre" style="max-width:640px">
      <div class="dialogue-tete"><h2 id="serie-titre" tabindex="-1">Modifier ${pluriel(n, "article")}</h2><button class="icone" type="button" data-action="fermer" aria-label="Fermer">${SVG.croix}</button></div>
      <div class="dialogue-corps">
        <section class="groupe"><h3>Promotion</h3>
          <div class="ligne-serie">
            <div class="champ"><label for="serie-remise">Remise (%)</label><input type="number" id="serie-remise" min="1" max="90" step="1" inputmode="numeric" placeholder="30"></div>
            <button class="btn plein" type="button" data-action="serie-appliquer" data-quoi="remise">Appliquer la remise</button>
            <button class="btn leger" type="button" data-action="serie-appliquer" data-quoi="sans-promo">Retirer la promo</button>
          </div>
          <p class="discret petit">Le prix promo est calculé sur le prix de chaque article ; ceux sans prix sont laissés de côté.</p>
        </section>
        <section class="groupe"><h3>Collection</h3>
          <div class="ligne-serie">
            <div class="champ"><label for="serie-saison">Collection</label><input type="text" id="serie-saison" list="dl-serie-saisons" value="${esc(S.reglages.saisonCourante || saisonParDefaut())}"><datalist id="dl-serie-saisons">${SAISONS().map(x => `<option value="${esc(x)}"></option>`).join("")}</datalist></div>
            <button class="btn plein" type="button" data-action="serie-appliquer" data-quoi="saison">Appliquer</button>
          </div>
        </section>
        <section class="groupe"><h3>Arrivée en magasin</h3>
          <div class="ligne-serie">
            <div class="champ"><label for="serie-arrivee">Date d'arrivée</label><input type="date" id="serie-arrivee" value="${aujourdhui()}"></div>
            <button class="btn plein" type="button" data-action="serie-appliquer" data-quoi="arrivee">Appliquer</button>
          </div>
          <p class="discret petit">Les articles passent en « Nouveauté » pendant ${S.reglages.joursNouveaute} jours.</p>
        </section>
        <section class="groupe"><h3>Mise en avant et stock</h3>
          <div class="puces">
            <button class="btn leger" type="button" data-action="serie-appliquer" data-quoi="coeur-oui">Mettre en coup de cœur</button>
            <button class="btn leger" type="button" data-action="serie-appliquer" data-quoi="coeur-non">Retirer des coups de cœur</button>
            <button class="btn leger" type="button" data-action="serie-appliquer" data-quoi="stock-dispo">Toutes les tailles disponibles</button>
          </div>
        </section>
      </div>
      <div class="dialogue-pied"><span class="etat-form" id="serie-etat" role="status"></span><button class="btn leger" type="button" data-action="fermer">Fermer</button></div>
    </div></div>`;
  }
  let serieEnCours = false;
  async function appliquerSerie(quoi) {
    if (!V.selection || !V.selection.size || serieEnCours) return;
    const etat = t => { const el = $("#serie-etat"); if (el) el.textContent = t; };
    let p = 0, valeur = "";
    if (quoi === "remise") { p = parseInt($("#serie-remise").value, 10); if (!(p >= 1 && p <= 90)) { etat("Indique une remise entre 1 et 90 %."); $("#serie-remise").focus(); return; } }
    if (quoi === "saison") { valeur = texte($("#serie-saison").value, 60); if (!valeur) { etat("Indique une collection."); $("#serie-saison").focus(); return; } }
    if (quoi === "arrivee") { valeur = $("#serie-arrivee").value; if (!/^\d{4}-\d{2}-\d{2}$/.test(valeur)) { etat("Choisis une date."); $("#serie-arrivee").focus(); return; } }
    const maintenant = new Date().toISOString();
    const ops = [];
    let ignores = 0;
    for (const id of V.selection) {
      const avant = S.articles[id];
      if (!avant) continue;
      const a = { ...avant, tailles: avant.tailles.map(t => ({ ...t })) };
      if (quoi === "remise") { if (a.prix == null) { ignores++; continue; } a.prixPromo = arrondi(a.prix * (1 - p / 100)); }
      else if (quoi === "sans-promo") { if (a.prixPromo == null) continue; a.prixPromo = null; }
      else if (quoi === "saison") a.saison = valeur;
      else if (quoi === "arrivee") a.arrivee = valeur;
      else if (quoi === "coeur-oui" || quoi === "coeur-non") { const v = quoi === "coeur-oui"; if (a.coupDeCoeur === v) continue; a.coupDeCoeur = v; }
      else if (quoi === "stock-dispo") { if (!a.tailles.length) { ignores++; continue; } a.tailles = a.tailles.map(t => ({ t: t.t, e: "dispo" })); a.stockLe = maintenant; }
      a.modifieLe = maintenant;
      S.articles[id] = a;
      ops.push(["articles/" + id, serialiser(a)]);
    }
    invalider(); render();
    serieEnCours = true;
    etat("Enregistrement…");
    const r = await ecrireTout(ops, (i, n) => etat(`Enregistrement… ${i} sur ${n}`));
    serieEnCours = false;
    const raison = quoi === "remise" ? "sans prix" : "sans tailles notées";
    fermerCouches();
    toast(`${pluriel(r.ok, "article modifié", "articles modifiés")}${ignores ? `, ${ignores} ${raison} laissé${ignores > 1 ? "s" : ""} de côté` : ""}${r.echecs ? `, ${r.echecs} non enregistré${r.echecs > 1 ? "s" : ""}` : ""}`);
  }

  // ---------- page : fiche article ----------
  function completerLook(a, n = 4) {
    const choisis = a.complements.map(id => S.articles[id]).filter(Boolean).slice(0, n);
    if (choisis.length >= n) return choisis;
    const type = CAT[a.categorie]?.type;
    const cibles = { bas: ["haut", "dessus", "pieds"], haut: ["bas", "dessus", "pieds"], dessus: ["haut", "bas"], pieds: ["bas", "haut"], jogging: ["haut", "pieds"] }[type] || ["haut", "bas"];
    const score = x => (x.saison && x.saison === a.saison ? 2 : 0) + x.styles.filter(s => a.styles.includes(s)).length * 2 + (x.coupDeCoeur ? 1 : 0) + (x.photos.length ? 1 : 0) + (x.marque === a.marque ? 1 : 0);
    const autres = idx().liste.filter(x => x.id !== a.id && !choisis.includes(x) && cibles.includes(CAT[x.categorie]?.type) && etatStock(x) !== "rupture")
      .sort((x, y) => score(y) - score(x) || x.id.localeCompare(y.id));
    // Au plus deux pièces par catégorie, pour proposer une vraie tenue ; s'il n'y en a pas assez, on complète.
    const parCat = {};
    for (const x of autres) {
      if (choisis.length >= n) break;
      if ((parCat[x.categorie] || 0) >= 2) continue;
      parCat[x.categorie] = (parCat[x.categorie] || 0) + 1;
      choisis.push(x);
    }
    for (const x of autres) { if (choisis.length >= n) break; if (!choisis.includes(x)) choisis.push(x); }
    return choisis;
  }
  function similaires(a, n = 8) {
    const modele = cleModele(a);
    const score = x => (x.marque === a.marque ? 1 : 0) + x.styles.filter(s => a.styles.includes(s)).length + (cleModele(x) === modele ? -2 : 0)
      - (a.prix != null && x.prix != null ? Math.abs(x.prix - a.prix) / 100 : 0);
    return idx().liste.filter(x => x.id !== a.id && x.categorie === a.categorie).sort((x, y) => score(y) - score(x) || x.id.localeCompare(y.id)).slice(0, n);
  }
  const caracs = paires => { const p = paires.filter(([, v]) => v); return p.length ? `<dl class="caracs">${p.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}</dl>` : ""; };
  const accordeon = (id, titre, corps) => corps ? `<details class="accordeon" data-acc="${id}"${V.accordeons.has(id) ? " open" : ""}><summary>${esc(titre)}</summary><div class="corps">${corps}</div></details>` : "";

  function remarqueHTML(r, avecArticle = false) {
    const auteur = r.auteur && r.auteur !== C.moi ? C.noms[r.auteur] || "" : "";
    const peutModifier = C.peutEcrire && (!r.auteur || r.auteur === C.moi || C.proprio);
    const a = avecArticle ? S.articles[r.article] : null;
    const article = a ? `<button class="remarque-article" type="button" data-route="${esc("produit:" + a.id)}">${a.photos[0] ? `<img src="${esc(photoSrc(a.photos[0]))}" alt="" loading="lazy">` : `<span class="vide-photo"></span>`}<span><strong>${esc(a.marque)}</strong> ${esc(a.nom)}${a.couleur ? " · " + esc(a.couleur) : ""}</span></button>` : "";
    if (V.edition && V.edition.id === r.id) {
      return `<li class="remarque">${article}<label class="sr" for="remarque-edition">Modifier la remarque</label><textarea id="remarque-edition" rows="3">${esc(V.edition.texte)}</textarea>
        <div class="remarque-meta"><span></span><span class="rangee-actions"><button type="button" data-action="remarque-annuler">Annuler</button><button type="button" data-action="remarque-enregistrer" class="arme">Enregistrer</button></span></div></li>`;
    }
    const date = `${esc(dateHeure(r.date))}${r.modifieLe ? " (modifiée)" : ""}${auteur ? " · " + esc(auteur) : ""}`;
    return `<li class="remarque">${article}<p>${esc(r.texte)}</p><div class="remarque-meta"><span>${date}</span>${peutModifier
      ? `<span class="rangee-actions"><button type="button" data-action="remarque-modifier" data-id="${esc(r.id)}" data-cle="rm:${esc(r.id)}">Modifier</button><button type="button" data-action="remarque-suppr" data-id="${esc(r.id)}" data-cle="rs:${esc(r.id)}">Supprimer</button></span>` : ""}</div></li>`;
  }

  function pageProduit() {
    if (!S.charge) return chargementHTML();
    const a = S.articles[V.route.id];
    if (!a) return `${filHTML({ page: "accueil" })}<div class="vide-liste" style="margin-block:30px"><p>Cet article n'est plus dans le catalogue.</p><button class="btn plein" type="button" data-route="accueil">Retour à l'accueil</button></div>`;
    const cat = CAT[a.categorie], sec = cat ? SECTION[cat.section] : null;
    const edit = C.peutEcrire;
    const fil = [`<li><button type="button" data-route="accueil">Accueil</button></li>`,
      sec && `<li><button type="button" data-route="liste:section:${sec.id}">${esc(sec.nom)}</button></li>`,
      cat && `<li><button type="button" data-route="liste:categorie:${cat.id}">${esc(cat.nom)}</button></li>`,
      `<li aria-current="page">${esc(a.nom || "Article")}</li>`].filter(Boolean).join("");
    const i = Math.min(V.galerie, Math.max(0, a.photos.length - 1));
    const galerie = a.photos.length
      ? `<div class="galerie-principale"><button class="galerie-zoom" type="button" data-action="visionneuse" aria-label="Voir la photo en grand"><img src="${esc(photoSrc(a.photos[i]))}" alt="${esc(titreArticle(a))}${a.couleur ? ", " + esc(a.couleur) : ""}"></button>
          ${a.photos.length > 1 ? `<button class="galerie-fleche prec" type="button" data-action="photo-prec" aria-label="Photo précédente">${SVG.gauche}</button><button class="galerie-fleche suiv" type="button" data-action="photo-suiv" aria-label="Photo suivante">${SVG.droite}</button>` : ""}</div>
         ${a.photos.length > 1 ? `<div class="vignettes">${a.photos.map((p, j) => `<button class="vignette" type="button" data-action="galerie" data-i="${j}" data-cle="gal:${j}" aria-pressed="${j === i}" aria-label="Photo ${j + 1}"><img src="${esc(photoSrc(p))}" alt=""></button>`).join("")}</div>` : ""}`
      : `<div class="galerie-principale"><span class="sans-photo">${esc(a.marque || "")}<br>${edit ? "Pas encore de photo" : ""}</span></div>`;
    const freres = freresDe(a);
    const coloris = freres.length > 1 ? `<div><div class="option-tete"><span>Couleur : <strong>${esc(a.couleur || COULEUR[a.teinte]?.nom || "—")}</strong></span><span class="discret">${freres.length} coloris</span></div>
      <div class="coloris">${freres.map(f => `<button type="button" data-route="${esc("produit:" + f.id)}" aria-current="${f.id === a.id}" aria-label="${esc(f.couleur || "Coloris")}" title="${esc(f.couleur || "")}">${f.photos[0] ? `<img src="${esc(photoSrc(f.photos[0]))}" alt="">` : `<span class="rond-coloris"><span style="background:${fondCouleur(f.teinte)}"></span></span>`}</button>`).join("")}</div></div>`
      : `<p class="petit">Couleur : <strong>${esc(a.couleur || COULEUR[a.teinte]?.nom || "non renseignée")}</strong></p>`;
    const tailles = a.tailles.length
      ? `<div class="tailles">${a.tailles.map(t => V.stock && edit
          ? `<button type="button" class="taille ${t.e === "dispo" ? "" : t.e}" data-action="taille-etat" data-t="${esc(t.t)}" data-cle="stock:${esc(t.t)}" aria-label="${esc(t.t)} : ${ETATS[t.e]}. Toucher pour changer">${esc(t.t)}</button>`
          : `<span class="taille ${t.e === "dispo" ? "" : t.e}" title="${ETATS[t.e]}">${esc(t.t)}<span class="sr"> : ${ETATS[t.e]}</span></span>`).join("")}</div>
         <p class="legende"><span><span style="color:var(--moyen)">●</span> Dernières pièces</span><span>Barrée : rupture</span>${V.stock && edit ? "<span>Touche une taille : disponible, dernières pièces, rupture</span>" : ""}</p>`
      : `<p class="discret petit">Tailles pas encore renseignées.</p>`;
    const taillant = a.taillant ? `<p class="taillant"><strong>${esc(TAILLANT[a.taillant].nom)}.</strong> ${esc(TAILLANT[a.taillant].conseil)}</p>` : "";
    const fav = S.favoris.has(a.id);
    const rem = idx().remParArticle[a.id] || [];
    const description = (a.description ? a.description.split(/\n+/).map(p => `<p>${esc(p)}</p>`).join("") : "")
      + (a.points.length ? `<p class="etiquette">Les + produit</p><ul>${a.points.map(p => `<li>${esc(p)}</li>`).join("")}</ul>` : "");
    const look = completerLook(a);
    const proches = similaires(a);
    const vus = articlesVus(a.id).slice(0, 8);
    return `<nav aria-label="Fil d'Ariane"><ol class="fil">${fil}</ol></nav>
      ${V.pile.length ? `<p style="margin-top:8px"><button class="lien petit" type="button" data-action="retour">← Retour</button></p>` : ""}
      <div class="produit">
        <div class="galerie">${galerie}</div>
        <div class="infos">
          <div style="display:grid;gap:6px">
            ${a.marque ? `<p class="infos-marque"><button type="button" data-route="${esc("liste:marque:" + a.marque)}">${esc(a.marque)}</button></p>` : ""}
            <h1>${esc(a.nom || "Article sans nom")}</h1>
            ${a.ref ? `<p class="ref">Réf. ${esc(a.ref)}</p>` : ""}
          </div>
          ${prixHTML(a)}
          <div class="note-produit"><span class="etoiles" role="group" aria-label="Ma note">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="etoile${a.note && n <= a.note ? " pleine" : ""}" data-action="note" data-n="${n}" data-cle="note:${n}" aria-label="${n} sur 5" ${edit ? "" : "disabled"}>★</button>`).join("")}</span>
            <span>${a.note ? `Ma note : ${a.note} sur 5` : edit ? "Donne ta note" : "Pas encore noté"}</span></div>
          ${coloris}
          <div>
            <div class="option-tete"><span>Tailles</span>${edit && a.tailles.length ? `<button class="lien petit" type="button" data-action="stock">${V.stock ? "Terminer" : "Modifier le stock"}</button>` : ""}</div>
            ${tailles}${taillant}
          </div>
          <div class="actions-produit">
            <button class="btn ${fav ? "plein" : "contour"}" type="button" data-action="favori" data-id="${esc(a.id)}" data-cle="fav-fiche" aria-pressed="${fav}">${fav ? "Dans mes favoris" : "Ajouter aux favoris"}</button>
            ${edit ? `<button class="btn leger" type="button" data-action="modifier">Modifier</button><button class="btn leger" type="button" data-action="coloris">+ Autre coloris</button>` : ""}
            ${C.mode === "distant" ? `<button class="btn leger" type="button" data-action="copier-lien">Copier le lien</button>` : ""}
          </div>
          <section class="remarques" aria-labelledby="titre-remarques">
            <h2 id="titre-remarques">Mes remarques <span>${rem.length ? pluriel(rem.length, "remarque") : ""}</span></h2>
            ${edit ? `<div class="rapides">${REMARQUES_RAPIDES.map(t => `<button class="puce" type="button" data-action="remarque-rapide" data-t="${esc(t)}">${esc(t)}</button>`).join("")}</div>
              <div class="champ"><label class="sr" for="remarque-texte">Nouvelle remarque</label><textarea id="remarque-texte" rows="3" placeholder="Comment il taille, ce que disent les clients, quand il revient…">${esc(V.remarque[a.id] || "")}</textarea></div>
              <div><button class="btn plein" type="button" data-action="remarque-ajouter">Ajouter la remarque</button></div>` : ""}
            ${rem.length ? `<ul>${rem.map(remarqueHTML).join("")}</ul>` : `<p class="discret petit">${edit ? "Aucune remarque pour l'instant." : "Aucune remarque."}</p>`}
          </section>
          <div>
            ${accordeon("description", "Description", description || (edit ? `<p class="discret">Pas encore de description. <button class="lien" type="button" data-action="modifier">Ajoute-la</button>, ou laisse Claude la rédiger depuis le formulaire.</p>` : ""))}
            ${accordeon("composition", "Composition et entretien", caracs([["Matières", esc(a.matieres.join(", "))], ["Composition", esc(a.composition)], ["Entretien", esc(a.entretien)]]))}
            ${accordeon("coupe", "Coupe et détails", caracs([["Coupe", esc(a.coupe)], ["Taillant", esc(TAILLANT[a.taillant]?.nom || "")], ["Col", esc(a.encolure)], ["Manches", esc(a.manches)], ["Style", esc(a.styles.join(", "))]]))}
            ${accordeon("rayon", "Infos rayon", caracs([
              ["Catégorie", cat ? esc(cat.nom) : ""], ["Collection", esc(a.saison)], ["Arrivée", a.arrivee ? esc(dateLongue(a.arrivee)) : ""], ["Référence", esc(a.ref)],
              ["Fiche marque", a.lien ? `<a class="lien" href="${esc(a.lien)}" target="_blank" rel="noopener">${esc(a.site || "Voir la fiche")} ↗</a>` : ""],
              ["Ajouté le", a.creeLe ? esc(dateHeure(a.creeLe)) : ""],
            ]))}
          </div>
        </div>
      </div>
      ${look.length ? `<section class="section-produit"><h2>Complétez le look</h2><div class="rail">${look.map(x => carte(x)).join("")}</div></section>` : ""}
      ${proches.length ? `<section class="section-produit"><h2>Dans la même catégorie</h2><div class="rail">${proches.map(x => carte(x)).join("")}</div></section>` : ""}
      ${vus.length ? `<section class="section-produit"><h2>Vus récemment</h2><div class="rail">${vus.map(x => carte(x)).join("")}</div></section>` : ""}`;
  }

  // ---------- page : comparer ----------
  function pageComparer() {
    if (!S.charge) return chargementHTML();
    const articles = V.comparaison.map(id => S.articles[id]).filter(Boolean);
    const fil = filHTML({ page: "comparer" });
    if (articles.length < 2) return `${fil}<div class="vide-liste" style="margin-block:24px"><p>Choisis de 2 à 4 articles dans une liste avec « Sélectionner », puis touche « Comparer ».</p><button class="btn plein" type="button" data-route="liste:tout">Voir le rayon</button></div>`;
    const tiret = v => v ? esc(v) : "—";
    const lignesTableau = [
      ["Prix", a => prixHTML(a)],
      ["Couleur", a => tiret(a.couleur || COULEUR[a.teinte]?.nom)],
      ["Tailles disponibles", a => a.tailles.length ? esc(a.tailles.filter(t => t.e !== "rupture").map(t => t.t + (t.e === "faible" ? " (dernières)" : "")).join(", ") || "Aucune") : "—"],
      ["Taillant", a => tiret(TAILLANT[a.taillant]?.nom)],
      ["Coupe", a => tiret(a.coupe)],
      ["Matières", a => tiret(a.matieres.join(", "))],
      ["Composition", a => tiret(a.composition)],
      ["Col", a => tiret(a.encolure)],
      ["Manches", a => tiret(a.manches)],
      ["Style", a => tiret(a.styles.join(", "))],
      ["Collection", a => tiret(a.saison)],
      ["Ma note", a => a.note ? etoilesMini(a.note) : "—"],
      ["Les + produit", a => a.points.length ? `<ul>${a.points.slice(0, 3).map(p => `<li>${esc(p)}</li>`).join("")}</ul>` : "—"],
      ["Dernière remarque", a => tiret((idx().remParArticle[a.id] || [])[0]?.texte)],
    ];
    return `${fil}<div class="liste-tete"><div><h1>Comparer</h1><p class="discret">${pluriel(articles.length, "article")} côte à côte</p></div></div>
      <div class="tableau-defilant"><table class="comparaison">
        <thead><tr><th scope="col"><span class="sr">Caractéristique</span></th>${articles.map(a => `<th scope="col"><div class="comparaison-tete">
          <button type="button" class="comparaison-photo" data-route="${esc("produit:" + a.id)}" aria-label="${esc(titreArticle(a))}">${a.photos[0] ? `<img src="${esc(photoSrc(a.photos[0]))}" alt="">` : `<span class="sans-photo">${esc(a.marque)}</span>`}</button>
          <p class="carte-marque">${esc(a.marque || "Sans marque")}</p><button type="button" class="carte-nom" data-route="${esc("produit:" + a.id)}">${esc(a.nom)}</button>
          ${articles.length > 2 ? `<button type="button" class="lien petit" data-action="comparer-retirer" data-id="${esc(a.id)}">Retirer</button>` : ""}
        </div></th>`).join("")}</tr></thead>
        <tbody>${lignesTableau.map(([titre, f]) => `<tr><th scope="row">${titre}</th>${articles.map(a => `<td>${f(a)}</td>`).join("")}</tr>`).join("")}</tbody>
      </table></div>`;
  }

  // ---------- page : conseiller un client ----------
  const EXEMPLES_CONSEIL = [
    "Un jean confortable, pas trop serré, budget 100 €",
    "Un cadeau pour un homme de 30 ans, plutôt classique",
    "Une tenue pour un mariage à la campagne",
    "Un pull chaud qui ne gratte pas, en XL",
  ];
  // Le rayon résumé pour Claude : une ligne par article, avec ce qui compte pour conseiller.
  function resumeCatalogue(articles) {
    return articles.map(a => {
      const p = prixEffectif(a);
      const dispo = a.tailles.filter(t => t.e !== "rupture").map(t => t.t);
      const rem = (idx().remParArticle[a.id] || [])[0];
      return [a.id, titreArticle(a), CAT[a.categorie]?.nom, a.couleur || COULEUR[a.teinte]?.nom,
        p != null ? `${p} €${enPromo(a) ? ` en promo (au lieu de ${a.prix} €)` : ""}` : "prix non renseigné",
        a.tailles.length ? `tailles disponibles : ${dispo.join(" ") || "aucune"}` : "tailles non renseignées",
        a.coupe && `coupe ${a.coupe}`, a.matieres.join("/"), a.encolure, a.manches && `manches ${a.manches.toLowerCase()}`,
        a.styles.join("/"), a.saison, TAILLANT[a.taillant]?.nom, a.note && `ma note ${a.note}/5`,
        a.points[0] && a.points[0].slice(0, 90), rem && `remarque : ${rem.texte.slice(0, 100)}`].filter(Boolean).join(" | ");
    }).join("\n");
  }
  async function demanderConseil() {
    const c = V.conseil, demande = c.demande.trim();
    if (!demande) { $("#conseil-demande")?.focus(); return; }
    if (!C.sample) { c.erreur = "Claude répond sur la page publiée seulement."; render(); return; }
    if (c.ctl) c.ctl.abort();
    const ctl = c.ctl = new AbortController();
    c.enCours = true; c.erreur = ""; c.reponse = null;
    render();
    let liste = idx().liste.filter(a => !c.dispo || etatStock(a) !== "rupture");
    // Un très grand rayon : on garde les articles qui partagent le plus de mots avec la demande.
    if (liste.length > 600) {
      const mots = norm(demande).split(" ").filter(m => m.length > 2);
      liste = liste.map(a => [a, mots.filter(m => idx().recherche[a.id].includes(m)).length]).sort((x, y) => y[1] - x[1]).slice(0, 600).map(x => x[0]);
    }
    try {
      const r = await C.sample.json(`Tu es vendeur expert au rayon Homme d'un magasin de prêt-à-porter multimarque. Un client vient de dire ce qu'il cherche ; choisis les articles du rayon qui lui conviennent le mieux.
Demande du client : « ${demande} »
Articles du rayon, un par ligne (identifiant | article | catégorie | couleur | prix | tailles | détails) :
${resumeCatalogue(liste)}

Règles : ne propose que des identifiants de la liste ; respecte le budget, la taille et l'usage quand ils sont donnés ; si rien ne convient tout à fait, propose ce qui s'en approche le plus et dis-le dans le résumé.
Réponds uniquement avec un objet JSON :
{"resume": "une phrase sur ce que tu proposes", "articles": [{"id": "", "pourquoi": "une phrase à dire au client, en le vouvoyant"}], "avec": [{"id": "", "pourquoi": ""}], "questions": [""], "phrase": "une phrase d'accroche pour le client, en le vouvoyant"}
- articles : de 1 à 6 articles, du plus adapté au moins adapté
- avec : jusqu'à 3 articles à proposer en plus (vente complémentaire), différents des précédents
- questions : 2 ou 3 questions courtes à poser au client pour affiner`, { signal: ctl.signal });
      if (c.ctl !== ctl) return;
      const vus = new Set();
      const valides = l => (Array.isArray(l) ? l : []).filter(x => x && typeof x.id === "string" && S.articles[x.id] && !vus.has(x.id) && vus.add(x.id))
        .map(x => ({ id: x.id, pourquoi: texte(x.pourquoi, 300) }));
      c.reponse = { demande, resume: texte(r && r.resume, 400), articles: valides(r && r.articles).slice(0, 6), avec: valides(r && r.avec).slice(0, 3),
        questions: listeTextes(r && r.questions, 3, 200), phrase: texte(r && r.phrase, 300) };
      if (!c.reponse.articles.length) c.erreur = "Claude n'a trouvé aucun article qui convient : reformule ou élargis la demande.";
    } catch (e) {
      if (c.ctl !== ctl || (e && e.code === "cancelled")) return;
      c.erreur = messageClaude(e);
    } finally {
      if (c.ctl === ctl) { c.ctl = null; c.enCours = false; render(); }
    }
  }
  function pageConseil() {
    if (!S.charge) return chargementHTML();
    const c = V.conseil, rep = c.reponse;
    const proposition = x => { const a = S.articles[x.id]; return a ? `<div class="conseil-article">${carte(a)}${x.pourquoi ? `<p class="pourquoi">${esc(x.pourquoi)}</p>` : ""}</div>` : ""; };
    return `${filHTML({ page: "conseil" })}
      <div class="liste-tete"><div><h1>Conseiller un client</h1><p class="discret">Décris ce que cherche le client : Claude choisit dans tout le rayon et te dit quoi lui proposer.</p></div></div>
      <div class="conseil">
        <div class="champ"><label for="conseil-demande">Ce que cherche le client</label>
          <textarea id="conseil-demande" rows="3" placeholder="Ex. : un jean brut coupe droite, il fait du W32, budget 90 €">${esc(c.demande)}</textarea></div>
        <div class="puces">${EXEMPLES_CONSEIL.map(t => `<button class="puce" type="button" data-action="conseil-exemple" data-t="${esc(t)}">${esc(t)}</button>`).join("")}</div>
        <div class="rangee-actions">
          <button class="btn plein" type="button" data-action="conseil-demander" data-cle="conseil-demander"${c.enCours ? " disabled" : ""}>${c.enCours ? "Claude cherche…" : "Trouver les articles"}</button>
          <button class="option en-ligne" type="button" data-action="conseil-dispo" data-cle="conseil-dispo" aria-pressed="${c.dispo}"><span class="case"></span>Seulement ce qui est disponible</button>
        </div>
        ${C.mode !== "attente" && !C.sample ? `<p class="discret petit">Claude répond sur la page publiée seulement.</p>` : ""}
        ${c.erreur ? `<p class="erreur" role="alert">${esc(c.erreur)}</p>` : ""}
      </div>
      ${rep && rep.articles.length ? `<section class="section-produit" aria-live="polite">
          <h2>Pour « ${esc(rep.demande)} »</h2>
          ${rep.resume ? `<p class="resume-conseil">${esc(rep.resume)}</p>` : ""}
          ${rep.phrase ? `<p class="phrase-conseil">« ${esc(rep.phrase)} »</p>` : ""}
          ${rep.questions.length ? `<div><p class="surtitre">À lui demander</p><ul class="questions">${rep.questions.map(q => `<li>${esc(q)}</li>`).join("")}</ul></div>` : ""}
          <div class="grille large">${rep.articles.map(proposition).join("")}</div>
        </section>
        ${rep.avec.length ? `<section class="section-produit"><h2>À proposer avec</h2><div class="grille large">${rep.avec.map(proposition).join("")}</div></section>` : ""}` : ""}`;
  }

  // ---------- page : stock et réassort ----------
  const aReassortir = () => idx().liste.filter(a => a.tailles.some(t => t.e !== "dispo"));
  function groupesStock() {
    const L = trier(idx().liste, "marque");
    return [
      { titre: "En rupture", aide: "Toutes les tailles notées sont en rupture.", liste: L.filter(a => etatStock(a) === "rupture"), tailles: a => a.tailles },
      { titre: "Tailles manquantes", aide: "Ces tailles sont en rupture.", liste: L.filter(a => etatStock(a) !== "rupture" && a.tailles.some(t => t.e === "rupture")), tailles: a => a.tailles.filter(t => t.e === "rupture") },
      { titre: "Dernières pièces", aide: "Il reste peu de pièces dans ces tailles.", liste: L.filter(a => a.tailles.some(t => t.e === "faible")), tailles: a => a.tailles.filter(t => t.e === "faible") },
    ];
  }
  function pageStock() {
    if (!S.charge) return chargementHTML();
    const total = aReassortir().length;
    const sansTailles = idx().liste.filter(a => !a.tailles.length).length;
    const ligne = a => `<li class="ligne-stock">
        <button type="button" class="ligne-stock-photo" data-route="${esc("produit:" + a.id)}" aria-label="${esc(titreArticle(a))}">${a.photos[0] ? `<img src="${esc(photoSrc(a.photos[0]))}" alt="" loading="lazy">` : ""}</button>
        <div><p class="carte-marque">${esc(a.marque || "Sans marque")}</p><button type="button" class="carte-nom" data-route="${esc("produit:" + a.id)}">${esc(a.nom)}</button>
          <p class="discret petit">${esc(a.couleur)}${a.stockLe ? `${a.couleur ? " · " : ""}stock noté le ${esc(dateHeure(a.stockLe))}` : ""}</p>
          <div class="tailles-mini">${a.tailles.map(t => `<span class="taille-mini ${t.e}" title="${ETATS[t.e]}">${esc(t.t)}<span class="sr"> : ${ETATS[t.e]}</span></span>`).join("")}</div></div>
      </li>`;
    return `${filHTML({ page: "stock" })}
      <div class="liste-tete"><div><h1>Stock et réassort</h1>
        <p class="discret">${total ? `${pluriel(total, "article")} à surveiller, d'après le stock noté sur les fiches.` : "Rien à réassortir d'après le stock noté sur les fiches."}${sansTailles ? ` ${pluriel(sansTailles, "article")} sans tailles notées n'${sansTailles > 1 ? "apparaissent" : "apparaît"} pas ici.` : ""}</p></div>
        ${total ? `<button class="btn contour" type="button" data-action="stock-copier">Copier la liste pour mon responsable</button>` : ""}</div>
      ${groupesStock().map(g => g.liste.length ? `<section class="section-stock"><div class="section-tete"><h2>${g.titre} <span class="discret">${g.liste.length}</span></h2><p class="discret petit">${g.aide}</p></div>
        <ul class="liste-stock">${g.liste.map(ligne).join("")}</ul></section>` : "").join("")}
      ${total ? "" : `<div class="vide-liste"><p>Sur une fiche, « Modifier le stock » marque une taille en dernières pièces ou en rupture : l'article apparaît alors ici.</p></div>`}`;
  }
  function texteReassort() {
    const nom = a => `${titreArticle(a)}${a.couleur ? ", " + a.couleur : ""}`;
    const morceaux = [`Réassort rayon Homme du ${dateLongue(aujourdhui())}`];
    for (const g of groupesStock()) {
      if (!g.liste.length) continue;
      morceaux.push("", `${g.titre} :`, ...g.liste.map(a => `- ${nom(a)}${g.titre === "En rupture" ? "" : " : " + g.tailles(a).map(t => t.t).join(", ")}`));
    }
    return morceaux.join("\n");
  }

  // ---------- page : toutes mes remarques ----------
  function pageRemarques() {
    if (!S.charge) return chargementHTML();
    const toutes = Object.values(S.remarques).filter(r => S.articles[r.article]).sort((x, y) => y.date.localeCompare(x.date));
    const q = norm(V.filtreRemarques).split(" ").filter(Boolean);
    const liste = q.length ? toutes.filter(r => { const a = S.articles[r.article]; const t = norm(`${r.texte} ${titreArticle(a)} ${a.couleur}`); return q.every(m => t.includes(m)); }) : toutes;
    const visibles = liste.slice(0, V.limiteRemarques);
    const nbArticles = new Set(toutes.map(r => r.article)).size;
    return `${filHTML({ page: "remarques" })}
      <div class="liste-tete"><div><h1>Mes remarques</h1><p class="discret">${toutes.length ? `${pluriel(toutes.length, "remarque")} sur ${pluriel(nbArticles, "article")}, de la plus récente à la plus ancienne.` : "Aucune remarque pour l'instant."}</p></div></div>
      ${toutes.length ? `<div class="champ" style="max-width:520px;margin-bottom:6px"><label for="filtre-remarques">Chercher dans les remarques</label><input type="search" id="filtre-remarques" value="${esc(V.filtreRemarques)}" placeholder="Ex. : taille, réassort, retour, Levi's…" autocomplete="off"></div>` : ""}
      ${visibles.length ? `<ul class="journal">${visibles.map(r => remarqueHTML(r, true)).join("")}</ul>`
        : `<div class="vide-liste"><p>${toutes.length ? "Aucune remarque ne correspond." : "Sur chaque fiche article, note ce que tu sais : comment il taille, ce que disent les clients, quand il revient. Tout se retrouve ici."}</p></div>`}
      ${liste.length > visibles.length ? `<div class="plus"><p class="discret petit">${visibles.length} sur ${liste.length}</p><button class="btn contour" type="button" data-action="remarques-plus" data-cle="remarques-plus">Afficher plus</button></div>` : ""}`;
  }

  // ---------- photos en grand, lien direct, copie ----------
  function visionneuseHTML() {
    const a = V.route.page === "produit" && S.articles[V.route.id];
    if (!a || !a.photos.length) return "";
    const n = a.photos.length, i = Math.min(V.galerie, n - 1);
    return `<div class="visionneuse" role="dialog" aria-modal="true" aria-label="${esc(titreArticle(a))} : photo ${i + 1} sur ${n}">
      <img src="${esc(photoSrc(a.photos[i]))}" alt="${esc(titreArticle(a))}${a.couleur ? ", " + esc(a.couleur) : ""}">
      <button class="icone visionneuse-fermer" type="button" data-action="fermer" aria-label="Fermer">${SVG.croix}</button>
      ${n > 1 ? `<button class="icone visionneuse-prec" type="button" data-action="photo-prec" data-cle="v-prec" aria-label="Photo précédente">${SVG.gauche}</button>
        <button class="icone visionneuse-suiv" type="button" data-action="photo-suiv" data-cle="v-suiv" aria-label="Photo suivante">${SVG.droite}</button>
        <p class="visionneuse-compteur">${i + 1} / ${n}</p>` : ""}
    </div>`;
  }
  function changerPhoto(delta) {
    const a = V.route.page === "produit" && S.articles[V.route.id];
    if (!a || a.photos.length < 2) return;
    const n = a.photos.length;
    V.galerie = (Math.min(V.galerie, n - 1) + delta + n) % n;
    render();
    if (V.couche === "photo") renderCouches();
  }
  // Copier un texte ; si le presse-papiers est refusé, le texte s'affiche prêt à être sélectionné.
  async function copier(contenu, titre, confirmation) {
    try { await navigator.clipboard.writeText(contenu); toast(confirmation); }
    catch (_) {
      COPIE = { titre, contenu };
      ouvrirCouche("copie");
      $("#copie-texte")?.select();
    }
  }
  function copieHTML() {
    if (!COPIE) return "";
    return `<div class="dialogue-voile"><div class="dialogue" role="dialog" aria-modal="true" aria-labelledby="copie-titre" style="max-width:620px">
      <div class="dialogue-tete"><h2 id="copie-titre">${esc(COPIE.titre)}</h2><button class="icone" type="button" data-action="fermer" aria-label="Fermer">${SVG.croix}</button></div>
      <div class="dialogue-corps"><p class="discret petit">La copie automatique n'est pas possible ici : sélectionne le texte et copie-le.</p>
        <label class="sr" for="copie-texte">Texte à copier</label><textarea id="copie-texte" rows="${Math.min(14, COPIE.contenu.split("\n").length + 1)}" readonly>${esc(COPIE.contenu)}</textarea></div>
      <div class="dialogue-pied"><span class="etat-form"></span><button class="btn plein" type="button" data-action="fermer">Fermer</button></div>
    </div></div>`;
  }
  function copierLien() {
    const a = S.articles[V.route.id];
    if (a) copier(`${ADRESSE_PAGE}#p-${a.id}`, "Lien vers la fiche", "Lien copié : colle-le dans un message.");
  }

  // ---------- importer un tableur ----------
  // Titres de colonnes reconnus, dans l'ordre où ils sont essayés (« prix promo » avant « prix »).
  const COLONNES = [
    ["prixPromo", ["prix promo", "prix promotion", "prix solde", "promo"]],
    ["prix", ["prix", "prix de vente", "prix ttc", "pv", "tarif"]],
    ["teinte", ["famille de couleur"]],
    ["couleur", ["couleur", "coloris"]],
    ["marque", ["marque"]],
    ["nom", ["modele", "nom", "nom du modele", "article", "designation", "libelle", "produit"]],
    ["categorie", ["categorie", "sous-categorie", "famille", "type"]],
    ["tailles", ["tailles", "taille", "tailles disponibles"]],
    ["taillant", ["taillant"]],
    ["coupe", ["coupe"]],
    ["matieres", ["matieres", "matiere"]],
    ["composition", ["composition"]],
    ["encolure", ["col", "encolure"]],
    ["manches", ["manches"]],
    ["saison", ["collection", "saison"]],
    ["styles", ["style", "styles"]],
    ["arrivee", ["arrivee", "date d'arrivee", "date arrivee"]],
    ["ref", ["reference", "ref", "ref.", "code article", "sku", "ean"]],
    ["lien", ["lien", "url"]],
    ["description", ["description"]],
    ["points", ["les + produit", "points forts", "arguments"]],
    ["coupDeCoeur", ["coup de coeur"]],
    ["note", ["ma note", "note"]],
  ];
  function champDeColonne(titre) {
    const n = norm(titre).replace(/\s*\(.*\)$/, "");
    for (const [champ, alias] of COLONNES) if (alias.includes(n)) return champ;
    if (n.includes("promo") || n.includes("solde")) return "prixPromo";
    if (n.includes("prix")) return "prix";
    if (n.includes("couleur") || n.includes("coloris")) return n.includes("famille") ? "teinte" : "couleur";
    if (n.includes("marque")) return "marque";
    if (n.includes("categ")) return "categorie";
    if (n.includes("taille")) return "tailles";
    if (n.includes("modele") || n.includes("designation")) return "nom";
    if (n.startsWith("ref")) return "ref";
    return null;
  }
  // Une catégorie écrite librement (« Pull col polo », « Jean ») retrouve celle du rayon ; l'ordre compte.
  const MOTS_CATEGORIE = [
    [/pull|gilet|cardigan|maille/, "pulls"], [/t-?shirt|tee-shirt|debardeur/, "t-shirts"], [/chemise/, "chemises"], [/polo/, "polos"],
    [/sweat|hoodie/, "sweats"], [/manteau|parka|caban|trench/, "manteaux"], [/veste|blouson|bomber|doudoune|perfecto/, "vestes"],
    [/short|bermuda/, "shorts"], [/jogging|jogger|survet/, "joggings"], [/jean|denim/, "jeans"], [/pantalon|chino|cargo/, "pantalons"],
    [/boxer|calecon|slip|chaussette|sous-vetement/, "sous-vetements"], [/basket|sneaker|tennis/, "baskets"], [/boot|bottine/, "boots"],
    [/sandale|claquette|tong/, "sandales"], [/chaussure|derby|mocassin|richelieu/, "chaussures-ville"], [/ceinture/, "ceintures"],
    [/casquette|bonnet|chapeau/, "casquettes"], [/echarpe|gant|snood/, "echarpes"], [/sac|portefeuille|maroquinerie|sacoche/, "sacs"],
  ];
  function trouverCategorie(v) {
    const n = norm(v);
    if (!n) return "";
    const exacte = CATEGORIES.find(c => c.id === n || norm(c.nom) === n);
    if (exacte) return exacte.id;
    for (const [re, id] of MOTS_CATEGORIE) if (re.test(n)) return id;
    return "";
  }
  // « S, M, L (rupture), XL (dernières pièces) » : la forme de l'export, ou une simple liste.
  function lireTailles(v) {
    const s = String(v ?? "").trim();
    if (!s) return [];
    const morceaux = /[,;]/.test(s) ? s.split(/[,;]/) : s.split(/\s+/);
    return unique(morceaux.map(x => x.trim()).filter(Boolean)).map(x => {
      const m = x.match(/^(.+?)\s*\((.+)\)$/);
      const etat = m ? norm(m[2]) : "";
      return { t: (m ? m[1] : x).trim().slice(0, 20), e: /rupture/.test(etat) ? "rupture" : /derni|faible/.test(etat) ? "faible" : "dispo" };
    }).filter(x => x.t);
  }
  // Lignes d'un CSV ou d'un copier-coller de tableur (tabulations) ; guillemets et retours à la ligne gérés.
  function lireTableau(brut) {
    const t = String(brut ?? "").replace(/^﻿/, "");
    const premiere = t.split(/\r?\n/, 1)[0] || "";
    const sep = premiere.includes("\t") ? "\t" : premiere.split(";").length >= premiere.split(",").length ? ";" : ",";
    const lignesT = [];
    let ligne = [], champ = "", guillemets = false;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (guillemets) {
        if (c === '"') { if (t[i + 1] === '"') { champ += '"'; i++; } else guillemets = false; }
        else champ += c;
      } else if (c === '"' && champ === "") guillemets = true;
      else if (c === sep) { ligne.push(champ); champ = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && t[i + 1] === "\n") i++;
        ligne.push(champ); lignesT.push(ligne); ligne = []; champ = "";
      } else champ += c;
    }
    if (champ !== "" || ligne.length) { ligne.push(champ); lignesT.push(ligne); }
    return lignesT.filter(l => l.some(x => x.trim()));
  }
  function articleDepuisLigne(cellules, champs) {
    const v = {};
    champs.forEach((c, i) => { const x = cellules[i] == null ? "" : String(cellules[i]).trim(); if (c && x) v[c] = x; });
    const a = {};
    const parNom = (liste, x) => liste.find(y => norm(y) === norm(x));
    if (v.marque) a.marque = v.marque.slice(0, 80);
    if (v.nom) a.nom = v.nom.slice(0, 160);
    const cat = v.categorie ? trouverCategorie(v.categorie) : trouverCategorie(v.nom);
    if (cat) a.categorie = cat;
    if (v.couleur) a.couleur = v.couleur.slice(0, 60);
    const teinte = (v.teinte && (COULEURS.find(c => norm(c.nom) === norm(v.teinte))?.id || devinerCouleur(v.teinte))) || (v.couleur && devinerCouleur(v.couleur));
    if (teinte) a.teinte = teinte;
    if (v.prix) { const p = lireMontant(v.prix); if (p != null) a.prix = p; }
    if (v.prixPromo) { const p = lireMontant(v.prixPromo); if (p != null) a.prixPromo = p; }
    if (v.tailles) a.tailles = lireTailles(v.tailles);
    if (v.taillant) { const t = TAILLANTS.find(x => norm(x.nom) === norm(v.taillant) || x.id === norm(v.taillant)); if (t) a.taillant = t.id; }
    if (v.coupe) a.coupe = (parNom(COUPES, v.coupe) || v.coupe).slice(0, 60);
    if (v.matieres) { const m = v.matieres.split(/[,;/]/).map(x => parNom(MATIERES, x)).filter(Boolean); if (m.length) a.matieres = unique(m); }
    if (v.composition) a.composition = v.composition.slice(0, 200);
    if (v.encolure) { const e = parNom(ENCOLURES, v.encolure); if (e) a.encolure = e; }
    if (v.manches) { const m = parNom(MANCHES, v.manches); if (m) a.manches = m; }
    if (v.saison) a.saison = v.saison.slice(0, 60);
    if (v.styles) { const s = v.styles.split(/[,;/]/).map(x => parNom(STYLES, x)).filter(Boolean); if (s.length) a.styles = unique(s); }
    if (v.arrivee) { const d = lireDate(v.arrivee); if (d) a.arrivee = d; }
    if (v.ref) a.ref = v.ref.slice(0, 80);
    if (v.lien && /^https?:\/\//i.test(v.lien)) a.lien = v.lien.slice(0, 800);
    if (v.description) a.description = v.description.slice(0, 3000);
    if (v.points) a.points = v.points.split("|").map(x => x.trim()).filter(Boolean).slice(0, 20);
    if (v.coupDeCoeur) a.coupDeCoeur = /^(oui|x|1|vrai|true)$/i.test(v.coupDeCoeur);
    if (v.note) { const n = parseInt(v.note, 10); if (n >= 1 && n <= 5) a.note = n; }
    return a;
  }
  const cleImport = a => `${norm(a.marque)}|${norm(a.nom)}|${norm(a.couleur)}`;
  function analyserImport() {
    const tableau = lireTableau(IMP.texte);
    if (!tableau.length) { IMP.analyse = null; return; }
    const titres = tableau[0], champs = titres.map(champDeColonne), dejaVu = new Set();
    champs.forEach((c, i) => { if (c && dejaVu.has(c)) champs[i] = null; else if (c) dejaVu.add(c); });
    const existants = new Map(idx().liste.map(a => [cleImport(a), a]));
    const cles = new Set();
    const lignesAn = tableau.slice(1).map(cellules => {
      const a = articleDepuisLigne(cellules, champs);
      if (!a.nom) return { a, statut: "ignore", raison: "sans nom de modèle" };
      const cle = cleImport(a);
      if (cles.has(cle)) return { a, statut: "ignore", raison: "en double dans le tableur" };
      cles.add(cle);
      const existant = existants.get(cle);
      if (existant) return IMP.maj ? { a, statut: "maj", existant } : { a, statut: "ignore", raison: "déjà dans le rayon" };
      if (!a.categorie && IMP.categorie) a.categorie = IMP.categorie;
      if (!a.categorie) return { a, statut: "ignore", raison: "catégorie non reconnue" };
      return { a, statut: "nouveau" };
    });
    IMP.analyse = { titres, champs, lignes: lignesAn };
  }
  function ouvrirImport() {
    IMP = { texte: "", categorie: "", maj: true, analyse: null, envoi: false };
    ouvrirCouche("import");
  }
  async function lireFichierTexte(fichier) {
    const octets = await fichier.arrayBuffer();
    // Excel enregistre souvent ses CSV en Windows-1252 : on le lit ainsi quand l'UTF-8 ne passe pas.
    try { return new TextDecoder("utf-8", { fatal: true }).decode(octets); }
    catch (_) { return new TextDecoder("windows-1252").decode(octets); }
  }
  function importHTML() {
    if (!IMP) return "";
    const an = IMP.analyse, lignesAn = an ? an.lignes : [];
    const compte = st => lignesAn.filter(l => l.statut === st).length;
    const nNouveaux = compte("nouveau"), nMaj = compte("maj"), nIgnores = compte("ignore");
    const colonnes = an ? an.titres.map((t, i) => `<span class="colonne${an.champs[i] ? " reconnue" : ""}">${esc(t || "(sans titre)")}${an.champs[i] ? "" : " · ignorée"}</span>`).join("") : "";
    const statut = l => l.statut === "nouveau" ? "Nouveau" : l.statut === "maj" ? "Mis à jour" : `Ignoré : ${esc(l.raison)}`;
    const categorieLigne = l => CAT[l.a.categorie]?.nom || (l.statut === "maj" ? CAT[l.existant.categorie]?.nom : "") || "—";
    const apercu = lignesAn.length ? `<div class="tableau-defilant"><table class="apercu"><thead><tr><th>Marque</th><th>Modèle</th><th>Catégorie</th><th>Couleur</th><th>Prix</th><th>Tailles</th><th>Résultat</th></tr></thead>
      <tbody>${lignesAn.slice(0, 12).map(l => `<tr class="${l.statut}"><td>${esc(l.a.marque || "")}</td><td>${esc(l.a.nom || "—")}</td><td>${esc(categorieLigne(l))}</td><td>${esc(l.a.couleur || "")}</td><td>${l.a.prix != null ? euro(l.a.prix) : ""}</td><td>${esc((l.a.tailles || []).map(t => t.t).join(" "))}</td><td>${statut(l)}</td></tr>`).join("")}</tbody></table></div>
      ${lignesAn.length > 12 ? `<p class="discret petit">… et ${pluriel(lignesAn.length - 12, "autre ligne", "autres lignes")}.</p>` : ""}` : "";
    const aImporter = nNouveaux + nMaj;
    return `<div class="dialogue-voile"><div class="dialogue" role="dialog" aria-modal="true" aria-labelledby="import-titre">
      <div class="dialogue-tete"><h2 id="import-titre" tabindex="-1">Importer un tableur</h2><button class="icone" type="button" data-action="fermer" aria-label="Fermer">${SVG.croix}</button></div>
      <div class="dialogue-corps">
        <p class="discret">Une ligne par article, sous une ligne de titres : Marque, Modèle, Catégorie, Couleur, Prix, Tailles… Les colonnes de l'export du site (coupe, matières, collection, référence…) sont reconnues aussi : tu peux exporter, corriger dans Excel, puis réimporter.</p>
        <div class="champ"><label for="import-fichier">Fichier CSV</label><input type="file" id="import-fichier" accept=".csv,.tsv,.txt,text/csv,text/plain"></div>
        <div class="champ"><label for="import-texte">Ou colle ici les lignes copiées depuis Excel ou Google Sheets, titres compris</label>
          <textarea id="import-texte" rows="6" spellcheck="false" placeholder="Marque&#9;Modèle&#9;Catégorie&#9;Couleur&#9;Prix&#9;Tailles">${esc(IMP.texte)}</textarea></div>
        <div class="champs">
          <div class="champ"><label for="import-categorie">Quand la catégorie manque ou n'est pas reconnue</label><select id="import-categorie"><option value="">Ignorer la ligne</option>${SECTIONS.map(s => `<optgroup label="${esc(s.nom)}">${s.categories.map(c => `<option value="${c.id}"${IMP.categorie === c.id ? " selected" : ""}>Classer dans ${esc(c.nom)}</option>`).join("")}</optgroup>`).join("")}</select></div>
        </div>
        <button class="option" type="button" data-action="import-maj" data-cle="import-maj" aria-pressed="${IMP.maj}"><span class="case"></span>Mettre à jour les articles déjà dans le rayon (même marque, modèle et couleur)</button>
        ${colonnes ? `<div class="champ"><span class="etiquette">Colonnes trouvées</span><div class="colonnes">${colonnes}</div></div>` : ""}
        ${lignesAn.length ? `<p><strong>${pluriel(nNouveaux, "nouvel article", "nouveaux articles")}</strong>${nMaj ? `, ${pluriel(nMaj, "mise à jour", "mises à jour")}` : ""}${nIgnores ? `, ${pluriel(nIgnores, "ligne ignorée", "lignes ignorées")}` : ""}.</p>${apercu}`
          : IMP.texte.trim() ? `<p class="discret">Il faut une ligne de titres, puis au moins une ligne d'article.</p>` : ""}
      </div>
      <div class="dialogue-pied"><span class="etat-form" id="import-etat" role="status"></span><button class="btn leger" type="button" data-action="fermer">Annuler</button>
        <button class="btn plein" type="button" data-action="import-lancer"${aImporter && !IMP.envoi ? "" : " disabled"}>${IMP.envoi ? "Import en cours…" : aImporter ? `Importer (${aImporter})` : "Importer"}</button></div>
    </div></div>`;
  }
  let minuteurImport = null;
  function reanalyserImport() {
    clearTimeout(minuteurImport);
    minuteurImport = setTimeout(() => { if (!IMP || IMP.envoi) return; analyserImport(); renderCouches(); }, 250);
  }
  async function lancerImport() {
    const an = IMP && IMP.analyse;
    if (!an || IMP.envoi) return;
    const maintenant = new Date().toISOString();
    const ops = [];
    let nouveaux = 0, majs = 0;
    for (const l of an.lignes) {
      if (l.statut === "nouveau") {
        const a = lireArticle(null, { ...l.a, creeLe: maintenant, modifieLe: maintenant, stockLe: l.a.tailles ? maintenant : null });
        a.id = nouvelIdArticle(a);
        S.articles[a.id] = a; ops.push(["articles/" + a.id, serialiser(a)]); nouveaux++;
      } else if (l.statut === "maj" && S.articles[l.existant.id]) {
        const a = lireArticle(l.existant.id, { ...serialiser(S.articles[l.existant.id]), ...l.a, modifieLe: maintenant, ...(l.a.tailles ? { stockLe: maintenant } : {}) });
        S.articles[a.id] = a; ops.push(["articles/" + a.id, serialiser(a)]); majs++;
      }
    }
    if (!ops.length) return;
    invalider();
    IMP.envoi = true; renderCouches();
    const etat = t => { const el = $("#import-etat"); if (el) el.textContent = t; };
    const r = await ecrireTout(ops, (i, n) => etat(`Import… ${i} sur ${n}`));
    if (V.couche === "import") fermerCouches();
    render();
    toast([nouveaux && pluriel(nouveaux, "article ajouté", "articles ajoutés"), majs && pluriel(majs, "article mis à jour", "articles mis à jour"),
      r.echecs && `${r.echecs} non enregistré${r.echecs > 1 ? "s" : ""}`].filter(Boolean).join(", "));
  }

  // ---------- sauvegarde complète ----------
  async function sauvegarder() {
    if (!C.downloads) return;
    const donnees = { format: "rayon-homme", version: 1, date: new Date().toISOString(),
      articles: Object.fromEntries(Object.values(S.articles).map(a => [a.id, serialiser(a)])),
      remarques: Object.fromEntries(Object.values(S.remarques).map(r => [r.id, docRemarque(r)])),
      reglages: S.reglages };
    try { await C.downloads.save({ filename: `rayon-homme-sauvegarde-${aujourdhui()}.json`, data: new Blob([JSON.stringify(donnees)], { type: "application/json" }) }); }
    catch (e) { if (!e || e.code !== "declined") toast("La sauvegarde n'a pas pu être enregistrée."); }
  }
  const ID_VALIDE = /^(?!\.\.?$)[A-Za-z0-9_\-.~:@+]{1,200}$/;
  function ouvrirRestauration() {
    RES = { donnees: null, erreur: "", envoi: false };
    ouvrirCouche("restaurer");
  }
  async function lireSauvegarde(fichier) {
    try {
      const d = JSON.parse(await fichier.text());
      if (!d || d.format !== "rayon-homme" || !d.articles || typeof d.articles !== "object") throw new Error("format");
      const articles = Object.entries(d.articles).filter(([id]) => ID_VALIDE.test(id)).map(([id, v]) => lireArticle(id, v));
      const remarques = Object.entries(d.remarques || {}).filter(([id]) => ID_VALIDE.test(id)).map(([id, v]) => lireRemarque(id, v)).filter(Boolean);
      if (RES) { RES.donnees = { articles, remarques, reglages: d.reglages ? lireReglages(d.reglages) : null, date: texte(d.date, 40) }; RES.erreur = ""; }
    } catch (_) {
      if (RES) { RES.donnees = null; RES.erreur = "Ce fichier n'est pas une sauvegarde du Rayon Homme."; }
    }
    renderCouches();
  }
  function restaurerHTML() {
    if (!RES) return "";
    const d = RES.donnees;
    const remplaces = d ? d.articles.filter(a => S.articles[a.id]).length : 0;
    return `<div class="dialogue-voile"><div class="dialogue" role="dialog" aria-modal="true" aria-labelledby="restaurer-titre" style="max-width:620px">
      <div class="dialogue-tete"><h2 id="restaurer-titre" tabindex="-1">Restaurer une sauvegarde</h2><button class="icone" type="button" data-action="fermer" aria-label="Fermer">${SVG.croix}</button></div>
      <div class="dialogue-corps">
        <p class="discret">Remet les articles, les remarques et les réglages d'un fichier de sauvegarde. Les articles du rayon qui ne sont pas dans la sauvegarde restent tels quels. Les photos ne sont pas dans le fichier : elles restent dans la page.</p>
        <div class="champ"><label for="restaurer-fichier">Fichier de sauvegarde (.json)</label><input type="file" id="restaurer-fichier" accept=".json,application/json"></div>
        ${RES.erreur ? `<p class="erreur" role="alert">${esc(RES.erreur)}</p>` : ""}
        ${d ? `<p>${d.date ? `Sauvegarde du ${esc(dateHeure(d.date))} : ` : ""}${pluriel(d.articles.length, "article")}${remplaces ? ` (dont ${remplaces} remplacer${remplaces > 1 ? "ont" : "a"} ceux du rayon)` : ""}, ${pluriel(d.remarques.length, "remarque")}.</p>` : ""}
      </div>
      <div class="dialogue-pied"><span class="etat-form" id="restaurer-etat" role="status"></span><button class="btn leger" type="button" data-action="fermer">Annuler</button>
        <button class="btn plein" type="button" data-action="restaurer-lancer"${d && !RES.envoi ? "" : " disabled"}>${RES.envoi ? "Restauration…" : "Restaurer"}</button></div>
    </div></div>`;
  }
  async function lancerRestauration() {
    const d = RES && RES.donnees;
    if (!d || RES.envoi) return;
    RES.envoi = true; renderCouches();
    const ops = [];
    for (const a of d.articles) { S.articles[a.id] = a; ops.push(["articles/" + a.id, serialiser(a)]); }
    for (const r of d.remarques) { S.remarques[r.id] = r; ops.push(["remarques/" + r.id, docRemarque(r)]); }
    if (d.reglages) { S.reglages = d.reglages; ops.push(["site/reglages", d.reglages]); }
    invalider();
    const etat = t => { const el = $("#restaurer-etat"); if (el) el.textContent = t; };
    const r = await ecrireTout(ops, (i, n) => etat(`Restauration… ${i} sur ${n}`));
    if (V.couche === "restaurer") fermerCouches();
    render();
    toast(`Sauvegarde restaurée : ${pluriel(d.articles.length, "article")}, ${pluriel(d.remarques.length, "remarque")}${r.echecs ? `, ${r.echecs} non enregistré${r.echecs > 1 ? "s" : ""}` : ""}`);
  }

  // ---------- en-tête, méga-menu, pied de page ----------
  const NAV = [
    { id: "nouveautes", nom: "Nouveautés", route: "liste:nouveautes" },
    { id: "vetements", nom: "Vêtements", menu: true, route: "liste:section:vetements" },
    { id: "chaussures", nom: "Chaussures", menu: true, route: "liste:section:chaussures" },
    { id: "accessoires", nom: "Accessoires", menu: true, route: "liste:section:accessoires" },
    { id: "marques", nom: "Marques", menu: true },
    { id: "promos", nom: "Promotions", route: "liste:promos", classe: "promo" },
  ];
  $("#nav").innerHTML = NAV.map(n => `<li><button class="nav-item${n.classe ? " " + n.classe : ""}" type="button" data-nav="${n.id}"${n.menu ? ` aria-expanded="false" aria-controls="mega" aria-haspopup="true"` : ""}${n.route ? ` data-route="${n.route}"` : ` data-action="menu" data-menu="${n.id}"`}>${n.nom}</button></li>`).join("");

  function sectionActive() {
    const r = V.route;
    if (r.page === "produit") return CAT[S.articles[r.id]?.categorie]?.section || null;
    if (r.page !== "liste") return null;
    if (r.type === "section") return r.valeur;
    if (r.type === "categorie") return CAT[r.valeur]?.section || null;
    if (r.type === "marque") return "marques";
    return { nouveautes: "nouveautes", promos: "promos" }[r.type] || null;
  }
  function majEntete() {
    const actif = sectionActive();
    $$("#nav [data-nav]").forEach(b => {
      if (b.hasAttribute("aria-expanded")) b.setAttribute("aria-expanded", String(V.menu === b.dataset.nav));
      b.classList.toggle("actif", b.dataset.nav === actif);
    });
    const n = S.favoris.size, c = $("#nb-favoris");
    c.hidden = !n; c.textContent = n;
    $("#btn-ajouter").hidden = !(C.peutEcrire && S.charge);
    const b = $("#bandeau-texte");
    b.textContent = S.reglages.bandeau || `Catalogue de travail du rayon Homme${S.charge ? " · " + pluriel(idx().liste.length, "article") : ""}`;
    b.dataset.route = S.reglages.bandeau ? "liste:promos" : "liste:tout";
    renderMega();
  }

  function megaHTML(id) {
    const I = idx();
    if (id === "marques") {
      const m = Object.entries(I.marques).sort((x, y) => alpha(x[0], y[0]));
      return `<div class="conteneur mega-in"><ul class="mega-liste colonnes" style="grid-column:1 / 3">${m.length
        ? m.map(([nom, n]) => `<li><button class="mega-lien" type="button" data-route="${esc("liste:marque:" + nom)}">${esc(nom)} <span>${n}</span></button></li>`).join("")
        : `<li class="mega-note">Les marques apparaissent ici dès que tu ajoutes des articles.</li>`}</ul></div>`;
    }
    const s = SECTION[id]; if (!s) return "";
    const visuels = s.categories.filter(c => I.parCat[c.id]).sort((x, y) => I.parCat[y.id] - I.parCat[x.id]).slice(0, 2);
    return `<div class="conteneur mega-in">
      <ul class="mega-liste${s.categories.length > 8 ? " colonnes" : ""}">
        <li><button class="mega-lien tout" type="button" data-route="liste:section:${s.id}">Tout voir <span>${I.parSection[s.id] || 0}</span></button></li>
        ${s.categories.map(c => { const n = I.parCat[c.id] || 0; return `<li><button class="mega-lien${n ? "" : " vide"}" type="button" data-route="liste:categorie:${c.id}">${esc(c.nom)} <span>${n || ""}</span></button></li>`; }).join("")}
      </ul>
      <ul class="mega-liste">
        <li><p class="surtitre" style="margin-bottom:6px">À la une</p></li>
        <li><button class="mega-lien" type="button" data-route="liste:section:${s.id}" data-preset="reperes:nouveau">Nouveautés</button></li>
        <li><button class="mega-lien" type="button" data-route="liste:section:${s.id}" data-preset="reperes:promo">En promotion</button></li>
        <li><button class="mega-lien" type="button" data-route="liste:section:${s.id}" data-preset="reperes:coeur">Coups de cœur</button></li>
        <li><button class="mega-lien" type="button" data-route="liste:section:${s.id}" data-preset="tri:note">Mieux notés</button></li>
      </ul>
      <div class="mega-visuels">${visuels.map(c => tuileCategorie(c, I.parCat[c.id])).join("") || `<p class="mega-note">Les photos des catégories apparaissent dès qu'elles ont des articles.</p>`}</div>
    </div>`;
  }
  function renderMega() {
    const m = $("#mega");
    if (!V.menu || !S.charge) { m.hidden = true; m.innerHTML = ""; return; }
    m.innerHTML = megaHTML(V.menu);
    m.hidden = false;
  }
  function ouvrirMenu(id) {
    if (V.menu === id) return;
    V.menu = id;
    majEntete();
  }

  function renderPied() {
    const I = S.charge ? idx() : null;
    const marques = I ? Object.entries(I.marques).sort((x, y) => y[1] - x[1] || alpha(x[0], y[0])).slice(0, 8) : [];
    const lien = (route, t) => `<li><button type="button" data-route="${esc(route)}">${esc(t)}</button></li>`;
    $("#pied").innerHTML = `
      <div><h2>Le rayon</h2><ul>${lien("liste:nouveautes", "Nouveautés")}${SECTIONS.map(s => lien("liste:section:" + s.id, s.nom)).join("")}${lien("liste:promos", "Promotions")}${lien("liste:tout", "Tout le rayon")}</ul></div>
      ${marques.length ? `<div><h2>Marques</h2><ul>${marques.map(([m]) => lien("liste:marque:" + m, m)).join("")}</ul></div>` : ""}
      <div><h2>Mes outils</h2><ul>${lien("conseil", "Conseiller un client")}${lien("stock", "Stock et réassort")}${lien("remarques", "Mes remarques")}${lien("liste:favoris", "Mes favoris")}${lien("liste:coups", "Coups de cœur")}</ul></div>
      ${C.peutEcrire ? `<div><h2>Gérer le catalogue</h2><ul><li><button type="button" data-action="ajouter">Ajouter un article</button></li><li><button type="button" data-action="importer">Importer un tableur</button></li>${lien("liste:a-completer", "Fiches à compléter")}
        ${C.downloads && I && I.liste.length ? `<li><button type="button" data-action="exporter">Exporter en tableur</button></li><li><button type="button" data-action="sauvegarder">Sauvegarder tout le catalogue</button></li>` : ""}
        <li><button type="button" data-action="restaurer">Restaurer une sauvegarde</button></li><li><button type="button" data-action="reglages">Réglages du site</button></li></ul></div>` : ""}`;
    const etat = C.mode === "local" ? "Enregistré sur cet appareil" : C.mode === "distant" ? (S.charge ? `${pluriel(I.liste.length, "article")} · à jour` : "Chargement…") : "Connexion…";
    $("#pied-etat").textContent = etat;
  }

  const PAGES = { produit: () => pageProduit(), liste: () => pageListe(), conseil: () => pageConseil(), stock: () => pageStock(), remarques: () => pageRemarques(), comparer: () => pageComparer() };
  function render() {
    majEntete();
    const r = V.route;
    remplacer($("#contenu"), (PAGES[r.page] || pageAccueil)());
    document.body.classList.toggle("avec-barre", !!V.selection && r.page === "liste");
    renderPied();
    if (V.couche === "filtres" || V.couche === "tiroir") renderCouches();
    resoudreNoms();
  }

  // ---------- couches : menu mobile, filtres, recherche, formulaire, réglages ----------
  function tiroirHTML() {
    const I = idx(), niv = V.tiroirNiveau;
    let corps;
    if (niv === "marques") {
      corps = `<button class="tiroir-retour" type="button" data-action="tiroir-niveau" data-v="">${SVG.gauche} Menu</button><p class="surtitre">Marques</p>
        ${Object.entries(I.marques).sort((x, y) => alpha(x[0], y[0])).map(([m, n]) => `<button class="tiroir-lien" type="button" data-route="${esc("liste:marque:" + m)}">${esc(m)} <span>${n}</span></button>`).join("") || `<p class="discret petit">Pas encore de marque.</p>`}`;
    } else if (niv && SECTION[niv]) {
      const s = SECTION[niv];
      corps = `<button class="tiroir-retour" type="button" data-action="tiroir-niveau" data-v="">${SVG.gauche} Menu</button><p class="surtitre">${esc(s.nom)}</p>
        <button class="tiroir-lien" type="button" data-route="liste:section:${s.id}">Tout voir <span>${I.parSection[s.id] || 0}</span></button>
        ${s.categories.map(c => `<button class="tiroir-lien" type="button" data-route="liste:categorie:${c.id}">${esc(c.nom)} <span>${I.parCat[c.id] || ""}</span></button>`).join("")}`;
    } else {
      const nbCompleter = C.peutEcrire ? I.liste.filter(a => manques(a).length).length : 0;
      corps = `<button class="tiroir-lien" type="button" data-route="liste:nouveautes">Nouveautés</button>
        ${SECTIONS.map(s => `<button class="tiroir-lien" type="button" data-action="tiroir-niveau" data-v="${s.id}">${esc(s.nom)} ${SVG.droite}</button>`).join("")}
        <button class="tiroir-lien" type="button" data-action="tiroir-niveau" data-v="marques">Marques ${SVG.droite}</button>
        <button class="tiroir-lien promo" type="button" data-route="liste:promos">Promotions</button>
        <p class="surtitre" style="margin-top:24px">Mes outils</p>
        <button class="tiroir-lien" type="button" data-route="conseil">Conseiller un client</button>
        <button class="tiroir-lien" type="button" data-route="stock">Stock et réassort <span>${aReassortir().length || ""}</span></button>
        <button class="tiroir-lien" type="button" data-route="remarques">Mes remarques <span>${Object.keys(S.remarques).length || ""}</span></button>
        <button class="tiroir-lien" type="button" data-route="liste:favoris">Mes favoris <span>${S.favoris.size || ""}</span></button>
        <button class="tiroir-lien" type="button" data-route="liste:tout">Tout le rayon <span>${I.liste.length}</span></button>
        ${C.peutEcrire ? `<p class="surtitre" style="margin-top:24px">Gérer le catalogue</p>
          <button class="tiroir-lien" type="button" data-action="ajouter">Ajouter un article</button>
          <button class="tiroir-lien" type="button" data-action="importer">Importer un tableur</button>
          <button class="tiroir-lien" type="button" data-route="liste:a-completer">Fiches à compléter <span>${nbCompleter || ""}</span></button>
          <button class="tiroir-lien" type="button" data-action="reglages">Réglages du site</button>` : ""}`;
    }
    return `<div class="voile" data-action="fermer"></div>
      <nav class="tiroir gauche" aria-label="Menu du rayon"><div class="tiroir-tete"><h2>Rayon Homme</h2><button class="icone" type="button" data-action="fermer" aria-label="Fermer le menu">${SVG.croix}</button></div>
      <div class="tiroir-corps">${corps}</div></nav>`;
  }

  function filtresHTML() {
    const r = V.route;
    if (r.page !== "liste") return "";
    const E = etatListe(r), base = baseDeRoute(r), n = filtrer(base, E.filtres).length;
    return `<div class="voile" data-action="fermer"></div>
      <div class="tiroir droite" role="dialog" aria-modal="true" aria-labelledby="filtres-titre">
        <div class="tiroir-tete"><h2 id="filtres-titre">Filtrer</h2><button class="icone" type="button" data-action="fermer" aria-label="Fermer les filtres">${SVG.croix}</button></div>
        <div class="tiroir-corps">${facettesHTML(base, E)}</div>
        <div class="tiroir-pied"><button class="btn leger" type="button" data-action="filtres-effacer">Effacer</button><button class="btn plein" type="button" data-action="fermer">Voir ${pluriel(n, "article")}</button></div>
      </div>`;
  }

  function resultatsRechercheHTML() {
    const I = idx();
    const q = norm(V.recherche).split(" ").filter(Boolean);
    const mini = a => `<button class="mini" type="button" data-route="${esc("produit:" + a.id)}">${a.photos[0] ? `<img src="${esc(photoSrc(a.photos[0]))}" alt="" loading="lazy">` : `<span class="sans-photo" style="position:static;aspect-ratio:4/5;background:var(--fond-2)">${esc(a.marque || "")}</span>`}<span><strong>${esc(a.marque)}</strong> ${esc(a.nom)}</span><span class="discret">${esc(a.couleur)}${a.prix != null ? " · " + euro(prixEffectif(a)) : ""}</span></button>`;
    const claude = C.sample ? `<div class="demande-claude"><button class="btn contour" type="button" data-action="conseil-recherche">${q.length ? `Demander à Claude : « ${esc(V.recherche.trim())} »` : "Conseiller un client avec Claude"}</button>
      <span class="discret petit">Décris ce que cherche le client avec tes mots ; Claude choisit dans tout le rayon.</span></div>` : "";
    if (!q.length) {
      const cats = CATEGORIES.filter(c => I.parCat[c.id]).slice(0, 8);
      const vus = articlesVus().slice(0, 4);
      return `${claude}<div class="suggestions"><p class="surtitre">Catégories</p>${cats.map(c => `<button class="suggestion" type="button" data-route="liste:categorie:${c.id}">${esc(c.nom)} <span class="discret">(${I.parCat[c.id]})</span></button>`).join("") || `<p class="discret petit">Pas encore d'article.</p>`}</div>
        <div>${vus.length ? `<p class="surtitre" style="margin-bottom:10px">Vus récemment</p><div class="mini-articles">${vus.map(mini).join("")}</div>` : `<p class="discret">Cherche une marque, un modèle, une couleur, une matière ou un mot d'une de tes remarques.</p>`}</div>`;
    }
    const cats = CATEGORIES.filter(c => I.parCat[c.id] && q.every(m => norm(c.nom).includes(m))).slice(0, 5);
    const marques = Object.keys(I.marques).filter(m => q.every(x => norm(m).includes(x))).slice(0, 5);
    const route = { page: "liste", type: "recherche", valeur: V.recherche.trim() };
    const articles = trier(baseDeRoute(route), "pertinence", route);
    if (!cats.length && !marques.length && !articles.length) return `${claude}<p class="discret" style="grid-column:1 / -1">Aucun article ne contient tous ces mots${C.sample ? " : demande à Claude, il comprend les phrases" : ""}.</p>`;
    return `${claude}<div class="suggestions"${cats.length || marques.length ? "" : " hidden"}>
        ${cats.length ? `<p class="surtitre">Catégories</p>${cats.map(c => `<button class="suggestion" type="button" data-route="liste:categorie:${c.id}">${esc(c.nom)} <span class="discret">(${I.parCat[c.id]})</span></button>`).join("")}` : ""}
        ${marques.length ? `<p class="surtitre">Marques</p>${marques.map(m => `<button class="suggestion" type="button" data-route="${esc("liste:marque:" + m)}">${esc(m)} <span class="discret">(${I.marques[m]})</span></button>`).join("")}` : ""}
      </div>
      <div style="display:grid;gap:16px;align-content:start${cats.length || marques.length ? "" : ";grid-column:1 / -1"}">
        ${articles.length ? `<div class="mini-articles">${articles.slice(0, 8).map(mini).join("")}</div>
          <div><button class="btn plein" type="button" data-route="${esc("liste:recherche:" + V.recherche.trim())}">Voir ${articles.length > 1 ? `les ${articles.length} résultats` : "le résultat"}</button></div>` : `<p class="discret">Aucun article ne correspond.</p>`}
      </div>`;
  }
  function rechercheHTML() {
    return `<div class="voile" data-action="fermer"></div>
      <div class="recherche" role="dialog" aria-modal="true" aria-label="Rechercher dans le rayon"><div class="conteneur">
        <div class="recherche-barre">${SVG.loupe}<label class="sr" for="recherche-champ">Rechercher</label>
          <input type="search" id="recherche-champ" value="${esc(V.recherche)}" placeholder="Une marque, un modèle, une couleur, une remarque…" autocomplete="off" enterkeyhint="search">
          <button class="btn leger" type="button" data-action="fermer">Fermer</button></div>
        <div class="recherche-resultats" id="recherche-resultats">${S.charge ? resultatsRechercheHTML() : ""}</div>
      </div></div>`;
  }

  function renderCouches() {
    const el = $("#couches");
    if (!V.couche) { el.innerHTML = ""; return; }
    const html = { tiroir: tiroirHTML, filtres: filtresHTML, recherche: rechercheHTML, form: formHTML, reglages: reglagesHTML, serie: serieHTML,
      import: importHTML, restaurer: restaurerHTML, copie: copieHTML, photo: visionneuseHTML }[V.couche];
    remplacer(el, html ? html() : "");
  }
  function ouvrirCouche(nom) {
    if (!V.couche) V.retourFocus = document.activeElement;
    V.couche = nom; V.menu = null;
    document.body.classList.add("bloque");
    majEntete();
    renderCouches();
    const premier = { recherche: "#recherche-champ", tiroir: ".tiroir-lien", filtres: ".tiroir .icone", serie: "#serie-titre", import: "#import-titre",
      restaurer: "#restaurer-titre", copie: "#copie-texte", photo: ".visionneuse-fermer" }[nom];
    if (premier) $(premier, $("#couches"))?.focus();
  }
  function fermerCouches({ sansFocus = false } = {}) {
    if (!V.couche) return;
    if (F) { F.analyse?.abort(); F.redaction?.abort(); for (const p of F.photos) if (p.url) URL.revokeObjectURL(p.url); }
    F = null; R = null; IMP = null; RES = null; COPIE = null;
    V.couche = null;
    document.body.classList.remove("bloque");
    $("#couches").innerHTML = "";
    if (!sansFocus && V.retourFocus && document.contains(V.retourFocus)) V.retourFocus.focus();
    V.retourFocus = null;
  }

  // ---------- formulaire d'article ----------
  const CLES_TEXTE = { "form-marque": "marque", "form-nom": "nom", "form-couleur": "couleur", "form-coupe": "coupe", "form-saison": "saison", "form-arrivee": "arrivee",
    "form-composition": "composition", "form-entretien": "entretien", "form-description": "description", "form-ref": "ref", "form-lien": "lien" };

  function ouvrirFormulaire(id, opts = {}) {
    const existant = id && S.articles[id];
    let a;
    if (existant) a = JSON.parse(JSON.stringify(existant));
    else if (opts.coloris) {
      // Un nouveau coloris reprend tout le modèle, sauf ce qui change d'une couleur à l'autre.
      a = { ...JSON.parse(JSON.stringify(opts.coloris)), id: null, couleur: "", teinte: "", photos: [], ref: "", lien: "", site: "", note: null, coupDeCoeur: false, creeLe: null, modifieLe: null, arrivee: aujourdhui() };
      a.tailles = a.tailles.map(t => ({ t: t.t, e: "dispo" }));
    } else {
      a = articleVide();
      const base = opts.base || lireStockage(CLE_DERNIER, {}) || {};
      a.marque = texte(base.marque, 80);
      a.categorie = CAT[opts.categorie] ? opts.categorie : CAT[base.categorie] ? base.categorie : "";
      a.saison = texte(base.saison, 60) || S.reglages.saisonCourante || saisonParDefaut();
      a.styles = listeTextes(base.styles, 12, 40);
      if (opts.base) a.tailles = opts.base.tailles.map(t => ({ t: t.t, e: "dispo" }));
      a.arrivee = aujourdhui();
    }
    F = { id: existant ? id : null, a, photos: a.photos.map(ref => ({ ref })), retirees: [], points: a.points.join("\n"), colorisTexte: "", modifie: false, envoi: false,
      message: opts.message || "", erreur: false, analyse: null, redaction: null, armeSuppr: false, armeFermer: false,
      teinteManuelle: !!a.teinte, coloris: !!opts.coloris, look: "", tailleLibre: "" };
    if (!V.couche) V.retourFocus = document.activeElement;
    V.couche = "form"; V.menu = null;
    document.body.classList.add("bloque");
    majEntete();
    renderCouches();
    // Sur ordinateur, le curseur va dans le premier champ utile ; au toucher, le clavier ne s'ouvre pas tout seul.
    const premier = !survol.matches ? "#form-titre" : existant ? "#form-nom" : opts.coloris ? "#form-couleur" : a.marque ? "#form-nom" : "#form-marque";
    $(premier)?.focus({ preventScroll: true });
  }
  function renderForm() { if (V.couche === "form" && F) renderCouches(); }
  function etatForm(message, erreur = false) {
    if (!F) return;
    F.message = message; F.erreur = erreur;
    const el = $("#form-etat");
    if (el) { el.textContent = message; el.classList.toggle("erreur", erreur); }
  }

  function formHTML() {
    const a = F.a, type = CAT[a.categorie]?.type;
    const titre = F.id ? "Modifier l'article" : F.coloris ? "Nouveau coloris" : "Nouvel article";
    const puce = (f, v, presse, libelle, attrs = "") => `<button type="button" class="puce" data-f="${f}" data-v="${esc(v)}" data-cle="${esc(`${f}:${v}`)}" aria-pressed="${presse}"${attrs}>${esc(libelle)}</button>`;
    const gamme = GAMMES[type] || LETTRES;
    const tailles = unique([...gamme, ...a.tailles.map(t => t.t)]).sort(comparerTailles);
    const lookChoisis = a.complements.map(id => S.articles[id]).filter(Boolean);
    const occupe = F.envoi ? " disabled" : "";
    const photos = F.photos.map((p, i) => `<div class="photo-form"><div class="cadre"><img src="${esc(p.url || photoSrc(p.ref))}" alt="Photo ${i + 1}"></div>
      <div class="outils">${i ? `<button type="button" data-f="photo-premiere" data-v="${i}" data-cle="pp:${i}">Principale</button>` : `<span class="discret">Principale</span>`}<button type="button" data-f="photo-retirer" data-v="${i}" data-cle="pr:${i}">Retirer</button></div></div>`).join("");
    const ajoutPhoto = C.assets
      ? `<label class="photo-ajout"><span>+ Ajouter des photos</span><input type="file" id="form-fichiers" accept="image/*" multiple></label>`
      : `<p class="discret petit">${C.mode === "local" ? "Les photos s'ajoutent sur la page publiée." : "Seules les personnes qui peuvent modifier la page ajoutent des photos."}</p>`;
    const claudePhoto = C.sample && C.sampleImages && F.photos.length
      ? `<div class="aide-claude"><button class="btn leger" type="button" data-f="claude-photo"${F.analyse ? " disabled" : ""}>${F.analyse ? "Claude regarde la photo…" : "Remplir avec Claude"}</button><span>Claude regarde tes photos (l'article, et l'étiquette si tu l'as photographiée : prix, référence, composition) et remplit les champs encore vides.</span></div>` : "";
    return `<div class="dialogue-voile" data-fond="form">
      <div class="dialogue" role="dialog" aria-modal="true" aria-labelledby="form-titre">
        <div class="dialogue-tete"><h2 id="form-titre" tabindex="-1">${titre}</h2><button class="icone" type="button" data-f="fermer" aria-label="Fermer">${SVG.croix}</button></div>
        <div class="dialogue-corps">
          ${F.id || F.coloris ? "" : `<p class="discret petit">Beaucoup d'articles à saisir ? <button class="lien" type="button" data-action="importer">Importe un tableur</button>.</p>`}
          <section class="groupe"><h3>Photos</h3>
            <div class="photos-form">${photos}${ajoutPhoto}</div>
            ${claudePhoto}
          </section>
          <section class="groupe"><h3>L'essentiel</h3>
            <div class="champs">
              <div class="champ"><label for="form-marque">Marque</label><input type="text" id="form-marque" list="dl-marques" value="${esc(a.marque)}" autocomplete="off"></div>
              <div class="champ"><label for="form-nom">Nom du modèle *</label><input type="text" id="form-nom" value="${esc(a.nom)}" placeholder="Ex. : Jean 502 Taper"></div>
              <div class="champ"><label for="form-categorie">Catégorie *</label><select id="form-categorie"><option value="">Choisir…</option>${SECTIONS.map(s => `<optgroup label="${esc(s.nom)}">${s.categories.map(c => `<option value="${c.id}"${a.categorie === c.id ? " selected" : ""}>${esc(c.nom)}</option>`).join("")}</optgroup>`).join("")}</select></div>
              <div class="champ"><label for="form-couleur">Couleur</label><input type="text" id="form-couleur" value="${esc(a.couleur)}" placeholder="Ex. : Bleu délavé"></div>
            </div>
            ${F.id ? "" : `<div class="champ"><label for="form-coloris">Créer aussi d'autres coloris (facultatif)</label><input type="text" id="form-coloris" value="${esc(F.colorisTexte)}" placeholder="Ex. : Noir, Bleu marine, Bordeaux" autocomplete="off">
              <p class="discret petit">Une fiche par couleur, avec les mêmes informations ; tu ajouteras leurs photos ensuite.</p></div>`}
            <div class="champ"><span class="etiquette" id="etiquette-teinte">Famille de couleur (pour le filtre)</span>
              <div class="pastilles-form" role="group" aria-labelledby="etiquette-teinte">${COULEURS.map(c => `<button type="button" class="pastille-form" data-f="teinte" data-v="${c.id}" data-cle="teinte:${c.id}" aria-pressed="${a.teinte === c.id}" aria-label="${c.nom}" title="${c.nom}" style="background:${c.hex}"></button>`).join("")}</div></div>
            <div class="champs">
              <div class="champ"><label for="form-prix">Prix (€)</label><input type="number" id="form-prix" min="0" step="0.01" inputmode="decimal" value="${a.prix ?? ""}"></div>
              <div class="champ"><label for="form-promo">Prix promo (€) <span class="discret" id="form-remise">${enPromo(a) ? `−${remise(a)} %` : ""}</span></label><input type="number" id="form-promo" min="0" step="0.01" inputmode="decimal" value="${a.prixPromo ?? ""}"></div>
            </div>
          </section>
          <section class="groupe"><h3>Tailles</h3>
            <div class="puces" role="group" aria-label="Tailles en rayon">${tailles.map(t => puce("taille", t, a.tailles.some(x => x.t === t), t)).join("")}</div>
            <div class="rangee" style="display:flex;gap:8px;flex-wrap:wrap;align-items:end">
              <div class="champ" style="flex:1 1 180px"><label for="form-taille-libre">Autre taille</label><input type="text" id="form-taille-libre" value="${esc(F.tailleLibre)}" placeholder="Ex. : 32/34, 85 cm"></div>
              <button class="btn leger" type="button" data-f="taille-ajout">Ajouter</button>
              <button class="btn leger" type="button" data-f="tailles-toutes">Toute la gamme</button>
              <button class="btn leger" type="button" data-f="tailles-aucune">Aucune</button>
            </div>
            <div class="champ"><span class="etiquette">Taillant</span><div class="puces">${TAILLANTS.map(t => puce("taillant", t.id, a.taillant === t.id, t.nom)).join("")}</div></div>
            <p class="discret petit">Le stock taille par taille se règle ensuite sur la fiche, avec « Modifier le stock ».</p>
          </section>
          <section class="groupe"><h3>Pour les filtres</h3>
            <div class="champs">
              <div class="champ"><label for="form-coupe">Coupe</label><input type="text" id="form-coupe" list="dl-coupes" value="${esc(a.coupe)}"></div>
              <div class="champ"><label for="form-saison">Collection</label><input type="text" id="form-saison" list="dl-saisons" value="${esc(a.saison)}"></div>
              <div class="champ"><label for="form-arrivee">Arrivée en magasin</label><input type="date" id="form-arrivee" value="${esc(a.arrivee)}"></div>
            </div>
            <div class="champ"><span class="etiquette">Matières</span><div class="puces">${MATIERES.map(m => puce("matiere", m, a.matieres.includes(m), m)).join("")}</div></div>
            ${!type || type === "haut" || type === "dessus" ? `<div class="champ"><span class="etiquette">Col</span><div class="puces">${ENCOLURES.map(e => puce("encolure", e, a.encolure === e, e)).join("")}</div></div>` : ""}
            ${!type || type === "haut" ? `<div class="champ"><span class="etiquette">Manches</span><div class="puces">${MANCHES.map(m => puce("manches", m, a.manches === m, m)).join("")}</div></div>` : ""}
            <div class="champ"><span class="etiquette">Style</span><div class="puces">${STYLES.map(s => puce("style", s, a.styles.includes(s), s)).join("")}</div></div>
            <div class="champ"><span class="etiquette">Mise en avant</span><div class="puces">${puce("coeur", "oui", a.coupDeCoeur, "Coup de cœur")}</div></div>
          </section>
          <section class="groupe"><h3>Pour vendre</h3>
            <div class="champ"><label for="form-description">Description</label><textarea id="form-description" rows="3">${esc(a.description)}</textarea></div>
            <div class="champ"><label for="form-points">Les + produit (un par ligne)</label><textarea id="form-points" rows="4">${esc(F.points)}</textarea></div>
            <div class="champs">
              <div class="champ"><label for="form-composition">Composition</label><input type="text" id="form-composition" value="${esc(a.composition)}" placeholder="Ex. : 98 % coton, 2 % élasthanne"></div>
              <div class="champ"><label for="form-entretien">Entretien</label><input type="text" id="form-entretien" value="${esc(a.entretien)}" placeholder="Ex. : lavage à 30 °C, sur l'envers"></div>
            </div>
            ${C.sample ? `<div class="aide-claude"><button class="btn leger" type="button" data-f="claude-texte"${F.redaction ? " disabled" : ""}>${F.redaction ? "Claude rédige…" : "Rédiger avec Claude"}</button><span>Description et « Les + produit », à partir des champs déjà remplis.</span></div>` : ""}
            <div class="champ"><span class="etiquette">Complétez le look</span>
              ${lookChoisis.length ? `<div class="puces">${lookChoisis.map(x => `<button type="button" class="puce" aria-pressed="true" data-f="look-retirer" data-v="${esc(x.id)}" data-cle="lr:${esc(x.id)}">${esc(titreArticle(x))}${x.couleur ? " · " + esc(x.couleur) : ""} ×</button>`).join("")}</div>` : `<p class="discret petit">Sans choix de ta part, la fiche propose des pièces qui vont avec.</p>`}
              <div class="recherche-look"><label class="sr" for="form-look">Chercher un article à associer</label><input type="search" id="form-look" value="${esc(F.look)}" placeholder="Chercher un article à associer…" autocomplete="off"><ul id="form-look-resultats">${lookResultatsHTML()}</ul></div>
            </div>
          </section>
          <section class="groupe"><h3>Références</h3>
            <div class="champs">
              <div class="champ"><label for="form-ref">Référence</label><input type="text" id="form-ref" value="${esc(a.ref)}"></div>
              <div class="champ"><label for="form-lien">Lien vers la fiche de la marque</label><input type="url" id="form-lien" value="${esc(a.lien)}" placeholder="https://…"></div>
            </div>
          </section>
          <datalist id="dl-marques">${Object.keys(idx().marques).sort(alpha).map(m => `<option value="${esc(m)}"></option>`).join("")}</datalist>
          <datalist id="dl-coupes">${COUPES.map(c => `<option value="${esc(c)}"></option>`).join("")}</datalist>
          <datalist id="dl-saisons">${unique([...SAISONS(), ...idx().liste.map(x => x.saison).filter(Boolean)]).map(s => `<option value="${esc(s)}"></option>`).join("")}</datalist>
        </div>
        <div class="dialogue-pied">
          <span class="etat-form${F.erreur ? " erreur" : ""}" id="form-etat" role="status">${esc(F.message)}</span>
          ${F.id ? `<button class="btn danger${F.armeSuppr ? " arme" : ""}" type="button" data-f="supprimer"${occupe}>${F.armeSuppr ? "Confirmer la suppression" : "Supprimer"}</button>`
            : `<button class="btn leger" type="button" data-f="enregistrer-autre"${occupe}>Enregistrer et ajouter un autre</button>`}
          <button class="btn plein" type="button" data-f="enregistrer"${occupe}>${F.id ? "Enregistrer" : "Ajouter au rayon"}</button>
        </div>
      </div>
    </div>`;
  }
  function lookResultatsHTML() {
    const q = norm(F.look).split(" ").filter(Boolean);
    if (!q.length) return "";
    const res = idx().liste.filter(x => x.id !== F.id && !F.a.complements.includes(x.id) && q.every(m => idx().recherche[x.id].includes(m))).slice(0, 6);
    return res.map(x => `<li><button type="button" data-f="look-ajouter" data-v="${esc(x.id)}">${esc(titreArticle(x))}${x.couleur ? " · " + esc(x.couleur) : ""} <span class="discret">${esc(CAT[x.categorie]?.nom || "")}</span></button></li>`).join("") || `<li class="discret petit">Aucun article ne correspond.</li>`;
  }
  const majPressions = (f, actif) => $$(`[data-f="${f}"]`, $("#couches")).forEach(b => b.setAttribute("aria-pressed", String(actif(b.dataset.v))));

  async function preparerPhoto(fichier) {
    const image = await new Promise((ok, ko) => {
      const url = URL.createObjectURL(fichier);
      const img = new Image();
      img.onload = () => ok({ img, url });
      img.onerror = () => { URL.revokeObjectURL(url); ko({ code: "photo" }); };
      img.src = url;
    });
    const { img, url } = image;
    const k = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight));
    const toile = document.createElement("canvas");
    toile.width = Math.round(img.naturalWidth * k); toile.height = Math.round(img.naturalHeight * k);
    toile.getContext("2d").drawImage(img, 0, 0, toile.width, toile.height);
    URL.revokeObjectURL(url);
    const blob = await new Promise(ok => toile.toBlob(ok, "image/jpeg", 0.82));
    if (!blob) throw { code: "photo" };
    return { blob, url: URL.createObjectURL(blob) };
  }
  async function ajouterPhotos(fichiers) {
    const liste = Array.from(fichiers || []).slice(0, 12 - F.photos.length);
    if (!liste.length) return;
    etatForm("Préparation des photos…");
    let echecs = 0;
    for (const f of liste) {
      try { const p = await preparerPhoto(f); if (!F) { URL.revokeObjectURL(p.url); return; } F.photos.push(p); }
      catch (_) { echecs++; }
    }
    if (!F) return;
    F.modifie = true;
    F.message = echecs ? `${pluriel(echecs, "photo")} n'a pas pu être lue (format non pris en charge).` : "";
    F.erreur = !!echecs;
    renderForm();
  }

  // Les photos du formulaire à montrer à Claude : celles qui viennent d'être choisies, ou déjà enregistrées.
  async function blobsPhotos(max) {
    const blobs = [];
    for (const p of F.photos.slice(0, max)) {
      if (p.blob) { blobs.push(p.blob); continue; }
      const r = await fetch(photoSrc(p.ref));
      if (r.ok) blobs.push(await r.blob());
    }
    if (!blobs.length) throw { code: "photo" };
    return blobs;
  }
  function messageClaude(e) {
    const c = e && e.code;
    if (c === "not_granted") return "Claude n'est pas autorisé pour cette page.";
    if (c === "rate_limited") return "Trop de demandes d'un coup : réessaie dans une minute.";
    if (c === "images_unavailable" || c === "image_rejected" || c === "photo") return "Claude ne peut pas lire cette photo ici.";
    if (c === "invalid_json") return "Claude n'a pas reconnu l'article : remplis les champs à la main.";
    return "Claude n'a pas pu répondre. Réessaie dans un instant.";
  }
  const PROMPT_PHOTO = n => `${n > 1 ? `Voici ${n} photos d'un même article` : "Voici la photo d'un article"} du rayon Homme d'un magasin de prêt-à-porter multimarque (vêtement, chaussures ou accessoire) : l'article lui-même, et parfois son étiquette de prix ou de composition. Identifie-le pour remplir sa fiche produit.
Réponds uniquement avec un objet JSON de cette forme :
{"categorie": "", "marque": "", "nom": "", "couleur": "", "teinte": "", "coupe": "", "matieres": [], "composition": "", "encolure": "", "manches": "", "styles": [], "description": "", "prix": null, "ref": ""}
- categorie : un identifiant parmi ${CATEGORIES.map(c => c.id).join(", ")}
- marque : seulement si un logo ou une étiquette est lisible, sinon ""
- nom : le nom du modèle s'il est lisible (ex. « Jean 502 Taper »), sinon un nom court et descriptif (ex. « Pull col rond en maille torsadée »)
- couleur : la couleur comme sur une étiquette, en français, courte (ex. « Bleu marine », « Écru »)
- teinte : la famille de couleur, un identifiant parmi ${COULEURS.map(c => c.id).join(", ")}
- coupe : une valeur parmi ${COUPES.join(", ")} si elle se voit, sinon ""
- matieres : des valeurs parmi ${MATIERES.join(", ")}, seulement si l'étiquette les indique ou si c'est évident (denim, cuir), sinon []
- composition : seulement si une étiquette de composition est lisible (ex. « 100 % coton »), sinon ""
- encolure : une valeur parmi ${ENCOLURES.join(", ")} pour un haut ou une veste, sinon ""
- manches : une valeur parmi ${MANCHES.join(", ")} pour un haut, sinon ""
- styles : jusqu'à 2 valeurs parmi ${STYLES.join(", ")}
- description : une ou deux phrases neutres qui décrivent ce qui se voit, sans inventer de caractéristique technique
- prix : le prix en euros (nombre) seulement s'il est lisible sur une étiquette, sinon null
- ref : la référence ou le code article seulement s'il est lisible sur une étiquette, sinon ""`;

  async function remplirAvecClaude() {
    if (!F || F.analyse || !C.sample) return;
    const pourForm = F, ctl = F.analyse = new AbortController();
    etatForm(""); renderForm();
    try {
      const blobs = await blobsPhotos(Math.max(1, Math.min(4, C.maxImages || 1)));
      const r = await C.sample.json(PROMPT_PHOTO(blobs.length), { images: blobs, signal: ctl.signal });
      if (F !== pourForm) return;
      const n = appliquerAnalyse(r);
      F.modifie = F.modifie || n > 0;
      F.message = n ? `Claude a rempli ${pluriel(n, "champ")} : vérifie avant d'enregistrer.` : "Claude n'a rien ajouté : les champs étaient déjà remplis, ou l'article n'est pas reconnu.";
      F.erreur = false;
    } catch (e) {
      if (F !== pourForm || (e && e.code === "cancelled")) return;
      F.message = messageClaude(e); F.erreur = true;
    } finally {
      if (F === pourForm) { F.analyse = null; renderForm(); }
    }
  }
  function appliquerAnalyse(r) {
    if (!r || typeof r !== "object" || Array.isArray(r)) return 0;
    const a = F.a;
    let n = 0;
    const remplir = (cle, v) => { if (v && !a[cle]) { a[cle] = v; n++; } };
    remplir("categorie", CAT[r.categorie] ? r.categorie : "");
    remplir("marque", texte(r.marque, 60));
    remplir("nom", texte(r.nom, 120));
    remplir("couleur", texte(r.couleur, 40));
    if (!a.teinte && COULEUR[r.teinte]) { a.teinte = r.teinte; n++; }
    remplir("coupe", COUPES.includes(r.coupe) ? r.coupe : "");
    if (!a.matieres.length) { const m = listeTextes(r.matieres).filter(x => MATIERES.includes(x)); if (m.length) { a.matieres = m; n++; } }
    remplir("composition", texte(r.composition, 120));
    if (a.prix == null) { const p = lireMontant(r.prix); if (p) { a.prix = p; n++; } }
    remplir("ref", texte(r.ref, 80));
    remplir("encolure", ENCOLURES.includes(r.encolure) ? r.encolure : "");
    remplir("manches", MANCHES.includes(r.manches) ? r.manches : "");
    if (!a.styles.length) { const s = listeTextes(r.styles).filter(x => STYLES.includes(x)).slice(0, 2); if (s.length) { a.styles = s; n++; } }
    remplir("description", texte(r.description, 600));
    return n;
  }

  async function redigerAvecClaude() {
    if (!F || F.redaction || !C.sample) return;
    const a = F.a;
    if (!a.nom.trim()) { etatForm("Donne au moins le nom du modèle.", true); $("#form-nom")?.focus(); return; }
    if (a.description.trim() && F.points.trim()) { etatForm("Description et « Les + produit » sont déjà remplis : vide-les pour les faire réécrire."); return; }
    const pourForm = F, ctl = F.redaction = new AbortController();
    etatForm(""); renderForm();
    const infos = [
      `${a.marque} ${a.nom}`.trim(), CAT[a.categorie] && `catégorie ${CAT[a.categorie].nom}`, a.couleur && `couleur ${a.couleur}`, a.coupe && `coupe ${a.coupe}`,
      a.matieres.length && `matières ${a.matieres.join(", ")}`, a.composition && `composition ${a.composition}`, a.encolure && a.encolure, a.manches && `manches ${a.manches.toLowerCase()}`,
      a.styles.length && `style ${a.styles.join(", ")}`, TAILLANT[a.taillant] && TAILLANT[a.taillant].nom.toLowerCase(), a.prix != null && `prix ${a.prix} €`,
    ].filter(Boolean).join(" ; ");
    try {
      const r = await C.sample.json(`Tu aides un vendeur du rayon Homme d'un magasin de prêt-à-porter multimarque à rédiger la fiche d'un article, comme sur le site d'une marque.
Article : ${infos}.
${a.description.trim() ? `Description déjà écrite par le vendeur : ${a.description.trim()}` : ""}
N'invente aucune caractéristique technique (composition, grammage, provenance, traitement) qui n'est pas donnée ci-dessus : appuie-toi sur la coupe, le style, les usages et les associations.
Réponds uniquement avec un objet JSON : {"description": "2 à 3 phrases au ton d'une fiche produit, en vouvoyant le client", "points": ["4 à 5 arguments courts, à dire au client en magasin"]}`, { signal: ctl.signal });
      if (F !== pourForm) return;
      let n = 0;
      if (!a.description.trim() && texte(r?.description, 1200)) { a.description = texte(r.description, 1200); n++; }
      const points = listeTextes(r?.points, 6, 200);
      if (!F.points.trim() && points.length) { F.points = points.join("\n"); n++; }
      F.modifie = F.modifie || n > 0;
      F.message = n ? "Texte proposé par Claude : relis-le et ajuste-le avant d'enregistrer." : "Claude n'a rien proposé.";
      F.erreur = false;
    } catch (e) {
      if (F !== pourForm || (e && e.code === "cancelled")) return;
      F.message = messageClaude(e); F.erreur = true;
    } finally {
      if (F === pourForm) { F.redaction = null; renderForm(); }
    }
  }

  function nouvelIdArticle(a) {
    const base = slug([a.marque, a.nom, a.couleur].filter(Boolean).join(" ")) || "article";
    let id;
    do id = `${base}-${Math.random().toString(36).slice(2, 6)}`; while (S.articles[id]);
    return id;
  }
  async function enregistrerFormulaire(ensuite) {
    if (!F || F.envoi) return;
    const a = F.a;
    a.marque = a.marque.trim(); a.nom = a.nom.trim(); a.couleur = a.couleur.trim();
    if (!a.nom) { etatForm("Donne un nom au modèle.", true); $("#form-nom")?.focus(); return; }
    if (!a.categorie) { etatForm("Choisis une catégorie.", true); $("#form-categorie")?.focus(); return; }
    if (a.lien && !/^https?:\/\//i.test(a.lien)) { etatForm("Le lien doit commencer par https://", true); $("#form-lien")?.focus(); return; }
    const pourForm = F;
    F.envoi = true; F.armeSuppr = false; F.armeFermer = false;
    renderForm(); etatForm("Enregistrement…");
    try {
      const nouvelles = F.photos.filter(p => p.blob).length;
      let n = 0;
      for (const p of F.photos) {
        if (!p.blob) continue;
        n++; etatForm(`Envoi des photos… ${n} sur ${nouvelles}`);
        const res = await C.assets.upload(p.blob, { type: "image/jpeg" });
        // Une photo envoyée devient une photo enregistrée : un nouvel essai ne la renverra pas.
        p.ref = "asset:" + res.id; delete p.blob;
      }
      const maintenant = new Date().toISOString();
      const id = F.id || nouvelIdArticle(a);
      a.id = id;
      a.photos = F.photos.map(p => p.ref).filter(Boolean);
      a.points = lignes(F.points);
      a.tailles = [...a.tailles].sort((x, y) => comparerTailles(x.t, y.t));
      a.creeLe = a.creeLe || maintenant;
      const propre = lireArticle(id, serialiser(a));
      propre.modifieLe = maintenant;
      S.articles[id] = propre; invalider();
      const ok = await ecrire("articles/" + id, serialiser(propre));
      if (!ok) throw { code: "ecriture" };
      if (C.assets) for (const ref of F.retirees) if (ref.startsWith("asset:")) C.assets.delete(ref.slice(6)).catch(() => {});
      ecrireStockage(CLE_DERNIER, { marque: propre.marque, categorie: propre.categorie, saison: propre.saison, styles: propre.styles });
      const etaitNouveau = !F.id;
      // « Créer aussi d'autres coloris » : une fiche par couleur, avec les mêmes informations et sans photo.
      const autres = etaitNouveau ? unique(F.colorisTexte.split(/[,;\n]/).map(x => x.trim()).filter(x => x && norm(x) !== norm(propre.couleur))).slice(0, 12) : [];
      if (autres.length) {
        const ops = autres.map(couleur => {
          const c = lireArticle(null, { ...serialiser(propre), couleur: couleur.slice(0, 60), teinte: devinerCouleur(couleur) || "", photos: [], ref: "", lien: "", site: "", note: null, coupDeCoeur: false, creeLe: maintenant, modifieLe: maintenant });
          c.id = nouvelIdArticle(c);
          S.articles[c.id] = c;
          return ["articles/" + c.id, serialiser(c)];
        });
        invalider();
        await ecrireTout(ops, (i, n) => etatForm(`Création des coloris… ${i} sur ${n}`));
      }
      const annonce = autres.length ? `« ${titreArticle(propre)} » ajouté, avec ${pluriel(autres.length, "autre coloris", "autres coloris")}` : "";
      if (F !== pourForm) return;
      if (ensuite === "autre") {
        for (const p of F.photos) if (p.url) URL.revokeObjectURL(p.url);
        F = null;
        ouvrirFormulaire(null, { base: propre, message: `${annonce || `« ${titreArticle(propre)} » ajouté`}. Au suivant !` });
        render();
        return;
      }
      fermerCouches({ sansFocus: true });
      toast(annonce ? `${annonce} : ajoute leurs photos depuis « Fiches à compléter ».` : etaitNouveau ? "Article ajouté au rayon" : "Article enregistré");
      if (etaitNouveau || V.route.page !== "produit" || V.route.id !== id) aller({ page: "produit", id });
      else render();
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

  async function confirmerSuppression() {
    if (!F || !F.id) return;
    if (!F.armeSuppr) { F.armeSuppr = true; etatForm("La fiche, ses photos et ses remarques seront supprimées (tu pourras annuler quelques secondes)."); renderForm(); return; }
    const id = F.id, nom = titreArticle(F.a);
    fermerCouches({ sansFocus: true });
    const s = await supprimerArticle(id);
    if (V.route.page === "produit" && V.route.id === id) retour(); else render();
    annoncerSuppression(s ? [s] : [], nom);
  }
  function fermerFormulaire() {
    if (!F) return;
    if (F.modifie && !F.armeFermer && !F.envoi) { F.armeFermer = true; etatForm("Modifications non enregistrées : touche encore la croix pour fermer sans enregistrer.", true); return; }
    fermerCouches();
  }

  function gererClicFormulaire(b) {
    const a = F.a, v = b.dataset.v;
    if (b.dataset.f !== "fermer") F.armeFermer = false;
    if (b.dataset.f !== "supprimer" && F.armeSuppr) {
      F.armeSuppr = false;
      const s = $('[data-f="supprimer"]', $("#couches"));
      if (s) { s.classList.remove("arme"); s.textContent = "Supprimer"; }
      etatForm("");
    }
    switch (b.dataset.f) {
      case "fermer": fermerFormulaire(); return;
      case "photo-premiere": { const [p] = F.photos.splice(Number(v), 1); F.photos.unshift(p); break; }
      case "photo-retirer": { const [p] = F.photos.splice(Number(v), 1); if (p.ref) F.retirees.push(p.ref); if (p.url) URL.revokeObjectURL(p.url); break; }
      case "claude-photo": remplirAvecClaude(); return;
      case "claude-texte": redigerAvecClaude(); return;
      case "teinte": a.teinte = a.teinte === v ? "" : v; F.teinteManuelle = true; F.modifie = true; majPressions("teinte", x => x === a.teinte); return;
      case "taille": {
        const i = a.tailles.findIndex(t => t.t === v);
        if (i >= 0) a.tailles.splice(i, 1); else a.tailles.push({ t: v, e: "dispo" });
        F.modifie = true; majPressions("taille", x => a.tailles.some(t => t.t === x)); return;
      }
      case "tailles-toutes": for (const t of GAMMES[CAT[a.categorie]?.type] || LETTRES) if (!a.tailles.some(x => x.t === t)) a.tailles.push({ t, e: "dispo" }); break;
      case "tailles-aucune": a.tailles = []; break;
      case "taille-ajout": {
        const t = F.tailleLibre.trim().slice(0, 20);
        if (!t) { $("#form-taille-libre")?.focus(); return; }
        if (!a.tailles.some(x => x.t === t)) a.tailles.push({ t, e: "dispo" });
        F.tailleLibre = "";
        break;
      }
      case "taillant": a.taillant = a.taillant === v ? "" : v; F.modifie = true; majPressions("taillant", x => x === a.taillant); return;
      case "encolure": a.encolure = a.encolure === v ? "" : v; F.modifie = true; majPressions("encolure", x => x === a.encolure); return;
      case "manches": a.manches = a.manches === v ? "" : v; F.modifie = true; majPressions("manches", x => x === a.manches); return;
      case "matiere": a.matieres = a.matieres.includes(v) ? a.matieres.filter(x => x !== v) : [...a.matieres, v]; F.modifie = true; majPressions("matiere", x => a.matieres.includes(x)); return;
      case "style": a.styles = a.styles.includes(v) ? a.styles.filter(x => x !== v) : [...a.styles, v]; F.modifie = true; majPressions("style", x => a.styles.includes(x)); return;
      case "coeur": a.coupDeCoeur = !a.coupDeCoeur; F.modifie = true; majPressions("coeur", () => a.coupDeCoeur); return;
      case "look-ajouter": if (!a.complements.includes(v)) a.complements.push(v); F.look = ""; break;
      case "look-retirer": a.complements = a.complements.filter(x => x !== v); break;
      case "supprimer": confirmerSuppression(); return;
      case "enregistrer": enregistrerFormulaire(); return;
      case "enregistrer-autre": enregistrerFormulaire("autre"); return;
      default: return;
    }
    F.modifie = true;
    renderForm();
  }

  // ---------- réglages du site ----------
  function ouvrirReglages() {
    R = { ...S.reglages, message: "" };
    if (!V.couche) V.retourFocus = document.activeElement;
    V.couche = "reglages"; V.menu = null;
    document.body.classList.add("bloque");
    majEntete(); renderCouches();
    $("#reg-bandeau")?.focus();
  }
  function reglagesHTML() {
    return `<div class="dialogue-voile" data-fond="reglages"><div class="dialogue" role="dialog" aria-modal="true" aria-labelledby="reg-titre" style="max-width:620px">
      <div class="dialogue-tete"><h2 id="reg-titre">Réglages du site</h2><button class="icone" type="button" data-action="fermer" aria-label="Fermer">${SVG.croix}</button></div>
      <div class="dialogue-corps">
        <div class="champ"><label for="reg-bandeau">Message du bandeau</label><input type="text" id="reg-bandeau" maxlength="140" value="${esc(R.bandeau)}" placeholder="Ex. : Promotion d'automne : jusqu'à −30 %">
          <p class="discret petit">Il s'affiche tout en haut et mène aux promotions. Laisse vide pour afficher le nombre d'articles.</p></div>
        <div class="champs">
          <div class="champ"><label for="reg-saison">Collection en cours</label><input type="text" id="reg-saison" list="dl-reg-saisons" value="${esc(R.saisonCourante)}" placeholder="${esc(saisonParDefaut())}"><datalist id="dl-reg-saisons">${SAISONS().map(s => `<option value="${esc(s)}"></option>`).join("")}</datalist></div>
          <div class="champ"><label for="reg-jours">« Nouveauté » pendant (jours)</label><input type="number" id="reg-jours" min="1" max="180" step="1" value="${R.joursNouveaute}"></div>
        </div>
      </div>
      <div class="dialogue-pied"><span class="etat-form" id="reg-etat">${esc(R.message)}</span><button class="btn leger" type="button" data-action="fermer">Annuler</button><button class="btn plein" type="button" data-action="reglages-ok">Enregistrer</button></div>
    </div></div>`;
  }
  function enregistrerReglages() {
    const jours = parseInt($("#reg-jours").value, 10);
    const r = lireReglages({ bandeau: $("#reg-bandeau").value, saisonCourante: $("#reg-saison").value, joursNouveaute: jours });
    S.reglages = r; invalider();
    fermerCouches();
    render();
    ecrire("site/reglages", r);
    toast("Réglages enregistrés");
  }

  // ---------- export ----------
  async function exporter() {
    if (!C.downloads) return;
    const cel = v => { const s = String(v ?? ""); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const num = v => v == null ? "" : String(v).replace(".", ",");
    const entetes = ["Marque", "Modèle", "Section", "Catégorie", "Couleur", "Famille de couleur", "Prix", "Prix promo", "Tailles", "Taillant", "Coupe", "Matières", "Composition",
      "Col", "Manches", "Collection", "Style", "Arrivée", "Coup de cœur", "Ma note", "Référence", "Lien", "Description", "Les + produit", "Remarques"];
    const lignesCsv = trier(idx().liste, "marque").map(a => {
      const cat = CAT[a.categorie];
      return [a.marque, a.nom, cat ? SECTION[cat.section].nom : "", cat?.nom || "", a.couleur, COULEUR[a.teinte]?.nom || "", num(a.prix), num(a.prixPromo),
        a.tailles.map(t => t.e === "dispo" ? t.t : `${t.t} (${ETATS[t.e].toLowerCase()})`).join(", "), TAILLANT[a.taillant]?.nom || "", a.coupe, a.matieres.join(", "), a.composition,
        a.encolure, a.manches, a.saison, a.styles.join(", "), a.arrivee, a.coupDeCoeur ? "Oui" : "", a.note || "", a.ref, a.lien, a.description, a.points.join(" | "),
        (idx().remParArticle[a.id] || []).map(r => `${r.date.slice(0, 10)} : ${r.texte}`).join(" | ")];
    });
    const csv = "﻿" + [entetes, ...lignesCsv].map(l => l.map(cel).join(";")).join("\r\n");
    try { await C.downloads.save({ filename: `rayon-homme-${aujourdhui()}.csv`, data: new Blob([csv], { type: "text/csv;charset=utf-8" }) }); }
    catch (e) { if (!e || e.code !== "declined") toast("Le fichier n'a pas pu être enregistré."); }
  }

  // ---------- noms des auteurs de remarques ----------
  let nomsEnCours = false;
  async function resoudreNoms() {
    if (!C.user || nomsEnCours) return;
    const ids = unique(Object.values(S.remarques).map(r => r.auteur).filter(id => id && id !== C.moi && !(id in C.noms))).slice(0, 64);
    if (!ids.length) return;
    nomsEnCours = true;
    try { const p = await C.user.profiles(ids); for (const id of ids) C.noms[id] = p[id]?.name || ""; }
    catch (_) { for (const id of ids) C.noms[id] = ""; }
    nomsEnCours = false;
    planifier();
  }

  // ---------- événements ----------
  function basculerFiltre(f, v) {
    if (V.route.page !== "liste" || !FACETTE[f]) return;
    const E = etatListe(V.route);
    const s = E.filtres[f] || (E.filtres[f] = new Set());
    if (s.has(v)) s.delete(v); else s.add(v);
    if (!s.size) delete E.filtres[f];
    E.limite = 24;
    render();
  }
  const grandEcran = matchMedia("(min-width: 1360px)");
  const ACTIONS = {
    tiroir: () => { V.tiroirNiveau = null; ouvrirCouche("tiroir"); },
    "tiroir-niveau": b => { V.tiroirNiveau = b.dataset.v || null; renderCouches(); $(".tiroir-retour, .tiroir-lien", $("#couches"))?.focus(); },
    recherche: () => ouvrirCouche("recherche"),
    filtres: () => ouvrirCouche("filtres"),
    fermer: () => { if (V.couche === "form") fermerFormulaire(); else fermerCouches(); },
    // Sans la barre de navigation (écran étroit), le menu s'ouvre dans le tiroir.
    menu: b => {
      const id = b.dataset.menu;
      if (!grandEcran.matches) { fermerCouches({ sansFocus: true }); V.tiroirNiveau = id; ouvrirCouche("tiroir"); return; }
      fermerCouches({ sansFocus: true }); ouvrirMenu(V.menu === id ? null : id);
    },
    favori: b => basculerFavori(b.dataset.id),
    filtre: b => basculerFiltre(b.dataset.f, b.dataset.v),
    "filtres-effacer": () => { if (V.route.page !== "liste") return; const E = etatListe(V.route); E.filtres = {}; E.limite = 24; render(); },
    plus: () => { etatListe(V.route).limite += 24; render(); },
    ajouter: b => { fermerCouches({ sansFocus: true }); ouvrirFormulaire(null, { categorie: b.dataset.categorie }); },
    modifier: () => ouvrirFormulaire(V.route.id),
    coloris: () => { const a = S.articles[V.route.id]; if (a) ouvrirFormulaire(null, { coloris: a }); },
    galerie: b => { V.galerie = Number(b.dataset.i) || 0; render(); },
    note: b => noter(V.route.id, Number(b.dataset.n)),
    stock: () => { V.stock = !V.stock; render(); },
    "taille-etat": b => changerEtatTaille(V.route.id, b.dataset.t),
    "remarque-rapide": b => insererRemarque(b.dataset.t),
    "remarque-ajouter": () => ajouterRemarque(V.route.id),
    "remarque-suppr": b => supprimerRemarque(b.dataset.id),
    retour: () => retour(),
    reglages: () => { fermerCouches({ sansFocus: true }); ouvrirReglages(); },
    "reglages-ok": () => enregistrerReglages(),
    exporter: () => exporter(),
    // sélection de plusieurs articles
    selection: () => { V.selection = V.selection ? null : new Set(); V.armeSerie = false; render(); },
    choisir: b => choisir(b.dataset.id),
    "selection-tout": () => toutChoisir(),
    serie: () => { if (V.selection && V.selection.size) ouvrirCouche("serie"); },
    "serie-appliquer": b => appliquerSerie(b.dataset.quoi),
    "selection-supprimer": () => supprimerSelection(),
    comparer: () => ouvrirComparaison(),
    "comparer-retirer": b => { V.comparaison = V.comparaison.filter(id => id !== b.dataset.id); render(); },
    // conseil client
    "conseil-demander": () => demanderConseil(),
    "conseil-exemple": b => { V.conseil.demande = b.dataset.t; render(); $("#conseil-demande")?.focus(); },
    "conseil-dispo": () => { V.conseil.dispo = !V.conseil.dispo; render(); },
    "conseil-recherche": () => { const q = V.recherche.trim(); V.conseil.demande = q; aller({ page: "conseil" }); if (q) demanderConseil(); else $("#conseil-demande")?.focus(); },
    // stock, remarques, photos, liens
    "stock-copier": () => copier(texteReassort(), "Liste de réassort", "Liste copiée : colle-la dans un message à ton responsable."),
    "remarque-modifier": b => modifierRemarque(b.dataset.id),
    "remarque-enregistrer": () => enregistrerRemarque(),
    "remarque-annuler": () => { V.edition = null; render(); },
    "remarques-plus": () => { V.limiteRemarques += 40; render(); },
    visionneuse: () => ouvrirCouche("photo"),
    "photo-prec": () => changerPhoto(-1),
    "photo-suiv": () => changerPhoto(1),
    "copier-lien": () => copierLien(),
    // import, sauvegarde
    importer: () => { fermerCouches({ sansFocus: true }); ouvrirImport(); },
    "import-maj": () => { if (!IMP) return; IMP.maj = !IMP.maj; analyserImport(); renderCouches(); },
    "import-lancer": () => lancerImport(),
    sauvegarder: () => sauvegarder(),
    restaurer: () => { fermerCouches({ sansFocus: true }); ouvrirRestauration(); },
    "restaurer-lancer": () => lancerRestauration(),
  };

  document.addEventListener("click", e => {
    const formBouton = e.target.closest("[data-f]");
    if (formBouton && F && formBouton.closest("#couches")) { gererClicFormulaire(formBouton); return; }
    // Un clic sur le voile d'une fenêtre la ferme (le formulaire demande d'abord confirmation s'il a changé).
    if (e.target.matches(".dialogue-voile")) { if (V.couche === "form") fermerFormulaire(); else fermerCouches(); return; }
    if (V.couche === "photo" && e.target.matches(".visionneuse")) { fermerCouches(); return; }
    const cible = e.target.closest("[data-route], [data-action]");
    if (!cible) { if (V.menu && !e.target.closest("#entete")) ouvrirMenu(null); return; }
    if (V.armeSerie && !["selection-supprimer"].includes(cible.dataset.action)) { V.armeSerie = false; if (!cible.dataset.route) setTimeout(render); }
    if (cible.dataset.route) {
      const r = lireRoute(cible.dataset.route);
      if (cible.dataset.preset) appliquerPreset(r, cible.dataset.preset);
      aller(r);
      return;
    }
    const action = ACTIONS[cible.dataset.action];
    if (action) action(cible, e);
  });

  document.addEventListener("input", e => {
    const t = e.target;
    if (t.id === "remarque-texte" && V.route.page === "produit") { V.remarque[V.route.id] = t.value; return; }
    if (t.id === "recherche-champ") { V.recherche = t.value; const r = $("#recherche-resultats"); if (r) r.innerHTML = resultatsRechercheHTML(); return; }
    if (t.id === "conseil-demande") { V.conseil.demande = t.value; return; }
    if (t.id === "remarque-edition" && V.edition) { V.edition.texte = t.value; return; }
    if (t.id === "filtre-remarques") { V.filtreRemarques = t.value; V.limiteRemarques = 40; render(); return; }
    if (t.id === "import-texte" && IMP) { IMP.texte = t.value; reanalyserImport(); return; }
    if (!F || !t.closest("#couches")) return;
    F.armeFermer = false;
    if (CLES_TEXTE[t.id]) {
      F.a[CLES_TEXTE[t.id]] = t.value; F.modifie = true;
      if (t.id === "form-couleur" && !F.teinteManuelle) { const g = devinerCouleur(t.value); if (g && g !== F.a.teinte) { F.a.teinte = g; majPressions("teinte", x => x === g); } }
      return;
    }
    switch (t.id) {
      case "form-prix": case "form-promo": {
        F.a[t.id === "form-prix" ? "prix" : "prixPromo"] = prixSaisi(t.value); F.modifie = true;
        const r = $("#form-remise"); if (r) r.textContent = enPromo(F.a) ? `−${remise(F.a)} %` : "";
        return;
      }
      case "form-points": F.points = t.value; F.modifie = true; return;
      case "form-coloris": F.colorisTexte = t.value; F.modifie = true; return;
      case "form-taille-libre": F.tailleLibre = t.value; return;
      case "form-look": F.look = t.value; $("#form-look-resultats").innerHTML = lookResultatsHTML(); return;
    }
  });
  document.addEventListener("change", e => {
    const t = e.target;
    if (t.id === "tri" && V.route.page === "liste") { const E = etatListe(V.route); E.tri = t.value; E.limite = 24; render(); return; }
    if (t.id === "import-fichier" && IMP && t.files[0]) {
      lireFichierTexte(t.files[0]).then(contenu => { if (!IMP) return; IMP.texte = contenu; analyserImport(); renderCouches(); }, () => toast("Ce fichier n'a pas pu être lu."));
      return;
    }
    if (t.id === "import-categorie" && IMP) { IMP.categorie = t.value; analyserImport(); renderCouches(); return; }
    if (t.id === "restaurer-fichier" && RES && t.files[0]) { lireSauvegarde(t.files[0]); return; }
    if (!F) return;
    if (t.id === "form-categorie") { F.a.categorie = t.value; F.modifie = true; renderForm(); return; }
    if (t.id === "form-fichiers") { ajouterPhotos(t.files); t.value = ""; }
  });
  document.addEventListener("keydown", e => {
    const t = e.target;
    if (e.key === "Escape") {
      if (V.couche === "form") { e.preventDefault(); fermerFormulaire(); return; }
      if (V.couche) { e.preventDefault(); fermerCouches(); return; }
      if (V.menu) { const id = V.menu; ouvrirMenu(null); $(`#nav [data-nav="${id}"]`)?.focus(); }
      return;
    }
    if (e.key === "Enter" && t.id === "recherche-champ") {
      e.preventDefault();
      const q = t.value.trim();
      if (q) aller({ page: "liste", type: "recherche", valeur: q });
      return;
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && t.id === "remarque-texte") { e.preventDefault(); ajouterRemarque(V.route.id); return; }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && t.id === "remarque-edition") { e.preventDefault(); enregistrerRemarque(); return; }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && t.id === "conseil-demande") { e.preventDefault(); demanderConseil(); return; }
    if (V.couche === "photo" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) { e.preventDefault(); changerPhoto(e.key === "ArrowLeft" ? -1 : 1); return; }
    if (e.key === "Enter" && t.id === "form-taille-libre") { e.preventDefault(); const b = $('[data-f="taille-ajout"]'); if (b) gererClicFormulaire(b); return; }
    if (e.key === "ArrowDown" && t.matches?.("#nav [aria-haspopup]")) { e.preventDefault(); ouvrirMenu(t.dataset.nav); $("#mega .mega-lien")?.focus(); }
  });
  // Glisser le doigt sur la photo d'une fiche (ou en plein écran) passe à la photo suivante.
  let toucheDebut = null;
  document.addEventListener("touchstart", e => {
    const zone = e.target.closest(".galerie-principale, .visionneuse");
    toucheDebut = zone && e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  }, { passive: true });
  document.addEventListener("touchend", e => {
    if (!toucheDebut) return;
    const t = e.changedTouches[0], dx = t.clientX - toucheDebut.x, dy = t.clientY - toucheDebut.y;
    toucheDebut = null;
    if (Math.abs(dx) > 45 && Math.abs(dy) < 70) changerPhoto(dx < 0 ? 1 : -1);
  }, { passive: true });
  // État des volets repliables (filtres, détails de la fiche), gardé d'un rendu à l'autre.
  document.addEventListener("toggle", e => {
    const d = e.target;
    if (!(d instanceof HTMLDetailsElement)) return;
    if (d.dataset.facette) { if (d.open) V.ouverts.add(d.dataset.facette); else V.ouverts.delete(d.dataset.facette); }
    else if (d.dataset.acc) { if (d.open) V.accordeons.add(d.dataset.acc); else V.accordeons.delete(d.dataset.acc); }
  }, true);

  // Méga-menu au survol sur ordinateur ; au toucher, le lien mène directement à la section.
  // Revenir sur l'en-tête annule une fermeture en attente, jamais une ouverture.
  $("#nav").addEventListener("mouseover", e => {
    const b = e.target.closest("[data-nav]");
    if (!b || !survol.matches) return;
    const n = NAV.find(x => x.id === b.dataset.nav);
    clearTimeout(minuteurFermeture); clearTimeout(minuteurOuverture);
    minuteurOuverture = setTimeout(() => ouvrirMenu(n && n.menu ? n.id : null), 90);
  });
  $("#entete").addEventListener("mouseleave", () => {
    if (!survol.matches) return;
    clearTimeout(minuteurOuverture); clearTimeout(minuteurFermeture);
    minuteurFermeture = setTimeout(() => ouvrirMenu(null), 200);
  });
  $("#entete").addEventListener("mouseenter", () => clearTimeout(minuteurFermeture));

  // ---------- démarrage ----------
  function routeInitiale() {
    const h = decodeURIComponent((location.hash || "").slice(1));
    if (!h) return;
    if (CAT[h]) V.route = { page: "liste", type: "categorie", valeur: h };
    else if (SECTION[h]) V.route = { page: "liste", type: "section", valeur: h };
    else if (["nouveautes", "promos", "favoris", "coups", "tout"].includes(h)) V.route = { page: "liste", type: h };
    else if (h.startsWith("p-")) V.route = { page: "produit", id: h.slice(2) };
    else if (PAGES_OUTILS[h] && h !== "comparer") V.route = { page: h };
  }
  function modeLocal() {
    C.mode = "local"; C.peutEcrire = true;
    chargerLocal();
    S.charge = true; invalider(); render();
  }
  async function demarrer() {
    routeInitiale();
    render();
    if (!(window.claude && typeof window.claude.use === "function")) { modeLocal(); return; }
    const utiliser = nom => window.claude.use(nom).catch(() => null);
    const [db, user] = await Promise.all([utiliser("db"), utiliser("user")]);
    if (!db) { modeLocal(); toast("Hors connexion à claude.ai : le catalogue reste sur cet appareil."); return; }
    C.db = db; C.user = user; C.mode = "distant";
    if (user) {
      const [moi, ecriture, proprio] = await Promise.all([user.id().catch(() => null), user.can("data.write").catch(() => null), user.isOwner().catch(() => false)]);
      C.moi = moi; C.proprio = !!proprio;
      // null : la plateforme ne dit rien ; on garde les commandes, une écriture refusée tranchera.
      C.peutEcrire = ecriture !== false;
    } else C.peutEcrire = true;
    render();
    const erreurAbonnement = () => { $("#pied-etat").textContent = "Connexion perdue : recharge la page."; };
    db.collection("articles").onSnapshot(snap => {
      const m = {};
      for (const d of snap.docs) m[d.id] = lireArticle(d.id, d.data());
      S.articles = m; S.charge = true; invalider(); planifier();
    }, erreurAbonnement);
    db.collection("remarques").onSnapshot(snap => {
      const m = {};
      for (const d of snap.docs) { const r = lireRemarque(d.id, d.data()); if (r) m[d.id] = r; }
      S.remarques = m; invalider(); planifier();
    }, erreurAbonnement);
    db.doc("site/reglages").onSnapshot(snap => { S.reglages = lireReglages(snap.exists ? snap.data() : null); invalider(); planifier(); }, erreurAbonnement);
    if (C.moi) {
      db.doc(`data/users/${C.moi}/prefs`).onSnapshot(snap => {
        if (!snap.exists) return;
        S.favoris = new Set(listeTextes(snap.data().favoris, 500));
        ecrireStockage(CLE_FAVORIS, [...S.favoris]);
        planifier();
      }, () => {});
    }
    // Capacités facultatives : photos (personnes qui peuvent modifier), Claude, téléchargement.
    utiliser("assets").then(a => { C.assets = a; if (V.couche === "form") renderForm(); });
    utiliser("sample").then(async s => {
      if (typeof s !== "function") return;
      C.sample = s;
      const limites = await s.limits().catch(() => null);
      C.sampleImages = !!(limites && limites.images);
      C.maxImages = limites && limites.images ? limites.images.maxCount : 0;
      render();
      if (V.couche === "form") renderForm();
    });
    utiliser("downloads").then(d => { C.downloads = d; renderPied(); });
  }
  demarrer();
})();

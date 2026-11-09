// Boussole Bourse : la logique de la page.
// Données : sur la page publiée, chaque personne a ses propres documents, privés, sous
// data/users/<id>/ (strategie, portefeuille, journal, comparer, discussion). Ouverte en
// fichier, la page les garde dans le navigateur.
(() => {
  "use strict";
  const B = window.BOUSSOLE;
  const $ = id => document.getElementById(id);

  // ---------- utilitaires ----------
  const clone = o => (o == null ? o : JSON.parse(JSON.stringify(o)));
  const num = v => {
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    const n = parseFloat(String(v ?? "").replace(/[\s  €%]/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };
  const nfCache = {};
  const nf = (min, max) => (nfCache[min + "-" + max] ||= new Intl.NumberFormat("fr-FR", { minimumFractionDigits: min, maximumFractionDigits: max }));
  const eur = (n, dec) => {
    const d = dec ?? (Math.abs(n) < 1000 && Math.round(n) !== n ? 2 : 0);
    return nf(d, d).format(n) + " €";
  };
  const eurSigne = n => (n > 0.005 ? "+" : n < -0.005 ? "−" : "") + eur(Math.abs(n));
  const pct = (n, d = 1) => nf(0, d).format(n) + " %";
  const pctSigne = (n, d = 1) => (n > 0.005 ? "+" : n < -0.005 ? "−" : "") + pct(Math.abs(n), d);
  const points = n => (n > 0.05 ? "+" : n < -0.05 ? "−" : "") + nf(0, 1).format(Math.abs(n)) + " pt";
  const compact = n => {
    const a = Math.abs(n);
    if (a >= 1e6) return nf(0, 1).format(n / 1e6) + " M€";
    if (a >= 1e3) return nf(0, a >= 1e4 ? 0 : 1).format(n / 1e3) + " k€";
    return nf(0, 0).format(n) + " €";
  };
  const isoDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const aujourdhui = () => isoDate(new Date());
  const dateFr = iso => {
    if (!iso) return "";
    const d = new Date(iso + "T12:00:00");
    return isNaN(d) ? iso : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }).replace(/^1 /, "1er ");
  };
  const ajouterMois = (iso, mois) => {
    const d = new Date(iso + "T12:00:00");
    d.setMonth(d.getMonth() + mois);
    return isoDate(d);
  };
  const joursDepuis = iso => Math.floor((Date.now() - new Date(iso + "T12:00:00").getTime()) / 86400000);
  const uid = () => Math.random().toString(36).slice(2, 10);
  const somme = (arr, f) => arr.reduce((s, x) => s + (f ? f(x) : x), 0);
  const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

  function h(tag, props, ...enfants) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
      else if (k === "value" || k === "checked" || k === "selected" || k === "disabled" || k === "hidden") e[k] = v;
      else e.setAttribute(k, v === true ? "" : String(v));
    }
    for (const c of enfants.flat(Infinity)) if (c != null && c !== false) e.append(c.nodeType ? c : String(c));
    return e;
  }
  const vider = (el, ...enfants) => { el.replaceChildren(...enfants.flat(Infinity).filter(c => c != null && c !== false)); return el; };
  const pastille = (niveau, texte) => h("span", { class: "pastille p-" + niveau, text: texte });
  const options = (sel, liste, valeur) => {
    vider(sel, liste.map(o => h("option", { value: o.value, text: o.label })));
    sel.value = valeur ?? "";
    if (sel.value !== String(valeur ?? "") && liste.length) sel.value = liste[0].value;
  };
  const aFocus = el => el && (document.activeElement === el || el.contains(document.activeElement));
  // Une saisie en cours (texte, nombre, liste) : on ne redessine pas sous les doigts. Un bouton ou une case, si.
  const enSaisie = el => aFocus(el) && /^(TEXTAREA|SELECT)$|^INPUT$/.test(document.activeElement.tagName) && !["checkbox", "radio", "button", "submit"].includes(document.activeElement.type);
  const remplir = (id, valeur) => {
    const el = $(id);
    if (!el || aFocus(el)) return;
    if (el.type === "checkbox") el.checked = !!valeur;
    else el.value = valeur ?? "";
  };

  const TYPE_COMPTE = Object.fromEntries(B.TYPES_COMPTES.map(t => [t.id, t]));

  // ---------- état ----------
  const CATEGORIE_IDS = new Set(B.CATEGORIES_BUDGET.map(c => c.id));
  const CHAMPS_MOIS = ["salaire", "primeActivite", "autres", "fixes", "variables"];
  const DOCS = ["strategie", "portefeuille", "journal", "comparer", "discussion", "historique", "budget", "marche", "robot"];
  // `marche` et `robot` sont écrits par le robot des cours (tâche planifiée), jamais par la page.
  const DOCS_ROBOT = ["marche", "robot"];
  const S = {};
  function defauts(nom) {
    switch (nom) {
      case "strategie": return clone(B.STRATEGIE_DEPART);
      case "portefeuille": return { exemple: false, coursMaj: "", lignes: [], comptes: [] };
      case "journal": return { entrees: [] };
      case "comparer": return null;
      case "discussion": return { messages: [] };
      case "historique": return { points: [] };
      case "budget": return { prevu: {}, paie: {}, regles: [], mensuel: {} };
      case "marche": return { maj: "", cours: {}, symboles: {}, erreurs: [], sources: [] };
      case "robot": return { trigger: "", horaire: "" };
    }
  }
  function normaliser(nom, d) {
    const base = defauts(nom);
    if (nom === "comparer") return d && typeof d === "object" ? d : null;
    if (!d || typeof d !== "object") return base;
    if (nom === "strategie") {
      const r = { ...base, ...d };
      r.profil = { ...base.profil, ...(d.profil || {}) };
      r.profil.paliers = Array.isArray(r.profil.paliers) ? r.profil.paliers.filter(p => p && typeof p === "object").map(p => ({ montant: num(p.montant), date: /^\d{4}-\d{2}-\d{2}$/.test(p.date || "") ? p.date : "", versement: num(p.versement), investi: num(p.investi) })) : [];
      r.regles = { ...base.regles, ...(d.regles || {}) };
      r.enveloppes = { ...base.enveloppes, ...(d.enveloppes || {}) };
      r.principes = { ...base.principes, ...(d.principes || {}) };
      // Les règles des grands investisseurs : toutes appliquées tant qu'elles n'ont pas été décochées.
      r.sagesse = { ...Object.fromEntries(B.SAGESSE.map(x => [x.id, true])), ...(d.sagesse || {}) };
      r.poches = Array.isArray(d.poches) ? d.poches.map(p => ({ id: p.id || uid(), nom: p.nom || "Poche", classe: p.classe || "actions", cible: num(p.cible), ligne: p.ligne || "" })) : base.poches;
      r.reglesLibres = Array.isArray(d.reglesLibres) ? d.reglesLibres.map(String) : [];
      return r;
    }
    if (nom === "portefeuille") {
      const r = { ...base, ...d };
      r.lignes = Array.isArray(d.lignes) ? d.lignes.map(l => ({
        id: l.id || uid(), nom: l.nom || "Sans nom", code: l.code || "", type: l.type || "ETF",
        enveloppe: l.enveloppe || "CTO", poche: l.poche || "", classe: l.classe || "", zone: l.zone || "",
        quantite: num(l.quantite), pru: num(l.pru), cours: num(l.cours), frais: num(l.frais), sansQuantite: !!l.sansQuantite,
        symbole: l.symbole || "", coursManuelLe: l.coursManuelLe || "", refPrix: l.refPrix > 0 ? num(l.refPrix) : null
      })) : [];
      r.comptes = Array.isArray(d.comptes) ? d.comptes.map(c => ({
        id: c.id || uid(), nom: c.nom || "Compte", type: TYPE_COMPTE[c.type] ? c.type : "autre", solde: num(c.solde),
        taux: c.taux == null || c.taux === "" ? null : num(c.taux), plafond: num(c.plafond), precaution: !!c.precaution
      })) : [];
      // Ancien format : un seul montant d'épargne de précaution.
      if (!Array.isArray(d.comptes) && num(d.precaution) > 0)
        r.comptes.push({ id: uid(), nom: "Épargne de précaution", type: "livretA", solde: num(d.precaution), taux: 1.7, plafond: 22950, precaution: true });
      delete r.precaution;
      return r;
    }
    if (nom === "journal") return { entrees: Array.isArray(d.entrees) ? d.entrees : [] };
    if (nom === "discussion") return { messages: Array.isArray(d.messages) ? d.messages.filter(m => m && (m.role === "user" || m.role === "assistant") && m.content) : [] };
    if (nom === "budget") return { prevu: d.prevu && typeof d.prevu === "object" ? Object.fromEntries(Object.entries(d.prevu).map(([k, v]) => [k, num(v)])) : {},
      // « net », « promoAnnee » et « promoBrut » : anciens champs (le net se calcule maintenant depuis le brut).
      paie: d.paie && typeof d.paie === "object" ? Object.fromEntries(Object.entries(d.paie).filter(([k]) => !["net", "promoAnnee", "promoBrut"].includes(k))) : {},
      // Jour à partir duquel une paie compte pour le mois suivant (0 : jamais ; absent : le 25).
      ...(d.paieDecalee != null && d.paieDecalee !== "" ? { paieDecalee: Math.max(0, Math.min(31, Math.round(num(d.paieDecalee)))) } : {}),
      // Règles de classement apprises : un libellé qui contient `motif` va dans `categorie`.
      regles: Array.isArray(d.regles) ? d.regles.filter(r => r && String(r.motif || "").trim() && CATEGORIE_IDS.has(r.categorie)).map(r => ({ motif: String(r.motif).trim().slice(0, 80), categorie: r.categorie })) : [],
      // Mon mois : ce que je remplis en début de mois (salaire, prime d'activité, autres revenus, dépenses fixes et variables).
      mensuel: d.mensuel && typeof d.mensuel === "object" ? Object.fromEntries(Object.entries(d.mensuel).filter(([k, v]) => /^\d{4}-\d{2}$/.test(k) && v && typeof v === "object").sort().slice(-24)
        .map(([k, v]) => [k, Object.fromEntries(CHAMPS_MOIS.filter(c => v[c] !== undefined && v[c] !== "" && v[c] !== null).map(c => [c, num(v[c])]))])) : {} };
    if (nom === "marche") return { ...base, ...d, cours: d.cours && typeof d.cours === "object" ? d.cours : {}, symboles: d.symboles || {}, erreurs: Array.isArray(d.erreurs) ? d.erreurs : [] };
    if (nom === "robot") return { ...base, ...d };
    if (nom === "historique") return { points: Array.isArray(d.points) ? d.points.filter(x => x && /^\d{4}-\d{2}-\d{2}$/.test(x.date)).sort((a, b) => a.date < b.date ? -1 : 1) : [] };
    return d;
  }
  for (const n of DOCS) S[n] = defauts(n);
  // Opérations du budget : un document par mois, data/users/<id>/budget/mois/AAAA-MM.
  const M = {};
  const estMois = nom => nom.startsWith("mois:");
  const valeurDoc = nom => estMois(nom) ? (M[nom.slice(5)] ?? null) : S[nom];
  const normMois = d => ({ mouvements: Array.isArray(d && d.mouvements) ? d.mouvements.filter(x => x && /^\d{4}-\d{2}-\d{2}$/.test(x.date)).map(x => ({ id: x.id || uid(), date: x.date, libelle: String(x.libelle || ""), montant: num(x.montant), categorie: x.categorie || "autres" })) : [] });

  // ---------- stockage ----------
  const stock = { mode: "attente", db: null, uid: null, sale: {}, enCours: {}, relance: {}, minuteurs: {}, arret: null, pret: false };
  const CLE = nom => "boussole-bourse:" + nom;
  function lireLocal(nom) {
    try { const t = localStorage.getItem(CLE(nom)); return t ? JSON.parse(t) : null; } catch (_) { return null; }
  }
  function ecrireLocal(nom) {
    try {
      const v = valeurDoc(nom);
      if (v == null) localStorage.removeItem(CLE(nom));
      else localStorage.setItem(CLE(nom), JSON.stringify(v));
      return true;
    } catch (_) { return false; }
  }
  function etatDonnees(texte) { $("etat-donnees").textContent = texte; rendreDonnees(); }

  function passerEnLocal(raison) {
    if (stock.arret) { try { stock.arret(); } catch (_) {} stock.arret = null; }
    const etaitPage = stock.mode === "page";
    stock.mode = "navigateur";
    if (stock.arretMois) { try { stock.arretMois(); } catch (_) {} stock.arretMois = null; }
    if (etaitPage) { for (const n of DOCS) ecrireLocal(n); for (const k of Object.keys(M)) ecrireLocal("mois:" + k); }
    else {
      for (const n of DOCS) { const d = lireLocal(n); if (d) S[n] = normaliser(n, d); }
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(CLE("mois:"))) { const d = lireLocal(k.slice(CLE("").length)); if (d) M[k.slice(CLE("mois:").length)] = normMois(d); }
        }
      } catch (_) {}
    }
    stock.pret = true;
    etatDonnees(raison || "Enregistré dans ce navigateur");
    if (!etaitPage && !S.historique.points.length) noterPoint();
    toutRendre();
  }

  async function demarrerStockage() {
    if (!(window.claude && typeof window.claude.use === "function")) { passerEnLocal("Enregistré dans ce navigateur"); return; }
    let db = null, user = null, id = null;
    try { [db, user] = await Promise.all([window.claude.use("db"), window.claude.use("user")]); } catch (_) {}
    try { id = user ? await user.id() : null; } catch (_) { id = null; }
    if (!db || !id) { passerEnLocal("Enregistré dans ce navigateur (connecte-toi à claude.ai pour retrouver tes données partout)"); return; }
    stock.db = db; stock.uid = id; stock.mode = "page";
    etatDonnees("Connexion à tes données…");
    let confirme = false;
    const minuteur = setTimeout(() => { if (!confirme) etatDonnees("Tes données ne répondent pas encore : les chiffres affichés peuvent être anciens"); }, 10000);
    stock.arret = db.collection("data/users/" + id).onSnapshot(snap => {
      const majAvant = S.marche.maj;
      const present = new Map(snap.docs.map(d => [d.id, d]));
      for (const n of DOCS) {
        if (stock.sale[n] || stock.enCours[n]) continue;
        const d = present.get(n);
        const recu = d ? normaliser(n, clone(d.data())) : defauts(n);
        // L'écho de nos propres écritures garde l'objet en place : les champs en cours de saisie
        // continuent de modifier le bon objet.
        if (JSON.stringify(recu) !== JSON.stringify(S[n])) S[n] = recu;
      }
      if (!snap.metadata.fromCache && !confirme) { confirme = true; stock.confirme = true; clearTimeout(minuteur); etatDonnees("Enregistré dans ta page, privé"); if (!S.historique.points.length) noterPoint(); actualiserAuto(); }
      if (confirme && S.marche.maj && S.marche.maj !== majAvant) apresMarche();
      stock.pret = true;
      toutRendre();
    }, err => {
      clearTimeout(minuteur);
      passerEnLocal(err && err.code === "revoked" ? "Accès aux données retiré : enregistré dans ce navigateur" : "Données de la page indisponibles : enregistré dans ce navigateur");
    });
    stock.arretMois = db.collection(`data/users/${id}/budget/mois`).onSnapshot(snap => {
      const present = new Set();
      for (const d of snap.docs) {
        present.add(d.id);
        const nom = "mois:" + d.id;
        if (stock.sale[nom] || stock.enCours[nom]) continue;
        const recu = normMois(d.data());
        if (JSON.stringify(recu) !== JSON.stringify(M[d.id])) M[d.id] = recu;
      }
      for (const k of Object.keys(M)) if (!present.has(k) && !stock.sale["mois:" + k] && !stock.enCours["mois:" + k]) delete M[k];
      toutRendre();
    }, () => {});
  }

  function enregistrer(nom) {
    stock.sale[nom] = true;
    clearTimeout(stock.minuteurs[nom]);
    stock.minuteurs[nom] = setTimeout(() => ecrire(nom), 600);
  }
  async function ecrire(nom) {
    if (stock.mode === "navigateur") {
      stock.sale[nom] = false;
      if (!ecrireLocal(nom)) etatDonnees("Ce navigateur refuse d'enregistrer : tes changements seront perdus en fermant la page");
      return;
    }
    if (stock.mode !== "page") { stock.minuteurs[nom] = setTimeout(() => ecrire(nom), 800); return; }
    if (stock.enCours[nom]) { stock.relance[nom] = true; return; }
    stock.enCours[nom] = true; stock.sale[nom] = false;
    try {
      const ref = stock.db.doc(estMois(nom) ? `data/users/${stock.uid}/budget/mois/${nom.slice(5)}` : `data/users/${stock.uid}/${nom}`);
      const v = valeurDoc(nom);
      if (v == null) await ref.delete(); else await ref.set(clone(v));
    } catch (e) {
      stock.enCours[nom] = false;
      if (e && e.code === "unavailable" && !stock.relance["_" + nom]) {
        stock.relance["_" + nom] = true; stock.sale[nom] = true;
        setTimeout(() => { stock.relance["_" + nom] = false; ecrire(nom); }, 800 + Math.random() * 800);
        return;
      }
      if (e && e.code === "quota_exceeded") { etatDonnees("Plus de place dans la page : vide la discussion ou des entrées du journal"); return; }
      passerEnLocal("Cette page ne t'autorise pas à enregistrer : tes changements restent dans ce navigateur");
      return;
    }
    stock.enCours[nom] = false;
    if (stock.relance[nom] || stock.sale[nom]) { stock.relance[nom] = false; ecrire(nom); }
  }
  const modifier = (nom, f) => { f(S[nom]); if (nom === "strategie" && S.strategie.exemple) S.strategie.exemple = false; enregistrer(nom); toutRendre(); };

  // ---------- calculs du portefeuille ----------
  const CLASSE = Object.fromEntries(B.CLASSES.map(c => [c.id, c]));
  const TYPE_CLASSE = { ETF: "actions", Action: "actions", Fonds: "actions", Obligation: "obligations", "Monétaire": "monetaire", Livret: "livret", Crypto: "crypto", "Produit à levier": "actions", Autre: "autre" };
  const pocheDe = l => S.strategie.poches.find(p => p.id === l.poche) || null;
  const classeDe = l => l.classe || (pocheDe(l) || {}).classe || TYPE_CLASSE[l.type] || "autre";
  const estFonds = l => l.type === "ETF" || l.type === "Fonds" || l.type === "Monétaire";
  const actif = id => !!S.strategie.principes[id];

  // Cours du marché pour une ligne : celui du robot, sauf si la ligne a changé de code depuis
  // ou si un cours saisi à la main est plus récent.
  const cleLigne = l => String(l.symbole || l.code || l.nom || "").trim().toLowerCase();
  function coursMarche(l) {
    const c = S.marche.cours[l.id];
    if (!c || !(c.prix > 0) || c.cle !== cleLigne(l)) return null;
    if (l.coursManuelLe && c.date && l.coursManuelLe > c.date) return null;
    return c;
  }
  function chiffrer(l) {
    const m = coursMarche(l);
    let valeur, cours = num(l.cours), veilleValeur = null;
    if (l.sansQuantite) {
      const ratio = m && l.refPrix > 0 ? m.prix / l.refPrix : 1;
      valeur = num(l.cours) * ratio;
      if (m && m.veille > 0 && l.refPrix > 0) veilleValeur = num(l.cours) * m.veille / l.refPrix;
    } else {
      if (m) cours = m.prix;
      valeur = num(l.quantite) * cours;
      if (m && m.veille > 0) veilleValeur = num(l.quantite) * m.veille;
    }
    return { valeur, cours, marche: m, varJour: veilleValeur != null ? valeur - veilleValeur : null, varJourPct: m && m.veille > 0 ? (m.prix / m.veille - 1) * 100 : null };
  }
  function synthese(lignesSource) {
    const st = S.strategie;
    const lignes = (lignesSource || S.portefeuille.lignes).map(l => {
      const ch = chiffrer(l);
      const investi = l.sansQuantite ? num(l.pru) : num(l.quantite) * num(l.pru);
      return { ...l, valeur: ch.valeur, coursEff: ch.cours, marche: ch.marche, varJour: ch.varJour, varJourPct: ch.varJourPct, investi, pv: ch.valeur - investi, pvPct: investi > 0 ? (ch.valeur / investi - 1) * 100 : 0, classeCalc: classeDe(l) };
    });
    const total = somme(lignes, l => l.valeur);
    const investi = somme(lignes, l => l.investi);
    for (const l of lignes) l.poids = total > 0 ? l.valeur / total * 100 : 0;
    const ids = new Set(st.poches.map(p => p.id));
    const poches = st.poches.map(p => {
      const ls = lignes.filter(l => l.poche === p.id);
      const valeur = somme(ls, l => l.valeur);
      const poids = total > 0 ? valeur / total * 100 : 0;
      return { ...p, lignes: ls, valeur, poids, ecart: poids - num(p.cible) };
    });
    const hors = lignes.filter(l => !ids.has(l.poche));
    const fondsVal = somme(lignes.filter(estFonds), l => l.valeur);
    const fraisMoyen = fondsVal > 0 ? somme(lignes.filter(estFonds), l => l.valeur * num(l.frais)) / fondsVal : 0;
    const classes = {};
    for (const l of lignes) classes[l.classeCalc] = (classes[l.classeCalc] || 0) + l.valeur;
    const parEnveloppe = {};
    for (const l of lignes) {
      const e = parEnveloppe[l.enveloppe] ||= { valeur: 0, investi: 0 };
      e.valeur += l.valeur; e.investi += l.investi;
    }
    const direct = lignes.filter(l => l.type === "Action");
    const avecJour = lignes.filter(l => l.varJour != null);
    return {
      varJour: avecJour.length ? somme(avecJour, l => l.varJour) : null,
      varJourPct: avecJour.length ? somme(avecJour, l => l.varJour) / Math.max(1, somme(avecJour, l => l.valeur - l.varJour)) * 100 : null,
      enDirect: lignes.filter(l => l.marche).length,
      lignes, total, investi, pv: total - investi, pvPct: investi > 0 ? (total / investi - 1) * 100 : 0,
      poches, hors, horsValeur: somme(hors, l => l.valeur), fraisMoyen, classes, parEnveloppe,
      directPoids: total > 0 ? somme(direct, l => l.valeur) / total * 100 : 0,
      cryptoPoids: total > 0 ? somme(lignes.filter(estCrypto), l => l.valeur) / total * 100 : 0,
      totalCible: somme(st.poches, p => num(p.cible))
    };
  }
  const estTR = () => norm(S.strategie.profil.courtier).includes("trade republic");
  const estCrypto = l => (l.classeCalc || classeDe(l)) === "crypto" || l.type === "Crypto" || l.enveloppe === "Crypto";
  const enFractions = l => l.type === "Crypto" || l.enveloppe === "Crypto" || (estTR() && l.enveloppe === "CTO");
  const estExempleCompte = c => /^cx\d/.test(c.id);
  const tauxCompte = c => c.taux != null ? num(c.taux) : ((TYPE_COMPTE[c.type] || {}).taux ?? null);
  const tauxNet = c => { const t = tauxCompte(c); if (t == null) return null; return (TYPE_COMPTE[c.type] || {}).impose ? t * (1 - (B.FISCALITE.ir + B.FISCALITE.ps) / 100) : t; };
  const epargnePrecaution = () => somme(S.portefeuille.comptes.filter(c => c.precaution), c => num(c.solde));
  const epargneTotale = () => somme(S.portefeuille.comptes, c => num(c.solde));
  const momentFr = iso => {
    if (!iso) return "";
    const d = new Date(iso), j = isoDate(d) === aujourdhui() ? "aujourd'hui" : isoDate(d) === isoDate(new Date(Date.now() - 86400000)) ? "hier" : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    return `${j} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  };
  const moisFr = iso => iso ? new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) : "";
  function patrimoine(syn) {
    const crypto = somme(syn.lignes.filter(estCrypto), l => l.valeur);
    const epargne = epargneTotale(), precaution = epargnePrecaution();
    return { total: syn.total + epargne, bourse: syn.total - crypto, crypto, epargne, precaution, autreEpargne: epargne - precaution };
  }
  // Le compte qui reçoit l'épargne de précaution : le meilleur taux net parmi ceux qui ont de la place.
  function compteCible() {
    const cs = S.portefeuille.comptes.filter(c => c.precaution);
    const place = c => !(num(c.plafond) > 0) || num(c.solde) < num(c.plafond);
    return [...cs].filter(place).sort((a, b) => (tauxNet(b) ?? -1) - (tauxNet(a) ?? -1))[0] || cs[0] || null;
  }
  // Paliers d'épargne de précaution : des objectifs datés, chacun avec son partage du mois
  // entre l'épargne et les investissements. Sans palier, l'objectif vaut dépenses × mois.
  const paliers = () => (Array.isArray(S.strategie.profil.paliers) ? S.strategie.profil.paliers : [])
    .filter(p => p && num(p.montant) > 0).sort((a, b) => (a.date || "9999") < (b.date || "9999") ? -1 : 1);
  // Nombre de paies (fins de mois) après `debut` (ou aujourd'hui) et jusqu'à `fin` incluse.
  function paiesEntre(debut, fin) {
    if (!fin) return null;
    const apres = debut ? new Date(debut + "T23:59:59") : new Date(new Date().setHours(0, 0, 0, 0));
    const limite = new Date(fin + "T23:59:59");
    let n = 0;
    for (let d = new Date(apres.getFullYear(), apres.getMonth(), 1, 12); n < 600; d.setMonth(d.getMonth() + 1)) {
      const finMois = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12);
      if (finMois > limite) break;
      if (finMois >= apres) n++;
    }
    return n;
  }
  // L'effort d'épargne du mois : d'abord l'épargne de précaution, puis l'argent à investir.
  function planDuMois() {
    const pr = S.strategie.profil, ps = paliers(), act = epargnePrecaution();
    let obj, vp, vi, palier = null, suivant = null, rang = null;
    if (ps.length) {
      const i = ps.findIndex(p => act < num(p.montant));
      const p = i >= 0 ? ps[i] : ps[ps.length - 1];
      palier = i >= 0 ? p : null; suivant = i >= 0 ? ps[i + 1] || null : null; rang = i >= 0 ? i : ps.length;
      obj = num(p.montant); vp = num(p.versement); vi = num(p.investi);
    } else { obj = objectifPrecaution(); vp = num(pr.versementPrecaution); vi = num(pr.versementMensuel); }
    const manque = Math.max(0, obj - act);
    let versEpargne, investir;
    if (pr.basculer) { versEpargne = Math.min(vp, manque); investir = vi + vp - versEpargne; }
    else { versEpargne = vp; investir = vi; }
    const mois = vp > 0 && manque > 0 ? Math.ceil(manque / vp) : null;
    const paies = palier && palier.date ? paiesEntre(null, palier.date) : null;
    const besoin = paies ? Math.ceil(manque / paies) : null;
    const datePassee = palier && palier.date && palier.date < aujourdhui();
    const enRetard = !!palier && !!palier.date && manque > 0 && (datePassee || paies === 0 || vp * paies < manque - 0.5);
    return { obj, act, manque, vp, vi, versEpargne, investir, complete: obj > 0 && manque <= 0, mois, fin: mois ? ajouterMois(aujourdhui(), mois) : null, compte: compteCible(),
      paliers: ps, palier, suivant, rang, paies, besoin, enRetard, datePassee };
  }
  const cibleActions = () => somme(S.strategie.poches.filter(p => p.classe === "actions" || p.classe === "crypto"), p => num(p.cible));
  const objectifPrecaution = () => num(S.strategie.profil.depensesMensuelles) * num(S.strategie.profil.moisPrecaution);
  const anneesDepuis = iso => iso ? (Date.now() - new Date(iso + "T12:00:00").getTime()) / (365.25 * 86400000) : null;

  function alertes(syn) {
    const st = S.strategie, r = st.regles, pr = st.profil, out = [];
    const ajoute = (niveau, texte) => out.push({ niveau, texte });
    if (Math.abs(syn.totalCible - 100) > 0.01) ajoute("attention", `Ta cible fait ${pct(syn.totalCible)} au total, pas 100 %. Corrige-la dans Ma stratégie.`);
    if (!syn.lignes.length) {
      ajoute("info", "Ajoute tes lignes pour voir si ton portefeuille suit ta stratégie.");
    } else {
      if (actif("reequilibrage") || actif("allocation")) {
        for (const p of syn.poches) {
          if (num(p.cible) <= 0 && p.valeur <= 0) continue;
          if (p.ecart < -num(r.marge)) ajoute("attention", `${p.nom} : ${pct(p.poids)} pour une cible de ${pct(num(p.cible), 0)} (${points(p.ecart)}). Oriente tes prochains versements vers cette poche.`);
          else if (p.ecart > num(r.marge)) ajoute("attention", `${p.nom} : ${pct(p.poids)} pour une cible de ${pct(num(p.cible), 0)} (${points(p.ecart)}). Pas besoin de vendre : arrête de la renforcer jusqu'à ce qu'elle revienne dans ta marge.`);
        }
      }
      if (syn.hors.length) {
        const noms = syn.hors.slice(0, 3).map(l => l.nom).join(", ");
        ajoute("attention", `${syn.hors.length > 1 ? syn.hors.length + " lignes ne sont" : "Une ligne n'est"} dans aucune poche de ta stratégie (${noms}${syn.hors.length > 3 ? "…" : ""}) : ${pct(syn.horsValeur / syn.total * 100)} du portefeuille.`);
      }
      if (actif("diversification")) {
        for (const l of syn.lignes.filter(l => l.type === "Action" && l.poids > num(r.maxAction)))
          ajoute("bloquant", `${l.nom} pèse ${pct(l.poids)} du portefeuille ; ta règle : ${pct(num(r.maxAction))} au plus par action.`);
        if (syn.directPoids > num(r.maxDirect)) ajoute("bloquant", `Les actions en direct pèsent ${pct(syn.directPoids)} ; ta règle : ${pct(num(r.maxDirect), 0)} au plus.`);
        if (syn.cryptoPoids > num(r.maxCrypto)) ajoute("bloquant", `La crypto pèse ${pct(syn.cryptoPoids)} de tes investissements ; ta règle : ${pct(num(r.maxCrypto), 0)} au plus.`);
      }
      if (actif("frais")) {
        for (const l of syn.lignes.filter(l => estFonds(l) && num(l.frais) > num(r.fraisMax)))
          ajoute("attention", `${l.nom} coûte ${pct(num(l.frais), 2)} par an, au-dessus de ton plafond de ${pct(num(r.fraisMax), 2)}.`);
      }
      if (r.interditLevier && actif("levier")) {
        for (const l of syn.lignes.filter(l => l.type === "Produit à levier"))
          ajoute("bloquant", `${l.nom} est un produit à levier, contraire à ta règle.`);
      }
    }
    if (actif("precaution")) {
      const pl = planDuMois(), comptes = S.portefeuille.comptes;
      if (pl.obj <= 0) ajoute("info", "Fixe l'objectif de ton épargne de précaution (dépenses mensuelles et nombre de mois) dans Ma stratégie.");
      else if (!comptes.some(c => c.precaution)) ajoute("attention", "Aucun compte n'est coché comme épargne de précaution : ajoute ton livret dans « Mes comptes d'épargne ».");
      else if (pl.manque > 0) {
        const t = `Épargne de précaution : ${eur(pl.act, 0)} sur ${eur(pl.obj, 0)} (${pct(pl.act / pl.obj * 100, 0)}).`;
        if (pl.palier && pl.palier.date) {
          if (pl.datePassee) ajoute("attention", `${t} L'objectif du ${dateFr(pl.palier.date)} n'est pas atteint : fixe une nouvelle date ou un nouveau versement dans Ma stratégie.`);
          else if (pl.enRetard) ajoute("attention", `${t} Pour l'avoir le ${dateFr(pl.palier.date)}, il faut ${eur(pl.besoin, 0)} sur chacune des ${pl.paies} prochaines paies ; ta stratégie en prévoit ${eur(pl.vp, 0)}.`);
          else ajoute("info", `${t} Objectif du ${dateFr(pl.palier.date)} tenu : ${eur(pl.vp, 0)} sur ${pl.paies > 1 ? `chacune des ${pl.paies} prochaines paies` : "la prochaine paie"} (${eur(pl.besoin, 0)} suffisent).`);
        }
        else if (pl.vp > 0) ajoute(pl.mois > 24 ? "attention" : "info", `${t} À ${eur(pl.vp, 0)} par mois, elle sera complète en ${moisFr(pl.fin)}${pl.mois > 24 ? " : c'est long, augmente le versement si tu peux" : ""}.`);
        else ajoute("attention", `${t} Aucun versement mensuel n'est prévu pour la compléter : fixe-le dans Ma stratégie.`);
      } else if (pl.act > pl.obj * 1.5) ajoute("info", `Ton épargne de précaution dépasse ton objectif de ${eur(pl.act - pl.obj, 0)} : ce surplus pourrait être investi selon ta stratégie.`);
      else ajoute("ok", `Épargne de précaution complète : ${eur(pl.act, 0)} pour un objectif de ${eur(pl.obj, 0)}.`);
      const livret = TYPE_COMPTE.livretA;
      for (const c of comptes.filter(c => c.precaution && (TYPE_COMPTE[c.type] || {}).impose && num(c.solde) > 0)) {
        const net = tauxNet(c);
        if (net == null) ajoute("info", `${c.nom} : renseigne son taux pour comparer son rendement net à celui du Livret A.`);
        else if (net < livret.taux) ajoute("info", `${c.nom} : ${pct(tauxCompte(c), 2)} brut, soit ${pct(net, 2)} net après la flat tax, moins que le Livret A (${pct(livret.taux, 1)} net d'impôt)${estTR() ? ". Trade Republic propose aussi un Livret A" : ""}.`);
      }
      for (const c of comptes.filter(c => c.type !== "livretJeune" && num(c.plafond) > 0 && num(c.solde) >= num(c.plafond) * 0.95))
        ajoute("info", `${c.nom} est ${num(c.solde) >= num(c.plafond) ? "plein" : "presque plein"} (${eur(num(c.solde), 0)} sur ${eur(num(c.plafond), 0)}).${c.type === "livretA" ? " Le LDDS a le même taux et reste net d'impôt." : ""}`);
    }
    if (actif("allocation")) {
      const risque = B.RISQUES.find(x => x.id === pr.risque);
      const ca = cibleActions();
      if (risque && ca > risque.maxActions) ajoute("attention", `Ta cible met ${pct(ca, 0)} en actions, plus que ce qu'un profil « ${risque.nom.toLowerCase()} » supporte d'habitude (${risque.maxActions} %).`);
      if ((pr.reaction === "tout" || pr.reaction === "partie") && ca >= 60) ajoute("attention", `Tu dis que tu vendrais ${pr.reaction === "tout" ? "tout" : "une partie"} après une baisse de 30 %. Avec ${pct(ca, 0)} d'actions, une telle baisse arrivera sans doute un jour : une cible plus prudente t'éviterait de vendre au pire moment.`);
    }
    if (actif("horizon") && num(pr.horizon) > 0 && num(pr.horizon) < 5 && cibleActions() > 30) ajoute("attention", `Ton horizon est de ${num(pr.horizon)} ans : c'est court pour ${pct(cibleActions(), 0)} d'actions.`);
    if (actif("enveloppes")) {
      const e = st.enveloppes;
      if (num(e.peaVersements) > B.FISCALITE.plafondPEA) ajoute("bloquant", `Tes versements sur le PEA (${eur(num(e.peaVersements))}) dépassent le plafond de 150 000 €.`);
      const ans = anneesDepuis(e.peaOuverture);
      if (ans != null && ans < 5 && ans >= 0) ajoute("info", `Ton PEA aura 5 ans le ${dateFr(ajouterMois(e.peaOuverture, 60))} : à partir de là, plus d'impôt sur le revenu sur les gains.`);
      if (!e.peaOuverture && syn.lignes.some(l => l.enveloppe === "CTO" && l.type === "ETF")) ajoute("info", "Tu as des ETF sur un compte-titres sans PEA renseigné. Un PEA, même ouvert avec peu, fait courir le délai de 5 ans.");
    }
    if (syn.lignes.length && S.portefeuille.coursMaj) {
      const j = joursDepuis(S.portefeuille.coursMaj);
      if (j > 30) ajoute("info", `Cours mis à jour il y a ${j} jours. Mets-les à jour pour des chiffres justes.`);
    }
    if (syn.lignes.length && !out.some(a => a.niveau === "attention" || a.niveau === "bloquant")) ajoute("ok", "Tes investissements respectent ta stratégie et tes règles.");
    const ordre = { bloquant: 0, attention: 1, info: 2, ok: 3 };
    return out.sort((a, b) => ordre[a.niveau] - ordre[b.niveau]);
  }

  // Répartit un versement pour rapprocher chaque poche de sa cible, sans vendre.
  function repartirVersement(montant, syn) {
    const poches = syn.poches.filter(p => num(p.cible) > 0);
    if (!(montant > 0) || !poches.length) return [];
    const totalApres = syn.total + montant;
    const manques = poches.map(p => Math.max(0, num(p.cible) / 100 * totalApres - p.valeur));
    const totalManque = somme(manques);
    const sommeCibles = somme(poches, p => num(p.cible));
    let parts = totalManque >= montant
      ? manques.map(m => montant * m / totalManque)
      : manques.map((m, i) => m + (montant - totalManque) * num(poches[i].cible) / sommeCibles);
    parts = parts.map(x => Math.round(x));
    const ecart = Math.round(montant) - somme(parts);
    if (ecart) { const i = parts.indexOf(Math.max(...parts)); parts[i] += ecart; }
    return poches.map((p, i) => {
      const montantP = parts[i];
      let ligne = p.ligne ? syn.lignes.find(l => l.id === p.ligne) : null;
      if (!ligne && p.lignes.length) ligne = [...p.lignes].sort((a, b) => b.valeur - a.valeur)[0];
      const partsNb = ligne && ligne.coursEff > 0 ? Math.floor(montantP / ligne.coursEff) : null;
      return { poche: p, montant: montantP, ligne, parts: partsNb, poidsApres: (p.valeur + montantP) / totalApres * 100 };
    }).filter(x => x.montant > 0);
  }

  // ---------- onglets ----------
  const VUES = ["portefeuille", "mois", "epargne", "bourse", "claude", "strategie"];
  let vueActive = "portefeuille";
  function montrer(vue) {
    if (!VUES.includes(vue)) vue = "portefeuille";
    vueActive = vue;
    for (const v of VUES) {
      $("vue-" + v).hidden = v !== vue;
      $("t-" + v).setAttribute("aria-selected", v === vue ? "true" : "false");
    }
    if (vue === "strategie") rendreIC();
    if (vue === "portefeuille") rendreHistorique();
    window.scrollTo({ top: 0 });
  }
  document.querySelectorAll(".onglet").forEach(b => b.addEventListener("click", () => montrer(b.dataset.vue)));
  // Anciens liens : Décider et Simuler n'existent plus (Claude fait ces vérifications et ces simulations).
  const vueDe = hash => ({ accueil: "portefeuille", patrimoine: "portefeuille", budget: "mois", simuler: "strategie", comparer: "strategie", decider: "claude" })[hash] || hash;
  window.addEventListener("hashchange", () => { const v = vueDe(location.hash.slice(1)); if (VUES.includes(v)) montrer(v); });

  // ---------- rendu : portefeuille ----------
  function rendreBandeau() {
    const zone = $("bandeau-exemple");
    const pf = S.portefeuille;
    if (pf.exemple) {
      vider(zone, h("div", { class: "bandeau" },
        h("p", {}, h("b", { text: "Portefeuille d'exemple." }), " Les lignes et les cours sont fictifs : ils montrent ce que fait l'outil. Remplace-les par les tiens."),
        h("div", { class: "actions" },
          claudePret ? h("button", { class: "btn btn-petit", text: "Importer le mien avec Claude", onclick: () => { effacerExemple(); ouvrirImport(); } }) : null,
          h("button", { class: "btn btn-ghost btn-petit", text: "Saisir mes lignes", onclick: () => { effacerExemple(); ouvrirLigne(null); } }),
          h("button", { class: "btn btn-discret btn-petit", text: "Effacer l'exemple", onclick: effacerExemple }))));
    } else if (!pf.lignes.length) {
      vider(zone, h("div", { class: "bandeau" },
        h("p", {}, h("b", { text: "Ton portefeuille est vide." }), claudePret ? " Le plus rapide : colle le relevé de ton courtier ou une capture d'écran, Claude remplit les lignes." : " Ajoute tes lignes une par une : nom, quantité, prix de revient et cours."),
        h("div", { class: "actions" },
          claudePret ? h("button", { class: "btn btn-petit", text: "Importer avec Claude", onclick: ouvrirImport }) : null,
          h("button", { class: "btn btn-ghost btn-petit", text: "Ajouter une ligne", onclick: () => ouvrirLigne(null) }),
          h("button", { class: "btn btn-discret btn-petit", text: "Essayer avec un exemple", onclick: chargerExemple }))));
    } else vider(zone);
  }
  function effacerExemple() {
    S.portefeuille = { exemple: false, coursMaj: "", lignes: [], comptes: S.portefeuille.comptes.filter(c => !estExempleCompte(c)) };
    enregistrer("portefeuille"); toutRendre();
  }
  function chargerExemple() {
    const ex = clone(B.PORTEFEUILLE_EXEMPLE);
    const poches = S.strategie.poches;
    const cles = { monde: "monde", emergents: "emerg", direct: "direct", crypto: "crypto" };
    for (const l of ex.lignes) {
      if (!l.poche) continue;
      const p = poches.find(p => p.id === l.poche) || poches.find(p => norm(p.nom).includes(cles[l.poche] || "§")) || poches.find(p => p.classe === l.classe);
      l.poche = p ? p.id : "";
    }
    ex.coursMaj = aujourdhui();
    // Les vrais comptes d'épargne restent ; les comptes d'exemple ne s'ajoutent que s'il n'y en a pas.
    if (S.portefeuille.comptes.length) ex.comptes = S.portefeuille.comptes;
    S.portefeuille = ex; enregistrer("portefeuille"); toutRendre();
  }

  const COULEURS_PATRIMOINE = { epargne: "var(--serie-3)", bourse: "var(--serie-1)", crypto: "var(--serie-2)" };
  // La pyramide : le total, puis la bourse et l'épargne, puis leur détail. Chaque % est la part du patrimoine.
  function rendrePyramide(syn) {
    const pat = patrimoine(syn), z = $("pyramide");
    const total = pat.total, bourse = pat.bourse + pat.crypto, epargne = pat.epargne;
    const part = v => total > 0 ? pct(v / total * 100, 0) : "—";
    const caseP = (lib, montant, pastilleTxt, sous, cls, titre) => h("div", { class: "case" + (cls ? " " + cls : ""), title: titre || null },
      h("span", { class: "case-etiquette", text: lib }), h("span", { class: "case-montant", text: montant }),
      pastilleTxt ? h("span", { class: "case-pct", text: pastilleTxt }) : null, sous ? h("span", { class: "case-sous", text: sous }) : null);
    const pl = planDuMois();
    const barre = total > 0 ? h("div", { class: "py-barre", role: "img", "aria-label": `Épargne ${part(epargne)}, bourse ${part(bourse)}` },
      epargne > 0 ? h("span", { class: "py-seg py-seg-epargne", style: `flex:${epargne} 1 0` }) : null,
      bourse > 0 ? h("span", { class: "py-seg py-seg-bourse", style: `flex:${bourse} 1 0` }) : null) : null;
    const livrets = S.portefeuille.comptes.filter(c => c.precaution && num(c.solde) >= 50).slice(0, 2);
    const caseLivret = c => {
      const t = tauxNet(c), plein = num(c.plafond) > 0 && num(c.solde) >= num(c.plafond) - 0.5;
      return caseP(nomCourt(c.nom), eur(num(c.solde), 0), part(num(c.solde)), plein ? "au plafond" : t != null ? `${pct(t, 1)} net` : null, null, c.nom);
    };
    const enDirect = syn.lignes.length && syn.enDirect;
    vider(z,
      h("h2", { class: "case case-titre", text: "Mon patrimoine" }),
      h("div", { class: "py-rang py-1" }, h("div", { class: "case case-total" },
        h("span", { class: "case-etiquette", text: "Montant total" }), h("span", { class: "case-montant", text: eur(total, 0) }),
        h("span", { class: "case-pct", text: "100 %" }), barre)),
      h("div", { class: "py-rang py-2" },
        caseP("Bourse", eur(bourse, 0), part(bourse), pat.crypto > 0 ? `dont ${eur(pat.crypto, 0)} de crypto` : "PEA et compte-titres"),
        caseP("Épargne", eur(epargne, 0), part(epargne), pl.obj > 0 ? `dont ${eur(pat.precaution, 0)} de précaution sur ${eur(pl.obj, 0)}` : null)),
      h("div", { class: "py-rang py-3", style: `grid-template-columns:repeat(${2 + livrets.length}, minmax(0, 1fr))` },
        caseP("Plus-value latente", syn.lignes.length ? eurSigne(syn.pv) : "—", syn.lignes.length ? pctSigne(syn.pvPct) : null, null, syn.pv >= 0 ? "gain" : "perte"),
        caseP("Dernière séance", syn.varJour != null ? eurSigne(syn.varJour) : "—", syn.varJour != null ? pctSigne(syn.varJourPct) : null, null, syn.varJour == null ? null : syn.varJour >= 0 ? "gain" : "perte"),
        livrets.map(caseLivret)),
      syn.lignes.length ? h("p", { class: "py-pied" }, enDirect ? `Cours en direct ${momentFr(S.marche.maj)}` : `Cours du ${S.portefeuille.coursMaj ? dateFr(S.portefeuille.coursMaj) : "?"}`, " · ",
        h("button", { type: "button", class: "lien", text: "Mes lignes", onclick: () => montrer("bourse") }), " · ",
        h("button", { type: "button", class: "lien", text: "Mes comptes", onclick: () => montrer("epargne") })) : null);
  }

  function rendrePrecaution() {
    const pl = planDuMois(), z = $("precaution"), pr = S.strategie.profil;
    const comptes = S.portefeuille.comptes.filter(c => c.precaution);
    vider($("precaution-statut"), pl.obj <= 0 ? null : pl.manque > 0 ? pastille("attention", "en cours") : pastille("ok", "complète"));
    if (pl.obj <= 0) {
      vider(z, h("p", { class: "vide", text: "Fixe ton objectif dans Ma stratégie : tes dépenses mensuelles et le nombre de mois à garder de côté." }),
        h("button", { class: "btn btn-ghost btn-petit", text: "Fixer mon objectif", onclick: () => { montrer("strategie"); $("s-depenses").focus(); } }));
      return;
    }
    const part = Math.min(100, pl.act / pl.obj * 100);
    if (pl.paliers.length) {
      const fin = pl.paliers[pl.paliers.length - 1];
      const texte = pl.palier
        ? (pl.palier.date
          ? `Il manque ${eur(pl.manque, 0)} d'ici le ${dateFr(pl.palier.date)} : ${pl.paies} paie${pl.paies > 1 ? "s" : ""} d'ici là, soit ${eur(pl.besoin || pl.manque, 0)} par paie. Ta stratégie prévoit ${eur(pl.vp, 0)} par mois${pl.enRetard ? " : c'est trop peu, augmente le versement ou décale la date." : ", c'est bon."}`
          : `Il manque ${eur(pl.manque, 0)}${pl.mois ? ` : à ${eur(pl.vp, 0)} par mois, atteint en ${moisFr(pl.fin)}` : ""}.`)
        : `Tous tes paliers sont atteints.${pr.basculer && num(fin.versement) > 0 ? ` Tes ${eur(num(fin.versement), 0)} mensuels vont maintenant à tes investissements.` : ""}`;
      const apres = pl.suivant
        ? `Ensuite : ${eur(num(pl.suivant.montant), 0)}${pl.suivant.date ? ` pour le ${dateFr(pl.suivant.date)}` : ""}, avec ${eur(num(pl.suivant.versement), 0)} par mois sur l'épargne et ${eur(num(pl.suivant.investi), 0)} investis.`
        : pl.palier && pr.basculer && pl.vp > 0 ? `Une fois ce dernier palier atteint, ces ${eur(pl.vp, 0)} iront à tes investissements, qui passeront à ${eur(pl.vi + pl.vp, 0)} par mois.` : null;
      vider(z,
        h("div", { class: "repart-tete" }, h("span", { class: "chiffre-cle", text: eur(pl.act, 0) }), h("span", { class: "muet petit", text: `sur ${eur(pl.obj, 0)} · palier ${Math.min(pl.rang + 1, pl.paliers.length)} sur ${pl.paliers.length}${pl.palier && pl.palier.date ? `, pour le ${dateFr(pl.palier.date)}` : ""}` })),
        h("div", { class: "jauge", role: "meter", "aria-label": "Épargne de précaution", "aria-valuemin": "0", "aria-valuemax": String(Math.round(pl.obj)), "aria-valuenow": String(Math.round(Math.min(pl.act, pl.obj))) }, h("div", { style: `width:${part}%` })),
        h("p", { text: texte }),
        apres ? h("p", { class: "petit muet", text: apres }) : null,
        comptes.length ? h("p", { class: "petit muet", text: "Sur : " + comptes.map(c => `${c.nom} (${eur(num(c.solde), 0)})`).join(" · ") }) : null);
      return;
    }
    vider(z,
      h("div", { class: "repart-tete" }, h("span", { class: "chiffre-cle", text: eur(pl.act, 0) }), h("span", { class: "muet petit", text: `sur ${eur(pl.obj, 0)} · ${num(pr.moisPrecaution)} mois de dépenses` })),
      h("div", { class: "jauge", role: "meter", "aria-label": "Épargne de précaution", "aria-valuemin": "0", "aria-valuemax": String(Math.round(pl.obj)), "aria-valuenow": String(Math.round(Math.min(pl.act, pl.obj))) }, h("div", { style: `width:${part}%` })),
      h("p", { text: pl.manque > 0
        ? (pl.vp > 0 ? `Il manque ${eur(pl.manque, 0)}. À ${eur(pl.vp, 0)} par mois, elle sera complète en ${moisFr(pl.fin)} (${pl.mois} mois).` : `Il manque ${eur(pl.manque, 0)}, et aucun versement mensuel n'est prévu : fixe-le dans Ma stratégie.`)
        : `Complète${pl.act > pl.obj ? `, avec ${eur(pl.act - pl.obj, 0)} de plus que l'objectif` : ""}.${pr.basculer && pl.vp > 0 ? ` Tes ${eur(pl.vp, 0)} mensuels vont maintenant à tes investissements.` : ""}` }),
      pl.manque > 0 && pl.vp > 0 && pr.basculer ? h("p", { class: "petit muet", text: `Ensuite, ces ${eur(pl.vp, 0)} iront à tes investissements, qui passeront à ${eur(pl.vi + pl.vp, 0)} par mois.` }) : null,
      comptes.length ? h("p", { class: "petit muet", text: "Sur : " + comptes.map(c => `${c.nom} (${eur(num(c.solde), 0)})`).join(" · ") }) : h("p", { class: "petit", text: "Coche tes livrets comme épargne de précaution dans « Mes comptes d'épargne »." }));
  }

  // ---------- cours du marché ----------
  // Une ligne suivie en valeur seule prend comme référence le premier cours connu après sa saisie.
  function apresMarche() {
    let change = false;
    for (const l of S.portefeuille.lignes) {
      if (!l.sansQuantite || l.refPrix > 0) continue;
      const m = coursMarche(l);
      if (m) { l.refPrix = m.prix; change = true; }
    }
    if (change) enregistrer("portefeuille");
    noterPoint();
    if (demandeCours) { demandeCours = 0; etatRobot = ""; clearTimeout(minuteurRobot); }
  }
  let mcp = null, demandeCours = 0, etatRobot = "", minuteurRobot = null, autoFait = false;
  async function brancherMcp() {
    if (!(window.claude && typeof window.claude.use === "function")) return;
    try { mcp = await window.claude.use("mcp"); } catch (_) { mcp = null; }
    rendreCoursDirect();
    actualiserAuto();
  }
  // Heures de cotation de Trade Republic (Lang & Schwarz) : du lundi au vendredi, 7 h 30 – 23 h, heure de Paris.
  function parisInfo(d) {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
    const g = t => (parts.find(x => x.type === t) || {}).value || "";
    return { semaine: !["Sat", "Sun"].includes(g("weekday")), minutes: Number(g("hour")) * 60 + Number(g("minute")) };
  }
  const bourseOuverte = d => { const p = parisInfo(d); return p.semaine && p.minutes >= 450 && p.minutes <= 1380; };
  // Les cours ont-ils pu bouger depuis le dernier relevé ?
  function coursPerimes() {
    const r = S.strategie.profil.coursAuto || {};
    if (!S.marche.maj) return true;
    const debut = Date.parse(S.marche.maj), age = (Date.now() - debut) / 60000;
    if (age < Math.max(5, num(r.minutes) || 15)) return false;
    if (bourseOuverte(new Date())) return true;
    if (S.portefeuille.lignes.some(l => estCrypto(l)) && age > 60) return true;
    for (let t = debut + 15 * 60000; t < Date.now(); t += 15 * 60000) if (bourseOuverte(new Date(t))) return true;
    return false;
  }
  // À l'ouverture de la page (et quand on y revient), relance le robot si les cours sont périmés.
  function actualiserAuto() {
    const r = S.strategie.profil.coursAuto || {};
    if (autoFait || !r.actif || !mcp || !S.robot.trigger || !stock.confirme || S.portefeuille.exemple || !S.portefeuille.lignes.length) return;
    if (demandeCours && Date.now() - demandeCours < 4 * 60000) return;
    let derniere = 0;
    try { derniere = Number(localStorage.getItem(CLE("demande-auto"))) || 0; } catch (_) {}
    if (Date.now() - derniere < Math.max(5, num(r.minutes) || 15) * 60000) return;
    if (!coursPerimes()) return;
    autoFait = true;
    try { localStorage.setItem(CLE("demande-auto"), String(Date.now())); } catch (_) {}
    lancerRobot(true);
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { autoFait = false; actualiserAuto(); } });
  async function lancerRobot(auto) {
    if (!mcp || !S.robot.trigger) return;
    demandeCours = Date.now();
    etatRobot = auto ? "Actualisation des cours…" : "Demande envoyée…";
    rendreCoursDirect();
    try {
      // Sans texte : un texte ajouté devient un second message et le robot ferait deux relevés.
      await mcp.callTool("Claude Code Remote", "fire_trigger", { trigger_id: S.robot.trigger }, { cache: false });
      etatRobot = "Le robot relève les cours : ils arrivent d'ici une minute, la page se met à jour seule.";
      clearTimeout(minuteurRobot);
      minuteurRobot = setTimeout(() => { if (demandeCours) { demandeCours = 0; etatRobot = "Le relevé n'est pas encore arrivé : réessaie dans un moment."; rendreCoursDirect(); } }, 4 * 60000);
    } catch (e) {
      demandeCours = 0;
      const code = e && e.code;
      etatRobot = ({
        server_not_connected: "Le connecteur Claude Code Remote n'est pas disponible pour ton compte ; le relevé automatique du soir continue.",
        needs_reauth: "Reconnecte Claude Code Remote dans claude.ai, Réglages, Connecteurs.",
        not_in_manifest: "La page n'a pas l'autorisation de lancer le robot : accepte-la dans la fenêtre de claude.ai, ou dans le menu Autorisations de la page.",
        approval_required: "Il faut ton accord pour lancer le robot : clique sur « Actualiser maintenant » et accepte la demande de claude.ai.",
        consent_required: "Il faut ton accord pour lancer le robot : clique sur « Actualiser maintenant » et accepte la demande de claude.ai.",
        tool_error: "Le robot n'a pas pu être lancé. Le relevé automatique du soir continue."
      })[code] || "La demande n'est pas passée. Le relevé automatique du soir continue.";
    }
    rendreCoursDirect();
  }
  function rendreCoursDirect() {
    const z = $("cours-direct");
    if (!z) return;
    const m = S.marche, r = S.robot, lignes = S.portefeuille.lignes, pr = S.strategie.profil;
    if (!lignes.length && !m.maj) { vider(z); return; }
    if (aFocus(z)) return;
    const syn = synthese();
    const noms = new Set(lignes.map(l => l.nom));
    const erreurs = (m.erreurs || []).filter(e => noms.has(e.ligne));
    const enAttente = demandeCours && Date.now() - demandeCours < 4 * 60000;
    const auto = pr.coursAuto || { actif: true, minutes: 15 };
    const selMin = h("select", { id: "cours-auto-min", "aria-label": "Délai avant actualisation", disabled: !auto.actif, style: "width:auto;min-height:30px;padding:2px 8px", onchange: e => modifier("strategie", st => { st.profil.coursAuto = { ...(st.profil.coursAuto || {}), minutes: num(e.target.value) }; }) });
    options(selMin, [5, 15, 30, 60].map(v => ({ value: String(v), label: `${v} min` })), String(num(auto.minutes) || 15));
    vider(z, h("div", { class: "bandeau", style: "border-style:solid" },
      h("p", {}, m.maj
        ? [h("b", { text: "Cours en direct" }), ` · ${momentFr(m.maj)} · ${(m.sources || []).join(", ")} · ${syn.enDirect} ligne${syn.enDirect > 1 ? "s" : ""} sur ${lignes.length}`]
        : [h("b", { text: r.trigger ? "Cours en direct activés" : "Cours en direct" }), r.trigger ? " · premier relevé en attente" : " · pas encore activés"]),
      h("div", { class: "actions" },
        r.trigger && mcp ? h("button", { class: "btn btn-ghost btn-petit", text: enAttente ? "Relevé en cours…" : "Actualiser maintenant", disabled: !!enAttente, onclick: () => lancerRobot(false) }) : null,
        etatRobot ? h("span", { class: "petit muet", text: etatRobot }) : null)),
      r.trigger ? h("div", { class: "actions petit" },
        h("label", { class: "case" }, h("input", { type: "checkbox", id: "cours-auto", checked: !!auto.actif, onchange: e => modifier("strategie", st => { st.profil.coursAuto = { ...(st.profil.coursAuto || {}), actif: e.target.checked }; }) }),
          h("span", { text: "Actualiser à l'ouverture de la page quand les cours ont plus de" })), selMin,
        h("span", { class: "muet", text: `· chaque relevé prend une demi-minute de ton usage Claude${r.horaire ? " · relevé automatique " + r.horaire : ""}` })) : null,
      erreurs.length ? h("details", {}, h("summary", { text: `${erreurs.length} ligne${erreurs.length > 1 ? "s" : ""} sans cours en direct` }),
        h("ul", { class: "constats" }, erreurs.map(e => h("li", {}, pastille("info", "Info"), h("p", { text: `${e.ligne} : ${e.message}` }))))) : null);
  }

  // ---------- Mon mois : le tableau du début de mois ----------
  // La paie de fin de mois finance le mois suivant : à partir du 25 (réglable), on prépare déjà le mois qui vient.
  const moisParDefaut = () => { const auj = new Date(); return jourDecalage() > 0 && auj.getDate() >= jourDecalage() ? decalerMois(cleMois(auj), 1) : cleMois(auj); };
  let moisTableau = null;
  // Ce que la page propose tant qu'une case n'est pas remplie : les opérations du mois, sinon le mois d'avant ou le budget prévu.
  function suggestionsMois(cle) {
    const ops = mouvementsDuMois(cle), pv = S.budget.prevu;
    const recu = cat => somme(ops.filter(m => m.categorie === cat && m.montant > 0), m => m.montant);
    const avant = Object.keys(S.budget.mensuel || {}).filter(k => k < cle).sort().map(k => S.budget.mensuel[k]);
    const dernier = c => { for (let i = avant.length - 1; i >= 0; i--) if (avant[i][c] != null) return avant[i][c]; return null; };
    const p = paie(), netPaie = num(S.budget.paie && S.budget.paie.brut) ? Math.round(netDepuisBrut(p.brut).net * (1 - p.pas / 100) * 100) / 100 : num(pv.salaire);
    return {
      salaire: recu("salaire") || netPaie,
      primeActivite: recu("aides") || num(pv.aides),
      autres: dernier("autres") ?? num(pv["autres-revenus"]),
      fixes: dernier("fixes") ?? somme(B.CATEGORIES_BUDGET.filter(c => c.type === "depense" && c.fixe), c => num(pv[c.id])),
      variables: dernier("variables") ?? somme(B.CATEGORIES_BUDGET.filter(c => c.type === "depense" && !c.fixe), c => num(pv[c.id]))
    };
  }
  // Le partage du mois : d'abord les dépenses (gardées sur le compte courant), puis le plan de ta stratégie
  // (épargne de précaution en premier), et ce qui dépasse le plan suit ta règle des rentrées en plus.
  function monMois(cle) {
    const e = (S.budget.mensuel || {})[cle] || {}, sug = suggestionsMois(cle);
    const v = c => e[c] != null ? num(e[c]) : num(sug[c]);
    const revenus = v("salaire") + v("primeActivite") + v("autres"), depenses = v("fixes") + v("variables");
    const dispo = revenus - depenses, pl = planDuMois();
    let precaution = 0, investir = 0, plaisir = 0, surplus = 0;
    if (dispo > 0) {
      precaution = Math.min(dispo, pl.versEpargne);
      investir = Math.min(dispo - precaution, pl.investir);
      surplus = dispo - precaution - investir;
      if (surplus >= 1) { const c = conseilRentree(surplus, precaution); precaution += c.prec + c.enPlus; investir += c.investir; plaisir = c.plaisir; }
    }
    precaution = Math.floor(precaution); investir = Math.floor(investir);
    const garder = Math.round((revenus - precaution - investir) * 100) / 100;
    const lignes = investir > 0 ? repartirVersement(investir, synthese()) : [];
    const enveloppes = [...new Set(lignes.filter(x => x.ligne).map(x => x.ligne.enveloppe))];
    return { cle, e, sug, v, revenus, depenses, dispo, precaution, investir, garder, plaisir, surplus, plan: pl.versEpargne + pl.investir, pl, lignes, enveloppes, rempli: CHAMPS_MOIS.filter(c => e[c] != null).length };
  }
  const moisMM = () => moisTableau || moisParDefaut();
  // Les cases de « Mon mois » et le détail que chacune ouvre sous les cases.
  const CAT_FIXES = B.CATEGORIES_BUDGET.filter(c => c.type === "depense" && c.fixe).map(c => c.id);
  const CAT_VARIABLES = B.CATEGORIES_BUDGET.filter(c => c.type === "depense" && !c.fixe).map(c => c.id);
  const CASES_MM = {
    salaire: { nom: "Salaire", champ: "salaire", cats: ["salaire"], blocs: ["mmd-paie"], lib: "Salaire reçu pour ce mois (€)" },
    primeActivite: { nom: "Prime d'activité", champ: "primeActivite", cats: ["aides"], lib: "Prime d'activité du mois (€)" },
    autres: { nom: "Autres revenus prévus", champ: "autres", cats: ["autres-revenus"], lib: "Autres revenus prévus (€)" },
    fixes: { nom: "Dépenses fixes", champ: "fixes", cats: CAT_FIXES, lib: "Dépenses fixes prévues (€)" },
    variables: { nom: "Dépenses variables", champ: "variables", cats: CAT_VARIABLES, lib: "Dépenses variables prévues (€)" },
    courant: { nom: "Compte courant", cats: [...CAT_FIXES, ...CAT_VARIABLES] },
    cote: { nom: "Mis de côté", cats: ["epargne"], blocs: ["mmd-precaution", "mmd-investir"] },
    lep: { nom: "Épargne de précaution", cats: ["epargne"], blocs: ["mmd-precaution"] },
    pea: { nom: "Investissements", cats: ["epargne"], blocs: ["mmd-investir"] }
  };
  let detailMM = null;
  const nomCourt = nom => String(nom).replace(/\s*\(.*\)\s*$/, "");
  const montantMM = x => eur(x, Math.abs(x % 1) > 0.004 ? 2 : 0);
  const nomInvest = r => r.enveloppes.length === 1 ? (r.enveloppes[0] === "PEA" ? "PEA" : (B.ENVELOPPES.find(x => x.id === r.enveloppes[0]) || {}).nom || r.enveloppes[0]) : "Investissements";
  const reelMM = (cle, cats) => somme(mouvementsDuMois(cle).filter(m => cats.includes(m.categorie)), m => m.montant);

  function rendreMonMois(forcer) {
    const cle = moisMM(), r = monMois(cle), pl = r.pl, mois = nomMois(cle).split(" ")[0];
    $("b-importer").hidden = !claudePret;
    $("mm-titre").textContent = "Mon mois de " + mois + (cle.slice(0, 4) !== String(new Date().getFullYear()) ? " " + cle.slice(0, 4) : "");
    const caseMM = (cleCase, lib, montant, sous, cls) => h("button", { type: "button", class: "case" + (cls ? " " + cls : ""), "data-detail": cleCase, "aria-pressed": detailMM === cleCase ? "true" : "false" },
      h("span", { class: "case-etiquette", text: lib }), h("span", { class: "case-montant", text: montantMM(montant) }), sous ? h("span", { class: "case-sous", text: sous }) : null);
    const sousEntree = c => {
      if (c === "fixes" || c === "variables") { const d = -reelMM(cle, CASES_MM[c].cats); return d > 0 ? `${eur(d, 0)} dépensés` : r.e[c] == null ? "proposé" : null; }
      return r.e[c] == null ? "proposé" : null;
    };
    vider($("mm-entrees"), CHAMPS_MOIS.map(c => caseMM(c, CASES_MM[c].nom, r.v(c), sousEntree(c), r.e[c] == null ? "estime" : null)));
    $("mm-courant-titre").textContent = `Compte courant : ${montantMM(r.garder)}`;
    $("mm-courant-titre").setAttribute("aria-pressed", detailMM === "courant" ? "true" : "false");
    vider($("mm-courant"), caseMM("fixes", "Dépenses fixes", r.v("fixes"), null), caseMM("variables", "Dépenses variables", r.v("variables"), r.plaisir ? `+ ${eur(r.plaisir, 0)} pour toi` : null));
    const cote = r.precaution + r.investir, taux = r.revenus > 0 ? cote / r.revenus * 100 : null;
    $("mm-cote-titre").textContent = `Mis de côté : ${montantMM(cote)}${taux != null ? ` · ${pct(taux, 0)} d'épargne` : ""}`;
    $("mm-cote-titre").setAttribute("aria-pressed", detailMM === "cote" ? "true" : "false");
    vider($("mm-cote"), caseMM("lep", pl.compte ? nomCourt(pl.compte.nom) : "Épargne de précaution", r.precaution, pl.compte ? "épargne de précaution" : null),
      caseMM("pea", nomInvest(r), r.investir, r.lignes.length === 1 && r.lignes[0].ligne ? r.lignes[0].poche.nom : null));
    const notes = [];
    if (r.dispo < 0) notes.push(`Tes dépenses dépassent tes revenus de ${eur(-r.dispo, 0)} : rien à mettre de côté ce mois-ci.`);
    else if (r.dispo < r.plan - 0.5) notes.push(`Il manque ${eur(r.plan - r.dispo, 0)} pour suivre ton plan (${eur(pl.versEpargne, 0)} d'épargne et ${eur(pl.investir, 0)} investis) : ton épargne de précaution passe en premier.`);
    else if (r.surplus >= 1) notes.push(`${eur(r.surplus, 0)} de plus que ton plan (${eur(pl.versEpargne, 0)} + ${eur(pl.investir, 0)}) : ${pl.manque > 0 ? "ils complètent d'abord ton épargne de précaution, comme une prime" : "ils suivent le partage de ta stratégie"}.`);
    if (r.rempli < CHAMPS_MOIS.length) notes.push("Les cases « proposé » viennent de tes opérations ou du mois d'avant : clique dessus pour mettre ton montant.");
    $("mm-note").textContent = notes.join(" ");
    rendreDetailMM(forcer);
  }

  // Le détail d'une case, sous les cases : son montant, ce qui s'est passé dans le mois, et ses outils.
  function rendreDetailMM(forcer) {
    const cle = moisMM(), r = monMois(cle), pl = r.pl, mois = nomMois(cle).split(" ")[0];
    const cfg = detailMM ? CASES_MM[detailMM] : null;
    $("mmd-titre").textContent = cfg ? `${detailMM === "lep" && pl.compte ? nomCourt(pl.compte.nom) : detailMM === "pea" ? nomInvest(r) : cfg.nom} · ${mois}` : `Mes opérations de ${mois}`;
    $("mmd-intro").textContent = cfg ? "" : "Clique sur une case du tableau pour voir son détail ici.";
    $("mmd-intro").hidden = !!cfg;
    $("mmd-montant-zone").hidden = !(cfg && cfg.champ);
    if (cfg && cfg.champ) {
      const el = $("mmd-montant");
      $("mmd-montant-lib").textContent = cfg.lib;
      el.placeholder = nf(0, 2).format(num(r.sug[cfg.champ]));
      if (forcer || !aFocus(el)) el.value = r.e[cfg.champ] != null ? String(r.e[cfg.champ]) : "";
      $("mmd-montant-aide").textContent = r.e[cfg.champ] == null ? `La page propose ${eur(num(r.sug[cfg.champ]), 2)} (${
        { salaire: "ta paie reçue pour ce mois, sinon ta paie calculée", primeActivite: "ta prime d'activité reçue, sinon celle de ton budget", autres: "le mois d'avant", fixes: "le mois d'avant", variables: "le mois d'avant" }[cfg.champ]}) : tape ton montant pour le remplacer.` : "Efface la case pour revenir au montant proposé par la page.";
    }
    for (const b of ["mmd-paie", "mmd-precaution", "mmd-investir"]) $(b).hidden = !(cfg && (cfg.blocs || []).includes(b));
    const lignes = [];
    const ligneTxt = t => lignes.push(h("p", { text: t }));
    if (cfg) {
      const reel = reelMM(cle, cfg.cats);
      if (detailMM === "fixes" || detailMM === "variables") {
        const prevu = r.v(detailMM), depense = Math.max(0, -reel);
        ligneTxt(`Dépensé en ${mois} : ${eur(depense, 2)} sur ${eur(prevu, 0)} prévus${depense > prevu ? ` (${eur(depense - prevu, 0)} de plus)` : ` (il reste ${eur(prevu - depense, 0)})`}.`);
        lignes.push(h("p", { class: "petit muet", text: detailMM === "fixes" ? `Comptées ici : ${CAT_FIXES.map(c => CAT[c].nom.toLowerCase()).join(", ")}.` : `Comptées ici : ${CAT_VARIABLES.map(c => CAT[c].nom.toLowerCase()).join(", ")}. Un retrait d'espèces compte comme dépensé, même s'il te reste des billets.` }));
      } else if (detailMM === "courant") {
        const cc = S.portefeuille.comptes.find(c => c.type === "courant");
        ligneTxt(`À garder sur le compte courant : ${montantMM(r.garder)}, pour tes dépenses fixes (${eur(r.v("fixes"), 0)}) et variables (${eur(r.v("variables"), 0)})${r.plaisir ? ` et ${eur(r.plaisir, 0)} pour te faire plaisir` : ""}.`);
        ligneTxt(`Dépensé en ${mois} : ${eur(Math.max(0, -reel), 2)}.${cc ? ` Solde du ${cc.nom.toLowerCase()} : ${eur(num(cc.solde), 2)} (à mettre à jour dans la page Épargne).` : ""}`);
      } else if (detailMM === "cote" || detailMM === "lep" || detailMM === "pea") {
        if (detailMM !== "pea") ligneTxt(`À verser sur ${pl.compte ? pl.compte.nom : "ton épargne de précaution"} : ${eur(r.precaution, 0)}${r.precaution > pl.versEpargne + 0.5 ? ` = ${eur(pl.versEpargne, 0)} prévus par ta stratégie + ${eur(r.precaution - pl.versEpargne, 0)} en plus de ton plan, qui complètent d'abord ton épargne de précaution` : r.precaution < pl.versEpargne - 0.5 ? `, au lieu des ${eur(pl.versEpargne, 0)} prévus : ce mois-ci, l'argent manque` : ", comme prévu par ta stratégie"}.`);
        if (detailMM !== "lep") ligneTxt(`À verser sur le ${nomInvest(r)} : ${eur(r.investir, 0)}${r.investir < pl.investir - 0.5 ? `, au lieu des ${eur(pl.investir, 0)} prévus` : r.investir > pl.investir + 0.5 ? ` = ${eur(pl.investir, 0)} prévus + ${eur(r.investir - pl.investir, 0)} en plus` : ", comme prévu par ta stratégie"}.`);
        if (detailMM === "cote" && r.revenus > 0) ligneTxt(`En tout : ${eur(r.precaution + r.investir, 0)} mis de côté, soit ${pct((r.precaution + r.investir) / r.revenus * 100, 0)} de tes revenus du mois.`);
        if (reel) lignes.push(h("p", { class: "petit muet", text: `Déjà versé en ${mois} d'après tes opérations : ${eur(Math.max(0, -reel), 2)}.` }));
      } else if (reel) ligneTxt(`Reçu en ${mois} d'après tes opérations : ${eur(reel, 2)}.`);
    }
    vider($("mmd-contenu"), lignes);
    if (!$("mmd-investir").hidden) rendreVersement(synthese());
    rendreOperations();
  }
  $("vue-mois").addEventListener("click", e => {
    const b = e.target.closest("[data-detail]");
    if (!b) return;
    detailMM = detailMM === b.dataset.detail ? null : b.dataset.detail;
    rendreMonMois(true);
    $("mm-detail").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("mmd-montant").addEventListener("input", e => {
    const cfg = detailMM && CASES_MM[detailMM];
    if (!cfg || !cfg.champ) return;
    const cle = moisMM();
    S.budget.mensuel ||= {};
    const m = (S.budget.mensuel[cle] ||= {});
    if (e.target.value === "") delete m[cfg.champ]; else m[cfg.champ] = num(e.target.value);
    if (!Object.keys(m).length) delete S.budget.mensuel[cle];
    enregistrer("budget"); rendreMonMois();
  });
  $("mm-prec").addEventListener("click", () => { moisTableau = decalerMois(moisMM(), -1); rendreMonMois(true); });
  $("mm-suiv").addEventListener("click", () => { moisTableau = decalerMois(moisMM(), 1); rendreMonMois(true); });
  // De l'argent imprévu : on en parle avec Claude, avec ce que propose la stratégie.
  $("mm-imprevu").addEventListener("click", () => {
    const f = $("mm-imprevu-fiche"); f.hidden = !f.hidden;
    $("mm-imprevu").setAttribute("aria-expanded", f.hidden ? "false" : "true");
    if (!f.hidden) $("mm-imprevu-montant").focus();
  });
  $("mm-imprevu-annuler").addEventListener("click", () => { $("mm-imprevu-fiche").hidden = true; $("mm-imprevu").setAttribute("aria-expanded", "false"); });
  $("mm-imprevu-fiche").addEventListener("submit", e => {
    e.preventDefault();
    const m = num($("mm-imprevu-montant").value), origine = $("mm-imprevu-origine").value.trim();
    if (!(m > 0)) return;
    const c = conseilRentree(m);
    const propose = [c.plaisir ? `${eur(c.plaisir, 0)} pour me faire plaisir` : "", ...c.versComptes.map(v => `${eur(v.montant, 0)} sur ${v.compte ? v.compte.nom : "un livret"}`), ...c.plan.map(x => `${eur(x.montant, 0)} sur ${x.ligne ? x.ligne.nom : x.poche.nom}`)].filter(Boolean).join(", ");
    const texte = `Je viens de recevoir ${eur(m, 2)}${origine ? ` (${origine})` : ""}, que je n'avais pas prévu. La page propose : ${propose || "rien à placer"}. Qu'est-ce que j'en fais ?`;
    $("mm-imprevu-fiche").hidden = true; $("mm-imprevu").setAttribute("aria-expanded", "false");
    $("mm-imprevu-montant").value = ""; $("mm-imprevu-origine").value = "";
    if (claudePret) { montrer("claude"); envoyerChat(texte); } else demanderDansChat(texte);
  });

  // ---------- historique du patrimoine ----------
  const totalPoint = p => num(p.epargne) + num(p.bourse) + num(p.crypto);
  function noterPoint() {
    if (S.portefeuille.exemple || S.portefeuille.comptes.some(estExempleCompte)) return;
    const syn = synthese(), pat = patrimoine(syn);
    const pts = S.historique.points;
    if (pat.total <= 0 && !pts.length) return;
    const r2 = x => Math.round(x * 100) / 100;
    const pt = { date: aujourdhui(), epargne: r2(pat.epargne), precaution: r2(pat.precaution), bourse: r2(pat.bourse), crypto: r2(pat.crypto), investi: r2(syn.investi) };
    const der = pts[pts.length - 1];
    if (der && der.date === pt.date && ["epargne", "precaution", "bourse", "crypto", "investi"].every(k => num(der[k]) === pt[k])) return;
    if (der && der.date === pt.date) pts[pts.length - 1] = pt; else pts.push(pt);
    // Au-delà de 1 000 relevés, on garde un point sur deux dans la plus ancienne moitié.
    if (pts.length > 1000) S.historique.points = pts.filter((_, i) => i >= 500 || i % 2 === 0);
    enregistrer("historique");
  }
  // Période affichée : mémorisée dans ce navigateur (une préférence d'affichage, pas une donnée).
  const PERIODES = [{ id: "1j", nom: "1 jour" }, { id: "1s", nom: "1 semaine", jours: 7 }, { id: "1m", nom: "1 mois", mois: 1 }, { id: "1a", nom: "1 an", mois: 12 }, { id: "tout", nom: "MAX" }, { id: "choix", nom: "Période" }];
  const vueHisto = (() => {
    let v = { periode: "tout", mode: "total" };
    try { v = { ...v, ...JSON.parse(localStorage.getItem(CLE("vue-historique")) || "{}") }; } catch (_) {}
    if (v.periode === "zoom") v.periode = "choix";
    if (!PERIODES.some(x => x.id === v.periode)) v.periode = "tout";
    return v;
  })();
  const garderVueHisto = () => { try { localStorage.setItem(CLE("vue-historique"), JSON.stringify(vueHisto)); } catch (_) {} };
  const pasRond = brut => { const e = Math.pow(10, Math.floor(Math.log10(Math.max(brut, 1e-9)))), f = brut / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e; };
  function rendreHistorique() {
    const tous = S.historique.points, z = $("historique-graphe");
    const fin = tous.length ? tous[tous.length - 1].date : aujourdhui();
    // Bornes de la période choisie (ou du zoom fait à la souris ou au doigt).
    // 1 jour : depuis le relevé précédent (un relevé par jour). Période : les dates choisies, ou la zone glissée sur la courbe.
    let debutP = "", finP = fin;
    const per = PERIODES.find(x => x.id === vueHisto.periode);
    if (vueHisto.periode === "1j") debutP = tous.length >= 2 ? tous[tous.length - 2].date : fin;
    else if (vueHisto.periode === "choix") { debutP = vueHisto.du || (tous[0] || {}).date || fin; finP = vueHisto.au || fin; if (debutP > finP) [debutP, finP] = [finP, debutP]; }
    else if (per && per.jours) debutP = isoDate(new Date(new Date(fin + "T12:00:00").getTime() - per.jours * 86400000));
    else if (per && per.mois) debutP = ajouterMois(fin, -per.mois);
    const pts = tous.filter(p => (!debutP || p.date >= debutP) && p.date <= finP);
    const segments = (nom, liste, actif, f) => h("div", { class: "segments", role: "radiogroup", "aria-label": nom }, liste.map(x => h("label", {},
      h("input", { type: "radio", name: "h-" + nom, value: x.id, checked: x.id === actif, onchange: () => f(x.id) }), h("span", { text: x.nom }))));
    const zo = $("historique-outils");
    if (!enSaisie(zo)) vider(zo, tous.length >= 2 ? [
      segments("Période", PERIODES, vueHisto.periode, id => { vueHisto.periode = id; if (id === "choix") { vueHisto.du = debutP || tous[0].date; vueHisto.au = finP; } garderVueHisto(); rendreHistorique(); }),
      segments("Affichage", [{ id: "total", nom: "Total" }, { id: "detail", nom: "Détail" }], vueHisto.mode, id => { vueHisto.mode = id; garderVueHisto(); rendreHistorique(); }),
      vueHisto.periode === "choix" ? h("div", { class: "actions periode-dates" },
        h("label", { class: "champ" }, h("span", { text: "Du" }), h("input", { type: "date", value: debutP, min: tous[0].date, max: fin, onchange: e => { if (e.target.value) { vueHisto.du = e.target.value; garderVueHisto(); e.target.blur(); rendreHistorique(); } } })),
        h("label", { class: "champ" }, h("span", { text: "Au" }), h("input", { type: "date", value: finP, min: tous[0].date, max: fin, onchange: e => { if (e.target.value) { vueHisto.au = e.target.value; garderVueHisto(); e.target.blur(); rendreHistorique(); } } }))) : null] : null);
    const series = [
      { cle: "epargne", nom: "Épargne", couleur: COULEURS_PATRIMOINE.epargne },
      { cle: "bourse", nom: "Bourse", couleur: COULEURS_PATRIMOINE.bourse },
      { cle: "crypto", nom: "Crypto", couleur: COULEURS_PATRIMOINE.crypto }
    ].filter(se => tous.some(p => num(p[se.cle]) > 0));
    const detail = vueHisto.mode === "detail";
    $("historique-note").textContent = tous.length ? `${tous.length} relevé${tous.length > 1 ? "s" : ""} depuis le ${dateFr(tous[0].date)}` : "";
    vider($("historique-legende"), pts.length >= 2 && detail ? series.map(se => h("span", {}, h("i", { class: "puce", style: "background:" + se.couleur }), se.nom)) : null);
    $("historique-aide").textContent = "";
    if (tous.length < 2) {
      const base = "La courbe se dessine à chaque mise à jour de tes cours ou de tes soldes, un point par jour.";
      vider(z, h("p", { class: "vide", text: S.portefeuille.exemple || S.portefeuille.comptes.some(estExempleCompte)
        ? "La courbe démarre avec tes vrais chiffres : rien n'est noté tant que l'exemple est affiché."
        : tous.length ? `Premier relevé le ${dateFr(tous[0].date)} : ${eur(totalPoint(tous[0]), 0)}. ${base}` : base }));
      return;
    }
    if (pts.length < 2) { vider(z, h("p", { class: "vide", text: `Pas assez de relevés sur cette période (un relevé par jour, le premier le ${dateFr(tous[0].date)}). Choisis une période plus longue.` })); return; }
    if (!z.clientWidth) return;
    // Ce qui a changé sur la période : la variation totale, dont les plus-values.
    const p0 = pts[0], p1 = pts[pts.length - 1], dTotal = totalPoint(p1) - totalPoint(p0);
    const pvDe = p => num(p.bourse) + num(p.crypto) - num(p.investi), dPv = pvDe(p1) - pvDe(p0);
    $("historique-aide").textContent = `Du ${dateFr(p0.date)} au ${dateFr(p1.date)} : ${eurSigne(dTotal)} (${pctSigne(dTotal / Math.max(1, totalPoint(p0)) * 100)})${num(p1.investi) > 0 ? `, dont ${eurSigne(dPv)} de plus-values ; le reste vient de tes versements et de ton épargne` : ""}. Fais glisser sur la courbe pour zoomer.`;
    // À côté de la pyramide, la courbe prend la hauteur de la carte.
    const W = Math.round(Math.max(300, Math.min(900, z.clientWidth))), H = W < 520 ? 200 : window.innerWidth >= 1000 ? 330 : 240, m = { g: 56, d: 14, h: 10, b: 26 };
    const t = p => new Date(p.date + "T12:00:00").getTime();
    const t0 = t(p0), t1 = t(p1);
    // Total : l'échelle suit la période, pour voir les variations. Détail : les trois parts empilées depuis 0.
    let ymin = 0, ymax, pas;
    if (detail) {
      const brut = Math.max(1, ...pts.map(totalPoint));
      pas = pasRond(brut / 4); ymax = Math.ceil(brut / pas) * pas;
    } else {
      const vals = pts.map(totalPoint), lo = Math.min(...vals), hi = Math.max(...vals), marge = Math.max((hi - lo) * 0.15, hi * 0.002, 1);
      pas = pasRond((hi - lo + 2 * marge) / 4);
      ymin = Math.max(0, Math.floor((lo - marge) / pas) * pas); ymax = Math.ceil((hi + marge) / pas) * pas;
    }
    const x = p => m.g + (t(p) - t0) / Math.max(1, t1 - t0) * (W - m.g - m.d);
    const y = v => m.h + (1 - (v - ymin) / Math.max(1e-9, ymax - ymin)) * (H - m.h - m.b);
    const NS = "http://www.w3.org/2000/svg";
    const sv = (tag, attrs, txt) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (txt != null) e.textContent = txt; return e; };
    const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": `Patrimoine du ${dateFr(p0.date)} au ${dateFr(p1.date)} : de ${eur(totalPoint(p0), 0)} à ${eur(totalPoint(p1), 0)}` });
    for (let v = ymin; v <= ymax + 1e-6; v += pas) {
      svg.append(sv("line", { class: "grille-h", x1: m.g, x2: W - m.d, y1: y(v), y2: y(v) }));
      // Échelle serrée (vue Total) : les euros en entier, sinon tous les repères liraient « 41 k€ ».
      svg.append(sv("text", { x: m.g - 8, y: y(v) + 4, "text-anchor": "end" }, pas >= 1000 ? compact(v) : nf(0, 0).format(v)));
    }
    const jours = (t1 - t0) / 86400000;
    const fmt = jours > 75 ? { month: "short", year: "2-digit" } : { day: "numeric", month: "short" };
    const nbTicks = Math.max(2, Math.min(6, Math.floor((W - m.g - m.d) / 90), Math.round(jours) + 1));
    for (let k = 0; k < nbTicks; k++) {
      const tk = t0 + (t1 - t0) * k / (nbTicks - 1);
      const xx = m.g + k / (nbTicks - 1) * (W - m.g - m.d);
      svg.append(sv("text", { x: xx, y: H - 8, "text-anchor": k === 0 ? "start" : k === nbTicks - 1 ? "end" : "middle" }, new Date(tk).toLocaleDateString("fr-FR", fmt)));
    }
    if (ymin === 0) svg.append(sv("line", { class: "axe", x1: m.g, x2: W - m.d, y1: y(0), y2: y(0) }));
    let couleurPoint = "var(--accent)";
    if (detail) {
      const cumul = pts.map(() => 0);
      for (const se of series) {
        const bas = cumul.slice();
        pts.forEach((p, i) => { cumul[i] += num(p[se.cle]); });
        const haut = pts.map((p, i) => `${x(p)},${y(cumul[i])}`);
        const dessous = pts.map((p, i) => `${x(p)},${y(bas[i])}`).reverse();
        svg.append(sv("polygon", { points: [...haut, ...dessous].join(" "), style: `fill:${se.couleur};opacity:0.16;stroke:none` }));
        svg.append(sv("polyline", { points: haut.join(" "), style: `fill:none;stroke:${se.couleur};stroke-width:2;stroke-linejoin:round;stroke-linecap:round` }));
      }
      if (series.length) couleurPoint = series[series.length - 1].couleur;
    } else {
      const ligneTotal = pts.map(p => `${x(p)},${y(totalPoint(p))}`);
      svg.append(sv("polygon", { points: [...ligneTotal, `${x(p1)},${H - m.b}`, `${x(p0)},${H - m.b}`].join(" "), style: "fill:var(--accent);opacity:0.1;stroke:none" }));
      svg.append(sv("polyline", { points: ligneTotal.join(" "), style: "fill:none;stroke:var(--accent);stroke-width:2;stroke-linejoin:round;stroke-linecap:round" }));
    }
    svg.append(sv("circle", { cx: x(p1), cy: y(totalPoint(p1)), r: 4, style: `fill:${couleurPoint};stroke:var(--surface);stroke-width:2` }));
    const repere = sv("line", { x1: 0, x2: 0, y1: m.h, y2: H - m.b, style: "stroke:var(--encre-2);stroke-width:1;opacity:0", "pointer-events": "none" });
    const selection = sv("rect", { class: "selection-zoom", x: 0, y: m.h, width: 0, height: H - m.h - m.b, "pointer-events": "none" });
    svg.append(repere, selection);
    const zone = sv("rect", { x: m.g, y: m.h, width: W - m.g - m.d, height: H - m.h - m.b, style: "fill:transparent;cursor:crosshair;touch-action:pan-y" });
    svg.append(zone);
    const bulle = h("div", { class: "info-bulle", hidden: true });
    vider(z, svg, bulle);
    const versX = clientX => { const r = svg.getBoundingClientRect(); return Math.max(m.g, Math.min(W - m.d, (clientX - r.left) / r.width * W)); };
    const montrerPoint = clientX => {
      const r = svg.getBoundingClientRect(), px = versX(clientX);
      let i = 0, best = Infinity;
      pts.forEach((p, k) => { const d = Math.abs(x(p) - px); if (d < best) { best = d; i = k; } });
      const p = pts[i];
      repere.setAttribute("x1", x(p)); repere.setAttribute("x2", x(p)); repere.style.opacity = "0.5";
      vider(bulle, h("b", { text: dateFr(p.date) }),
        series.map(se => h("div", { class: "ligne-serie" }, h("span", {}, h("span", { class: "puce", style: "background:" + se.couleur + ";margin-right:6px" }), se.nom), h("span", { class: "chiffre", text: eur(num(p[se.cle]), 0) }))),
        h("div", { class: "ligne-serie" }, h("b", { text: "Total" }), h("b", { class: "chiffre", text: eur(totalPoint(p), 0) })),
        num(p.investi) > 0 ? h("div", { class: "ligne-serie muet" }, h("span", { text: "dont plus-values latentes" }), h("span", { class: "chiffre", text: eurSigne(pvDe(p)) })) : null);
      bulle.hidden = false;
      const gauche = x(p) / W * r.width, largeur = bulle.offsetWidth || 190;
      bulle.style.left = (gauche + 12 + largeur > r.width ? Math.max(0, gauche - 12 - largeur) : gauche + 12) + "px";
      bulle.style.top = "8px";
    };
    // Glisser pour zoomer : la zone choisie devient la période affichée.
    let depart = null;
    zone.addEventListener("pointerdown", e => { depart = versX(e.clientX); try { zone.setPointerCapture(e.pointerId); } catch (_) {} montrerPoint(e.clientX); });
    zone.addEventListener("pointermove", e => {
      if (depart != null && Math.abs(versX(e.clientX) - depart) > 8) {
        const a = Math.min(depart, versX(e.clientX)), b = Math.max(depart, versX(e.clientX));
        selection.setAttribute("x", a); selection.setAttribute("width", b - a);
        bulle.hidden = true; repere.style.opacity = "0";
        return;
      }
      montrerPoint(e.clientX);
    });
    const finir = e => {
      if (depart == null) return;
      const a = Math.min(depart, versX(e.clientX)), b = Math.max(depart, versX(e.clientX));
      depart = null; selection.setAttribute("width", 0);
      if (b - a <= 8) return;
      // Les relevés dans la zone choisie fixent la nouvelle période.
      const dedans = pts.filter(p => x(p) >= a - 2 && x(p) <= b + 2);
      if (dedans.length < 2) { $("historique-aide").textContent = "Sélectionne une zone qui contient au moins deux relevés."; return; }
      Object.assign(vueHisto, { periode: "choix", du: dedans[0].date, au: dedans[dedans.length - 1].date }); garderVueHisto(); rendreHistorique();
    };
    zone.addEventListener("pointerup", finir);
    zone.addEventListener("pointercancel", () => { depart = null; selection.setAttribute("width", 0); });
    zone.addEventListener("pointerleave", () => { if (depart == null) { bulle.hidden = true; repere.style.opacity = "0"; } });
  }

  function rendreRepartition(syn) {
    const z = $("repartition");
    const marge = num(S.strategie.regles.marge);
    $("repart-note").textContent = `Marge ± ${nf(0, 1).format(marge)} pt` + (syn.lignes.some(estFonds) ? ` · frais moyens ${pct(syn.fraisMoyen, 2)} / an` : "");
    const ech = Math.max(100, ...syn.poches.map(p => Math.max(p.poids, num(p.cible) + marge)));
    const ligne = (nom, poids, cible, sousTitre, niveau) => h("div", { class: "repart-ligne" },
      h("div", { class: "repart-tete" },
        h("span", {}, h("b", { text: nom }), sousTitre ? h("span", { class: "muet petit", text: " · " + sousTitre }) : null),
        h("span", { class: "actions" },
          h("span", { class: "chiffre", text: pct(poids) + (cible != null ? " / " + pct(cible, 0) : "") }),
          niveau ? pastille(niveau[0], niveau[1]) : null)),
      h("div", { class: "piste", role: "img", "aria-label": `${nom} : ${pct(poids)}${cible != null ? ", cible " + pct(cible, 0) : ""}` },
        cible != null ? h("div", { class: "marge", style: `left:${Math.max(0, cible - marge) / ech * 100}%;width:${(Math.min(ech, cible + marge) - Math.max(0, cible - marge)) / ech * 100}%` }) : null,
        h("div", { class: "rempli", style: `width:${Math.min(100, poids / ech * 100)}%` }),
        cible != null ? h("div", { class: "cible", style: `left:calc(${cible / ech * 100}% - 1px)` }) : null));
    const rangs = syn.poches.map(p => {
      const c = num(p.cible);
      let niveau = null;
      if (syn.total > 0) niveau = p.ecart < -marge ? ["attention", "à renforcer"] : p.ecart > marge ? ["attention", "trop lourde"] : ["ok", "dans la marge"];
      return ligne(p.nom, p.poids, c, CLASSE[p.classe]?.nom, niveau);
    });
    if (syn.hors.length) rangs.push(ligne("Hors stratégie", syn.horsValeur / (syn.total || 1) * 100, null, syn.hors.length + (syn.hors.length > 1 ? " lignes" : " ligne"), ["info", "sans poche"]));
    vider(z, rangs.length ? rangs : h("p", { class: "vide", text: "Définis ton allocation cible dans Ma stratégie." }));
  }

  function rendreVersement(syn) {
    const pl = planDuMois(), mm = monMois(moisTableau || moisParDefaut());
    const champ = $("versement-montant");
    if (!champ.dataset.touche && !aFocus(champ)) champ.value = mm.investir || "";
    const montant = num(champ.value);
    const z = $("versement-resultat");
    if (!(montant > 0)) { vider(z, h("p", { class: "vide", text: pl.vi > 0 || pl.vp > 0 ? "Rien à investir ce mois-ci : tout va à ton épargne de précaution." : "Indique un montant." })); return; }
    const plan = repartirVersement(montant, syn);
    if (!plan.length) { vider(z, h("p", { class: "vide", text: "Ajoute des poches avec une cible dans Ma stratégie." })); return; }
    const detail = x => {
      const l = x.ligne;
      if (l.sansQuantite) return l.enveloppe;
      if (enFractions(l)) return `${(B.ENVELOPPES.find(e => e.id === l.enveloppe) || {}).nom || l.enveloppe} · montant exact, en fractions`;
      return x.parts > 0 ? `≈ ${x.parts} part${x.parts > 1 ? "s" : ""} à ${eur(l.coursEff, 2)}` : `moins d'une part (${eur(l.coursEff, 2)})`;
    };
    vider(z, h("div", { class: "defile" }, h("table", {},
      h("thead", {}, h("tr", {}, h("th", { text: "Poche" }), h("th", { text: "Sur quelle ligne" }), h("th", { class: "num", text: "Montant" }), h("th", { class: "num", text: "Poids après" }))),
      h("tbody", {}, plan.map(x => h("tr", {},
        h("td", { text: x.poche.nom }),
        h("td", {}, x.ligne ? h("div", { class: "nom-ligne", style: "min-width:120px" }, h("span", { text: x.ligne.nom }), h("small", { text: detail(x) })) : h("span", { class: "muet", text: "ligne à choisir" })),
        h("td", { class: "num chiffre", text: eur(x.montant, 0) }),
        h("td", { class: "num" }, h("div", { class: "nom-ligne", style: "min-width:0" }, h("span", { class: "chiffre", text: pct(x.poidsApres) }), h("small", { text: "cible " + pct(num(x.poche.cible), 0) })))))))),
      estTR() ? h("p", { class: "note", text: "Sur Trade Republic, un plan d'investissement programmé fait ces achats chaque mois sans frais, alors qu'un ordre ponctuel coûte 1 €. Sur le PEA, il n'achète que des parts entières." }) : null,
      h("div", { class: "actions" }, claudePret ? h("button", { class: "btn btn-ghost btn-petit", text: "En parler à Claude", onclick: () => demanderDansChat(`Ce mois-ci, l'outil propose : ${pl.versEpargne > 0 ? `${eur(pl.versEpargne, 0)} sur ${pl.compte ? pl.compte.nom : "mon livret"} pour mon épargne de précaution, et ` : ""}${eur(montant, 0)} à investir : ${plan.map(x => `${x.poche.nom} ${eur(x.montant, 0)}`).join(", ")}. Qu'en penses-tu au regard de ma stratégie ?`) }) : null));
  }

  $("versement-montant").addEventListener("input", e => { e.target.dataset.touche = "1"; rendreVersement(synthese()); });

  // ---------- une rentrée d'argent : que faire de cette prime ? ----------
  // Règle : d'abord ce qui manque au palier d'épargne de précaution en cours ; le reste se partage
  // comme les versements du palier suivant (tout investi si tous les paliers sont atteints).
  // `dejaVerse` : ce que le plan du mois met déjà sur l'épargne de précaution (le palier en a besoin d'autant moins).
  function conseilRentree(montant, dejaVerse = 0) {
    const pl = planDuMois(), pr = S.strategie.profil, syn = synthese();
    const plaisir = Math.round(montant * Math.min(100, Math.max(0, num(pr.partPlaisir))) / 100);
    let reste = montant - plaisir;
    const manque = Math.max(0, pl.manque - dejaVerse);
    const prec = manque > 0 ? Math.min(reste, manque) : 0;
    reste -= prec;
    let ratio = 0, raisonReste = "";
    if (reste > 0) {
      if (pl.paliers.length) {
        const p = pl.manque > 0 ? pl.suivant : null;
        if (p) { ratio = num(p.versement) / Math.max(1, num(p.versement) + num(p.investi)); raisonReste = `le reste se partage comme tes versements du palier suivant (${eur(num(p.versement), 0)} d'épargne pour ${eur(num(p.investi), 0)} investis)`; }
        else raisonReste = "tes paliers d'épargne de précaution sont atteints : le reste est investi";
      } else if (!pr.basculer) { ratio = pl.vp / Math.max(1, pl.vp + pl.vi); raisonReste = "le reste se partage comme tes versements mensuels"; }
      else raisonReste = "ton épargne de précaution est complète : le reste est investi";
    }
    const enPlus = Math.round(reste * ratio), investir = reste - enPlus;
    // L'épargne va sur les comptes de précaution, meilleur taux net d'abord, dans la limite des plafonds.
    let aPlacer = prec + enPlus;
    const comptes = [...S.portefeuille.comptes.filter(c => c.precaution)].sort((a, b) => (tauxNet(b) ?? -1) - (tauxNet(a) ?? -1));
    const versComptes = [];
    for (const c of comptes) {
      if (aPlacer <= 0) break;
      const place = num(c.plafond) > 0 ? Math.max(0, num(c.plafond) - num(c.solde)) : Infinity;
      const x = Math.min(aPlacer, place);
      if (x > 0) { versComptes.push({ compte: c, montant: x }); aPlacer -= x; }
    }
    if (aPlacer > 0) versComptes.push({ compte: null, montant: aPlacer });
    const plan = investir > 0 ? repartirVersement(investir, syn) : [];
    const raisons = [];
    if (prec > 0) raisons.push(`ton épargne de précaution passe en premier : il lui manquait ${eur(manque, 0)}${pl.palier && pl.palier.date ? ` pour le ${dateFr(pl.palier.date)}` : ""}`);
    if (raisonReste) raisons.push(raisonReste);
    if (!raisons.length && plaisir > 0) raisons.push("tout est pour toi");
    return { montant, plaisir, prec, enPlus, investir, versComptes, plan, raisons, pl };
  }
  function rendreEnveloppes(syn) {
    const e = S.strategie.enveloppes, F = B.FISCALITE, rangs = [];
    const val = id => syn.parEnveloppe[id] || { valeur: 0, investi: 0 };
    const pea = val("PEA");
    if (e.peaOuverture || pea.valeur > 0) {
      const ans = anneesDepuis(e.peaOuverture);
      const statut = ans == null ? pastille("info", "date d'ouverture ?") : ans >= 5 ? pastille("ok", "plus de 5 ans") : pastille("info", "5 ans le " + dateFr(ajouterMois(e.peaOuverture, 60)));
      const verse = num(e.peaVersements);
      rangs.push(h("tr", {}, h("td", {}, h("div", { class: "nom-ligne" }, h("b", { text: "PEA" }), h("small", { text: verse > 0 ? `${eur(verse, 0)} versés sur 150 000 € (${pct(verse / F.plafondPEA * 100, 0)})` : "versements cumulés non renseignés" }))),
        h("td", { class: "num chiffre", text: eur(pea.valeur, 0) }), h("td", {}, statut)));
    }
    const av = val("AV");
    if (e.avOuverture || av.valeur > 0) {
      const ans = anneesDepuis(e.avOuverture);
      const statut = ans == null ? pastille("info", "date d'ouverture ?") : ans >= 8 ? pastille("ok", "plus de 8 ans") : pastille("info", "8 ans le " + dateFr(ajouterMois(e.avOuverture, 96)));
      rangs.push(h("tr", {}, h("td", {}, h("div", { class: "nom-ligne" }, h("b", { text: "Assurance-vie" }), h("small", { text: "Après 8 ans : 4 600 € de gains par an sans impôt sur le revenu" }))),
        h("td", { class: "num chiffre", text: eur(av.valeur, 0) }), h("td", {}, statut)));
    }
    const cr = val("Crypto");
    if (cr.valeur > 0) {
      const pv = cr.valeur - cr.investi, impot = Math.max(0, pv) * (F.ir + F.ps) / 100;
      rangs.push(h("tr", {}, h("td", {}, h("div", { class: "nom-ligne" }, h("b", { text: "Wallet crypto" }), h("small", { text: pv > 0 ? `Tout repasser en euros aujourd'hui : ≈ ${eur(impot, 0)} d'impôt (31,4 % de ${eur(pv, 0)}) ; rien sous ${F.seuilCrypto} € de ventes dans l'année` : "Pas de plus-value latente à taxer" }))),
        h("td", { class: "num chiffre", text: eur(cr.valeur, 0) }), h("td", {}, pastille("info", "impôt à la vente"))));
    }
    const cto = val("CTO");
    if (cto.valeur > 0) {
      const pv = cto.valeur - cto.investi, impot = Math.max(0, pv) * (F.ir + F.ps) / 100;
      rangs.push(h("tr", {}, h("td", {}, h("div", { class: "nom-ligne" }, h("b", { text: "Compte-titres" }), h("small", { text: pv > 0 ? `Tout vendre aujourd'hui : ≈ ${eur(impot, 0)} d'impôt (31,4 % de ${eur(pv, 0)})` : "Pas de plus-value latente à taxer" }))),
        h("td", { class: "num chiffre", text: eur(cto.valeur, 0) }), h("td", {}, pastille("info", "flat tax 31,4 %"))));
    }
    for (const [id, v] of Object.entries(syn.parEnveloppe)) {
      if (["PEA", "AV", "CTO", "Crypto"].includes(id) || !(v.valeur > 0)) continue;
      rangs.push(h("tr", {}, h("td", {}, h("b", { text: (B.ENVELOPPES.find(x => x.id === id) || { nom: id }).nom })), h("td", { class: "num chiffre", text: eur(v.valeur, 0) }), h("td", {})));
    }
    const ep = epargneTotale();
    if (ep > 0) rangs.push(h("tr", {}, h("td", {}, h("div", { class: "nom-ligne" }, h("b", { text: "Comptes d'épargne" }), h("small", { text: `${S.portefeuille.comptes.length} compte${S.portefeuille.comptes.length > 1 ? "s" : ""}, dont ${eur(epargnePrecaution(), 0)} d'épargne de précaution` }))),
      h("td", { class: "num chiffre", text: eur(ep, 0) }), h("td", {})));
    vider($("enveloppes"), rangs.length ? h("div", { class: "defile" }, h("table", {}, h("tbody", {}, rangs))) : h("p", { class: "vide", text: "Tes enveloppes apparaîtront avec tes lignes." }));
  }

  function rendreLignes(syn) {
    const z = $("lignes");
    if (!syn.lignes.length) { vider(z, h("p", { class: "vide", text: "Aucune ligne pour l'instant." })); return; }
    const tri = [...syn.lignes].sort((a, b) => b.valeur - a.valeur);
    const envNom = id => (B.ENVELOPPES.find(e => e.id === id) || {}).nom || id;
    vider(z, noteLignes ? h("p", { class: "note", text: noteLignes }) : null, h("div", { class: "defile" }, h("table", {},
      h("thead", {}, h("tr", {}, ["Ligne", "Quantité", "PRU", "Cours", "Séance", "Valeur", "Plus-value", "Poids", "Frais", ""].map((t, i) => h("th", { class: i > 0 && i < 9 ? "num" : null, text: t })))),
      h("tbody", {}, tri.map(l => h("tr", {},
        h("td", {}, h("div", { class: "nom-ligne" }, h("span", { text: l.nom }),
          h("small", { text: [l.code, l.type, envNom(l.enveloppe), (pocheDe(l) || {}).nom || "hors stratégie"].filter(Boolean).join(" · ") }))),
        h("td", { class: "num chiffre", text: l.sansQuantite ? "—" : nf(0, 6).format(l.quantite) }),
        h("td", { class: "num chiffre", text: l.sansQuantite ? "—" : eur(l.pru, 2) }),
        h("td", { class: "num" }, l.sansQuantite ? h("span", { class: "chiffre", text: "—" }) : h("div", { class: "nom-ligne", style: "min-width:0" },
          h("span", { class: "chiffre", text: eur(l.coursEff, l.coursEff >= 1000 ? 0 : 2) }),
          h("small", { text: l.marche ? (l.marche.symbole || "en direct") : "saisi" }))),
        h("td", { class: "num chiffre " + (l.varJourPct == null ? "" : l.varJourPct >= 0 ? "gain" : "perte"), text: l.varJourPct == null ? "—" : pctSigne(l.varJourPct, 2) }),
        h("td", { class: "num chiffre", text: eur(l.valeur, 0) }),
        h("td", { class: "num chiffre " + (l.pv >= 0 ? "gain" : "perte"), text: `${eurSigne(l.pv)} (${pctSigne(l.pvPct)})` }),
        h("td", { class: "num chiffre", text: pct(l.poids) }),
        h("td", { class: "num chiffre", text: estFonds(l) || num(l.frais) ? pct(num(l.frais), 2) : "—" }),
        h("td", {}, h("button", { class: "btn btn-discret btn-petit", text: "Modifier", "aria-label": "Modifier " + l.nom, onclick: () => ouvrirLigne(l.id) }))))),
      h("tfoot", {}, h("tr", { class: "table-total" }, h("td", { text: "Total" }), h("td", {}), h("td", {}), h("td", {}),
        h("td", { class: "num chiffre " + (syn.varJour == null ? "" : syn.varJour >= 0 ? "gain" : "perte"), text: syn.varJour == null ? "" : eurSigne(syn.varJour) }),
        h("td", { class: "num chiffre", text: eur(syn.total, 0) }),
        h("td", { class: "num chiffre " + (syn.pv >= 0 ? "gain" : "perte"), text: eurSigne(syn.pv) }),
        h("td", { class: "num chiffre", text: "100 %" }), h("td", {}), h("td", {}))))));
  }

  // Fiche d'une ligne : ajout ou modification.
  const optsTypes = () => B.TYPES.map(t => ({ value: t, label: t }));
  const optsEnveloppes = () => B.ENVELOPPES.map(e => ({ value: e.id, label: e.nom }));
  const optsPoches = (vide = "Hors stratégie") => [{ value: "", label: vide }, ...S.strategie.poches.map(p => ({ value: p.id, label: p.nom }))];
  const optsClasses = (vide) => [...(vide ? [{ value: "", label: vide }] : []), ...B.CLASSES.map(c => ({ value: c.id, label: c.nom }))];
  const optsZones = () => [{ value: "", label: "—" }, ...B.ZONES.map(z => ({ value: z, label: z }))];

  function ouvrirLigne(id) {
    const f = $("fiche-ligne");
    $("fiche-cours").hidden = true; $("fiche-import").hidden = true;
    const l = id ? S.portefeuille.lignes.find(x => x.id === id) : { nom: "", code: "", type: "ETF", enveloppe: "PEA", poche: "", classe: "", zone: "", quantite: "", pru: "", cours: "", frais: "", sansQuantite: false };
    if (!l) return;
    const champ = (lib, el, large) => h("label", { class: "champ" + (large ? " champ-large" : "") }, h("span", { text: lib }), el);
    const sel = (idc, opts, v) => { const s = h("select", { id: idc }); options(s, opts, v); return s; };
    const nb = (idc, v, step) => h("input", { id: idc, type: "number", step: step || "any", min: "0", inputmode: "decimal", value: v === "" ? "" : String(v) });
    const confirmer = h("span", { class: "confirmer", hidden: true }, "Supprimer cette ligne ?",
      h("button", { type: "button", class: "btn btn-danger btn-petit", text: "Oui, supprimer", onclick: () => {
        S.portefeuille.lignes = S.portefeuille.lignes.filter(x => x.id !== id);
        for (const p of S.strategie.poches) if (p.ligne === id) p.ligne = "";
        enregistrer("portefeuille"); noterPoint(); f.hidden = true; toutRendre();
      } }),
      h("button", { type: "button", class: "btn btn-discret btn-petit", text: "Non", onclick: () => { confirmer.hidden = true; } }));
    const erreur = h("p", { class: "erreur", hidden: true });
    let vente = null;
    const ch = id ? chiffrer(l) : null;
    const arrondi = x => Math.round(x * 10000) / 10000;
    const parts = h("div", { class: "champs", hidden: !!l.sansQuantite },
      champ("Quantité", nb("l-quantite", l.sansQuantite ? "" : l.quantite)),
      champ("Prix de revient unitaire (€)", nb("l-pru", l.sansQuantite ? "" : l.pru)),
      champ("Cours actuel (€)", nb("l-cours", l.sansQuantite || !ch ? (l.sansQuantite ? "" : l.cours) : arrondi(ch.cours))));
    const valeurs = h("div", { class: "champs", hidden: !l.sansQuantite },
      champ("Valeur actuelle (€)", nb("l-valeur", l.sansQuantite ? (ch ? Math.round(ch.valeur * 100) / 100 : l.cours) : "")),
      champ("Montant investi (€)", nb("l-investi", l.sansQuantite ? l.pru : "")));
    vider(f,
      h("h3", { text: id ? "Modifier " + l.nom : "Ajouter une ligne" }),
      h("div", { class: "champs" },
        champ("Nom", h("input", { id: "l-nom", value: l.nom, placeholder: "Ex. : Amundi MSCI World" }), true),
        champ("ISIN ou code", h("input", { id: "l-code", value: l.code, placeholder: "LU1681043599" })),
        champ("Symbole de cotation (facultatif)", h("input", { id: "l-symbole", value: l.symbole || "", placeholder: "CW8.PA, AI.PA, BTC…" })),
        champ("Type", sel("l-type", optsTypes(), l.type)),
        champ("Enveloppe", sel("l-enveloppe", optsEnveloppes(), l.enveloppe)),
        champ("Poche de ma stratégie", sel("l-poche", optsPoches(), l.poche)),
        champ("Classe d'actif", sel("l-classe", optsClasses("Selon la poche ou le type"), l.classe)),
        champ("Zone", sel("l-zone", optsZones(), l.zone)),
        champ("Frais annuels (%)", nb("l-frais", l.frais, "0.01"))),
      h("p", { class: "note", text: "Le robot des cours trouve la ligne avec son ISIN ou son nom. Si le cours ne vient pas, indique le symbole Yahoo Finance (ex. CW8.PA pour Paris) ou celui de la crypto (BTC)." }),
      h("label", { class: "case" }, h("input", { type: "checkbox", id: "l-sansq", checked: !!l.sansQuantite, onchange: e => { parts.hidden = e.target.checked; valeurs.hidden = !e.target.checked; } }),
        h("span", { text: "Je ne connais que la valeur et la plus-value (pas le nombre de parts)" })),
      parts, valeurs,
      erreur,
      h("div", { class: "actions" },
        h("button", { type: "button", class: "btn", text: "Enregistrer", onclick: () => {
          const v = idc => $(idc).value;
          const nom = v("l-nom").trim();
          if (!nom) { erreur.textContent = "Donne un nom à la ligne."; erreur.hidden = false; return; }
          const sansQ = $("l-sansq").checked;
          if (sansQ ? !(num(v("l-valeur")) > 0) : !(num(v("l-quantite")) > 0)) { erreur.textContent = sansQ ? "Indique la valeur actuelle de la ligne." : "Indique une quantité supérieure à zéro."; erreur.hidden = false; return; }
          const base = { nom, code: v("l-code").trim(), type: v("l-type"), enveloppe: v("l-enveloppe"), poche: v("l-poche"), classe: v("l-classe"), zone: v("l-zone"), frais: num(v("l-frais")) };
          const donnees = sansQ
            ? { ...base, sansQuantite: true, quantite: 1, cours: num(v("l-valeur")), pru: num(v("l-investi")) || num(v("l-valeur")) }
            : { ...base, sansQuantite: false, quantite: num(v("l-quantite")), pru: num(v("l-pru")) || num(v("l-cours")), cours: num(v("l-cours")) || num(v("l-pru")) };
          donnees.symbole = v("l-symbole").trim();
          const m = id ? coursMarche({ ...l, ...donnees, id, coursManuelLe: "" }) : null;
          if (donnees.sansQuantite) { donnees.refPrix = m ? m.prix : null; donnees.coursManuelLe = ""; }
          else donnees.coursManuelLe = m && Math.abs(donnees.cours / m.prix - 1) > 0.0005 ? new Date().toISOString() : "";
          if (id) Object.assign(S.portefeuille.lignes.find(x => x.id === id), donnees);
          else S.portefeuille.lignes.push({ id: uid(), ...donnees });
          S.portefeuille.exemple = false;
          if (!S.portefeuille.coursMaj) S.portefeuille.coursMaj = aujourdhui();
          enregistrer("portefeuille"); noterPoint(); f.hidden = true; toutRendre();
        } }),
        h("button", { type: "button", class: "btn btn-discret", text: "Annuler", onclick: () => { f.hidden = true; } }),
        id ? h("button", { type: "button", class: "btn btn-ghost", text: "J'ai vendu cette ligne", onclick: () => { vente.hidden = false; vente.querySelector("input").focus(); } }) : null,
        id ? h("button", { type: "button", class: "btn btn-danger", text: "Supprimer", onclick: () => { confirmer.hidden = false; } }) : null,
        confirmer),
      id ? (vente = panneauVente(l, () => { f.hidden = true; })) : null);
    f.hidden = false;
    f.scrollIntoView({ block: "nearest", behavior: "smooth" });
    $("l-nom").focus({ preventScroll: true });
  }
  let noteLignes = "";
  // Vente d'une ligne : retire la ligne, note l'opération au journal, et range l'argent.
  function panneauVente(l, fermer) {
    const F = B.FISCALITE, syn = synthese(), ligne = syn.lignes.find(x => x.id === l.id) || { valeur: 0, investi: 0 };
    const etf = S.portefeuille.lignes.find(x => x.id !== l.id && x.enveloppe === "PEA" && x.type === "ETF");
    const champ = (lib, el) => h("label", { class: "champ" }, h("span", { text: lib }), el);
    const montant = h("input", { type: "number", id: "v-montant", min: "0", step: "0.01", inputmode: "decimal", value: String(Math.round(ligne.valeur * 100) / 100) });
    const dest = h("select", { id: "v-dest" });
    options(dest, [...(etf ? [{ value: "pea", label: `Versé sur mon PEA et investi sur ${etf.nom}` }] : []), { value: "especes", label: "Gardé en espèces chez mon courtier" }], etf ? "pea" : "especes");
    const raison = h("textarea", { id: "v-raison", rows: 2, value: etf ? `Simplifier : tout sur ${etf.nom}, dans le PEA.` : "" });
    const info = h("p", { class: "petit muet" });
    const maj = () => {
      const m = num(montant.value), pv = m - ligne.investi;
      const crypto = l.type === "Crypto" || l.enveloppe === "Crypto";
      const impot = (l.enveloppe === "CTO" || crypto) && pv > 0 ? pv * (F.ir + F.ps) / 100 : 0;
      info.textContent = `${pv >= 0 ? "Plus-value" : "Moins-value"} réalisée : ${eurSigne(pv)}. ` + (l.enveloppe === "PEA" ? "Vendre dans le PEA ne déclenche pas d'impôt tant que l'argent y reste."
        : impot > 0 ? `Impôt estimé : ≈ ${eur(impot, 0)} (31,4 %)${crypto ? `, dû seulement si tes ventes de crypto de l'année dépassent ${F.seuilCrypto} €` : ""}, à déclarer l'an prochain.`
        : "Pas d'impôt sur une vente sans plus-value ; une moins-value du compte-titres s'impute sur tes plus-values des 10 années suivantes.");
    };
    montant.addEventListener("input", maj); maj();
    const panneau = h("div", { class: "aperçu", hidden: true },
      h("h3", { text: "J'ai vendu " + l.nom }),
      h("div", { class: "champs" }, champ("Montant de la vente (€)", montant), champ("L'argent est…", dest)),
      champ("Pourquoi (pour ton journal)", raison),
      info,
      h("div", { class: "actions" },
        h("button", { type: "button", class: "btn", text: "Enregistrer la vente", onclick: () => {
          const m = num(montant.value);
          if (!(m > 0)) return;
          const pv = m - ligne.investi;
          S.portefeuille.lignes = S.portefeuille.lignes.filter(x => x.id !== l.id);
          for (const p of S.strategie.poches) if (p.ligne === l.id) p.ligne = "";
          let note = "";
          if (dest.value === "pea" && etf) {
            const cours = chiffrer(etf).cours;
            const parts = cours > 0 ? Math.floor(m / cours) : 0;
            if (parts > 0) { etf.pru = (num(etf.pru) * num(etf.quantite) + parts * cours) / (num(etf.quantite) + parts); etf.quantite = num(etf.quantite) + parts; }
            S.strategie.enveloppes.peaVersements = Math.round((num(S.strategie.enveloppes.peaVersements) + m) * 100) / 100;
            note = `${parts} part${parts > 1 ? "s" : ""} de ${etf.nom} ajoutée${parts > 1 ? "s" : ""} à ${eur(cours, 2)} ; il reste ${eur(m - parts * cours, 2)} d'espèces sur le PEA. Corrige la quantité si ton achat diffère.`;
          } else {
            const nom = `Espèces ${l.enveloppe === "Crypto" ? "du wallet crypto" : l.enveloppe === "PEA" ? "du PEA" : "du compte-titres"}${estTR() ? " Trade Republic" : ""}`;
            const k = S.portefeuille.comptes.find(c => norm(c.nom) === norm(nom));
            if (k) k.solde = Math.round((num(k.solde) + m) * 100) / 100;
            else S.portefeuille.comptes.push({ id: uid(), nom, type: "remunere", solde: m, taux: null, plafond: 0, precaution: false });
          }
          S.journal.entrees.unshift({ id: uid(), date: aujourdhui(), sens: "vendre", actif: l.nom, ligneId: "", enveloppe: l.enveloppe, montant: m,
            raison: raison.value.trim(), verdict: "ok", verdictTitre: "Vente faite", points: [info.textContent].concat(note ? [note] : []),
            avis: "", revoir: ajouterMois(aujourdhui(), 6), statut: "faite", bilan: "" });
          enregistrer("portefeuille"); enregistrer("strategie"); enregistrer("journal"); noterPoint();
          fermer(); toutRendre();
          noteLignes = `Vente de ${l.nom} enregistrée et notée au journal.${note ? " " + note : ""}`;
          rendreLignes(synthese());
        } }),
        h("button", { type: "button", class: "btn btn-discret", text: "Annuler", onclick: () => { panneau.hidden = true; } })));
    return panneau;
  }
  $("btn-ajouter-ligne").addEventListener("click", () => { if (S.portefeuille.exemple) effacerExemple(); ouvrirLigne(null); });

  // ---------- comptes d'épargne ----------
  function majCompte(id, f) {
    const c = S.portefeuille.comptes.find(k => k.id === id);
    if (!c) return;
    f(c); enregistrer("portefeuille"); noterPoint(); toutRendre();
  }
  function rendreComptes() {
    const z = $("comptes");
    if (aFocus(z)) return;
    const cs = S.portefeuille.comptes;
    if (!cs.length) {
      vider(z, h("p", { class: "vide", text: "Aucun compte. Ajoute ton Livret A, ton LDDS ou les espèces de ton courtier : leur solde entre dans ton patrimoine, et ceux que tu coches forment ton épargne de précaution." }));
      return;
    }
    const interets = somme(cs, c => num(c.solde) * (tauxNet(c) || 0) / 100);
    vider(z, h("div", { class: "defile" }, h("table", {},
      h("thead", {}, h("tr", {}, ["Compte", "Solde (€)", "Taux brut", "Net d'impôt", "Plafond", "Précaution", ""].map((t, i) => h("th", { class: i >= 1 && i <= 4 ? "num" : null, text: t })))),
      h("tbody", {}, cs.map(c => {
        const t = tauxCompte(c), n = tauxNet(c), ex = estExempleCompte(c), type = TYPE_COMPTE[c.type] || TYPE_COMPTE.autre;
        return h("tr", {},
          h("td", {}, h("div", { class: "nom-ligne" }, h("span", { text: c.nom }), h("small", { text: type.nom + (c.type === "courant" ? "" : type.impose ? " · intérêts imposés à 31,4 %" : " · net d'impôt") }))),
          h("td", { class: "num" }, h("input", { type: "number", class: "solde", id: "solde-" + c.id, min: "0", step: "10", inputmode: "decimal", value: String(num(c.solde)), disabled: ex, "aria-label": "Solde de " + c.nom,
            onchange: e => majCompte(c.id, k => { k.solde = num(e.target.value); }) })),
          h("td", { class: "num chiffre", text: t == null ? "à renseigner" : pct(t, 2) }),
          h("td", { class: "num chiffre", text: n == null ? "—" : pct(n, 2) }),
          h("td", { class: "num chiffre", text: num(c.plafond) > 0 ? eur(num(c.plafond), 0) : "—" }),
          h("td", {}, h("input", { type: "checkbox", id: "prec-" + c.id, checked: !!c.precaution, disabled: ex, "aria-label": `Compter ${c.nom} dans l'épargne de précaution`, onchange: e => majCompte(c.id, k => { k.precaution = e.target.checked; }) })),
          h("td", {}, ex ? h("span", { class: "petit muet", text: "exemple" }) : h("button", { class: "btn btn-discret btn-petit", text: "Modifier", "aria-label": "Modifier " + c.nom, onclick: () => ouvrirCompte(c.id) })));
      })),
      h("tfoot", {}, h("tr", { class: "table-total" }, h("td", { text: "Total" }), h("td", { class: "num chiffre", text: eur(epargneTotale(), 0) }), h("td", {}), h("td", {}), h("td", {}), h("td", {}), h("td", {}))))),
      interets > 0 ? h("p", { class: "note", text: `À ces taux, ton épargne rapporte environ ${eur(interets, 0)} par an après impôt. Saisis un nouveau solde quand tu fais un versement : il est noté dans ton historique.` }) : null);
  }
  function ouvrirCompte(id) {
    const f = $("fiche-compte");
    const c = id ? S.portefeuille.comptes.find(x => x.id === id) : { nom: "", type: "livretA", solde: "", taux: 1.7, plafond: 22950, precaution: true };
    if (!c) return;
    const champ = (lib, el) => h("label", { class: "champ" }, h("span", { text: lib }), el);
    const nb = (idc, v, step) => h("input", { id: idc, type: "number", step: step || "any", min: "0", inputmode: "decimal", value: v === "" || v == null ? "" : String(v) });
    const selType = h("select", { id: "k-type", onchange: e => {
      const t = TYPE_COMPTE[e.target.value];
      $("k-taux").value = t.taux == null ? "" : String(t.taux);
      $("k-plafond").value = t.plafond ? String(t.plafond) : "";
      $("k-prec").checked = ["livretA", "ldds", "lep", "livretJeune"].includes(t.id);
      $("k-taux-note").hidden = t.taux != null;
    } });
    options(selType, B.TYPES_COMPTES.map(t => ({ value: t.id, label: t.nom })), c.type);
    const erreur = h("p", { class: "erreur", hidden: true });
    const confirmer = h("span", { class: "confirmer", hidden: true }, "Supprimer ce compte ?",
      h("button", { type: "button", class: "btn btn-danger btn-petit", text: "Oui, supprimer", onclick: () => {
        S.portefeuille.comptes = S.portefeuille.comptes.filter(x => x.id !== id);
        enregistrer("portefeuille"); noterPoint(); f.hidden = true; toutRendre();
      } }),
      h("button", { type: "button", class: "btn btn-discret btn-petit", text: "Non", onclick: () => { confirmer.hidden = true; } }));
    vider(f,
      h("h3", { text: id ? "Modifier " + c.nom : "Ajouter un compte d'épargne" }),
      h("div", { class: "champs" },
        champ("Type", selType),
        champ("Nom", h("input", { id: "k-nom", value: c.nom, placeholder: estTR() ? "Ex. : Livret A Trade Republic" : "Ex. : Livret A" })),
        champ("Solde (€)", nb("k-solde", c.solde)),
        champ("Taux brut annuel (%)", nb("k-taux", tauxCompte(c), "0.01")),
        champ("Plafond (€)", nb("k-plafond", num(c.plafond) || ""))),
      h("p", { class: "note", id: "k-taux-note", hidden: (TYPE_COMPTE[c.type] || {}).taux != null, text: "Taux variable : recopie celui affiché dans ton appli. Les intérêts d'un compte rémunéré sont imposés à 31,4 % (flat tax), contrairement au Livret A et au LDDS." }),
      h("label", { class: "case" }, h("input", { type: "checkbox", id: "k-prec", checked: !!c.precaution }), h("span", { text: "Ce compte fait partie de mon épargne de précaution" })),
      erreur,
      h("div", { class: "actions" },
        h("button", { type: "button", class: "btn", text: "Enregistrer", onclick: () => {
          const type = $("k-type").value;
          const donnees = { nom: $("k-nom").value.trim() || TYPE_COMPTE[type].nom, type, solde: num($("k-solde").value),
            taux: $("k-taux").value === "" ? null : num($("k-taux").value), plafond: num($("k-plafond").value), precaution: $("k-prec").checked };
          // Les comptes d'exemple laissent la place aux vrais.
          S.portefeuille.comptes = S.portefeuille.comptes.filter(k => !estExempleCompte(k));
          if (id && S.portefeuille.comptes.find(x => x.id === id)) Object.assign(S.portefeuille.comptes.find(x => x.id === id), donnees);
          else S.portefeuille.comptes.push({ id: uid(), ...donnees });
          enregistrer("portefeuille"); noterPoint(); f.hidden = true; toutRendre();
        } }),
        h("button", { type: "button", class: "btn btn-discret", text: "Annuler", onclick: () => { f.hidden = true; } }),
        id ? h("button", { type: "button", class: "btn btn-danger", text: "Supprimer", onclick: () => { confirmer.hidden = false; } }) : null,
        confirmer));
    f.hidden = false;
    f.scrollIntoView({ block: "nearest", behavior: "smooth" });
    $("k-solde").focus({ preventScroll: true });
  }
  $("btn-ajouter-compte").addEventListener("click", () => ouvrirCompte(null));

  // Mise à jour des cours.
  $("btn-maj-cours").addEventListener("click", () => {
    const f = $("fiche-cours");
    $("fiche-ligne").hidden = true; $("fiche-import").hidden = true;
    const lignes = S.portefeuille.lignes;
    if (!lignes.length) { vider(f, h("p", { class: "vide", text: "Ajoute d'abord des lignes." }), h("button", { class: "btn btn-discret btn-petit", text: "Fermer", onclick: () => { f.hidden = true; } })); f.hidden = false; return; }
    vider(f,
      h("h3", { text: "Mettre à jour les cours" }),
      h("p", { class: "petit muet", text: "Les cours en direct arrivent seuls. Un cours saisi ici remplace celui du marché jusqu'au prochain relevé du robot." }),
      h("label", { class: "champ", style: "max-width:220px" }, h("span", { text: "Cours du" }), h("input", { type: "date", id: "c-date", value: aujourdhui() })),
      h("div", { class: "champs" }, lignes.map(l => h("label", { class: "champ" }, h("span", { text: l.sansQuantite ? l.nom + " : valeur (€)" : l.nom }),
        h("input", { type: "number", id: "cours-" + l.id, step: "any", min: "0", inputmode: "decimal", value: String(Math.round((l.sansQuantite ? chiffrer(l).valeur : chiffrer(l).cours) * 10000) / 10000) })))),
      h("div", { class: "actions" },
        h("button", { class: "btn", text: "Enregistrer les cours", onclick: () => {
          for (const l of S.portefeuille.lignes) {
            const v = num($("cours-" + l.id)?.value), ch = chiffrer(l);
            const actuel = l.sansQuantite ? ch.valeur : ch.cours;
            if (!(v > 0) || Math.abs(v / (actuel || v) - 1) < 0.0005) continue;
            if (l.sansQuantite) { l.cours = v; l.refPrix = ch.marche ? ch.marche.prix : null; }
            else { l.cours = v; l.coursManuelLe = new Date().toISOString(); }
          }
          S.portefeuille.coursMaj = $("c-date").value || aujourdhui();
          enregistrer("portefeuille"); noterPoint(); f.hidden = true; toutRendre();
        } }),
        h("button", { class: "btn btn-discret", text: "Annuler", onclick: () => { f.hidden = true; } })));
    f.hidden = false;
    f.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });

  // ---------- Claude : disponibilité et messages d'erreur ----------
  let sample = null, claudePret = false, claudeImages = null, claudeOutils = false;
  async function brancherClaude() {
    if (!(window.claude && typeof window.claude.use === "function")) { rendreClaudeAbsent(); return; }
    let s = null;
    try { s = await window.claude.use("sample"); } catch (_) { s = null; }
    if (typeof s !== "function") { rendreClaudeAbsent(); return; }
    sample = s;
    const lim = await s.limits().catch(() => null);
    claudeImages = lim && lim.images ? lim.images : null;
    claudeOutils = !!(lim && lim.tools);
    claudePret = true;
    toutRendre();
  }
  function claudeIndisponible() { claudePret = false; sample = null; toutRendre(); }
  function messageErreur(e) {
    const code = e && e.code;
    if (["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"].includes(code)) { setTimeout(claudeIndisponible, 0); return "Claude n'est pas disponible sur cette page pour ton compte."; }
    return ({
      rate_limited: "Trop de demandes pour l'instant. Réessaie dans un moment.",
      session_expired: "Ta session claude.ai a expiré : reconnecte-toi puis réessaie.",
      refused: "Claude n'a pas pu répondre à cette demande. Reformule-la.",
      prompt_too_large: "Trop de données à envoyer d'un coup. Raccourcis la demande, ou commence une nouvelle discussion.",
      invalid_json: "Claude n'a pas renvoyé de données lisibles. Réessaie.",
      image_rejected: "Une image n'a pas été acceptée : vérifie son format (JPEG, PNG, WebP) et sa taille.",
      images_unavailable: "Les images ne peuvent pas être envoyées ici : colle plutôt le texte.",
      empty_completion: "Claude n'a rien répondu. Reformule ou demande moins à la fois."
    })[code] || "La connexion à Claude a échoué. Réessaie.";
  }
  function rendreClaudeAbsent() {
    claudePret = false;
    toutRendre();
  }

  // Rendu Markdown simple et sûr : tout le texte passe par des nœuds texte.
  function enLigne(texte) {
    const frag = document.createDocumentFragment();
    const re = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\s\n][^*\n]*\*)/g;
    let i = 0, m;
    while ((m = re.exec(texte))) {
      if (m.index > i) frag.append(texte.slice(i, m.index));
      const t = m[0];
      if (t.startsWith("**")) frag.append(h("strong", { text: t.slice(2, -2) }));
      else if (t.startsWith("`")) frag.append(h("code", { text: t.slice(1, -1) }));
      else frag.append(h("em", { text: t.slice(1, -1) }));
      i = m.index + t.length;
    }
    if (i < texte.length) frag.append(texte.slice(i));
    return frag;
  }
  function markdown(texte) {
    const racine = h("div", { class: "md" });
    const lignes = String(texte || "").replace(/\r/g, "").split("\n");
    let liste = null, para = [];
    const finPara = () => { if (para.length) { racine.append(h("p", {}, enLigne(para.join(" ")))); para = []; } };
    const finListe = () => { liste = null; };
    for (let k = 0; k < lignes.length; k++) {
      const l = lignes[k];
      const t = l.trim();
      if (!t) { finPara(); finListe(); continue; }
      if (/^\|.*\|$/.test(t) && k + 1 < lignes.length && /^\|[\s:|-]+\|$/.test(lignes[k + 1].trim())) {
        finPara(); finListe();
        const cellules = s => s.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
        const tete = cellules(t);
        const corps = [];
        k += 2;
        while (k < lignes.length && /^\|.*\|$/.test(lignes[k].trim())) { corps.push(cellules(lignes[k])); k++; }
        k--;
        racine.append(h("div", { class: "defile" }, h("table", {}, h("thead", {}, h("tr", {}, tete.map(c => h("th", {}, enLigne(c))))),
          h("tbody", {}, corps.map(r => h("tr", {}, r.map(c => h("td", {}, enLigne(c)))))))));
        continue;
      }
      const titre = t.match(/^#{1,6}\s+(.*)$/);
      if (titre) { finPara(); finListe(); racine.append(h("h4", {}, enLigne(titre[1]))); continue; }
      const puce = t.match(/^[-*•]\s+(.*)$/), numero = t.match(/^\d+[.)]\s+(.*)$/);
      if (puce || numero) {
        finPara();
        const tag = puce ? "ul" : "ol";
        if (!liste || liste.tagName.toLowerCase() !== tag) { liste = h(tag); racine.append(liste); }
        liste.append(h("li", {}, enLigne((puce || numero)[1])));
        continue;
      }
      if (/^-{3,}$/.test(t)) { finPara(); finListe(); continue; }
      finListe(); para.push(t);
    }
    finPara();
    return racine;
  }

  // ---------- contexte donné à Claude ----------
  const CONSIGNES = `Tu es l'assistant d'investissement intégré à « Boussole Bourse », l'outil personnel d'un investisseur particulier français. Ton rôle : l'aider à appliquer SA stratégie et SES principes, à comprendre, et à prendre de bonnes décisions.
- Réponds en français, en le tutoyant, de façon directe et concrète, en phrases courtes. Markdown simple : titres ####, listes, gras, petits tableaux si utile.
- Appuie-toi sur ses chiffres ci-dessous et cite ses règles et ses principes quand ils s'appliquent. Si une idée contredit sa stratégie, dis-le clairement, même s'il semble en avoir envie.
- Tu n'as accès ni aux cours en direct ni à l'actualité : tes connaissances sur une entreprise, un fonds ou un taux peuvent être datées ; dis-le quand ça compte. Ne donne jamais de prévision de cours ni de promesse de rendement.
- Distingue les faits, les hypothèses et ton avis. Tu l'aides à raisonner ; la décision lui appartient. Ce n'est pas un conseil en investissement réglementé, inutile de le répéter à chaque message.
- Fiscalité française 2026 : flat tax 31,4 % (12,8 % d'impôt + 18,6 % de prélèvements sociaux), y compris sur les intérêts d'un compte rémunéré ; Livret A et LDDS : 1,7 % net d'impôt (plafonds 22 950 € et 12 000 €) ; PEA : après 5 ans, seuls les prélèvements sociaux de 18,6 % sur les gains, versements plafonnés à 150 000 € ; crypto : 31,4 % sur les gains seulement en repassant en euros, échanges entre cryptos non imposés, rien si les ventes de l'année ne dépassent pas 305 € ; assurance-vie : prélèvements sociaux 17,2 %, après 8 ans abattement de 4 600 € (9 200 € en couple) puis 7,5 % d'impôt (jusqu'à 150 000 € de primes).
- L'épargne de précaution fait partie de sa stratégie : tiens compte de sa progression et du partage de son effort mensuel entre elle et ses investissements.
- Tu vois tout l'outil : 1. Patrimoine (total, bourse, épargne, plus-value, courbe), 2. Mon mois (ce qu'il prévoit de recevoir et de dépenser, et ce qui va sur le compte courant, le LEP et le PEA, avec ses opérations du mois), 3. Épargne (ses comptes et leurs soldes), 4. Bourse (ses lignes), 6. Stratégie. Les chiffres sont ci-dessous.
- Il peut te montrer des captures de la Caisse d'Épargne ou de Trade Republic. Lis-les avec soin, dis ce que tu y vois, et rapproche-les de son plan du mois. Propose d'enregistrer ses opérations (outil enregistrer_operations) et de mettre à jour un solde (outil mettre_a_jour_solde) ; fais-le quand il le demande ou l'accepte, puis dis en une ligne ce que tu as changé. Un retrait d'espèces compte comme dépensé (catégorie « especes »), même s'il reste des billets.`;

  function contexteInvestisseur() {
    const st = S.strategie, pr = st.profil, r = st.regles, syn = synthese();
    const risque = (B.RISQUES.find(x => x.id === pr.risque) || {}).nom || pr.risque;
    const reaction = (B.REACTIONS.find(x => x.id === pr.reaction) || {}).nom || pr.reaction;
    const L = [];
    L.push(`Date du jour : ${new Date().toLocaleDateString("fr-FR", { weekday: "long" })} ${dateFr(aujourdhui())}.`);
    const pat = patrimoine(syn), pl = planDuMois();
    L.push(`\nPROFIL${st.exemple ? " (modèle de départ, pas encore personnalisé)" : ""} : objectif « ${pr.objectifTexte} » ; ${eur(num(pr.objectifMontant), 0)} (en euros d'aujourd'hui) visés pour ${pr.objectifAnnee} ; horizon ${num(pr.horizon)} ans ; profil ${risque} ; après une baisse de 30 % : « ${reaction} » ; versement mensuel investi ${eur(num(pr.versementMensuel), 0)} ; versement mensuel sur l'épargne de précaution ${eur(num(pr.versementPrecaution), 0)}${pr.basculer ? " (basculé vers les investissements une fois l'objectif atteint)" : ""} ; dépenses mensuelles ${eur(num(pr.depensesMensuelles), 0)}${pr.courtier ? ` ; courtier : ${pr.courtier}` : ""}.`);
    L.push(`\nPATRIMOINE${S.portefeuille.exemple || S.portefeuille.comptes.some(estExempleCompte) ? " (contient des données d'EXEMPLE fictives)" : ""} : ${eur(pat.total, 0)} au total = épargne ${eur(pat.epargne, 0)} + bourse ${eur(pat.bourse, 0)} + crypto ${eur(pat.crypto, 0)}.`);
    if (pl.paliers.length) L.push("PALIERS D'ÉPARGNE DE PRÉCAUTION (objectif, date, versement mensuel vers l'épargne, investi par mois) :\n" + pl.paliers.map((p, i) => `- ${eur(num(p.montant), 0)}${p.date ? " pour le " + dateFr(p.date) : ""} : ${eur(num(p.versement), 0)} vers l'épargne, ${eur(num(p.investi), 0)} investis${i === pl.rang ? " (palier en cours)" : i < pl.rang ? " (atteint)" : ""}`).join("\n"));
    L.push(`ÉPARGNE DE PRÉCAUTION : ${eur(pl.act, 0)} pour un objectif de ${eur(pl.obj, 0)}${pl.paliers.length ? "" : ` (${num(pr.moisPrecaution)} mois de dépenses)`}${pl.manque > 0 ? (pl.mois ? `, complète en ${moisFr(pl.fin)} au rythme actuel` : ", sans versement prévu") : ", complète"}. Plan de ce mois : ${eur(pl.versEpargne, 0)} sur l'épargne${pl.compte ? ` (${pl.compte.nom})` : ""}, ${eur(pl.investir, 0)} à investir.`);
    if (S.portefeuille.comptes.length) L.push("Comptes d'épargne (nom | type | solde | taux brut | net d'impôt | plafond | précaution) :\n" + S.portefeuille.comptes.map(c => `- ${c.nom} | ${(TYPE_COMPTE[c.type] || {}).nom} | ${eur(num(c.solde), 0)} | ${tauxCompte(c) == null ? "?" : pct(tauxCompte(c), 2)} | ${tauxNet(c) == null ? "?" : pct(tauxNet(c), 2)} | ${num(c.plafond) ? eur(num(c.plafond), 0) : "—"} | ${c.precaution ? "oui" : "non"}`).join("\n"));
    const hist = S.historique.points;
    if (hist.length >= 2) L.push(`HISTORIQUE : ${eur(totalPoint(hist[0]), 0)} le ${dateFr(hist[0].date)}, ${eur(totalPoint(hist[hist.length - 1]), 0)} le ${dateFr(hist[hist.length - 1].date)} (${hist.length} relevés).`);
    L.push("\nALLOCATION CIBLE :");
    for (const p of syn.poches) L.push(`- ${p.nom} (${CLASSE[p.classe]?.nom || p.classe}) : cible ${pct(num(p.cible), 0)}, aujourd'hui ${pct(p.poids)}`);
    if (syn.hors.length) L.push(`- Hors stratégie : ${pct(syn.horsValeur / (syn.total || 1) * 100)}`);
    L.push(`\nRÈGLES : action en direct ≤ ${pct(num(r.maxAction))} du portefeuille ; total actions en direct ≤ ${pct(num(r.maxDirect), 0)} ; crypto ≤ ${pct(num(r.maxCrypto), 0)} ; rééquilibrer au-delà de ± ${num(r.marge)} points ; frais d'un fonds ≤ ${pct(num(r.fraisMax), 2)} par an${r.delaiActif ? ` ; délai de réflexion de ${num(r.delaiHeures)} h avant un achat non prévu` : ""}${r.interditLevier ? " ; pas de levier ni de produits complexes" : ""}${r.venteEnPerte ? " ; pas de vente en perte non prévue par la stratégie" : ""}.`);
    if (st.reglesLibres.filter(Boolean).length) L.push("Règles personnelles :\n" + st.reglesLibres.filter(Boolean).map(x => "- " + x).join("\n"));
    const sgs = B.SAGESSE.filter(x => (st.sagesse || {})[x.id]);
    if (sgs.length) L.push("\nRÈGLES DES GRANDS INVESTISSEURS QU'IL VEUT SUIVRE :\n" + sgs.map(x => `- ${x.regle} (${x.auteur.split(",")[0]} : « ${x.citation} »)`).join("\n"));
    const pa = B.PRINCIPES.filter(p => actif(p.id));
    if (pa.length) L.push("\nPRINCIPES QU'IL APPLIQUE :\n" + pa.map(p => `- ${p.titre} : ${p.texte}`).join("\n"));
    const e = st.enveloppes;
    L.push(`\nENVELOPPES : PEA ${e.peaOuverture ? "ouvert le " + dateFr(e.peaOuverture) + (num(e.peaVersements) ? `, ${eur(num(e.peaVersements), 0)} versés` : "") : "non renseigné"} ; assurance-vie ${e.avOuverture ? "ouverte le " + dateFr(e.avOuverture) : "non renseignée"}.`);
    if (syn.lignes.length) {
      L.push(`\nPORTEFEUILLE${S.portefeuille.exemple ? " (EXEMPLE FICTIF, pas encore le sien)" : ""}, ${syn.enDirect ? `cours du marché relevés ${momentFr(S.marche.maj)} (${(S.marche.sources || []).join(", ")}) pour ${syn.enDirect} ligne(s) sur ${syn.lignes.length}` : `cours saisis le ${S.portefeuille.coursMaj ? dateFr(S.portefeuille.coursMaj) : "?"}`} : valeur ${eur(syn.total, 0)}, prix de revient ${eur(syn.investi, 0)}, plus-value latente ${eurSigne(syn.pv)} (${pctSigne(syn.pvPct)}), frais moyens des fonds ${pct(syn.fraisMoyen, 2)}.`);
      L.push("Lignes (nom | code | type | enveloppe | poche | quantité | PRU | cours | valeur | poids | plus-value | frais) :");
      for (const l of [...syn.lignes].sort((a, b) => b.valeur - a.valeur))
        L.push(`- ${l.nom} | ${l.marche ? l.marche.symbole : l.code || "—"} | ${l.type} | ${l.enveloppe} | ${(pocheDe(l) || {}).nom || "hors stratégie"} | ${l.sansQuantite ? "valeur seule" : nf(0, 6).format(l.quantite)} | ${l.sansQuantite ? "—" : eur(l.pru, 2)} | ${l.sansQuantite ? "—" : eur(l.coursEff, 2)}${l.varJourPct != null ? ` (${pctSigne(l.varJourPct, 2)} sur la séance)` : ""} | ${eur(l.valeur, 0)} | ${pct(l.poids)} | ${pctSigne(l.pvPct)} | ${estFonds(l) ? pct(num(l.frais), 2) : "—"}`);
    } else L.push("\nPORTEFEUILLE : vide pour l'instant.");
    const al = alertes(syn).filter(a => a.niveau !== "ok");
    if (al.length) L.push("\nPOINTS SIGNALÉS PAR L'OUTIL :\n" + al.map(a => "- " + a.texte).join("\n"));
    const plb = planBudget();
    if (plb.revenus > 0 || Object.keys(M).length) {
      L.push(`\nBUDGET PRÉVU (par mois) : revenus ${eur(plb.revenus, 0)}, dépenses ${eur(plb.depenses, 0)}, versements d'épargne ${eur(plb.epargne, 0)}, reste à vivre ${eur(plb.reste, 0)}${plb.taux != null ? `, taux d'épargne ${pct(plb.taux, 0)}` : ""}.` +
        (Object.keys(S.budget.prevu).length ? " Détail : " + B.CATEGORIES_BUDGET.filter(c => num(S.budget.prevu[c.id])).map(c => `${c.nom} ${eur(num(S.budget.prevu[c.id]), 0)}`).join(", ") + "." : ""));
      const moisRecents = moisAvecOperations().filter(k => k <= cleMois(new Date())).slice(-3);
      for (const k of moisRecents) {
        const b = bilanMois(k);
        const top = B.CATEGORIES_BUDGET.filter(c => c.type === "depense" && b.parCat[c.id] < 0).sort((x, y) => b.parCat[x.id] - b.parCat[y.id]).slice(0, 5).map(c => `${c.nom} ${eur(-b.parCat[c.id], 0)}`).join(", ");
        L.push(`BUDGET RÉEL ${nomMois(k)} : revenus ${eur(b.revenus, 0)}, dépenses ${eur(b.depenses, 0)}, mis de côté ${eur(b.epargne, 0)}${b.taux != null ? `, taux d'épargne ${pct(b.taux, 0)}` : ""}${top ? ` ; principales dépenses : ${top}` : ""}.`);
      }
    }
    const p = paie(), netPaie = netDepuisBrut(p.brut).net * (1 - p.pas / 100);
    if (num(S.budget.paie && S.budget.paie.brut)) L.push(`\nPAIE : ${eur(netPaie, 0)} net par mois (${eur(p.brut, 0)} brut, ${nf(0, 2).format(p.heures)} h${Math.abs(p.brut / p.heures / PAIE.smicHoraire - 1) < 0.01 ? ", au SMIC" : ""}), plus les heures supplémentaires éventuelles${num(S.budget.prevu.aides) ? ` ; prime d'activité ${eur(num(S.budget.prevu.aides), 0)} par mois` : ""}.${jourDecalage() > 0 ? ` Une paie reçue à partir du ${jourDecalage()} (en général vers le 29) finance le mois suivant : le budget la compte pour ce mois-là.` : ""}`);
    for (const k of [...new Set([cleMois(new Date()), moisMM()])].sort()) {
      const ops = mouvementsDuMois(k).sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 40);
      if (ops.length) L.push(`OPÉRATIONS COMPTÉES POUR ${nomMois(k).toUpperCase()} (compte courant) :\n` + ops.map(m => `- ${dateFr(m.date)} | ${m.libelle} | ${eurSigne(m.montant)} | ${m.categorie}`).join("\n"));
    }
    const mm = monMois(moisTableau || moisParDefaut());
    L.push(`\nMON MOIS (page 2, ${nomMois(mm.cle)}${mm.rempli < CHAMPS_MOIS.length ? ", cases en partie proposées par la page" : ""}) : salaire ${eur(mm.v("salaire"), 2)}, prime d'activité ${eur(mm.v("primeActivite"), 2)}, autres revenus prévus ${eur(mm.v("autres"), 0)} ; dépenses fixes prévues ${eur(mm.v("fixes"), 0)} (dépensé : ${eur(Math.max(0, -reelMM(mm.cle, CAT_FIXES)), 0)}), variables prévues ${eur(mm.v("variables"), 0)} (dépensé : ${eur(Math.max(0, -reelMM(mm.cle, CAT_VARIABLES)), 0)}). Où va l'argent : ${eur(mm.garder, 0)} gardés sur le compte courant, ${eur(mm.precaution, 0)} sur l'épargne de précaution${mm.pl.compte ? " (" + mm.pl.compte.nom + ")" : ""}, ${eur(mm.investir, 0)} investis${mm.enveloppes.length === 1 ? " (" + mm.enveloppes[0] + ")" : ""}${mm.revenus > 0 ? `, soit ${pct((mm.precaution + mm.investir) / mm.revenus * 100, 0)} d'épargne` : ""}.`);
    const j = S.journal.entrees.slice(0, 5);
    if (j.length) L.push("\nDERNIÈRES DÉCISIONS DU JOURNAL :\n" + j.map(x => `- ${dateFr(x.date)} : ${SENS[x.sens] || x.sens} ${x.actif} (${eur(num(x.montant), 0)}), statut ${STATUTS[x.statut] || x.statut} ; raison : ${x.raison || "—"}${x.bilan ? " ; bilan : " + x.bilan : ""}`).join("\n"));
    return L.join("\n");
  }

  // ---------- BUDGET ----------
  const CAT = Object.fromEntries(B.CATEGORIES_BUDGET.map(c => [c.id, c]));
  const catType = id => (CAT[id] || CAT.autres).type;
  const cleMois = d => isoDate(d).slice(0, 7);
  const nomMois = cle => new Date(cle + "-15T12:00:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const decalerMois = (cle, n) => { const d = new Date(cle + "-15T12:00:00"); d.setMonth(d.getMonth() + n); return cleMois(d); };
  // Une paie versée en fin de mois (le 29 octobre) finance le mois suivant : elle compte pour novembre.
  const jourDecalage = () => S.budget.paieDecalee == null ? 25 : num(S.budget.paieDecalee);
  const estDecale = m => jourDecalage() > 0 && m.categorie === "salaire" && m.montant > 0 && Number(m.date.slice(8, 10)) >= jourDecalage();
  // Les opérations qui comptent pour un mois : celles du mois, sauf la paie de fin de mois, plus celle du mois d'avant.
  function mouvementsDuMois(cle) {
    const ici = (M[cle] || { mouvements: [] }).mouvements, avant = (M[decalerMois(cle, -1)] || { mouvements: [] }).mouvements;
    return [...ici.filter(m => !estDecale(m)), ...avant.filter(estDecale)];
  }
  const moisAvecOperations = () => [...new Set(Object.keys(M).flatMap(k => [k, decalerMois(k, 1)]))].filter(k => mouvementsDuMois(k).length).sort();
  function bilanMois(cle) {
    const mv = mouvementsDuMois(cle);
    let revenus = 0, depenses = 0, epargne = 0;
    const parCat = {};
    for (const m of mv) {
      const t = catType(m.categorie);
      parCat[m.categorie] = (parCat[m.categorie] || 0) + m.montant;
      if (t === "revenu") revenus += m.montant;
      else if (t === "depense") depenses -= m.montant;
      else epargne -= m.montant;
    }
    // Un taux d'épargne sous −100 % (un mois presque sans revenu) ne veut rien dire : on ne l'affiche pas.
    const taux = revenus > 0 ? (revenus - depenses) / revenus * 100 : null;
    return { nb: mv.length, revenus, depenses, epargne, solde: revenus - depenses, reste: revenus - depenses - epargne, taux: taux != null && taux >= -100 ? taux : null, parCat };
  }
  function planBudget() {
    const pv = S.budget.prevu, pr = S.strategie.profil;
    const revenus = somme(B.CATEGORIES_BUDGET.filter(c => c.type === "revenu"), c => num(pv[c.id]));
    const depenses = somme(B.CATEGORIES_BUDGET.filter(c => c.type === "depense"), c => num(pv[c.id]));
    const plm = planDuMois();
    const epargne = plm.versEpargne + plm.investir;
    return { revenus, depenses, epargne, capacite: revenus - depenses, reste: revenus - depenses - epargne, taux: revenus > 0 ? (revenus - depenses) / revenus * 100 : null };
  }
  // Moyenne des dépenses réelles sur les trois derniers mois complets qui ont des opérations.
  function moyenneDepenses() {
    // Un mois suivi seulement à partir du 11 (le premier mois importé, souvent) fausserait la moyenne.
    const mois = moisAvecOperations().filter(k => k < cleMois(new Date()) && mouvementsDuMois(k).some(m => m.date.slice(0, 7) === k && Number(m.date.slice(8, 10)) <= 10)).slice(-3);
    if (!mois.length) return null;
    return { mois: mois.length, depenses: somme(mois, k => bilanMois(k).depenses) / mois.length, revenus: somme(mois, k => bilanMois(k).revenus) / mois.length };
  }
  $("b-decalage").addEventListener("change", e => { S.budget.paieDecalee = e.target.checked ? (num($("b-decalage-jour").value) || 25) : 0; enregistrer("budget"); rendreMonMois(); });
  $("b-decalage-jour").addEventListener("change", e => { const j = Math.max(1, Math.min(31, Math.round(num(e.target.value)) || 25)); S.budget.paieDecalee = j; enregistrer("budget"); rendreMonMois(); });

  const optsCategories = (types) => B.CATEGORIES_BUDGET.filter(c => !types || types.includes(c.type)).map(c => ({ value: c.id, label: c.nom }));
  function ajouterMouvements(liste) {
    const touches = new Set();
    for (const m of liste) {
      const k = m.date.slice(0, 7);
      M[k] ||= { mouvements: [] };
      M[k].mouvements.push({ id: m.id || uid(), date: m.date, libelle: m.libelle, montant: num(m.montant), categorie: m.categorie });
      touches.add(k);
    }
    for (const k of touches) { M[k].mouvements.sort((a, b) => a.date < b.date ? 1 : -1); enregistrer("mois:" + k); }
  }
  // Retrouve une opération dans son document du mois (celui de sa date).
  function majMouvement(m, f) {
    const doc = M[m.date.slice(0, 7)], x = doc && doc.mouvements.find(y => y.id === m.id);
    if (!x) return;
    if (f(x, doc) === "retirer") doc.mouvements = doc.mouvements.filter(y => y.id !== m.id);
    enregistrer("mois:" + m.date.slice(0, 7));
  }
  const dateCourte = iso => new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  let propositionRegle = null;
  function rendreOperations() {
    const z = $("b-operations");
    if (enSaisie(z)) return;
    const cle = moisMM(), cats = detailMM ? CASES_MM[detailMM].cats : null, garde = m => !cats || cats.includes(m.categorie);
    const comptees = mouvementsDuMois(cle).filter(garde);
    // La paie de fin de mois partie au mois suivant reste visible, grisée.
    const parties = (M[cle] || { mouvements: [] }).mouvements.filter(estDecale).filter(garde);
    const regles = S.budget.regles;
    const blocRegle = propositionRegle ? h("div", { class: "fiche", style: "display:grid;gap:8px" },
      h("p", { text: `Toujours classer « ${propositionRegle.motif} » en ${CAT[propositionRegle.categorie].nom} ?` }),
      h("p", { class: "petit muet", text: "Les opérations déjà enregistrées avec ce libellé sont reclassées, et les prochains relevés importés aussi." }),
      h("div", { class: "actions" },
        h("button", { class: "btn btn-petit", text: "Oui, toujours", onclick: () => {
          const pr = propositionRegle; propositionRegle = null;
          S.budget.regles = [...S.budget.regles.filter(r => norm(r.motif) !== norm(pr.motif)), { motif: pr.motif, categorie: pr.categorie }];
          enregistrer("budget");
          for (const [k, doc] of Object.entries(M)) {
            let touche = false;
            for (const x of doc.mouvements) if (norm(x.libelle).includes(norm(pr.motif)) && x.categorie !== pr.categorie) { x.categorie = pr.categorie; touche = true; }
            if (touche) enregistrer("mois:" + k);
          }
          rendreMonMois();
        } }),
        h("button", { class: "btn btn-discret btn-petit", text: "Seulement cette fois", onclick: () => { propositionRegle = null; rendreOperations(); } }))) : null;
    const blocRegles = regles.length ? h("details", { class: "sous-repli" }, h("summary", { text: `Mes règles de classement (${regles.length})` }),
      h("ul", { class: "taches" }, regles.map(r => h("li", { class: "tache", style: "grid-template-columns:1fr auto" },
        h("span", { text: `« ${r.motif} » → ${CAT[r.categorie].nom}` }),
        h("button", { class: "btn btn-discret btn-petit", text: "Retirer", "aria-label": "Retirer la règle " + r.motif, onclick: () => { S.budget.regles = S.budget.regles.filter(x => x !== r); enregistrer("budget"); rendreOperations(); } })))),
      h("p", { class: "note", text: "Quand tu changes la catégorie d'une opération, la page propose d'en faire une règle." })) : null;
    if (!comptees.length && !parties.length) { vider(z, h("p", { class: "vide", text: `Aucune opération ${detailMM ? "de ce type " : ""}en ${nomMois(cle)}. Montre tes captures à Claude, importe un relevé ou ajoute une opération à la main.` }), blocRegles); return; }
    const rang = (m, partie) => {
      const sel = h("select", { id: "cat-" + m.id, "aria-label": "Catégorie de " + m.libelle, onchange: e => {
        const cat = e.target.value;
        e.target.blur();
        majMouvement(m, x => { x.categorie = cat; });
        propositionRegle = regles.some(r => norm(m.libelle).includes(norm(r.motif)) && r.categorie === cat) ? null : { motif: m.libelle.trim(), categorie: cat };
        rendreMonMois();
      } });
      options(sel, optsCategories(), m.categorie);
      const decale = m.date.slice(0, 7) !== cle;
      return h("tr", { class: partie ? "muet" : null },
        h("td", { class: "chiffre", text: dateCourte(m.date) }),
        h("td", { style: "min-width:160px" }, m.libelle,
          decale ? h("small", { class: "muet", text: ` · paie du ${dateFr(m.date)}, comptée en ${nomMois(cle).split(" ")[0]}` }) : null,
          partie ? h("small", { text: ` · comptée en ${nomMois(decalerMois(cle, 1)).split(" ")[0]}` }) : null),
        h("td", {}, sel),
        h("td", { class: "num chiffre " + (m.montant >= 0 && !partie ? "gain" : ""), text: eurSigne(m.montant) }),
        h("td", {}, h("button", { class: "btn btn-discret btn-petit", text: "Retirer", "aria-label": "Retirer " + m.libelle, onclick: () => { majMouvement(m, () => "retirer"); rendreMonMois(); } })));
    };
    vider(z, blocRegle, h("div", { class: "defile" }, h("table", {},
      h("thead", {}, h("tr", {}, ["Date", "Libellé", "Catégorie", "Montant", ""].map((t, i) => h("th", { class: i === 3 ? "num" : null, text: t })))),
      h("tbody", {}, [...comptees].sort((a, b) => a.date < b.date ? 1 : -1).map(m => rang(m, false)), parties.map(m => rang(m, true))))), blocRegles);
  }
  $("b-ajouter").addEventListener("click", () => {
    const f = $("b-fiche-op");
    $("b-fiche-import").hidden = true;
    const sens = h("select", { id: "o-sens", onchange: () => majCats() });
    options(sens, [{ value: "depense", label: "Dépense" }, { value: "revenu", label: "Revenu" }, { value: "epargne", label: "Versement vers l'épargne" }, { value: "retrait", label: "Retrait de l'épargne" }], "depense");
    const cat = h("select", { id: "o-cat" });
    // La case ouverte donne le type et la catégorie de départ.
    const catDetail = detailMM && CASES_MM[detailMM].cats.length === 1 ? CASES_MM[detailMM].cats[0] : detailMM === "fixes" ? "transport" : detailMM === "variables" || detailMM === "courant" ? "courses" : null;
    if (catDetail) sens.value = catType(catDetail) === "revenu" ? "revenu" : catType(catDetail) === "epargne" ? "epargne" : "depense";
    const majCats = () => { const v = sens.value; const types = [v === "retrait" ? "epargne" : v]; options(cat, optsCategories(types), catDetail && types.includes(catType(catDetail)) ? catDetail : v === "epargne" || v === "retrait" ? "epargne" : v === "revenu" ? "salaire" : "courses"); };
    majCats();
    const dateDefaut = moisMM() === cleMois(new Date()) ? aujourdhui() : moisMM() + "-01";
    const erreur = h("p", { class: "erreur", hidden: true });
    vider(f, h("h3", { text: "Ajouter une opération" }),
      h("div", { class: "champs" },
        h("label", { class: "champ" }, h("span", { text: "Type" }), sens),
        h("label", { class: "champ" }, h("span", { text: "Date" }), h("input", { type: "date", id: "o-date", value: dateDefaut })),
        h("label", { class: "champ" }, h("span", { text: "Libellé" }), h("input", { id: "o-libelle", placeholder: "Ex. : Loyer novembre" })),
        h("label", { class: "champ" }, h("span", { text: "Montant (€)" }), h("input", { type: "number", id: "o-montant", min: "0", step: "0.01", inputmode: "decimal" })),
        h("label", { class: "champ" }, h("span", { text: "Catégorie" }), cat)),
      erreur,
      h("div", { class: "actions" },
        h("button", { class: "btn", text: "Enregistrer", onclick: () => {
          const montant = Math.abs(num($("o-montant").value)), date = $("o-date").value;
          if (!(montant > 0) || !date) { erreur.textContent = "Indique une date et un montant."; erreur.hidden = false; return; }
          const signe = sens.value === "revenu" || sens.value === "retrait" ? 1 : -1;
          ajouterMouvements([{ date, libelle: $("o-libelle").value.trim() || CAT[cat.value].nom, montant: signe * montant, categorie: cat.value }]);
          f.hidden = true; rendreMonMois();
        } }),
        h("button", { class: "btn btn-discret", text: "Annuler", onclick: () => { f.hidden = true; } })));
    f.hidden = false;
    $("o-montant").focus();
  });

  // Import d'un relevé avec Claude.
  let importOps = null, ctlImportB = null;
  $("b-importer").addEventListener("click", () => {
    $("b-fiche-op").hidden = true;
    $("b-import-fichiers").accept = [".csv", ".txt", "text/csv", "text/plain", ...(claudeImages ? claudeImages.mediaTypes : [])].join(",");
    $("b-fiche-import").hidden = false;
    $("b-import-texte").focus();
  });
  $("b-import-annuler").addEventListener("click", () => { $("b-fiche-import").hidden = true; importOps = null; vider($("b-import-apercu")); });
  $("b-import-lire").addEventListener("click", async () => {
    if (!sample) return;
    let texte = $("b-import-texte").value.trim();
    const fichiers = Array.from($("b-import-fichiers").files || []);
    const images = fichiers.filter(f => f.type.startsWith("image/"));
    for (const f of fichiers.filter(f => !f.type.startsWith("image/"))) {
      try { texte += "\n\n" + (await f.text()); } catch (_) {}
    }
    if (images.length && !claudeImages) { $("b-import-etat").textContent = "Les images ne peuvent pas être envoyées ici : colle plutôt le texte."; return; }
    if (!texte.trim() && !images.length) { $("b-import-etat").textContent = "Colle un texte ou ajoute un fichier."; return; }
    const annee = moisMM().slice(0, 4);
    // Ce que la page sait déjà de ses habitudes : ses règles, et ses opérations déjà classées (les plus récentes).
    const vus = new Map();
    for (const k of Object.keys(M).sort().reverse()) for (const m of M[k].mouvements) if (!vus.has(norm(m.libelle)) && vus.size < 40) vus.set(norm(m.libelle), `${m.libelle} (${m.montant > 0 ? "crédit" : "débit"}) → ${m.categorie}`);
    const regles = S.budget.regles;
    const prompt = `Tu lis un relevé de compte bancaire d'un particulier français (export CSV, texte copié ou captures d'écran). Extrais chaque opération.
Réponds uniquement par un objet JSON : {"operations":[{"date":"2026-11-03","libelle":"CARREFOUR CITY PARIS","montant":-23.45,"categorie":"courses"}]}
Règles :
- montant en euros, négatif pour un débit, positif pour un crédit. date au format AAAA-MM-JJ (année ${annee} si elle manque).
- categorie parmi : ${B.CATEGORIES_BUDGET.map(c => `${c.id} (${c.nom})`).join(", ")}.
- Un virement vers un livret, un PEA, un compte-titres, un plan d'investissement, Trade Republic ou une plateforme crypto : "epargne" (négatif). Un retour d'argent depuis ces comptes : "epargne" (positif).
- Salaire, paie (souvent un virement au nom de l'employeur en fin de mois) : "salaire". CAF, APL, prime d'activité, bourse d'études : "aides". Un remboursement (santé, achat retourné) : la catégorie de la dépense d'origine, montant positif.
- Carburant : "transport", y compris à la station d'un supermarché (Carrefour, Leclerc, Intermarché, Super U, Auchan…) : libellé avec STATION, CARBU, DAC, ESSENCE ou GAZOLE, ou un plein de 30 à 120 €. Péage, parking, entretien et crédit de la voiture : "transport".
- Retrait d'espèces (RETRAIT, DAB, ESPECES) : "especes", compté comme dépensé.${regles.length ? `
- SES RÈGLES, à appliquer en priorité (le libellé contient… → catégorie) : ${regles.map(r => `« ${r.motif} » → ${r.categorie}`).join(" ; ")}.` : ""}${vus.size ? `
- Ses opérations déjà classées, à suivre pour un libellé identique ou proche :\n${[...vus.values()].join("\n")}` : ""}
- Libellé court et lisible. N'invente aucune opération ; ignore les soldes, totaux et opérations en attente.${texte ? "\n\nRELEVÉ :\n" + texte.slice(0, 80000) : ""}${images.length ? "\n\nLes captures jointes montrent le relevé." : ""}`;
    $("b-import-lire").disabled = true; $("b-import-etat").textContent = "Claude lit ton relevé…";
    ctlImportB = new AbortController();
    try {
      const opts = { signal: ctlImportB.signal };
      if (images.length) opts.images = images.slice(0, claudeImages.maxCount);
      const r = await sample.json(prompt, opts);
      const existants = new Set(Object.values(M).flatMap(d => d.mouvements.map(m => `${m.date}|${num(m.montant).toFixed(2)}|${norm(m.libelle)}`)));
      importOps = (r && Array.isArray(r.operations) ? r.operations : []).filter(o => o && /^\d{4}-\d{2}-\d{2}$/.test(o.date) && num(o.montant) !== 0).map(o => {
        const op = { id: uid(), date: o.date, libelle: String(o.libelle || "Opération").slice(0, 120), montant: Math.round(num(o.montant) * 100) / 100, categorie: CAT[o.categorie] ? o.categorie : (num(o.montant) > 0 ? "autres-revenus" : "autres") };
        const regle = regles.find(r => norm(op.libelle).includes(norm(r.motif)));
        if (regle) { op.categorie = regle.categorie; op.regle = regle.motif; }
        op.doublon = existants.has(`${op.date}|${op.montant.toFixed(2)}|${norm(op.libelle)}`);
        op.garder = !op.doublon;
        return op;
      });
      $("b-import-etat").textContent = importOps.length ? `${importOps.length} opération${importOps.length > 1 ? "s" : ""} lue${importOps.length > 1 ? "s" : ""}. Vérifie les catégories avant d'enregistrer.` : "Aucune opération lisible.";
      rendreApercuBudget();
    } catch (e) {
      $("b-import-etat").textContent = e && e.code === "cancelled" ? "" : messageErreur(e);
    } finally { $("b-import-lire").disabled = false; ctlImportB = null; }
  });
  function rendreApercuBudget() {
    const z = $("b-import-apercu");
    if (!importOps || !importOps.length) { vider(z); return; }
    const doublons = importOps.filter(o => o.doublon).length;
    vider(z, h("div", { class: "aperçu" },
      h("div", { class: "defile" }, h("table", {},
        h("thead", {}, h("tr", {}, ["", "Date", "Libellé", "Catégorie", "Montant"].map((t, i) => h("th", { class: i === 4 ? "num" : null, text: t })))),
        h("tbody", {}, importOps.map(o => {
          const sel = h("select", { "aria-label": "Catégorie de " + o.libelle, onchange: e => { o.categorie = e.target.value; } });
          options(sel, optsCategories(), o.categorie);
          return h("tr", {},
            h("td", {}, h("input", { type: "checkbox", checked: o.garder, "aria-label": "Garder " + o.libelle, onchange: e => { o.garder = e.target.checked; } })),
            h("td", { class: "chiffre", text: new Date(o.date + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" }) }),
            h("td", { style: "min-width:160px" }, o.libelle, o.doublon ? h("small", { class: "muet", text: " · déjà enregistrée" }) : null, o.regle ? h("small", { class: "muet", text: " · ta règle" }) : null),
            h("td", {}, sel),
            h("td", { class: "num chiffre " + (o.montant >= 0 ? "gain" : ""), text: eurSigne(o.montant) }));
        })))),
      doublons ? h("p", { class: "note", text: `${doublons} opération${doublons > 1 ? "s semblent" : " semble"} déjà enregistrée${doublons > 1 ? "s" : ""} : décochée${doublons > 1 ? "s" : ""}.` }) : null,
      h("div", { class: "actions" }, h("button", { class: "btn", text: "Enregistrer les opérations cochées", onclick: () => {
        const gardees = importOps.filter(o => o.garder).map(({ doublon, garder, regle, ...o }) => o);
        if (!gardees.length) return;
        ajouterMouvements(gardees);
        const mois = gardees.map(o => o.date.slice(0, 7)).sort();
        importOps = null; vider(z); $("b-fiche-import").hidden = true; $("b-import-texte").value = ""; $("b-import-fichiers").value = ""; $("b-import-etat").textContent = "";
        rendreMonMois();
      } }))));
  }

  // ---------- ma paie ----------
  const PAIE = B.PAIE;
  function paie() {
    const p = S.budget.paie || {};
    return { brut: num(p.brut) || PAIE.smicMensuel, heures: num(p.heures) || 151.67, pas: num(p.pas),
      entree: p.entree || "", categorie: p.categorie || "1-2", smic: p.smic !== false, hausse: p.hausse != null && p.hausse !== "" ? num(p.hausse) : 2,
      hs: num(p.hs), prime: num(p.prime), augm: num(p.augm) };
  }
  // Du brut au net, cotisation par cotisation, comme sur la fiche de paie. `f` indexe la mutuelle
  // (liée au plafond de la Sécurité sociale) pour les années à venir.
  function netDepuisBrut(brut, hsBrut = 0, f = 1) {
    const c = PAIE.cotisations;
    const proportionnelles = brut * c.proportionnelles / 100, mutuelle = c.mutuelle * f;
    const csg = (brut * c.assietteCsg / 100 + c.mutuellePatronale * f + brut * c.prevoyancePatronale / 100) * c.csg / 100;
    const reduction = hsBrut * Math.min(PAIE.reductionHeuresSup, c.proportionnelles) / 100;
    return { net: brut - proportionnelles - mutuelle - csg + reduction, proportionnelles, mutuelle, csg, reduction };
  }
  // Prime d'ancienneté (convention de l'habillement) à une date donnée.
  function primeAnciennete(p, iso) {
    if (!p.entree) return 0;
    const ans = (new Date(iso + "T12:00:00") - new Date(p.entree + "T12:00:00")) / (365.25 * 86400000);
    const i = [3, 6, 9, 12, 15, 18].filter(a => ans >= a).length - 1;
    return i < 0 ? 0 : (PAIE.anciennete[p.categorie] || PAIE.anciennete["1-2"])[i] * Math.min(1, p.heures / 151.67);
  }
  // Prime d'activité après une hausse de revenu net : baisse d'environ 39 % de la hausse, jamais sous 0.
  const primeActiviteApres = (pa, hausseNette) => { const v = Math.max(0, pa - hausseNette * PAIE.baissePrimeActivite / 100); return v < 15 ? 0 : v; };
  const PAIE_CHAMPS = { "paie-poste": "poste", "paie-brut": "brut", "paie-heures": "heures", "paie-pas": "pas", "paie-entree": "entree", "paie-categorie": "categorie", "paie-hs": "hs", "paie-prime": "prime", "paie-augm": "augm", "paie-hausse": "hausse" };
  for (const [id, cle] of Object.entries(PAIE_CHAMPS)) {
    const el = $(id);
    el.addEventListener(el.tagName === "SELECT" || el.type === "date" ? "change" : "input", e => {
      S.budget.paie ||= {};
      S.budget.paie[cle] = e.target.type === "number" ? (e.target.value === "" ? "" : num(e.target.value)) : e.target.value;
      enregistrer("budget"); rendrePaie();
    });
  }
  $("paie-smic").addEventListener("change", e => { S.budget.paie ||= {}; S.budget.paie.smic = e.target.checked; enregistrer("budget"); rendrePaie(); });

  function rendrePaie() {
    const p = paie(), pa = num(S.budget.prevu.aides), pl = planBudget();
    remplir("paie-poste", (S.budget.paie || {}).poste || "");
    remplir("paie-brut", p.brut); remplir("paie-heures", p.heures); remplir("paie-pas", p.pas);
    remplir("paie-entree", p.entree); remplir("paie-categorie", p.categorie); remplir("paie-smic", p.smic);
    remplir("paie-hs", p.hs || ""); remplir("paie-prime", p.prime || ""); remplir("paie-augm", p.augm || "");
    remplir("paie-hausse", p.hausse);
    const horaire = p.brut / p.heures, auSmic = Math.abs(horaire / PAIE.smicHoraire - 1) < 0.01;
    const base = netDepuisBrut(p.brut);
    const impot = x => x * (1 - p.pas / 100);
    const netBase = impot(base.net);
    $("paie-note").textContent = `${pct(base.net / p.brut * 100, 1)} du brut arrive sur ton compte`;
    const tuile = (lib, val, sous, cls) => h("div", { class: "tuile" }, h("span", { class: "etiquette", text: lib }), h("b", { class: cls || null, text: val }), sous ? h("span", { class: "petit muet", text: sous }) : null);
    const prochaine = primeAnciennete(p, ajouterMois(aujourdhui(), 1)) || null;
    const debutAnc = p.entree ? ajouterMois(p.entree, 36) : null;
    const ecartBudget = num(S.budget.prevu.salaire) ? netBase - num(S.budget.prevu.salaire) : 0;
    const ligneCot = (lib, v) => h("tr", {}, h("td", { text: lib }), h("td", { class: "num chiffre", text: "−" + eur(v, 2) }));
    vider($("paie-aujourdhui"), h("div", { class: "tuiles" },
      tuile("Taux horaire brut", eur(horaire, 2), auSmic ? `le SMIC (${eur(PAIE.smicHoraire, 2)} depuis le ${dateFr(PAIE.smicDepuis)})` : `SMIC : ${eur(PAIE.smicHoraire, 2)}`),
      tuile("Net sur ton compte", eur(netBase, 2), p.pas ? `après ${pct(p.pas, 1)} d'impôt à la source` : "sans heures en plus, pas d'impôt prélevé"),
      tuile("Avec la prime d'activité", eur(netBase + pa, 0), pa ? `dont ${eur(pa, 0)} de prime d'activité` : "sans prime d'activité"),
      tuile("Prime d'ancienneté", prochaine ? eur(prochaine, 0) + " brut" : debutAnc ? "dès le " + dateFr(debutAnc) : "—", debutAnc && !prochaine ? `${eur((PAIE.anciennete[p.categorie] || [])[0] || 34, 0)} brut par mois au début` : null)),
      h("details", {}, h("summary", { text: "Du brut au net, ligne par ligne" }), h("div", { class: "defile" }, h("table", {}, h("tbody", {},
        h("tr", {}, h("td", { text: "Salaire brut" }), h("td", { class: "num chiffre", text: eur(p.brut, 2) })),
        ligneCot("Sécurité sociale, retraite complémentaire et prévoyance (11,645 %)", base.proportionnelles),
        ligneCot("Mutuelle de l'entreprise", base.mutuelle),
        ligneCot("CSG et CRDS (9,70 %)", base.csg),
        h("tr", { class: "table-total" }, h("td", { text: "Net à payer" }), h("td", { class: "num chiffre", text: eur(base.net, 2) }))))),
        h("p", { class: "note", text: "Taux de ta fiche de paie d'octobre 2026. Ils peuvent bouger un peu chaque 1er janvier (mutuelle, plafond de la Sécurité sociale)." })),
      Math.abs(ecartBudget) > 5 ? h("p", { class: "petit muet", text: `Ton budget prévoit ${eur(num(S.budget.prevu.salaire), 2)} de salaire ; le calcul donne ${eur(netBase, 2)}.` }) : null,
      auSmic && p.smic ? h("p", { class: "petit muet", text: "Ton salaire est au SMIC : il augmente à chaque revalorisation (au 1er janvier, et en cours d'année si l'inflation dépasse 2 %, comme le 1er juin 2026). Entre deux, il ne bouge qu'avec des heures en plus, des primes ou une augmentation que tu demandes." }) : null);

    // Un mois différent.
    const hsBrut = p.hs * horaire * 1.25;
    const mois = netDepuisBrut(p.brut + p.augm + hsBrut, hsBrut);
    const avecAugm = netDepuisBrut(p.brut + p.augm);
    const hsNet = mois.net - avecAugm.net, augmNet = impot(avecAugm.net - base.net);
    const primeNet = impot(netDepuisBrut(p.brut + p.augm + hsBrut + p.prime, hsBrut).net - mois.net);
    const recurrent = hsNet + augmNet;
    const z = $("paie-simulation");
    if (!(recurrent > 0 || primeNet > 0)) { vider(z, h("p", { class: "vide", text: "Ajoute des heures supplémentaires, une prime ou une augmentation pour voir ce qu'elles rapportent vraiment." })); }
    else {
      const paApres = primeActiviteApres(pa, recurrent);
      const gainReel = recurrent - (pa - paApres);
      const plm = planDuMois();
      const ratio = plm.palier ? num(plm.palier.versement) / Math.max(1, num(plm.palier.versement) + num(plm.palier.investi)) : 0;
      const lignes = [];
      if (hsBrut > 0) lignes.push(`${nf(0, 2).format(p.hs)} h supplémentaires majorées de 25 % (${eur(horaire * 1.25, 4)} de l'heure) : ${eur(hsBrut, 2)} brut, ${eur(hsNet, 2)} net (cotisations réduites, sans impôt sur le revenu jusqu'à 7 500 € par an).`);
      if (augmNet > 0) lignes.push(`Une augmentation de ${eur(p.augm, 0)} brut par mois : ${eur(augmNet, 2)} net de plus chaque mois.`);
      if (recurrent > 0 && pa > 0) lignes.push(`Ta prime d'activité baisserait d'environ ${eur(pa - paApres, 0)} par mois au trimestre suivant : le gain réel est d'environ ${eur(gainReel, 0)} par mois. Pour des heures sup ponctuelles, la baisse ne touche qu'un trimestre.`);
      if (recurrent > 0) lignes.push(plm.palier ? `Selon ta stratégie, ces ${eur(gainReel, 0)} iraient à ${eur(gainReel * ratio, 0)} sur ton épargne de précaution et ${eur(gainReel * (1 - ratio), 0)} sur tes investissements (partage du palier en cours).` : `Selon ta stratégie, ces ${eur(gainReel, 0)} pourraient aller à tes investissements.`);
      if (primeNet > 0) {
        const c = conseilRentree(Math.round(primeNet));
        lignes.push(`Une prime de ${eur(p.prime, 0)} brut : ${eur(primeNet, 0)} net, une fois. ${pa > 0 ? `Ta prime d'activité du trimestre suivant baisserait d'environ ${eur(Math.min(pa * 3, primeNet * PAIE.baissePrimeActivite / 100), 0)} au total, à garder de côté. ` : ""}Selon ta stratégie : ${[...c.versComptes.map(v => `${eur(v.montant, 0)} sur ${v.compte ? v.compte.nom : "un livret"}`), ...c.plan.map(x => `${eur(x.montant, 0)} sur ${x.ligne ? x.ligne.nom : x.poche.nom}`)].join(", ") || "rien à placer"}.`);
      }
      vider(z, h("div", { class: "tuiles" },
        tuile("Net du mois", eur(netBase + hsNet + augmNet + primeNet, 2), `au lieu de ${eur(netBase, 2)}`),
        recurrent > 0 ? tuile("Gain réel par mois", eur(gainReel, 0), pa ? "après la baisse de la prime d'activité" : null) : null),
        h("ul", { style: "margin:4px 0 0;padding-left:1.2em;display:grid;gap:4px" }, lignes.map(x => h("li", { text: x }))));
    }

    // Les prochaines années.
    const zf = $("paie-futur"), an0 = new Date().getFullYear(), g = p.hausse / 100, infl = num((S.comparer || {}).inflation || 2) / 100;
    const objectif = num(S.strategie.profil.objectifAnnee) || an0 + 28;
    const annees = [...new Set([...Array.from({ length: 8 }, (_, i) => an0 + 1 + i), an0 + 10, an0 + 15, objectif].filter(a => a > an0 && a <= objectif))].sort((a, b) => a - b);
    const rangs = annees.map(a => {
      const n = a - an0, f = Math.pow(1 + g, n);
      let brutBase = (p.brut + p.augm) * f;
      if (p.smic) brutBase = Math.max(brutBase, PAIE.smicMensuel * f * Math.min(1, p.heures / 151.67));
      const anc = primeAnciennete(p, `${a}-07-01`);
      const brut = brutBase + anc, net = impot(netDepuisBrut(brut, 0, f).net);
      const paA = primeActiviteApres(pa * f, net - netBase * f);
      const total = net + paA, reel = total / Math.pow(1 + infl, n);
      return { a, brut, anc, net, pa: paA, total, reel, capacite: total - pl.depenses * Math.pow(1 + infl, n) };
    });
    const aujourd = netBase + pa, fin = rangs[rangs.length - 1];
    vider(zf,
      fin ? h("p", {}, `${p.smic && !p.augm ? "Si ton salaire suit le SMIC" : "Avec ces hypothèses"} (+${pct(p.hausse, 1)} par an${p.augm ? `, et ton augmentation de ${eur(p.augm, 0)} brut` : ""}), tu toucherais environ ${eur(rangs[0].total, 0)} par mois en ${rangs[0].a} et ${eur(fin.total, 0)} en ${fin.a}, soit ${eur(fin.reel, 0)} d'aujourd'hui (aujourd'hui : ${eur(aujourd, 0)}). ${p.smic && !p.augm ? "Ton pouvoir d'achat resterait presque le même : ce sont les augmentations que tu obtiendras, les heures en plus et ton épargne qui feront la différence. " : ""}${p.entree ? `La prime d'ancienneté démarre le ${dateFr(ajouterMois(p.entree, 36))}.` : ""}`) : null,
      h("div", { class: "defile" }, h("table", {},
        h("thead", {}, h("tr", {}, ["Année", "Brut", "dont ancienneté", "Net", "Prime d'activité", "Total par mois", "En € d'aujourd'hui", "À épargner*"].map((x, i) => h("th", { class: i ? "num" : null, text: x })))),
        h("tbody", {}, rangs.map(r => h("tr", {}, h("td", { text: String(r.a) }),
          h("td", { class: "num chiffre", text: eur(r.brut, 0) }), h("td", { class: "num chiffre", text: r.anc ? eur(r.anc, 0) : "—" }),
          h("td", { class: "num chiffre", text: eur(r.net, 0) }), h("td", { class: "num chiffre", text: r.pa ? eur(r.pa, 0) : "—" }),
          h("td", { class: "num chiffre", text: eur(r.total, 0) }), h("td", { class: "num chiffre", text: eur(r.reel, 0) }),
          h("td", { class: "num chiffre", text: eur(r.capacite, 0) })))))),
      h("p", { class: "note", text: "Sans heures supplémentaires. * Si tes dépenses restent celles de ton budget prévu (chez tes parents), augmentées de l'inflation : à recalculer avec « Et si je déménage ? ». Estimations : cotisations de ta fiche de paie, prime d'activité qui baisse d'environ 39 % de chaque hausse de revenu, prime d'ancienneté de la convention de l'habillement (catégorie de ta fiche de paie) ; pour la prime d'activité exacte, le simulateur de la CAF fait foi." }));
  }

  // ---------- DÉCIDER ----------
  const SENS = { acheter: "Acheter", renforcer: "Renforcer", alleger: "Alléger", vendre: "Vendre" };
  const STATUTS = { "a-faire": "à décider", faite: "faite", abandonnee: "abandonnée" };
  const CHECK_ACHAT = [
    { id: "q-comprendre", principe: "comprendre", texte: "Je peux expliquer en deux phrases ce que fait cet actif et d'où viennent ses revenus." },
    { id: "q-hausse", principe: "biais", texte: "Je ne l'achète pas parce qu'il a beaucoup monté ces dernières semaines." },
    { id: "q-baisse", principe: "volatilite", texte: "Je le garderais s'il baissait de 40 % demain." },
    { id: "q-prix", principe: "valorisation", texte: "J'ai regardé son prix (valorisation, ou frais et indice suivi pour un fonds), pas seulement l'histoire." },
    { id: "q-sortie", principe: "journal", texte: "Je sais ce qui me ferait changer d'avis et vendre." }
  ];
  const CHECK_VENTE = [
    { id: "q-raison", principe: "volatilite", texte: "La raison pour laquelle j'avais acheté a disparu, ou ma stratégie le demande." },
    { id: "q-panique", principe: "biais", texte: "Je ne vends pas seulement parce que le cours a baissé ou que l'actualité fait peur." },
    { id: "q-argent", principe: "allocation", texte: "Je sais où ira l'argent de la vente." },
    { id: "q-impot", principe: "enveloppes", texte: "J'ai regardé l'impôt éventuel." }
  ];
  // Passe une opération en revue selon la stratégie : renvoie les constats et la répartition après.
  function verifierOperation(op) {
    const st = S.strategie, r = st.regles, F = B.FISCALITE, out = [];
    const ajoute = (niveau, texte) => out.push({ niveau, texte });
    const avant = synthese();
    const montant = op.montant;
    // Portefeuille après l'opération.
    let lignesApres = clone(S.portefeuille.lignes);
    let cible = op.ligne ? lignesApres.find(l => l.id === op.ligne.id) : null;
    if (!cible && op.achat && montant > 0) {
      cible = { id: "__nouveau", nom: op.nom || "Nouvel actif", type: op.type, enveloppe: op.enveloppe, poche: op.poche, classe: "", quantite: 1, pru: 0, cours: 0, frais: op.frais || 0 };
      lignesApres.push(cible);
    }
    if (cible && montant > 0) {
      const ch = chiffrer(cible), valeur = ch.valeur;
      if (cible.sansQuantite) {
        const ratio = num(cible.cours) > 0 && valeur > 0 ? valeur / num(cible.cours) : 1;
        cible.cours = Math.max(0, num(cible.cours) + (op.achat ? montant : -Math.min(montant, valeur)) / ratio);
        if (op.achat) cible.pru = num(cible.pru) + montant;
      } else if (op.achat) {
        if (valeur > 0 && ch.cours > 0) { const q = montant / ch.cours; cible.pru = (num(cible.pru) * num(cible.quantite) + montant) / (num(cible.quantite) + q); cible.quantite = num(cible.quantite) + q; }
        else { cible.quantite = 1; cible.cours = montant; cible.pru = montant; }
      } else if (ch.cours > 0) {
        cible.quantite = Math.max(0, num(cible.quantite) - Math.min(montant, valeur) / ch.cours);
      }
      lignesApres = lignesApres.filter(l => chiffrer(l).valeur > 0.005);
    }
    const apres = synthese(lignesApres);
    const nomPoche = id => (st.poches.find(p => p.id === id) || {}).nom;

    if (!op.nom) ajoute("info", "Choisis une ligne ou donne un nom à l'actif.");
    if (!(montant > 0)) ajoute("info", "Indique un montant pour voir l'effet sur ta répartition.");
    if (op.achat && op.type === "Produit à levier" && r.interditLevier) ajoute("bloquant", "Produit à levier ou complexe : ta règle l'interdit.");

    // Répartition.
    if (montant > 0) {
      const pAv = avant.poches.find(p => p.id === op.poche), pAp = apres.poches.find(p => p.id === op.poche);
      if (pAp) {
        const c = num(pAp.cible), marge = num(r.marge);
        if (op.achat) {
          if (pAp.poids > c + marge) ajoute("attention", `Après l'achat, ${pAp.nom} pèserait ${pct(pAp.poids)} pour une cible de ${pct(c, 0)} : au-delà de ta marge.`);
          else if (pAv && pAv.ecart < 0 && pAp.ecart > pAv.ecart) ajoute("ok", `Cet achat rapproche ${pAp.nom} de sa cible (${pct(pAv.poids)} → ${pct(pAp.poids)} pour ${pct(c, 0)}).`);
          else ajoute("ok", `${pAp.nom} reste dans ta marge (${pct(pAp.poids)} pour ${pct(c, 0)}).`);
        } else {
          if (pAp.poids < c - marge) ajoute("attention", `Après la vente, ${pAp.nom} tomberait à ${pct(pAp.poids)} pour une cible de ${pct(c, 0)}.`);
          else if (pAv && pAv.ecart > marge) ajoute("ok", `La vente ramène ${pAp.nom} vers sa cible (${pct(pAv.poids)} → ${pct(pAp.poids)} pour ${pct(c, 0)}).`);
        }
      } else if (op.nom) {
        ajoute("attention", op.achat ? "Cet actif n'entre dans aucune poche de ta stratégie : c'est un pari hors plan. Si c'est voulu, crée une poche avec une cible." : "Cette ligne était hors stratégie : la vendre simplifie ton portefeuille.");
      }
      // Diversification.
      if (op.achat && op.type === "Action" && actif("diversification")) {
        const l = apres.lignes.find(x => x.id === (cible || {}).id);
        if (l && l.poids > num(r.maxAction)) ajoute("bloquant", `${l.nom} pèserait ${pct(l.poids)} du portefeuille ; ta règle : ${pct(num(r.maxAction))} au plus par action.`);
        else if (l) ajoute("ok", `${l.nom} pèserait ${pct(l.poids)} du portefeuille, sous ta limite de ${pct(num(r.maxAction))}.`);
        if (apres.directPoids > num(r.maxDirect)) ajoute("bloquant", `Les actions en direct passeraient à ${pct(apres.directPoids)} ; ta règle : ${pct(num(r.maxDirect), 0)} au plus.`);
      }
      const opCrypto = op.type === "Crypto" || op.enveloppe === "Crypto" || (st.poches.find(p => p.id === op.poche) || {}).classe === "crypto";
      if (op.achat && opCrypto && actif("diversification")) {
        if (apres.cryptoPoids > num(r.maxCrypto)) ajoute("bloquant", `La crypto passerait à ${pct(apres.cryptoPoids)} de tes investissements ; ta règle : ${pct(num(r.maxCrypto), 0)} au plus.`);
        else ajoute("ok", `La crypto resterait à ${pct(apres.cryptoPoids)} de tes investissements, sous ta limite de ${pct(num(r.maxCrypto), 0)}.`);
      }
    }
    // Frais.
    if (op.achat && (op.type === "ETF" || op.type === "Fonds") && actif("frais")) {
      if (op.frais == null) ajoute("info", "Renseigne les frais annuels du fonds pour les vérifier.");
      else if (op.frais > num(r.fraisMax)) ajoute("attention", `Frais de ${pct(op.frais, 2)} par an, au-dessus de ton plafond de ${pct(num(r.fraisMax), 2)}. Sur 20 ans, 1 % de frais en plus coûte environ 18 % du capital final.`);
      else ajoute("ok", `Frais de ${pct(op.frais, 2)} par an, sous ton plafond.`);
    }
    // Épargne de précaution : un achat prévu se fait en parallèle, un achat hors plan la retarde.
    if (op.achat && actif("precaution")) {
      const pl = planDuMois();
      if (pl.obj > 0 && pl.manque > 0) {
        if (op.prevu && pl.vp > 0) ajoute("info", `Ton épargne de précaution se constitue en parallèle (${eur(pl.act, 0)} sur ${eur(pl.obj, 0)}, complète en ${moisFr(pl.fin)}) : un achat prévu dans ton plan ne la retarde pas.`);
        else ajoute("attention", `Ton épargne de précaution n'est pas complète (${eur(pl.act, 0)} sur ${eur(pl.obj, 0)}). Un achat hors plan la retarde : selon ta stratégie, cet argent irait d'abord sur ${pl.compte ? pl.compte.nom : "ton livret"}.`);
      }
    }
    // Horizon.
    const risquee = ["Action", "ETF", "Fonds", "Crypto", "Produit à levier"].includes(op.type);
    if (op.achat && actif("horizon") && risquee && op.horizon < 5) ajoute("attention", "Tu comptes le garder moins de 5 ans : l'argent dont tu auras besoin bientôt ne devrait pas être en actions.");
    // Délai de réflexion.
    if (op.achat) {
      if (op.prevu) ajoute("ok", "Prévu dans ton plan.");
      else if (r.delaiActif && actif("biais") && op.depuis * 24 < num(r.delaiHeures)) {
        const d = new Date(Date.now() + (num(r.delaiHeures) - op.depuis * 24) * 3600000);
        ajoute("attention", `Achat non prévu : ta règle demande d'attendre ${num(r.delaiHeures)} heures. Reviens-y à partir du ${d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}.`);
      }
    }
    // Enveloppe.
    if (op.achat && actif("enveloppes")) {
      if (op.enveloppe === "PEA") {
        if (op.type === "Crypto") ajoute("bloquant", "Les cryptomonnaies ne peuvent pas aller dans un PEA.");
        if (op.type === "Action" && ["États-Unis", "Asie", "Pays émergents"].includes(op.zone)) ajoute("bloquant", "Les actions hors de l'Union européenne ne sont pas éligibles au PEA.");
        if (op.type === "ETF" && !op.ligne) ajoute("info", "Vérifie que l'ETF est bien éligible au PEA (indiqué dans sa fiche).");
        const v = num(st.enveloppes.peaVersements);
        if (v > 0 && montant > 0 && v + montant > F.plafondPEA) ajoute("bloquant", `Ce versement porterait ton PEA à ${eur(v + montant, 0)}, au-delà du plafond de 150 000 €.`);
      } else if (op.enveloppe === "CTO" && op.type === "ETF" && st.enveloppes.peaOuverture) {
        ajoute("info", "Sur ton compte-titres, les gains paieront 31,4 %. Si une version éligible PEA de cet ETF existe, elle ne paierait que 18,6 % une fois ton PEA âgé de 5 ans.");
      }
    }
    // Vente : impôt et perte.
    if (!op.achat && op.ligne && montant > 0) {
      const l = avant.lignes.find(x => x.id === op.ligne.id);
      const part = l && l.valeur > 0 ? Math.min(1, montant / l.valeur) : 0;
      const pv = l ? l.pv * part : 0;
      if (op.enveloppe === "CTO" && pv > 0) ajoute("info", `Impôt estimé sur la vente : ≈ ${eur(pv * (F.ir + F.ps) / 100, 0)} (31,4 % de ${eur(pv, 0)} de plus-value).`);
      if (op.enveloppe === "Crypto" || op.type === "Crypto")
        ajoute("info", (pv > 0 ? `Repasser en euros déclenche environ ${eur(pv * (F.ir + F.ps) / 100, 0)} d'impôt (31,4 % de ${eur(pv, 0)} de plus-value), sauf si tes ventes de crypto de l'année restent sous ${F.seuilCrypto} €.` : "Pas de plus-value : pas d'impôt sur cette vente.") + " Un échange contre une autre crypto n'est pas imposé.");
      if (op.enveloppe === "PEA") {
        const ans = anneesDepuis(st.enveloppes.peaOuverture);
        ajoute("info", "Vendre à l'intérieur du PEA ne déclenche pas d'impôt tant que l'argent y reste." + (ans != null && ans < 5 ? " Attention : retirer de l'argent du PEA avant ses 5 ans entraîne en principe sa clôture." : ""));
      }
      if (op.enveloppe === "AV") ajoute("info", "Un rachat sur l'assurance-vie n'est taxé que sur la part de gains qu'il contient.");
      if (l && l.pvPct < -0.5 && !op.prevu && r.venteEnPerte && actif("volatilite"))
        ajoute("attention", `Tu vendrais avec une perte de ${pct(-l.pvPct)} alors que ce n'est pas prévu : vendre après une baisse fige la perte. Ta raison d'acheter a-t-elle disparu ?`);
    }
    if (!op.raison) ajoute("attention", "Écris ta raison : c'est ce qui permettra de faire le bilan.");
    const questions = (op.achat ? CHECK_ACHAT : CHECK_VENTE).filter(q => actif(q.principe));
    const manquantes = questions.filter(q => !op.reponses[q.id]);
    if (manquantes.length) ajoute("attention", `Check-list : ${manquantes.length} point${manquantes.length > 1 ? "s" : ""} sur ${questions.length} pas encore coché${manquantes.length > 1 ? "s" : ""}.`);
    else if (questions.length) ajoute("ok", "Check-list complète.");

    const ordre = { bloquant: 0, attention: 1, info: 2, ok: 3 };
    out.sort((a, b) => ordre[a.niveau] - ordre[b.niveau]);
    const nb = n => out.filter(x => x.niveau === n).length;
    const verdict = nb("bloquant") ? { niveau: "bloquant", titre: "Contraire à tes règles" }
      : nb("attention") ? { niveau: "attention", titre: `À revoir : ${nb("attention")} point${nb("attention") > 1 ? "s" : ""}` }
      : { niveau: "ok", titre: "Conforme à ta stratégie" };
    return { constats: out, verdict, avant, apres };
  }

  // ---------- COMPARER : simulation de Monte-Carlo ----------
  const NB_SIM = 1500;
  function choleski(M) {
    const n = M.length, L = M.map(() => new Array(n).fill(0));
    for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
      let s = M[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      L[i][j] = i === j ? Math.sqrt(Math.max(s, 1e-10)) : s / L[j][j];
    }
    return L;
  }
  const CHOL = choleski(B.CORRELATIONS);
  function aleatoire(graine) {
    let a = graine >>> 0;
    const u = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    let reserve = null;
    return () => {
      if (reserve != null) { const r = reserve; reserve = null; return r; }
      let x, y, s;
      do { x = u() * 2 - 1; y = u() * 2 - 1; s = x * x + y * y; } while (s >= 1 || s === 0);
      const f = Math.sqrt(-2 * Math.log(s) / s);
      reserve = y * f; return x * f;
    };
  }
  function impotSortie(gains, enveloppe, annees, F) {
    if (gains <= 0) return 0;
    if (enveloppe === "PEA") return gains * (annees >= 5 ? F.ps : F.ir + F.ps) / 100;
    if (enveloppe === "CTO" || enveloppe === "Crypto") return gains * (F.ir + F.ps) / 100;
    if (enveloppe === "AV") return annees >= 8 ? Math.max(0, gains - F.abattementAV) * F.irAV8 / 100 + gains * F.psAV / 100 : gains * (F.ir + F.psAV) / 100;
    return 0;
  }
  const quantile = (trie, q) => { const i = (trie.length - 1) * q, b = Math.floor(i), f = i - b; return trie[b] + (b + 1 < trie.length ? (trie[b + 1] - trie[b]) * f : 0); };

  // p : { capital, versement, duree, inflation, strategies: [{nom, poids, frais, enveloppe, entree}], hypotheses, fiscalite, objectif: {montant, annee} }
  function simuler(p, nSim = NB_SIM) {
    const K = B.CLASSES.length, ids = B.CLASSES.map(c => c.id);
    const duree = Math.max(1, Math.min(40, Math.round(num(p.duree)))), mois = duree * 12;
    const mu = ids.map(id => Math.log(1 + num(p.hypotheses[id].rendement) / 100) / 12);
    const sig = ids.map(id => num(p.hypotheses[id].volatilite) / 100 / Math.sqrt(12));
    const iMon = ids.indexOf("monetaire");
    const strats = p.strategies.map(s => {
      const tot = somme(ids, id => num(s.poids[id]));
      return { w: ids.map(id => tot > 0 ? num(s.poids[id]) / tot : 0), f: 1 - Math.pow(1 - num(s.frais) / 100, 1 / 12), etale: s.entree === "etale", enveloppe: s.enveloppe };
    });
    const NS = strats.length, capital = num(p.capital), versement = num(p.versement);
    const valeurs = strats.map(() => Array.from({ length: duree + 1 }, () => new Float64Array(nSim)));
    const sansFrais = strats.map(() => new Float64Array(nSim));
    const baisses = strats.map(() => new Float64Array(nSim));
    const rnd = aleatoire(20261105);
    const z = new Float64Array(K), R = new Float64Array(K);
    const V = new Float64Array(NS), C = new Float64Array(NS), VS = new Float64Array(NS), CS = new Float64Array(NS), I = new Float64Array(NS), P = new Float64Array(NS), D = new Float64Array(NS);
    for (let n = 0; n < nSim; n++) {
      for (let s = 0; s < NS; s++) {
        V[s] = strats[s].etale ? 0 : capital; C[s] = strats[s].etale ? capital : 0;
        VS[s] = V[s]; CS[s] = C[s]; I[s] = 1; P[s] = 1; D[s] = 0;
        valeurs[s][0][n] = capital;
      }
      for (let m = 1; m <= mois; m++) {
        for (let k = 0; k < K; k++) z[k] = rnd();
        for (let i = 0; i < K; i++) {
          let e = 0; const Li = CHOL[i];
          for (let k = 0; k <= i; k++) e += Li[k] * z[k];
          R[i] = Math.exp(mu[i] + sig[i] * e) - 1;
        }
        for (let s = 0; s < NS; s++) {
          const st = strats[s]; let rp = 0;
          for (let k = 0; k < K; k++) if (st.w[k]) rp += st.w[k] * R[k];
          let apport = versement;
          if (st.etale && m <= 12) { const t = capital / 12; apport += t; C[s] -= t; CS[s] -= t; }
          C[s] = Math.max(0, C[s]) * (1 + R[iMon]); CS[s] = Math.max(0, CS[s]) * (1 + R[iMon]);
          V[s] = (V[s] + apport) * (1 + rp) * (1 - st.f);
          VS[s] = (VS[s] + apport) * (1 + rp);
          I[s] *= (1 + rp) * (1 - st.f);
          if (I[s] > P[s]) P[s] = I[s]; else { const d = 1 - I[s] / P[s]; if (d > D[s]) D[s] = d; }
        }
        if (m % 12 === 0) { const a = m / 12; for (let s = 0; s < NS; s++) valeurs[s][a][n] = V[s] + C[s]; }
      }
      for (let s = 0; s < NS; s++) { sansFrais[s][n] = VS[s] + CS[s] - (V[s] + C[s]); baisses[s][n] = D[s]; }
    }
    const F = p.fiscalite, infl = num(p.inflation) / 100;
    const verse = a => capital + versement * 12 * a;
    // Versements en euros d'aujourd'hui : chacun corrigé de l'inflation à sa date.
    const verseReel = a => { let t = capital; for (let m = 1; m <= a * 12; m++) t += versement / Math.pow(1 + infl, m / 12); return t; };
    const anneeObj = p.objectif && p.objectif.annee ? Math.round(num(p.objectif.annee)) - new Date().getFullYear() : null;
    const res = strats.map((st, s) => {
      const bandes = [];
      for (let a = 0; a <= duree; a++) {
        const tri = Float64Array.from(valeurs[s][a]).sort();
        bandes.push({ a, p10: quantile(tri, 0.1), p50: quantile(tri, 0.5), p90: quantile(tri, 0.9), deflateur: Math.pow(1 + infl, a) });
      }
      const nets = Float64Array.from(valeurs[s][duree], v => v - impotSortie(v - verse(duree), st.enveloppe, duree, F)).sort();
      const finals = Float64Array.from(valeurs[s][duree]).sort();
      const perte = nets.filter(v => v < verse(duree)).length / nSim;
      const defFin = Math.pow(1 + infl, duree), vr = verseReel(duree);
      const perteReel = nets.filter(v => v / defFin < vr).length / nSim;
      const dd = Float64Array.from(baisses[s]).sort();
      const fr = Float64Array.from(sansFrais[s]).sort();
      let objectif = null;
      if (anneeObj != null && anneeObj >= 1 && anneeObj <= duree && num(p.objectif.montant) > 0) {
        const def = Math.pow(1 + infl, anneeObj);
        const ok = valeurs[s][anneeObj].filter(v => (v - impotSortie(v - verse(anneeObj), st.enveloppe, anneeObj, F)) / def >= num(p.objectif.montant)).length;
        objectif = ok / nSim;
      }
      const brutMed = quantile(finals, 0.5);
      return {
        bandes, verse: verse(duree), verseReel: vr, perteReel, deflateur: defFin,
        p10: quantile(nets, 0.1), p50: quantile(nets, 0.5), p90: quantile(nets, 0.9),
        impotMedian: impotSortie(brutMed - verse(duree), st.enveloppe, duree, F),
        fraisMedian: quantile(fr, 0.5), perte, baisseMed: quantile(dd, 0.5), baisseP90: quantile(dd, 0.9), objectif
      };
    });
    return { duree, res, anneeObj, verseAnnees: Array.from({ length: duree + 1 }, (_, a) => ({ nominal: verse(a), reel: verseReel(a) })) };
  }

  const hypothesesDefaut = () => Object.fromEntries(B.CLASSES.map(c => [c.id, { rendement: c.rendement, volatilite: c.volatilite }]));
  function poidsDeCible() {
    const w = {};
    for (const p of S.strategie.poches) w[p.classe] = (w[p.classe] || 0) + num(p.cible);
    return w;
  }
  function poidsActuels() {
    const syn = synthese(), w = {};
    for (const [k, v] of Object.entries(syn.classes)) w[k] = syn.total > 0 ? Math.round(v / syn.total * 1000) / 10 : 0;
    return w;
  }
  function fraisActuels() { const syn = synthese(); return syn.lignes.length ? Math.round(syn.fraisMoyen * 100) / 100 : 0.3; }
  function comparerDefaut() {
    const syn = synthese(), pr = S.strategie.profil;
    const pp = id => B.PRESETS_COMPARER.find(x => x.id === id);
    const depuisPreset = x => ({ nom: x.nom, source: "", poids: { ...x.poids }, frais: x.frais, enveloppe: x.enveloppe, entree: "immediat" });
    return {
      capital: Math.round(syn.total) || 10000, versement: num(pr.versementMensuel) || 200, duree: num(pr.horizon) || 15, inflation: 2, reel: true,
      strategies: [
        { nom: "Ma cible", source: "cible", poids: poidsDeCible(), frais: fraisActuels(), enveloppe: "PEA", entree: "immediat" },
        depuisPreset(pp("banque")),
        depuisPreset(pp("livret"))
      ],
      hypotheses: hypothesesDefaut(), fiscalite: { ...B.FISCALITE }
    };
  }
  function icDefaut() {
    const syn = synthese(), pr = S.strategie.profil;
    return { capital: Math.round(syn.total) || 1000, versement: num(pr.versementMensuel) || 100, hausse: 0, taux: 7, duree: num(pr.horizon) || 20, frais: 0.2, inflation: 2, objectif: num(pr.objectifMontant) || 0 };
  }
  function cmp() {
    if (!S.comparer) S.comparer = comparerDefaut();
    const c = S.comparer;
    c.ic = { ...icDefaut(), ...(c.ic || {}) };
    c.hypotheses = { ...hypothesesDefaut(), ...(c.hypotheses || {}) };
    c.fiscalite = { ...B.FISCALITE, ...(c.fiscalite || {}) };
    if (!Array.isArray(c.strategies) || !c.strategies.length) c.strategies = comparerDefaut().strategies;
    return c;
  }
  // ---------- intérêts composés ----------
  // Versements en début de mois, rendement net des frais capitalisé chaque mois.
  function interetsComposes(p) {
    const duree = Math.max(1, Math.min(60, Math.round(num(p.duree))));
    const r = (1 + num(p.taux) / 100) * (1 - num(p.frais) / 100) - 1, rm = Math.pow(1 + r, 1 / 12) - 1, infl = num(p.inflation) / 100;
    let v = num(p.capital), verse = num(p.capital), mensuel = num(p.versement);
    const annees = [{ a: 0, valeur: v, verse, interets: 0, reel: v, interetsAnnee: 0, versementsAnnee: 0 }];
    let croisement = null, doublement = null;
    for (let a = 1; a <= duree; a++) {
      const debut = v;
      for (let m = 0; m < 12; m++) { v = (v + mensuel) * (1 + rm); verse += mensuel; }
      const versementsAnnee = mensuel * 12, interetsAnnee = v - debut - versementsAnnee;
      annees.push({ a, valeur: v, verse, interets: v - verse, reel: v / Math.pow(1 + infl, a), interetsAnnee, versementsAnnee });
      if (croisement == null && versementsAnnee > 0 && interetsAnnee > versementsAnnee) croisement = a;
      if (doublement == null && verse > 0 && v - verse >= verse) doublement = a;
      mensuel *= 1 + num(p.hausse) / 100;
    }
    // Objectif en euros d'aujourd'hui : versement mensuel constant nécessaire, et délai avec le plan actuel.
    let besoin = null, delai = null;
    const cible = num(p.objectif);
    if (cible > 0) {
      const n = duree * 12, f = Math.pow(1 + rm, n), cibleNominale = cible * Math.pow(1 + infl, duree);
      const annuite = rm !== 0 ? (f - 1) / rm * (1 + rm) : n;
      besoin = Math.max(0, (cibleNominale - num(p.capital) * f) / annuite);
      let w = num(p.capital), men = num(p.versement);
      for (let m = 1; m <= 100 * 12; m++) {
        w = (w + men) * (1 + rm);
        if (m % 12 === 0) men *= 1 + num(p.hausse) / 100;
        if (w / Math.pow(1 + infl, m / 12) >= cible) { delai = m; break; }
      }
    }
    return { duree, annees, fin: annees[annees.length - 1], croisement, doublement, besoin, delai, tauxNet: r * 100 };
  }
  const IC_CHAMPS = ["capital", "versement", "hausse", "taux", "duree", "frais", "inflation", "objectif"];
  IC_CHAMPS.forEach(k => $("ic-" + k).addEventListener("input", e => { cmp().ic[k] = num(e.target.value); enregistrer("comparer"); rendreIC(); }));
  $("btn-ic-mes-chiffres").addEventListener("click", () => { const c = cmp(); c.ic = { ...c.ic, ...icDefaut(), taux: c.ic.taux, frais: c.ic.frais, inflation: c.ic.inflation, hausse: c.ic.hausse }; enregistrer("comparer"); rendreIC(true); });
  function rendreIC(forcer) {
    const p = cmp().ic;
    for (const k of IC_CHAMPS) { const el = $("ic-" + k); if (forcer || !aFocus(el)) el.value = String(num(p[k])); }
    const r = interetsComposes(p), f = r.fin;
    const tuile = (lib, val, sous) => h("div", { class: "tuile" }, h("span", { class: "etiquette", text: lib }), h("b", { text: val }), sous ? h("span", { class: "petit muet", text: sous }) : null);
    const phrases = [];
    if (r.croisement) phrases.push(`À partir de la ${r.croisement === 1 ? "1re" : r.croisement + "e"} année, tes intérêts rapportent chaque année plus que tes versements.`);
    if (r.doublement) phrases.push(`Après ${r.doublement} ans, les intérêts gagnés dépassent tout ce que tu as versé.`);
    if (num(p.objectif) > 0) {
      phrases.push(r.delai ? `Avec ce plan, ${eur(num(p.objectif), 0)} d'aujourd'hui sont atteints en ${Math.floor(r.delai / 12)} an${Math.floor(r.delai / 12) > 1 ? "s" : ""}${r.delai % 12 ? ` et ${r.delai % 12} mois` : ""}.` : `Avec ce plan, ${eur(num(p.objectif), 0)} d'aujourd'hui ne sont pas atteints en 100 ans.`);
      phrases.push(r.besoin > 0 ? `Pour les atteindre en ${r.duree} ans, il faudrait verser ${eur(r.besoin, 0)} par mois${num(p.hausse) ? " (sans hausse des versements)" : ""}.` : `Ton capital de départ suffit à atteindre l'objectif en ${r.duree} ans.`);
    }
    vider($("ic-resultat"), h("div", { class: "tuiles" },
      tuile(`Dans ${r.duree} ans`, eur(f.valeur, 0), `${eur(f.reel, 0)} en euros d'aujourd'hui`),
      tuile("Total versé", eur(f.verse, 0)),
      tuile("Intérêts gagnés", eur(f.interets, 0), f.valeur > 0 ? `${pct(Math.max(0, f.interets) / f.valeur * 100, 0)} du capital final` : null),
      tuile("Rendement net de frais", pct(r.tauxNet, 2), "par an")),
      phrases.length ? h("ul", { style: "margin:4px 0 0;padding-left:1.2em;display:grid;gap:4px" }, phrases.map(t => h("li", { text: t }))) : null);
    vider($("ic-tableau"), h("table", {},
      h("thead", {}, h("tr", {}, ["Année", "Versé (cumul)", "Intérêts (cumul)", "Capital", "En € d'aujourd'hui"].map((t, i) => h("th", { class: i ? "num" : null, text: t })))),
      h("tbody", {}, r.annees.slice(1).map(x => h("tr", {}, h("td", { text: String(x.a) }), h("td", { class: "num chiffre", text: eur(x.verse, 0) }), h("td", { class: "num chiffre", text: eur(x.interets, 0) }), h("td", { class: "num chiffre", text: eur(x.valeur, 0) }), h("td", { class: "num chiffre", text: eur(x.reel, 0) }))))));
    dessinerIC(r);
  }
  function dessinerIC(r) {
    const z = $("ic-graphe");
    if (!z.clientWidth) return;
    const coul = { verse: "var(--serie-1)", interets: "var(--serie-3)" };
    vider($("ic-legende"), h("span", {}, h("i", { class: "puce", style: "background:" + coul.verse }), "Versé"), h("span", {}, h("i", { class: "puce", style: "background:" + coul.interets }), "Intérêts"));
    const W = Math.round(Math.max(300, Math.min(1100, z.clientWidth))), H = W < 520 ? 220 : 280, m = { g: 52, d: 10, h: 10, b: 26 };
    const donnees = r.annees.slice(1);
    const ymaxBrut = Math.max(1, ...donnees.map(x => Math.max(x.valeur, x.verse)));
    const pas = (() => { const brut = ymaxBrut / 4, e = Math.pow(10, Math.floor(Math.log10(brut))), f = brut / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e; })();
    const ymax = Math.ceil(ymaxBrut / pas) * pas;
    const larg = (W - m.g - m.d) / donnees.length, barre = Math.max(2, Math.min(24, larg * 0.7));
    const x = i => m.g + larg * i + (larg - barre) / 2;
    const y = v => m.h + (1 - v / ymax) * (H - m.h - m.b);
    const NS = "http://www.w3.org/2000/svg";
    const sv = (tag, attrs, txt) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (txt != null) e.textContent = txt; return e; };
    const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": `Capital année par année : ${eur(r.fin.valeur, 0)} au bout de ${r.duree} ans, dont ${eur(r.fin.interets, 0)} d'intérêts ; le tableau donne le détail.` });
    for (let v = 0; v <= ymax + 1e-6; v += pas) {
      svg.append(sv("line", { class: "grille-h", x1: m.g, x2: W - m.d, y1: y(v), y2: y(v) }));
      svg.append(sv("text", { x: m.g - 8, y: y(v) + 4, "text-anchor": "end" }, compact(v)));
    }
    const pasX = [1, 2, 5, 10].find(p => donnees.length / p <= Math.floor((W - m.g - m.d) / 40)) || 10;
    donnees.forEach((d, i) => { if ((i + 1) % pasX === 0 || i === 0) svg.append(sv("text", { x: x(i) + barre / 2, y: H - 8, "text-anchor": "middle" }, String(d.a))); });
    const rayon = Math.min(4, barre / 2);
    const haut = (x0, y0, w, hh) => hh <= 0 ? "" : `M${x0},${y0 + hh} V${y0 + rayon} Q${x0},${y0} ${x0 + rayon},${y0} H${x0 + w - rayon} Q${x0 + w},${y0} ${x0 + w},${y0 + rayon} V${y0 + hh} Z`;
    donnees.forEach((d, i) => {
      const yv = y(Math.min(d.verse, d.valeur)), base = y(0);
      const int = Math.max(0, d.valeur - d.verse);
      if (int > 0) {
        svg.append(sv("rect", { x: x(i), y: yv, width: barre, height: Math.max(0, base - yv), style: `fill:${coul.verse}` }));
        const yt = y(d.valeur), hh = Math.max(0, yv - 2 - yt);
        if (hh > 0.5) svg.append(sv("path", { d: haut(x(i), yt, barre, hh), style: `fill:${coul.interets}` }));
      } else {
        svg.append(sv("path", { d: haut(x(i), yv, barre, Math.max(0, base - yv)), style: `fill:${coul.verse}` }));
      }
    });
    svg.append(sv("line", { class: "axe", x1: m.g, x2: W - m.d, y1: y(0), y2: y(0) }));
    const zone = sv("rect", { x: m.g, y: m.h, width: W - m.g - m.d, height: H - m.h - m.b, style: "fill:transparent;touch-action:pan-y" });
    svg.append(zone);
    const bulle = h("div", { class: "info-bulle", hidden: true });
    vider(z, svg, bulle);
    const montrer = clientX => {
      const rr = svg.getBoundingClientRect(), px = (clientX - rr.left) / rr.width * W;
      const i = Math.max(0, Math.min(donnees.length - 1, Math.floor((px - m.g) / larg))), d = donnees[i];
      vider(bulle, h("b", { text: `Année ${d.a}` }),
        h("div", { class: "ligne-serie" }, h("span", {}, h("span", { class: "puce", style: "background:" + coul.verse + ";margin-right:6px" }), "Versé"), h("span", { class: "chiffre", text: eur(d.verse, 0) })),
        h("div", { class: "ligne-serie" }, h("span", {}, h("span", { class: "puce", style: "background:" + coul.interets + ";margin-right:6px" }), "Intérêts"), h("span", { class: "chiffre", text: eur(d.interets, 0) })),
        h("div", { class: "ligne-serie" }, h("b", { text: "Capital" }), h("b", { class: "chiffre", text: eur(d.valeur, 0) })));
      bulle.hidden = false;
      const gauche = (x(i) + barre / 2) / W * rr.width, largeur = bulle.offsetWidth || 190;
      bulle.style.left = (gauche + 12 + largeur > rr.width ? Math.max(0, gauche - 12 - largeur) : gauche + 12) + "px";
      bulle.style.top = "8px";
    };
    zone.addEventListener("pointermove", e => montrer(e.clientX));
    zone.addEventListener("pointerdown", e => montrer(e.clientX));
    zone.addEventListener("pointerleave", () => { bulle.hidden = true; });
  }

  let minuteurRedim = null;
  window.addEventListener("resize", () => { clearTimeout(minuteurRedim); minuteurRedim = setTimeout(() => { if (vueActive === "strategie") rendreIC(); if (vueActive === "portefeuille") rendreHistorique(); }, 200); });



  // ---------- CLAUDE : discussion ----------
  const SUGGESTIONS = [
    { texte: "Que faire de mon argent ce mois-ci ?" },
    { texte: "Analyse mon budget : où puis-je épargner plus ?" },
    { texte: "Je veux acheter ou vendre : passe l'opération en revue selon mes règles. ", remplir: true },
    { texte: "Compare 100 % ETF Monde et un 80/20 sur mon horizon." },
    { texte: "Que faire si la bourse baisse de 30 % ?" }
  ];
  let ctlChat = null, enCoursChat = false;
  function demanderDansChat(texte) { montrer("claude"); $("c-message").value = texte; $("c-message").focus(); }

  let tour = { changements: [] };
  function outilsChat() {
    if (!claudeOutils) return undefined;
    return [
      { name: "enregistrer_operations", description: "Enregistre des opérations de son compte courant dans son budget (page Mon mois) : celles de ses captures ou qu'il te décrit. Les doublons déjà enregistrés sont ignorés et ses règles de classement s'appliquent. Renvoie ce qui a été ajouté.",
        inputSchema: { type: "object", properties: { operations: { type: "array", maxItems: 60, items: { type: "object", properties: {
          date: { type: "string", description: "AAAA-MM-JJ" }, libelle: { type: "string" }, montant: { type: "number", description: "En euros : négatif pour un débit, positif pour un crédit" },
          categorie: { type: "string", enum: B.CATEGORIES_BUDGET.map(c => c.id) } }, required: ["date", "libelle", "montant", "categorie"] } } }, required: ["operations"] },
        execute: input => {
          const cles = new Set(Object.values(M).flatMap(d => d.mouvements.map(m => `${m.date}|${num(m.montant).toFixed(2)}|${norm(m.libelle)}`)));
          const ajout = [], ignorees = [];
          for (const o of (Array.isArray(input.operations) ? input.operations : []).slice(0, 60)) {
            if (!o || !/^\d{4}-\d{2}-\d{2}$/.test(o.date || "") || !num(o.montant)) continue;
            const op = { date: o.date, libelle: String(o.libelle || "Opération").slice(0, 120), montant: Math.round(num(o.montant) * 100) / 100, categorie: CAT[o.categorie] ? o.categorie : num(o.montant) > 0 ? "autres-revenus" : "autres" };
            const regle = S.budget.regles.find(r => norm(op.libelle).includes(norm(r.motif)));
            if (regle) op.categorie = regle.categorie;
            const k = `${op.date}|${op.montant.toFixed(2)}|${norm(op.libelle)}`;
            if (cles.has(k)) { ignorees.push(op.libelle); continue; }
            cles.add(k); ajout.push(op);
          }
          if (ajout.length) { ajouterMouvements(ajout); rendreMonMois(); }
          tour.changements.push(...ajout.map(o => `${o.libelle} ${eurSigne(o.montant)}`));
          return { ajoutees: ajout.map(o => `${o.date} ${o.libelle} ${o.montant} € (${o.categorie})`), deja_enregistrees: ignorees };
        } },
      { name: "mettre_a_jour_solde", description: "Met à jour le solde d'un de ses comptes (page Épargne : Livret A, Livret Jeune, LEP, compte courant…) d'après une capture ou ce qu'il te dit. Renvoie l'ancien et le nouveau solde.",
        inputSchema: { type: "object", properties: { compte: { type: "string", description: "Nom du compte, tel que dans sa liste" }, solde: { type: "number", description: "Nouveau solde en euros" } }, required: ["compte", "solde"] },
        execute: input => {
          const n = norm(input.compte || ""), comptes = S.portefeuille.comptes;
          const c = comptes.find(k => norm(k.nom) === n) || comptes.find(k => norm(k.nom).includes(n) || n.includes(norm(nomCourt(k.nom))));
          if (!c) throw new Error("Compte introuvable. Ses comptes : " + comptes.map(k => k.nom).join(", "));
          if (!(num(input.solde) >= 0)) throw new Error("Solde invalide.");
          const avant = num(c.solde), apres = Math.round(num(input.solde) * 100) / 100;
          majCompte(c.id, k => { k.solde = apres; });
          tour.changements.push(`${c.nom} : ${eur(avant, 2)} → ${eur(apres, 2)}`);
          return { compte: c.nom, ancien_solde: avant, nouveau_solde: apres };
        } },
      { name: "repartir_versement", description: "Calcule comment répartir un montant à investir entre les poches de sa stratégie pour se rapprocher de la cible sans vendre. Renvoie, par poche, le montant, la ligne conseillée et le poids après versement.",
        inputSchema: { type: "object", properties: { montant: { type: "number", description: "Montant à investir, en euros" } }, required: ["montant"] },
        execute: input => {
          const syn = synthese();
          const plan = repartirVersement(num(input.montant), syn);
          if (!plan.length) throw new Error("Pas de poche avec une cible dans sa stratégie.");
          return plan.map(x => ({ poche: x.poche.nom, montant: x.montant, ligne: x.ligne ? x.ligne.nom : "à choisir", parts_approx: x.parts, poids_apres: Math.round(x.poidsApres * 10) / 10, cible: num(x.poche.cible) }));
        } },
      { name: "simuler_strategies", description: "Simule (Monte-Carlo, 800 tirages) jusqu'à 3 stratégies avec les hypothèses de marché et la fiscalité française de l'outil. Renvoie pour chacune le total versé, la valeur finale nette médiane, les cas défavorable et favorable (1 sur 10), la pire baisse médiane et le risque de finir sous le versé, en euros d'aujourd'hui.",
        inputSchema: { type: "object", properties: {
          strategies: { type: "array", items: { type: "object", properties: {
            nom: { type: "string" }, poids: { type: "object", description: "Part de chaque classe en %, clés parmi : " + B.CLASSES.map(c => c.id).join(", ") },
            frais: { type: "number", description: "Frais annuels en %" }, enveloppe: { type: "string", enum: ["PEA", "CTO", "Crypto", "AV", "aucune"] } }, required: ["nom", "poids"] } },
          capital: { type: "number" }, versement_mensuel: { type: "number" }, annees: { type: "number" } }, required: ["strategies"] },
        execute: input => {
          const c = cmp(), syn = synthese(), pr = S.strategie.profil;
          const strategies = (Array.isArray(input.strategies) ? input.strategies : []).slice(0, 3).map(s => ({ nom: String(s.nom || "Stratégie"), poids: s.poids && typeof s.poids === "object" ? s.poids : {}, frais: num(s.frais), enveloppe: ["PEA", "CTO", "Crypto", "AV", "aucune"].includes(s.enveloppe) ? s.enveloppe : "PEA", entree: "immediat" }));
          if (!strategies.length) throw new Error("Donne au moins une stratégie.");
          const p = { capital: input.capital != null ? num(input.capital) : Math.round(syn.total), versement: input.versement_mensuel != null ? num(input.versement_mensuel) : num(pr.versementMensuel), duree: Math.max(1, Math.min(40, Math.round(num(input.annees) || num(pr.horizon) || 15))), inflation: c.inflation, strategies, hypotheses: c.hypotheses, fiscalite: c.fiscalite, objectif: null };
          const r = simuler(p, 800);
          return r.res.map((x, i) => ({ nom: strategies[i].nom, annees: r.duree, verse_euros_aujourdhui: Math.round(x.verseReel), mediane_nette: Math.round(x.p50 / x.deflateur), defavorable: Math.round(x.p10 / x.deflateur), favorable: Math.round(x.p90 / x.deflateur), pire_baisse_mediane_pct: Math.round(x.baisseMed * 100), risque_perte_pouvoir_achat_pct: Math.round(x.perteReel * 100) }));
        } },
      { name: "verifier_operation", description: "Passe un achat ou une vente en revue selon sa stratégie et ses règles (répartition, diversification, frais, épargne de précaution, délai de réflexion, enveloppe, impôt). Renvoie le verdict et les constats de l'outil.",
        inputSchema: { type: "object", properties: {
          sens: { type: "string", enum: ["acheter", "renforcer", "alleger", "vendre"] }, nom: { type: "string" },
          type: { type: "string", enum: B.TYPES }, enveloppe: { type: "string", enum: B.ENVELOPPES.map(e => e.id) },
          poche: { type: "string", description: "Nom de la poche de sa stratégie, ou vide" }, montant: { type: "number" },
          frais: { type: "number" }, zone: { type: "string" }, prevu: { type: "boolean" } }, required: ["sens", "nom", "montant"] },
        execute: input => {
          const sens = ["acheter", "renforcer", "alleger", "vendre"].includes(input.sens) ? input.sens : "acheter";
          const ligne = S.portefeuille.lignes.find(l => norm(l.nom) === norm(input.nom) || (l.code && norm(l.code) === norm(input.nom))) || null;
          const poche = S.strategie.poches.find(p => norm(p.nom) === norm(input.poche)) || null;
          const op = { sens, achat: sens === "acheter" || sens === "renforcer", ligne, nom: ligne ? ligne.nom : String(input.nom || ""), type: ligne ? ligne.type : (B.TYPES.includes(input.type) ? input.type : "Action"),
            poche: ligne ? ligne.poche : (poche ? poche.id : ""), enveloppe: ligne ? ligne.enveloppe : (input.enveloppe || "PEA"), frais: ligne ? num(ligne.frais) : (input.frais != null ? num(input.frais) : null),
            zone: ligne ? ligne.zone : String(input.zone || ""), montant: num(input.montant), horizon: 8, depuis: 10, prevu: !!input.prevu, raison: "(question posée à Claude)",
            reponses: Object.fromEntries([...CHECK_ACHAT, ...CHECK_VENTE].map(q => [q.id, true])) };
          const r = verifierOperation(op);
          return { verdict: r.verdict.titre, constats: r.constats.filter(c => !c.texte.startsWith("Écris ta raison")).map(c => `[${c.niveau}] ${c.texte}`) };
        } }
    ];
  }

  function rendreChat() {
    const fil = $("c-fil");
    const msgs = S.discussion.messages;
    $("btn-c-envoyer").disabled = !claudePret || enCoursChat;
    rendrePieces();
    $("c-message").disabled = !claudePret;
    const syn = synthese();
    $("c-contexte").textContent = claudePret ? `Claude voit toutes les pages : patrimoine, mon mois et ses opérations, épargne, bourse${syn.lignes.length && S.portefeuille.coursMaj ? " (cours du " + dateFr(S.portefeuille.coursMaj) + ")" : ""} et stratégie.` : "";
    if (enCoursChat) return;
    if (!claudePret) {
      vider(fil, h("div", { class: "carte" }, h("h3", { text: "Claude répond sur la page publiée" }),
        h("p", { text: "Ouvre Boussole Bourse sur claude.ai pour poser tes questions : chaque demande utilise ton propre compte Claude, et il te demande ton accord la première fois. Ici, le reste de l'outil fonctionne normalement." })));
      return;
    }
    if (!msgs.length) {
      // Les questions toutes prêtes n'apparaissent que sur une discussion vide.
      vider(fil, h("div", { class: "bulle bulle-claude" }, markdown("Bonjour ! Je vois toutes les pages de l'outil : ton patrimoine, ton mois, tes comptes, tes lignes et ta stratégie. Montre-moi tes captures de la Caisse d'Épargne ou de Trade Republic : je regarde ce que tu as fait et je peux enregistrer tes opérations et tes soldes.\n\nJe ne vois ni les cours en direct ni l'actualité : pour une décision, vérifie toujours les chiffres du jour.")),
        h("div", { class: "suggestions" }, SUGGESTIONS.map(x => h("button", { class: "suggestion", text: x.texte, onclick: () => {
          if (x.remplir) { $("c-message").value = x.texte; $("c-message").focus(); } else envoyerChat(x.texte);
        } }))));
      return;
    }
    vider(fil, msgs.map(bulleMessage));
  }

  function bulleMessage(m) {
    if (m.role === "user") return h("div", { class: "bulle bulle-moi", text: m.content });
    const ch = Array.isArray(m.changements) ? m.changements : [];
    return [h("div", { class: "bulle bulle-claude" }, markdown(m.content)),
      ch.length ? h("p", { class: "note-taches", text: "Enregistré dans l'outil : " + ch.join(" ; ") + "." }) : null];
  }
  // Captures jointes au prochain message (relevés de la Caisse d'Épargne, activité Trade Republic…).
  let piecesChat = [];
  function rendrePieces() {
    $("btn-c-images").hidden = !(claudePret && claudeImages);
    vider($("c-pieces"), piecesChat.map((f, i) => h("span", { class: "piece" }, h("span", { text: f.name || "capture" }),
      h("button", { type: "button", "aria-label": "Retirer " + (f.name || "la capture"), text: "×", onclick: () => { piecesChat.splice(i, 1); rendrePieces(); } }))));
  }
  $("btn-c-images").addEventListener("click", () => { $("c-images").accept = (claudeImages && claudeImages.mediaTypes || ["image/*"]).join(","); $("c-images").click(); });
  $("c-images").addEventListener("change", e => {
    const max = claudeImages ? claudeImages.maxCount || 5 : 5;
    piecesChat = [...piecesChat, ...Array.from(e.target.files || []).filter(f => f.type.startsWith("image/"))].slice(0, max);
    e.target.value = ""; rendrePieces();
  });
  async function envoyerChat(texte) {
    texte = String(texte || "").trim();
    const images = claudeImages ? piecesChat.slice(0, claudeImages.maxCount || 5) : [];
    if (!texte && images.length) texte = "Voici mes captures : regarde ce que j'ai fait.";
    if (!texte || !sample || enCoursChat) return;
    const msgs = S.discussion.messages;
    msgs.push({ role: "user", content: texte.slice(0, 8000) + (images.length ? `\n\n(${images.length} capture${images.length > 1 ? "s" : ""} jointe${images.length > 1 ? "s" : ""})` : "") });
    piecesChat = []; rendrePieces();
    if (msgs.length > 40) msgs.splice(0, msgs.length - 40);
    enregistrer("discussion");
    $("c-message").value = "";
    enCoursChat = true;
    rendreChat();
    const fil = $("c-fil");
    vider(fil, msgs.map(bulleMessage));
    const bulle = h("div", { class: "bulle bulle-claude pense", text: "Claude réfléchit…" });
    tour = { changements: [] };
    fil.append(bulle);
    bulle.scrollIntoView({ block: "nearest", behavior: "smooth" });
    $("btn-c-stop").hidden = false;
    ctlChat = new AbortController();
    const historique = msgs.slice(-16);
    while (historique.length && historique[0].role !== "user") historique.shift();
    const tours = [{ role: "user", content: `${CONSIGNES}\n\n${contexteInvestisseur()}\n\n(Fin des informations sur l'investisseur. La conversation commence ci-dessous.)` }, ...historique.map(m => ({ role: m.role, content: m.content }))];
    const opts = { signal: ctlChat.signal, onText: ({ text }) => { bulle.className = "bulle bulle-claude"; vider(bulle, markdown(text)); } };
    const outils = outilsChat();
    if (outils) {
      opts.tools = outils.map(o => ({ ...o, execute: (input) => { if (bulle.classList.contains("pense")) bulle.textContent = o.name === "enregistrer_operations" ? "Claude enregistre tes opérations…" : o.name === "mettre_a_jour_solde" ? "Claude met à jour ton solde…" : "Claude fait le calcul avec l'outil…"; return o.execute(input); } }));
    } else opts.cache = false;
    if ($("c-approfondi").checked) opts.modelTier = "complex";
    if (images.length) opts.images = images;
    try {
      const r = await sample(tours, opts);
      msgs.push({ role: "assistant", content: r.text.slice(0, 12000) });
      if (r.truncated) msgs[msgs.length - 1].content += "\n\n*(Réponse coupée : demande-moi la suite.)*";
      if (tour.changements.length) msgs[msgs.length - 1].changements = tour.changements.slice(0, 30);
    } catch (e) {
      if (e && e.text) msgs.push({ role: "assistant", content: e.text.slice(0, 12000) + (e.code === "cancelled" ? "\n\n*(Arrêté.)*" : "\n\n*(Réponse interrompue.)*") });
      else if (!(e && e.code === "cancelled")) { enCoursChat = false; ctlChat = null; $("btn-c-stop").hidden = true; rendreChat(); $("c-fil").append(h("p", { class: "erreur", text: messageErreur(e) })); return; }
    }
    enregistrer("discussion");
    enCoursChat = false; ctlChat = null; $("btn-c-stop").hidden = true;
    rendreChat();
  }
  $("btn-c-envoyer").addEventListener("click", () => envoyerChat($("c-message").value));
  $("c-message").addEventListener("keydown", e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); envoyerChat($("c-message").value); } });
  $("btn-c-stop").addEventListener("click", () => ctlChat && ctlChat.abort());
  $("btn-c-nouveau").addEventListener("click", () => { if (enCoursChat) return; S.discussion = { messages: [] }; enregistrer("discussion"); rendreChat(); });

  // ---------- IMPORTER avec Claude ----------
  let importLignes = null;
  function ouvrirImport() {
    montrer("portefeuille");
    $("fiche-ligne").hidden = true; $("fiche-cours").hidden = true;
    const f = $("fiche-import");
    if (!$("import-enveloppe").options.length) options($("import-enveloppe"), [{ value: "", label: "Selon le relevé" }, ...optsEnveloppes()], "");
    $("import-images-champ").hidden = !claudeImages;
    if (claudeImages) $("import-images").accept = claudeImages.mediaTypes.join(",");
    f.hidden = false;
    f.scrollIntoView({ block: "nearest", behavior: "smooth" });
    $("import-texte").focus({ preventScroll: true });
  }
  $("btn-importer").addEventListener("click", ouvrirImport);
  $("btn-import-annuler").addEventListener("click", () => { $("fiche-import").hidden = true; vider($("import-apercu")); importLignes = null; });
  let ctlImport = null;
  $("btn-import-lire").addEventListener("click", async () => {
    if (!sample) return;
    const texte = $("import-texte").value.trim();
    const fichiers = claudeImages ? Array.from($("import-images").files || []).slice(0, claudeImages.maxCount) : [];
    if (!texte && !fichiers.length) { $("import-etat").textContent = "Colle un texte ou ajoute une capture."; return; }
    const env = $("import-enveloppe").value;
    const poches = S.strategie.poches.map(p => `${p.id} = ${p.nom} (${p.classe})`).join(" ; ");
    const prompt = `Tu lis le relevé d'un portefeuille d'un particulier français (texte copié depuis son courtier et/ou captures d'écran). Extrais chaque position.
Réponds uniquement par un objet JSON de la forme :
{"lignes":[{"nom":"Amundi MSCI World UCITS ETF","code":"FR0011869353","type":"ETF","enveloppe":"PEA","quantite":150,"pru":28.1,"cours":31.45,"valeur":4717.5,"plus_value":502.5,"performance_pct":11.9,"frais":0.38,"classe":"actions","zone":"Monde","poche":"monde"}],"especes":120.5,"date":"2026-11-05"}
Règles :
- Nombres en JSON (point décimal), montants en euros. Laisse null ce que tu ne trouves pas ; n'invente ni quantité ni cours.
- Si le nombre de parts n'apparaît pas, laisse quantite, pru et cours à null et donne valeur avec plus_value ou performance_pct (depuis l'achat).
- type parmi : ${B.TYPES.join(", ")}. enveloppe parmi : PEA, CTO, Crypto, AV, PER, Autre${env ? ` (par défaut : ${env})` : ""} ; une cryptomonnaie détenue en direct va dans Crypto. classe parmi : ${B.CLASSES.map(c => c.id).join(", ")}. zone parmi : ${B.ZONES.join(", ")}.
- poche : l'identifiant de la poche de sa stratégie où ranger la ligne, parmi : ${poches || "aucune"} ; "" si aucune ne convient.
- frais : frais courants annuels en % seulement si tu les connais pour ce fonds précis, sinon null. 0 pour une action ou une crypto.
- especes : solde d'espèces non investies s'il apparaît, sinon null. date : date du relevé si elle apparaît, sinon null.${estTR() ? `
- Le relevé vient de Trade Republic : l'écran Portefeuille liste chaque position avec sa valeur et sa performance ; la fiche d'une position donne le nombre de parts et le prix d'achat moyen. Le PEA et le compte-titres y sont deux portefeuilles séparés ; les cryptos vont dans l'enveloppe Crypto.` : ""}
${texte ? "\nTEXTE COPIÉ :\n" + texte.slice(0, 60000) : ""}${fichiers.length ? "\nLes captures d'écran jointes montrent le portefeuille." : ""}`;
    $("btn-import-lire").disabled = true; $("import-etat").textContent = "Claude lit ton relevé…";
    ctlImport = new AbortController();
    try {
      const opts = { signal: ctlImport.signal };
      if (fichiers.length) opts.images = fichiers;
      const r = await sample.json(prompt, opts);
      const brut = r && Array.isArray(r.lignes) ? r.lignes : [];
      importLignes = brut.map(l => {
        const cours = num(l.cours), valeur = num(l.valeur);
        let quantite = num(l.quantite);
        if (!(quantite > 0) && cours > 0 && valeur > 0) quantite = Math.round(valeur / cours * 1e6) / 1e6;
        const base = {
          id: uid(), nom: String(l.nom || "Sans nom").slice(0, 120), code: String(l.code || "").slice(0, 40),
          type: B.TYPES.includes(l.type) ? l.type : "Autre", enveloppe: B.ENVELOPPES.some(e => e.id === l.enveloppe) ? l.enveloppe : (env || "CTO"),
          poche: S.strategie.poches.some(p => p.id === l.poche) ? l.poche : "", classe: CLASSE[l.classe] ? l.classe : "", zone: B.ZONES.includes(l.zone) ? l.zone : "",
          frais: l.frais == null ? 0 : num(l.frais)
        };
        if (base.type === "Crypto" && !B.ENVELOPPES.some(e => e.id === l.enveloppe)) base.enveloppe = "Crypto";
        if (!(quantite > 0) && valeur > 0) {
          // Valeur seule (écran Portefeuille de Trade Republic) : on garde la valeur et le montant investi.
          const investi = l.plus_value != null ? valeur - num(l.plus_value) : l.performance_pct != null ? valeur / (1 + num(l.performance_pct) / 100) : null;
          return { ...base, sansQuantite: true, quantite: 1, cours: valeur, pru: investi > 0 ? Math.round(investi * 100) / 100 : valeur, _pruManquant: !(investi > 0) };
        }
        const coursF = cours > 0 ? cours : (quantite > 0 && valeur > 0 ? valeur / quantite : 0);
        return { ...base, sansQuantite: false, quantite, pru: num(l.pru) || coursF, cours: coursF, _pruManquant: !(num(l.pru) > 0) };
      }).filter(l => l.quantite > 0 && l.cours > 0);
      importEspeces = num(r && r.especes) > 0 ? num(r.especes) : 0;
      const date = r && typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : aujourdhui();
      $("import-etat").textContent = importLignes.length || importEspeces ? `${importLignes.length} ligne${importLignes.length > 1 ? "s" : ""} trouvée${importLignes.length > 1 ? "s" : ""}. Vérifie avant d'enregistrer.` : "Aucune ligne lisible : essaie avec plus de texte ou une capture plus nette.";
      rendreApercuImport(date);
    } catch (e) {
      $("import-etat").textContent = e && e.code === "cancelled" ? "" : messageErreur(e);
    } finally { $("btn-import-lire").disabled = false; ctlImport = null; }
  });
  let importEspeces = 0;
  function rendreApercuImport(date) {
    const z = $("import-apercu");
    if ((!importLignes || !importLignes.length) && !importEspeces) { vider(z); return; }
    importLignes = importLignes || [];
    const existe = l => S.portefeuille.lignes.find(x => (l.code && x.code && norm(x.code) === norm(l.code)) || norm(x.nom) === norm(l.nom));
    const envImport = [...new Set(importLignes.map(l => l.enveloppe))];
    const envNoms = envImport.map(id => (B.ENVELOPPES.find(e => e.id === id) || { nom: id }).nom);
    const remplace = S.portefeuille.exemple || !S.portefeuille.lignes.length;
    const nomEspeces = `Espèces ${envImport.length === 1 ? (envImport[0] === "PEA" ? "du PEA" : envImport[0] === "Crypto" ? "du wallet crypto" : "du compte-titres") : "du courtier"}${estTR() ? " Trade Republic" : ""}`;
    const caseEspeces = importEspeces ? h("input", { type: "checkbox", id: "import-especes", checked: true }) : null;
    const appliquer = mode => {
      if (mode === "remplacer" || S.portefeuille.exemple) S.portefeuille.lignes = [];
      if (mode === "enveloppe") S.portefeuille.lignes = S.portefeuille.lignes.filter(x => !envImport.includes(x.enveloppe));
      for (const l of importLignes) {
        const { _pruManquant, ...propre } = l;
        const x = mode === "fusionner" ? existe(l) : null;
        const maintenant = new Date().toISOString();
        if (!x) { S.portefeuille.lignes.push({ ...propre, coursManuelLe: maintenant, refPrix: null }); continue; }
        if (l.sansQuantite && !x.sansQuantite && x.quantite > 0) { x.cours = l.cours / x.quantite; }
        else { x.quantite = l.quantite; x.cours = l.cours; x.sansQuantite = l.sansQuantite; if (!_pruManquant) x.pru = l.pru; }
        x.coursManuelLe = maintenant; if (x.sansQuantite) x.refPrix = null;
        if (l.frais) x.frais = l.frais;
        if (!x.code && l.code) x.code = l.code;
      }
      if (importEspeces && caseEspeces && caseEspeces.checked) {
        S.portefeuille.comptes = S.portefeuille.comptes.filter(k => !estExempleCompte(k));
        const k = S.portefeuille.comptes.find(c => norm(c.nom) === norm(nomEspeces));
        if (k) k.solde = importEspeces;
        else S.portefeuille.comptes.push({ id: uid(), nom: nomEspeces, type: "remunere", solde: importEspeces, taux: null, plafond: 0, precaution: false });
      }
      S.portefeuille.exemple = false; S.portefeuille.coursMaj = date;
      enregistrer("portefeuille"); noterPoint();
      importLignes = null; importEspeces = 0; vider(z); $("fiche-import").hidden = true; $("import-texte").value = ""; $("import-images").value = "";
      $("import-etat").textContent = "";
      toutRendre();
    };
    const sansPru = importLignes.filter(l => l._pruManquant).length;
    vider(z, h("div", { class: "aperçu" },
      importLignes.length ? h("div", { class: "defile" }, h("table", {},
        h("thead", {}, h("tr", {}, ["Ligne", "Enveloppe", "Poche", "Quantité", "PRU", "Cours", "Valeur", ""].map((t, i) => h("th", { class: i >= 3 && i < 7 ? "num" : null, text: t })))),
        h("tbody", {}, importLignes.map(l => h("tr", {},
          h("td", {}, h("div", { class: "nom-ligne" }, h("span", { text: l.nom }), h("small", { text: [l.code, l.type].filter(Boolean).join(" · ") }))),
          h("td", { text: (B.ENVELOPPES.find(e => e.id === l.enveloppe) || { nom: l.enveloppe }).nom }),
          h("td", {}, (() => { const s = h("select", { "aria-label": "Poche de " + l.nom, onchange: e => { l.poche = e.target.value; } }); options(s, optsPoches(), l.poche); return s; })()),
          h("td", { class: "num chiffre", text: l.sansQuantite ? "—" : nf(0, 6).format(l.quantite) }),
          h("td", { class: "num chiffre", text: l.sansQuantite || l._pruManquant ? "—" : eur(l.pru, 2) }),
          h("td", { class: "num chiffre", text: l.sansQuantite ? "—" : eur(l.cours, 2) }),
          h("td", { class: "num chiffre", text: eur(l.quantite * l.cours, 0) }),
          h("td", {}, h("button", { class: "btn btn-discret btn-petit", text: "Retirer", onclick: () => { importLignes = importLignes.filter(x => x !== l); rendreApercuImport(date); } }))))))) : null,
      importLignes.some(l => l.sansQuantite) ? h("p", { class: "note", text: "Pour certaines lignes, seule la valeur était visible : elles sont suivies en valeur et en plus-value. Une capture de la fiche de la position (parts et prix d'achat moyen) donne le détail." }) : null,
      sansPru ? h("p", { class: "note", text: `Prix de revient introuvable pour ${sansPru} ligne${sansPru > 1 ? "s" : ""} : la valeur actuelle est prise à la place (plus-value à zéro). Corrige-le avec « Modifier » ensuite.` }) : null,
      importEspeces ? h("label", { class: "case" }, caseEspeces, h("span", { text: `Espèces trouvées : ${eur(importEspeces, 2)}. Mettre à jour « ${nomEspeces} » dans mes comptes d'épargne (non compté dans l'épargne de précaution, coche-le ensuite si c'est le cas).` })) : null,
      h("div", { class: "actions" },
        remplace || !importLignes.length ? h("button", { class: "btn", text: importLignes.length ? "Enregistrer ces lignes" : "Enregistrer", onclick: () => appliquer(importLignes.length ? "remplacer" : "fusionner") }) : [
          h("button", { class: "btn", text: "Mettre à jour mon portefeuille", title: "Met à jour les lignes déjà présentes et ajoute les nouvelles", onclick: () => appliquer("fusionner") }),
          h("button", { class: "btn btn-discret", text: `Remplacer les lignes ${envNoms.join(" et ")}`, title: "Retire les lignes de ces enveloppes qui ne sont plus dans le relevé (positions vendues)", onclick: () => appliquer("enveloppe") }),
          h("button", { class: "btn btn-discret", text: "Tout remplacer", onclick: () => appliquer("remplacer") })])));
  }

  // ---------- STRATÉGIE ----------
  const PROFIL = [["s-objectif-texte", "objectifTexte", "texte"], ["s-objectif-montant", "objectifMontant"], ["s-objectif-annee", "objectifAnnee"], ["s-horizon", "horizon"],
    ["s-versement", "versementMensuel"], ["s-risque", "risque", "texte"], ["s-reaction", "reaction", "texte"], ["s-depenses", "depensesMensuelles"], ["s-mois", "moisPrecaution"],
    ["s-versement-precaution", "versementPrecaution"], ["s-courtier", "courtier", "texte"], ["s-basculer", "basculer", "case"], ["s-naissance", "naissance", "texte"]];
  const REGLES = [["s-max-action", "maxAction"], ["s-max-direct", "maxDirect"], ["s-max-crypto", "maxCrypto"], ["s-marge", "marge"], ["s-frais-max", "fraisMax"], ["s-delai", "delaiHeures"],
    ["s-delai-actif", "delaiActif", "case"], ["s-levier", "interditLevier", "case"], ["s-vente-perte", "venteEnPerte", "case"]];
  options($("s-risque"), B.RISQUES.map(r => ({ value: r.id, label: `${r.nom} (jusqu'à ${r.maxActions} % d'actions)` })), "dynamique");
  options($("s-reaction"), B.REACTIONS.map(r => ({ value: r.id, label: r.nom })), "garde");
  options($("s-modele"), [{ value: "", label: "Partir d'un modèle…" }, ...B.MODELES.map(m => ({ value: m.id, label: m.nom }))], "");
  for (const [id, cle, t] of PROFIL) $(id).addEventListener(t === "case" || $(id).tagName === "SELECT" ? "change" : "input", e => modifier("strategie", st => { st.profil[cle] = t === "case" ? e.target.checked : t === "texte" ? e.target.value : num(e.target.value); }));
  for (const [id, cle, t] of REGLES) $(id).addEventListener(t === "case" ? "change" : "input", e => modifier("strategie", st => { st.regles[cle] = t === "case" ? e.target.checked : num(e.target.value); }));
  $("s-pea-ouverture").addEventListener("change", e => modifier("strategie", st => { st.enveloppes.peaOuverture = e.target.value; }));
  $("s-pea-versements").addEventListener("input", e => modifier("strategie", st => { st.enveloppes.peaVersements = num(e.target.value); }));
  $("s-av-ouverture").addEventListener("change", e => modifier("strategie", st => { st.enveloppes.avOuverture = e.target.value; }));

  let annulerModele = null;
  $("s-modele").addEventListener("change", e => {
    const m = B.MODELES.find(x => x.id === e.target.value);
    e.target.value = "";
    if (!m) return;
    const avant = { poches: clone(S.strategie.poches), lignes: S.portefeuille.lignes.map(l => [l.id, l.poche]) };
    const nouvelles = m.poches.map(p => ({ id: norm(p.nom).replace(/ /g, "-").slice(0, 24) || uid(), nom: p.nom, classe: p.classe, cible: p.cible, ligne: "" }));
    for (const l of S.portefeuille.lignes) {
      const ancienne = avant.poches.find(p => p.id === l.poche);
      if (!ancienne) continue;
      const n = nouvelles.find(p => norm(p.nom) === norm(ancienne.nom)) || nouvelles.find(p => p.classe === ancienne.classe);
      l.poche = n ? n.id : "";
    }
    annulerModele = avant;
    modifier("strategie", st => { st.poches = nouvelles; });
    enregistrer("portefeuille");
  });

  function rendrePoches() {
    const z = $("s-poches");
    const st = S.strategie, total = somme(st.poches, p => num(p.cible));
    vider($("s-total-cible"), Math.abs(total - 100) < 0.01 ? pastille("ok", "Total 100 %") : pastille("attention", `Total ${pct(total)}`));
    if (aFocus(z)) return;
    vider(z,
      annulerModele ? h("p", { class: "confirmer" }, "Modèle appliqué.", h("button", { class: "btn btn-ghost btn-petit", text: "Annuler", onclick: () => {
        const a = annulerModele; annulerModele = null;
        for (const [id, poche] of a.lignes) { const l = S.portefeuille.lignes.find(x => x.id === id); if (l) l.poche = poche; }
        enregistrer("portefeuille");
        modifier("strategie", s => { s.poches = a.poches; });
      } })) : null,
      st.poches.length ? h("div", { class: "defile" }, h("table", {},
        h("thead", {}, h("tr", {}, h("th", { text: "Poche" }), h("th", { text: "Classe" }), h("th", { class: "num", text: "Cible %" }), h("th", { text: "Ligne à renforcer" }), h("th", {}))),
        h("tbody", {}, st.poches.map(p => {
          const selClasse = h("select", { id: "poche-classe-" + p.id, "aria-label": "Classe de " + p.nom, onchange: e => modifier("strategie", () => { p.classe = e.target.value; }) });
          options(selClasse, optsClasses(), p.classe);
          const lignes = S.portefeuille.lignes.filter(l => l.poche === p.id);
          const selLigne = h("select", { id: "poche-ligne-" + p.id, "aria-label": "Ligne à renforcer pour " + p.nom, onchange: e => modifier("strategie", () => { p.ligne = e.target.value; }) });
          options(selLigne, [{ value: "", label: lignes.length ? "La plus grosse" : "Aucune ligne" }, ...lignes.map(l => ({ value: l.id, label: l.nom }))], p.ligne);
          return h("tr", {},
            h("td", {}, h("input", { id: "poche-nom-" + p.id, value: p.nom, "aria-label": "Nom de la poche", style: "min-width:140px", oninput: e => { p.nom = e.target.value; enregistrer("strategie"); if (S.strategie.exemple) S.strategie.exemple = false; } , onblur: () => toutRendre() })),
            h("td", {}, selClasse),
            h("td", { class: "num" }, h("input", { type: "number", id: "poche-cible-" + p.id, min: "0", max: "100", step: "1", inputmode: "decimal", value: String(num(p.cible)), style: "width:80px", "aria-label": "Cible de " + p.nom, oninput: e => modifier("strategie", () => { p.cible = num(e.target.value); }) })),
            h("td", {}, selLigne),
            h("td", {}, h("button", { class: "btn btn-discret btn-petit", text: "Retirer", "aria-label": "Retirer la poche " + p.nom, onclick: () => modifier("strategie", s => { s.poches = s.poches.filter(x => x.id !== p.id); }) })));
        })))) : h("p", { class: "vide", text: "Aucune poche. Ajoute-en une ou pars d'un modèle." }));
  }
  $("btn-s-poche").addEventListener("click", () => {
    const id = uid();
    modifier("strategie", st => { st.poches.push({ id, nom: "Nouvelle poche", classe: "actions", cible: 0, ligne: "" }); });
    $("poche-nom-" + id)?.select();
  });

  function rendreReglesLibres() {
    const z = $("s-regles-libres");
    if (aFocus(z)) return;
    vider(z, S.strategie.reglesLibres.map((r, i) => h("div", { class: "actions", style: "flex-wrap:nowrap" },
      h("input", { id: "regle-" + i, value: r, "aria-label": "Règle " + (i + 1), oninput: e => { S.strategie.reglesLibres[i] = e.target.value; S.strategie.exemple = false; enregistrer("strategie"); } }),
      h("button", { class: "btn btn-discret btn-petit", text: "Retirer", "aria-label": "Retirer la règle " + (i + 1), onclick: () => modifier("strategie", st => { st.reglesLibres.splice(i, 1); }) }))));
  }
  $("btn-s-regle").addEventListener("click", () => { modifier("strategie", st => { st.reglesLibres.push(""); }); $("regle-" + (S.strategie.reglesLibres.length - 1))?.focus(); });

  function rendrePaliers() {
    const z = $("s-paliers"), ps = S.strategie.profil.paliers || [];
    const avec = paliers().length > 0;
    for (const id of ["s-versement", "s-versement-precaution", "s-mois"]) { $(id).disabled = avec; $(id).title = avec ? "Fixé par tes paliers" : ""; }
    if (aFocus(z)) return;
    if (!ps.length) { vider(z); return; }
    const maj = (i, cle, v) => { modifier("strategie", st => { st.profil.paliers[i][cle] = v; }); };
    vider(z, h("div", { class: "defile" }, h("table", {},
      h("thead", {}, h("tr", {}, ["Objectif (€)", "Pour le", "Vers l'épargne (€/mois)", "Investi (€/mois)", ""].map(t => h("th", { text: t })))),
      h("tbody", {}, ps.map((p, i) => h("tr", {},
        h("td", {}, h("input", { type: "number", class: "solde", id: `palier-${i}-montant`, min: "0", step: "100", inputmode: "decimal", value: String(num(p.montant) || ""), "aria-label": "Objectif du palier " + (i + 1), onchange: e => maj(i, "montant", num(e.target.value)) })),
        h("td", {}, h("input", { type: "date", id: `palier-${i}-date`, value: p.date || "", "aria-label": "Date du palier " + (i + 1), onchange: e => maj(i, "date", e.target.value) })),
        h("td", {}, h("input", { type: "number", class: "solde", id: `palier-${i}-versement`, min: "0", step: "10", inputmode: "decimal", value: String(num(p.versement)), "aria-label": "Versement vers l'épargne du palier " + (i + 1), onchange: e => maj(i, "versement", num(e.target.value)) })),
        h("td", {}, h("input", { type: "number", class: "solde", id: `palier-${i}-investi`, min: "0", step: "10", inputmode: "decimal", value: String(num(p.investi)), "aria-label": "Investi par mois au palier " + (i + 1), onchange: e => maj(i, "investi", num(e.target.value)) })),
        h("td", {}, h("button", { class: "btn btn-discret btn-petit", text: "Retirer", "aria-label": "Retirer le palier " + (i + 1), onclick: () => modifier("strategie", st => { st.profil.paliers.splice(i, 1); }) }))))))));
  }
  $("btn-s-palier").addEventListener("click", () => modifier("strategie", st => {
    const ps = st.profil.paliers ||= [];
    const der = ps[ps.length - 1];
    ps.push({ montant: der ? num(der.montant) + 3000 : Math.max(1000, objectifPrecaution()), date: der && der.date ? ajouterMois(der.date, 12) : ajouterMois(aujourdhui(), 6), versement: der ? num(der.versement) : num(st.profil.versementPrecaution), investi: der ? num(der.investi) : num(st.profil.versementMensuel) });
  }));

  // ---------- les règles des grands investisseurs ----------
  function rendreSagesse() {
    const z = $("s-sagesse"), sg = S.strategie.sagesse || {};
    $("s-sagesse-compte").textContent = `${B.SAGESSE.filter(x => sg[x.id]).length} sur ${B.SAGESSE.length} appliquées`;
    if (aFocus(z)) { B.SAGESSE.forEach(x => { const c = $("sg-" + x.id); if (c && c !== document.activeElement) c.checked = !!sg[x.id]; }); return; }
    vider(z, B.SAGESSE.map((x, i) => h("div", { class: "principe" },
      h("label", { class: "principe-tete" },
        h("input", { type: "checkbox", id: "sg-" + x.id, checked: !!sg[x.id], onchange: e => modifier("strategie", st => { st.sagesse = { ...(st.sagesse || {}), [x.id]: e.target.checked }; }) }),
        h("b", { text: `${i + 1}. ${x.regle}` }),
        claudePret ? h("button", { type: "button", class: "btn btn-ghost btn-petit", text: "Demander à Claude", onclick: ev => { ev.preventDefault(); demanderDansChat(`Comment appliquer concrètement cette règle de ${x.auteur.split(",")[0]} à ma situation : « ${x.citation} » ?`); } }) : null),
      h("blockquote", { class: "citation", text: `« ${x.citation} »` }),
      h("p", { class: "outil", text: x.auteur }))));
  }

  // ---------- ma stratégie, à copier dans Claude ----------
  function texteStrategie() {
    const st = S.strategie, pr = st.profil, r = st.regles, pl = planDuMois(), syn = synthese(), pat = patrimoine(syn), plb = planBudget();
    const risque = (B.RISQUES.find(x => x.id === pr.risque) || {}).nom || pr.risque;
    const reaction = (B.REACTIONS.find(x => x.id === pr.reaction) || {}).nom || pr.reaction;
    const L = [];
    L.push(`MA STRATÉGIE D'INVESTISSEMENT (mise à jour le ${dateFr(aujourdhui())})`);
    L.push("", "Qui je suis");
    const p = paie();
    const age = pr.naissance ? Math.floor((Date.now() - new Date(pr.naissance + "T12:00:00")) / (365.25 * 86400000)) : null;
    const poste = String((S.budget.paie || {}).poste || "").trim();
    if (age || poste) L.push(`- ${age ? `${age} ans` : ""}${age && poste ? ", " + poste.charAt(0).toLowerCase() + poste.slice(1) : poste}${p.smic && Math.abs(p.brut / p.heures / PAIE.smicHoraire - 1) < 0.01 ? `, payé au SMIC (${eur(p.brut, 2)} brut pour ${nf(0, 2).format(p.heures)} h), avec parfois des heures supplémentaires majorées de 25 %` : ""}.`);
    const netPaie = netDepuisBrut(p.brut).net * (1 - p.pas / 100);
    L.push(`- ${netPaie ? `${eur(netPaie, 0)} net par mois${num(S.budget.prevu.aides) ? ` + ${eur(num(S.budget.prevu.aides), 0)} de prime d'activité` : ""}` : "Revenus : voir budget"}${plb.depenses ? `, environ ${eur(plb.depenses, 0)} de dépenses par mois` : ""}.`);
    if (pr.courtier) L.push(`- Mes comptes : ${pr.courtier}.`);
    L.push(`- Objectif : ${pr.objectifTexte}. ${eur(num(pr.objectifMontant), 0)} d'aujourd'hui en ${pr.objectifAnnee}, horizon ${num(pr.horizon)} ans.`);
    L.push(`- Profil de risque : ${risque.toLowerCase()}. Si mon portefeuille perd 30 % : « ${reaction} ».`);
    L.push("", "Mon épargne de précaution");
    if (pl.paliers.length) for (const x of pl.paliers) L.push(`- ${eur(num(x.montant), 0)}${x.date ? " pour le " + dateFr(x.date) : ""} : ${eur(num(x.versement), 0)} par mois sur l'épargne, ${eur(num(x.investi), 0)} investis.`);
    else L.push(`- Objectif : ${eur(pl.obj, 0)} (${num(pr.moisPrecaution)} mois de dépenses), ${eur(pl.vp, 0)} par mois.`);
    const cp = S.portefeuille.comptes.filter(c => c.precaution);
    if (cp.length) L.push(`- Sur : ${cp.map(c => c.nom).join(", ")}. Je verse d'abord sur le compte au meilleur taux net qui a de la place.`);
    L.push("- Les primes et rentrées imprévues complètent d'abord le palier en cours ; le reste suit le partage du palier suivant.");
    L.push("", "Mon allocation cible (investissements)");
    for (const x of st.poches) L.push(`- ${x.nom} : ${pct(num(x.cible), 0)}`);
    L.push(`Versements chaque mois par plan d'investissement programmé ; je rééquilibre avec les versements, sans vendre, au-delà de ± ${num(r.marge)} points.`);
    L.push("", "Mes règles");
    L.push(`- Une action en direct : ${pct(num(r.maxAction), 0)} du portefeuille au plus ; toutes les actions en direct : ${pct(num(r.maxDirect), 0)} ; la crypto : ${pct(num(r.maxCrypto), 0)}.`);
    L.push(`- Frais annuels d'un fonds : ${pct(num(r.fraisMax), 2)} au plus.${r.delaiActif ? ` Délai de réflexion de ${num(r.delaiHeures)} h avant un achat non prévu.` : ""}${r.interditLevier ? " Pas de levier ni de produits complexes." : ""}`);
    for (const x of st.reglesLibres.filter(Boolean)) L.push(`- ${x}`);
    const sg = B.SAGESSE.filter(x => (st.sagesse || {})[x.id]);
    if (sg.length) { L.push("", "Les règles des grands investisseurs que je suis"); for (const x of sg) L.push(`- ${x.regle} (${x.auteur.split(",")[0]})`); }
    if (syn.lignes.length || pat.epargne) {
      L.push("", `Ma situation au ${dateFr(aujourdhui())}`);
      L.push(`- Patrimoine : ${eur(pat.total, 0)} (épargne ${eur(pat.epargne, 0)}, bourse ${eur(pat.bourse, 0)}${pat.crypto ? `, crypto ${eur(pat.crypto, 0)}` : ""}).`);
      for (const l of [...syn.lignes].sort((a, b) => b.valeur - a.valeur)) L.push(`- ${l.nom}${l.code ? " (" + l.code + ")" : ""}, ${(B.ENVELOPPES.find(e => e.id === l.enveloppe) || { nom: l.enveloppe }).nom} : ${eur(l.valeur, 0)}`);
      if (st.enveloppes.peaOuverture) L.push(`- PEA ouvert le ${dateFr(st.enveloppes.peaOuverture)} (5 ans le ${dateFr(ajouterMois(st.enveloppes.peaOuverture, 60))}), ${eur(num(st.enveloppes.peaVersements), 0)} versés.`);
    }
    L.push("", "Comment m'aider");
    L.push("- Réponds en français, tutoie-moi, sois direct et concret. Appuie-toi sur cette stratégie et dis-moi clairement quand une idée la contredit.");
    L.push("- Tu ne connais pas les cours du jour : dis-le quand ça compte, et ne donne jamais de prévision de cours ni de promesse de rendement.");
    L.push("- Fiscalité française 2026 : flat tax 31,4 % ; PEA après 5 ans : 18,6 % de prélèvements sociaux sur les gains ; Livret A, LDDS, LEP et Livret Jeune nets d'impôt.");
    return L.join("\n");
  }
  $("btn-copier-strategie").addEventListener("click", async () => {
    const t = $("s-texte-claude");
    t.value = texteStrategie();
    try { await navigator.clipboard.writeText(t.value); $("s-copie-etat").textContent = `Copié (${t.value.length} caractères). Colle-le dans claude.ai.`; }
    catch (_) { t.focus(); t.select(); $("s-copie-etat").textContent = "Le texte est sélectionné : copie-le avec Ctrl+C (ou Cmd+C)."; }
  });

  function rendrePrincipes() {
    const z = $("s-principes");
    const n = B.PRINCIPES.filter(p => actif(p.id)).length;
    $("s-principes-compte").textContent = `${n} sur ${B.PRINCIPES.length} appliqués`;
    if (aFocus(z)) { B.PRINCIPES.forEach(p => { const c = $("p-" + p.id); if (c && c !== document.activeElement) c.checked = actif(p.id); }); return; }
    const groupes = [...new Set(B.PRINCIPES.map(p => p.groupe))];
    vider(z, groupes.map(g => [h("div", { class: "groupe-principes", text: g }),
      B.PRINCIPES.filter(p => p.groupe === g).map(p => h("div", { class: "principe" },
        h("label", { class: "principe-tete" },
          h("input", { type: "checkbox", id: "p-" + p.id, checked: actif(p.id), onchange: e => modifier("strategie", st => { st.principes[p.id] = e.target.checked; }) }),
          h("b", { text: p.titre }),
          claudePret ? h("button", { type: "button", class: "btn btn-ghost btn-petit", text: "Demander à Claude", onclick: ev => { ev.preventDefault(); demanderDansChat(`Explique-moi le principe « ${p.titre} » appliqué à ma situation, avec mes chiffres.`); } }) : null),
        h("p", { text: p.texte }),
        h("p", { class: "outil", text: "Dans l'outil : " + p.outil })))]));
  }

  function rendreStrategie() {
    const st = S.strategie, pr = st.profil, r = st.regles;
    for (const [id, cle] of PROFIL) remplir(id, pr[cle]);
    for (const [id, cle] of REGLES) remplir(id, r[cle]);
    remplir("s-pea-ouverture", st.enveloppes.peaOuverture); remplir("s-pea-versements", st.enveloppes.peaVersements || "");
    remplir("s-av-ouverture", st.enveloppes.avOuverture);
    vider($("bandeau-strategie"), st.exemple ? h("div", { class: "bandeau" },
      h("p", {}, h("b", { text: "Stratégie de départ." }), " C'est un modèle cœur-satellite courant, pas ta stratégie. Adapte chaque champ : dès le premier changement, elle devient la tienne."),
      claudePret ? h("button", { class: "btn btn-petit", text: "La décrire à Claude", onclick: () => { $("s-decrire").focus(); $("carte-decrire").scrollIntoView({ block: "center", behavior: "smooth" }); } }) : null) : null);
    $("carte-decrire").hidden = !claudePret;
    rendrePoches(); rendreReglesLibres(); rendrePaliers(); rendrePrincipes(); rendreSagesse();
    if (!aFocus($("s-texte-claude"))) $("s-texte-claude").value = texteStrategie();
  }

  // Décrire sa stratégie à Claude.
  let propositionStrategie = null, ctlDecrire = null;
  $("btn-s-decrire").addEventListener("click", async () => {
    if (!sample) return;
    const texte = $("s-decrire").value.trim();
    if (!texte) { $("s-decrire-etat").textContent = "Écris d'abord quelques phrases."; return; }
    $("btn-s-decrire").disabled = true; $("s-decrire-etat").textContent = "Claude lit ta description…";
    const prompt = `Un investisseur particulier français décrit sa stratégie d'investissement. Transforme-la en réglages pour son outil. Date du jour : ${aujourdhui()}.
Réponds uniquement par un objet JSON. Mets null (ou omets) tout ce que la description ne dit pas : n'invente rien.
{"profil":{"objectifTexte":string,"objectifMontant":number,"objectifAnnee":number,"horizon":number,"versementMensuel":number,"risque":"prudent"|"equilibre"|"dynamique"|"offensif","reaction":"renforce"|"garde"|"partie"|"tout","depensesMensuelles":number,"moisPrecaution":number,"versementPrecaution":number,"basculer":boolean,"courtier":string},
 "poches":[{"nom":string,"classe":${B.CLASSES.map(c => `"${c.id}"`).join("|")},"cible":number}],
 "regles":{"maxAction":number,"maxDirect":number,"maxCrypto":number,"marge":number,"fraisMax":number,"delaiActif":boolean,"delaiHeures":number,"interditLevier":boolean},
 "comptes":[{"nom":string,"type":${B.TYPES_COMPTES.map(t => `"${t.id}"`).join("|")},"solde":number,"taux":number,"precaution":boolean}],
 "reglesLibres":[string],
 "enveloppes":{"peaOuverture":"AAAA-MM-JJ","peaVersements":number,"avOuverture":"AAAA-MM-JJ"},
 "resume":"2 phrases qui résument sa stratégie, en le tutoyant",
 "questions":["ce qu'il faudrait préciser, 3 au plus"]}
- poches : son allocation cible, cibles en % dont le total fait 100 ; null si la description n'en parle pas.
- maxAction : poids max d'une action en direct en % du portefeuille ; maxDirect : total max des actions en direct en % ; maxCrypto : part max de la crypto en %.
- versementMensuel : ce qu'il investit chaque mois ; versementPrecaution : ce qu'il met chaque mois sur son épargne de précaution ; basculer : true s'il dit qu'une fois l'épargne de précaution complète, ce versement ira aux investissements.
- comptes : ses livrets et comptes d'épargne avec leur solde (livretA, ldds, lep, remunere pour un compte rémunéré ou les espèces d'un courtier, courant, autre) ; precaution : true pour ceux qui forment son épargne de précaution ; taux seulement s'il le donne.
- reglesLibres : ses règles personnelles qui n'entrent pas dans les champs, formulées à la première personne.
- Une date d'ouverture donnée seulement par l'année : mets le 1er janvier de cette année.
DESCRIPTION :
${texte.slice(0, 20000)}`;
    ctlDecrire = new AbortController();
    try {
      propositionStrategie = await sample.json(prompt, { signal: ctlDecrire.signal });
      $("s-decrire-etat").textContent = "";
      rendrePropositionStrategie();
    } catch (e) {
      $("s-decrire-etat").textContent = e && e.code === "cancelled" ? "" : messageErreur(e);
    } finally { $("btn-s-decrire").disabled = false; ctlDecrire = null; }
  });
  function rendrePropositionStrategie() {
    const z = $("s-decrire-apercu"), p = propositionStrategie;
    if (!p || typeof p !== "object") { vider(z); return; }
    const changements = [];
    const pr = p.profil || {}, rg = p.regles || {}, en = p.enveloppes || {};
    const libProfil = { objectifTexte: "Objectif", objectifMontant: "Montant visé", objectifAnnee: "Année", horizon: "Horizon (ans)", versementMensuel: "Versement mensuel investi", risque: "Profil de risque", reaction: "Après −30 %", depensesMensuelles: "Dépenses mensuelles", moisPrecaution: "Mois de précaution", versementPrecaution: "Versement mensuel sur l'épargne de précaution", basculer: "Ensuite, ce versement va aux investissements", courtier: "Courtier" };
    const libRegles = { maxAction: "Max par action (%)", maxDirect: "Max actions en direct (%)", maxCrypto: "Max crypto (%)", marge: "Marge (points)", fraisMax: "Frais max (%)", delaiActif: "Délai de réflexion", delaiHeures: "Délai (heures)", interditLevier: "Pas de levier" };
    const val = v => typeof v === "boolean" ? (v ? "oui" : "non") : String(v);
    for (const [k, l] of Object.entries(libProfil)) if (pr[k] != null && pr[k] !== "") changements.push(`${l} : ${val(k === "risque" ? (B.RISQUES.find(x => x.id === pr[k]) || {}).nom || pr[k] : k === "reaction" ? (B.REACTIONS.find(x => x.id === pr[k]) || {}).nom || pr[k] : pr[k])}`);
    for (const [k, l] of Object.entries(libRegles)) if (rg[k] != null) changements.push(`${l} : ${val(rg[k])}`);
    if (en.peaOuverture) changements.push("PEA ouvert le " + dateFr(en.peaOuverture));
    if (en.peaVersements != null) changements.push("Versements PEA : " + eur(num(en.peaVersements), 0));
    if (en.avOuverture) changements.push("Assurance-vie ouverte le " + dateFr(en.avOuverture));
    const poches = Array.isArray(p.poches) ? p.poches.filter(x => x && x.nom && num(x.cible) > 0) : [];
    const regles = Array.isArray(p.reglesLibres) ? p.reglesLibres.filter(x => typeof x === "string" && x.trim()) : [];
    const comptes = Array.isArray(p.comptes) ? p.comptes.filter(x => x && x.nom && TYPE_COMPTE[x.type]) : [];
    vider(z, h("div", { class: "aperçu" },
      p.resume ? h("p", {}, h("b", { text: "Ce que Claude a compris : " }), String(p.resume)) : null,
      poches.length ? h("div", {}, h("span", { class: "etiquette", text: "Allocation cible" }), h("ul", {}, poches.map(x => h("li", { text: `${x.nom} : ${pct(num(x.cible), 0)}` })))) : null,
      changements.length ? h("div", {}, h("span", { class: "etiquette", text: "Réglages" }), h("ul", {}, changements.map(t => h("li", { text: t })))) : null,
      regles.length ? h("div", {}, h("span", { class: "etiquette", text: "Règles à toi" }), h("ul", {}, regles.map(t => h("li", { text: t })))) : null,
      comptes.length ? h("div", {}, h("span", { class: "etiquette", text: "Comptes d'épargne" }), h("ul", {}, comptes.map(x => h("li", { text: `${x.nom} (${TYPE_COMPTE[x.type].nom}) : ${x.solde != null ? eur(num(x.solde), 0) : "solde ?"}${x.precaution ? ", épargne de précaution" : ""}` })))) : null,
      Array.isArray(p.questions) && p.questions.length ? h("div", {}, h("span", { class: "etiquette", text: "À préciser" }), h("ul", {}, p.questions.slice(0, 3).map(t => h("li", { text: String(t) })))) : null,
      h("div", { class: "actions" },
        h("button", { class: "btn", text: "Appliquer à ma stratégie", onclick: () => {
          modifier("strategie", st => {
            for (const k of Object.keys(libProfil)) if (pr[k] != null && pr[k] !== "") st.profil[k] = typeof st.profil[k] === "number" ? num(pr[k]) : typeof st.profil[k] === "boolean" ? !!pr[k] : String(pr[k]);
            for (const k of Object.keys(libRegles)) if (rg[k] != null) st.regles[k] = typeof st.regles[k] === "boolean" ? !!rg[k] : num(rg[k]);
            if (en.peaOuverture && /^\d{4}-\d{2}-\d{2}$/.test(en.peaOuverture)) st.enveloppes.peaOuverture = en.peaOuverture;
            if (en.peaVersements != null) st.enveloppes.peaVersements = num(en.peaVersements);
            if (en.avOuverture && /^\d{4}-\d{2}-\d{2}$/.test(en.avOuverture)) st.enveloppes.avOuverture = en.avOuverture;
            if (poches.length) {
              const total = somme(poches, x => num(x.cible));
              const anciennes = st.poches;
              st.poches = poches.map(x => {
                const garde = anciennes.find(a => norm(a.nom) === norm(x.nom));
                return { id: garde ? garde.id : (norm(x.nom).replace(/ /g, "-").slice(0, 24) || uid()), nom: String(x.nom), classe: CLASSE[x.classe] ? x.classe : "actions", cible: Math.round(num(x.cible) / total * 1000) / 10, ligne: garde ? garde.ligne : "" };
              });
            }
            if (regles.length) st.reglesLibres = regles.map(String);
          });
          if (comptes.length) {
            S.portefeuille.comptes = S.portefeuille.comptes.filter(k => !estExempleCompte(k));
            for (const x of comptes) {
              const k = S.portefeuille.comptes.find(c => norm(c.nom) === norm(x.nom));
              const t = TYPE_COMPTE[x.type];
              const d = { nom: String(x.nom), type: x.type, solde: num(x.solde), taux: x.taux != null ? num(x.taux) : t.taux, plafond: t.plafond, precaution: !!x.precaution };
              if (k) Object.assign(k, x.solde == null ? { ...d, solde: k.solde } : d); else S.portefeuille.comptes.push({ id: uid(), ...d });
            }
            enregistrer("portefeuille"); noterPoint();
          }
          propositionStrategie = null; vider(z); $("s-decrire").value = ""; toutRendre();
          $("s-decrire-etat").textContent = "Stratégie mise à jour.";
        } }),
        h("button", { class: "btn btn-discret", text: "Ignorer", onclick: () => { propositionStrategie = null; vider(z); } }))));
  }

  // Données : export et effacement.
  let downloads = null;
  async function brancherTelechargements() {
    if (!(window.claude && typeof window.claude.use === "function")) return;
    try { downloads = await window.claude.use("downloads"); } catch (_) { downloads = null; }
    rendreDonnees();
  }
  function rendreDonnees() {
    const t = stock.mode === "page" ? "Tes données sont enregistrées dans la page, sous ton compte : toi seul les vois, sur ton téléphone comme sur ton ordinateur. Si tu partages la page, chaque personne a ses propres données."
      : stock.mode === "navigateur" ? "Tes données sont enregistrées dans ce navigateur seulement. Sur la page publiée sur claude.ai, elles te suivent sur tous tes appareils."
      : "Chargement de tes données…";
    $("s-donnees-texte").textContent = t;
    $("btn-exporter").hidden = !downloads;
  }
  $("btn-exporter").addEventListener("click", async () => {
    if (!downloads) return;
    const data = JSON.stringify({ app: "Boussole Bourse", date: aujourdhui(), strategie: S.strategie, portefeuille: S.portefeuille, journal: S.journal, comparer: S.comparer, historique: S.historique, budget: S.budget, operations: M }, null, 2);
    try { await downloads.save({ filename: `boussole-bourse-${aujourdhui()}.json`, data }); } catch (_) {}
  });
  $("btn-effacer").addEventListener("click", () => { $("effacer-confirmer").hidden = false; });
  $("btn-effacer-non").addEventListener("click", () => { $("effacer-confirmer").hidden = true; });
  $("btn-effacer-oui").addEventListener("click", async () => {
    $("effacer-confirmer").hidden = true;
    const aEffacer = DOCS.filter(n => !DOCS_ROBOT.includes(n));
    for (const n of aEffacer) { clearTimeout(stock.minuteurs[n]); stock.sale[n] = false; S[n] = defauts(n); }
    annulerModele = null;
    toutRendre();
    if (stock.mode === "page") {
      for (const n of aEffacer) stock.enCours[n] = true;
      await Promise.all(aEffacer.map(n => stock.db.doc("data/users/" + stock.uid + "/" + n).delete().catch(() => {})));
      for (const n of aEffacer) stock.enCours[n] = false;
      const mois = Object.keys(M);
      for (const k of mois) delete M[k];
      await Promise.all(mois.map(k => stock.db.doc(`data/users/${stock.uid}/budget/mois/${k}`).delete().catch(() => {})));
    } else {
      for (const n of aEffacer) { try { localStorage.removeItem(CLE(n)); } catch (_) {} }
      for (const k of Object.keys(M)) { try { localStorage.removeItem(CLE("mois:" + k)); } catch (_) {} delete M[k]; }
    }
    toutRendre();
  });

  // ---------- rendu général ----------
  let rendreEnCours = false;
  function toutRendre() {
    if (rendreEnCours) return;
    rendreEnCours = true;
    try {
      const syn = synthese();
      rendreBandeau(); rendrePyramide(syn); rendrePrecaution(); rendreHistorique(); rendreRepartition(syn); rendreEnveloppes(syn); rendreComptes(); rendreCoursDirect(); rendreLignes(syn);
      rendreMonMois(); rendrePaie();
      $("btn-importer").hidden = !claudePret;
      rendreIC();
      rendreChat();
      rendreStrategie();
    } finally { rendreEnCours = false; }
  }

  // Cartes repliables : ouvertes ou fermées comme la dernière fois, dans ce navigateur.
  const replisOuverts = (() => { try { return new Set(JSON.parse(localStorage.getItem(CLE("replis")) || "[]")); } catch (_) { return new Set(); } })();
  document.querySelectorAll("details.repli").forEach(d => {
    if (replisOuverts.has(d.id)) d.open = true;
    d.addEventListener("toggle", () => {
      if (d.open) replisOuverts.add(d.id); else replisOuverts.delete(d.id);
      try { localStorage.setItem(CLE("replis"), JSON.stringify([...replisOuverts])); } catch (_) {}
    });
  });

  // ---------- démarrage ----------
  const depart = vueDe(location.hash.slice(1));
  montrer(VUES.includes(depart) ? depart : "portefeuille");
  toutRendre();
  demarrerStockage();
  brancherClaude();
  brancherTelechargements();
  brancherMcp();
})();

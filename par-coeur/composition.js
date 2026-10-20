// Par cœur : lecture d'une composition comme on la trouve sur une étiquette ou un site de marque.
// « 67% Coton, 32% Lyocell, 1% Elasthanne », « Coton 98 % Élasthanne 2 % », « CO 98% EL 2% »,
// « Tissu : 100 % polyamide ; Garnissage : 90 % duvet, 10 % plumes ». Dépend de savoir.js.
window.COMPOSITION = (() => {
  "use strict";
  const S = window.SAVOIR;
  const norm = s => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[’`]/g, "'").replace(/[™®©]/g, " ").replace(/\s+/g, " ").trim();
  const echapper = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const FIBRE = Object.fromEntries(S.fibres.map(f => [f.id, f]));
  // Les alias les plus longs d'abord : « laine merinos » avant « laine », « tencel modal » avant « tencel ».
  const ALIAS = [];
  for (const f of S.fibres) for (const a of [f.nom, ...f.alias]) ALIAS.push([norm(a), f.id]);
  ALIAS.sort((x, y) => y[0].length - x[0].length);
  const QUALIFS = Object.entries(S.qualificatifs).flatMap(([k, mots]) => mots.map(m => [new RegExp(`(^| )${echapper(norm(m))}( |$)`), k]));
  // Mots qui annoncent une partie du vêtement : « Doublure : … ».
  const PARTIES = ["tissu principal", "tissu", "matiere principale", "matiere", "exterieur", "interieur", "corps", "doublure", "garnissage",
    "rembourrage", "ouatine", "ouate", "poches", "poche", "bord-cote", "bords-cotes", "bord cote", "bords cotes", "bord-côte", "rib", "col",
    "manches", "manche", "empiecements", "empiecement", "capuche", "dos", "devant", "partie 1", "partie 2", "shell", "lining", "filling", "pocket", "pockets"];
  const SECONDAIRES = /^(doublure|garnissage|rembourrage|ouatine|ouate|poches?|bords?[- ]cotes?|rib|col|manches?|empiecements?|capuche|interieur|lining|filling|pockets?)$/;

  function trouverFibre(brut) {
    let s = " " + norm(brut).replace(/[^a-z0-9' -]/g, " ").replace(/\s+/g, " ").trim() + " ";
    const drapeaux = {};
    for (const [re, k] of QUALIFS) if (re.test(s.trim())) { drapeaux[k] = true; s = (" " + s.trim() + " ").replace(re, " "); }
    s = s.replace(/\s+/g, " ").trim().replace(/^(de |du |d'|en |et |and |\/ |- )+/, "").trim();
    if (!s) return null;
    for (const [a, id] of ALIAS) if (s === a) return { id, ...drapeaux };
    // Un nom dans une phrase (« coton peigné », « viscose ecovero ») ; les codes de deux lettres seulement seuls.
    for (const [a, id] of ALIAS) if (a.length >= 3 && (" " + s + " ").includes(" " + a + " ")) return { id, ...drapeaux };
    // Les noms traduits côte à côte (« coton / cotton / baumwolle ») : le premier reconnu.
    for (const morceau of s.split(/[\/,-]| et | and /)) {
      const m = morceau.trim();
      if (m && m !== s) { const f = trouverFibre(m); if (f) return { ...f, ...drapeaux }; }
    }
    return null;
  }

  function lireNombre(t) { const x = parseFloat(String(t).replace(",", ".")); return isFinite(x) ? x : null; }

  function lirePartie(texte, avecSansPourcent) {
    let t = " " + String(texte).replace(/\bt[ -]?400\b/gi, "élastomultiester").replace(/\bnylon\s*6(?:[.,]6)?\b/gi, "nylon") + " ";
    let nom = "";
    // « Doublure : 100 % polyester » : le nom de la partie avant les deux-points, s'il n'a pas de chiffre.
    const deuxPoints = t.match(/^\s*([^:\d%]{2,40}):\s*/);
    if (deuxPoints && !trouverFibre(deuxPoints[1])) { nom = deuxPoints[1].trim(); t = " " + t.slice(deuxPoints[0].length); }
    let re = /(\d{1,3}(?:[.,]\d{1,2})?)\s*%/g;
    let nombres = [...t.matchAll(re)];
    if (!nombres.length && avecSansPourcent) { re = /(\d{1,3}(?:[.,]\d{1,2})?)(?!\s*°)/g; nombres = [...t.matchAll(re)]; }
    const fibres = [], inconnues = [];
    if (!nombres.length) {
      // « Coton » seul, sans pourcentage : 100 %.
      const f = trouverFibre(t);
      if (f) fibres.push({ ...f, pct: 100 });
      else if (t.trim()) inconnues.push(t.trim());
      return { nom, fibres, inconnues };
    }
    const avant = t.slice(0, nombres[0].index);
    const nomDAbord = !!trouverFibre(avant.replace(/[:;,]/g, " "));
    nombres.forEach((m, i) => {
      const pct = lireNombre(m[1]);
      const debut = nomDAbord ? (i ? nombres[i - 1].index + nombres[i - 1][0].length : 0) : m.index + m[0].length;
      const fin = nomDAbord ? m.index : (i + 1 < nombres.length ? nombres[i + 1].index : t.length);
      const morceau = t.slice(debut, fin).replace(/[:;,()]/g, " ").trim();
      const f = trouverFibre(morceau);
      if (f && pct != null) fibres.push({ ...f, pct });
      else if (morceau) inconnues.push(morceau);
    });
    // Une même fibre écrite deux fois dans la partie : on additionne.
    const fusion = [];
    for (const f of fibres) {
      const deja = fusion.find(x => x.id === f.id && !!x.bio === !!f.bio && !!x.recycle === !!f.recycle);
      if (deja) deja.pct += f.pct; else fusion.push({ ...f });
    }
    fusion.sort((a, b) => b.pct - a.pct);
    return { nom, fibres: fusion, inconnues };
  }

  // texte → { parties: [{nom, fibres:[{id, pct, bio?, recycle?}], total, inconnues}], ok }
  function lire(texte, opts = {}) {
    let t = String(texte ?? "").replace(/\r/g, "").trim();
    if (!t) return { parties: [], ok: false, vide: true };
    // Un mot de partie suivi de deux-points commence une nouvelle partie.
    const motifs = PARTIES.map(p => echapper(p)).join("|");
    t = t.replace(new RegExp(`(^|[^\\p{L}])(${motifs})\\s*:`, "giu"), (tout, avant, mot) => `${avant};${mot}:`);
    const parties = t.split(/[;\n|]+/).map(x => x.trim()).filter(Boolean)
      .map(p => lirePartie(p, opts.sansPourcent))
      .filter(p => p.fibres.length || p.inconnues.length || p.nom);
    // « Tissu : » suivi d'une partie vide puis des fibres : on recolle.
    const propres = [];
    for (const p of parties) {
      const prec = propres[propres.length - 1];
      if (prec && !prec.fibres.length && !prec.inconnues.length && prec.nom && !p.nom) { prec.fibres = p.fibres; prec.inconnues = p.inconnues; }
      else propres.push(p);
    }
    for (const p of propres) p.total = Math.round(p.fibres.reduce((s, f) => s + f.pct, 0) * 100) / 100;
    const ok = propres.length > 0 && propres.every(p => p.fibres.length && Math.abs(p.total - 100) <= 1 && !p.inconnues.length);
    return { parties: propres, ok };
  }

  const nombre = x => (Math.round(x * 10) / 10).toLocaleString("fr-FR");
  const nomFibre = f => {
    const base = (FIBRE[f.id]?.nom || f.id).toLowerCase();
    return base + (f.bio ? " bio" : "") + (f.recycle ? (f.id === "plume" ? " recyclées" : " recyclé") : "");
  };
  // Espaces simples dans les données ; l'affichage ajoute les espaces insécables.
  const formaterFibres = fibres => fibres.map(f => `${nombre(f.pct)} % ${nomFibre(f)}`).join(", ");
  const nomPartie = n => n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : "";
  function formater(lu) {
    if (!lu || !lu.parties.length) return "";
    if (lu.parties.length === 1 && !lu.parties[0].nom) return formaterFibres(lu.parties[0].fibres);
    return lu.parties.map(p => (p.nom ? nomPartie(p.nom) + " : " : "") + formaterFibres(p.fibres)).join(" ; ");
  }
  // La partie qui compte pour les quiz : la première qui n'est pas une doublure, une poche ou un garnissage.
  function principale(lu) {
    if (!lu || !lu.parties.length) return null;
    const p = lu.parties.find(x => x.fibres.length && !SECONDAIRES.test(norm(x.nom))) || lu.parties.find(x => x.fibres.length);
    return p || null;
  }
  const pct = (partie, id) => partie ? partie.fibres.filter(f => f.id === id).reduce((s, f) => s + f.pct, 0) : 0;

  return { lire, formater, formaterFibres, principale, pct, nomFibre, nombre, trouverFibre, FIBRE, norm };
})();

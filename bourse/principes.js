// Boussole Bourse : le contenu de l'outil (principes, classes d'actifs, fiscalité, modèles).
// Les données personnelles (stratégie, portefeuille, journal) ne sont pas ici : elles sont
// enregistrées dans la page publiée, ou dans le navigateur quand la page est ouverte en fichier.
window.BOUSSOLE = (() => {
  "use strict";

  // Principes fondamentaux. Chacun peut être coché « je l'applique » dans Ma stratégie :
  // les principes cochés pilotent les vérifications et sont donnés à Claude.
  const PRINCIPES = [
    { id: "precaution", groupe: "Les bases", titre: "Une épargne de précaution d'abord",
      texte: "Avant d'investir en bourse, garder de 3 à 6 mois de dépenses sur un livret disponible à tout moment. Sans ce coussin, une dépense imprévue oblige à vendre, parfois au pire moment.",
      outil: "Alerte quand ton épargne de précaution est sous ton objectif, et le rappelle avant chaque achat." },
    { id: "horizon", groupe: "Les bases", titre: "L'argent en actions a au moins 5 ans devant lui",
      texte: "Sur un an, un portefeuille d'actions peut perdre 30 à 50 %. Sur 15 ans et plus, un indice mondial diversifié a très rarement fini en perte. L'argent dont tu auras besoin bientôt n'a rien à faire en actions.",
      outil: "Signale un achat d'actions avec un horizon de moins de 5 ans." },
    { id: "allocation", groupe: "Construire", titre: "L'allocation décide l'essentiel du risque",
      texte: "La part d'actions, d'obligations et de liquidités explique la plus grande partie des hauts et des bas d'un portefeuille, bien plus que le choix des titres. On choisit une cible écrite et on s'y tient.",
      outil: "Compare chaque poche à sa cible et compare ta cible à ton profil de risque." },
    { id: "diversification", groupe: "Construire", titre: "Diversifier largement",
      texte: "Un ETF monde répartit ton argent sur plus de mille entreprises de nombreux pays. Une action seule peut perdre 80 % et ne jamais remonter. Plafonner le poids de chaque action en direct limite les dégâts d'une erreur.",
      outil: "Vérifie le poids maximum de chaque action en direct et de l'ensemble des actions en direct." },
    { id: "frais", groupe: "Construire", titre: "Les frais se composent comme les rendements",
      texte: "1,5 % de frais en plus par an coûte environ 30 % du capital final au bout de 25 ans. Un ETF indiciel coûte souvent de 0,1 à 0,4 % par an, un fonds actif en banque 1,5 à 2,5 %.",
      outil: "Calcule tes frais moyens, signale une ligne au-dessus de ton plafond et chiffre l'écart dans Comparer." },
    { id: "temps", groupe: "Dans la durée", titre: "Le temps passé investi compte plus que le moment",
      texte: "Personne ne prévoit les marchés de façon fiable. Rater quelques-unes des meilleures séances suffit à réduire fortement la performance, et ces séances arrivent souvent juste après les pires.",
      outil: "Comparer montre ce que donne le fait d'investir tout de suite ou d'étaler." },
    { id: "dca", groupe: "Dans la durée", titre: "Investir régulièrement",
      texte: "Un versement automatique chaque mois enlève la question du bon moment et lisse le prix d'achat. Historiquement, investir une somme tout de suite a fait mieux environ deux fois sur trois, mais étaler réduit le regret si la bourse baisse juste après.",
      outil: "Ton versement mensuel est repris partout ; « Mon prochain versement » dit où le placer." },
    { id: "reequilibrage", groupe: "Dans la durée", titre: "Rééquilibrer avec une règle, pas une émotion",
      texte: "Quand une poche s'écarte de sa cible au-delà d'un seuil fixé à l'avance, on oriente les nouveaux versements vers les poches en retard. Sans vendre, donc sans impôt ni frais de transaction.",
      outil: "Repère les poches hors de ta marge et répartit ton prochain versement pour revenir vers la cible." },
    { id: "enveloppes", groupe: "Fiscalité française", titre: "Utiliser les bonnes enveloppes",
      texte: "PEA : après 5 ans, plus d'impôt sur le revenu sur les gains, il reste les prélèvements sociaux (18,6 % en 2026) ; versements plafonnés à 150 000 € ; actions européennes et ETF éligibles. Assurance-vie : après 8 ans, 4 600 € de gains par an sans impôt sur le revenu (9 200 € pour un couple), prélèvements sociaux de 17,2 %. Compte-titres : tout est permis, gains taxés à 31,4 %. Ouvrir un PEA tôt, même avec peu, fait courir le délai de 5 ans.",
      outil: "Suit les dates de tes enveloppes, le plafond du PEA, et applique la bonne fiscalité dans Comparer." },
    { id: "biais", groupe: "Comportement", titre: "Se méfier de ses propres réflexes",
      texte: "La peur de rater une hausse, la peur de perdre, l'excès de confiance après quelques gains, l'attachement au prix d'achat : ces réflexes font acheter haut et vendre bas. Un délai de réflexion et une check-list les désamorcent.",
      outil: "Applique ton délai de réflexion aux achats non prévus et pose les questions de la check-list dans Décider." },
    { id: "journal", groupe: "Comportement", titre: "Écrire ses décisions",
      texte: "Noter pourquoi on achète, ce qu'on attend et ce qui ferait changer d'avis, puis faire le bilan quelques mois plus tard. On apprend de la qualité de ses raisonnements, pas seulement de ses résultats.",
      outil: "Chaque opération étudiée peut être notée au journal, avec une date de bilan." },
    { id: "comprendre", groupe: "Actions en direct", titre: "N'acheter que ce qu'on comprend",
      texte: "Savoir expliquer en deux phrases ce que fait l'entreprise ou ce que réplique l'ETF, d'où vient l'argent, et ce qui pourrait mal tourner. Si l'explication ne tient pas, c'est un pari.",
      outil: "Fait partie de la check-list de Décider ; Claude te demande de l'expliquer." },
    { id: "valorisation", groupe: "Actions en direct", titre: "Le prix payé compte",
      texte: "Une excellente entreprise achetée trop cher peut rester un mauvais placement pendant des années. Regarder le rapport cours / bénéfices (PER), la croissance des bénéfices, la dette, les marges et ce qui protège l'entreprise de ses concurrents, et garder une marge de sécurité.",
      outil: "Claude passe une action en revue sur ces critères quand tu le lui demandes." },
    { id: "levier", groupe: "Risque", titre: "Pas de levier ni de produits complexes",
      texte: "Turbos, warrants, CFD, ETF à effet de levier : la perte peut être totale et très rapide. Selon les avertissements des régulateurs européens, la grande majorité des comptes de particuliers perdent de l'argent sur les CFD.",
      outil: "Un achat de ce type est signalé comme contraire à tes règles quand la règle est active." },
    { id: "volatilite", groupe: "Risque", titre: "Une baisse n'est pas une perte définitive",
      texte: "Un indice diversifié qui baisse de 30 % n'a fait perdre que ceux qui vendent pendant la baisse. Une action seule, elle, peut ne jamais revenir à son prix. Vendre après une chute fige la perte : à faire seulement si la raison d'acheter a disparu.",
      outil: "Une vente en perte non prévue par ta stratégie est signalée dans Décider." }
  ];

  // Classes d'actifs pour les répartitions et le simulateur. Rendement = rendement annuel moyen
  // composé espéré, volatilité = écart type annuel. Ce sont des hypothèses inspirées de
  // l'histoire longue, modifiables dans Comparer, pas des prévisions.
  const CLASSES = [
    { id: "actions", nom: "Actions", rendement: 7.0, volatilite: 16 },
    { id: "obligations", nom: "Obligations", rendement: 3.0, volatilite: 6 },
    { id: "monetaire", nom: "Monétaire et fonds euros", rendement: 2.3, volatilite: 0.5 },
    { id: "livret", nom: "Livret réglementé", rendement: 1.7, volatilite: 0 },
    { id: "immobilier", nom: "Immobilier (SCPI, foncières)", rendement: 4.5, volatilite: 14 },
    { id: "or", nom: "Or", rendement: 4.0, volatilite: 15 },
    { id: "crypto", nom: "Cryptomonnaies", rendement: 6.0, volatilite: 70 },
    { id: "autre", nom: "Autre", rendement: 3.0, volatilite: 10 }
  ];
  // Corrélations entre classes, dans l'ordre de CLASSES.
  const CORRELATIONS = [
    //  act   obl   mon   liv   imm   or    cry   aut
    [1.00, 0.15, 0.00, 0.00, 0.60, 0.10, 0.40, 0.30],
    [0.15, 1.00, 0.20, 0.00, 0.30, 0.25, 0.05, 0.20],
    [0.00, 0.20, 1.00, 0.00, 0.05, 0.00, 0.00, 0.05],
    [0.00, 0.00, 0.00, 1.00, 0.00, 0.00, 0.00, 0.00],
    [0.60, 0.30, 0.05, 0.00, 1.00, 0.10, 0.20, 0.25],
    [0.10, 0.25, 0.00, 0.00, 0.10, 1.00, 0.15, 0.10],
    [0.40, 0.05, 0.00, 0.00, 0.20, 0.15, 1.00, 0.20],
    [0.30, 0.20, 0.05, 0.00, 0.25, 0.10, 0.20, 1.00]
  ];

  // Fiscalité française des gains, taux 2026 (impots.gouv.fr) : prélèvements sociaux 18,6 %
  // (17,2 % pour l'assurance-vie), flat tax 31,4 %.
  const FISCALITE = {
    ps: 18.6, psAV: 17.2, ir: 12.8, irAV8: 7.5, abattementAV: 4600, plafondPEA: 150000
  };

  const TYPES = ["ETF", "Action", "Fonds", "Obligation", "Monétaire", "Livret", "Crypto", "Produit à levier", "Autre"];
  const ENVELOPPES = [
    { id: "PEA", nom: "PEA" }, { id: "CTO", nom: "Compte-titres" }, { id: "AV", nom: "Assurance-vie" },
    { id: "PER", nom: "PER" }, { id: "Livret", nom: "Livret" }, { id: "Autre", nom: "Autre" }
  ];
  const ZONES = ["Monde", "États-Unis", "Europe", "France", "Pays émergents", "Asie", "Autre"];
  const RISQUES = [
    { id: "prudent", nom: "Prudent", maxActions: 40 },
    { id: "equilibre", nom: "Équilibré", maxActions: 60 },
    { id: "dynamique", nom: "Dynamique", maxActions: 85 },
    { id: "offensif", nom: "Offensif", maxActions: 100 }
  ];
  const REACTIONS = [
    { id: "renforce", nom: "Je renforce, c'est moins cher" },
    { id: "garde", nom: "Je ne touche à rien" },
    { id: "partie", nom: "Je vends une partie" },
    { id: "tout", nom: "Je vends tout" }
  ];

  // La stratégie de départ : un modèle « cœur-satellite » à adapter, marqué comme exemple.
  const STRATEGIE_DEPART = {
    exemple: true,
    profil: {
      horizon: 15, objectifTexte: "Construire un capital pour le long terme", objectifMontant: 50000,
      objectifAnnee: 2036, risque: "dynamique", reaction: "garde", versementMensuel: 200,
      depensesMensuelles: 1500, moisPrecaution: 4
    },
    poches: [
      { id: "monde", nom: "ETF Monde", classe: "actions", cible: 65, ligne: "" },
      { id: "emergents", nom: "ETF Pays émergents", classe: "actions", cible: 10, ligne: "" },
      { id: "direct", nom: "Actions en direct", classe: "actions", cible: 10, ligne: "" },
      { id: "securite", nom: "Fonds monétaire", classe: "monetaire", cible: 15, ligne: "" }
    ],
    regles: {
      maxAction: 5, maxDirect: 15, marge: 5, fraisMax: 0.5,
      delaiActif: true, delaiHeures: 48, interditLevier: true, venteEnPerte: true
    },
    reglesLibres: [
      "Je ne vends pas pendant une baisse si ma raison d'acheter tient toujours.",
      "Je n'achète pas une action sur un conseil entendu sans l'avoir étudiée."
    ],
    enveloppes: { peaOuverture: "", peaVersements: 0, avOuverture: "" },
    principes: Object.fromEntries(PRINCIPES.map(p => [p.id, true]))
  };

  // Modèles d'allocation proposés dans Ma stratégie.
  const MODELES = [
    { id: "simple", nom: "Simple : un ETF monde", poches: [
      { nom: "ETF Monde", classe: "actions", cible: 90 }, { nom: "Fonds monétaire", classe: "monetaire", cible: 10 }] },
    { id: "coeur", nom: "Cœur-satellite", poches: [
      { nom: "ETF Monde", classe: "actions", cible: 65 }, { nom: "ETF Pays émergents", classe: "actions", cible: 10 },
      { nom: "Actions en direct", classe: "actions", cible: 10 }, { nom: "Fonds monétaire", classe: "monetaire", cible: 15 }] },
    { id: "equilibre", nom: "Équilibré 60 / 40", poches: [
      { nom: "ETF Monde", classe: "actions", cible: 60 }, { nom: "Obligations", classe: "obligations", cible: 30 },
      { nom: "Fonds euros", classe: "monetaire", cible: 10 }] },
    { id: "prudent", nom: "Prudent", poches: [
      { nom: "ETF Monde", classe: "actions", cible: 35 }, { nom: "Obligations", classe: "obligations", cible: 35 },
      { nom: "Fonds euros", classe: "monetaire", cible: 30 }] }
  ];

  // Un portefeuille d'exemple, pour voir l'outil fonctionner. Noms et cours fictifs.
  const PORTEFEUILLE_EXEMPLE = {
    exemple: true,
    coursMaj: "",
    precaution: 4500,
    lignes: [
      { id: "ex1", nom: "ETF MSCI World (exemple)", code: "", type: "ETF", enveloppe: "PEA", poche: "monde", classe: "actions", zone: "Monde", quantite: 180, pru: 26.4, cours: 31.2, frais: 0.38 },
      { id: "ex2", nom: "ETF Pays émergents (exemple)", code: "", type: "ETF", enveloppe: "PEA", poche: "emergents", classe: "actions", zone: "Pays émergents", quantite: 40, pru: 22.1, cours: 21.3, frais: 0.30 },
      { id: "ex3", nom: "Action gaz industriels (exemple)", code: "", type: "Action", enveloppe: "PEA", poche: "direct", classe: "actions", zone: "France", quantite: 2, pru: 158, cours: 171, frais: 0 },
      { id: "ex4", nom: "Action semi-conducteurs (exemple)", code: "", type: "Action", enveloppe: "CTO", poche: "direct", classe: "actions", zone: "Europe", quantite: 1, pru: 610, cours: 742, frais: 0 },
      { id: "ex5", nom: "Fonds monétaire (exemple)", code: "", type: "Monétaire", enveloppe: "AV", poche: "securite", classe: "monetaire", zone: "Europe", quantite: 1, pru: 650, cours: 668, frais: 0.10 },
      { id: "ex6", nom: "ETF Bitcoin (exemple)", code: "", type: "Crypto", enveloppe: "CTO", poche: "", classe: "crypto", zone: "Monde", quantite: 10, pru: 48, cours: 39, frais: 0.25 }
    ]
  };

  // Stratégies proposées dans Comparer. `poids` : part de chaque classe en %.
  const PRESETS_COMPARER = [
    { id: "actions", nom: "100 % actions monde", poids: { actions: 100 }, frais: 0.3, enveloppe: "PEA" },
    { id: "8020", nom: "80 / 20", poids: { actions: 80, obligations: 20 }, frais: 0.3, enveloppe: "PEA" },
    { id: "6040", nom: "60 / 40", poids: { actions: 60, obligations: 40 }, frais: 0.3, enveloppe: "AV" },
    { id: "banque", nom: "Fonds de banque", poids: { actions: 80, obligations: 20 }, frais: 1.8, enveloppe: "CTO" },
    { id: "livret", nom: "Livret A", poids: { livret: 100 }, frais: 0, enveloppe: "aucune" }
  ];

  return { PRINCIPES, CLASSES, CORRELATIONS, FISCALITE, TYPES, ENVELOPPES, ZONES, RISQUES, REACTIONS,
    STRATEGIE_DEPART, MODELES, PORTEFEUILLE_EXEMPLE, PRESETS_COMPARER };
})();

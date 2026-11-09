// Boussole Bourse : le contenu de l'outil (principes, classes d'actifs, fiscalité, modèles).
// Les données personnelles (stratégie, portefeuille, journal) ne sont pas ici : elles sont
// enregistrées dans la page publiée, ou dans le navigateur quand la page est ouverte en fichier.
window.BOUSSOLE = (() => {
  "use strict";

  // Principes fondamentaux. Chacun peut être coché « je l'applique » dans Ma stratégie :
  // les principes cochés pilotent les vérifications et sont donnés à Claude.
  const PRINCIPES = [
    { id: "precaution", groupe: "Les bases", titre: "Une épargne de précaution d'abord",
      texte: "Garder de 3 à 6 mois de dépenses sur un livret disponible à tout moment, avant d'investir ou en parallèle tant qu'elle se constitue. Sans ce coussin, une dépense imprévue oblige à vendre, parfois au pire moment. Livret A et LDDS rapportent 1,7 % net d'impôt ; les intérêts d'un compte rémunéré sont taxés à 31,4 %.",
      outil: "Suit ton épargne de précaution compte par compte, dit quand elle sera complète, et partage ton effort mensuel entre elle et tes investissements." },
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
      texte: "PEA : après 5 ans, plus d'impôt sur le revenu sur les gains, il reste les prélèvements sociaux (18,6 % en 2026) ; versements plafonnés à 150 000 € ; actions européennes et ETF éligibles. Assurance-vie : après 8 ans, 4 600 € de gains par an sans impôt sur le revenu (9 200 € pour un couple), prélèvements sociaux de 17,2 %. Compte-titres : tout est permis, gains taxés à 31,4 %. Crypto : gains taxés à 31,4 % seulement quand on repasse en euros ; les échanges entre cryptos ne sont pas imposés, et rien n'est dû si les ventes de l'année ne dépassent pas 305 €. Ouvrir un PEA tôt, même avec peu, fait courir le délai de 5 ans.",
      outil: "Suit les dates de tes enveloppes, le plafond du PEA, l'impôt latent du compte-titres et du wallet crypto, et applique la bonne fiscalité dans Comparer." },
    { id: "biais", groupe: "Comportement", titre: "Se méfier de ses propres réflexes",
      texte: "La peur de rater une hausse, la peur de perdre, l'excès de confiance après quelques gains, l'attachement au prix d'achat : ces réflexes font acheter haut et vendre bas. Un délai de réflexion et une check-list les désamorcent.",
      outil: "Claude applique ton délai de réflexion aux achats non prévus et te pose les questions de la check-list quand il passe une opération en revue." },
    { id: "journal", groupe: "Comportement", titre: "Écrire ses décisions",
      texte: "Noter pourquoi on achète, ce qu'on attend et ce qui ferait changer d'avis, puis faire le bilan quelques mois plus tard. On apprend de la qualité de ses raisonnements, pas seulement de ses résultats.",
      outil: "Chaque opération étudiée peut être notée au journal, avec une date de bilan." },
    { id: "comprendre", groupe: "Actions en direct", titre: "N'acheter que ce qu'on comprend",
      texte: "Savoir expliquer en deux phrases ce que fait l'entreprise ou ce que réplique l'ETF, d'où vient l'argent, et ce qui pourrait mal tourner. Si l'explication ne tient pas, c'est un pari.",
      outil: "Fait partie de la check-list d'une opération ; Claude te demande de l'expliquer." },
    { id: "valorisation", groupe: "Actions en direct", titre: "Le prix payé compte",
      texte: "Une excellente entreprise achetée trop cher peut rester un mauvais placement pendant des années. Regarder le rapport cours / bénéfices (PER), la croissance des bénéfices, la dette, les marges et ce qui protège l'entreprise de ses concurrents, et garder une marge de sécurité.",
      outil: "Claude passe une action en revue sur ces critères quand tu le lui demandes." },
    { id: "levier", groupe: "Risque", titre: "Pas de levier ni de produits complexes",
      texte: "Turbos, warrants, CFD, ETF à effet de levier : la perte peut être totale et très rapide. Selon les avertissements des régulateurs européens, la grande majorité des comptes de particuliers perdent de l'argent sur les CFD.",
      outil: "Un achat de ce type est signalé comme contraire à tes règles quand la règle est active." },
    { id: "volatilite", groupe: "Risque", titre: "Une baisse n'est pas une perte définitive",
      texte: "Un indice diversifié qui baisse de 30 % n'a fait perdre que ceux qui vendent pendant la baisse. Une action seule, elle, peut ne jamais revenir à son prix. Vendre après une chute fige la perte : à faire seulement si la raison d'acheter a disparu.",
      outil: "Claude signale une vente en perte non prévue par ta stratégie quand il passe l'opération en revue." }
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
    ps: 18.6, psAV: 17.2, ir: 12.8, irAV8: 7.5, abattementAV: 4600, plafondPEA: 150000, seuilCrypto: 305
  };

  const TYPES = ["ETF", "Action", "Fonds", "Obligation", "Monétaire", "Livret", "Crypto", "Produit à levier", "Autre"];
  const ENVELOPPES = [
    { id: "PEA", nom: "PEA" }, { id: "CTO", nom: "Compte-titres" }, { id: "Crypto", nom: "Wallet crypto" },
    { id: "AV", nom: "Assurance-vie" }, { id: "PER", nom: "PER" }, { id: "Autre", nom: "Autre" }
  ];
  // Comptes d'épargne. Taux bruts annuels au 5 novembre 2026 (Livret A, LDDS : 1,7 % depuis le
  // 1er août 2026) ; un compte rémunéré a un taux variable, à recopier depuis l'appli.
  const TYPES_COMPTES = [
    { id: "livretA", nom: "Livret A", taux: 1.7, plafond: 22950, impose: false },
    { id: "ldds", nom: "LDDS", taux: 1.7, plafond: 12000, impose: false },
    { id: "lep", nom: "LEP", taux: 2.5, plafond: 10000, impose: false },
    // Livret Jeune (12-25 ans) : taux fixé par chaque banque, au moins celui du Livret A ; à recopier.
    { id: "livretJeune", nom: "Livret Jeune", taux: null, plafond: 1600, impose: false },
    { id: "remunere", nom: "Compte rémunéré", taux: null, plafond: 0, impose: true },
    { id: "courant", nom: "Compte courant", taux: 0, plafond: 0, impose: false },
    { id: "autre", nom: "Autre épargne", taux: null, plafond: 0, impose: true }
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
  // L'épargne de précaution est à part : objectif en mois de dépenses et versement mensuel propre.
  const STRATEGIE_DEPART = {
    exemple: true,
    profil: {
      horizon: 15, objectifTexte: "Construire un capital pour le long terme", objectifMontant: 50000,
      objectifAnnee: 2036, risque: "offensif", reaction: "garde", versementMensuel: 150,
      depensesMensuelles: 1500, moisPrecaution: 4, versementPrecaution: 150, basculer: true, courtier: "",
      coursAuto: { actif: true, minutes: 15 }, partPlaisir: 0
    },
    poches: [
      { id: "monde", nom: "ETF Monde", classe: "actions", cible: 75, ligne: "" },
      { id: "emergents", nom: "ETF Pays émergents", classe: "actions", cible: 10, ligne: "" },
      { id: "direct", nom: "Actions en direct", classe: "actions", cible: 10, ligne: "" },
      { id: "crypto", nom: "Crypto", classe: "crypto", cible: 5, ligne: "" }
    ],
    regles: {
      maxAction: 5, maxDirect: 15, maxCrypto: 10, marge: 5, fraisMax: 0.5,
      delaiActif: true, delaiHeures: 48, interditLevier: true, venteEnPerte: true
    },
    reglesLibres: [
      "Je ne vends pas pendant une baisse si ma raison d'acheter tient toujours.",
      "Je n'achète pas une action sur un conseil entendu sans l'avoir étudiée."
    ],
    enveloppes: { peaOuverture: "", peaVersements: 0, avOuverture: "" },
    principes: Object.fromEntries(PRINCIPES.map(p => [p.id, true])),
    sagesse: {}
  };

  // Modèles d'allocation proposés dans Ma stratégie.
  const MODELES = [
    { id: "simple", nom: "Simple : un ETF monde", poches: [
      { nom: "ETF Monde", classe: "actions", cible: 90 }, { nom: "Fonds monétaire", classe: "monetaire", cible: 10 }] },
    { id: "coeur", nom: "Cœur-satellite avec crypto", poches: [
      { nom: "ETF Monde", classe: "actions", cible: 75 }, { nom: "ETF Pays émergents", classe: "actions", cible: 10 },
      { nom: "Actions en direct", classe: "actions", cible: 10 }, { nom: "Crypto", classe: "crypto", cible: 5 }] },
    { id: "coeur-sans", nom: "Cœur-satellite sans crypto", poches: [
      { nom: "ETF Monde", classe: "actions", cible: 80 }, { nom: "ETF Pays émergents", classe: "actions", cible: 10 },
      { nom: "Actions en direct", classe: "actions", cible: 10 }] },
    { id: "equilibre", nom: "Équilibré 60 / 40", poches: [
      { nom: "ETF Monde", classe: "actions", cible: 60 }, { nom: "Obligations", classe: "obligations", cible: 30 },
      { nom: "Fonds euros", classe: "monetaire", cible: 10 }] },
    { id: "prudent", nom: "Prudent", poches: [
      { nom: "ETF Monde", classe: "actions", cible: 35 }, { nom: "Obligations", classe: "obligations", cible: 35 },
      { nom: "Fonds euros", classe: "monetaire", cible: 30 }] }
  ];

  // Un patrimoine d'exemple, pour voir l'outil fonctionner. Noms, cours et soldes fictifs.
  const PORTEFEUILLE_EXEMPLE = {
    exemple: true,
    coursMaj: "",
    lignes: [
      { id: "ex1", nom: "ETF MSCI World (exemple)", code: "", type: "ETF", enveloppe: "PEA", poche: "monde", classe: "actions", zone: "Monde", quantite: 180, pru: 26.4, cours: 31.2, frais: 0.38 },
      { id: "ex2", nom: "ETF Pays émergents (exemple)", code: "", type: "ETF", enveloppe: "PEA", poche: "emergents", classe: "actions", zone: "Pays émergents", quantite: 40, pru: 22.1, cours: 21.3, frais: 0.30 },
      { id: "ex3", nom: "Action gaz industriels (exemple)", code: "", type: "Action", enveloppe: "PEA", poche: "direct", classe: "actions", zone: "France", quantite: 2, pru: 158, cours: 171, frais: 0 },
      { id: "ex4", nom: "Action semi-conducteurs (exemple)", code: "", type: "Action", enveloppe: "CTO", poche: "direct", classe: "actions", zone: "Europe", quantite: 1, pru: 610, cours: 742, frais: 0 },
      { id: "ex5", nom: "Bitcoin (exemple)", code: "BTC", type: "Crypto", enveloppe: "Crypto", poche: "crypto", classe: "crypto", zone: "Monde", quantite: 0.006, pru: 72000, cours: 81000, frais: 0 }
    ],
    comptes: [
      { id: "cx1", nom: "Livret A (exemple)", type: "livretA", solde: 3200, taux: 1.7, plafond: 22950, precaution: true },
      { id: "cx2", nom: "Espèces du compte-titres (exemple)", type: "remunere", solde: 1300, taux: 2, plafond: 0, precaution: true }
    ]
  };

  // Catégories du budget. « epargne » : virements vers livrets, PEA, compte-titres ou crypto, ni
  // revenu ni dépense.
  const CATEGORIES_BUDGET = [
    { id: "salaire", nom: "Salaire", type: "revenu" },
    { id: "aides", nom: "Aides et allocations", type: "revenu" },
    { id: "autres-revenus", nom: "Autres revenus", type: "revenu" },
    { id: "logement", nom: "Logement", type: "depense", fixe: true },
    { id: "factures", nom: "Énergie, internet, téléphone", type: "depense", fixe: true },
    { id: "assurances", nom: "Assurances", type: "depense", fixe: true },
    { id: "abonnements", nom: "Abonnements", type: "depense", fixe: true },
    { id: "transport", nom: "Transport (essence, crédit voiture)", type: "depense", fixe: true },
    { id: "courses", nom: "Courses", type: "depense" },
    { id: "restaurants", nom: "Restaurants et sorties", type: "depense" },
    { id: "loisirs", nom: "Loisirs", type: "depense" },
    { id: "shopping", nom: "Shopping", type: "depense" },
    { id: "sante", nom: "Santé", type: "depense" },
    { id: "voyages", nom: "Voyages", type: "depense" },
    { id: "cadeaux", nom: "Cadeaux et dons", type: "depense" },
    { id: "etudes", nom: "Études et formation", type: "depense" },
    { id: "impots", nom: "Impôts", type: "depense" },
    { id: "frais", nom: "Frais bancaires", type: "depense" },
    // Un retrait d'espèces compte comme dépensé : l'argent ne revient pas sur le compte.
    { id: "especes", nom: "Retraits d'espèces", type: "depense" },
    { id: "autres", nom: "Autres dépenses", type: "depense" },
    { id: "epargne", nom: "Épargne et investissement", type: "epargne" }
  ];

  // Paie. SMIC au 1er juin 2026 : 12,31 € brut de l'heure, 1 867,02 € brut par mois pour 35 h.
  // Prime d'ancienneté de la convention de l'habillement (IDCC 1483, employés), euros bruts par mois
  // à temps plein, selon la catégorie de classification (code.travail.gouv.fr, à jour au 1er avril 2026).
  const PAIE = {
    smicHoraire: 12.31, smicMensuel: 1867.02, smicDepuis: "2026-06-01",
    // Une heure supplémentaire : cotisations salariales réduites (jusqu'à 11,31 points) et pas d'impôt.
    reductionHeuresSup: 11.31,
    // Cotisations salariales d'un employé non cadre (taux de la fiche de paie d'octobre 2026, SAS JMC) :
    // Sécurité sociale 6,90 % + 0,40 %, retraite complémentaire 4,01 %, prévoyance 0,335 %, mutuelle
    // fixe (0,83 % du plafond de la Sécurité sociale, 4 005 €), CSG/CRDS 9,70 % sur 98,25 % du brut plus
    // la part patronale de mutuelle et de prévoyance.
    cotisations: { proportionnelles: 11.645, mutuelle: 33.24, csg: 9.70, assietteCsg: 98.25, prevoyancePatronale: 0.335, mutuellePatronale: 33.24 },
    // Prime d'activité : quand le revenu du travail augmente, elle baisse d'environ 39 % de la hausse
    // (le calcul retient 61 % des revenus d'activité), avec trois mois de décalage.
    baissePrimeActivite: 39,
    anciennete: {
      "1-2": [34, 49, 64, 79, 94, 109], "3-4": [35, 50, 65, 80, 95, 110],
      "5-6": [36, 51, 66, 81, 96, 111], "7-8": [37, 52, 67, 82, 97, 112]
    }
  };

  // Les règles des grands investisseurs, et ce qu'elles veulent dire pour un investisseur en ETF.
  const SAGESSE = [
    { id: "botte", auteur: "John Bogle, fondateur de Vanguard", citation: "Ne cherchez pas l'aiguille dans la botte de foin : achetez la botte de foin.", regle: "Le cœur du portefeuille, c'est un ETF monde qui détient toute la botte, plutôt que des paris sur quelques actions." },
    { id: "indiciel", auteur: "Warren Buffett, lettre aux actionnaires de 1996", citation: "Pour la plupart des investisseurs, la meilleure façon de détenir des actions est un fonds indiciel aux frais minimes.", regle: "Un ETF indiciel peu cher, renforcé chaque mois, bat la plupart des gérants sur le long terme." },
    { id: "frais", auteur: "John Bogle", citation: "En investissement, on obtient ce pour quoi on ne paie pas.", regle: "Chaque point de frais se compose contre toi : garde des frais annuels bas et des ordres sans frais (plan programmé)." },
    { id: "temps", auteur: "John Bogle", citation: "Le temps est ton ami ; l'impulsion est ton ennemie.", regle: "Ne décide rien sous le coup d'une émotion : délai de réflexion avant tout achat ou toute vente hors plan." },
    { id: "interrompre", auteur: "Charlie Munger", citation: "La première règle des intérêts composés : ne jamais les interrompre sans nécessité.", regle: "Ne retire rien de tes investissements pour une dépense : c'est le rôle de l'épargne de précaution." },
    { id: "attendre", auteur: "Charlie Munger", citation: "Le gros de l'argent ne se fait pas en achetant et en vendant, mais en attendant.", regle: "Ton avantage, ce sont tes 28 ans d'horizon : laisse le temps travailler." },
    { id: "peur", auteur: "Warren Buffett", citation: "Soyez craintif quand les autres sont avides, et avide quand les autres sont craintifs.", regle: "Quand la bourse chute pour des raisons de contexte, continue tes versements, voire renforce ; ne vends pas." },
    { id: "corrections", auteur: "Peter Lynch", citation: "Bien plus d'argent a été perdu par des investisseurs qui se préparaient aux corrections, ou essayaient de les anticiper, que dans les corrections elles-mêmes.", regle: "N'essaie pas de deviner le bon moment : verse chaque mois, quel que soit le marché." },
    { id: "connaitre", auteur: "Peter Lynch", citation: "Sachez ce que vous possédez, et pourquoi vous le possédez.", regle: "Pour chaque ligne, sois capable d'expliquer en deux phrases ce que c'est et pourquoi elle est là ; sinon, ne l'achète pas." },
    { id: "lui-meme", auteur: "Benjamin Graham, L'Investisseur intelligent", citation: "Le principal problème de l'investisseur, et même son pire ennemi, sera probablement lui-même.", regle: "Écris tes décisions au journal et relis tes règles avant d'agir : la discipline compte plus que l'intelligence." },
    { id: "prix", auteur: "Warren Buffett, lettre de 2008", citation: "Le prix, c'est ce que vous payez ; la valeur, c'est ce que vous obtenez.", regle: "Une action à la mode peut être une bonne entreprise et un mauvais placement à ce prix : regarde la valorisation avant d'acheter." },
    { id: "different", auteur: "John Templeton", citation: "Les quatre mots les plus dangereux en investissement : cette fois, c'est différent.", regle: "Méfie-toi des bulles et des promesses de nouvelle ère, en crypto comme en bourse." },
    { id: "preparer", auteur: "Howard Marks, Oaktree", citation: "On ne peut pas prédire. On peut se préparer.", regle: "Prépare-toi aux baisses (épargne de précaution, règles écrites) au lieu d'essayer de les prévoir." },
    { id: "ego", auteur: "Morgan Housel, La Psychologie de l'argent", citation: "L'épargne, c'est l'écart entre ton ego et tes revenus.", regle: "Ton taux d'épargne est ton premier moteur : chaque hausse de salaire peut aller en partie à tes investissements." },
    { id: "somniferes", auteur: "André Kostolany", citation: "Achetez des actions, prenez des somnifères et ne regardez plus vos titres. Après beaucoup d'années, vous serez riche.", regle: "Regarde ton portefeuille moins souvent : une fois par mois suffit pour suivre ton plan." },
    { id: "ennui", auteur: "Paul Samuelson, prix Nobel d'économie", citation: "Investir devrait ressembler à regarder la peinture sécher ou l'herbe pousser. Si vous voulez de l'excitation, allez à Las Vegas.", regle: "Une stratégie ennuyeuse qui dure 28 ans vaut mieux qu'une stratégie excitante qu'on abandonne." }
  ];

  // Stratégies proposées dans Comparer. `poids` : part de chaque classe en %.
  const PRESETS_COMPARER = [
    { id: "actions", nom: "100 % actions monde", poids: { actions: 100 }, frais: 0.3, enveloppe: "PEA" },
    { id: "8020", nom: "80 / 20", poids: { actions: 80, obligations: 20 }, frais: 0.3, enveloppe: "PEA" },
    { id: "6040", nom: "60 / 40", poids: { actions: 60, obligations: 40 }, frais: 0.3, enveloppe: "AV" },
    { id: "banque", nom: "Fonds de banque", poids: { actions: 80, obligations: 20 }, frais: 1.8, enveloppe: "CTO" },
    { id: "livret", nom: "Livret A", poids: { livret: 100 }, frais: 0, enveloppe: "aucune" }
  ];

  return { PRINCIPES, CLASSES, CORRELATIONS, FISCALITE, TYPES, ENVELOPPES, TYPES_COMPTES, CATEGORIES_BUDGET, PAIE, SAGESSE, ZONES, RISQUES, REACTIONS,
    STRATEGIE_DEPART, MODELES, PORTEFEUILLE_EXEMPLE, PRESETS_COMPARER };
})();

# Boussole Bourse

Mon outil d'investissement : il suit tout mon patrimoine (épargne de précaution, PEA, compte-titres, crypto), compare des stratégies, passe chaque achat ou vente en revue selon ma stratégie, et Claude répond à mes questions en connaissant mes chiffres, mes règles et mes principes. Tout est chez Trade Republic.

Ouvre `index.html` dans un navigateur (rien à installer). Sur la page publiée sur claude.ai, les données suivent sur le téléphone et l'ordinateur, et Claude est disponible.

## Les quatre onglets

**Accueil**
- **Mon patrimoine**, juste en dessous : le total (épargne + bourse + crypto), la part de chacun, la plus-value latente, la dernière séance et la date des cours.
- **À faire** : ma liste de tâches. Ce que je décide avec Claude (un virement, un achat, une vérification) s'y ajoute tout seul, avec une échéance si elle est connue ; Claude coche une tâche quand je lui dis l'avoir faite. Ajout à la main possible ; les tâches faites se rangent dans « Fait ».
- **Mon mois**, tout en haut, visible sans faire défiler même sur un téléphone. Premier tableau, à remplir une fois par mois : salaire, prime d'activité, autres revenus prévus, dépenses fixes (essence, crédit voiture, abonnements) et dépenses variables ; tant qu'une case est vide, la page propose un montant en gris (les opérations du mois, le mois d'avant ou ma paie calculée). Second tableau : ce que je garde sur le compte courant (mes dépenses), ce que je verse sur l'épargne de précaution (le LEP) et sur le PEA. Le partage suit ma stratégie : le plan du palier en cours (685 € d'épargne, 435 € investis), l'épargne de précaution d'abord si l'argent manque, et ce qui dépasse le plan comme une prime (il complète d'abord le palier). À partir du 25, le tableau passe au mois suivant, celui que ma paie de fin de mois finance ; les flèches changent de mois. « J'ai reçu de l'argent » et « Sur quelle ligne investir » sont sous les tableaux.
- **Mon épargne de précaution** : par paliers datés (6 000 € au 5 janvier, puis 9 000 € fin 2027), avec ce qu'il faut verser par paie pour tenir la date.
- **Mon patrimoine dans le temps** : la courbe sur 1 mois, 3 mois, 6 mois, 1 an ou tout ; glisser sur la courbe (à la souris ou au doigt) zoome sur la période choisie. « Total » ajuste l'échelle pour voir les variations ; « Détail » empile épargne, bourse et crypto depuis 0. Sous la courbe : la variation de la période, dont les plus-values.
- **Ce qui demande ton attention** : seulement quand quelque chose s'écarte de ma stratégie ou de mes règles.
- **Mes comptes d'épargne** et **Mes lignes** : soldes, taux, plafonds, cours en direct, ajout, vente, import d'une capture de Trade Republic avec Claude.

**Budget**
- **Le mois** : revenus, dépenses, ce qui a été mis de côté, taux d'épargne et reste sur le compte, comparés au budget prévu. Ma paie arrive vers le 29 : une paie reçue à partir du 25 (réglable) compte pour le mois suivant, celui qu'elle finance.
- **Par catégorie**, **Ce que dit ton budget**, **Mes opérations** : import d'un relevé avec Claude (texte, CSV ou captures) ou ajout à la main. Quand je change la catégorie d'une opération, la page propose d'en faire une règle (« CARREFOUR MARZY » → Transport) : les opérations déjà enregistrées sont reclassées, et Claude applique mes règles et suit mes classements passés aux imports suivants.
- Repliés, à ouvrir au besoin : **Ma paie** (le net calculé depuis le brut avec les taux de ma fiche de paie, au centime près ; heures supplémentaires, prime, augmentation demandée ; les prochaines années), **Mon budget prévu**, **Sur 12 mois**, **Et si je déménage ?**.

**Claude** : la discussion. Claude voit ma stratégie, mon épargne, mon portefeuille, ma paie, les opérations du mois et ma liste À faire ; il peut répartir un versement, passer un achat ou une vente en revue selon mes règles, comparer des stratégies sur 800 avenirs possibles, et tenir ma liste À faire. Les questions toutes prêtes n'apparaissent que sur une discussion vide. Il ne voit ni les cours en direct ni l'actualité.

**Stratégie** : mon plan (objectif, horizon, risque, versements, paliers d'épargne de précaution) et le calcul des **intérêts composés** (capital final, part des intérêts, versement nécessaire pour un objectif). Repliés : mon allocation cible (avec la répartition d'aujourd'hui), mes règles, mes enveloppes (PEA : 5 ans, plafond ; impôt latent du compte-titres et de la crypto), « Ma stratégie pour Claude » (le texte à copier dans claude.ai), les règles des grands investisseurs, les 15 principes, mes données.

Les sections repliées restent ouvertes ou fermées comme la dernière fois, sur chaque appareil.

## Les principes intégrés

Épargne de précaution d'abord · 5 ans minimum pour l'argent en actions · l'allocation décide du risque · diversifier · les frais se composent · le temps passé investi compte plus que le moment · investir régulièrement · rééquilibrer avec une règle · les bonnes enveloppes (PEA, assurance-vie, compte-titres) · se méfier de ses réflexes · écrire ses décisions · n'acheter que ce qu'on comprend · le prix payé compte · pas de levier · une baisse n'est pas une perte définitive.

Chaque principe coché pilote des vérifications et est donné à Claude. Le texte des principes, les classes d'actifs, la fiscalité et les modèles sont dans `principes.js`.

## Les chiffres utilisés

- Fiscalité 2026 (impots.gouv.fr) : flat tax 31,4 % (12,8 % d'impôt + 18,6 % de prélèvements sociaux), aussi sur les intérêts d'un compte rémunéré ; PEA après 5 ans : 18,6 % sur les gains ; crypto : 31,4 % sur les gains en repassant en euros, rien sous 305 € de ventes dans l'année ; assurance-vie : prélèvements sociaux 17,2 %, après 8 ans abattement de 4 600 € puis 7,5 % ; plafond PEA 150 000 €.
- Épargne : Livret A et LDDS à 1,7 % net d'impôt depuis le 1er août 2026 (plafonds 22 950 € et 12 000 €), LEP 2,5 %. Le taux d'un compte rémunéré change souvent : il se recopie depuis l'appli.
- Trade Republic : un plan d'investissement programmé est sans frais, un ordre ponctuel coûte 1 € ; le PEA n'achète que des parts entières, le compte-titres et la crypto acceptent les fractions.
- Hypothèses de marché par défaut (rendement annuel composé / volatilité) : actions 7 % / 16 %, obligations 3 % / 6 %, monétaire et fonds euros 2,3 % / 0,5 %, Livret A 1,7 % / 0, immobilier 4,5 % / 14 %, or 4 % / 15 %, cryptomonnaies 6 % / 70 %. Ce sont des hypothèses inspirées de l'histoire longue, pas des prévisions.
- Simulation : tirages mensuels corrélés, frais prélevés chaque mois, rééquilibrage permanent vers les poids de la stratégie, impôts appliqués à la sortie sur les gains.

## Le robot des cours

Une tâche planifiée de mon compte (« Boussole Bourse : cours du marché ») s'exécute chaque soir de semaine à 22 h 47, heure de Paris, dans une session cloud. Elle lit le portefeuille de la page, lance `robot/cours.js` (publié avec la page) et écrit les documents `marche` et `historique`.

- Actions et ETF : Tradegate, prix de vente en direct à partir de l'ISIN (trouvé par le nom sur Lang & Schwarz s'il manque) : c'est le prix qu'utilise Trade Republic pour valoriser un portefeuille, à quelques centimes près. Yahoo Finance prend le relais pour un titre absent de Tradegate.
- À l'ouverture de la page, si les cours ont plus de 15 minutes (réglable) et que la bourse a pu bouger, la page relance le robot elle-même : les cours arrivent une demi-minute plus tard. Le symbole est trouvé avec l'ISIN ou le nom (Paris d'abord pour le PEA), ou donné à la main dans la ligne (ex. `CW8.PA`). Les cours en dollars ou en livres sont convertis en euros.
- Cryptos : CoinGecko, à partir du symbole (BTC, ETH, SOL…) ou du nom.
- Chaque exécution utilise mon compte Claude. Pour changer l'heure ou l'arrêter : claude.ai, Claude Code, tâches planifiées.
- Test à la main : `node robot/cours.js portefeuille.json - - sortie/`.

## Les données

Sur la page publiée, chaque personne a ses propres documents, privés, sous `data/users/<id>/` : `strategie`, `portefeuille` (lignes et comptes d'épargne), `taches` (ma liste À faire), `historique` (un relevé par jour), `budget` (budget prévu, paie, règles de classement) et `budget/mois/AAAA-MM` (opérations du mois), `journal`, `comparer`, `discussion`, plus `marche` (cours) et `robot` (la tâche planifiée), écrits par le robot. Si je partage la page, chacun a les siens. Ouverte en fichier local, la page les garde dans le navigateur. « Enregistrer une copie » exporte tout en JSON.

## Publier la page

`outils/version-artefact.sh bourse/index.html > boussole-bourse.html`, publiée avec `app.js`, `principes.js` et `robot/cours.js`, et les capacités `db`, `user`, `sample` (avec images), `downloads` et `mcp` (Claude Code Remote, `fire_trigger`, pour « Actualiser maintenant »).

Boussole Bourse aide à appliquer sa propre stratégie ; ce n'est pas un conseil en investissement.

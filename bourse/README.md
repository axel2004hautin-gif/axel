# Boussole Bourse

Mon outil d'investissement : il suit tout mon patrimoine (épargne de précaution, PEA, compte-titres, crypto), compare des stratégies, passe chaque achat ou vente en revue selon ma stratégie, et Claude répond à mes questions en connaissant mes chiffres, mes règles et mes principes. Tout est chez Trade Republic.

Ouvre `index.html` dans un navigateur (rien à installer). Sur la page publiée sur claude.ai, les données suivent sur le téléphone et l'ordinateur, et Claude est disponible.

## Les six pages

**1. Patrimoine** : tout se voit sans faire défiler. À gauche, la pyramide : le montant total, puis la bourse (PEA, compte-titres et crypto) et l'épargne, chacune avec sa part du patrimoine, puis la plus-value latente, la dernière séance et les livrets d'épargne de précaution (Livret Jeune, LEP). À droite, la courbe du patrimoine : 1 jour (depuis le relevé précédent), 1 semaine, 1 mois, 1 an, MAX ou une période choisie (deux dates, ou glisser sur la courbe) ; « Total » ajuste l'échelle, « Détail » empile épargne, bourse et crypto.

**2. Mon mois** : en haut, cinq cases (salaire, prime d'activité, autres revenus prévus, dépenses fixes, dépenses variables), puis « Où va mon argent ? » : ce qui reste sur le compte courant (dépenses fixes et variables) et ce qui est mis de côté, avec le taux d'épargne (LEP et PEA). Un clic sur une case ouvre son détail en dessous : le montant du mois à saisir (tant qu'il est vide, la page propose celui des opérations ou du mois d'avant), les opérations du mois de cette case, et ses outils : la paie calculée depuis la fiche de paie pour le salaire, l'épargne de précaution et ses paliers pour le LEP, la ligne à acheter pour le PEA. Le partage suit le plan du palier en cours ; ce qui dépasse complète d'abord l'épargne de précaution, ce qui manque est pris d'abord sur l'investissement. À partir du 25, la page prépare le mois suivant, celui que la paie de fin de mois finance. Un retrait d'espèces compte comme dépensé. « Je viens de recevoir de l'argent imprévu » envoie le montant à Claude avec ce que propose la stratégie. Les opérations s'ajoutent à la main, par l'import d'un relevé, ou en montrant ses captures à Claude ; une catégorie changée peut devenir une règle de classement.

**3. Épargne** : mes comptes d'épargne (Livret A, Livret Jeune, LEP, compte courant), avec le solde que je remplis, le taux, le taux net, le plafond et ceux qui forment l'épargne de précaution.

**4. Bourse** : mes lignes, les cours en direct, l'ajout, la vente et l'import d'une capture de Trade Republic.

**5. Claude** : il voit toutes les pages (patrimoine, mon mois et ses opérations, épargne, bourse, stratégie). Je peux joindre des captures de la Caisse d'Épargne ou de Trade Republic pour lui montrer ce que j'ai fait : il peut enregistrer les opérations dans mon mois et mettre à jour le solde d'un compte quand je le lui demande. Il passe aussi un achat ou une vente en revue selon mes règles et compare des stratégies. Il ne voit ni les cours en direct ni l'actualité.

**6. Stratégie** : mon plan (objectif, horizon, versements, paliers d'épargne de précaution) et les intérêts composés ; repliés : allocation cible, règles, enveloppes, « Ma stratégie pour Claude », règles des grands investisseurs, principes, données.

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

Sur la page publiée, chaque personne a ses propres documents, privés, sous `data/users/<id>/` : `strategie`, `portefeuille` (lignes et comptes d'épargne), `historique` (un relevé par jour), `budget` (les cases de Mon mois par mois, paie, règles de classement) et `budget/mois/AAAA-MM` (opérations du mois), `journal`, `comparer`, `discussion`, plus `marche` (cours) et `robot` (la tâche planifiée), écrits par le robot. Si je partage la page, chacun a les siens. Ouverte en fichier local, la page les garde dans le navigateur. « Enregistrer une copie » exporte tout en JSON.

## Publier la page

`outils/version-artefact.sh bourse/index.html > boussole-bourse.html`, publiée avec `app.js`, `principes.js` et `robot/cours.js`, et les capacités `db`, `user`, `sample` (avec images), `downloads` et `mcp` (Claude Code Remote, `fire_trigger`, pour « Actualiser maintenant »).

Boussole Bourse aide à appliquer sa propre stratégie ; ce n'est pas un conseil en investissement.

# Boussole Bourse

Mon outil d'investissement : il compare des stratégies, passe chaque achat ou vente en revue selon ma stratégie, et Claude répond à mes questions en connaissant mes chiffres, mes règles et mes principes.

Ouvre `index.html` dans un navigateur (rien à installer). Sur la page publiée sur claude.ai, les données suivent sur le téléphone et l'ordinateur, et Claude est disponible.

## Les cinq onglets

**Portefeuille**
- **Le relevé** : valeur totale, plus-value latente, prix de revient, frais moyens des fonds, date des cours.
- **Ma répartition** : chaque poche de ma stratégie, aujourd'hui contre la cible, avec la marge de rééquilibrage.
- **Ce qui demande ton attention** : ce qui s'écarte de ma stratégie ou de mes règles (poche hors marge, action trop lourde, frais trop hauts, épargne de précaution incomplète, ligne hors stratégie, cible trop risquée pour mon profil, dates du PEA…).
- **Mon prochain versement** : où placer l'argent du mois pour revenir vers la cible sans rien vendre, ligne par ligne, avec le nombre de parts.
- **Mes enveloppes** : PEA (plafond, 5 ans), assurance-vie (8 ans), compte-titres (impôt latent), épargne de précaution.
- **Mes lignes** : ajouter, modifier, mettre à jour les cours. « Importer avec Claude » lit le relevé copié depuis le courtier ou une capture d'écran.

**Décider** : avant d'acheter, renforcer, alléger ou vendre. La page vérifie la répartition après l'opération, le poids max d'une action, les frais, l'épargne de précaution, l'horizon, le délai de réflexion pour un achat non prévu, l'éligibilité au PEA, l'impôt d'une vente et la vente en perte, plus une check-list. Verdict : conforme, à revoir, ou contraire à mes règles. « Avis de Claude » donne un avis argumenté, « Noter au journal » garde la décision avec une date de bilan (six mois par défaut).

**Comparer** : jusqu'à trois stratégies (ma cible, mon portefeuille actuel, 100 % actions, 80/20, 60/40, fonds de banque, Livret A…), simulées sur 1 500 avenirs possibles. Résultat médian net d'impôts, cas défavorable et favorable, coût des frais, pire baisse en cours de route, chance d'atteindre mon objectif, en euros d'aujourd'hui. Les hypothèses de marché et la fiscalité sont modifiables.

**Claude** : la discussion. Claude voit ma stratégie, mes principes, mon portefeuille et mon journal ; il peut lancer les calculs de la page (répartir un versement, simuler, vérifier une opération). Il ne voit ni les cours en direct ni l'actualité.

**Stratégie** : mon profil (objectif, horizon, risque, versement, épargne de précaution), mon allocation cible en poches, mes règles chiffrées et mes règles à moi, mes enveloppes, et les 15 principes fondamentaux à cocher. « Remplir avec Claude » transforme une description écrite en réglages.

## Les principes intégrés

Épargne de précaution d'abord · 5 ans minimum pour l'argent en actions · l'allocation décide du risque · diversifier · les frais se composent · le temps passé investi compte plus que le moment · investir régulièrement · rééquilibrer avec une règle · les bonnes enveloppes (PEA, assurance-vie, compte-titres) · se méfier de ses réflexes · écrire ses décisions · n'acheter que ce qu'on comprend · le prix payé compte · pas de levier · une baisse n'est pas une perte définitive.

Chaque principe coché pilote des vérifications et est donné à Claude. Le texte des principes, les classes d'actifs, la fiscalité et les modèles sont dans `principes.js`.

## Les chiffres utilisés

- Fiscalité 2026 (impots.gouv.fr) : flat tax 31,4 % (12,8 % d'impôt + 18,6 % de prélèvements sociaux) ; PEA après 5 ans : 18,6 % sur les gains ; assurance-vie : prélèvements sociaux 17,2 %, après 8 ans abattement de 4 600 € puis 7,5 % ; plafond PEA 150 000 €.
- Hypothèses de marché par défaut (rendement annuel composé / volatilité) : actions 7 % / 16 %, obligations 3 % / 6 %, monétaire et fonds euros 2,3 % / 0,5 %, Livret A 1,7 % / 0, immobilier 4,5 % / 14 %, or 4 % / 15 %, cryptomonnaies 6 % / 70 %. Ce sont des hypothèses inspirées de l'histoire longue, pas des prévisions.
- Simulation : tirages mensuels corrélés, frais prélevés chaque mois, rééquilibrage permanent vers les poids de la stratégie, impôts appliqués à la sortie sur les gains.

## Les données

Sur la page publiée, chaque personne a ses propres documents, privés, sous `data/users/<id>/` : `strategie`, `portefeuille`, `journal`, `comparer`, `discussion`. Si je partage la page, chacun a les siens. Ouverte en fichier local, la page les garde dans le navigateur. « Enregistrer une copie » exporte tout en JSON.

## Publier la page

`outils/version-artefact.sh bourse/index.html > boussole-bourse.html`, publiée avec `app.js` et `principes.js`, et les capacités `db`, `user`, `sample` (avec images) et `downloads`.

Boussole Bourse aide à appliquer sa propre stratégie ; ce n'est pas un conseil en investissement.

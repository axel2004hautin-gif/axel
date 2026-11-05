# Boussole Bourse

Mon outil d'investissement : il suit tout mon patrimoine (épargne de précaution, PEA, compte-titres, crypto), compare des stratégies, passe chaque achat ou vente en revue selon ma stratégie, et Claude répond à mes questions en connaissant mes chiffres, mes règles et mes principes. Tout est chez Trade Republic.

Ouvre `index.html` dans un navigateur (rien à installer). Sur la page publiée sur claude.ai, les données suivent sur le téléphone et l'ordinateur, et Claude est disponible.

## Les cinq onglets

**Patrimoine**
- **Mon patrimoine** : le total (épargne + bourse + crypto), la part de chacun, la plus-value latente et la date des cours.
- **Mon épargne de précaution** : où j'en suis par rapport à mon objectif (mes dépenses × le nombre de mois), ce qu'il manque, et le mois où elle sera complète à mon rythme de versement.
- **Mon patrimoine dans le temps** : la courbe épargne, bourse et crypto. Un point est noté chaque jour où je mets à jour un cours, un solde ou une ligne.
- **Mes investissements** : chaque poche de ma stratégie, aujourd'hui contre la cible, avec la marge de rééquilibrage et les frais moyens.
- **Ce qui demande ton attention** : ce qui s'écarte de ma stratégie ou de mes règles (poche hors marge, action ou crypto trop lourde, frais trop hauts, épargne de précaution en retard ou sans versement, compte rémunéré moins rentable que le Livret A après impôt, livret plein, ligne hors stratégie…).
- **Ce mois-ci** : mon effort d'épargne du mois, partagé selon ma stratégie. D'abord le versement sur l'épargne de précaution (sur le compte au meilleur taux net qui a de la place), puis l'argent à investir, réparti ligne par ligne sans rien vendre. Une fois l'épargne de précaution complète, son versement peut basculer vers les investissements.
- **Mes enveloppes** : PEA (plafond, 5 ans), compte-titres et wallet crypto (impôt latent si je vendais tout), assurance-vie, comptes d'épargne.
- **Mes comptes d'épargne** : Livret A, LDDS, LEP, compte rémunéré, espèces du courtier, avec le solde, le taux brut, le taux net d'impôt et le plafond. Les comptes cochés forment l'épargne de précaution ; un nouveau solde se saisit directement dans le tableau.
- **Mes lignes** : ajouter, modifier, mettre à jour les cours. Une ligne peut être suivie en valeur seule quand je ne connais pas le nombre de parts. « Importer avec Claude » lit une capture de Trade Republic (une par portefeuille : PEA, compte-titres, crypto) ou un texte copié, et range les espèces dans mes comptes d'épargne.

**Décider** : avant d'acheter, renforcer, alléger ou vendre. La page vérifie la répartition après l'opération, le poids max d'une action, les frais, l'épargne de précaution, l'horizon, le délai de réflexion pour un achat non prévu, l'éligibilité au PEA, l'impôt d'une vente et la vente en perte, plus une check-list. Verdict : conforme, à revoir, ou contraire à mes règles. « Avis de Claude » donne un avis argumenté, « Noter au journal » garde la décision avec une date de bilan (six mois par défaut).

**Comparer** : jusqu'à trois stratégies (ma cible, mon portefeuille actuel, 100 % actions, 80/20, 60/40, fonds de banque, Livret A…), simulées sur 1 500 avenirs possibles. Résultat médian net d'impôts, cas défavorable et favorable, coût des frais, pire baisse en cours de route, chance d'atteindre mon objectif, en euros d'aujourd'hui. Les hypothèses de marché et la fiscalité sont modifiables.

**Claude** : la discussion. Claude voit ma stratégie, mes principes, mon portefeuille et mon journal ; il peut lancer les calculs de la page (répartir un versement, simuler, vérifier une opération). Il ne voit ni les cours en direct ni l'actualité.

**Stratégie** : mon profil (objectif, horizon, risque, versement investi, courtier), mon épargne de précaution (dépenses, nombre de mois, versement mensuel, bascule une fois complète), mon allocation cible en poches, mes règles chiffrées et mes règles à moi, mes enveloppes, et les 15 principes fondamentaux à cocher. « Remplir avec Claude » transforme une description écrite en réglages.

## Les principes intégrés

Épargne de précaution d'abord · 5 ans minimum pour l'argent en actions · l'allocation décide du risque · diversifier · les frais se composent · le temps passé investi compte plus que le moment · investir régulièrement · rééquilibrer avec une règle · les bonnes enveloppes (PEA, assurance-vie, compte-titres) · se méfier de ses réflexes · écrire ses décisions · n'acheter que ce qu'on comprend · le prix payé compte · pas de levier · une baisse n'est pas une perte définitive.

Chaque principe coché pilote des vérifications et est donné à Claude. Le texte des principes, les classes d'actifs, la fiscalité et les modèles sont dans `principes.js`.

## Les chiffres utilisés

- Fiscalité 2026 (impots.gouv.fr) : flat tax 31,4 % (12,8 % d'impôt + 18,6 % de prélèvements sociaux), aussi sur les intérêts d'un compte rémunéré ; PEA après 5 ans : 18,6 % sur les gains ; crypto : 31,4 % sur les gains en repassant en euros, rien sous 305 € de ventes dans l'année ; assurance-vie : prélèvements sociaux 17,2 %, après 8 ans abattement de 4 600 € puis 7,5 % ; plafond PEA 150 000 €.
- Épargne : Livret A et LDDS à 1,7 % net d'impôt depuis le 1er août 2026 (plafonds 22 950 € et 12 000 €), LEP 2,5 %. Le taux d'un compte rémunéré change souvent : il se recopie depuis l'appli.
- Trade Republic : un plan d'investissement programmé est sans frais, un ordre ponctuel coûte 1 € ; le PEA n'achète que des parts entières, le compte-titres et la crypto acceptent les fractions.
- Hypothèses de marché par défaut (rendement annuel composé / volatilité) : actions 7 % / 16 %, obligations 3 % / 6 %, monétaire et fonds euros 2,3 % / 0,5 %, Livret A 1,7 % / 0, immobilier 4,5 % / 14 %, or 4 % / 15 %, cryptomonnaies 6 % / 70 %. Ce sont des hypothèses inspirées de l'histoire longue, pas des prévisions.
- Simulation : tirages mensuels corrélés, frais prélevés chaque mois, rééquilibrage permanent vers les poids de la stratégie, impôts appliqués à la sortie sur les gains.

## Les données

Sur la page publiée, chaque personne a ses propres documents, privés, sous `data/users/<id>/` : `strategie`, `portefeuille` (lignes et comptes d'épargne), `historique` (un relevé par jour), `journal`, `comparer`, `discussion`. Si je partage la page, chacun a les siens. Ouverte en fichier local, la page les garde dans le navigateur. « Enregistrer une copie » exporte tout en JSON.

## Publier la page

`outils/version-artefact.sh bourse/index.html > boussole-bourse.html`, publiée avec `app.js` et `principes.js`, et les capacités `db`, `user`, `sample` (avec images) et `downloads`.

Boussole Bourse aide à appliquer sa propre stratégie ; ce n'est pas un conseil en investissement.

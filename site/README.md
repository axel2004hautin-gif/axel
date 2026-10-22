# Tableau de bord Axel

Mon tableau de bord, publié sur claude.ai : https://claude.ai/artifact/QcoRPH8YUBGwfVt8XqzoYY

Ouvre `index.html` dans un navigateur pour le voir en local (rien à installer). En local, le planning, la to-do list et la garde-robe sont gardés dans le navigateur.

Fond blanc, titre bleu marine, et sous le titre un bandeau marine avec les trois rubriques. Au survol d'une rubrique, ses sous-rubriques s'affichent dans un bandeau clair juste en dessous. Cliquer sur une rubrique ouvre la page de ses sous-rubriques ; sur téléphone, c'est le chemin pour y accéder. Le titre ramène à l'accueil.

Une adresse qui finit par `#travail`, `#argent` ou `#sport` ouvre directement la rubrique ; `#planning`, `#todo` et `#garde-robe` ouvrent les sous-rubriques « Mon planning », « To-do list » et « Garde-robe Blue Box ».

## Travail

La page Travail présente ses sous-rubriques en cartes. « Mon planning » montre la semaine en cours en miniature, les horaires d'aujourd'hui, le total d'heures et le jour de repos ; « To-do list » montre les compteurs et les trois tâches les plus pressantes ; « Garde-robe Blue Box » montre six pièces en photo et le nombre de pièces et de marques.

### Mon planning

Tout tient dans l'écran, sans descendre, sur ordinateur comme sur téléphone :

- **La semaine** : « Semaine 43 du 19 au 25 octobre », avec les flèches pour passer à la semaine d'avant ou d'après. Toucher le titre ouvre le choix de la semaine : l'année, puis les 52 ou 53 semaines (celles déjà remplies ont un point).
- **Le planning** : une frise du lundi au samedi, de 10h à 19h (elle s'allonge si une semaine commence plus tôt ou finit plus tard). Les heures sont écrites à gauche avec un trait marqué ; la demi-heure a un trait léger. Le temps travaillé est en bleu à la minute près, le reste en blanc. Deux barres rouges, à 12h et à 14h, marquent le milieu de la journée. L'heure d'arrivée est écrite en haut de chaque bloc bleu, l'heure de départ en bas. Aujourd'hui est encadré en marine, les jours de repos sont hachurés marron.
- **Le bilan** : les heures travaillées de la semaine, le jour de repos et le bouton « Modifier le planning ».

« Modifier le planning » ouvre une fenêtre au milieu de l'écran : pour chaque jour, le début et la fin du matin et de l'après-midi.

| Période | Choix |
|---|---|
| Début matin | 10h, 10h30, 11h |
| Fin matin | 12h, 12h30, 13h, 13h30 |
| Début après-midi | 14h, 14h30 |
| Fin après-midi | 18h, 19h |

Chaque période a aussi « Autre… » pour taper une heure (retard, fin plus tard), et « — » quand elle n'est pas travaillée. « Repos », en face du jour, met le matin et l'après-midi en repos.

### To-do list

Ce que je dois faire au magasin et ce que je dois dire à quelqu'un.

- **Ajouter** (en haut) : « À faire » ou « À dire », le texte, « À qui ? » pour ce qui est à dire (les prénoms déjà utilisés sont proposés), « Pour quand ? » (pas de date, aujourd'hui, demain, prochain service, ou une date) et « Urgent ». Entrée ajoute la tâche ; le type et la personne restent pour la suivante.
- **Prochain service** : le prochain jour travaillé d'après le planning, à partir de demain.
- **Deux colonnes** : « À faire au magasin » et « À dire », regroupé par personne. Les tâches urgentes passent en premier (trait rouge), puis par échéance ; une échéance dépassée est marquée « En retard ».
- **Cocher** une tâche la range dans « Fait », en bas, d'où on peut la décocher. « Effacer ce qui est fait » vide cette partie (second appui pour confirmer).
- **Le crayon** ouvre la tâche pour la modifier ou la supprimer (second appui pour confirmer).

### Garde-robe Blue Box

Les pièces du magasin (rayon homme), pour penser les vitrines, les tenues et les posts. Quatre onglets : Pièces, Tenues, Comparer, Ce qu'il manque (`#garde-robe`, `#tenues`, `#comparer`, `#manque`).

**Pièces**
- Les pièces en photo, rangées par catégorie : marque, modèle, couleur (avec sa pastille), prix et repères (Nouveauté, Promo, Idée vitrine, À poster).
- Filtres : recherche (modèle, marque, couleur, matière, référence, note), marque, catégorie, famille de couleur et repères.
- « Ajouter une pièce » : photos, marque, catégorie, modèle, couleur, matière, coupe, prix, référence, lien sur le site de la marque, repères et note. Une photo nommée comme les exports Canva (`Marque - Catégorie - Modèle - Couleur.png`) remplit les champs. Une photo détourée (PNG transparent) garde sa transparence ; les autres sont enregistrées en JPEG, réduites à 900 px.
- **Couleur** : « Choisir dans le nuancier » ouvre 113 nuances avec leur vraie couleur, rangées en 13 familles (Blancs, Gris, Noirs, Beiges, Marrons, Bleus, Verts, Rouges, Roses, Jaunes, Oranges, Violets, Motifs) : du bleu glacier au bleu nuit, du vert d'eau au vert bouteille, moutarde, rouille, terracotta, lie de vin, rayé, vichy, pied-de-poule… Toucher une nuance la met dans le champ ; la pastille montre la nuance exacte, partout dans la garde-robe. Une nuance qui n'y est pas se tape à la main (« Bleu marine chiné » garde la pastille du bleu marine), et le champ propose toutes les nuances en tapant.
- **Photos** : jusqu'à 6 par pièce, choisies d'un coup ou une à une. La première est la photo principale (celle du catalogue, des tenues et du comparateur). Les vignettes sous la photo permettent de les regarder ; « Mettre en photo principale » et « Retirer cette photo » s'appliquent à celle qu'on regarde. Une carte avec plusieurs photos l'indique (« 3 photos »).
- **Site de la marque** : coller l'adresse de la page de l'article ; la fiche affiche alors « Voir sur le site de la marque ↗ ». La page ne va pas chercher elle-même les infos sur le site de la marque : pour remplir des pièces à partir de liens, il suffit de me les envoyer dans la conversation.
- « Enregistrer et ajouter une autre » rouvre la fenêtre vide avec la même marque et la même catégorie ; le nom de la photo suivante les remplace tant qu'elles n'ont pas été retouchées.
- « Sélectionner » : toucher les pièces pour les choisir, puis les supprimer d'un coup (second appui pour confirmer), les comparer ou en faire une tenue.

**Tenues**
- Six cases côte à côte, sans rien superposer : Blouson ou veste, Pull, T-shirt ou chemise, Pantalon ou jean, Chaussures, Accessoires. Une case vide montre un « + ».
- Toucher un « + » (ou une photo, pour la changer) ouvre le choix parmi les pièces de la garde-robe de cette catégorie, avec une recherche. « Ajouter une nouvelle pièce » ouvre la fenêtre d'ajout sur la bonne catégorie : la pièce rejoint la garde-robe et prend place dans la case. La croix retire la pièce de la tenue.
- En dessous : le prix total, le nom, la description (« Proposer une description » la fait écrire par Claude, selon que la tenue est pour la vitrine, les réseaux ou un client), l'étoile (favori), le cœur (vitrine) et la caméra (réseaux sociaux).
- « ✓ Valider la tenue » l'enregistre et, dès deux pièces, lui donne une **note sur 100**, avec le détail par critère (chaque point perdu est expliqué). Seules les pièces choisies sont notées, sur une question : vont-elles ensemble ? Une tenue sans chaussures, sans accessoire ou sans veste n'est pas pénalisée : « veste + pantalon » ou « chemise + pantalon » peut avoir 100.
  - **Couleurs (50)** : une couleur forte sur une base neutre (bleus, kaki, olive, vert militaire, vert sauge, noir, blanc, gris, beige, marron) ou que des neutres, c'est bien ; deux couleurs fortes −8, trois −22, des couleurs qui se heurtent (rouge et rose, rouge et orange…) −30, deux motifs −15 ; une couleur non renseignée −5.
  - **Haut et bas (30)** : haut et bas du même foncé qui se confondent −27 (−8 si une pièce plus claire dessous casse l'effet, comme une chemise blanche sous une veste marine), jean sur jean du même bleu −20 (−4 avec deux bleus différents), haut et bas très clairs −8. Sans haut ou sans bas, rien à comparer : pas de pénalité. Le contraste se mesure sur la nuance exacte quand elle vient du nuancier.
  - **Saison (20)** : une pièce d'hiver (laine, cachemire, manteau…) avec une pièce d'été (short, lin…) −15.
  - 90 et plus : excellente ; 75 : très bonne ; 60 : bonne ; 40 : correcte ; en dessous : à retravailler. La note suit les changements de pièces.
- « Mes tenues » : chaque tenue en petit (ses six cases, trois par ligne) avec sa note (à partir de deux pièces), filtrables par repère. Le comparateur de tenues montre aussi la note et signale la meilleure.

**Comparer**
- Des pièces ou des tenues. Deux cases « + » au départ ; quand elles sont remplies, une case « + » de plus apparaît, jusqu'à cinq. Toucher une photo la change, la croix la retire.
- Côte à côte : marque, catégorie, couleur, matière, coupe, prix (le moins cher est signalé, avec l'écart des autres), référence, repères, note, site de la marque ; pour les tenues, les pièces, le prix total, les marques, les couleurs et les matières. Les lignes identiques sont grisées.
- Une comparaison s'enregistre avec un nom et les mêmes étoile, cœur et caméra.

**Ce qu'il manque**
- Les demandes des clients que le magasin ne peut pas satisfaire. Une même demande ajoutée deux fois compte une fois de plus ; « +1 » aussi. Les plus demandées passent en premier.
- Statut : À proposer, Proposé à Maxime, Commandé, Pas retenu. « À dire à Maxime » l'ajoute à la to-do, dans « À dire ».
- En dessous, les catégories où le magasin n'a encore aucune pièce.

## Argent et Sport

À construire : chaque rubrique montre des idées de contenu, marquées « Idée ».

## Données

Sur la page publiée, le planning, la to-do list et la garde-robe (pièces, tenues, comparaisons, demandes) sont enregistrés dans la base de la page : ils sont les mêmes sur le téléphone et l'ordinateur, et seul le propriétaire peut les modifier. Un document par semaine : `planning/AAAA-Wss` (semaine ISO, par exemple `planning/2026-W43`), avec `jours.lundi` … `jours.samedi` : `{ repos, matin: { debut, fin }, apresMidi: { debut, fin } }`, les heures au format `HH:MM`.

Un document par tâche : `todo/<id>`, avec `texte`, `type` (`faire` ou `dire`), `personne`, `pour` (`AAAA-MM-JJ` ou rien), `urgent`, `fait`, `faitLe` et `creeLe`.

Un document par pièce : `pieces/<id>`, avec `marque`, `categorie` (`pulls`, `jeans`, `pantalons`…), `modele`, `coupe`, `couleur`, `matiere`, `rayon` (toujours `homme`), `prix`, `ref`, `lien` (la page de l'article sur le site de la marque), `photos`, `photo`, `reperes` (`nouveaute`, `promo`, `vitrine`, `reseaux`), `note` et `creeLe`. `photos` est la liste des photos (6 au plus, la principale en premier) ; `photo` reprend la principale, et une pièce qui n'a que `photo` est lue comme une pièce à une photo. Une photo est l'identifiant d'un fichier envoyé depuis la page (stockage de la page), ou le chemin d'une image publiée avec elle (`images/…jpg`). Les fichiers qu'une pièce n'utilise plus (photo retirée, pièce supprimée) sont effacés du stockage.

Garde-robe, suite : `tenues/<id>` (`nom`, `pieces` : liste d'identifiants de pièces, `description`, `favori`, `vitrine`, `reseaux`, `creeLe`, `modifieLe`) ; `comparaisons/<id>` (`type` : `pieces` ou `tenues`, `elements`, `nom`, `favori`, `vitrine`, `reseaux`, `creeLe`) ; `demandes/<id>` (`quoi`, `categorie`, `nombre`, `derniereLe`, `statut` : `a-proposer`, `propose`, `commande` ou `refuse`, `creeLe`).

## Publier

`outils/version-artefact.sh site/index.html > site-axel.html`, puis publier `site-axel.html` sur la même adresse, avec les capacités `db` (écriture réservée au propriétaire), `user`, `assets` (envoi des photos) et `sample` (descriptions de tenues écrites par Claude).

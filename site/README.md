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
- « Ajouter une pièce » : photo, marque, catégorie, modèle, couleur, matière, coupe, prix, référence, lien de la fiche produit, repères et note. Une photo nommée comme les exports Canva (`Marque - Catégorie - Modèle - Couleur.png`) remplit les champs. Une photo détourée (PNG transparent) garde sa transparence ; les autres sont enregistrées en JPEG, réduites à 900 px.
- « Enregistrer et ajouter une autre » rouvre la fenêtre vide avec la même marque et la même catégorie ; le nom de la photo suivante les remplace tant qu'elles n'ont pas été retouchées.
- « Sélectionner » : toucher les pièces pour les choisir, puis les supprimer d'un coup (second appui pour confirmer), les comparer ou en faire une tenue.

**Tenues**
- « Porté par » : **le modèle** (un homme en photo, `site/modele/`) ou **le mannequin** de vitrine dessiné. Le choix est gardé dans le navigateur.
- Le porteur est habillé avec les photos des pièces choisies : veste, pull, t-shirt ou chemise, bas, chaussures, accessoire (une pièce par emplacement). Le fond uni de chaque photo est détouré dans la page (couleur et teinte proches du bord), puis la pièce est posée à sa place. Les photos sur fond uni, ou déjà détourées, donnent le meilleur rendu ; une photo portée par un modèle garde le modèle.
- Le modèle est sa photo découpée en calques (`outils/decouper-modele.py`) : son buste, ses jambes et ses pieds s'effacent quand la tenue met une pièce à leur place, et restent quand l'emplacement est vide ; sa tête et son cou passent par-dessus les vêtements, pour que les cols restent sous le menton. Sa pose ne change pas (c'est une photo).
- L'œil enlève une pièce pour voir dessous, la croix la retire de la tenue.
- Nom, description (« Proposer une description » la fait écrire par Claude, selon que la tenue est pour la vitrine, les réseaux ou un client), étoile (favori), cœur (vitrine), caméra (réseaux sociaux), prix total.
- « Mes tenues » : toutes les tenues enregistrées, filtrables par repère.

**Comparer**
- De 2 à 4 pièces, ou de 2 à 3 tenues, côte à côte : marque, catégorie, couleur, matière, coupe, prix (le moins cher est signalé, avec l'écart des autres), référence, repères, note, fiche produit ; pour les tenues, les pièces, le prix total, les marques, les couleurs et les matières. Les lignes identiques sont grisées.
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

Un document par pièce : `pieces/<id>`, avec `marque`, `categorie` (`pulls`, `jeans`, `pantalons`…), `modele`, `coupe`, `couleur`, `matiere`, `rayon` (toujours `homme`), `prix`, `ref`, `lien`, `photo`, `reperes` (`nouveaute`, `promo`, `vitrine`, `reseaux`), `note` et `creeLe`. La photo est l'identifiant d'un fichier envoyé depuis la page (stockage de la page), ou le chemin d'une image publiée avec elle (`images/…jpg`).

Garde-robe, suite : `tenues/<id>` (`nom`, `pieces` : liste d'identifiants de pièces, `description`, `favori`, `vitrine`, `reseaux`, `creeLe`, `modifieLe`) ; `comparaisons/<id>` (`type` : `pieces` ou `tenues`, `elements`, `nom`, `favori`, `vitrine`, `reseaux`, `creeLe`) ; `demandes/<id>` (`quoi`, `categorie`, `nombre`, `derniereLe`, `statut` : `a-proposer`, `propose`, `commande` ou `refuse`, `creeLe`).

## Publier

`outils/version-artefact.sh site/index.html > site-axel.html`, puis publier `site-axel.html` sur la même adresse avec les calques du modèle (`site/modele/homme-*.png` publiés sous `modele/`), et les capacités `db` (écriture réservée au propriétaire), `user`, `assets` (envoi des photos) et `sample` (descriptions de tenues écrites par Claude).

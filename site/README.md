# Tableau de bord Axel

Mon tableau de bord, publié sur claude.ai : https://claude.ai/artifact/QcoRPH8YUBGwfVt8XqzoYY

Ouvre `index.html` dans un navigateur pour le voir en local (rien à installer). En local, le planning est gardé dans le navigateur.

Fond blanc, titre bleu marine, et sous le titre un bandeau marine avec les trois rubriques. Au survol d'une rubrique, ses sous-rubriques s'affichent dans un bandeau clair juste en dessous. Cliquer sur une rubrique ouvre la page de ses sous-rubriques ; sur téléphone, c'est le chemin pour y accéder. Le titre ramène à l'accueil.

Une adresse qui finit par `#travail`, `#argent` ou `#sport` ouvre directement la rubrique, `#planning` la sous-rubrique « Mon planning ».

## Travail

La page Travail présente ses sous-rubriques. Pour l'instant, il n'y en a qu'une, « Mon planning » : sa carte montre la semaine en cours en miniature, les horaires d'aujourd'hui, le total d'heures et le jour de repos.

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

## Argent et Sport

À construire : chaque rubrique montre des idées de contenu, marquées « Idée ».

## Données

Sur la page publiée, le planning est enregistré dans la base de la page : il est le même sur le téléphone et l'ordinateur, et seul le propriétaire peut le modifier. Un document par semaine : `planning/AAAA-Wss` (semaine ISO, par exemple `planning/2026-W43`), avec `jours.lundi` … `jours.samedi` : `{ repos, matin: { debut, fin }, apresMidi: { debut, fin } }`, les heures au format `HH:MM`.

## Publier

`outils/version-artefact.sh site/index.html > site-axel.html`, puis publier `site-axel.html` sur la même adresse, avec les capacités `db` (écriture réservée au propriétaire) et `user`.

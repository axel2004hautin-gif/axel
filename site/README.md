# Tableau de bord Axel

Mon tableau de bord, publié sur claude.ai : https://claude.ai/artifact/QcoRPH8YUBGwfVt8XqzoYY

Ouvre `index.html` dans un navigateur pour le voir en local (rien à installer). En local, le planning est gardé dans le navigateur.

Fond blanc, titre bleu marine, et sous le titre un bandeau marine avec les trois rubriques. Le titre ramène à l'accueil. Une adresse qui finit par `#travail`, `#argent` ou `#sport` ouvre directement la rubrique.

## Travail

Tout tient dans l'écran, sans descendre, sur ordinateur comme sur téléphone :

- **La semaine** : « Semaine 43 du 19 au 25 octobre », avec les flèches pour passer à la semaine d'avant ou d'après. Toucher le titre ouvre le choix de la semaine : l'année, puis les 52 ou 53 semaines (celles déjà remplies ont un point).
- **Le planning** : du lundi au samedi, le matin et l'après-midi. Aujourd'hui est en marine, les jours de repos sont hachurés.
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

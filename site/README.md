# Tableau de bord Axel

Mon tableau de bord, publié sur claude.ai : https://claude.ai/artifact/QcoRPH8YUBGwfVt8XqzoYY

Ouvre `index.html` dans un navigateur pour le voir en local (rien à installer). En local, le planning et la to-do list sont gardés dans le navigateur.

Fond blanc, titre bleu marine, et sous le titre un bandeau marine avec les trois rubriques. Au survol d'une rubrique, ses sous-rubriques s'affichent dans un bandeau clair juste en dessous. Cliquer sur une rubrique ouvre la page de ses sous-rubriques ; sur téléphone, c'est le chemin pour y accéder. Le titre ramène à l'accueil.

Une adresse qui finit par `#travail`, `#argent` ou `#sport` ouvre directement la rubrique ; `#planning` et `#todo` ouvrent les sous-rubriques « Mon planning » et « To-do list ».

## Travail

La page Travail présente ses sous-rubriques en cartes. « Mon planning » montre la semaine en cours en miniature, les horaires d'aujourd'hui, le total d'heures et le jour de repos ; « To-do list » montre les compteurs et les trois tâches les plus pressantes.

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

## Argent et Sport

À construire : chaque rubrique montre des idées de contenu, marquées « Idée ».

## Données

Sur la page publiée, le planning et la to-do list sont enregistrés dans la base de la page : ils sont les mêmes sur le téléphone et l'ordinateur, et seul le propriétaire peut les modifier. Un document par semaine : `planning/AAAA-Wss` (semaine ISO, par exemple `planning/2026-W43`), avec `jours.lundi` … `jours.samedi` : `{ repos, matin: { debut, fin }, apresMidi: { debut, fin } }`, les heures au format `HH:MM`.

Un document par tâche : `todo/<id>`, avec `texte`, `type` (`faire` ou `dire`), `personne`, `pour` (`AAAA-MM-JJ` ou rien), `urgent`, `fait`, `faitLe` et `creeLe`.

## Publier

`outils/version-artefact.sh site/index.html > site-axel.html`, puis publier `site-axel.html` sur la même adresse, avec les capacités `db` (écriture réservée au propriétaire) et `user`.

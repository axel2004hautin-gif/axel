# Tableau de bord Axel

Mon tableau de bord, publié sur claude.ai : https://claude.ai/artifact/QcoRPH8YUBGwfVt8XqzoYY

Ouvre `index.html` dans un navigateur pour le voir en local (rien à installer). En local, le planning, la to-do list et la garde-robe sont gardés dans le navigateur.

Fond blanc, titre bleu marine, et sous le titre un bandeau marine avec les trois rubriques. Au survol d'une rubrique, ses sous-rubriques s'affichent dans un bandeau clair juste en dessous. Cliquer sur une rubrique ouvre la page de ses sous-rubriques. Sur les pages de Travail, la barre de ses sous-rubriques (Planning, To-do, Garde-robe, Calendrier, Objectifs) reste affichée sous le bandeau, celle ouverte soulignée ; sur téléphone, elle défile au doigt. Le titre ramène à l'accueil.

L'accueil commence par **Ma journée** : mes horaires d'aujourd'hui (ou repos, congé, férié) et ceux du prochain service ; les tâches pour aujourd'hui et en retard ; le prochain temps fort et la date de sa vitrine ; et, pour les objectifs, si le dernier jour travaillé est saisi. En mode discret, ce dernier bloc ne montre aucun chiffre (« À jour » ou « Samedi 24 à saisir »). Un bloc qui demande quelque chose (tâches du jour, vitrine dans trois jours au plus, journée à saisir) est encadré. Chaque bloc ouvre sa page. Viennent ensuite les trois rubriques.

Une adresse qui finit par `#travail`, `#argent` ou `#sport` ouvre directement la rubrique ; `#planning`, `#todo`, `#garde-robe`, `#calendrier` et `#objectifs` ouvrent les sous-rubriques « Mon planning », « To-do list », « Garde-robe Blue Box », « Calendrier commercial » et « Objectifs ».

## Travail

La page Travail présente ses sous-rubriques en cartes. « Mon planning » montre la semaine en cours en miniature, les horaires d'aujourd'hui, le total d'heures, le jour de repos, les heures à récupérer et les congés restants ; « To-do list » montre les compteurs et les trois tâches les plus pressantes ; « Garde-robe Blue Box » montre six pièces en photo et le nombre de pièces et de marques ; « Calendrier commercial » montre le prochain temps fort et sa vitrine ; « Objectifs » montre la part homme du mois.

### Mon planning

Tout tient dans l'écran, sans descendre, sur ordinateur comme sur téléphone :

- **La semaine** : « Semaine 43 du 19 au 25 octobre », avec les flèches pour passer à la semaine d'avant ou d'après. Toucher le titre ouvre le choix de la semaine : l'année, puis les 52 ou 53 semaines (celles déjà remplies ont un point).
- **Le planning** : une frise du lundi au samedi, de 10h à 19h (elle s'allonge si une semaine commence plus tôt ou finit plus tard). Les heures sont écrites à gauche avec un trait marqué ; la demi-heure a un trait léger. Le temps travaillé est en bleu à la minute près, le reste en blanc. Deux barres rouges, à 12h et à 14h, marquent le milieu de la journée. L'heure d'arrivée est écrite en haut de chaque bloc bleu, l'heure de départ en bas. Aujourd'hui est encadré en marine, les jours de repos sont hachurés marron.
- **Le bilan** : les heures travaillées de la semaine et leur écart avec le contrat (« +1h payées », « +0h20 à récup. »), le jour de repos et les congés, et les boutons « Mon compteur » et « Modifier le planning ».

« Modifier le planning » ouvre une fenêtre au milieu de l'écran : pour chaque jour, le début et la fin du matin et de l'après-midi. En haut, « Reprendre ses horaires » recopie les horaires et le jour de repos de la dernière semaine remplie (jusqu'à deux mois en arrière) ; les congés et fériés déjà cochés restent, et rien n'est enregistré avant « Enregistrer ».

| Période | Choix |
|---|---|
| Début matin | 10h, 10h30, 11h |
| Fin matin | 12h, 12h30, 13h, 13h30 |
| Début après-midi | 14h, 14h30 |
| Fin après-midi | 18h, 19h |

Chaque période a aussi « Autre… » pour taper une heure (retard, fin plus tard), et « — » quand elle n'est pas travaillée. En face du jour, « Repos », « Congé » ou « Férié » (seulement les jours fériés, dont le nom s'affiche) remplacent le matin et l'après-midi. Dans le planning, le repos est hachuré marron, le congé vert, le férié violet.

**Mon compteur** (heures en plus et congés) :
- Le contrat (réglages dans la fenêtre) : heures par semaine, jours travaillés, date de début. Un congé ou un férié chômé compte une journée de contrat (heures ÷ jours travaillés), cinq au plus par semaine.
- Chaque semaine remplie depuis le début du contrat est comparée au contrat. Les heures en plus : par défaut, les demi-heures pleines sont payées et le reste (quelques minutes pour finir une vente) est à récupérer ; pour chaque semaine, on peut choisir « Tout payé » ou « Tout à récupérer ». Une semaine sous le contrat consomme la récupération. Une semaine non remplie ne compte pas ; les semaines à venir sont affichées « prévues » sans compter.
- En haut : les heures à récupérer (ou à rattraper), les heures payées du mois (à retrouver sur la fiche de paie) et les congés restants : 2,5 jours ouvrables acquis par mois depuis le début du contrat, moins les jours pris et posés. Une semaine entière de congés se compte 6 jours (lundi au samedi) : mettre aussi le jour de repos en Congé.
- En dessous : semaine par semaine, mois par mois, et la liste des congés posés.

### To-do list

Ce que je dois faire au magasin et ce que je dois dire à quelqu'un.

- **Ajouter** (en haut) : « À faire » ou « À dire », le texte, « À qui ? » pour ce qui est à dire (les prénoms déjà utilisés sont proposés), « Pour quand ? » (pas de date, aujourd'hui, demain, prochain service, ou une date), « Urgent » et « Chaque semaine ». Entrée ajoute la tâche ; le type et la personne restent pour la suivante.
- **Prochain service** : le prochain jour travaillé d'après le planning, à partir de demain.
- **Deux colonnes** : « À faire au magasin » et « À dire », regroupé par personne. Les tâches urgentes passent en premier (trait rouge), puis par échéance ; une échéance dépassée est marquée « En retard ».
- **Cocher** une tâche la range dans « Fait », en bas, d'où on peut la décocher. « Effacer ce qui est fait » vide cette partie (second appui pour confirmer).
- **Chaque semaine** : la tâche revient le même jour de la semaine que sa date (« ↻ Chaque ven. »). Cochée, elle se recrée pour la semaine suivante (jamais avant aujourd'hui) ; décochée, cette copie disparaît si elle n'est pas faite. Pour arrêter, ouvrir la prochaine et décocher « Chaque semaine ».
- **Le crayon** ouvre la tâche pour la modifier ou la supprimer (second appui pour confirmer).

### Garde-robe Blue Box

Les pièces du magasin (rayon homme), pour penser les vitrines, les tenues et les posts. Quatre onglets : Pièces, Tenues, Comparer, Ce qu'il manque (`#garde-robe`, `#tenues`, `#comparer`, `#manque`).

**Pièces**
- Les pièces en photo, rangées par catégorie : marque, modèle, couleur (avec sa pastille), prix et repères (Nouveauté, Promo, Idée vitrine, À poster).
- Filtres : recherche (modèle, marque, couleur, matière, référence, note), marque, catégorie, famille de couleur et repères.
- « Ajouter une pièce » : photos, lien sur le site de la marque, prix, référence, marque, catégorie, modèle, couleur, coupe, matière, repères et note.
- **La fiche se remplit toute seule** : ajouter les photos et coller le lien, il ne reste que le prix.
  - **Le lien**, dès qu'il est collé : la marque (le site, ou une marque déjà dans la garde-robe), et dans l'adresse la catégorie, le modèle, la couleur (traduite vers le nuancier : « cream » → Crème, « dark navy » → Bleu nuit), la coupe et la référence quand elles y sont.
  - **Claude**, dès qu'il y a des photos (pour une nouvelle pièce) : il regarde jusqu'à 3 photos et le lien, et remplit la catégorie, le modèle (dans le style des pièces déjà enregistrées de la même marque), la couleur exacte du nuancier, la coupe et la matière quand elles se voient. Il ne touche jamais à ce qui a été tapé à la main. « Arrêter » l'interrompt, « Refaire » le relance ; sur une pièce déjà enregistrée, « Compléter avec Claude (champs vides) ».
  - Les champs remplis automatiquement sont en jaune jusqu'à ce qu'on les retouche : ce sont ceux à vérifier. La page ne peut pas ouvrir le site de la marque (elle n'a pas accès aux autres sites) : la matière vient de l'étiquette ou de ce qui se voit.
- **Par lots, dans la conversation avec Claude** : envoyer les liens des articles (sites des marques sous Shopify, comme teddy-smith.com, et hugoboss.com ; Tommy Hilfiger, Calvin Klein, Levi's et Le Temps des Cerises refusent les robots, leurs pièces s'ajoutent depuis la page avec « Remplir avec Claude ») ; `outils/importer-fiches.py` lit chaque fiche (titre, coupe, matière, couleur, prix, référence, photos), puis les pièces sont créées directement dans la garde-robe, photos comprises. Le prix est le prix normal du site : les promos du site ne valent pas en magasin. Une photo nommée comme les exports Canva (`Marque - Catégorie - Modèle - Couleur.png`) remplit aussi les champs. Une photo détourée (PNG transparent) garde sa transparence ; les autres sont enregistrées en JPEG, réduites à 900 px.
- **Couleur** : « Choisir dans le nuancier » ouvre 113 nuances avec leur vraie couleur, rangées en 13 familles (Blancs, Gris, Noirs, Beiges, Marrons, Bleus, Verts, Rouges, Roses, Jaunes, Oranges, Violets, Motifs) : du bleu glacier au bleu nuit, du vert d'eau au vert bouteille, moutarde, rouille, terracotta, lie de vin, rayé, vichy, pied-de-poule… Toucher une nuance la met dans le champ ; la pastille montre la nuance exacte, partout dans la garde-robe. Une nuance qui n'y est pas se tape à la main (« Bleu marine chiné » garde la pastille du bleu marine) ; un motif suivi d'une couleur (« Rayé rouge », « Carreaux crème », « Pied-de-poule marron ») a sa pastille dessinée dans cette couleur, et le champ propose toutes les nuances en tapant.
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

### Calendrier commercial

Les temps forts de l'année pour préparer les vitrines, et les bons moments pour poser des congés.

- **Prochain temps fort** : ses dates et le compte à rebours, le thème et les idées de vitrine, la date de montage de la vitrine, les tenues choisies (un clic ouvre la tenue), « Vitrine prête » et « Ajouter à la to-do » (« Monter la vitrine … » pour le jour du montage, ou la veille du temps fort).
- **Les 12 prochains mois** : une frise où chaque temps fort est une barre (plein : temps fort, je reste au magasin ; contour : affluence normale), les congés posés dans le planning en vert, et aujourd'hui en rouge. Un nom trop long pour sa barre s'écrit à côté. Toucher une barre ou son nom ouvre le temps fort.
- **Bons moments pour poser des congés** : les périodes d'au moins une semaine sans temps fort, en dehors de la semaine qui le prépare.
- **Tous les temps forts**, mois par mois, avec leur affluence, la vitrine et le nombre de tenues. « Ajouter un temps fort » : nom, dates, affluence, thème et idées, montage de la vitrine, tenues (celles marquées vitrine d'abord), note.

### Objectifs

La part homme du chiffre d'affaires du magasin, comparée à l'objectif (55 à 60 % au départ, modifiable).

- **Saisie** : le jour, le CA homme et le CA femme ; un jour déjà saisi est remplacé. Un jour sans saisie ne compte pas.
- **La part** d'aujourd'hui, de la semaine, du mois ou depuis le début, avec une jauge, l'état (dans l'objectif, en dessous, au-dessus) et, en dessous de l'objectif, ce qu'il manque côté homme pour l'atteindre.
- **La courbe** de la part homme semaine par semaine (12 semaines), avec la bande de l'objectif ; le survol d'une semaine affiche ses chiffres.
- **Mode discret** (activé au départ, gardé dans ce navigateur) : les montants sont cachés à l'écran, y compris pendant la saisie ; seuls les pourcentages restent. La page n'est visible que de son propriétaire.

## Argent et Sport

À construire : chaque rubrique montre des idées de contenu, marquées « Idée ».

## Données

Sur la page publiée, le planning, la to-do list et la garde-robe (pièces, tenues, comparaisons, demandes) sont enregistrés dans la base de la page : ils sont les mêmes sur le téléphone et l'ordinateur, et seul le propriétaire peut les modifier. Un document par semaine : `planning/AAAA-Wss` (semaine ISO, par exemple `planning/2026-W43`), avec `jours.lundi` … `jours.samedi` : `{ repos, conge, ferie, matin: { debut, fin }, apresMidi: { debut, fin } }`, les heures au format `HH:MM`, et `heuresSup` (`payees`, `recup`, ou rien pour la répartition par défaut).

Réglages : `reglages/travail` (`heuresSemaine`, `joursSemaine`, `debutContrat` AAAA-MM-JJ) et `reglages/objectifs` (`cibleMin`, `cibleMax` en %).

Calendrier : `calendrier/<id>` (`nom`, `debut`, `fin`, `affluence` : `forte` ou `normale`, `theme`, `vitrineLe`, `vitrinePrete`, `tenues` : identifiants de tenues, `note`, `creeLe`). Objectifs : `ca/AAAA-MM-JJ` (`homme`, `femme` en euros, `modifieLe`).

Un document par tâche : `todo/<id>`, avec `texte`, `type` (`faire` ou `dire`), `personne`, `pour` (`AAAA-MM-JJ` ou rien), `urgent`, `repete` (revient chaque semaine), `suivante` (l'identifiant de la copie créée pour la semaine suivante, une fois cochée), `fait`, `faitLe` et `creeLe`.

Un document par pièce : `pieces/<id>`, avec `marque`, `categorie` (`pulls`, `jeans`, `pantalons`…), `modele`, `coupe`, `couleur`, `matiere`, `rayon` (toujours `homme`), `prix`, `ref`, `lien` (la page de l'article sur le site de la marque), `photos`, `photo`, `reperes` (`nouveaute`, `promo`, `vitrine`, `reseaux`), `note` et `creeLe`. `photos` est la liste des photos (6 au plus, la principale en premier) ; `photo` reprend la principale, et une pièce qui n'a que `photo` est lue comme une pièce à une photo. Une photo est l'identifiant d'un fichier envoyé depuis la page (stockage de la page), ou le chemin d'une image publiée avec elle (`images/…jpg`). Les fichiers qu'une pièce n'utilise plus (photo retirée, pièce supprimée) sont effacés du stockage.

Garde-robe, suite : `tenues/<id>` (`nom`, `pieces` : liste d'identifiants de pièces, `description`, `favori`, `vitrine`, `reseaux`, `creeLe`, `modifieLe`) ; `comparaisons/<id>` (`type` : `pieces` ou `tenues`, `elements`, `nom`, `favori`, `vitrine`, `reseaux`, `creeLe`) ; `demandes/<id>` (`quoi`, `categorie`, `nombre`, `derniereLe`, `statut` : `a-proposer`, `propose`, `commande` ou `refuse`, `creeLe`).

## Publier

`outils/version-artefact.sh site/index.html > site-axel.html`, puis publier `site-axel.html` sur la même adresse, avec les capacités `db` (écriture réservée au propriétaire), `user`, `assets` (envoi des photos) et `sample` avec les images (descriptions de tenues et remplissage des fiches par Claude).

`outils/importer-fiches.py DOSSIER LIEN…` prépare des pièces à partir de liens d'articles : `fiches.json`, les photos (900 px, JPEG) et une planche numérotée par article pour choisir les photos et leur ordre. Les photos s'envoient ensuite dans le stockage de la page, et chaque pièce s'écrit dans `pieces/<id>` avec la liste des identifiants dans `photos` et `photo`.

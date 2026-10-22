# Instructions pour Claude

## Base de données NBA 2026-27 : « remplis la nuit »

L'artefact est https://claude.ai/artifact/6iJEbW2tLmKX8R2jFa2uPx. Sa base a deux collections, avec un document par match dans chacune. L'id est `AAAA-MM-JJ_EXT-DOM`, où la date est la nuit NBA, c'est-à-dire la date du match à New York.

- `matchs` (chargée par la page) : `date` (nuit NBA), `debut` (coup d'envoi, UTC), `dom`, `ext`, `qtDom`, `qtExt`, `otDom`, `otExt`, `cotes` (DraftKings d'avant-match : `ecartDom`, `total`, `mlDom`, `mlExt` en cotes décimales), `schema` (2), `joueurs` (`nom`, `equipe`, `titulaire`, `min` en minutes décimales, `pts`, `reb`, `ast`, `stl`, `blk`, `tp` et `tpa` pour les 3 pts réussis et tentés, `tov`, `fgm`, `fga`, `ftm`, `fta`, `oreb`, `dreb`, `pf`, `pm`).
- `programme` (un document par nuit à venir, id `AAAA-MM-JJ`, pour ce soir, demain et après-demain) : matchs de la nuit avec heure de début, cotes DraftKings (bookmaker américain, vu par ESPN) du vainqueur, du handicap et du total, probabilités sans marge (`proba`), blessés du jour. C'est la référence de l'onglet Value.
- `pronostics` : pronostics évalués par Claude dans l'onglet Value (`intitule`, `match`, `condition`, `probabilite`, `cote_juste`, `fiabilite`, `mise_pct`, `raison`, `decision` joue|passe, `resultat`).
- `paris` : paris de l'utilisateur (`intitule`, `match`, `condition`, `mise_pct`, `mise_eur`, `palier`, `cote` Winamax, `statut` en_attente|gagne|perdu|rembourse, `gain`, `cote_cloture` et `clv` = écart avec la cote juste du marché juste avant le match, `hors_strategie` et `alertes` si l'utilisateur a passé outre les règles).
- `reglages/bankroll` : `depart` 1000 €, `pas` 250 €, `mises` 0.5 à 3 %, `seuil` 0.05, `seuilFaible` 0.10, `plafondMatch` 3 %, `plafondNuit` 10 %, `parisNuit` 5. Bankroll = départ + gains des paris réglés. La mise vaut un % du palier : 1 000 € jusqu'à 1 249 €, puis 1 250 €, 1 500 €… (750 €, 500 € en dessous).
- `details` (lue à la demande) : par joueur, `periodes` (une ligne par quart-temps et prolongation, colonnes dans `colonnes`), `avance` (TS%, usage, ratings…) et `gmsc` ; par équipe, `totaux`, `periodes`, `avance`, `facteurs` (rythme, four factors) et `espn` (raquette, contre-attaque, points sur balles perdues, techniques…) ; `deroule` (premiers points et premier panier du match et de chaque quart-temps, course aux X points, plus gros écart, plus longue série, changements de leader, égalités, temps en tête) ; `absents` ; `blessures_espn` ; `cotes` ; `infos` (salle, ville, affluence, durée, arbitres).

L'utilisateur raisonne en heure de Paris. « Cette nuit », le matin, désigne la nuit NBA de la veille : un match à 1h00 le 22/10 à Paris appartient à la nuit NBA du 21/10.

Chaque matin (tâche planifiée vers 8h45, ou quand l'utilisateur demande de remplir les stats de la nuit) :

1. Lis la base : `ArtifactData` `list` (limit 1000) sur `matchs`, `details`, `paris`, `pronostics`, `reglages` et `programme`, avec le même `out_dir` dans le scratchpad. Note la version de chaque document.
2. Lance `python3 -I outils/nba/remplir_nuit.py <scratchpad>/nba <out_dir>`. Sans date, il prend la nuit NBA d'hier. Pour une autre nuit, ajoute `AAAAMMJJ`.
3. Écris les fichiers de `<scratchpad>/nba/<AAAAMMJJ>/a_ecrire/matchs/` dans `matchs` et ceux de `a_ecrire/details/` dans `details`, avec `ArtifactData` `batch` (`set`, et `if_version` = la version lue pour un document qui existe déjà). Un batch prend au plus 50 écritures et 1 Mo : découpe si besoin.
4. Relis `matchs` et `details` et relance le script : il doit trouver 0 match à écrire.
5. Lance `python3 -I outils/nba/resoudre_paris.py <scratchpad>/nba <out_dir>` et écris `resolution/a_ecrire/paris/` et `.../pronostics/` (`set` avec `if_version`). Pour chaque ligne « À TRANCHER », lis les données du match (`matchs`, `details`), décide gagné, perdu ou remboursé, et écris le document toi-même (`statut`, `gain` = mise × (cote − 1) si gagné, − mise si perdu, 0 si remboursé, `valeur`, `resolu`, `note` qui dit que tu as tranché).
6. Lance `python3 -I outils/nba/programme_soir.py <scratchpad>/nba <out_dir>` (avec `<out_dir>`, un match commencé garde ses dernières cotes d'avant-match, la référence de clôture) et écris chaque fichier de `<scratchpad>/nba/programme/` dans `programme` (ce soir, demain et après-demain ; les cotes DraftKings ne sont en général publiées qu'un à deux jours avant le match).
7. Réponds avec :
   - le tableau des matchs (heure de Paris, match, score) ;
   - le nombre de valeurs comparées à ESPN ;
   - les désaccords entre sites et la valeur retenue ;
   - les corrections faites sur des matchs déjà en base ;
   - les matchs non écrits et pourquoi ;
   - les paris réglés (gagné, perdu, remboursé, gain, écart à la clôture), la bankroll et la valeur de 1 % ;
   - les pronostics de Claude réglés, joués ou non.

Chaque soir (tâche planifiée vers 23h10) : relis `programme`, lance `programme_soir.py` et réécris les programmes des 3 prochaines nuits (cotes et blessés mis à jour). Réponds en une ou deux lignes : nombre de matchs, et ce qui a bougé (cote d'un favori, joueur déclaré absent).

Règles fixées par l'utilisateur :

- **Désaccords :** Basketball-Reference fait foi en cas de désaccord avec ESPN. Applique-le sans demander, et signale chaque désaccord dans la réponse. L'utilisateur l'a vérifié lui-même sur l'app NBA : Norman Powell, 2 interceptions, et Tobe Awaka, 0, le 21/10.
- **Vérification :** l'utilisateur ne vérifie plus les stats lui-même. N'écris jamais un match qui n'a pas passé les contrôles bloquants du script : feuille Basketball-Reference présente, points des joueurs égaux au score, minutes égales à 240 plus 25 par prolongation. Dans ce cas, dis-le et n'invente rien. Si les lignes d'un quart-temps ne font pas le score de ce quart-temps, le script ne garde pas les quarts-temps des joueurs de cette équipe pour ce match : signale-le.
- **Value :** la probabilité vient de la base de l'utilisateur, pas des cotes (son choix). La page la calcule (`probaBase` dans `nba/index.html`) : pour une équipe, points marqués et encaissés ramenés vers la moyenne de la ligue tant qu'il y a peu de matchs, avantage du terrain, back-to-back ; pour un joueur, moyenne et écart-type de la stat, probabilité ramenée vers 50 % avec peu de matchs. Claude ne peut l'ajuster que de 5 points, pour ce que la base ne voit pas (un absent ce soir), et le dit. Le marché DraftKings n'est affiché que pour comparaison. Fiabilité : faible sous 5 matchs, moyenne de 5 à 14, bonne à partir de 15. Claude choisit la mise parmi 0,5 à 3 %.
- **Stratégie (validée par l'utilisateur) :** 1. double value : la cote Winamax doit dépasser la cote juste de la base et celle du marché quand il existe ; 2. value d'au moins 5 % selon la base (10 % en fiabilité faible) ; 3. un seul pari par idée et par match (même marché, quel que soit le côté ou la ligne) ; 4. au plus 3 % de mise sur un match, 10 % et 5 paris sur une nuit ; 5. pas de combinés ; 6. 0,5 % par pari tant que les équipes ont moins d'une dizaine de matchs ; 7. suivre l'écart à la clôture et faire le bilan après 100 paris. La page applique 1 à 4 : chaque carte donne la cote minimale à demander, et Mes paris prévient puis marque « hors stratégie » un pari qui les enfreint.
- **Winamax :** son site refuse les connexions des serveurs de Claude (situés aux États-Unis). Claude ne lit pas ses cotes et ne place aucun pari : l'utilisateur saisit lui-même la cote Winamax.
- **Tout récupérer :** l'utilisateur veut toutes les stats disponibles, même rarement utiles. Si une source propose une donnée de plus, ajoute-la à `details`.
- **Matchs déjà en base :** un match déjà en base qui diffère de Basketball-Reference est corrigé, et les changements sont listés dans la réponse.
- **Noms des joueurs :** un joueur garde la même orthographe d'un match à l'autre. Le script reprend celle des autres matchs de la base.
- **Sources :** NBA.com refuse les connexions des serveurs de Claude, ce qui est normal. Les sources sont ESPN (programme, heures, scores) et Basketball-Reference (feuilles de match). Basketball-Reference accepte une vingtaine de pages par minute, et le script attend entre deux pages.
- **Corrections de la NBA :** la NBA corrige parfois ses stats quelques jours après un match. Si l'utilisateur le demande, relance le script sur une nuit passée pour reprendre ces corrections.

## Publier la page de la base NBA

La source est `nba/index.html`. Pour la publier, lance `outils/version-artefact-nba.sh > <scratchpad>/base-nba.html`, puis publie ce fichier avec `url` = l'artefact ci-dessus. Les capacités sont `db` (`rules: [{path: "", read: "view", write: "admin"}]`), `user`, `downloads` et `sample`. Dans claude.ai, la page ne doit jamais réécrire son adresse (pas de `history.replaceState` ni de `pushState`).

# Instructions pour Claude

## Base de données NBA 2026-27 : « remplis la nuit »

L'artefact est https://claude.ai/artifact/6iJEbW2tLmKX8R2jFa2uPx. Sa base a deux collections, avec un document par match dans chacune. L'id est `AAAA-MM-JJ_EXT-DOM`, où la date est la nuit NBA, c'est-à-dire la date du match à New York.

- `matchs` (chargée par la page) : `date` (nuit NBA), `debut` (coup d'envoi, UTC), `dom`, `ext`, `qtDom`, `qtExt`, `otDom`, `otExt`, `cotes` (DraftKings d'avant-match : `ecartDom`, `total`, `mlDom`, `mlExt` en cotes décimales), `schema` (2), `joueurs` (`nom`, `equipe`, `titulaire`, `min` en minutes décimales, `pts`, `reb`, `ast`, `stl`, `blk`, `tp` et `tpa` pour les 3 pts réussis et tentés, `tov`, `fgm`, `fga`, `ftm`, `fta`, `oreb`, `dreb`, `pf`, `pm`).
- `details` (lue à la demande) : par joueur, `periodes` (une ligne par quart-temps et prolongation, colonnes dans `colonnes`), `avance` (TS%, usage, ratings…) et `gmsc` ; par équipe, `totaux`, `periodes`, `avance`, `facteurs` (rythme, four factors) et `espn` (raquette, contre-attaque, points sur balles perdues, techniques…) ; `deroule` (premiers points et premier panier du match et de chaque quart-temps, course aux X points, plus gros écart, plus longue série, changements de leader, égalités, temps en tête) ; `absents` ; `blessures_espn` ; `cotes` ; `infos` (salle, ville, affluence, durée, arbitres).

L'utilisateur raisonne en heure de Paris. « Cette nuit », le matin, désigne la nuit NBA de la veille : un match à 1h00 le 22/10 à Paris appartient à la nuit NBA du 21/10.

Chaque matin, quand l'utilisateur demande de remplir les stats de la nuit :

1. Lis la base : `ArtifactData` `list` sur `matchs`, puis sur `details` (limit 1000), avec le même `out_dir` dans le scratchpad. Note la version de chaque document.
2. Lance `python3 -I outils/nba/remplir_nuit.py <scratchpad>/nba <out_dir>`. Sans date, il prend la nuit NBA d'hier. Pour une autre nuit, ajoute `AAAAMMJJ`.
3. Écris les fichiers de `<scratchpad>/nba/<AAAAMMJJ>/a_ecrire/matchs/` dans `matchs` et ceux de `a_ecrire/details/` dans `details`, avec `ArtifactData` `batch` (`set`, et `if_version` = la version lue pour un document qui existe déjà). Un batch prend au plus 50 écritures et 1 Mo : découpe si besoin.
4. Relis la base et relance le script : il doit trouver 0 match à écrire.
5. Réponds avec :
   - le tableau des matchs (heure de Paris, match, score) ;
   - le nombre de valeurs comparées à ESPN ;
   - les désaccords entre sites et la valeur retenue ;
   - les corrections faites sur des matchs déjà en base ;
   - les matchs non écrits et pourquoi.

Règles fixées par l'utilisateur :

- **Désaccords :** Basketball-Reference fait foi en cas de désaccord avec ESPN. Applique-le sans demander, et signale chaque désaccord dans la réponse. L'utilisateur l'a vérifié lui-même sur l'app NBA : Norman Powell, 2 interceptions, et Tobe Awaka, 0, le 21/10.
- **Vérification :** l'utilisateur ne vérifie plus les stats lui-même. N'écris jamais un match qui n'a pas passé les contrôles bloquants du script : feuille Basketball-Reference présente, points des joueurs égaux au score, minutes égales à 240 plus 25 par prolongation. Dans ce cas, dis-le et n'invente rien. Si les lignes d'un quart-temps ne font pas le score de ce quart-temps, le script ne garde pas les quarts-temps des joueurs de cette équipe pour ce match : signale-le.
- **Tout récupérer :** l'utilisateur veut toutes les stats disponibles, même rarement utiles. Si une source propose une donnée de plus, ajoute-la à `details`.
- **Matchs déjà en base :** un match déjà en base qui diffère de Basketball-Reference est corrigé, et les changements sont listés dans la réponse.
- **Noms des joueurs :** un joueur garde la même orthographe d'un match à l'autre. Le script reprend celle des autres matchs de la base.
- **Sources :** NBA.com refuse les connexions des serveurs de Claude, ce qui est normal. Les sources sont ESPN (programme, heures, scores) et Basketball-Reference (feuilles de match). Basketball-Reference accepte une vingtaine de pages par minute, et le script attend entre deux pages.
- **Corrections de la NBA :** la NBA corrige parfois ses stats quelques jours après un match. Si l'utilisateur le demande, relance le script sur une nuit passée pour reprendre ces corrections.

## Publier la page de la base NBA

La source est `nba/index.html`. Pour la publier, lance `outils/version-artefact-nba.sh > <scratchpad>/base-nba.html`, puis publie ce fichier avec `url` = l'artefact ci-dessus. Les capacités sont `db` (`rules: [{path: "", read: "view", write: "admin"}]`), `user`, `downloads` et `sample`. Dans claude.ai, la page ne doit jamais réécrire son adresse (pas de `history.replaceState` ni de `pushState`).

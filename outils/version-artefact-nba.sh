#!/bin/sh
# Produit la version publiée du Carnet NBA comme artefact claude.ai : nba/index.html sans doctype,
# html, head, body ni meta charset/viewport, que le visualiseur ajoute lui-même.
# Usage : outils/version-artefact-nba.sh > carnet-nba.html
set -eu
cd "$(dirname "$0")/.."
grep -vE '^(<!doctype html>|<html lang="fr">|</html>|<head>|</head>|<body>|</body>|<meta charset="utf-8">|<meta name="viewport".*>)$' nba/index.html

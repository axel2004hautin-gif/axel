#!/bin/sh
# Produit la version publiée comme artefact claude.ai : la page sans doctype, html, head,
# body ni meta, que le visualiseur ajoute lui-même.
# Usage : outils/version-artefact.sh > garde-robe-blue-box.html        (la garde-robe, index.html)
#         outils/version-artefact.sh site/index.html > site-axel.html  (le site perso)
set -eu
cd "$(dirname "$0")/.."
grep -vE '^(<!doctype html>|<html lang="fr">|</html>|<head>|</head>|<body>|</body>|<meta charset="utf-8">|<meta name="viewport".*>)$' "${1:-index.html}"

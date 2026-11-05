#!/bin/sh
# Produit la version publiée comme artefact claude.ai : une page index.html sans doctype, html,
# head, body ni meta, que le visualiseur ajoute lui-même.
# Usage : outils/version-artefact.sh > garde-robe-blue-box.html
#         outils/version-artefact.sh bourse/index.html > boussole-bourse.html
set -eu
cd "$(dirname "$0")/.."
grep -vE '^(<!doctype html>|<html lang="fr">|</html>|<head>|</head>|<body>|</body>|<meta charset="utf-8">|<meta name="viewport".*>)$' "${1:-index.html}"

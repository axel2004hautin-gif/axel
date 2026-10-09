#!/bin/sh
# Produit la version publiée comme artefact claude.ai : index.html sans doctype, html, head,
# body ni meta, que le visualiseur ajoute lui-même.
# Usage : outils/version-artefact.sh > garde-robe-blue-box.html
set -eu
cd "$(dirname "$0")/.."
grep -vE '^(<!doctype html>|<html lang="fr">|</html>|<head>|</head>|<body>|</body>|<meta charset="utf-8">|<meta name="viewport".*>)$' index.html

#!/usr/bin/env python3
"""Prépare des fiches de la garde-robe à partir de liens d'articles (sites Shopify, comme teddy-smith.com).

    python3 outils/importer-fiches.py DOSSIER LIEN [LIEN…] [--photos 3]

Pour chaque lien, lit la fiche publique de l'article (`<lien>.js`) : titre, marque, type, coupe, matière,
couleur, prix, référence et photos. Écrit dans DOSSIER :
- `fiches.json` : une entrée par article, `{lien, piece, images}` ; `piece` a les champs d'un document
  `pieces/<id>` (sans `photos`), `images` les chemins des photos préparées ;
- les photos, en JPEG de 900 px au plus, sur fond blanc ;
- une planche par article (`article-NN-planche.jpg`), les photos numérotées côte à côte, pour choisir
  lesquelles garder et laquelle mettre en premier (le produit seul plutôt que porté).

Il reste à envoyer les photos dans le stockage de la page, puis à écrire chaque pièce avec la liste des
identifiants des photos dans `photos` (la première est la principale) et dans `photo`.
"""
import html
import io
import json
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw

CATEGORIES = [
    (r"pantalons?|chinos?|cargos?|joggings?", "pantalons"),
    (r"jeans?", "jeans"),
    (r"pulls?|pull-overs?|pullovers?|gilets?|cardigans?|mailles?", "pulls"),
    (r"t-?shirts?|tee-?shirts?|tees?|debardeurs?", "t-shirts"),
    (r"chemises?", "chemises"),
    (r"vestes?|blazers?|surchemises?", "vestes"),
    (r"blousons?|doudounes?|bombers?|coupe-vents?|perfectos?", "blousons"),
    (r"manteaux|manteau|parkas?|cabans?|trenchs?|pardessus", "manteaux"),
    (r"chaussures?|baskets?|sneakers?|boots?|bottines?|mocassins?", "chaussures"),
    (r"sweats?|sweat-shirts?|sweatshirts?|hoodies?", "sweats"),
    (r"polos?", "polos"),
    (r"shorts?|bermudas?", "shorts"),
    (r"accessoires?|casquettes?|bonnets?|ceintures?|echarpes?|sacs?|chaussettes?|portefeuilles?", "accessoires"),
]
# Les noms de couleur des marques (souvent en anglais) vers les nuances du nuancier de la page.
COULEURS = {
    "black": "Noir", "white": "Blanc", "middle white": "Blanc", "optic white": "Blanc", "off white": "Blanc cassé",
    "ivory": "Ivoire", "cream": "Crème", "ecru": "Écru", "grey": "Gris", "gray": "Gris", "light grey": "Gris clair",
    "dark grey": "Anthracite", "heather grey": "Gris chiné", "grey melange": "Gris chiné", "charcoal": "Gris charbon",
    "navy": "Bleu marine", "navy blue": "Bleu marine", "dark navy": "Bleu nuit", "blue": "Bleu", "light blue": "Bleu clair",
    "sky blue": "Bleu ciel", "royal blue": "Bleu roi", "dark blue": "Bleu marine", "us navy": "Bleu marine", "bleu us navy": "Bleu marine", "raw": "Bleu brut", "stone": "Bleu stone",
    "green": "Vert", "dark green": "Vert sapin", "bottle green": "Vert bouteille", "khaki": "Kaki", "olive": "Vert olive",
    "sage": "Vert sauge", "mint": "Vert menthe", "red": "Rouge", "burgundy": "Bordeaux", "wine": "Lie de vin", "pink": "Rose",
    "yellow": "Jaune", "mustard": "Moutarde", "rust": "Rouille", "brown": "Marron", "dark brown": "Chocolat",
    "chocolate": "Chocolat", "tan": "Camel", "sand": "Sable", "purple": "Violet", "lilac": "Lilas", "lavender": "Lavande",
    "beige": "Beige", "camel": "Camel", "taupe": "Taupe", "orange": "Orange", "indigo": "Indigo", "anthracite": "Anthracite",
}


def sans_accents(texte):
    return "".join(c for c in unicodedata.normalize("NFD", texte or "") if unicodedata.category(c) != "Mn").lower()


def categorie_de(*textes):
    for texte in textes:
        mots = re.split(r"[\s/]+", sans_accents(texte))
        for mot in mots:
            for motif, cat in CATEGORIES:
                if re.fullmatch(motif, mot):
                    return cat
    return ""


def couleur_de(nom):
    nom = re.sub(r"\s+\w*\d\w*$", "", (nom or "").strip())   # « Cream 230 », « Vert nacre 417W » : sans le code couleur
    cle = sans_accents(nom)
    if cle in COULEURS:
        return COULEURS[cle]
    return nom[:1].upper() + nom[1:].lower() if nom else ""


def lire_description(description):
    texte = re.sub(r"<style.*?</style>", "", description or "", flags=re.S)
    texte = re.sub(r"</?(strong|b|em|i|span|a)\b[^>]*>", "", texte)   # dans la ligne
    texte = html.unescape(re.sub(r"<[^>]+>", "\n", texte))
    champs = {}
    for ligne in texte.splitlines():
        m = re.match(r"\s*([A-Za-zÀ-ÿ ]+?)\s*:\s*(.+?)\s*$", ligne)
        if m and len(m.group(1)) <= 20:
            champs.setdefault(sans_accents(m.group(1)), m.group(2))
    return champs


def lire(url):
    adresse = url.split("?")[0].rstrip("/")
    with urllib.request.urlopen(urllib.request.Request(adresse + ".js", headers={"User-Agent": "Mozilla/5.0"}), timeout=30) as r:
        return adresse, json.load(r)


def preparer_photo(src, chemin):
    src = ("https:" + src) if src.startswith("//") else src
    src += ("&" if "?" in src else "?") + "width=1200"
    with urllib.request.urlopen(urllib.request.Request(src, headers={"User-Agent": "Mozilla/5.0"}), timeout=60) as r:
        image = Image.open(io.BytesIO(r.read()))
    image.thumbnail((900, 900))
    if image.mode in ("RGBA", "LA", "P"):
        image = image.convert("RGBA")
        fond = Image.new("RGB", image.size, "white")
        fond.paste(image, mask=image.split()[-1])
        image = fond
    image.convert("RGB").save(chemin, "JPEG", quality=86)


def planche(images, chemin):
    vignettes = [Image.open(i) for i in images]
    for v in vignettes:
        v.thumbnail((300, 300))
    feuille = Image.new("RGB", (310 * len(vignettes) + 10, 320), "white")
    dessin = ImageDraw.Draw(feuille)
    for k, v in enumerate(vignettes):
        feuille.paste(v, (10 + 310 * k, 10))
        dessin.rectangle((10 + 310 * k, 10, 40 + 310 * k, 40), fill="#172a55")
        dessin.text((20 + 310 * k, 18), str(k + 1), fill="white")
    feuille.save(chemin, "JPEG", quality=80)


def main():
    args = sys.argv[1:]
    nb_photos = 7
    if "--photos" in args:
        i = args.index("--photos")
        nb_photos = int(args[i + 1])
        del args[i:i + 2]
    if len(args) < 2:
        sys.exit(__doc__)
    dossier, liens = Path(args[0]), args[1:]
    dossier.mkdir(parents=True, exist_ok=True)
    fiches = []
    for n, lien in enumerate(liens, 1):
        try:
            adresse, d = lire(lien)
        except Exception as e:   # pas une fiche Shopify, ou site injoignable
            print(f"{lien} : illisible ({e})", file=sys.stderr)
            continue
        champs = lire_description(d.get("description"))
        coupe = champs.get("coupe", "").strip()
        matiere = re.sub(r"(\d)\s*%", r"\1 %", champs.get("matiere", "")).strip()
        matiere = matiere[:1].upper() + matiere[1:].lower()   # « 100 % Coton » → « 100 % coton »
        # Les promos du site ne valent pas en magasin : toujours le prix normal.
        prix, barre = d.get("price"), d.get("compare_at_price")
        promo = isinstance(barre, int) and isinstance(prix, int) and barre > prix
        ref = next((t for t in d.get("tags", []) if re.fullmatch(r"\d{6,}[A-Z0-9]*", t)), "")   # 11018388D, 10117266DL32
        piece = {
            "marque": (d.get("vendor") or "")[:60] or None,
            "categorie": categorie_de(d.get("type", ""), d.get("title", ""), d.get("handle", "").replace("-", " ")) or None,
            "modele": (d.get("title") or "")[:120] or None,
            "coupe": coupe[:120] or None,
            "couleur": couleur_de(champs.get("couleur") or champs.get("coloris", ""))[:60] or None,
            "matiere": matiere[:120] or None,
            "rayon": "homme",
            "prix": round((barre if promo else prix) / 100, 2) if isinstance(prix, int) else None,
            "ref": ref or None,
            "lien": adresse,
            "reperes": {"nouveaute": False, "promo": False, "vitrine": False, "reseaux": False},
            "note": None,
            "creeLe": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        }
        images = []
        for k, src in enumerate(d.get("images", [])[:nb_photos], 1):
            chemin = dossier / f"article-{n:02d}-photo-{k}.jpg"
            try:
                preparer_photo(src, chemin)
                images.append(str(chemin))
            except Exception as e:
                print(f"{lien} : photo {k} illisible ({e})", file=sys.stderr)
        if images:
            planche(images, dossier / f"article-{n:02d}-planche.jpg")
        fiches.append({"lien": adresse, "piece": piece, "images": images})
        print(f"{n}. {piece['marque']} · {piece['modele']} · {piece['couleur']} · {piece['coupe']} · {piece['matiere']} · {piece['prix']} € · {len(images)} photos")
    (dossier / "fiches.json").write_text(json.dumps(fiches, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()

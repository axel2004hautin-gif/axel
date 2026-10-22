#!/usr/bin/env python3
"""Découpe la photo du modèle (site/modele/homme.webp, 400 × 600, fond blanc) en calques pour le tableau de bord :
la tête et le cou (posés par-dessus les vêtements), le buste, les jambes et les pieds (effacés quand la tenue met
une pièce à leur place). Les hauteurs de découpe sont propres à cette photo ; pour une autre photo, les repérer
et reporter les zones des vêtements dans PORTEURS (site/index.html).

Usage : python3 outils/decouper-modele.py
"""
import os
from PIL import Image

DOSSIER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "site", "modele")
TETE = (150, 35, 260, 146)     # cadre de la tête et du cou
MENTON, COU = 128, (181, 227)  # sous le menton : seulement la peau et la barbe du cou, entre ces colonnes
BUSTE, CEINTURE, CHEVILLES = 128, 306, 522


def fond_blanc(r, g, b):
    return min(r, g, b) > 244 and max(r, g, b) - min(r, g, b) < 8


def opacite_bord(r, g, b):
    """Les pixels presque blancs du bord deviennent en partie transparents (pas de liseré)."""
    clair, teinte = min(r, g, b), max(r, g, b) - min(r, g, b)
    return int(255 * (250 - clair) / 22) if clair > 228 and teinte < 12 else 255


def tete(photo):
    x0, y0, x1, y1 = TETE
    out = photo.crop(TETE).convert("RGBA")
    px = out.load()
    for y in range(y1 - y0):
        for x in range(x1 - x0):
            r, g, b, _ = px[x, y]
            yy, xx = y + y0, x + x0
            a = 0 if (min(r, g, b) > 238 and max(r, g, b) - min(r, g, b) < 10) else 255
            if yy >= MENTON:
                chaud = r > 55 and r > g > b and r - b > 22
                a = 255 if chaud and (yy < MENTON + 4 or COU[0] <= xx <= COU[1]) else 0
                if yy > 133:
                    a = int(a * max(0, (y1 - yy) / 13))
            px[x, y] = (r, g, b, a)
    return out


def bande(photo, y0, y1, garder=None):
    w, h = photo.size
    src = photo.load()
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = out.load()
    for y in range(y0, y1):
        for x in range(w):
            r, g, b = src[x, y]
            if fond_blanc(r, g, b) or (garder and not garder(x, y, r, g, b)):
                continue
            px[x, y] = (r, g, b, max(0, opacite_bord(r, g, b)))
    return out


def main():
    photo = Image.open(os.path.join(DOSSIER, "homme.webp")).convert("RGB")
    tete(photo).save(os.path.join(DOSSIER, "homme-tete.png"), optimize=True)
    bande(photo, BUSTE, CEINTURE).save(os.path.join(DOSSIER, "homme-buste.png"), optimize=True)
    # Les jambes remontent jusqu'à la ceinture, mais au-dessus seulement le bleu du jean (pas le pull ni les mains).
    bande(photo, 284, CHEVILLES, lambda x, y, r, g, b: y >= CEINTURE or b > r + 12).save(os.path.join(DOSSIER, "homme-jambes.png"), optimize=True)
    bande(photo, CHEVILLES, photo.size[1]).save(os.path.join(DOSSIER, "homme-pieds.png"), optimize=True)


if __name__ == "__main__":
    main()

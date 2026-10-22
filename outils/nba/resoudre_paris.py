"""Résout les paris et les pronostics de la Base de données NBA 2026-27 dont le match est en base.

Usage : resoudre_paris.py <dossier de travail> <dossier de la base>
  <dossier de la base> contient matchs/, details/, paris/, pronostics/ et reglages/ (un JSON par document).

Chaque pari et chaque pronostic porte une « condition » lisible par ce script :
  stat_joueur       {joueur, stat, sens: plus|moins, ligne, periode}   stat : pts, reb, ast, stl, blk, tp, tpa, tov, fgm, fga, ftm, fta,
                                                                       oreb, dreb, pf, pm, min, pra, pr, pa, ra, sb, dd, td
  victoire          {equipe}
  handicap          {equipe, ligne}                                     ligne ajoutée au score de l'équipe (ex. -3.5)
  total_match       {sens, ligne, periode}
  total_equipe      {equipe, sens, ligne, periode}
  premier_panier    {joueur}                                            premier panier réussi du match (hors lancers francs)
  premiers_points   {equipe}                                            équipe qui marque en premier
  autre             {description}                                       à trancher par Claude à la lecture des données
  periode : match (prolongations comprises), q1, q2, q3, q4, h1, h2 (prolongations comprises).
Un joueur qui n'a pas joué rend le pari remboursé, comme chez les bookmakers. Une égalité exacte avec la ligne aussi.

Écrit dans <dossier de travail>/resolution/a_ecrire/paris/ et .../pronostics/ les documents résolus (document complet,
à écrire avec set), et affiche le bilan et la bankroll.
"""
import datetime, glob, json, os, re, sys, unicodedata, zoneinfo

PARIS = zoneinfo.ZoneInfo("Europe/Paris")
norm = lambda s: re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().lower())
COMPOSITES = {"pra": ("pts", "reb", "ast"), "pr": ("pts", "reb"), "pa": ("pts", "ast"), "ra": ("reb", "ast"), "sb": ("stl", "blk")}


def load_dir(path):
    return {os.path.basename(f)[:-5]: json.load(open(f)) for f in glob.glob(path + "/*.json")}


def team_pts(m, side, per):
    q, ot = (m["qtDom"], m.get("otDom") or 0) if side == "dom" else (m["qtExt"], m.get("otExt") or 0)
    return {"match": sum(q) + ot, "q1": q[0], "q2": q[1], "q3": q[2], "q4": q[3], "h1": q[0] + q[1], "h2": q[2] + q[3] + ot}[per]


def stat_of(line, stat):
    g = lambda k: line.get(k) or 0
    if stat in COMPOSITES:
        return sum(g(k) for k in COMPOSITES[stat])
    if stat in ("dd", "td"):
        n = sum(1 for k in ("pts", "reb", "ast", "stl", "blk") if g(k) >= 10)
        return 1 if n >= (2 if stat == "dd" else 3) else 0
    v = line.get(stat)
    return None if v is None else v


def player_period_line(det, team, nom, per):
    """Ligne d'un joueur sur une période, depuis « details ». None si les quarts-temps de l'équipe manquent."""
    if not det or not (det.get("equipes", {}).get(team) or {}).get("periodes"):
        return None
    j = next((x for x in det.get("joueurs", []) if norm(x["nom"]) == norm(nom)), None)
    cols = det["colonnes"]
    keys = {"h1": ["q1", "q2"], "h2": ["q3", "q4"] + [k for k in (j or {}).get("periodes", {}) if k.startswith("ot")]}.get(per, [per])
    out = {c: 0 for c in cols}
    for k in keys:
        row = ((j or {}).get("periodes") or {}).get(k)
        if row:
            for c, v in zip(cols, row):
                out[c] += v or 0
    return out


def compare(v, sens, ligne):
    if v == ligne:
        return "rembourse"
    return "gagne" if (v > ligne) == (sens == "plus") else "perdu"


def evaluer(cond, m, det):
    """→ (résultat : gagne | perdu | rembourse | a_trancher, valeur observée, note)"""
    t = cond.get("type")
    per = cond.get("periode") or "match"
    side_of = lambda eq: "dom" if eq == m["dom"] else "ext" if eq == m["ext"] else None
    if t == "stat_joueur":
        p = next((x for x in m["joueurs"] if norm(x["nom"]) == norm(cond.get("joueur"))), None)
        if not p:
            return "rembourse", None, "joueur absent du match"
        line = p if per == "match" else player_period_line(det, p["equipe"], p["nom"], per)
        if line is None:
            return "a_trancher", None, "lignes par quart-temps indisponibles pour ce match"
        v = stat_of(line, cond.get("stat"))
        if v is None:
            return "a_trancher", None, f"stat {cond.get('stat')} indisponible"
        return compare(v, cond.get("sens"), float(cond.get("ligne"))), v, None
    if t in ("victoire", "handicap", "total_equipe"):
        s = side_of(cond.get("equipe"))
        if not s:
            return "a_trancher", None, "équipe absente de ce match"
        me, op = team_pts(m, s, per), team_pts(m, "ext" if s == "dom" else "dom", per)
        if t == "victoire":
            return ("gagne" if me > op else "perdu" if me < op else "rembourse"), f"{me}-{op}", None
        if t == "handicap":
            v = me + float(cond.get("ligne"))
            return ("gagne" if v > op else "perdu" if v < op else "rembourse"), f"{me}-{op}", None
        return compare(me, cond.get("sens"), float(cond.get("ligne"))), me, None
    if t == "total_match":
        v = team_pts(m, "dom", per) + team_pts(m, "ext", per)
        return compare(v, cond.get("sens"), float(cond.get("ligne"))), v, None
    if t in ("premier_panier", "premiers_points"):
        dr = (det or {}).get("deroule") or {}
        ev = dr.get("premier_panier" if t == "premier_panier" else "premiers_points")
        if not ev:
            return "a_trancher", None, "déroulé du match indisponible"
        if t == "premier_panier":
            if not any(norm(x["nom"]) == norm(cond.get("joueur")) for x in m["joueurs"]):
                return "rembourse", ev.get("joueur"), "joueur absent du match"
            return ("gagne" if norm(ev.get("joueur")) == norm(cond.get("joueur")) else "perdu"), ev.get("joueur"), None
        return ("gagne" if ev.get("equipe") == cond.get("equipe") else "perdu"), ev.get("equipe"), None
    return "a_trancher", None, "condition à trancher à la lecture des données"


def main():
    work, base_dir = sys.argv[1], sys.argv[2]
    matchs, details = load_dir(f"{base_dir}/matchs"), load_dir(f"{base_dir}/details")
    paris, pronos = load_dir(f"{base_dir}/paris"), load_dir(f"{base_dir}/pronostics")
    reglage = load_dir(f"{base_dir}/reglages").get("bankroll") or {}
    out = os.path.join(work, "resolution", "a_ecrire")
    for sub in ("paris", "pronostics"):
        os.makedirs(os.path.join(out, sub), exist_ok=True)
        for f in glob.glob(os.path.join(out, sub, "*.json")):
            os.remove(f)
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    today = datetime.datetime.now(PARIS).date()
    a_trancher, attente, lignes = [], [], []

    def resolve(doc, kind):
        m = matchs.get(doc.get("match"))
        if not m:
            nuit = datetime.date.fromisoformat(doc.get("nuit") or "2000-01-01")
            attente.append(f"{kind} « {doc.get('intitule')} » : match {doc.get('match')} pas encore en base" + (" (plus de 2 jours : reporté ?)" if (today - nuit).days > 2 else ""))
            return None
        res, val, note = evaluer(doc.get("condition") or {}, m, details.get(doc.get("match")))
        if res == "a_trancher":
            a_trancher.append(f"{kind} « {doc.get('intitule')} » ({doc.get('match')}) : {note}")
            return None
        return res, val, note

    for i, b in sorted(paris.items()):
        if b.get("statut") not in (None, "en_attente"):
            continue
        r = resolve(b, "pari")
        if not r:
            continue
        res, val, note = r
        mise, cote = b.get("mise_eur") or 0, b.get("cote")
        gain = round(mise * (cote - 1), 2) if res == "gagne" and cote else -mise if res == "perdu" else 0 if res == "rembourse" else None
        nb = {**b, "statut": res, "valeur": val, "gain": gain, "resolu": now, **({"note": note} if note else {})}
        if res == "gagne" and not cote:
            nb["note"] = "gagné, mais la cote n'a pas été saisie : gain non calculé"
        json.dump(nb, open(f"{out}/paris/{i}.json", "w"), ensure_ascii=False)
        paris[i] = nb
        lignes.append(f"pari « {b.get('intitule')} » : {res} ({val}) · mise {mise} € à {cote} → {gain if gain is not None else '?'} €")
    for i, p in sorted(pronos.items()):
        if p.get("resultat"):
            continue
        r = resolve(p, "pronostic")
        if not r:
            continue
        res, val, note = r
        json.dump({**p, "resultat": res, "valeur": val, "resolu": now, **({"note": note} if note else {})}, open(f"{out}/pronostics/{i}.json", "w"), ensure_ascii=False)
        lignes.append(f"pronostic « {p.get('intitule')} » ({p.get('decision') or 'sans décision'}, {round((p.get('probabilite') or 0) * 100)} %) : {res} ({val})")

    depart = reglage.get("depart", 1000)
    regles = [b for b in paris.values() if b.get("statut") in ("gagne", "perdu", "rembourse")]
    bank = round(depart + sum(b.get("gain") or 0 for b in regles), 2)
    en_cours = [b for b in paris.values() if b.get("statut") in (None, "en_attente")]
    print("Résolus :" if lignes else "Aucun pari ni pronostic à résoudre.")
    for x in lignes:
        print("-", x)
    for x in a_trancher:
        print("- À TRANCHER :", x)
    for x in attente:
        print("- en attente :", x)
    g = sum(1 for b in regles if b["statut"] == "gagne"); p_ = sum(1 for b in regles if b["statut"] == "perdu")
    mises = sum(b.get("mise_eur") or 0 for b in regles if b["statut"] != "rembourse")
    print(f"Bankroll : {bank} € (départ {depart} €) · {g} gagné(s), {p_} perdu(s) · rendement "
          f"{round(100 * (bank - depart) / mises, 1) if mises else 0} % · {len(en_cours)} pari(s) en attente")
    print(f"À écrire : {len(glob.glob(out + '/paris/*.json'))} pari(s), {len(glob.glob(out + '/pronostics/*.json'))} pronostic(s) ({out})")


if __name__ == "__main__":
    main()

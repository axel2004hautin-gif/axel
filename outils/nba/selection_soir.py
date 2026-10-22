"""Sélection de 21h de la Base de données NBA 2026-27 : les paris de la nuit qui respectent la stratégie de l'utilisateur.

Usage : selection_soir.py <dossier de travail> <dossier de la base> [AAAAMMJJ]
  <dossier de la base> contient matchs/, programme/, pronostics/ et paris/ (un JSON par document).
  Sans date : la nuit NBA de ce soir (date de Paris du jour).

Pour chaque match de la nuit qui a des cotes DraftKings, on examine le vainqueur, le handicap et le total aux lignes du
marché. La probabilité vient de la base, avec le même calcul que la page (probaEquipe dans nba/index.html) ; le marché
(DraftKings sans marge) sert de garde-fou. La stratégie validée par l'utilisateur :
  1. la cote Winamax doit dépasser la cote juste de la base et celle du marché ;
  2. value d'au moins 5 % selon la base, 10 % en fiabilité faible (moins de 5 matchs) ;
  3. un seul pari par idée et par match (l'écart d'un côté, le total de l'autre) ;
  4. au plus 3 % de mise sur un match, 10 % et 5 paris sur la nuit ;
  6. 0,5 % par pari tant qu'une des deux équipes a moins de 10 matchs.
Pas de sélection sur un match tant qu'une des équipes a moins de 3 matchs en base, ni sur un pari sous 40 %.
Un pari n'est retenu que si la base est plus confiante que le marché ; la cote minimale à demander à Winamax est
max((1 + seuil) / probabilité de la base, 1 / probabilité du marché).

Écrit dans <dossier de travail>/selection-<AAAAMMJJ>/ :
  pronostics/<id>.json   les paris retenus (documents complets de la collection pronostics)
  retraits/<id>.json     les paris d'une sélection précédente qui ne passent plus (document complet, retire = true)
  selections/<AAAA-MM-JJ>.json   le résumé affiché en tête de l'onglet Value
"""
import datetime, glob, json, math, os, re, sys, zoneinfo
from statistics import NormalDist

PARIS = zoneinfo.ZoneInfo("Europe/Paris")
N = NormalDist()
MODELE = {"terrain": 2.5, "b2b": 1.5, "sigEcart": 12.5, "sigTotal": 18, "kEquipe": 5}
REGLES = {"seuil": 0.05, "seuilFaible": 0.10, "plafondMatch": 3, "plafondNuit": 10, "parisNuit": 5, "matchsPleineMise": 10, "matchsMin": 3, "probaMin": 0.40}
NOMS = {"ATL": "Atlanta Hawks", "BOS": "Boston Celtics", "BKN": "Brooklyn Nets", "CHA": "Charlotte Hornets", "CHI": "Chicago Bulls",
        "CLE": "Cleveland Cavaliers", "DAL": "Dallas Mavericks", "DEN": "Denver Nuggets", "DET": "Detroit Pistons", "GSW": "Golden State Warriors",
        "HOU": "Houston Rockets", "IND": "Indiana Pacers", "LAC": "LA Clippers", "LAL": "Los Angeles Lakers", "MEM": "Memphis Grizzlies",
        "MIA": "Miami Heat", "MIL": "Milwaukee Bucks", "MIN": "Minnesota Timberwolves", "NOP": "New Orleans Pelicans", "NYK": "New York Knicks",
        "OKC": "Oklahoma City Thunder", "ORL": "Orlando Magic", "PHI": "Philadelphia 76ers", "PHX": "Phoenix Suns", "POR": "Portland Trail Blazers",
        "SAC": "Sacramento Kings", "SAS": "San Antonio Spurs", "TOR": "Toronto Raptors", "UTA": "Utah Jazz", "WAS": "Washington Wizards"}
virg = lambda x: f"{x:g}".replace(".", ",")
day = lambda d: datetime.date.fromisoformat(d).toordinal()


def load_dir(path):
    return {os.path.basename(f)[:-5]: json.load(open(f)) for f in glob.glob(path + "/*.json")}


def pts(m, side):
    q, ot = (m["qtDom"], m.get("otDom") or 0) if side == "dom" else (m["qtExt"], m.get("otExt") or 0)
    return sum(q) + ot


def moy_ligue(ms):
    return sum(pts(m, "dom") + pts(m, "ext") for m in ms) / (2 * len(ms)) if ms else 115.0


def niveau(ms, t, avant):
    g = [m for m in ms if (m["dom"] == t or m["ext"] == t) and m["date"] < avant]
    L, k = moy_ligue(ms), MODELE["kEquipe"]
    po = sum(pts(m, "dom" if m["dom"] == t else "ext") for m in g)
    pc = sum(pts(m, "ext" if m["dom"] == t else "dom") for m in g)
    return {"n": len(g), "marques": (po + k * L) / (len(g) + k), "encaisses": (pc + k * L) / (len(g) + k)}


def repos(ms, t, nuit):
    d = sorted({m["date"] for m in ms if (m["dom"] == t or m["ext"] == t) and m["date"] < nuit})
    return day(nuit) - day(d[-1]) - 1 if d else None


def attendu(ms, ext, dom, nuit):
    """Score attendu, comme probaEquipe dans la page (match entier)."""
    D, E = niveau(ms, dom, nuit), niveau(ms, ext, nuit)
    fat = lambda r: MODELE["b2b"] if r == 0 else 0
    rD, rE = repos(ms, dom, nuit), repos(ms, ext, nuit)
    ptsD = (D["marques"] + E["encaisses"]) / 2 + MODELE["terrain"] / 2 - fat(rD)
    ptsE = (E["marques"] + D["encaisses"]) / 2 - MODELE["terrain"] / 2 - fat(rE)
    detail = (f"Score attendu {dom} {virg(round(ptsD, 1))} – {virg(round(ptsE, 1))} {ext}, d'après {D['n']} match{'s' if D['n'] > 1 else ''} "
              f"de {dom} et {E['n']} de {ext}{f', {dom} en back-to-back' if rD == 0 else ''}{f', {ext} en back-to-back' if rE == 0 else ''}.")
    return ptsD, ptsE, min(D["n"], E["n"]), detail


def mise(p, n):
    """La règle de mise de Claude (même barème que l'évaluation de l'onglet Value), plus la règle 6."""
    if n < REGLES["matchsPleineMise"] or p < 0.40:
        return 0.5
    if n < 15:
        return 1.5 if p >= 0.65 else 1.0
    if p >= 0.75:
        return 3.0
    if p >= 0.70:
        return 2.5
    return 2.0 if p >= 0.60 else 1.5


def main():
    work, base_dir = sys.argv[1], sys.argv[2]
    night = sys.argv[3] if len(sys.argv) > 3 else datetime.datetime.now(PARIS).strftime("%Y%m%d")
    nuit = f"{night[:4]}-{night[4:6]}-{night[6:]}"
    ms = list(load_dir(f"{base_dir}/matchs").values())
    prog = load_dir(f"{base_dir}/programme").get(nuit)
    pronos, paris = load_dir(f"{base_dir}/pronostics"), load_dir(f"{base_dir}/paris")
    out = os.path.join(work, f"selection-{night}")
    for sub in ("pronostics", "retraits", "selections"):
        os.makedirs(os.path.join(out, sub), exist_ok=True)
        for f in glob.glob(os.path.join(out, sub, "*.json")):
            os.remove(f)
    if not prog:
        sys.exit(f"Pas de programme pour la nuit du {nuit} : lance programme_soir.py d'abord.")
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    candidats, examines, trop_tot = [], 0, 0
    for pm in prog.get("matchs", []):
        c, p = pm.get("cotes"), pm.get("proba")
        if not c or not p or pm.get("statut") != "STATUS_SCHEDULED":
            continue
        ext, dom = pm["ext"], pm["dom"]
        ptsD, ptsE, n, detail = attendu(ms, ext, dom, nuit)
        if n < REGLES["matchsMin"]:
            trop_tot += 1
            continue
        seuil = REGLES["seuilFaible"] if n < 5 else REGLES["seuil"]
        ecart, total, s = ptsD - ptsE, ptsD + ptsE, c.get("ecartDom")
        options = []  # (idée, condition, intitulé, proba base, proba marché)
        if p.get("victoireDom") is not None:
            options += [("ecart", {"type": "victoire", "equipe": dom}, f"{NOMS[dom]} gagne contre {NOMS[ext]}", N.cdf(ecart / MODELE["sigEcart"]), p["victoireDom"]),
                        ("ecart", {"type": "victoire", "equipe": ext}, f"{NOMS[ext]} gagne à {NOMS[dom].split()[-1]}", 1 - N.cdf(ecart / MODELE["sigEcart"]), p["victoireExt"])]
        if s is not None and p.get("couvreDom") is not None:
            options += [("ecart", {"type": "handicap", "equipe": dom, "ligne": s}, f"{NOMS[dom]} {'+' if s > 0 else '−'}{virg(abs(s))} contre {NOMS[ext]}",
                         N.cdf((ecart + s) / MODELE["sigEcart"]), p["couvreDom"]),
                        ("ecart", {"type": "handicap", "equipe": ext, "ligne": -s}, f"{NOMS[ext]} {'+' if -s > 0 else '−'}{virg(abs(s))} à {NOMS[dom].split()[-1]}",
                         N.cdf((-s - ecart) / MODELE["sigEcart"]), p["couvreExt"])]
        if c.get("total") is not None and p.get("over") is not None:
            T = c["total"]; over = 1 - N.cdf((T - total) / MODELE["sigTotal"])
            options += [("total", {"type": "total_match", "sens": "plus", "ligne": T, "periode": "match"}, f"Plus de {virg(T)} points dans {NOMS[ext].split()[-1]} – {NOMS[dom].split()[-1]}", over, p["over"]),
                        ("total", {"type": "total_match", "sens": "moins", "ligne": T, "periode": "match"}, f"Moins de {virg(T)} points dans {NOMS[ext].split()[-1]} – {NOMS[dom].split()[-1]}", 1 - over, p["under"])]
        examines += len(options)
        # Règle 3 : pour chaque idée, le côté où la base dépasse le plus le marché ; la base doit être plus confiante que lui
        for idee in ("ecart", "total"):
            opts = [o for o in options if o[0] == idee and o[3] > o[4] and o[3] >= REGLES["probaMin"]]
            if not opts:
                continue
            idee_, cond, titre, pb, pmk = max(opts, key=lambda o: o[3] - o[4])
            cmin = math.ceil(max((1 + seuil) / pb, 1 / pmk) * 100) / 100
            candidats.append({"pm": pm, "idee": idee, "cond": cond, "titre": titre, "pb": pb, "pmk": pmk, "n": n, "detail": detail,
                              "cmin": cmin, "mise": mise(pb, n), "ecart": pb - pmk})

    # Règle 4 : les meilleurs écarts base / marché, dans les plafonds du match et de la nuit (paris déjà pris compris)
    deja = [b for b in paris.values() if b.get("nuit") == nuit]
    tot_nuit, nb_nuit = sum(b.get("mise_pct") or 0 for b in deja), len(deja)
    retenus = []
    for cd in sorted(candidats, key=lambda x: -x["ecart"]):
        mid = cd["pm"]["id"]
        tot_match = sum(b.get("mise_pct") or 0 for b in deja if b.get("match") == mid) + sum(r["mise"] for r in retenus if r["pm"]["id"] == mid)
        if nb_nuit + len(retenus) >= REGLES["parisNuit"] or tot_nuit + sum(r["mise"] for r in retenus) + cd["mise"] > REGLES["plafondNuit"] \
                or tot_match + cd["mise"] > REGLES["plafondMatch"]:
            continue
        retenus.append(cd)

    ids = []
    for cd in retenus:
        pm, cond = cd["pm"], cd["cond"]
        pid = f"s{nuit.replace('-', '')}-{pm['ext']}-{pm['dom']}-{cd['idee']}"
        ids.append(pid)
        old = pronos.get(pid) or {}
        if old.get("decision"):
            continue  # déjà joué ou écarté : on n'y touche plus
        fiab = "bonne" if cd["n"] >= 15 else "moyenne" if cd["n"] >= 5 else "faible"
        doc = {"cree": old.get("cree") or now, "maj": now, "source": "selection_21h", "nuit": nuit, "match": pm["id"], "ext": pm["ext"], "dom": pm["dom"],
               "debut": pm.get("debut"), "intitule": cd["titre"], "demande": "Sélection de 21h", "condition": cond,
               "probabilite": round(cd["pb"], 3), "proba_base": round(cd["pb"], 3), "ajustement": 0, "n_matchs": cd["n"], "detail": cd["detail"],
               "marche": round(cd["pmk"], 3), "cote_juste": round(1 / cd["pb"], 2), "cote_min": cd["cmin"], "fiabilite": fiab, "mise_pct": cd["mise"],
               "raison": f"Ta base donne {virg(round(cd['pb'] * 100, 1))} %, le marché {virg(round(cd['pmk'] * 100, 1))} %. À jouer seulement si Winamax paie au moins {virg(cd['cmin'])}.",
               "decision": None, "resultat": None}
        json.dump(doc, open(os.path.join(out, "pronostics", f"{pid}.json"), "w"), ensure_ascii=False)

    # Paris d'une sélection précédente de la même nuit qui ne passent plus (cotes ou blessés ont bougé)
    for pid, pr in pronos.items():
        if pr.get("source") == "selection_21h" and pr.get("nuit") == nuit and pid not in ids and not pr.get("decision") and not pr.get("retire"):
            json.dump({**pr, "retire": True, "maj": now, "raison_retrait": "Ne passe plus la stratégie avec les dernières cotes."},
                      open(os.path.join(out, "retraits", f"{pid}.json"), "w"), ensure_ascii=False)

    resume = {"nuit": nuit, "maj": now, "examines": examines, "matchs": sum(1 for m in prog.get("matchs", []) if m.get("cotes") and m.get("statut") == "STATUS_SCHEDULED"),
              "pronostics": ids, "trop_tot": trop_tot,
              "note": "" if ids else ("Pas encore assez de matchs dans ta base : il en faut au moins 3 par équipe pour proposer un pari." if trop_tot and trop_tot == sum(1 for m in prog.get("matchs", []) if m.get("cotes") and m.get("statut") == "STATUS_SCHEDULED")
                                      else "Rien de jouable ce soir : sur aucun match la base n'est assez confiante face au marché, dans les règles de la stratégie.")}
    json.dump(resume, open(os.path.join(out, "selections", f"{nuit}.json"), "w"), ensure_ascii=False)
    print(f"Sélection de la nuit du {nuit} : {len(ids)} pari(s) sur {resume['matchs']} match(s), {examines} paris examinés, {trop_tot} match(s) écarté(s) faute de matchs en base"
          + (f" — {resume['note']}" if resume["note"] else ""))
    for cd in retenus:
        d = datetime.datetime.fromisoformat(cd["pm"]["debut"].replace("Z", "+00:00")).astimezone(PARIS)
        print(f"- {d:%Hh%M} {cd['titre']} : base {cd['pb']:.1%}, marché {cd['pmk']:.1%} → mise {virg(cd['mise'])} %, "
              f"seulement si Winamax ≥ {virg(cd['cmin'])} ({cd['n']} matchs)")
    print(f"À écrire : {out}")


if __name__ == "__main__":
    main()

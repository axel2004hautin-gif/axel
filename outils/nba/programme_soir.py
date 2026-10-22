"""Programme des prochaines nuits NBA, pour l'onglet Value de la Base de données NBA 2026-27.

Usage : programme_soir.py <dossier de travail> [<dossier de la base>] [AAAAMMJJ] [--nuits N]
  Sans date : à partir de la nuit NBA de ce soir (date de Paris du jour). N nuits (3 par défaut) :
  ce soir, demain et après-demain. Les cotes n'apparaissent en général qu'un à deux jours avant le match.
  <dossier de la base> (facultatif) contient matchs/ : les noms des blessés y reprennent l'orthographe de la base.

Pour chaque match, ESPN donne les cotes du bookmaker américain DraftKings (vainqueur, handicap, total) pour les deux
côtés de chaque pari. On en retire la marge du bookmaker pour obtenir la probabilité estimée par le marché.
ESPN donne aussi la liste des blessés et leur statut.

Écrit <dossier de travail>/programme/<AAAA-MM-JJ>.json pour chaque nuit, documents de la collection « programme ».
"""
import datetime, glob, json, os, re, subprocess, sys, unicodedata, zoneinfo

ESPN2BASE = {"NY": "NYK", "SA": "SAS", "GS": "GSW", "NO": "NOP", "UTAH": "UTA", "WSH": "WAS"}
PARIS = zoneinfo.ZoneInfo("Europe/Paris")
norm = lambda s: re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower())
decimal_odds = lambda us: None if us in (None, 0) else round(1 + (us / 100 if us > 0 else 100 / -us), 3)


def curl_json(url):
    out = subprocess.run(["curl", "-sS", "--max-time", "30", "-w", "\n%{http_code}", url], capture_output=True, text=True).stdout
    body, _, code = out.rpartition("\n")
    if code != "200":
        raise SystemExit(f"HTTP {code or 'erreur'} : {url}")
    return json.loads(body)


def sans_marge(a, b):
    """Deux cotes décimales d'un même pari → probabilités sans la marge du bookmaker."""
    if not a or not b:
        return None, None
    pa, pb = 1 / a, 1 / b
    return round(pa / (pa + pb), 4), round(pb / (pa + pb), 4)


def main():
    args = sys.argv[1:]
    n_nuits = 3
    if "--nuits" in args:
        i = args.index("--nuits"); n_nuits = int(args[i + 1]); del args[i:i + 2]
    work = args[0]
    base_dir = args[1] if len(args) > 1 and not re.fullmatch(r"\d{8}", args[1]) else None
    start = next((a for a in args[1:] if re.fullmatch(r"\d{8}", a)), datetime.datetime.now(PARIS).strftime("%Y%m%d"))
    first = datetime.date(int(start[:4]), int(start[4:6]), int(start[6:]))
    known = {}
    if base_dir:
        for f in glob.glob(os.path.join(base_dir, "matchs", "*.json")):
            for p in json.load(open(f)).get("joueurs", []):
                known.setdefault(norm(p["nom"]), p["nom"])
    out = os.path.join(work, "programme")
    os.makedirs(out, exist_ok=True)
    for k in range(n_nuits):
        nuit(out, (first + datetime.timedelta(days=k)).strftime("%Y%m%d"), known, base_dir)


def nuit(out, night, known, base_dir=None):
    date_ny = f"{night[:4]}-{night[4:6]}-{night[6:]}"
    sb = curl_json(f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates={night}")
    matchs = []
    for e in sb.get("events", []):
        c = e["competitions"][0]
        t = {x["homeAway"]: x for x in c["competitors"]}
        ab = lambda x: ESPN2BASE.get(x["team"]["abbreviation"], x["team"]["abbreviation"])
        ext, dom = ab(t["away"]), ab(t["home"])
        s = curl_json(f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event={e['id']}")
        m = {"id": f"{date_ny}_{ext}-{dom}", "espn": e["id"], "debut": e["date"].replace("Z", ":00.000Z") if len(e["date"]) == 17 else e["date"],
             "ext": ext, "dom": dom, "statut": c["status"]["type"]["name"], "cotes": None, "proba": None, "blessures": []}
        pc = (s.get("pickcenter") or [None])[0]
        # Match commencé ou fini : on garde les dernières cotes d'avant-match déjà enregistrées (référence de clôture)
        avant = None
        if base_dir and m["statut"] != "STATUS_SCHEDULED" and os.path.exists(os.path.join(base_dir, "programme", f"{date_ny}.json")):
            ancien = json.load(open(os.path.join(base_dir, "programme", f"{date_ny}.json")))
            avant = next((x for x in ancien.get("matchs", []) if x.get("id") == m["id"] and x.get("cotes")), None)
        if avant:
            m.update(cotes=avant["cotes"], proba=avant["proba"], cotes_figees=True)
            pc = None
        if pc:
            h, a = pc.get("homeTeamOdds") or {}, pc.get("awayTeamOdds") or {}
            cotes = {"source": (pc.get("provider") or {}).get("name"), "ecartDom": pc.get("spread"),
                     "coteEcartDom": decimal_odds(h.get("spreadOdds")), "coteEcartExt": decimal_odds(a.get("spreadOdds")),
                     "total": pc.get("overUnder"), "coteOver": decimal_odds(pc.get("overOdds")), "coteUnder": decimal_odds(pc.get("underOdds")),
                     "mlDom": decimal_odds(h.get("moneyLine")), "mlExt": decimal_odds(a.get("moneyLine"))}
            vd, ve = sans_marge(cotes["mlDom"], cotes["mlExt"])
            cd, ce = sans_marge(cotes["coteEcartDom"], cotes["coteEcartExt"])
            ov, un = sans_marge(cotes["coteOver"], cotes["coteUnder"])
            m["cotes"] = cotes
            m["proba"] = {"victoireDom": vd, "victoireExt": ve, "couvreDom": cd, "couvreExt": ce, "over": ov, "under": un}
        for tm in s.get("injuries", []):
            eq = ESPN2BASE.get(tm["team"]["abbreviation"], tm["team"]["abbreviation"])
            for i in tm.get("injuries", []):
                nom = i["athlete"]["displayName"]
                m["blessures"].append({"equipe": eq, "nom": known.get(norm(nom), nom), "statut": i.get("status"),
                                       "blessure": (i.get("details") or {}).get("type"), "retour": (i.get("details") or {}).get("returnDate")})
        matchs.append(m)

    doc = {"nuit": date_ny, "maj": datetime.datetime.now(datetime.timezone.utc).isoformat(), "source": "espn.com (cotes DraftKings)", "matchs": matchs}
    json.dump(doc, open(os.path.join(out, f"{date_ny}.json"), "w"), ensure_ascii=False)
    print(f"Nuit NBA du {date_ny} : {len(matchs)} match(s), {sum(1 for m in matchs if m['cotes'])} avec cotes")
    for m in matchs:
        d = datetime.datetime.fromisoformat(m["debut"].replace("Z", "+00:00")).astimezone(PARIS)
        c, p = m["cotes"] or {}, m["proba"] or {}
        print(f"- {d:%d/%m %Hh%M} {m['ext']} @ {m['dom']} | victoire {m['dom']} {p.get('victoireDom')} {m['ext']} {p.get('victoireExt')}"
              f" | handicap {m['dom']} {c.get('ecartDom')} | total {c.get('total')} over {p.get('over')} | {len(m['blessures'])} blessé(s)")
    print(f"À écrire : {out}/{date_ny}.json")


if __name__ == "__main__":
    main()

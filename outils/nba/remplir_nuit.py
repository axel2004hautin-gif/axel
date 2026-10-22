"""Remplit une nuit NBA pour la Base de données NBA 2026-27.

Usage : remplir_nuit.py <dossier de travail> <dossier des matchs déjà en base (un JSON par match)> [AAAAMMJJ]
Sans date : la nuit NBA d'hier (date de Paris moins un jour).

Sources : ESPN (programme de la nuit, heure de début, scores par quart-temps, stats des joueurs) et
Basketball-Reference (feuilles de match, minutes à la seconde). En cas de désaccord, Basketball-Reference fait foi.

Écrit dans <dossier de travail>/<AAAAMMJJ>/ :
  a_ecrire/<id>.json  les matchs à enregistrer (nouveaux, ou déjà en base mais différents de Basketball-Reference)
  rapport.json        le détail des contrôles, match par match
Affiche un résumé. Code de sortie 0 si chaque match terminé a passé les contrôles bloquants, 1 sinon.
"""
import datetime, glob, json, math, os, re, subprocess, sys, time, unicodedata, zoneinfo

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bbr

ESPN2BASE = {"NY": "NYK", "SA": "SAS", "GS": "GSW", "NO": "NOP", "UTAH": "UTA", "WSH": "WAS"}
BASE2BBR = {"BKN": "BRK", "CHA": "CHO", "PHX": "PHO"}
BBR2BASE = {v: k for k, v in BASE2BBR.items()}
STATS = ("pts", "reb", "ast", "stl", "blk", "tp", "tov")
NY, PARIS = zoneinfo.ZoneInfo("America/New_York"), zoneinfo.ZoneInfo("Europe/Paris")

norm = lambda s: re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower())
norm_sfx = lambda s: re.sub(r"(jr|sr|ii|iii|iv)$", "", norm(s))
# Même arrondi des minutes que la page (Math.round sur les dixièmes)
jsmin = lambda secs: math.floor((secs // 60 + (secs % 60) / 60) * 10 + 0.5) / 10
iso = lambda d: d.astimezone(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:00.000Z")


def curl(url, path, browser=False):
    if os.path.exists(path):
        return True
    cmd = ["curl", "-sS", "--max-time", "30", "-o", path, "-w", "%{http_code}", url]
    if browser:
        cmd[1:1] = ["-A", "Mozilla/5.0"]
    code = subprocess.run(cmd, capture_output=True, text=True).stdout
    if code != "200":
        if os.path.exists(path):
            os.remove(path)
        print(f"  HTTP {code or 'erreur'} : {url}", flush=True)
        return False
    return True


def espn_players(summary):
    out = {}
    for t in summary["boxscore"]["players"]:
        st = t["statistics"][0]
        for a in st["athletes"]:
            v = dict(zip(st["labels"], a.get("stats") or []))
            if a.get("didNotPlay") or v.get("MIN") in (None, "", "0", "--"):
                continue
            out[norm_sfx(a["athlete"]["displayName"])] = {
                "nom": a["athlete"]["displayName"], "min": int(v["MIN"]), "pts": int(v["PTS"]), "reb": int(v["REB"]), "ast": int(v["AST"]),
                "stl": int(v["STL"]), "blk": int(v["BLK"]), "tp": int(v["3PT"].split("-")[0]), "tov": int(v["TO"])}
    return out


def main():
    work, base_dir = sys.argv[1], sys.argv[2]
    night = sys.argv[3] if len(sys.argv) > 3 else (datetime.datetime.now(PARIS).date() - datetime.timedelta(days=1)).strftime("%Y%m%d")
    date_ny = f"{night[:4]}-{night[4:6]}-{night[6:]}"
    d = os.path.join(work, night); dl = os.path.join(d, "telechargements"); out = os.path.join(d, "a_ecrire")
    os.makedirs(dl, exist_ok=True); os.makedirs(out, exist_ok=True)
    for f in glob.glob(out + "/*.json"):
        os.remove(f)

    base = {os.path.basename(f)[:-5]: json.load(open(f)) for f in glob.glob(base_dir + "/*.json")}
    # Orthographe déjà utilisée en base pour chaque joueur, match par match (un joueur garde le même nom d'un match à l'autre)
    known = {}
    for i, m in sorted(base.items()):
        for p in m.get("joueurs", []):
            known.setdefault(norm(p["nom"]), {}).setdefault(i, p["nom"])

    print(f"Nuit NBA du {date_ny}", flush=True)
    if not curl(f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates={night}", f"{dl}/espn-programme.json"):
        sys.exit("Programme ESPN introuvable.")
    events = json.load(open(f"{dl}/espn-programme.json")).get("events", [])
    report, all_ok = [], True
    for e in events:
        c = e["competitions"][0]
        t = {x["homeAway"]: x for x in c["competitors"]}
        ab = lambda x: ESPN2BASE.get(x["team"]["abbreviation"], x["team"]["abbreviation"])
        ext, dom = ab(t["away"]), ab(t["home"])
        gid = f"{date_ny}_{ext}-{dom}"
        r = {"id": gid, "match": f"{ext} @ {dom}", "bloquant": [], "litiges": [], "changements": []}
        report.append(r)
        if c["status"]["type"]["name"] != "STATUS_FINAL":
            r["statut"] = "pas terminé : " + c["status"]["type"].get("description", "")
            continue
        ls = {"ext": [int(float(x["value"])) for x in t["away"].get("linescores", [])], "dom": [int(float(x["value"])) for x in t["home"].get("linescores", [])]}
        score = {"ext": int(t["away"]["score"]), "dom": int(t["home"]["score"])}
        n_ot = max(len(ls["ext"]) - 4, 0)
        r["score"] = f"{ext} {score['ext']} – {score['dom']} {dom}" + (f" ({n_ot} prol.)" if n_ot else "")

        bbr_path = f"{dl}/bbr-{dom}.html"
        fetched = os.path.exists(bbr_path)
        ok_bbr = curl(f"https://www.basketball-reference.com/boxscores/{night}0{BASE2BBR.get(dom, dom)}.html", bbr_path, browser=True)
        if not fetched:
            time.sleep(3.5)  # Basketball-Reference limite à une vingtaine de pages par minute
        ok_espn = curl(f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event={e['id']}", f"{dl}/espn-{e['id']}.json")
        if not ok_bbr:
            r["bloquant"].append("feuille Basketball-Reference indisponible")
            all_ok = False
            continue
        b = bbr.parse(bbr_path)
        q = {BBR2BASE.get(k, k): v for k, v in b["quarters"].items()}
        pl = {BBR2BASE.get(k, k): v for k, v in b["players"].items()}

        # Contrôles bloquants : la feuille Basketball-Reference doit être complète et cohérente
        for side, team in (("ext", ext), ("dom", dom)):
            qq = q.get(team)
            if not qq or team not in pl:
                r["bloquant"].append(f"{team} absent de la feuille Basketball-Reference")
                continue
            pts = sum(p["pts"] for p in pl[team])
            if qq["total"] != pts:
                r["bloquant"].append(f"{team} : points des joueurs {pts} ≠ score {qq['total']}")
            secs = sum(p["secs"] for p in pl[team])
            if abs(secs - (240 + 25 * n_ot) * 60) > 15:
                r["bloquant"].append(f"{team} : minutes des joueurs {secs / 60:.2f} ≠ {240 + 25 * n_ot}")
            if qq["q"] != ls[side][:4] or qq["ot"] != sum(ls[side][4:]) or qq["total"] != score[side]:
                r["litiges"].append(f"{team} : quarts-temps Basketball-Reference {qq['q']}+{qq['ot']} = {qq['total']}, ESPN {ls[side]} = {score[side]}")
        if r["bloquant"]:
            all_ok = False
            continue

        # Heure de début : Basketball-Reference fait foi, ESPN en secours
        debut = datetime.datetime.fromisoformat(e["date"].replace("Z", "+00:00"))
        if b.get("start"):
            start = datetime.datetime.strptime(b["start"], "%I:%M %p %B %d, %Y").replace(tzinfo=NY)
            if start != debut:
                r["litiges"].append(f"heure de début : Basketball-Reference {start.astimezone(PARIS):%Hh%M}, ESPN {debut.astimezone(PARIS):%Hh%M} (heure de Paris)")
            debut = start
        r["paris"] = debut.astimezone(PARIS).strftime("%d/%m %Hh%M")

        def conv(p, team):
            autres = [n for i, n in known.get(norm(p["nom"]), {}).items() if i != gid]
            return {"nom": autres[0] if autres else p["nom"], "equipe": team, "min": jsmin(p["secs"]),
                    **{k: p[k] for k in STATS}}
        doc = {"date": date_ny, "debut": iso(debut), "saison": "2026-27", "dom": dom, "ext": ext,
               "qtDom": q[dom]["q"], "qtExt": q[ext]["q"], "otDom": q[dom]["ot"], "otExt": q[ext]["ot"],
               "joueurs": [conv(p, ext) for p in pl[ext]] + [conv(p, dom) for p in pl[dom]],
               "source": "basketball-reference.com, vérifié avec espn.com", "maj": datetime.datetime.now(datetime.timezone.utc).isoformat()}
        r["joueurs"] = len(doc["joueurs"])

        # Comparaison joueur par joueur avec ESPN (non bloquant : Basketball-Reference fait foi)
        if ok_espn:
            esp = espn_players(json.load(open(f"{dl}/espn-{e['id']}.json")))
            seen, n_vals = set(), 0
            for p in doc["joueurs"]:
                k = norm_sfx(p["nom"]); ep = esp.get(k)
                if not ep:
                    r["litiges"].append(f"{p['nom']} ({p['min']} min) absent chez ESPN")
                    continue
                seen.add(k)
                for s in STATS:
                    n_vals += 1
                    if p[s] != ep[s]:
                        r["litiges"].append(f"{p['nom']} {s} : Basketball-Reference {p[s]}, ESPN {ep[s]}")
                n_vals += 1
                if abs(p["min"] - ep["min"]) > 1:
                    r["litiges"].append(f"{p['nom']} minutes : Basketball-Reference {p['min']}, ESPN {ep['min']}")
            for k, ep in esp.items():
                if k not in seen:
                    r["litiges"].append(f"{ep['nom']} ({ep['min']} min, {ep['pts']} pts) chez ESPN, absent de Basketball-Reference")
            r["valeurs_comparees_espn"] = n_vals
        else:
            r["litiges"].append("feuille ESPN indisponible : pas de deuxième source pour les joueurs")

        # Déjà en base ? On ne réécrit que si la base diffère de Basketball-Reference
        old = base.get(gid)
        dup = [i for i, m in base.items() if i != gid and m.get("ext") == ext and m.get("dom") == dom
               and abs((datetime.date.fromisoformat(m["date"]) - datetime.date.fromisoformat(date_ny)).days) <= 1]
        if dup:
            r["changements"].append(f"doublon possible déjà en base : {', '.join(dup)}")
        if old:
            ch = []
            if old.get("qtDom") != doc["qtDom"] or old.get("qtExt") != doc["qtExt"] or (old.get("otDom") or 0) != doc["otDom"] or (old.get("otExt") or 0) != doc["otExt"]:
                ch.append("scores par quart-temps")
            if old.get("debut") != doc["debut"]:
                ch.append(f"heure de début {old.get('debut')} → {doc['debut']}")
            newp = {norm(p["nom"]): p for p in doc["joueurs"]}
            oldp = {norm(p["nom"]): p for p in old.get("joueurs", [])}
            for k, p in oldp.items():
                n = newp.get(k)
                if not n:
                    ch.append(f"{p['nom']} absent de Basketball-Reference")
                    continue
                if p["nom"] != n["nom"]:
                    ch.append(f"nom {p['nom']} → {n['nom']}")
                ch += [f"{n['nom']} {s} {p.get(s)} → {n[s]}" for s in STATS if p.get(s) != n[s]]
                if abs((p.get("min") or 0) - n["min"]) > 0.15:
                    ch.append(f"{n['nom']} minutes {p.get('min')} → {n['min']}")
            ch += [f"{p['nom']} ajouté" for k, p in newp.items() if k not in oldp]
            if not ch:
                r["statut"] = "déjà en base, identique"
                continue
            r["statut"] = "déjà en base, corrigé"
            r["changements"] += ch
            if old.get("maj"):
                doc["maj"] = old["maj"]
        else:
            r["statut"] = "nouveau"
        json.dump(doc, open(f"{out}/{gid}.json", "w"), ensure_ascii=False)

    json.dump(report, open(f"{d}/rapport.json", "w"), ensure_ascii=False, indent=1)
    for r in report:
        print(f"- {r.get('paris', '      ')} {r['match']} {r.get('score', '')} | {r.get('statut', 'NON ÉCRIT')}"
              + (f" | {r['joueurs']} joueurs, {r.get('valeurs_comparees_espn', 0)} valeurs comparées à ESPN" if r.get("joueurs") else ""))
        for k in ("bloquant", "litiges", "changements"):
            for x in r[k]:
                print(f"    {k} : {x}")
    print(f"{len(glob.glob(out + '/*.json'))} match(s) à écrire dans {out}")
    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()

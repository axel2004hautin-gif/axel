"""Remplit une nuit NBA pour la Base de données NBA 2026-27.

Usage : remplir_nuit.py <dossier de travail> <dossier de la base> [AAAAMMJJ]
  <dossier de la base> contient matchs/ et details/ (un JSON par document, comme l'écrit ArtifactData list avec out_dir).
  Sans date : la nuit NBA d'hier (date de Paris moins un jour).

Sources : Basketball-Reference (feuilles de match : stats du match, par quart-temps, avancées, absents, arbitres)
et ESPN (programme, heure de début, scores, cotes DraftKings, stats d'équipe, blessures, déroulé du match).
En cas de désaccord, Basketball-Reference fait foi.

Écrit dans <dossier de travail>/<AAAAMMJJ>/ :
  a_ecrire/matchs/<id>.json   documents « matchs » à enregistrer (nouveaux, différents de Basketball-Reference, ou à mettre à niveau)
  a_ecrire/details/<id>.json  documents « details » à enregistrer (nouveaux ou différents)
  rapport.json                le détail des contrôles, match par match
Affiche un résumé. Code de sortie 0 si chaque match terminé a passé les contrôles bloquants, 1 sinon.
"""
import datetime, glob, json, math, os, re, subprocess, sys, time, unicodedata, zoneinfo

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bbr

SCHEMA = 2
ESPN2BASE = {"NY": "NYK", "SA": "SAS", "GS": "GSW", "NO": "NOP", "UTAH": "UTA", "WSH": "WAS"}
BASE2BBR = {"BKN": "BRK", "CHA": "CHO", "PHX": "PHO"}
BBR2BASE = {v: k for k, v in BASE2BBR.items()}
# Stats d'un joueur gardées dans « matchs » (en plus de nom, equipe, titulaire, min)
STATS = ("pts", "reb", "ast", "stl", "blk", "tp", "tov", "fgm", "fga", "tpa", "ftm", "fta", "oreb", "dreb", "pf", "pm")
# Colonnes des lignes par quart-temps dans « details »
COLS = ("min",) + STATS
ESPN_TEAM = {"pointsInPaint": "raquette", "fastBreakPoints": "contre_attaque", "turnoverPoints": "pts_sur_bp", "technicalFouls": "techniques",
             "flagrantFouls": "flagrantes", "teamTurnovers": "bp_equipe", "largestLead": "plus_gros_ecart", "fouls": "fautes"}
NY, PARIS = zoneinfo.ZoneInfo("America/New_York"), zoneinfo.ZoneInfo("Europe/Paris")

norm = lambda s: re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower())
norm_sfx = lambda s: re.sub(r"(jr|sr|ii|iii|iv)$", "", norm(s))
# Même arrondi des minutes que la page (Math.round sur les dixièmes)
jsmin = lambda secs: math.floor((secs // 60 + (secs % 60) / 60) * 10 + 0.5) / 10
iso = lambda d: d.astimezone(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:00.000Z")
decimal_odds = lambda us: None if us in (None, 0) else round(1 + (us / 100 if us > 0 else 100 / -us), 2)


def _plain(x):
    # La base rend 9 là où on avait écrit 9.0 : on compare les nombres par leur valeur
    if isinstance(x, dict):
        return {k: _plain(v) for k, v in x.items()}
    if isinstance(x, list):
        return [_plain(v) for v in x]
    return int(x) if isinstance(x, float) and x.is_integer() else x


canon = lambda doc: json.dumps(_plain({k: v for k, v in doc.items() if k != "maj"}), sort_keys=True, ensure_ascii=False)


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


def load_dir(path):
    return {os.path.basename(f)[:-5]: json.load(open(f)) for f in glob.glob(path + "/*.json")}


def espn_players(summary):
    out = {}
    for t in summary["boxscore"]["players"]:
        st = t["statistics"][0]
        for a in st["athletes"]:
            v = dict(zip(st["labels"], a.get("stats") or []))
            if a.get("didNotPlay") or v.get("MIN") in (None, "", "0", "--"):
                continue
            fg, tp, ft = (v[k].split("-") for k in ("FG", "3PT", "FT"))
            out[norm_sfx(a["athlete"]["displayName"])] = {
                "nom": a["athlete"]["displayName"], "min": int(v["MIN"]), "titulaire": bool(a.get("starter")),
                "pts": int(v["PTS"]), "reb": int(v["REB"]), "ast": int(v["AST"]), "stl": int(v["STL"]), "blk": int(v["BLK"]),
                "tp": int(tp[0]), "tpa": int(tp[1]), "fgm": int(fg[0]), "fga": int(fg[1]), "ftm": int(ft[0]), "fta": int(ft[1]),
                "tov": int(v["TO"]), "oreb": int(v["OREB"]), "dreb": int(v["DREB"]), "pf": int(v["PF"]), "pm": int(v["+/-"])}
    return out


def deroule(summary, name_of, abbr_of, home, away):
    """Ce que le déroulé ESPN apprend en plus des feuilles : premiers points, courses aux X points, écarts, séries, leaders."""
    plays = [p for p in summary.get("plays") or [] if p.get("period")]
    sc = [p for p in plays if p.get("scoringPlay")]
    if not sc:
        return None
    lbl = lambda n: f"QT{n}" if n <= 4 else f"Prol.{n - 4}"
    plen = lambda n: 720 if n <= 4 else 300

    def clock(p):
        m = re.match(r"(\d+):(\d+)(?:\.(\d))?", p["clock"]["displayValue"])
        if m:
            return int(m.group(1)) * 60 + int(m.group(2))
        return float(p["clock"]["displayValue"] or 0)

    elapsed = lambda p: sum(plen(n) for n in range(1, p["period"]["number"])) + plen(p["period"]["number"]) - clock(p)
    team = lambda p: abbr_of.get(str((p.get("team") or {}).get("id")))
    is_ft = lambda p: "Free Throw" in p["type"]["text"]

    def ev(p):
        part = (p.get("participants") or [{}])[0].get("athlete") or {}
        return {"equipe": team(p), "joueur": name_of.get(str(part.get("id"))), "action": p["type"]["text"],
                "points": p.get("scoreValue"), "moment": f"{lbl(p['period']['number'])} {p['clock']['displayValue']}"}

    def race(seq, base, marks):
        res = {}
        for m in marks:
            for p in seq:
                h, a = p["homeScore"] - base[0], p["awayScore"] - base[1]
                if h >= m or a >= m:
                    res[str(m)] = {"equipe": home if h >= m else away, "moment": ev(p)["moment"]}
                    break
        return res

    d = {"premiers_points": ev(sc[0]), "premier_panier": ev(next((p for p in sc if not is_ft(p)), sc[0])), "derniers_points": ev(sc[-1]),
         "premier_panier_equipe": {}, "course": race(sc, (0, 0), (5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100)), "periodes": {}}
    for t in (home, away):
        p = next((p for p in sc if team(p) == t and not is_ft(p)), None)
        if p:
            d["premier_panier_equipe"][t] = ev(p)
    base = (0, 0)
    for n in sorted({p["period"]["number"] for p in sc}):
        ps = [p for p in sc if p["period"]["number"] == n]
        d["periodes"][lbl(n)] = {"premiers_points": ev(ps[0]), "premier_panier": ev(next((p for p in ps if not is_ft(p)), ps[0])),
                                 "derniers_points": ev(ps[-1]), "course": race(ps, base, (5, 10, 15, 20, 25))}
        base = (ps[-1]["homeScore"], ps[-1]["awayScore"])

    # Écarts, changements de leader, égalités, séries, temps passé en tête
    best = {home: (0, None), away: (0, None)}
    changes = ties = 0
    leader = None
    lead_time = {home: 0.0, away: 0.0}
    prev_t, prev_m = 0.0, 0
    runs = {home: (0, None), away: (0, None)}
    run_team, run_pts, run_start = None, 0, None
    for p in sc:
        t_now = elapsed(p)
        if prev_m > 0:
            lead_time[home] += t_now - prev_t
        elif prev_m < 0:
            lead_time[away] += t_now - prev_t
        m = p["homeScore"] - p["awayScore"]
        for side, val in ((home, m), (away, -m)):
            if val > best[side][0]:
                best[side] = (val, ev(p)["moment"])
        if m == 0:
            ties += 1
        else:
            s = home if m > 0 else away
            if leader and s != leader:
                changes += 1
            leader = s
        tm = team(p)
        if tm == run_team:
            run_pts += p.get("scoreValue") or 0
        else:
            run_team, run_pts, run_start = tm, p.get("scoreValue") or 0, ev(p)["moment"]
        if tm in runs and run_pts > runs[tm][0]:
            runs[tm] = (run_pts, f"{run_start} → {ev(p)['moment']}")
        prev_t, prev_m = t_now, m
    end = elapsed(plays[-1]) if plays else prev_t
    if prev_m > 0:
        lead_time[home] += end - prev_t
    elif prev_m < 0:
        lead_time[away] += end - prev_t
    total = end or 1
    d["plus_gros_ecart"] = {t: {"points": v, "moment": w} for t, (v, w) in best.items()}
    d["changements_de_leader"] = changes
    d["egalites"] = ties
    d["plus_longue_serie"] = {t: {"points": v, "moment": w} for t, (v, w) in runs.items()}
    d["temps_en_tete_pct"] = {t: round(100 * v / total, 1) for t, v in lead_time.items()}
    return d


def main():
    work, base_dir = sys.argv[1], sys.argv[2]
    night = sys.argv[3] if len(sys.argv) > 3 else (datetime.datetime.now(PARIS).date() - datetime.timedelta(days=1)).strftime("%Y%m%d")
    date_ny = f"{night[:4]}-{night[4:6]}-{night[6:]}"
    d = os.path.join(work, night); dl = os.path.join(d, "telechargements"); out = os.path.join(d, "a_ecrire")
    for sub in ("matchs", "details"):
        os.makedirs(os.path.join(out, sub), exist_ok=True)
        for f in glob.glob(os.path.join(out, sub, "*.json")):
            os.remove(f)
    os.makedirs(dl, exist_ok=True)

    base = load_dir(os.path.join(base_dir, "matchs")) if os.path.isdir(os.path.join(base_dir, "matchs")) else load_dir(base_dir)
    base_det = load_dir(os.path.join(base_dir, "details"))
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
        fix = lambda dct: {BBR2BASE.get(k, k): v for k, v in dct.items()}
        q, pl, per, tot = fix(b["quarters"]), fix(b["players"]), fix(b["periods"]), fix(b["totals"])
        adv, adv_t, fac, dnp, ina = fix(b["advanced"]), fix(b["advanced_team"]), fix(b["factors"]), fix(b["dnp"]), fix(b["inactive"])

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
            # Lignes par quart-temps : leurs points doivent faire le score de chaque quart-temps (sinon on ne les garde pas)
            want = qq["q"]
            for i, k in enumerate(("q1", "q2", "q3", "q4")):
                got = sum(p.get("pts") or 0 for p in per.get(team, {}).get(k, {}).values())
                if k not in per.get(team, {}) or got != want[i]:
                    r["litiges"].append(f"{team} : lignes du {k} absentes ou incohérentes ({got} pts pour {want[i]}), quarts-temps des joueurs non gardés")
                    per[team] = {}
                    break
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

        def final_name(n):
            autres = [x for i, x in known.get(norm(n), {}).items() if i != gid]
            return autres[0] if autres else n

        def line(p, team):
            return {"nom": final_name(p["nom"]), "equipe": team, "titulaire": p["titulaire"], "min": jsmin(p["secs"]), **{k: p.get(k) for k in STATS}}

        summary = json.load(open(f"{dl}/espn-{e['id']}.json")) if ok_espn else None
        cotes = None
        if summary and summary.get("pickcenter"):
            pc = summary["pickcenter"][0]
            h, a = pc.get("homeTeamOdds") or {}, pc.get("awayTeamOdds") or {}
            cotes = {"source": (pc.get("provider") or {}).get("name"), "ecartDom": pc.get("spread"), "total": pc.get("overUnder"),
                     "mlDom": decimal_odds(h.get("moneyLine")), "mlExt": decimal_odds(a.get("moneyLine"))}
        doc = {"date": date_ny, "debut": iso(debut), "saison": "2026-27", "dom": dom, "ext": ext,
               "qtDom": q[dom]["q"], "qtExt": q[ext]["q"], "otDom": q[dom]["ot"], "otExt": q[ext]["ot"],
               "joueurs": [line(p, ext) for p in pl[ext]] + [line(p, dom) for p in pl[dom]],
               **({"cotes": cotes} if cotes else {}),
               "schema": SCHEMA, "source": "basketball-reference.com, vérifié avec espn.com", "maj": datetime.datetime.now(datetime.timezone.utc).isoformat()}
        r["joueurs"] = len(doc["joueurs"])

        # Document « details »
        det = {"date": date_ny, "dom": dom, "ext": ext, "schema": SCHEMA, "colonnes": list(COLS), "joueurs": [], "equipes": {},
               "absents": [], "infos": {"duree": b.get("duration"), "affluence": b.get("attendance"), "arbitres": b.get("officials") or []},
               "source": "basketball-reference.com, espn.com", "maj": doc["maj"]}
        for team in (ext, dom):
            for p in pl[team]:
                periodes = {}
                for k, pp in per.get(team, {}).items():
                    x = pp.get(p["nom"])
                    if x:
                        periodes[k] = [jsmin(x["secs"])] + [x.get(s) for s in STATS]
                det["joueurs"].append({"nom": final_name(p["nom"]), "equipe": team, "gmsc": p.get("gmsc"),
                                       "avance": adv.get(team, {}).get(p["nom"], {}), "periodes": periodes})
            det["equipes"][team] = {"totaux": {k: v for k, v in (tot[team].get("game") or {}).items() if k not in ("gmsc", "pm")},
                                    "periodes": {k: {s: v for s, v in (x or {}).items() if s not in ("gmsc", "pm")} for k, x in tot[team].items() if k != "game"} if per.get(team) else {},
                                    "avance": {k: v for k, v in (adv_t.get(team) or {}).items() if k not in ("usg", "bpm")},
                                    "facteurs": fac.get(team, {})}
            det["absents"] += [{"equipe": team, "nom": final_name(x["nom"]), "raison": x["raison"]} for x in dnp.get(team, [])]
            det["absents"] += [{"equipe": team, "nom": final_name(n), "raison": "Inactive"} for n in ina.get(team, [])]

        # Comparaison joueur par joueur avec ESPN (non bloquant : Basketball-Reference fait foi), puis données propres à ESPN
        if summary:
            esp = espn_players(summary)
            seen, n_vals = set(), 0
            for p in doc["joueurs"]:
                k = norm_sfx(p["nom"]); ep = esp.get(k)
                if not ep:
                    r["litiges"].append(f"{p['nom']} ({p['min']} min) absent chez ESPN")
                    continue
                seen.add(k)
                for s in STATS + ("titulaire",):
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

            # Noms ESPN → noms de la base, sigles ESPN → sigles de la base
            final_by_norm = {norm_sfx(p["nom"]): p["nom"] for p in doc["joueurs"]}
            name_of = {}
            for tm in summary["boxscore"]["players"]:
                for a in tm["statistics"][0]["athletes"]:
                    nm = a["athlete"]["displayName"]
                    name_of[str(a["athlete"]["id"])] = final_by_norm.get(norm_sfx(nm), nm)
            abbr_of = {str(x["team"]["id"]): ESPN2BASE.get(x["team"]["abbreviation"], x["team"]["abbreviation"])
                       for x in summary["header"]["competitions"][0]["competitors"]}
            det["deroule"] = deroule(summary, name_of, abbr_of, dom, ext)
            for tm in summary["boxscore"].get("teams", []):
                a = ESPN2BASE.get(tm["team"]["abbreviation"], tm["team"]["abbreviation"])
                if a in det["equipes"]:
                    det["equipes"][a]["espn"] = {ESPN_TEAM[s["name"]]: bbr._num(s.get("displayValue")) for s in tm.get("statistics", []) if s["name"] in ESPN_TEAM}
            if summary.get("pickcenter"):
                pc = summary["pickcenter"][0]
                h, a = pc.get("homeTeamOdds") or {}, pc.get("awayTeamOdds") or {}
                det["cotes"] = {**cotes, "coteOver": pc.get("overOdds"), "coteUnder": pc.get("underOdds"), "detail": pc.get("details"),
                                "mlDomUS": h.get("moneyLine"), "mlExtUS": a.get("moneyLine"),
                                "favoriOuverture": dom if h.get("favoriteAtOpen") else ext if a.get("favoriteAtOpen") else None}
            det["blessures_espn"] = [{"equipe": ESPN2BASE.get(tm["team"]["abbreviation"], tm["team"]["abbreviation"]), "nom": final_name(i["athlete"]["displayName"]),
                                      "statut": i.get("status"), "blessure": (i.get("details") or {}).get("type"), "retour": (i.get("details") or {}).get("returnDate")}
                                     for tm in summary.get("injuries", []) for i in tm.get("injuries", [])]
            gi = summary.get("gameInfo") or {}
            det["infos"]["salle"] = (gi.get("venue") or {}).get("fullName")
            det["infos"]["ville"] = ((gi.get("venue") or {}).get("address") or {}).get("city")
            det["infos"]["affluence"] = det["infos"]["affluence"] or gi.get("attendance")
            if not det["infos"]["arbitres"]:
                det["infos"]["arbitres"] = [o.get("displayName") for o in gi.get("officials", [])]
        else:
            r["litiges"].append("feuille ESPN indisponible : pas de deuxième source, ni cotes, ni déroulé")

        # Déjà en base ? On ne réécrit que ce qui diffère
        old, old_det = base.get(gid), base_det.get(gid)
        dup = [i for i, m in base.items() if i != gid and m.get("ext") == ext and m.get("dom") == dom
               and abs((datetime.date.fromisoformat(m["date"]) - datetime.date.fromisoformat(date_ny)).days) <= 1]
        if dup:
            r["changements"].append(f"doublon possible déjà en base : {', '.join(dup)}")
        write_match = write_det = True
        if old:
            ch = []
            if old.get("qtDom") != doc["qtDom"] or old.get("qtExt") != doc["qtExt"] or (old.get("otDom") or 0) != doc["otDom"] or (old.get("otExt") or 0) != doc["otExt"]:
                ch.append("scores par quart-temps")
            if old.get("debut") != doc["debut"]:
                ch.append(f"heure de début {old.get('debut')} → {doc['debut']}")
            newp = {norm(p["nom"]): p for p in doc["joueurs"]}
            oldp = {norm(p["nom"]): p for p in old.get("joueurs", [])}
            upgrade = (old.get("schema") or 1) < SCHEMA
            for k, p in oldp.items():
                n = newp.get(k)
                if not n:
                    ch.append(f"{p['nom']} absent de Basketball-Reference")
                    continue
                if p["nom"] != n["nom"]:
                    ch.append(f"nom {p['nom']} → {n['nom']}")
                ch += [f"{n['nom']} {s} {p.get(s)} → {n[s]}" for s in ("pts", "reb", "ast", "stl", "blk", "tp", "tov") if p.get(s) != n[s]]
                if not upgrade:
                    ch += [f"{n['nom']} {s} {p.get(s)} → {n[s]}" for s in STATS[7:] + ("titulaire",) if p.get(s) != n[s]]
                if abs((p.get("min") or 0) - n["min"]) > 0.15:
                    ch.append(f"{n['nom']} minutes {p.get('min')} → {n['min']}")
            ch += [f"{p['nom']} ajouté" for k, p in newp.items() if k not in oldp]
            if not upgrade and old.get("cotes") != doc.get("cotes"):
                ch.append("cotes")
            if upgrade:
                ch.append("mise à niveau : tirs, lancers, rebonds off./déf., fautes, +/-, titulaire, cotes")
            if ch:
                r["changements"] += ch
                if old.get("maj"):
                    doc["maj"] = old["maj"]
            else:
                write_match = False
            r["statut"] = "déjà en base, " + ("mis à jour" if ch else "identique")
        else:
            r["statut"] = "nouveau"
        if old_det and canon(old_det) == canon(det):
            write_det = False
        elif old:
            r["changements"].append("détails " + ("mis à jour" if old_det else "ajoutés"))
        if write_match:
            json.dump(doc, open(f"{out}/matchs/{gid}.json", "w"), ensure_ascii=False)
        if write_det:
            json.dump(det, open(f"{out}/details/{gid}.json", "w"), ensure_ascii=False)
        r["taille_details_ko"] = round(len(json.dumps(det, ensure_ascii=False).encode()) / 1024, 1)

    json.dump(report, open(f"{d}/rapport.json", "w"), ensure_ascii=False, indent=1)
    for r in report:
        print(f"- {r.get('paris', '      ')} {r['match']} {r.get('score', '')} | {r.get('statut', 'NON ÉCRIT')}"
              + (f" | {r['joueurs']} joueurs, {r.get('valeurs_comparees_espn', 0)} valeurs comparées à ESPN, détails {r.get('taille_details_ko')} Ko" if r.get("joueurs") else ""))
        for k in ("bloquant", "litiges", "changements"):
            for x in r[k]:
                print(f"    {k} : {x}")
    nm, nd = len(glob.glob(out + "/matchs/*.json")), len(glob.glob(out + "/details/*.json"))
    print(f"À écrire : {nm} document(s) dans matchs, {nd} dans details ({out})")
    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()

"""Usage : build_night.py <dossier des téléchargements> <AAAAMMJJ> <dossier des matchs déjà en base (JSON)> <dossier de sortie>
Construit les documents « matchs » d'une nuit et vérifie chaque match ; compare aussi aux matchs déjà en base."""
import json, math, sys, os, glob, unicodedata, re
sys.path.insert(0, os.path.dirname(__file__)); import bbr
BBR2BASE = {"BRK": "BKN", "CHO": "CHA", "PHO": "PHX"}
espn_dir, night, base_dir, out_dir = sys.argv[1:5]
os.makedirs(out_dir, exist_ok=True)
norm = lambda s: re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower())
base = {os.path.basename(f)[:-5]: json.load(open(f)) for f in glob.glob(f"{base_dir}/*.json")}
known = {}
for m in base.values():
    for p in m.get("joueurs", []): known.setdefault(norm(p["nom"]), p["nom"])
jsmin = lambda secs: math.floor((secs // 60 + (secs % 60) / 60) * 10 + 0.5) / 10   # même arrondi que la page
ok_all = True
for g in json.load(open(f"{espn_dir}/games-{night}.json")):
    date_ny = night[:4] + "-" + night[4:6] + "-" + night[6:]
    gid = f"{date_ny}_{g['ext']}-{g['dom']}"
    b = bbr.parse(g["bbr"]); q = {BBR2BASE.get(k, k): v for k, v in b["quarters"].items()}
    pl = {BBR2BASE.get(k, k): v for k, v in b["players"].items()}
    errs = []
    nOT = max(len(g["lsExt"]) - 4, 0)
    if not g["final"]: errs.append("match pas terminé")
    for side, ls, sc in (("ext", g["lsExt"], g["scoreExt"]), ("dom", g["lsDom"], g["scoreDom"])):
        t = g[side]; qq = q.get(t)
        if not qq: errs.append(f"{t} absent de la feuille"); continue
        if qq["q"] != ls[:4] or qq["ot"] != sum(ls[4:]) or qq["total"] != sc: errs.append(f"{t} : quarts BBR {qq['q']}+{qq['ot']} ≠ ESPN {ls}")
        pts = sum(p["pts"] for p in pl.get(t, []))
        if pts != sc: errs.append(f"{t} : points joueurs {pts} ≠ score {sc}")
        secs = sum(p["secs"] for p in pl.get(t, []))
        if abs(secs - (240 + 25 * nOT) * 60) > 15: errs.append(f"{t} : minutes {secs/60:.2f} ≠ {240 + 25 * nOT}")
    renamed = []
    def conv(p, team):
        nom = known.get(norm(p["nom"]), p["nom"])
        if nom != p["nom"]: renamed.append(f"{p['nom']} → {nom}")
        return {"nom": nom, "equipe": team, "min": jsmin(p["secs"]), "pts": p["pts"], "reb": p["reb"], "ast": p["ast"], "stl": p["stl"], "blk": p["blk"], "tp": p["tp"], "tov": p["tov"]}
    doc = {"date": date_ny, "debut": g["debut"].replace("Z", ":00.000Z") if len(g["debut"]) == 17 else g["debut"], "saison": "2026-27", "dom": g["dom"], "ext": g["ext"],
           "qtDom": q[g["dom"]]["q"], "qtExt": q[g["ext"]]["q"], "otDom": q[g["dom"]]["ot"], "otExt": q[g["ext"]]["ot"],
           "joueurs": [conv(p, g["ext"]) for p in pl[g["ext"]]] + [conv(p, g["dom"]) for p in pl[g["dom"]]], "source": "basketball-reference.com + espn.com"}
    status = "ERREUR " + " ; ".join(errs) if errs else "ok"
    ok_all &= not errs
    if gid in base:
        # déjà en base : comparer
        old = base[gid]; diffs = []
        if old["qtDom"] != doc["qtDom"] or old["qtExt"] != doc["qtExt"]: diffs.append(f"quarts base {old['qtExt']}/{old['qtDom']}")
        newp = {norm(p["nom"]): p for p in doc["joueurs"]}
        for p in old["joueurs"]:
            n = newp.get(norm(p["nom"]))
            if not n: diffs.append(f"« {p['nom']} » introuvable sur la feuille"); continue
            d = [f"{k} {p[k]}→{n[k]}" for k in ("pts", "reb", "ast", "stl", "blk", "tp", "tov") if p.get(k) != n[k]]
            if abs(p.get("min", 0) - n["min"]) > 0.15: d.append(f"min {p.get('min')}→{n['min']}")
            if d: diffs.append(p["nom"] + " : " + ", ".join(d))
        oldn = {norm(p["nom"]) for p in old["joueurs"]}
        miss = [p["nom"] for p in doc["joueurs"] if norm(p["nom"]) not in oldn]
        if miss: diffs.append("absents de la base : " + ", ".join(miss))
        print(f"[déjà en base] {gid} {status} | {len(diffs)} écart(s)" + ("".join("\n    - " + x for x in diffs) if diffs else ""))
    else:
        json.dump(doc, open(f"{out_dir}/{gid}.json", "w"), ensure_ascii=False)
        print(f"[nouveau] {gid} {doc['debut']} {g['ext']} {g['scoreExt']} @ {g['dom']} {g['scoreDom']}{' (prol.)' if nOT else ''} | {len(doc['joueurs'])} joueurs | {status}" + (f" | noms repris de la base : {renamed}" if renamed else ""))
print("TOUT OK" if ok_all else "DES ERREURS")

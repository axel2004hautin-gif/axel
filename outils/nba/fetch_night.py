"""Usage : fetch_night.py <dossier> <AAAAMMJJ de la nuit NBA>
Télécharge le programme ESPN de la nuit et les feuilles Basketball-Reference des matchs d'une nuit NBA listés par ESPN."""
import json, subprocess, sys, time, os
ESPN2BASE = {"NY": "NYK", "SA": "SAS", "GS": "GSW", "NO": "NOP", "UTAH": "UTA", "WSH": "WAS"}
BASE2BBR = {"BKN": "BRK", "CHA": "CHO", "PHX": "PHO"}
out_dir, night = sys.argv[1], sys.argv[2]
os.makedirs(out_dir, exist_ok=True)
if not os.path.exists(f"{out_dir}/sb-{night}.json"):
    subprocess.run(["curl", "-sS", "--max-time", "30", "-o", f"{out_dir}/sb-{night}.json",
                    f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates={night}"], check=True)
sb = json.load(open(f"{out_dir}/sb-{night}.json"))
games = []
for e in sb["events"]:
    c = e["competitions"][0]
    t = {x["homeAway"]: x for x in c["competitors"]}
    ab = lambda x: ESPN2BASE.get(x["team"]["abbreviation"], x["team"]["abbreviation"])
    g = {"espn": e["id"], "debut": e["date"], "ext": ab(t["away"]), "dom": ab(t["home"]), "final": c["status"]["type"]["name"] == "STATUS_FINAL",
         "lsExt": [int(float(x["value"])) for x in t["away"].get("linescores", [])], "lsDom": [int(float(x["value"])) for x in t["home"].get("linescores", [])],
         "scoreExt": int(t["away"]["score"]), "scoreDom": int(t["home"]["score"])}
    path = f"{out_dir}/bbr-{night}-{g['dom']}.html"
    if not os.path.exists(path):
        url = f"https://www.basketball-reference.com/boxscores/{night}0{BASE2BBR.get(g['dom'], g['dom'])}.html"
        code = subprocess.run(["curl", "-sS", "--max-time", "30", "-A", "Mozilla/5.0", "-o", path, "-w", "%{http_code}", url], capture_output=True, text=True).stdout
        print(g["ext"], "@", g["dom"], "HTTP", code, flush=True)
        if code != "200": os.remove(path)
        time.sleep(3.5)
    g["bbr"] = path if os.path.exists(path) else None
    games.append(g)
json.dump(games, open(f"{out_dir}/games-{night}.json", "w"), indent=1)

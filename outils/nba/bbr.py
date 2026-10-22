"""Lecture d'une feuille de match Basketball-Reference : score par quart-temps et lignes des joueurs."""
import re, html

def _clean(v): return html.unescape(re.sub(r"<[^>]+>", "", v)).strip()

def parse(path):
    s = open(path, encoding="utf-8").read().replace("<!--", "").replace("-->", "")
    out = {}
    ls = re.search(r'<table[^>]*id="line_score".*?</table>', s, re.S)
    quarters = {}
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", ls.group(0), re.S):
        cells = re.findall(r'data-stat="(\w+)"[^>]*>(.*?)</t[hd]>', tr, re.S)
        d = {k: _clean(v) for k, v in cells}
        team = d.get("team")
        if team and team.isupper() and len(team) == 3:
            per = [int(d[k]) for k in sorted((k for k in d if re.fullmatch(r"\d+", k)), key=int)]
            ots = [int(v) for k, v in d.items() if re.fullmatch(r"\d?OT", k)]
            quarters[team] = {"q": per[:4], "ot": sum(per[4:]) + sum(ots), "total": int(d["T"])}
    out["quarters"] = quarters
    players = {}
    for team, tbl in re.findall(r'<table[^>]*id="box-(\w+)-game-basic".*?(<tbody>.*?</tbody>)', s, re.S):
        rows = []
        for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", tbl, re.S):
            d = {k: _clean(v) for k, v in re.findall(r'data-stat="(\w+)"[^>]*>(.*?)</t[hd]>', tr, re.S)}
            if not d.get("player") or d["player"] == "Reserves" or "mp" not in d or ":" not in d["mp"]:
                continue
            g = lambda k: int(d.get(k) or 0)
            m, sec = map(int, d["mp"].split(":"))
            rows.append({"nom": d["player"], "mp": d["mp"], "secs": m * 60 + sec, "pts": g("pts"), "reb": g("trb"), "ast": g("ast"),
                         "stl": g("stl"), "blk": g("blk"), "tp": g("fg3"), "tov": g("tov")})
        players[team] = rows
    out["players"] = players
    return out

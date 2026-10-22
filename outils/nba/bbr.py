"""Lecture d'une feuille de match Basketball-Reference : tout ce que la page donne.

parse(path) renvoie :
  start      heure de début, heure de New York (« 7:00 PM October 21, 2026 »)
  quarters   {équipe: {q: [4 quarts-temps], ot: points en prolongation, total}}
  players    {équipe: [lignes du match : nom, mp, secs, titulaire, et les stats de BASIC]}
  periods    {équipe: {"q1".."q4", "ot1"..: {nom: lignes du quart-temps}}}
  totals     {équipe: {"game", "q1".., "ot1"..: totaux de l'équipe}}
  advanced   {équipe: {nom: stats avancées}}   et advanced_team {équipe: stats avancées de l'équipe}
  factors    {équipe: four factors (rythme, eFG%, TOV%, ORB%, LF/tirs, ORtg)}
  dnp        {équipe: [{nom, raison}]}         joueurs en tenue qui n'ont pas joué
  inactive   {équipe: [noms]}
  officials, attendance, duration
"""
import re, html

BASIC = {"fg": "fgm", "fga": "fga", "fg3": "tp", "fg3a": "tpa", "ft": "ftm", "fta": "fta", "orb": "oreb", "drb": "dreb",
         "trb": "reb", "ast": "ast", "stl": "stl", "blk": "blk", "tov": "tov", "pf": "pf", "pts": "pts",
         "game_score": "gmsc", "plus_minus": "pm"}
ADVANCED = {"ts_pct": "ts", "efg_pct": "efg", "fg3a_per_fga_pct": "tpar", "fta_per_fga_pct": "ftr", "orb_pct": "orbp",
            "drb_pct": "drbp", "trb_pct": "trbp", "ast_pct": "astp", "stl_pct": "stlp", "blk_pct": "blkp", "tov_pct": "tovp",
            "usg_pct": "usg", "off_rtg": "ortg", "def_rtg": "drtg", "bpm": "bpm"}
FACTORS = {"pace": "rythme", "efg_pct": "efg", "tov_pct": "tovp", "orb_pct": "orbp", "ft_rate": "lf_par_tir", "off_rtg": "ortg"}


def _clean(v):
    return html.unescape(re.sub(r"<[^>]+>", "", v)).strip()


def _num(v):
    if v in (None, ""):
        return None
    try:
        f = float(v)
    except ValueError:
        return None
    return int(f) if re.fullmatch(r"[+-]?\d+", v) else f


def _table(s, tid):
    m = re.search(r'<table[^>]*id="%s".*?</table>' % re.escape(tid), s, re.S)
    return m.group(0) if m else None


def _rows(tbl):
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", tbl, re.S):
        yield {k: _clean(v) for k, v in re.findall(r'data-stat="(\w+)"[^>]*>(.*?)</t[hd]>', tr, re.S)}


def _secs(mp):
    m, s = mp.split(":")
    return int(m) * 60 + int(s)


def _box(tbl, cols):
    """Lignes des joueurs (titulaires d'abord), totaux de l'équipe, joueurs sans minute avec la raison."""
    players, totals, dnp, section = [], None, [], "Starters"
    for d in _rows(tbl):
        name = d.get("player")
        if not name or name == "Player":
            continue
        if name in ("Starters", "Reserves"):
            section = name
            continue
        vals = {k2: _num(d.get(k1)) for k1, k2 in cols.items() if k1 in d}
        if name == "Team Totals":
            totals = vals
            continue
        if "reason" in d or ":" not in d.get("mp", ""):
            dnp.append({"nom": name, "raison": d.get("reason") or "Did Not Play"})
            continue
        players.append({"nom": name, "mp": d["mp"], "secs": _secs(d["mp"]), "titulaire": section == "Starters", **vals})
    return players, totals, dnp


def _text_between(text, start, ends):
    i = text.find(start)
    if i < 0:
        return None
    j = min([k for k in (text.find(e, i + len(start)) for e in ends) if k > 0] or [i + 400])
    return text[i + len(start):j].strip()


def parse(path):
    s = open(path, encoding="utf-8").read().replace("<!--", "").replace("-->", "")
    out = {}
    st = re.search(r"(\d{1,2}:\d{2} (?:AM|PM)), ([A-Z][a-z]+ \d{1,2}, \d{4})", s)
    out["start"] = f"{st.group(1)} {st.group(2)}" if st else None

    quarters = {}
    for d in _rows(_table(s, "line_score") or ""):
        team = d.get("team")
        if team and team.isupper() and len(team) == 3:
            per = [int(d[k]) for k in sorted((k for k in d if re.fullmatch(r"\d+", k)), key=int)]
            ots = [int(v) for k, v in d.items() if re.fullmatch(r"\d?OT", k) and v]
            quarters[team] = {"q": per[:4], "ot": sum(per[4:]) + sum(ots), "total": int(d["T"])}
    out["quarters"] = quarters

    teams = re.findall(r'<table[^>]*id="box-(\w+)-game-basic"', s)
    out.update(players={}, periods={}, totals={}, advanced={}, advanced_team={}, dnp={})
    for t in teams:
        players, totals, dnp = _box(_table(s, f"box-{t}-game-basic"), BASIC)
        out["players"][t], out["dnp"][t] = players, dnp
        out["totals"][t] = {"game": totals}
        out["periods"][t] = {}
        for per in re.findall(r'<table[^>]*id="box-%s-((?:q[1-4])|(?:ot\d+))-basic"' % t, s):
            pp, tot, _ = _box(_table(s, f"box-{t}-{per}-basic"), BASIC)
            out["periods"][t][per] = {p["nom"]: p for p in pp}
            out["totals"][t][per] = tot
        adv = _table(s, f"box-{t}-game-advanced")
        if adv:
            ap, at, _ = _box(adv, ADVANCED)
            out["advanced"][t] = {p["nom"]: {k: p[k] for k in ADVANCED.values() if k in p} for p in ap}
            out["advanced_team"][t] = at
    out["factors"] = {}
    for d in _rows(_table(s, "four_factors") or ""):
        if d.get("team_id") in teams:
            out["factors"][d["team_id"]] = {k2: _num(d.get(k1)) for k1, k2 in FACTORS.items()}

    text = " ".join(html.unescape(re.sub(r"<[^>]+>", " ", s)).split())
    inactive = _text_between(text, "Inactive:", ["Officials:", "Attendance:", "Time of Game:"]) or ""
    out["inactive"] = {}
    parts = re.split(r"\b(%s)\b" % "|".join(teams), inactive) if teams else []
    for i in range(1, len(parts) - 1, 2):
        out["inactive"][parts[i]] = [n.strip() for n in parts[i + 1].split(",") if n.strip()]
    off = _text_between(text, "Officials:", ["Attendance:", "Time of Game:", "Inactive:"])
    out["officials"] = [n.strip() for n in off.split(",") if n.strip()] if off else []
    att = re.search(r"Attendance: ([\d,]+)", text)
    out["attendance"] = int(att.group(1).replace(",", "")) if att else None
    dur = re.search(r"Time of Game: (\d+:\d{2})", text)
    out["duration"] = dur.group(1) if dur else None
    return out

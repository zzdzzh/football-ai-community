# -*- coding: utf-8 -*-
"""FBRef 球员统计：优先 soccerdata，失败时回退 Playwright。"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from typing import Any, Optional

from scraper.leagues import LeagueConfig

# 项目联赛 code → soccerdata FBref leagues 名
SOCCERDATA_LEAGUE: dict[str, str] = {
    "PL": "ENG-Premier League",
    "PD": "ESP-La Liga",
    "BL1": "GER-Bundesliga",
    "SA": "ITA-Serie A",
    "FL1": "FRA-Ligue 1",
    "WC": "INT-World Cup",
}


@dataclass
class FbrefPlayerStat:
    fbref_id: str
    name: str
    goals: Optional[int]
    assists: Optional[int]
    minutes: Optional[int]
    xg: Optional[float]
    xa: Optional[float]
    appearances: Optional[int] = None
    age: Optional[int] = None
    born: Optional[int] = None
    team: Optional[str] = None
    extra_stats: dict[str, Any] = field(default_factory=dict)


def _soccerdata_available() -> bool:
    try:
        import soccerdata  # noqa: F401
        return True
    except ImportError:
        return False


def _playwright_available() -> bool:
    try:
        import playwright  # noqa: F401
        return True
    except ImportError:
        return False


def _to_int(val: Any) -> Optional[int]:
    if val is None:
        return None
    try:
        if isinstance(val, str):
            val = val.replace(",", "").strip()
            if not val:
                return None
        return int(float(val))
    except (TypeError, ValueError):
        return None


def _to_float(val: Any) -> Optional[float]:
    if val is None:
        return None
    try:
        if isinstance(val, str):
            val = val.replace(",", "").strip()
            if not val:
                return None
        return float(val)
    except (TypeError, ValueError):
        return None


def _scalar(val: Any) -> Any:
    if val is None:
        return None
    try:
        import pandas as pd

        if isinstance(val, pd.Series):
            if val.empty:
                return None
            val = val.iloc[0]
        if isinstance(val, pd.Timestamp):
            return val
        if pd.isna(val):
            return None
    except ImportError:
        pass
    return val


def _col(row: Any, *names: str, group: str | None = None) -> Any:
    """兼容 MultiIndex / 扁平行取值。group 可指定如 Performance / Playing Time。"""
    candidates: list[Any] = []
    for name in names:
        if group:
            candidates.append((group, name))
        candidates.append((name, ""))
        candidates.append(name)
    for key in candidates:
        try:
            if key in row.index:
                return _scalar(row[key])
        except TypeError:
            continue
    if group:
        return None
    for name in names:
        for key in row.index:
            if not isinstance(key, tuple):
                continue
            if key[-1] == name and key[0] != "Per 90 Minutes":
                return _scalar(row[key])
            if key[0] == name and (len(key) == 1 or key[1] in ("", name)):
                return _scalar(row[key])
    return None


def soccerdata_season_code(season_year: int) -> str:
    """开赛年 → soccerdata 赛季码，如 2024 → '2425'。"""
    return f"{season_year % 100:02d}{(season_year + 1) % 100:02d}"


def _player_key(name: Any, team: Any = None) -> str:
    base = str(name or "").strip().lower()
    if team is not None:
        return f"{base}|{str(team).strip().lower()}"
    return base


def _merge_extra(target: dict[str, Any], **kwargs: Any) -> None:
    for key, value in kwargs.items():
        if value is None:
            continue
        target[key] = value


def _fetch_via_soccerdata(
    league: LeagueConfig, season_year: int
) -> list[FbrefPlayerStat]:
    sd_league = SOCCERDATA_LEAGUE.get(league.code)
    if not sd_league or not _soccerdata_available():
        return []

    import soccerdata as sd

    seasons_to_try = [soccerdata_season_code(season_year)]
    prev = soccerdata_season_code(season_year - 1)
    if prev not in seasons_to_try:
        seasons_to_try.append(prev)

    # 单联赛偶发拉空时，回退五大联赛合表再按 league 过滤
    league_attempts = [sd_league, "Big 5 European Leagues Combined"]

    for season_code in seasons_to_try:
        for league_name in league_attempts:
            try:
                fbref = sd.FBref(leagues=league_name, seasons=season_code)
                standard = fbref.read_player_season_stats(stat_type="standard")
                if standard is None or standard.empty:
                    continue
                if league_name.startswith("Big 5") and "league" in (standard.index.names or []):
                    standard = standard.xs(sd_league, level="league", drop_level=False)
                    if standard.empty:
                        continue

                extras: dict[str, Any] = {}
                for stat_type in ("shooting", "misc", "keeper", "playing_time"):
                    try:
                        df = fbref.read_player_season_stats(stat_type=stat_type)
                        if df is None or df.empty:
                            continue
                        if league_name.startswith("Big 5") and "league" in (df.index.names or []):
                            df = df.xs(sd_league, level="league", drop_level=False)
                        extras[stat_type] = df
                    except Exception:  # noqa: BLE001
                        continue

                stats = _dataframe_to_stats(standard, extras)
                if stats:
                    return stats
            except Exception:  # noqa: BLE001 — 回退下一来源
                continue
    return []


def _dataframe_to_stats(
    standard_df: Any, extra_dfs: dict[str, Any] | None = None
) -> list[FbrefPlayerStat]:
    extra_dfs = extra_dfs or {}
    by_key: dict[str, dict[str, Any]] = {}

    def ensure(name: str, team: Any = None) -> dict[str, Any]:
        key = _player_key(name, team)
        if key not in by_key:
            by_key[key] = {
                "name": str(name).strip(),
                "team": str(team).strip() if team is not None else None,
                "extra": {},
            }
        return by_key[key]

    for _, row in standard_df.reset_index().iterrows():
        name = _col(row, "player")
        if name is None:
            continue
        name_str = str(name).strip()
        if not name_str:
            continue
        team_val = _col(row, "team")
        bucket = ensure(name_str, team_val)
        bucket.update(
            {
                "goals": _to_int(_col(row, "Gls", group="Performance")),
                "assists": _to_int(_col(row, "Ast", group="Performance")),
                "minutes": _to_int(_col(row, "Min", group="Playing Time")),
                "appearances": _to_int(_col(row, "MP", group="Playing Time")),
                "age": _to_int(_col(row, "age")),
                "born": _to_int(_col(row, "born")),
            }
        )
        _merge_extra(
            bucket["extra"],
            starts=_to_int(_col(row, "Starts", group="Playing Time")),
            yellowCards=_to_int(_col(row, "CrdY", group="Performance")),
            redCards=_to_int(_col(row, "CrdR", group="Performance")),
        )

    shooting = extra_dfs.get("shooting")
    if shooting is not None and not shooting.empty:
        for _, row in shooting.reset_index().iterrows():
            name = _col(row, "player")
            if name is None:
                continue
            bucket = ensure(str(name).strip(), _col(row, "team"))
            _merge_extra(
                bucket["extra"],
                shots=_to_int(_col(row, "Sh", group="Standard")),
                shotsOnTarget=_to_int(_col(row, "SoT", group="Standard")),
            )

    misc = extra_dfs.get("misc")
    if misc is not None and not misc.empty:
        for _, row in misc.reset_index().iterrows():
            name = _col(row, "player")
            if name is None:
                continue
            bucket = ensure(str(name).strip(), _col(row, "team"))
            _merge_extra(
                bucket["extra"],
                interceptions=_to_int(_col(row, "Int", group="Performance")),
                tacklesWon=_to_int(_col(row, "TklW", group="Performance")),
            )

    keeper = extra_dfs.get("keeper")
    if keeper is not None and not keeper.empty:
        for _, row in keeper.reset_index().iterrows():
            name = _col(row, "player")
            if name is None:
                continue
            bucket = ensure(str(name).strip(), _col(row, "team"))
            _merge_extra(
                bucket["extra"],
                saves=_to_int(_col(row, "Saves", group="Performance")),
                cleanSheets=_to_int(_col(row, "CS", group="Performance")),
                goalsAgainst=_to_int(_col(row, "GA", group="Performance")),
            )

    playing_time = extra_dfs.get("playing_time")
    if playing_time is not None and not playing_time.empty:
        for _, row in playing_time.reset_index().iterrows():
            name = _col(row, "player")
            if name is None:
                continue
            bucket = ensure(str(name).strip(), _col(row, "team"))
            _merge_extra(
                bucket["extra"],
                plusMinus=_to_int(_col(row, "+/-", group="Team Success")),
            )

    stats: list[FbrefPlayerStat] = []
    for bucket in by_key.values():
        if not bucket.get("name"):
            continue
        stats.append(
            FbrefPlayerStat(
                fbref_id="",
                name=bucket["name"],
                goals=bucket.get("goals"),
                assists=bucket.get("assists"),
                minutes=bucket.get("minutes"),
                xg=None,
                xa=None,
                appearances=bucket.get("appearances"),
                age=bucket.get("age"),
                born=bucket.get("born"),
                team=bucket.get("team"),
                extra_stats=bucket.get("extra") or {},
            )
        )
    return stats


def _fetch_via_playwright(league: LeagueConfig) -> list[FbrefPlayerStat]:
    if not _playwright_available():
        return []

    from playwright.sync_api import sync_playwright

    url = f"https://fbref.com/en/comps/{league.fbref_comp_id}/stats/players/"
    stats: list[FbrefPlayerStat] = []

    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(url, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(3000)
            html = page.content()
            browser.close()
    except Exception:
        return []

    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "lxml")
    table = soup.select_one("table#stats_standard")
    if not table:
        return []

    for row in table.select("tbody tr"):
        player_cell = row.select_one("th[data-stat='player'] a")
        if not player_cell:
            continue
        href = player_cell.get("href", "")
        match = re.search(r"/players/([a-f0-9]+)/", href)
        if not match:
            continue

        def cell(stat: str) -> str:
            el = row.select_one(f"[data-stat='{stat}']")
            return el.get_text(strip=True) if el else ""

        age = _to_int(cell("age"))
        # FBref age 有时是 "25-123" 形式
        if age is None and cell("age"):
            age = _to_int(cell("age").split("-")[0])

        extra: dict[str, Any] = {}
        _merge_extra(
            extra,
            starts=_to_int(cell("games_starts") or cell("starts")),
            yellowCards=_to_int(cell("cards_yellow")),
            redCards=_to_int(cell("cards_red")),
        )

        stats.append(
            FbrefPlayerStat(
                fbref_id=match.group(1),
                name=player_cell.get_text(strip=True),
                goals=_to_int(cell("goals")),
                assists=_to_int(cell("assists")),
                minutes=_to_int(cell("minutes")),
                xg=_to_float(cell("xg")),
                xa=_to_float(cell("xa")),
                appearances=_to_int(cell("games") or cell("mp")),
                age=age,
                born=_to_int(cell("born")),
                extra_stats=extra,
            )
        )
    return stats


def fetch_league_player_stats(
    league: LeagueConfig, season_year: int | None = None
) -> list[FbrefPlayerStat]:
    """拉取联赛球员赛季统计。优先 soccerdata，否则 Playwright。"""
    year = season_year
    if year is None:
        from datetime import datetime

        now = datetime.now()
        year = now.year if now.month >= 7 else now.year - 1

    stats = _fetch_via_soccerdata(league, year)
    if stats:
        return stats
    return _fetch_via_playwright(league)


def fbref_stat_to_payload(stat: FbrefPlayerStat, league_code: str, season: str) -> dict[str, Any]:
    """序列化为 Node 侧 mergeFbrefStatsForLeague 入参。"""
    data = asdict(stat)
    extra = data.pop("extra_stats", {}) or {}
    return {
        "fbrefId": data.get("fbref_id") or None,
        "name": data["name"],
        "goals": data.get("goals"),
        "assists": data.get("assists"),
        "minutes": data.get("minutes"),
        "xg": data.get("xg"),
        "xa": data.get("xa"),
        "appearances": data.get("appearances"),
        "age": data.get("age"),
        "born": data.get("born"),
        "team": data.get("team"),
        "extraStats": extra or None,
        "leagueCode": league_code,
        "season": season,
    }

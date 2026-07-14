# -*- coding: utf-8 -*-
"""SofaScore API 比赛与球队解析。"""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional

from scraper.http import fetch_json
from scraper.leagues import LeagueConfig

SOFA_STATUS_MAP = {
    "finished": "FINISHED",
    "inprogress": "LIVE",
    "notstarted": "SCHEDULED",
    "postponed": "POSTPONED",
    "canceled": "CANCELLED",
    "cancelled": "CANCELLED",
    "suspended": "POSTPONED",
}


@dataclass
class SofaTeam:
    sofascore_id: str
    name: str
    short_name: Optional[str]


@dataclass
class SofaPlayer:
    sofascore_id: str
    name: str
    position: Optional[str]
    date_of_birth: Optional[str]
    nationality: Optional[str]
    team_sofascore_id: str


@dataclass
class SofaMatch:
    sofascore_id: str
    league_code: str
    season: str
    matchday: Optional[int]
    utc_date: str
    status: str
    home_team: SofaTeam
    away_team: SofaTeam
    home_score: Optional[int]
    away_score: Optional[int]


def _resolve_current_season_id(league: LeagueConfig) -> tuple[int, str]:
    data = fetch_json(
        f"https://api.sofascore.com/api/v1/unique-tournament/"
        f"{league.sofascore_tournament_id}/seasons"
    )
    seasons = data.get("seasons") or []
    if not seasons:
        raise RuntimeError(f"SofaScore 未返回赛季: {league.code}")
    if league.code == "WC":
        target_year = os.environ.get("FOOTBALL_DATA_WC_SEASON", str(datetime.now().year))
        for season in seasons:
            year_label = str(season.get("year") or season.get("name", ""))
            if target_year in year_label:
                return season["id"], year_label
        return seasons[0]["id"], seasons[0].get("year") or seasons[0].get("name", "")
    # 俱乐部赛事：列表通常按时间倒序，取第二个为当前活跃赛季
    season = seasons[1] if len(seasons) > 1 else seasons[0]
    return season["id"], season.get("year") or season.get("name", "")


def fetch_tournament_teams(league: LeagueConfig) -> list[SofaTeam]:
    season_id, _ = _resolve_current_season_id(league)
    data = fetch_json(
        f"https://api.sofascore.com/api/v1/unique-tournament/"
        f"{league.sofascore_tournament_id}/season/{season_id}/teams"
    )
    teams = data.get("teams") or []
    return [_map_team(team) for team in teams if team.get("id")]


def _timestamp_to_iso(timestamp: Optional[int]) -> Optional[str]:
    if not timestamp:
        return None
    return datetime.fromtimestamp(timestamp, tz=timezone.utc).strftime("%Y-%m-%d")


def fetch_team_squad(team_id: str, team_name: str) -> list[SofaPlayer]:
    data = fetch_json(f"https://api.sofascore.com/api/v1/team/{team_id}/players")
    players: list[SofaPlayer] = []
    for item in data.get("players") or []:
        player = item.get("player") or {}
        player_id = player.get("id")
        if not player_id:
            continue
        country = player.get("country") or {}
        players.append(
            SofaPlayer(
                sofascore_id=str(player_id),
                name=player.get("name") or player.get("shortName") or "Unknown",
                position=player.get("position"),
                date_of_birth=_timestamp_to_iso(player.get("dateOfBirthTimestamp")),
                nationality=country.get("name") or team_name,
                team_sofascore_id=str(team_id),
            )
        )
    return players


def fetch_league_matches(league: LeagueConfig) -> list[SofaMatch]:
    season_id, season_label = _resolve_current_season_id(league)
    matches: list[SofaMatch] = []
    page = 0
    while True:
        data = fetch_json(
            f"https://api.sofascore.com/api/v1/unique-tournament/"
            f"{league.sofascore_tournament_id}/season/{season_id}/events/last/{page}"
        )
        events = data.get("events") or []
        for event in events:
            parsed = _map_event(event, league.code, season_label)
            if parsed:
                matches.append(parsed)
        if not data.get("hasNextPage"):
            break
        page += 1
        if page > 30:
            break
    return matches


def fetch_league_top_players(league: LeagueConfig) -> list[dict[str, Any]]:
    """拉取联赛 top players，合并评分/进球/助攻榜为去重球员统计。"""
    season_id, season_label = _resolve_current_season_id(league)
    try:
        data = fetch_json(
            f"https://api.sofascore.com/api/v1/unique-tournament/"
            f"{league.sofascore_tournament_id}/season/{season_id}/top-players/overall"
        )
    except RuntimeError:
        return []

    top_players = data.get("topPlayers") or {}
    by_id: dict[str, dict[str, Any]] = {}
    # 优先 rating / goals / assists；其余类别仅补充缺字段
    preferred = ("rating", "goals", "assists", "expectedGoals", "keyPasses", "tackles")
    category_keys = list(preferred) + [k for k in top_players.keys() if k not in preferred]

    for category in category_keys:
        for entry in top_players.get(category) or []:
            player = entry.get("player") or {}
            player_id = player.get("id")
            if not player_id:
                continue
            key = str(player_id)
            stats = entry.get("statistics") or {}
            current = by_id.get(key)
            if current is None:
                by_id[key] = {
                    "sofascoreId": key,
                    "name": player.get("name") or player.get("shortName") or "Unknown",
                    "teamSofascoreId": str((entry.get("team") or {}).get("id") or "") or None,
                    "leagueCode": league.code,
                    "season": season_label.replace("/", "-"),
                    "goals": _optional_number(stats.get("goals")),
                    "assists": _optional_number(stats.get("assists")),
                    "appearances": _optional_number(
                        stats.get("appearances") or stats.get("matches") or stats.get("count")
                    ),
                    "rating": _optional_number(stats.get("rating")),
                    "minutes": _optional_number(stats.get("minutesPlayed") or stats.get("minutes")),
                }
            else:
                if current.get("goals") is None and stats.get("goals") is not None:
                    current["goals"] = _optional_number(stats.get("goals"))
                if current.get("assists") is None and stats.get("assists") is not None:
                    current["assists"] = _optional_number(stats.get("assists"))
                if current.get("appearances") is None:
                    current["appearances"] = _optional_number(
                        stats.get("appearances") or stats.get("matches") or stats.get("count")
                    )
                if current.get("rating") is None and stats.get("rating") is not None:
                    current["rating"] = _optional_number(stats.get("rating"))
                if current.get("minutes") is None:
                    current["minutes"] = _optional_number(
                        stats.get("minutesPlayed") or stats.get("minutes")
                    )
    return list(by_id.values())


def fetch_match_detail(match_id: str) -> dict[str, Any]:
    data = fetch_json(f"https://api.sofascore.com/api/v1/event/{match_id}")
    event = data.get("event") or data
    statistics = None
    incidents = None
    lineups = None
    try:
        statistics = fetch_json(f"https://api.sofascore.com/api/v1/event/{match_id}/statistics")
    except RuntimeError:
        statistics = None
    try:
        incidents = fetch_json(f"https://api.sofascore.com/api/v1/event/{match_id}/incidents")
    except RuntimeError:
        incidents = None
    try:
        lineups = fetch_json(f"https://api.sofascore.com/api/v1/event/{match_id}/lineups")
    except RuntimeError:
        lineups = None
    return {
        "event": event,
        "statistics": statistics,
        "incidents": incidents,
        "lineups": lineups,
    }


def _optional_number(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number.is_integer():
        return int(number)
    return round(number, 2)


def _map_team(team: dict[str, Any]) -> SofaTeam:
    return SofaTeam(
        sofascore_id=str(team["id"]),
        name=team.get("name") or team.get("shortName") or "Unknown",
        short_name=team.get("shortName"),
    )


def _map_event(event: dict[str, Any], league_code: str, season_label: str) -> Optional[SofaMatch]:
    home = event.get("homeTeam")
    away = event.get("awayTeam")
    if not home or not away:
        return None

    status_type = (event.get("status") or {}).get("type", "notstarted")
    status = SOFA_STATUS_MAP.get(status_type.lower(), "SCHEDULED")

    home_score = _extract_score(event.get("homeScore"))
    away_score = _extract_score(event.get("awayScore"))

    start_ts = event.get("startTimestamp")
    if start_ts:
        utc_date = datetime.fromtimestamp(start_ts, tz=timezone.utc).isoformat().replace("+00:00", "Z")
    else:
        utc_date = datetime.now(tz=timezone.utc).isoformat().replace("+00:00", "Z")

    round_info = event.get("roundInfo") or {}
    matchday = round_info.get("round")

    return SofaMatch(
        sofascore_id=str(event["id"]),
        league_code=league_code,
        season=season_label.replace("/", "-"),
        matchday=matchday,
        utc_date=utc_date,
        status=status,
        home_team=_map_team(home),
        away_team=_map_team(away),
        home_score=home_score,
        away_score=away_score,
    )


def _extract_score(score: Optional[dict[str, Any]]) -> Optional[int]:
    if not score:
        return None
    current = score.get("current")
    if current is None:
        current = score.get("display")
    if current is None:
        return None
    try:
        return int(current)
    except (TypeError, ValueError):
        return None

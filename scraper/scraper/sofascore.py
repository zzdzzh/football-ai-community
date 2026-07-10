# -*- coding: utf-8 -*-
"""SofaScore API 比赛与球队解析。"""

from __future__ import annotations

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
    # 优先当前赛季（列表通常按时间倒序，取第二个为 25/26 活跃赛季）
    season = seasons[1] if len(seasons) > 1 else seasons[0]
    return season["id"], season.get("year") or season.get("name", "")


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


def fetch_match_detail(match_id: str) -> dict[str, Any]:
    data = fetch_json(f"https://api.sofascore.com/api/v1/event/{match_id}")
    event = data.get("event") or data
    statistics = None
    incidents = None
    try:
        statistics = fetch_json(f"https://api.sofascore.com/api/v1/event/{match_id}/statistics")
    except RuntimeError:
        statistics = None
    try:
        incidents = fetch_json(f"https://api.sofascore.com/api/v1/event/{match_id}/incidents")
    except RuntimeError:
        incidents = None
    return {"event": event, "statistics": statistics, "incidents": incidents}


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

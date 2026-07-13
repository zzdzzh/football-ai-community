# -*- coding: utf-8 -*-
"""合并三站数据，输出 Node 适配器可消费的 JSON。"""

from __future__ import annotations

import os
from datetime import datetime

from scraper.fbref import fetch_league_player_stats
from scraper.leagues import LeagueConfig, get_league
from scraper.sofascore import fetch_league_matches
from scraper.transfermarkt import fetch_league_teams, fetch_team_squad

WC_NAME_ALIASES: dict[str, list[str]] = {
    "United States": ["United States", "USA"],
    "South Korea": ["South Korea", "Korea Republic"],
    "Congo DR": ["Congo DR", "DR Congo"],
    "Ivory Coast": ["Ivory Coast", "Cote d'Ivoire"],
    "Cape Verde Islands": ["Cape Verde Islands", "Cape Verde"],
    "Bosnia-Herzegovina": ["Bosnia-Herzegovina", "Bosnia and Herzegovina"],
    "Curaçao": ["Curaçao", "Curacao"],
}


def _tm_dob_to_iso(dob: str | None) -> str | None:
    if not dob:
        return None
    try:
        day, month, year = dob.split(".")
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    except ValueError:
        return None


def _normalize_name(name: str) -> str:
    return " ".join(name.lower().replace("fc", "").replace(".", "").split())


def _team_match_keys(name: str) -> list[str]:
    keys = [_normalize_name(name)]
    for aliases in WC_NAME_ALIASES.values():
        normalized_aliases = [_normalize_name(alias) for alias in aliases]
        if _normalize_name(name) in normalized_aliases:
            keys.extend(normalized_aliases)
            break
    return list(dict.fromkeys(keys))


def _resolve_season_year(league: LeagueConfig) -> int:
    if league.code == "WC":
        return int(os.environ.get("FOOTBALL_DATA_WC_SEASON", str(datetime.now().year)))
    return datetime.now().year if datetime.now().month >= 7 else datetime.now().year - 1


def _find_sofa_team(sofa_team_map: dict[str, dict], team_name: str) -> dict:
    for key in _team_match_keys(team_name):
        if key in sofa_team_map:
            return sofa_team_map[key]
    return {}


def sync_league(league_code: str, *, include_fbref: bool = True, players_only: bool = False) -> dict:
    league = get_league(league_code)
    season_year = _resolve_season_year(league)

    tm_teams = fetch_league_teams(league)
    sofa_matches: list = []
    if not (players_only and league.code == "WC"):
        sofa_matches = fetch_league_matches(league)

    sofa_team_map: dict[str, dict] = {}
    for match in sofa_matches:
        for team in (match.home_team, match.away_team):
            for key in _team_match_keys(team.name):
                sofa_team_map.setdefault(key, {
                    "sofascoreId": team.sofascore_id,
                    "name": team.name,
                    "shortName": team.short_name,
                })

    teams: list[dict] = []
    for tm_team in tm_teams:
        sofa = _find_sofa_team(sofa_team_map, tm_team.name)
        teams.append({
            "name": sofa.get("name") or tm_team.name,
            "shortName": sofa.get("shortName") or tm_team.name,
            "sofascoreId": sofa.get("sofascoreId"),
            "transfermarktId": tm_team.transfermarkt_id,
            "leagueCode": league.code,
            "transfermarktName": tm_team.name,
        })

    players: list[dict] = []
    scorers: list[dict] = []
    squad_errors: list[str] = []
    for tm_team in tm_teams:
        try:
            squad = fetch_team_squad(tm_team, season_year)
        except Exception as err:
            squad_errors.append(f"{tm_team.name}: {err}")
            continue
        for player in squad:
            player_id = f"tm-{player.transfermarkt_id}"
            players.append({
                "id": player_id,
                "name": player.name,
                "transfermarktId": player.transfermarkt_id,
                "teamTransfermarktId": player.team_transfermarkt_id,
                "position": player.position,
                "dateOfBirth": _tm_dob_to_iso(player.date_of_birth),
                "nationality": player.nationality,
                "leagueCode": league.code,
            })
            if player.goals is not None or player.assists is not None or player.appearances is not None:
                scorers.append({
                    "playerId": player_id,
                    "leagueCode": league.code,
                    "season": str(season_year),
                    "goals": player.goals or 0,
                    "assists": player.assists or 0,
                    "penalties": 0,
                    "appearances": player.appearances,
                })

    fbref_stats: list[dict] = []
    if include_fbref and not (players_only and league.code == "WC"):
        for stat in fetch_league_player_stats(league):
            fbref_stats.append({
                "fbrefId": stat.fbref_id,
                "name": stat.name,
                "goals": stat.goals,
                "assists": stat.assists,
                "minutes": stat.minutes,
                "xg": stat.xg,
                "xa": stat.xa,
                "leagueCode": league.code,
                "season": str(season_year),
            })

    matches: list[dict] = []
    for match in sofa_matches:
        matches.append({
            "id": f"ss-{match.sofascore_id}",
            "sofascoreId": match.sofascore_id,
            "leagueCode": match.league_code,
            "season": match.season,
            "matchday": match.matchday,
            "utcDate": match.utc_date,
            "status": match.status,
            "homeTeam": {
                "sofascoreId": match.home_team.sofascore_id,
                "name": match.home_team.name,
                "shortName": match.home_team.short_name,
            },
            "awayTeam": {
                "sofascoreId": match.away_team.sofascore_id,
                "name": match.away_team.name,
                "shortName": match.away_team.short_name,
            },
            "homeScore": match.home_score,
            "awayScore": match.away_score,
            "dataCompleteness": "partial",
        })

    return {
        "leagueCode": league.code,
        "teams": teams,
        "players": players,
        "scorers": scorers,
        "matches": matches,
        "fbrefStats": fbref_stats,
        "squadErrors": squad_errors,
        "sources": {
            "transfermarkt": True,
            "sofascore": True,
            "fbref": len(fbref_stats) > 0,
            "nationalTeams": league.code == "WC",
        },
    }

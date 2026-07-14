# -*- coding: utf-8 -*-
"""合并多站数据，输出 Node 适配器可消费的 JSON。

默认数据源：SofaScore（球队/阵容/比赛/评分）+ 可选 FBref（xG）。
Transfermarkt 因人机验证不稳定，默认关闭；需显式 --transfermarkt 开启。
"""

from __future__ import annotations

import os
from datetime import datetime

from scraper.fbref import fetch_league_player_stats, fbref_stat_to_payload
from scraper.leagues import LeagueConfig, get_league
from scraper.sofascore import (
    fetch_league_matches,
    fetch_league_top_players,
    fetch_tournament_teams,
    fetch_team_squad as fetch_sofa_team_squad,
)
from scraper.transfermarkt import fetch_league_teams, fetch_team_squad as fetch_tm_team_squad

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


def _env_use_transfermarkt() -> bool:
    return os.environ.get("SCRAPER_USE_TRANSFERMARKT", "0").strip().lower() in {"1", "true", "yes", "on"}


def _link_sofascore_ids(players: list[dict], teams: list[dict]) -> int:
    """用 SofaScore 阵容按姓名回填 Transfermarkt 球员 sofascoreId。"""
    linked = 0
    for team in teams:
        sofa_id = team.get("sofascoreId")
        if not sofa_id:
            continue
        team_tm_id = str(team.get("transfermarktId") or "")
        try:
            sofa_squad = fetch_sofa_team_squad(str(sofa_id), team.get("name") or "")
        except Exception:
            continue

        sofa_by_name: dict[str, str] = {}
        for sp in sofa_squad:
            for key in _team_match_keys(sp.name):
                sofa_by_name.setdefault(key, sp.sofascore_id)

        for player in players:
            if player.get("sofascoreId"):
                continue
            if team_tm_id and str(player.get("teamTransfermarktId") or "") != team_tm_id:
                continue
            for key in _team_match_keys(player.get("name") or ""):
                sofa_player_id = sofa_by_name.get(key)
                if sofa_player_id:
                    player["sofascoreId"] = sofa_player_id
                    linked += 1
                    break
    return linked


def _sync_squad_from_sofascore(
    league: LeagueConfig, season_year: int
) -> tuple[list[dict], list[dict], list[dict], list[str]]:
    """SofaScore 球队/阵容（默认主路径）。"""
    sofa_teams = fetch_tournament_teams(league)
    teams: list[dict] = []
    players: list[dict] = []
    scorers: list[dict] = []
    squad_errors: list[str] = []

    for sofa_team in sofa_teams:
        teams.append({
            "name": sofa_team.name,
            "shortName": sofa_team.short_name or sofa_team.name,
            "sofascoreId": sofa_team.sofascore_id,
            "transfermarktId": None,
            "leagueCode": league.code,
        })
        try:
            squad = fetch_sofa_team_squad(sofa_team.sofascore_id, sofa_team.name)
        except Exception as err:
            squad_errors.append(f"{sofa_team.name}: {err}")
            continue
        for player in squad:
            player_id = f"ss-{player.sofascore_id}"
            players.append({
                "id": player_id,
                "name": player.name,
                "sofascoreId": player.sofascore_id,
                "teamSofascoreId": player.team_sofascore_id,
                "teamTransfermarktId": None,
                "position": player.position,
                "dateOfBirth": player.date_of_birth,
                "nationality": player.nationality,
                "leagueCode": league.code,
            })
            scorers.append({
                "playerId": player_id,
                "leagueCode": league.code,
                "season": str(season_year),
                "goals": 0,
                "assists": 0,
                "penalties": 0,
                "appearances": None,
            })

    return teams, players, scorers, squad_errors


def _sync_squad_from_transfermarkt(
    league: LeagueConfig,
    season_year: int,
    sofa_matches: list,
) -> tuple[list[dict], list[dict], list[dict], list[str], int]:
    """可选 Transfermarkt 路径（易被人机验证拦截）。"""
    tm_teams = fetch_league_teams(league)
    teams: list[dict] = []
    players: list[dict] = []
    scorers: list[dict] = []
    squad_errors: list[str] = []

    sofa_team_map: dict[str, dict] = {}
    for match in sofa_matches:
        for team in (match.home_team, match.away_team):
            for key in _team_match_keys(team.name):
                sofa_team_map.setdefault(key, {
                    "sofascoreId": team.sofascore_id,
                    "name": team.name,
                    "shortName": team.short_name,
                })
    if not sofa_team_map:
        for sofa_team in fetch_tournament_teams(league):
            for key in _team_match_keys(sofa_team.name):
                sofa_team_map.setdefault(key, {
                    "sofascoreId": sofa_team.sofascore_id,
                    "name": sofa_team.name,
                    "shortName": sofa_team.short_name,
                })

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

    for tm_team in tm_teams:
        try:
            squad = fetch_tm_team_squad(tm_team, season_year)
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
            # 不从 Transfermarkt kader 写入 scorers（易把球衣号等误当进球，污染赛季快照）

    linked = _link_sofascore_ids(players, teams)
    return teams, players, scorers, squad_errors, linked


def sync_league(
    league_code: str,
    *,
    include_fbref: bool = True,
    players_only: bool = False,
    use_transfermarkt: bool | None = None,
) -> dict:
    league = get_league(league_code)
    season_year = _resolve_season_year(league)
    want_tm = _env_use_transfermarkt() if use_transfermarkt is None else use_transfermarkt
    used_transfermarkt = False
    tm_skip_reason: str | None = None

    if league.code == "WC":
        teams, players, scorers, squad_errors = _sync_squad_from_sofascore(league, season_year)
        sofa_matches = [] if players_only else fetch_league_matches(league)
        linked_sofascore_ids = 0
    else:
        sofa_matches = fetch_league_matches(league) if not players_only else []
        linked_sofascore_ids = 0
        squad_errors: list[str] = []

        if want_tm:
            try:
                teams, players, scorers, squad_errors, linked_sofascore_ids = (
                    _sync_squad_from_transfermarkt(league, season_year, sofa_matches)
                )
                used_transfermarkt = True
            except Exception as err:
                # TM 人机验证/拦截时静默降级到 SofaScore，不标 degraded
                teams, players, scorers, squad_errors = _sync_squad_from_sofascore(
                    league, season_year
                )
                used_transfermarkt = False
                tm_skip_reason = str(err)
        else:
            teams, players, scorers, squad_errors = _sync_squad_from_sofascore(
                league, season_year
            )

    sofa_player_stats: list[dict] = []
    try:
        sofa_player_stats = fetch_league_top_players(league)
    except Exception as err:
        squad_errors.append(f"sofaTopPlayers: {err}")

    fbref_stats: list[dict] = []
    if include_fbref and not (players_only and league.code == "WC"):
        for stat in fetch_league_player_stats(league, season_year=season_year):
            fbref_stats.append(
                fbref_stat_to_payload(stat, league.code, str(season_year))
            )

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

    sources = {
        "transfermarkt": used_transfermarkt,
        "sofascore": True,
        "fbref": len(fbref_stats) > 0,
        "sofaTopPlayers": len(sofa_player_stats) > 0,
        "nationalTeams": league.code == "WC",
        "primarySquadSource": "transfermarkt" if used_transfermarkt else "sofascore",
    }
    if tm_skip_reason:
        sources["transfermarktSkipped"] = tm_skip_reason

    return {
        "leagueCode": league.code,
        "teams": teams,
        "players": players,
        "scorers": scorers,
        "matches": matches,
        "fbrefStats": fbref_stats,
        "sofaPlayerStats": sofa_player_stats,
        "linkedSofascoreIds": linked_sofascore_ids,
        "squadErrors": squad_errors,
        "sources": sources,
    }

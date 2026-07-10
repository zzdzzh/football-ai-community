# -*- coding: utf-8 -*-
"""联赛代码与三站数据源 ID 映射。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class LeagueConfig:
    code: str
    name: str
    sofascore_tournament_id: int
    transfermarkt_competition_id: str
    transfermarkt_slug: str
    fbref_comp_id: int


LEAGUES: dict[str, LeagueConfig] = {
    "PL": LeagueConfig(
        code="PL",
        name="Premier League",
        sofascore_tournament_id=17,
        transfermarkt_competition_id="GB1",
        transfermarkt_slug="premier-league",
        fbref_comp_id=9,
    ),
    "PD": LeagueConfig(
        code="PD",
        name="La Liga",
        sofascore_tournament_id=8,
        transfermarkt_competition_id="ES1",
        transfermarkt_slug="laliga",
        fbref_comp_id=12,
    ),
    "BL1": LeagueConfig(
        code="BL1",
        name="Bundesliga",
        sofascore_tournament_id=35,
        transfermarkt_competition_id="L1",
        transfermarkt_slug="bundesliga",
        fbref_comp_id=20,
    ),
    "SA": LeagueConfig(
        code="SA",
        name="Serie A",
        sofascore_tournament_id=23,
        transfermarkt_competition_id="IT1",
        transfermarkt_slug="serie-a",
        fbref_comp_id=11,
    ),
    "FL1": LeagueConfig(
        code="FL1",
        name="Ligue 1",
        sofascore_tournament_id=34,
        transfermarkt_competition_id="FR1",
        transfermarkt_slug="ligue-1",
        fbref_comp_id=13,
    ),
    "CL": LeagueConfig(
        code="CL",
        name="Champions League",
        sofascore_tournament_id=7,
        transfermarkt_competition_id="CL",
        transfermarkt_slug="champions-league",
        fbref_comp_id=8,
    ),
    "WC": LeagueConfig(
        code="WC",
        name="FIFA World Cup",
        sofascore_tournament_id=16,
        transfermarkt_competition_id="FIWC",
        transfermarkt_slug="world-cup",
        fbref_comp_id=1,
    ),
}


def get_league(code: str) -> LeagueConfig:
    league = LEAGUES.get(code)
    if not league:
        raise ValueError(f"不支持的联赛代码: {code}")
    return league


def list_league_codes() -> list[str]:
    return list(LEAGUES.keys())

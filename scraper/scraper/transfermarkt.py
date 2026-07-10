# -*- coding: utf-8 -*-
"""Transfermarkt 球队与球员解析。"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

from bs4 import BeautifulSoup

from scraper.http import fetch_html
from scraper.leagues import LeagueConfig


@dataclass
class TmTeam:
    transfermarkt_id: str
    name: str
    slug: str


@dataclass
class TmPlayer:
    transfermarkt_id: str
    name: str
    position: Optional[str]
    date_of_birth: Optional[str]
    nationality: Optional[str]
    appearances: Optional[int]
    goals: Optional[int]
    assists: Optional[int]
    team_transfermarkt_id: str


def _parse_int(value: str) -> Optional[int]:
    value = (value or "").strip()
    if not value or value == "-":
        return None
    try:
        return int(value)
    except ValueError:
        return None


def fetch_league_teams(league: LeagueConfig) -> list[TmTeam]:
    url = (
        f"https://www.transfermarkt.com/{league.transfermarkt_slug}/"
        f"startseite/wettbewerb/{league.transfermarkt_competition_id}"
    )
    html = fetch_html(url)
    soup = BeautifulSoup(html, "lxml")
    teams: list[TmTeam] = []
    for row in soup.select("table.items tbody tr"):
        link = row.select_one("td.hauptlink a")
        if not link:
            continue
        href = link.get("href", "")
        match = re.search(r"/([^/]+)/startseite/verein/(\d+)", href)
        if not match:
            continue
        teams.append(
            TmTeam(
                transfermarkt_id=match.group(2),
                name=link.get_text(strip=True),
                slug=match.group(1),
            )
        )
    return teams


def fetch_team_squad(team: TmTeam, season_year: int) -> list[TmPlayer]:
    url = (
        f"https://www.transfermarkt.com/{team.slug}/kader/verein/"
        f"{team.transfermarkt_id}/saison_id/{season_year}"
    )
    html = fetch_html(url)
    soup = BeautifulSoup(html, "lxml")
    players: list[TmPlayer] = []

    for row in soup.select("table.items > tbody > tr"):
        name_link = row.select_one("td.posrela td.hauptlink a")
        if not name_link:
            continue
        player_match = re.search(r"/spieler/(\d+)", name_link.get("href", ""))
        if not player_match:
            continue

        position_el = row.select_one("td.posrela table tr:nth-of-type(2) td")
        position = position_el.get_text(strip=True) if position_el else None

        cells = row.select(":scope > td")
        dob = None
        nationality = None
        appearances = None
        goals = None
        assists = None

        for cell in cells:
            text = cell.get_text(strip=True)
            if re.fullmatch(r"\d{2}\.\d{2}\.\d{4}", text):
                dob = text
            elif re.fullmatch(r"\d{2}\.\d{2}\.\d{4} \(\d+\)", text):
                dob = text.split(" ")[0]
            elif cell.select_one("img.flaggenrahmen"):
                nationality = cell.select_one("img.flaggenrahmen").get("title")
            elif re.fullmatch(r"\d+", text):
                if appearances is None:
                    appearances = _parse_int(text)
                elif goals is None:
                    goals = _parse_int(text)
                elif assists is None:
                    assists = _parse_int(text)

        players.append(
            TmPlayer(
                transfermarkt_id=player_match.group(1),
                name=name_link.get_text(strip=True),
                position=position,
                date_of_birth=dob,
                nationality=nationality,
                appearances=appearances,
                goals=goals,
                assists=assists,
                team_transfermarkt_id=team.transfermarkt_id,
            )
        )
    return players

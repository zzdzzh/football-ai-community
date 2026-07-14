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
    if league.code == "WC":
        return fetch_competition_participant_teams(league)
    url = (
        f"https://www.transfermarkt.com/{league.transfermarkt_slug}/"
        f"startseite/wettbewerb/{league.transfermarkt_competition_id}"
    )
    html = fetch_html(url, timeout=60)
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


def fetch_competition_participant_teams(league: LeagueConfig) -> list[TmTeam]:
    """世界杯等国家队赛事：从参赛队页面解析国家队列表。"""
    url = (
        f"https://www.transfermarkt.com/{league.transfermarkt_slug}/"
        f"teilnehmer/pokalwettbewerb/{league.transfermarkt_competition_id}"
    )
    html = fetch_html(url, timeout=60)
    soup = BeautifulSoup(html, "lxml")
    teams: dict[str, TmTeam] = {}
    for link in soup.select('a[href*="/startseite/verein/"]'):
        href = link.get("href", "")
        match = re.search(r"/([^/]+)/startseite/verein/(\d+)", href)
        if not match:
            continue
        transfermarkt_id = match.group(2)
        if transfermarkt_id in teams:
            continue
        name = link.get_text(strip=True)
        if not name:
            continue
        teams[transfermarkt_id] = TmTeam(
            transfermarkt_id=transfermarkt_id,
            name=name,
            slug=match.group(1),
        )
    return list(teams.values())


def fetch_team_squad(team: TmTeam, season_year: int) -> list[TmPlayer]:
    url = (
        f"https://www.transfermarkt.com/{team.slug}/kader/verein/"
        f"{team.transfermarkt_id}/saison_id/{season_year}"
    )
    html = fetch_html(url, timeout=60)
    soup = BeautifulSoup(html, "lxml")
    club_players = _parse_club_squad_rows(soup, team.transfermarkt_id)
    if club_players:
        return club_players
    return _parse_national_squad_rows(soup, team.transfermarkt_id, team.name)


def _parse_club_squad_rows(soup: BeautifulSoup, team_transfermarkt_id: str) -> list[TmPlayer]:
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
        # kader 页数字列常是球衣号等，不是赛季出场/进球；统计一律留给 FBref/Sofa
        for cell in cells:
            text = cell.get_text(strip=True)
            if re.fullmatch(r"\d{2}\.\d{2}\.\d{4}", text):
                dob = text
            elif re.fullmatch(r"\d{2}\.\d{2}\.\d{4} \(\d+\)", text):
                dob = text.split(" ")[0]
            elif cell.select_one("img.flaggenrahmen"):
                nationality = cell.select_one("img.flaggenrahmen").get("title")

        players.append(
            TmPlayer(
                transfermarkt_id=player_match.group(1),
                name=name_link.get_text(strip=True),
                position=position,
                date_of_birth=dob,
                nationality=nationality,
                appearances=None,
                goals=None,
                assists=None,
                team_transfermarkt_id=team_transfermarkt_id,
            )
        )
    return players


def _parse_national_squad_rows(
    soup: BeautifulSoup,
    team_transfermarkt_id: str,
    team_name: str,
) -> list[TmPlayer]:
    players: list[TmPlayer] = []
    seen_ids: set[str] = set()

    for row in soup.select("table.items tbody tr"):
        if not row.select_one("td.rueckennummer"):
            continue
        name_link = row.select_one("a[href*='/spieler/']")
        if not name_link:
            continue
        player_match = re.search(r"/spieler/(\d+)", name_link.get("href", ""))
        if not player_match:
            continue
        player_id = player_match.group(1)
        if player_id in seen_ids:
            continue
        seen_ids.add(player_id)

        position_el = row.select_one("td.rueckennummer")
        position = position_el.get("title") if position_el else None
        if not position:
            inline_text = row.select_one("table.inline-table")
            if inline_text:
                lines = [line.strip() for line in inline_text.get_text("\n", strip=True).split("\n") if line.strip()]
                if len(lines) >= 2:
                    position = lines[1]

        players.append(
            TmPlayer(
                transfermarkt_id=player_match.group(1),
                name=name_link.get_text(strip=True),
                position=position,
                date_of_birth=None,
                nationality=team_name,
                appearances=None,
                goals=None,
                assists=None,
                team_transfermarkt_id=team_transfermarkt_id,
            )
        )
    return players

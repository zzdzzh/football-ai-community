# -*- coding: utf-8 -*-
"""FBRef 球员统计（需 Playwright 绕过 Cloudflare）。"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

from scraper.leagues import LeagueConfig


@dataclass
class FbrefPlayerStat:
    fbref_id: str
    name: str
    goals: Optional[int]
    assists: Optional[int]
    minutes: Optional[int]
    xg: Optional[float]
    xa: Optional[float]


def _playwright_available() -> bool:
    try:
        import playwright  # noqa: F401
        return True
    except ImportError:
        return False


def fetch_league_player_stats(league: LeagueConfig) -> list[FbrefPlayerStat]:
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

    # 解析 stats_table
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

        def to_int(val: str) -> Optional[int]:
            val = val.replace(",", "")
            if not val:
                return None
            try:
                return int(float(val))
            except ValueError:
                return None

        def to_float(val: str) -> Optional[float]:
            if not val:
                return None
            try:
                return float(val.replace(",", ""))
            except ValueError:
                return None

        stats.append(
            FbrefPlayerStat(
                fbref_id=match.group(1),
                name=player_cell.get_text(strip=True),
                goals=to_int(cell("goals")),
                assists=to_int(cell("assists")),
                minutes=to_int(cell("minutes")),
                xg=to_float(cell("xg")),
                xa=to_float(cell("xa")),
            )
        )
    return stats

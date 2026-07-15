# -*- coding: utf-8 -*-
"""Transfermarkt 球员搜索与履历（俱乐部/国家队效力段）解析。"""

from __future__ import annotations

import hashlib
import re
import unicodedata
from typing import Any, Optional
from urllib.parse import quote_plus

from bs4 import BeautifulSoup

from scraper.http import fetch_html, fetch_tm_json

TM_BASE = "https://www.transfermarkt.com"


def _normalize_name(name: str) -> str:
    text = unicodedata.normalize("NFKD", name or "")
    text = "".join(c for c in text if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", text).strip().lower()


def _parse_tm_date(raw: Optional[str]) -> Optional[str]:
    """将 TM 常见日期转为 ISO；无法解析则原样返回。"""
    if not raw:
        return None
    text = raw.strip()
    if not text or text in {"-", "?", "–"}:
        return None
    # dd.mm.yyyy
    m = re.fullmatch(r"(\d{2})\.(\d{2})\.(\d{4})", text)
    if m:
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    # Jul 1, 2015 / 1 Jul 2015
    m = re.fullmatch(
        r"([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})",
        text,
    )
    if m:
        months = {
            "jan": "01",
            "feb": "02",
            "mar": "03",
            "apr": "04",
            "may": "05",
            "jun": "06",
            "jul": "07",
            "aug": "08",
            "sep": "09",
            "oct": "10",
            "nov": "11",
            "dec": "12",
        }
        mon = months.get(m.group(1).lower())
        if mon:
            return f"{m.group(3)}-{mon}-{int(m.group(2)):02d}"
    return text


def _club_id_from(external_id: Optional[str], name: str) -> str:
    if external_id:
        return external_id
    digest = hashlib.sha1(_normalize_name(name).encode("utf-8")).hexdigest()[:16]
    return f"hash:{digest}"


def _extract_player_link(href: str) -> Optional[tuple[str, str]]:
    match = re.search(r"/([^/]+)/profil/spieler/(\d+)", href or "")
    if match:
        return match.group(1), match.group(2)
    match = re.search(r"/([^/]+)/transfers/spieler/(\d+)", href or "")
    if match:
        return match.group(1), match.group(2)
    match = re.search(r"/spieler/(\d+)", href or "")
    if match:
        return "-", match.group(1)
    return None


def search_players(query: str, *, limit: int = 20) -> dict[str, Any]:
    q = (query or "").strip()
    if not q:
        return {"items": [], "source": "transfermarkt"}

    url = (
        f"{TM_BASE}/schnellsuche/ergebnis/schnellsuche"
        f"?query={quote_plus(q)}&x=0&y=0"
    )
    html = fetch_html(url, timeout=30)
    soup = BeautifulSoup(html, "lxml")

    items: list[dict[str, Any]] = []
    seen: set[str] = set()

    # 球员结果表：优先含 spieler 链接的 table.items
    for table in soup.select("div.box table.items"):
        header = table.find_previous(["h2", "div"])
        header_text = header.get_text(" ", strip=True).lower() if header else ""
        if header_text and "player" not in header_text and "spieler" not in header_text:
            # 仍可能是球员表；若行内无 spieler 链接则跳过
            pass

        for row in table.select("tbody > tr"):
            link = row.select_one('a[href*="/spieler/"]')
            if not link:
                continue
            parsed = _extract_player_link(link.get("href", ""))
            if not parsed:
                continue
            slug, tm_id = parsed
            if tm_id in seen:
                continue
            seen.add(tm_id)

            cells = [c.get_text(" ", strip=True) for c in row.select(":scope > td")]
            dob = None
            club_hint = None
            for cell in cells:
                if re.search(r"\d{2}\.\d{2}\.\d{4}", cell):
                    dob = _parse_tm_date(re.search(r"\d{2}\.\d{2}\.\d{4}", cell).group(0))
                elif re.fullmatch(r"\d{4}", cell):
                    dob = cell
            # 俱乐部列常含 verein 链接
            club_link = row.select_one('a[href*="/verein/"]')
            if club_link:
                club_hint = club_link.get("title") or club_link.get_text(strip=True)

            items.append(
                {
                    "externalId": tm_id,
                    "slug": slug,
                    "name": link.get_text(strip=True) or link.get("title") or "",
                    "dateOfBirth": dob,
                    "primaryClubHint": club_hint,
                    "currentClubName": club_hint,
                }
            )
            if len(items) >= limit:
                break
        if len(items) >= limit:
            break

    # 回退：页面任意 spieler 链接
    if not items:
        for link in soup.select('a[href*="/spieler/"]'):
            parsed = _extract_player_link(link.get("href", ""))
            if not parsed:
                continue
            slug, tm_id = parsed
            if tm_id in seen:
                continue
            seen.add(tm_id)
            name = link.get_text(strip=True) or link.get("title") or ""
            if not name:
                continue
            items.append(
                {
                    "externalId": tm_id,
                    "slug": slug,
                    "name": name,
                    "dateOfBirth": None,
                    "primaryClubHint": None,
                    "currentClubName": None,
                }
            )
            if len(items) >= limit:
                break

    return {"items": items, "source": "transfermarkt"}


def _parse_club_from_cell(cell) -> tuple[Optional[str], str]:
    if cell is None:
        return None, ""
    link = cell.select_one('a[href*="/verein/"]')
    if link:
        href = link.get("href", "")
        m = re.search(r"/verein/(\d+)", href)
        external_id = m.group(1) if m else None
        name = link.get("title") or link.get_text(strip=True) or ""
        return external_id, name
    name = cell.get_text(" ", strip=True)
    return None, name


def _club_from_transfer_side(side: Optional[dict]) -> tuple[Optional[str], str]:
    if not side or side.get("isSpecial"):
        return None, ""
    name = (side.get("clubName") or "").strip()
    href = side.get("href") or ""
    m = re.search(r"/verein/(\d+)", href)
    external_id = m.group(1) if m else None
    return external_id, name


def _stints_from_ceapi_transfers(transfers: list[dict[str, Any]]) -> list[dict[str, Any]]:
    stints: list[dict[str, Any]] = []
    for sort_order, item in enumerate(transfers):
        if item.get("upcoming") or item.get("futureTransfer"):
            continue
        to_ext, to_name = _club_from_transfer_side(item.get("to"))
        if not to_name:
            continue
        from_ext, from_name = _club_from_transfer_side(item.get("from"))
        fee = item.get("fee")
        transfer_type = None
        if fee and re.search(r"loan|leihe", str(fee), re.I):
            transfer_type = "loan"
        elif fee and re.search(r"free|ablösefrei", str(fee), re.I):
            transfer_type = "free"
        joined_raw = item.get("dateUnformatted") or item.get("date")
        stints.append(
            {
                "club": {
                    "externalId": _club_id_from(to_ext, to_name),
                    "name": to_name,
                    "nameNormalized": _normalize_name(to_name),
                },
                "joinedRaw": joined_raw,
                "leftRaw": None,
                "transferType": transfer_type,
                "transferFee": fee,
                "fromClubName": from_name or None,
                "fromClubExternalId": from_ext,
                "seasonHint": item.get("season"),
                "sortOrder": sort_order,
            }
        )

    for i, stint in enumerate(stints):
        if i == 0:
            stint["leftRaw"] = None
        else:
            stint["leftRaw"] = stints[i - 1].get("joinedRaw")
    return stints


def _parse_transfer_rows(soup: BeautifulSoup) -> list[dict[str, Any]]:
    """从 transfers 页解析效力段（Joined 俱乐部 + 转入日期）。"""
    stints: list[dict[str, Any]] = []
    tables = soup.select("div.box table.items, table.tm-player-transfer-history-grid")
    if not tables:
        tables = soup.select("table.items")

    sort_order = 0
    for table in tables:
        # 跳过明显非转会表
        header_text = " ".join(th.get_text(" ", strip=True).lower() for th in table.select("th"))
        if header_text and "fee" not in header_text and "ablöse" not in header_text:
            if "joined" not in header_text and "aufnehmend" not in header_text:
                # grid 新版可能无 th 文本
                if "tm-player-transfer-history-grid" not in (table.get("class") or []):
                    continue

        rows = table.select("tbody > tr") or table.select("tr.tm-player-transfer-history-grid__row")
        for row in rows:
            classes = " ".join(row.get("class") or [])
            if "thead" in classes or "header" in classes:
                continue

            # 新版 grid
            season_el = row.select_one(".tm-player-transfer-history-grid__season")
            date_el = row.select_one(".tm-player-transfer-history-grid__date")
            left_el = row.select_one(".tm-player-transfer-history-grid__old-club")
            joined_el = row.select_one(".tm-player-transfer-history-grid__new-club")
            fee_el = row.select_one(".tm-player-transfer-history-grid__fee")

            if joined_el is not None:
                club_ext, club_name = _parse_club_from_cell(joined_el)
                if not club_name:
                    continue
                left_ext, left_name = _parse_club_from_cell(left_el)
                joined_raw = date_el.get_text(" ", strip=True) if date_el else None
                fee = fee_el.get_text(" ", strip=True) if fee_el else None
                transfer_type = None
                if fee and re.search(r"loan|leihe|leih", fee, re.I):
                    transfer_type = "loan"
                elif fee and re.search(r"free|ablösefrei", fee, re.I):
                    transfer_type = "free"
                stints.append(
                    {
                        "club": {
                            "externalId": _club_id_from(club_ext, club_name),
                            "name": club_name,
                            "nameNormalized": _normalize_name(club_name),
                        },
                        "joinedRaw": joined_raw or None,
                        "leftRaw": None,
                        "transferType": transfer_type,
                        "transferFee": fee or None,
                        "fromClubName": left_name or None,
                        "fromClubExternalId": left_ext,
                        "seasonHint": season_el.get_text(strip=True) if season_el else None,
                        "sortOrder": sort_order,
                    }
                )
                sort_order += 1
                continue

            # 经典 table.items
            cells = row.select(":scope > td")
            if len(cells) < 4:
                continue
            # 常见列：Season | Date | Left | Joined | MV | Fee
            date_raw = cells[1].get_text(" ", strip=True) if len(cells) > 1 else None
            left_ext, left_name = _parse_club_from_cell(cells[2] if len(cells) > 2 else None)
            club_ext, club_name = _parse_club_from_cell(cells[3] if len(cells) > 3 else None)
            if not club_name:
                continue
            fee = cells[-1].get_text(" ", strip=True) if cells else None
            transfer_type = None
            if fee and re.search(r"loan|leihe", fee, re.I):
                transfer_type = "loan"
            stints.append(
                {
                    "club": {
                        "externalId": _club_id_from(club_ext, club_name),
                        "name": club_name,
                        "nameNormalized": _normalize_name(club_name),
                    },
                    "joinedRaw": date_raw or None,
                    "leftRaw": None,
                    "transferType": transfer_type,
                    "transferFee": fee or None,
                    "fromClubName": left_name or None,
                    "fromClubExternalId": left_ext,
                    "seasonHint": cells[0].get_text(strip=True) if cells else None,
                    "sortOrder": sort_order,
                }
            )
            sort_order += 1

    # 用相邻转入填补离队日：段 i 的 left = 段 i-1 的 joined（TM 列表通常新→旧）
    for i, stint in enumerate(stints):
        if i == 0:
            stint["leftRaw"] = None  # 至今
        else:
            newer = stints[i - 1]
            stint["leftRaw"] = newer.get("joinedRaw")

    return stints


def _parse_profile_header(soup: BeautifulSoup) -> dict[str, Any]:
    name = None
    h1 = soup.select_one("h1.data-header__headline-container, h1")
    if h1:
        # 球衣号常在独立 span，需剔除
        for span in h1.select("span"):
            span.decompose()
        name = h1.get_text(" ", strip=True)
        name = re.sub(r"^#\d+\s*", "", name).strip()
        name = re.sub(r"\s*#\d+\s*$", "", name).strip()

    dob = None
    nationality = None
    position = None
    current_club_name = None
    current_club_ext = None

    rows = soup.select(".info-table .info-table__content--label")
    for label_el in rows:
        label = label_el.get_text(" ", strip=True).lower().rstrip(":")
        value_el = label_el.find_next_sibling(class_="info-table__content--bold")
        if not value_el:
            value_el = label_el.find_next_sibling(class_="info-table__content--regular")
        value = value_el.get_text(" ", strip=True) if value_el else ""
        if not value or value.lower().rstrip(":") == label:
            continue
        if "date of birth" in label or "geburt" in label or label == "age":
            m = re.search(r"(\d{2}\.\d{2}\.\d{4})", value)
            if m:
                dob = _parse_tm_date(m.group(1))
        elif "citizenship" in label or "nationalität" in label or "nationality" in label:
            flags = value_el.select("img.flaggenrahmen") if value_el else []
            if flags:
                nationality = flags[0].get("title") or flags[0].get("alt") or value
            else:
                nationality = value
        elif label == "position" or "position" in label:
            if value.lower() != "position":
                position = value

    for li in soup.select(".data-header__details li, .data-header__info-item"):
        text = li.get_text(" ", strip=True)
        if not dob:
            m = re.search(r"(\d{2}\.\d{2}\.\d{4})", text)
            if m and ("Age" in text or "Alter" in text or "Born" in text):
                dob = _parse_tm_date(m.group(1))
        flag = li.select_one("img.flaggenrahmen")
        if flag and not nationality:
            nationality = flag.get("title") or flag.get("alt")

    club_link = soup.select_one(
        ".data-header__club a[href*='/verein/'], "
        "span.data-header__club a[href*='/verein/']"
    )
    if not club_link:
        club_link = soup.select_one(".detail-position__box a[href*='/verein/']")
    if club_link:
        current_club_name = club_link.get("title") or club_link.get_text(strip=True)
        m = re.search(r"/verein/(\d+)", club_link.get("href", ""))
        current_club_ext = m.group(1) if m else None

    pos_el = soup.select_one(".detail-position__position")
    if pos_el:
        pos_text = pos_el.get_text(strip=True)
        if pos_text and pos_text.lower() != "position":
            position = pos_text

    if nationality in {None, "", "Citizenship:", "Citizenship"}:
        nationality = None
    if position in {None, "", "Position:", "Position"}:
        position = None

    return {
        "name": name or "",
        "dateOfBirth": dob,
        "nationality": nationality,
        "position": position,
        "currentClub": (
            {
                "externalId": _club_id_from(current_club_ext, current_club_name),
                "name": current_club_name,
                "nameNormalized": _normalize_name(current_club_name),
            }
            if current_club_name
            else None
        ),
    }


def _parse_national_team_stints(soup: BeautifulSoup) -> list[dict[str, Any]]:
    stints: list[dict[str, Any]] = []
    for table in soup.select("table.items"):
        header = " ".join(th.get_text(" ", strip=True).lower() for th in table.select("th"))
        if header and "national" not in header and "einsätze" not in header and "caps" not in header:
            # 国家队履历页常有多表；有队名+年份即可
            pass
        for row in table.select("tbody > tr"):
            link = row.select_one('a[href*="/verein/"]')
            if not link:
                continue
            nation_name = link.get("title") or link.get_text(strip=True)
            if not nation_name:
                continue
            cells = [c.get_text(" ", strip=True) for c in row.select(":scope > td")]
            joined_raw = None
            left_raw = None
            for cell in cells:
                if re.fullmatch(r"\d{4}", cell) or re.fullmatch(r"\d{4}/\d{2}", cell):
                    if joined_raw is None:
                        joined_raw = cell
                    else:
                        left_raw = cell
            nation_key = _normalize_name(nation_name).replace(" ", "_")
            stints.append(
                {
                    "nationKey": nation_key,
                    "nationName": nation_name,
                    "joinedRaw": joined_raw,
                    "leftRaw": left_raw,
                }
            )
    # 去重同名
    unique: list[dict[str, Any]] = []
    seen: set[str] = set()
    for s in stints:
        key = s["nationKey"]
        if key in seen:
            continue
        seen.add(key)
        unique.append(s)
    return unique


def fetch_player_profile(tm_id: str, *, slug: str = "-") -> dict[str, Any]:
    player_id = str(tm_id).strip()
    if not player_id:
        raise ValueError("tm-id 不能为空")

    safe_slug = (slug or "-").strip() or "-"
    profile_url = f"{TM_BASE}/{safe_slug}/profil/spieler/{player_id}"
    transfers_page = f"{TM_BASE}/{safe_slug}/transfers/spieler/{player_id}"
    national_url = f"{TM_BASE}/{safe_slug}/nationalmannschaft/spieler/{player_id}"

    profile_html = fetch_html(profile_url, timeout=40)
    profile_soup = BeautifulSoup(profile_html, "lxml")
    header = _parse_profile_header(profile_soup)

    # 现站点转会表由 Svelte + ceapi 提供；先暖页再请求 JSON
    fetch_html(transfers_page, timeout=40)
    club_stints: list[dict[str, Any]] = []
    try:
        payload = fetch_tm_json(
            f"{TM_BASE}/ceapi/transferHistory/list/{player_id}",
            referer=transfers_page,
            timeout=40,
        )
        transfers = payload.get("transfers") if isinstance(payload, dict) else None
        if isinstance(transfers, list):
            club_stints = _stints_from_ceapi_transfers(transfers)
    except Exception:
        club_stints = []

    if not club_stints:
        transfers_html = fetch_html(f"{transfers_page}/plus/1", timeout=40)
        club_stints = _parse_transfer_rows(BeautifulSoup(transfers_html, "lxml"))

    national_stints: list[dict[str, Any]] = []
    try:
        national_html = fetch_html(national_url, timeout=30)
        national_stints = _parse_national_team_stints(BeautifulSoup(national_html, "lxml"))
    except Exception:
        national_stints = []

    return {
        "externalSource": "transfermarkt",
        "externalId": player_id,
        "slug": safe_slug,
        "name": header.get("name") or "",
        "nameNormalized": _normalize_name(header.get("name") or ""),
        "dateOfBirth": header.get("dateOfBirth"),
        "nationality": header.get("nationality"),
        "position": header.get("position"),
        "currentClub": header.get("currentClub"),
        "clubStints": club_stints,
        "nationalTeamStints": national_stints,
    }

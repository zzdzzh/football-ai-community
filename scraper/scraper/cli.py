# -*- coding: utf-8 -*-
"""命令行入口：输出 JSON 到 stdout。"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime


def main() -> None:
    from scraper.leagues import get_league, list_league_codes

    parser = argparse.ArgumentParser(description="足球数据爬虫 CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    sync_parser = sub.add_parser("sync-league", help="同步单联赛球队/球员/比赛")
    sync_parser.add_argument("--league", required=True, choices=list_league_codes())
    sync_parser.add_argument("--no-fbref", action="store_true")
    sync_parser.add_argument("--players-only", action="store_true", help="仅同步球队/球员（世界杯加速）")
    sync_parser.add_argument(
        "--transfermarkt",
        action="store_true",
        help="启用 Transfermarkt（默认关闭；站点有人机验证，不稳定）",
    )
    sync_parser.add_argument("--delay", type=float, default=1.5)

    match_parser = sub.add_parser("match-detail", help="获取比赛详情")
    match_parser.add_argument("--match-id", required=True, help="SofaScore event id")

    fbref_parser = sub.add_parser("fbref-stats", help="仅拉取 FBref 球员赛季统计（soccerdata 优先）")
    fbref_parser.add_argument("--league", required=True, choices=list_league_codes())
    fbref_parser.add_argument(
        "--season-year",
        type=int,
        default=None,
        help="开赛年，如 2024 对应 24/25；默认按当前月份推断",
    )
    fbref_parser.add_argument(
        "--out",
        default=None,
        help="输出到文件（推荐，避免大 JSON 管道阻塞）；默认 stdout",
    )

    career_search = sub.add_parser("career-search", help="Transfermarkt 球员履历搜索")
    career_search.add_argument("--q", required=True, help="球员姓名关键词")
    career_search.add_argument("--limit", type=int, default=20)
    career_search.add_argument("--delay", type=float, default=1.5)

    career_profile = sub.add_parser("career-profile", help="Transfermarkt 球员履历详情")
    career_profile.add_argument("--tm-id", required=True, help="Transfermarkt 球员 ID")
    career_profile.add_argument("--slug", default="-", help="URL slug（可选）")
    career_profile.add_argument("--delay", type=float, default=1.5)

    args = parser.parse_args()

    try:
        if args.command == "sync-league":
            from scraper.http import set_request_delay
            from scraper.sync import sync_league

            set_request_delay(args.delay)
            payload = sync_league(
                args.league,
                include_fbref=not args.no_fbref,
                players_only=args.players_only,
                use_transfermarkt=True if args.transfermarkt else None,
            )
        elif args.command == "match-detail":
            from scraper.sofascore import fetch_match_detail

            payload = fetch_match_detail(args.match_id)
        elif args.command == "fbref-stats":
            from scraper.fbref import fetch_league_player_stats, fbref_stat_to_payload

            league = get_league(args.league)
            season_year = args.season_year
            if season_year is None:
                now = datetime.now()
                season_year = now.year if now.month >= 7 else now.year - 1
            stats = fetch_league_player_stats(league, season_year=season_year)
            payload = {
                "leagueCode": league.code,
                "season": str(season_year),
                "fbrefStats": [
                    fbref_stat_to_payload(s, league.code, str(season_year))
                    for s in stats
                ],
                "sources": {"fbref": len(stats) > 0, "soccerdata": True},
            }
        elif args.command == "career-search":
            from scraper.http import set_request_delay
            from scraper.transfermarkt_career import search_players

            set_request_delay(args.delay)
            payload = search_players(args.q, limit=args.limit)
        elif args.command == "career-profile":
            from scraper.http import set_request_delay
            from scraper.transfermarkt_career import fetch_player_profile

            set_request_delay(args.delay)
            payload = fetch_player_profile(args.tm_id, slug=args.slug)
        else:
            raise ValueError(f"未知命令: {args.command}")

        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        if getattr(args, "out", None):
            with open(args.out, "wb") as fh:
                fh.write(raw)
            sys.stdout.buffer.write(
                json.dumps({"ok": True, "out": args.out, "bytes": len(raw)}, ensure_ascii=False).encode("utf-8")
            )
            # soccerdata/selenium 可能残留非守护线程，阻止进程正常退出
            if args.command == "fbref-stats":
                os._exit(0)
        else:
            sys.stdout.buffer.write(raw)
            if args.command == "fbref-stats":
                os._exit(0)
    except Exception as err:
        message = json.dumps({"error": str(err)}, ensure_ascii=False)
        sys.stderr.buffer.write(message.encode("utf-8"))
        sys.exit(1)


if __name__ == "__main__":
    main()

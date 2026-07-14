# -*- coding: utf-8 -*-
"""命令行入口：输出 JSON 到 stdout。"""

from __future__ import annotations

import argparse
import json
import sys

from scraper.http import set_request_delay
from scraper.leagues import list_league_codes
from scraper.sofascore import fetch_match_detail
from scraper.sync import sync_league


def main() -> None:
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

    args = parser.parse_args()

    try:
        if args.command == "sync-league":
            set_request_delay(args.delay)
            payload = sync_league(
                args.league,
                include_fbref=not args.no_fbref,
                players_only=args.players_only,
                use_transfermarkt=True if args.transfermarkt else None,
            )
        elif args.command == "match-detail":
            payload = fetch_match_detail(args.match_id)
        else:
            raise ValueError(f"未知命令: {args.command}")

        sys.stdout.buffer.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))
    except Exception as err:
        message = json.dumps({"error": str(err)}, ensure_ascii=False)
        sys.stderr.buffer.write(message.encode("utf-8"))
        sys.exit(1)


if __name__ == "__main__":
    main()

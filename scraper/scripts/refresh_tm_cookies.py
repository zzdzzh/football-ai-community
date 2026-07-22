# -*- coding: utf-8 -*-
"""用有头 Playwright 打开 Transfermarkt，人工过人机验证后保存 Cookie。

用法（在 scraper 目录）:
  python scripts/refresh_tm_cookies.py
  python scripts/refresh_tm_cookies.py --auto
  python scripts/refresh_tm_cookies.py --auto --timeout-sec 300

浏览器弹出后：若出现 Human Verification，按页面提示完成验证。
- 默认模式：确认能看到正常首页后回到终端按 Enter 保存
- --auto：轮询页面，验证消失后自动保存（供后台检测到拦截时拉起，无需 stdin）
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

TM_HOME = "https://www.transfermarkt.com/"
COOKIE_PATH = Path(__file__).resolve().parent.parent / ".tm_cookies.json"


def _page_blocked(page) -> bool:
    """页面是否仍处于人机验证/拦截态。"""
    try:
        html = page.content() or ""
    except Exception:
        return True
    head = html[:4000]
    if "Human Verification" in head or "captcha-container" in head:
        return True
    # 正常首页通常含主导航或搜索入口
    if "transfermarkt" in head.lower() and (
        'id="schnellsuche"' in html
        or 'name="query"' in html
        or "box-header" in html
        or "tm-main" in html
    ):
        return False
    # 内容过短多半仍是拦截壳
    return len(html) < 2000


def _save_cookies(cookies: list) -> int:
    if not cookies:
        print("未拿到 Cookie，请重试")
        return 1
    payload = {
        "source": "transfermarkt",
        "home": TM_HOME,
        "cookies": cookies,
    }
    COOKIE_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"已保存 {len(cookies)} 条 Cookie → {COOKIE_PATH}")
    print("之后 career-search / 球员关系搜索会自动带上这些 Cookie。")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="刷新 Transfermarkt Cookie")
    parser.add_argument(
        "--auto",
        action="store_true",
        help="轮询直到人机验证消失后自动保存（无需按 Enter）",
    )
    parser.add_argument(
        "--timeout-sec",
        type=int,
        default=300,
        help="--auto 最长等待秒数（默认 300）",
    )
    parser.add_argument(
        "--poll-sec",
        type=float,
        default=2.0,
        help="--auto 轮询间隔秒数（默认 2）",
    )
    args = parser.parse_args()

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("未安装 playwright。请先执行：")
        print("  cd scraper; python -m pip install playwright")
        print("  python -m playwright install chromium")
        return 1

    print("=" * 60)
    print("将打开 Chromium → Transfermarkt")
    print("若出现 Human Verification / 人机验证：在浏览器里点完验证")
    if args.auto:
        print(f"--auto：验证消失后自动保存（最长等待 {args.timeout_sec}s）")
    else:
        print("确认能看到正常首页后，回到本终端按 Enter 保存 Cookie")
    print("=" * 60)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=False)
        context = browser.new_context(
            locale="en-US",
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        )
        page = context.new_page()
        page.goto(TM_HOME, wait_until="domcontentloaded", timeout=120000)

        if args.auto:
            deadline = time.time() + max(30, args.timeout_sec)
            poll = max(0.5, args.poll_sec)
            while time.time() < deadline:
                if not _page_blocked(page):
                    print("检测到页面已通过验证，正在保存 Cookie…")
                    cookies = context.cookies()
                    browser.close()
                    return _save_cookies(cookies)
                time.sleep(poll)
            print(f"等待超时（{args.timeout_sec}s），未保存 Cookie")
            browser.close()
            return 1

        try:
            input("\n验证完成后按 Enter 保存 Cookie（Ctrl+C 取消）… ")
        except (EOFError, KeyboardInterrupt):
            print("\n已取消")
            browser.close()
            return 1

        cookies = context.cookies()
        browser.close()

    return _save_cookies(cookies)


if __name__ == "__main__":
    sys.exit(main())

# -*- coding: utf-8 -*-
"""用有头 Playwright 打开 Transfermarkt，人工过人机验证后保存 Cookie。

用法（在 scraper 目录）:
  python scripts/refresh_tm_cookies.py

浏览器弹出后：若出现 Human Verification，按页面提示完成验证；
看到正常首页后回到终端按 Enter，Cookie 会写入 scraper/.tm_cookies.json。
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

TM_HOME = "https://www.transfermarkt.com/"
COOKIE_PATH = Path(__file__).resolve().parent.parent / ".tm_cookies.json"


def main() -> int:
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

        try:
            input("\n验证完成后按 Enter 保存 Cookie（Ctrl+C 取消）… ")
        except (EOFError, KeyboardInterrupt):
            print("\n已取消")
            browser.close()
            return 1

        cookies = context.cookies()
        browser.close()

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


if __name__ == "__main__":
    sys.exit(main())

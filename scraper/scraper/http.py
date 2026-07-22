# -*- coding: utf-8 -*-
"""HTTP 客户端：Transfermarkt 用标准请求，SofaScore 用 curl_cffi。"""

from __future__ import annotations

import json
import time
import urllib.request
from pathlib import Path
from typing import Any

from curl_cffi import requests as cffi_requests

DEFAULT_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# 由 scripts/refresh_tm_cookies.py 写入；人工过 WAF 后复用
_TM_COOKIE_FILE = Path(__file__).resolve().parent.parent / ".tm_cookies.json"

_last_request_at = 0.0
_request_delay_sec = 1.5
_tm_cookie_header: str | None = None
_tm_cookie_mtime: float | None = None


def set_request_delay(seconds: float) -> None:
    global _request_delay_sec
    _request_delay_sec = max(0.0, seconds)


def _throttle() -> None:
    global _last_request_at
    now = time.time()
    wait = _request_delay_sec - (now - _last_request_at)
    if wait > 0:
        time.sleep(wait)
    _last_request_at = time.time()


def _load_tm_cookie_header() -> str | None:
    """读取 Playwright 保存的 Cookie；文件不存在或无效则返回 None。"""
    global _tm_cookie_header, _tm_cookie_mtime
    if not _TM_COOKIE_FILE.exists():
        _tm_cookie_header = None
        _tm_cookie_mtime = None
        return None
    try:
        mtime = _TM_COOKIE_FILE.stat().st_mtime
        if _tm_cookie_header is not None and _tm_cookie_mtime == mtime:
            return _tm_cookie_header
        raw = json.loads(_TM_COOKIE_FILE.read_text(encoding="utf-8"))
        cookies = raw.get("cookies") if isinstance(raw, dict) else None
        if not isinstance(cookies, list) or not cookies:
            _tm_cookie_header = None
            _tm_cookie_mtime = mtime
            return None
        parts: list[str] = []
        for item in cookies:
            if not isinstance(item, dict):
                continue
            name = item.get("name")
            value = item.get("value")
            if name and value is not None:
                parts.append(f"{name}={value}")
        _tm_cookie_header = "; ".join(parts) if parts else None
        _tm_cookie_mtime = mtime
        return _tm_cookie_header
    except Exception:
        return None


def _tm_headers(extra: dict[str, str] | None = None) -> dict[str, str]:
    headers = {
        "User-Agent": DEFAULT_UA,
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Referer": "https://www.transfermarkt.com/",
    }
    cookie = _load_tm_cookie_header()
    if cookie:
        headers["Cookie"] = cookie
    if extra:
        headers.update(extra)
    return headers


def fetch_html(url: str, *, timeout: int = 30, max_retries: int = 3) -> str:
    """Transfermarkt 等静态页面。优先 curl_cffi，失败再回退 urllib。"""
    last_err: Exception | None = None
    for attempt in range(max_retries):
        _throttle()
        try:
            resp = cffi_requests.get(
                url,
                impersonate="chrome120",
                headers=_tm_headers(),
                timeout=timeout,
            )
            if resp.status_code == 405 and attempt < max_retries - 1:
                last_err = RuntimeError(f"HTTP {resp.status_code} 获取失败: {url}")
                time.sleep(2 * (attempt + 1))
                continue
            if resp.status_code >= 400:
                body_preview = (resp.text or "")[:200]
                if "Human Verification" in body_preview or "captcha-container" in body_preview:
                    raise RuntimeError(
                        f"HTTP {resp.status_code} 人机验证拦截: {url}；"
                        "请在 scraper 目录运行: python scripts/refresh_tm_cookies.py"
                    )
                raise RuntimeError(f"HTTP {resp.status_code} 获取失败: {url}")
            text = resp.text or ""
            if "Human Verification" in text[:800] and "captcha-container" in text[:2000]:
                raise RuntimeError(
                    f"人机验证拦截: {url}；"
                    "请在 scraper 目录运行: python scripts/refresh_tm_cookies.py"
                )
            return text
        except RuntimeError as err:
            last_err = err
            # 人机验证不会因 urllib 回退消失，直接抛出以便上层提示刷新 Cookie
            if "人机验证" in str(err):
                raise
            if "HTTP 5" in str(err) and attempt < max_retries - 1:
                time.sleep(3 * (attempt + 1))
                continue
            if attempt >= max_retries - 1:
                break
        except Exception as err:
            last_err = err
            if attempt < max_retries - 1:
                time.sleep(2 * (attempt + 1))
                continue
            break

    # 回退 urllib（少数环境 curl_cffi 异常时）；若已确认人机验证则不再回退
    if last_err is not None and "人机验证" in str(last_err):
        raise last_err
    _throttle()
    req = urllib.request.Request(url, headers=_tm_headers())
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except Exception as err:
        raise RuntimeError(f"获取失败（重试 {max_retries} 次）: {url}") from (last_err or err)


def fetch_json(url: str, *, timeout: int = 30) -> Any:
    """SofaScore 内部 API。"""
    _throttle()
    resp = cffi_requests.get(
        url,
        impersonate="chrome120",
        headers={"Referer": "https://www.sofascore.com/"},
        timeout=timeout,
    )
    if resp.status_code >= 400:
        raise RuntimeError(f"HTTP {resp.status_code} 获取失败: {url}")
    return resp.json()


def fetch_tm_json(url: str, *, referer: str, timeout: int = 30) -> Any:
    """Transfermarkt ceapi JSON。优先 urllib（curl_cffi 易触发 WAF 405）。"""
    last_err: Exception | None = None
    for attempt in range(3):
        _throttle()
        req = urllib.request.Request(
            url,
            headers=_tm_headers(
                {
                    "Accept": "application/json, text/plain, */*",
                    "X-Requested-With": "XMLHttpRequest",
                    "Referer": referer,
                }
            ),
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
            return json.loads(raw)
        except Exception as err:
            last_err = err
            if attempt < 2:
                time.sleep(2 * (attempt + 1))
                continue
            break
    raise RuntimeError(f"TM JSON 获取失败: {url}") from last_err

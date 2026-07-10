# -*- coding: utf-8 -*-
"""HTTP 客户端：Transfermarkt 用标准请求，SofaScore 用 curl_cffi。"""

from __future__ import annotations

import time
import urllib.error
import urllib.request
from typing import Any

from curl_cffi import requests as cffi_requests

DEFAULT_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

_last_request_at = 0.0
_request_delay_sec = 1.5


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


def fetch_html(url: str, *, timeout: int = 30) -> str:
    """Transfermarkt 等静态页面。"""
    _throttle()
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": DEFAULT_UA,
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as err:
        raise RuntimeError(f"HTTP {err.code} 获取失败: {url}") from err


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

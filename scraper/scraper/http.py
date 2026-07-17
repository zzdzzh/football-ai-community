# -*- coding: utf-8 -*-
"""HTTP 客户端：Transfermarkt 用标准请求，SofaScore 用 curl_cffi。"""

from __future__ import annotations

import http.client
import json
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


def fetch_html(url: str, *, timeout: int = 30, max_retries: int = 3) -> str:
    """Transfermarkt 等静态页面。优先 curl_cffi，失败再回退 urllib。"""
    last_err: Exception | None = None
    for attempt in range(max_retries):
        _throttle()
        try:
            resp = cffi_requests.get(
                url,
                impersonate="chrome120",
                headers={
                    "User-Agent": DEFAULT_UA,
                    "Accept-Language": "en-US,en;q=0.9",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Referer": "https://www.transfermarkt.com/",
                },
                timeout=timeout,
            )
            if resp.status_code == 405 and attempt < max_retries - 1:
                last_err = RuntimeError(f"HTTP {resp.status_code} 获取失败: {url}")
                time.sleep(2 * (attempt + 1))
                continue
            if resp.status_code >= 400:
                body_preview = (resp.text or "")[:200]
                if "Human Verification" in body_preview or "captcha-container" in body_preview:
                    raise RuntimeError(f"HTTP {resp.status_code} 人机验证拦截: {url}")
                raise RuntimeError(f"HTTP {resp.status_code} 获取失败: {url}")
            text = resp.text or ""
            if "Human Verification" in text[:800] and "captcha-container" in text[:2000]:
                raise RuntimeError(f"人机验证拦截: {url}")
            return text
        except RuntimeError as err:
            last_err = err
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

    # 回退 urllib（少数环境 curl_cffi 异常时）
    _throttle()
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": DEFAULT_UA,
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://www.transfermarkt.com/",
        },
    )
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
            headers={
                "User-Agent": DEFAULT_UA,
                "Accept": "application/json, text/plain, */*",
                "X-Requested-With": "XMLHttpRequest",
                "Referer": referer,
                "Accept-Language": "en-US,en;q=0.9",
            },
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

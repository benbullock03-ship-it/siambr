"""HTTP fetch with exponential backoff and a Bronze-tier byte cache under data/bronze/."""

from __future__ import annotations

import hashlib
import logging
import re
import time
from pathlib import Path

import requests

from pipeline.db import REPO_ROOT

BRONZE_DIR = REPO_ROOT / "data" / "bronze"
# senedd.wales fronts a WAF that 403s non-browser agents.
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Siambr/0.1"
RETRY_STATUSES = {429, 500, 502, 503, 504}

log = logging.getLogger(__name__)


class SourceUnavailable(RuntimeError):
    """The upstream returned something other than the expected document after all retries."""


def cache_path(namespace: str, url: str, suffix: str) -> Path:
    stem = re.sub(r"[^a-z0-9]+", "-", url.lower()).strip("-")[:80]
    digest = hashlib.sha1(url.encode()).hexdigest()[:10]
    return BRONZE_DIR / namespace / f"{stem}-{digest}{suffix}"


def fetch(
    url: str,
    *,
    session: requests.Session | None = None,
    method: str = "GET",
    namespace: str | None = None,
    suffix: str = ".bin",
    use_cache: bool = True,
    retries: int = 5,
    backoff: float = 1.0,
    timeout: float = 60.0,
    sleep=time.sleep,
    **request_kwargs,
) -> bytes:
    """Return response bytes, retrying 429/5xx/network errors with doubling delay.

    A 403 from business.senedd.wales is its "Service unavailable" HTML page, so
    it is treated as retryable too. With ``namespace`` set, a successful body is
    written to the Bronze mirror and served from there on later calls.
    """
    path = cache_path(namespace, url, suffix) if namespace else None
    if path and use_cache and path.exists():
        return path.read_bytes()

    s = session or requests.Session()
    s.headers["User-Agent"] = USER_AGENT
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            r = s.request(method, url, timeout=timeout, **request_kwargs)
            if r.status_code in RETRY_STATUSES or r.status_code == 403:
                raise SourceUnavailable(f"{r.status_code} from {url}")
            if r.status_code >= 400:
                raise SourceUnavailable(f"{r.status_code} from {url} (not retried)")
            if path:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(r.content)
            return r.content
        except (requests.RequestException, SourceUnavailable) as e:
            last_error = e
            if "(not retried)" in str(e):
                break
            delay = backoff * (2**attempt)
            log.warning("fetch %s failed (%s); retry in %.1fs", url, e, delay)
            if attempt < retries - 1:
                sleep(delay)
    raise SourceUnavailable(f"gave up on {url}: {last_error}")

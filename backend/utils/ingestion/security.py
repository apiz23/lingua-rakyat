"""SSRF-safe HTTP fetching for official-source ingestion.

Only explicitly approved hosts are reachable, every redirect hop is
revalidated, private/loopback/link-local addresses are rejected, responses are
size-capped, timeouts are bounded, and robots.txt is respected.
"""

from __future__ import annotations

import ipaddress
import logging
import os
import socket
import time
from dataclasses import dataclass, field
from typing import Any, Iterable, Mapping, Optional
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx

logger = logging.getLogger("ingestion.fetch")

MAX_DISCOVERY_BYTES = int(os.getenv("INGESTION_MAX_DISCOVERY_BYTES", str(2 * 1024 * 1024)))
MAX_DOCUMENT_BYTES = int(os.getenv("INGESTION_MAX_DOCUMENT_BYTES", str(20 * 1024 * 1024)))
CONNECT_TIMEOUT = float(os.getenv("INGESTION_CONNECT_TIMEOUT", "10"))
READ_TIMEOUT = float(os.getenv("INGESTION_READ_TIMEOUT", "30"))
MIN_INTERVAL_SECONDS = float(os.getenv("INGESTION_MIN_INTERVAL_SECONDS", "1.5"))
USER_AGENT = os.getenv(
    "INGESTION_USER_AGENT",
    "LinguaRakyatIngestion/1.0 (+https://lingua-rakyat.my; official-document-ingestion)",
)


class FetchError(RuntimeError):
    """The URL could not be fetched safely."""


class URLRejected(FetchError):
    """The URL is not an approved, public target."""


@dataclass(frozen=True)
class FetchResult:
    content: bytes
    final_url: str
    status_code: int
    content_type: str = ""
    headers: Mapping[str, str] = field(default_factory=dict)


_last_request_at: dict[str, float] = {}
_robots_cache: dict[str, tuple[float, Optional[RobotFileParser]]] = {}


def approved_hosts(source: Mapping[str, Any]) -> set[str]:
    hosts: set[str] = set()
    url = source.get("source_url")
    if isinstance(url, str) and url.strip():
        host = urlparse(url).hostname
        if host:
            hosts.add(host.lower())
    metadata = source.get("metadata") or {}
    for key in ("allowed_hosts", "hosts"):
        value = metadata.get(key)
        if isinstance(value, str):
            hosts.update(host.strip().lower() for host in value.split(",") if host.strip())
        elif isinstance(value, list):
            hosts.update(str(host).strip().lower() for host in value if str(host).strip())
    return hosts


def resolve_public_addresses(host: str) -> list[str]:
    if not host or host == "localhost" or host.endswith(".local"):
        raise URLRejected("Host is not public")
    try:
        infos = socket.getaddrinfo(host, None)
    except OSError as exc:
        raise URLRejected("Host cannot be resolved") from exc
    addresses: list[str] = []
    for info in infos:
        address = info[4][0]
        if address in addresses:
            continue
        try:
            parsed = ipaddress.ip_address(address)
        except ValueError as exc:
            raise URLRejected("Host has an invalid address") from exc
        if not parsed.is_global:
            raise URLRejected("Host resolves to a non-public address")
        addresses.append(address)
    if not addresses:
        raise URLRejected("Host cannot be resolved")
    return addresses


def _reject_private_host(host: str) -> None:
    resolve_public_addresses(host)


def resolve_target(url: str, hosts: Iterable[str]) -> tuple[str, str]:
    """Validate a URL and return (hostname, pinned public IP address)."""
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise URLRejected("Unsupported URL scheme")
    if parsed.username or parsed.password:
        raise URLRejected("Credentials in URLs are not allowed")
    host = (parsed.hostname or "").lower()
    if not host:
        raise URLRejected("URL has no host")
    approved = {entry.lower() for entry in hosts}
    if host not in approved:
        raise URLRejected("Host is not approved for this source")
    if parsed.scheme == "http" and os.getenv("INGESTION_ALLOW_HTTP", "false").lower() != "true":
        raise URLRejected("Plain HTTP is not allowed for ingestion")
    addresses = resolve_public_addresses(host)
    return host, addresses[0]


def validate_url(url: str, hosts: Iterable[str]) -> str:
    resolve_target(url, hosts)
    return url


def _pinned_url(url: str, address: str) -> str:
    parsed = urlparse(url)
    host = parsed.hostname or ""
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    default_port = 443 if parsed.scheme == "https" else 80
    authority = f"[{address}]" if ":" in address else address
    if port != default_port:
        authority = f"{authority}:{port}"
    return parsed._replace(netloc=authority).geturl()


def _host_header(host: str, url: str) -> str:
    parsed = urlparse(url)
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    default_port = 443 if parsed.scheme == "https" else 80
    return host if port == default_port else f"{host}:{port}"


def _rate_limit(host: str) -> None:
    now = time.monotonic()
    last = _last_request_at.get(host, 0.0)
    remaining = MIN_INTERVAL_SECONDS - (now - last)
    if remaining > 0:
        time.sleep(remaining)
    _last_request_at[host] = time.monotonic()


def _robots_allowed(url: str, hosts: set[str]) -> bool:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    cached = _robots_cache.get(host)
    now = time.monotonic()
    if cached and now - cached[0] < 3600:
        parser = cached[1]
        return True if parser is None else parser.can_fetch(USER_AGENT, url)

    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    parser: Optional[RobotFileParser] = None
    try:
        response = _request(robots_url, hosts, max_bytes=256 * 1024, allow_not_found=True)
        if response.status_code == 200:
            parser = RobotFileParser()
            parser.parse(response.content.decode("utf-8", errors="replace").splitlines())
        elif response.status_code == 404:
            parser = None
        else:
            # An inaccessible robots.txt is treated as disallowed.
            _robots_cache[host] = (now, _DISALLOW_ALL)
            return False
    except FetchError:
        _robots_cache[host] = (now, _DISALLOW_ALL)
        return False

    _robots_cache[host] = (now, parser)
    return True if parser is None else parser.can_fetch(USER_AGENT, url)


class _DisallowAll(RobotFileParser):
    def can_fetch(self, _useragent: str, _url: str) -> bool:
        return False


_DISALLOW_ALL = _DisallowAll()


def _request(
    url: str,
    hosts: set[str],
    *,
    max_bytes: int,
    _depth: int = 0,
    allow_not_found: bool = False,
) -> FetchResult:
    if _depth > 3:
        raise FetchError("Too many redirects")
    host, address = resolve_target(url, hosts)
    _rate_limit(host)
    pinned_url = _pinned_url(url, address)
    extensions = {"sni_hostname": host} if urlparse(url).scheme == "https" else None

    timeout = httpx.Timeout(READ_TIMEOUT, connect=CONNECT_TIMEOUT)
    with httpx.Client(
        follow_redirects=False,
        timeout=timeout,
    ) as client:
        request = client.build_request(
            "GET",
            pinned_url,
            headers={
                "User-Agent": USER_AGENT,
                "Host": _host_header(host, url),
                "Accept": "application/pdf,text/html;q=0.9,*/*;q=0.5",
            },
            extensions=extensions,
        )
        response = client.send(request)
        if response.status_code in {301, 302, 303, 307, 308}:
            location = response.headers.get("location")
            if not location:
                raise FetchError("Redirect without a location")
            target = urljoin(url, location)
            resolve_target(target, hosts)
            return _request(target, hosts, max_bytes=max_bytes, _depth=_depth + 1)
        if response.status_code >= 400 and not (
            allow_not_found and response.status_code == 404
        ):
            raise FetchError(f"Upstream returned HTTP {response.status_code}")

        length = response.headers.get("content-length")
        if length and int(length) > max_bytes:
            raise FetchError("Response exceeds the size limit")
        content = response.content
        if len(content) > max_bytes:
            raise FetchError("Response exceeds the size limit")
        return FetchResult(
            content=content,
            final_url=url,
            status_code=response.status_code,
            content_type=response.headers.get("content-type", ""),
            headers=dict(response.headers),
        )


def fetch_document(url: str, source: Mapping[str, Any]) -> FetchResult:
    hosts = approved_hosts(source)
    if not hosts:
        raise FetchError("Source has no approved host")
    if not _robots_allowed(url, hosts):
        raise FetchError("robots.txt disallows this URL")
    return _request(url, hosts, max_bytes=MAX_DOCUMENT_BYTES)


def fetch_listing(url: str, source: Mapping[str, Any]) -> FetchResult:
    hosts = approved_hosts(source)
    if not hosts:
        raise FetchError("Source has no approved host")
    if not _robots_allowed(url, hosts):
        raise FetchError("robots.txt disallows this URL")
    return _request(url, hosts, max_bytes=MAX_DISCOVERY_BYTES)

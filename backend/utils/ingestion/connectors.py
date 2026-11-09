"""Extensible official-source connectors.

Source-specific discovery stays here; the ingestion service owns validation,
fetching, duplicate detection and registration.
"""

from __future__ import annotations

import logging
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from typing import Any, Callable, Mapping, Protocol
from urllib.parse import urljoin, urlparse

from utils.ingestion.security import FetchResult, approved_hosts

logger = logging.getLogger("ingestion.connectors")

MAX_DISCOVERY_ITEMS = 500


class ConnectorError(RuntimeError):
    """The source cannot be discovered with this connector."""


@dataclass(frozen=True)
class DiscoveredDocument:
    source_id: str
    source_url: str
    title: str = ""
    external_id: str = ""
    publication_date: str = ""
    last_updated_at: str = ""
    document_type: str = "pdf"
    language: str = ""
    evidence: Mapping[str, Any] = field(default_factory=dict)


class SourceConnector(Protocol):
    name: str

    def validate_configuration(self, source: Mapping[str, Any]) -> None: ...

    def discover_documents(
        self, source: Mapping[str, Any], fetch_listing: Callable[[str], FetchResult]
    ) -> list[DiscoveredDocument]: ...


class _AnchorParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[tuple[str, str]] = []
        self._href: str | None = None
        self._text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "a":
            return
        attributes = {name.lower(): value for name, value in attrs}
        href = attributes.get("href")
        if href:
            self._href = href
            self._text = []

    def handle_data(self, data: str) -> None:
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "a" and self._href is not None:
            title = re.sub(r"\s+", " ", "".join(self._text)).strip()
            self.links.append((self._href, title))
            self._href = None
            self._text = []


def _normalize_date(value: str) -> str:
    if not value:
        return ""
    try:
        parsed = parsedate_to_datetime(value)
    except (TypeError, ValueError):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return ""
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).isoformat()


class HtmlListingConnector:
    """Discovers PDF links from an official HTML listing page."""

    name = "html_listing"

    def validate_configuration(self, source: Mapping[str, Any]) -> None:
        if not (source.get("source_url") or "").strip():
            raise ConnectorError("Source URL is required for HTML discovery")
        if not approved_hosts(source):
            raise ConnectorError("Source has no approved host")

    def _listing_urls(self, source: Mapping[str, Any]) -> list[str]:
        metadata = source.get("metadata") or {}
        pages = metadata.get("pages")
        if isinstance(pages, list) and pages:
            return [str(page) for page in pages][:10]
        template = metadata.get("page_url_template")
        if isinstance(template, str) and template:
            max_pages = int(metadata.get("max_pages") or 1)
            return [
                template.format(page=page)
                for page in range(1, min(max(max_pages, 1), 10) + 1)
            ]
        return [str(source["source_url"])]

    def discover_documents(
        self, source: Mapping[str, Any], fetch_listing: Callable[[str], FetchResult]
    ) -> list[DiscoveredDocument]:
        self.validate_configuration(source)
        hosts = approved_hosts(source)
        seen: set[str] = set()
        documents: list[DiscoveredDocument] = []
        for listing_url in self._listing_urls(source):
            result = fetch_listing(listing_url)
            parser = _AnchorParser()
            parser.feed(result.content.decode("utf-8", errors="replace"))
            for href, title in parser.links:
                absolute = urljoin(result.final_url, href)
                parsed = urlparse(absolute)
                if (parsed.hostname or "").lower() not in hosts:
                    continue
                if parsed.scheme not in {"http", "https"}:
                    continue
                if not parsed.path.lower().endswith(".pdf"):
                    continue
                canonical = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
                if canonical in seen:
                    continue
                seen.add(canonical)
                documents.append(
                    DiscoveredDocument(
                        source_id=str(source.get("source_id") or ""),
                        source_url=canonical,
                        title=title or parsed.path.rsplit("/", 1)[-1],
                        document_type="pdf",
                        evidence={"connector": self.name, "listing_url": listing_url},
                    )
                )
                if len(documents) >= MAX_DISCOVERY_ITEMS:
                    return documents
        return documents


class RssFeedConnector:
    """Discovers PDF enclosures/links from an official RSS or Atom feed."""

    name = "rss_feed"

    def validate_configuration(self, source: Mapping[str, Any]) -> None:
        if not (source.get("source_url") or "").strip():
            raise ConnectorError("Feed URL is required")
        if not approved_hosts(source):
            raise ConnectorError("Source has no approved host")

    def discover_documents(
        self, source: Mapping[str, Any], fetch_listing: Callable[[str], FetchResult]
    ) -> list[DiscoveredDocument]:
        self.validate_configuration(source)
        result = fetch_listing(str(source["source_url"]))
        try:
            root = ET.fromstring(result.content)
        except ET.ParseError as exc:
            raise ConnectorError("Feed is not valid XML") from exc

        hosts = approved_hosts(source)
        documents: list[DiscoveredDocument] = []
        seen: set[str] = set()
        for item in root.iter():
            tag = item.tag.rsplit("}", 1)[-1].lower()
            if tag not in {"item", "entry"}:
                continue
            title = ""
            link = ""
            published = ""
            updated = ""
            for child in item:
                name = child.tag.rsplit("}", 1)[-1].lower()
                if name == "title" and child.text:
                    title = re.sub(r"\s+", " ", child.text).strip()
                elif name == "link":
                    link = child.attrib.get("href") or (child.text or "")
                elif name in {"pubdate", "published", "date"} and child.text:
                    published = _normalize_date(child.text.strip())
                elif name in {"updated", "modified"} and child.text:
                    updated = _normalize_date(child.text.strip())
                elif name == "enclosure":
                    link = child.attrib.get("url") or link
            absolute = urljoin(result.final_url, link.strip())
            parsed = urlparse(absolute)
            if (parsed.hostname or "").lower() not in hosts:
                continue
            if not parsed.path.lower().endswith(".pdf"):
                continue
            canonical = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
            if canonical in seen:
                continue
            seen.add(canonical)
            guid = ""
            for child in item:
                if child.tag.rsplit("}", 1)[-1].lower() == "guid" and child.text:
                    guid = child.text.strip()
            documents.append(
                DiscoveredDocument(
                    source_id=str(source.get("source_id") or ""),
                    source_url=canonical,
                    title=title or canonical.rsplit("/", 1)[-1],
                    external_id=guid,
                    publication_date=published,
                    last_updated_at=updated,
                    evidence={"connector": self.name, "feed_url": str(source.get("source_url"))},
                )
            )
            if len(documents) >= MAX_DISCOVERY_ITEMS:
                break
        return documents


def connector_for(source: Mapping[str, Any]) -> SourceConnector:
    metadata = source.get("metadata") or {}
    configured = str(metadata.get("connector") or "").strip().lower()
    source_type = str(source.get("source_type") or "").strip().lower()
    if configured in {"rss_feed", "rss", "atom"} or source_type in {"rss_feed", "rss"}:
        return RssFeedConnector()
    if configured in {"html_listing", "html"} or source_type in {
        "official_gov",
        "html_listing",
        "government_website",
    }:
        return HtmlListingConnector()
    raise ConnectorError("No connector is available for this source type")

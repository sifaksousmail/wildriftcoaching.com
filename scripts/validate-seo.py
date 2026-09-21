#!/usr/bin/env python3
"""Validate public root HTML, local references, sitemap, and PDF protection.

Usage: python3 scripts/validate-seo.py [--root PATH] [--site-url URL]
Only reads files. Exit 0 means these static checks passed; it does not prove
Google indexing, rich-result eligibility, browser behavior, or live deployment.
"""

import argparse
from collections import Counter, defaultdict
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import unquote, urljoin, urlsplit
import xml.etree.ElementTree as ET


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.path = path
        self.title = []
        self.title_count = 0
        self.h1_count = 0
        self.meta = defaultdict(list)
        self.canonicals = []
        self.ids = set()
        self.references = []
        self.json_ld = []
        self.in_title = False
        self.in_json = False
        self.json_text = []
        self.json_line = 0
        self.feed(path.read_text(encoding="utf-8"))
        self.close()

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        line = self.getpos()[0]
        if attrs.get("id"):
            self.ids.add(attrs["id"])
        if tag == "a" and attrs.get("name"):
            self.ids.add(attrs["name"])
        if tag == "title":
            self.title_count += 1
            self.in_title = True
        if tag == "h1":
            self.h1_count += 1
        if tag == "meta":
            key = attrs.get("name", attrs.get("property", "")).lower()
            self.meta[key].append(attrs.get("content", ""))
        if tag == "link" and "canonical" in attrs.get("rel", "").split():
            self.canonicals.append(attrs.get("href", ""))
        for attribute in ("href", "src", "poster"):
            if attribute in attrs and attrs[attribute]:
                self.references.append((line, attrs[attribute]))
        if tag in ("img", "source") and attrs.get("srcset"):
            for candidate in attrs["srcset"].split(","):
                if candidate.strip():
                    self.references.append((line, candidate.strip().split()[0]))
        if tag == "script" and attrs.get("type", "").lower() == "application/ld+json":
            self.in_json = True
            self.json_text = []
            self.json_line = line

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        if tag == "script" and self.in_json:
            self.json_ld.append((self.json_line, "".join(self.json_text)))
            self.in_json = False

    def handle_data(self, text):
        if self.in_title:
            self.title.append(text)
        if self.in_json:
            self.json_text.append(text)


def validate(root, site_url):
    root = root.resolve()
    errors = []
    warnings = []
    pages = {}
    titles = defaultdict(list)
    reference_count = 0
    schema_count = 0
    base = site_url.rstrip("/") + "/"
    site = urlsplit(base)
    if site.scheme != "https" or not site.netloc or site.path != "/":
        return ["--site-url must be an HTTPS origin, such as https://wildriftcoaching.com"], [], {}
    local_hosts = {site.netloc, "www." + site.netloc.removeprefix("www.")}

    for path in sorted(root.glob("*.html")):
        try:
            pages[path.name] = Page(path)
        except (OSError, UnicodeError, ValueError) as exc:
            errors.append(f"{path.name}: cannot parse HTML: {exc}")
    if not pages:
        errors.append("No root HTML pages found")

    expected_urls = {base if name == "index.html" else base + name for name in pages}
    required_meta = (
        "description", "viewport", "og:title", "og:description", "og:image",
        "og:url", "og:type", "twitter:card", "twitter:title",
        "twitter:description", "twitter:image",
    )
    for name, page in pages.items():
        expected_url = base if name == "index.html" else base + name
        title = " ".join("".join(page.title).split())
        titles[title.casefold()].append(name)
        if page.title_count != 1 or not title:
            errors.append(f"{name}: expected one nonempty title, found {page.title_count}")
        if page.h1_count != 1:
            errors.append(f"{name}: expected one H1, found {page.h1_count}")
        if page.canonicals != [expected_url]:
            errors.append(f"{name}: canonical must be exactly {expected_url}")
        for key in required_meta:
            values = page.meta.get(key, [])
            if len(values) != 1 or not values[0].strip():
                errors.append(f"{name}: expected one nonempty {key} meta tag")
        if page.meta.get("og:url") != [expected_url]:
            errors.append(f"{name}: og:url must match its canonical URL")
        for key in ("robots", "googlebot"):
            directives = re.split(r"[\s,]+", " ".join(page.meta.get(key, [])).lower())
            if set(directives) & {"noindex", "nofollow", "none"}:
                errors.append(f"{name}: blocking {key} directive")
        if not page.json_ld:
            errors.append(f"{name}: missing JSON-LD")
        for line, raw in page.json_ld:
            try:
                data = json.loads(raw)
                if not isinstance(data, (dict, list)) or not data:
                    raise ValueError("JSON-LD must be a nonempty object or array")
                schema_count += 1
            except (ValueError, TypeError) as exc:
                errors.append(f"{name}:{line}: invalid JSON-LD: {exc}")

        for line, reference in page.references:
            parsed = urlsplit(reference)
            if parsed.scheme and parsed.scheme not in {"http", "https"}:
                continue
            absolute = urlsplit(urljoin(expected_url, reference))
            if absolute.netloc not in local_hosts:
                continue
            reference_count += 1
            relative = unquote(absolute.path).lstrip("/") or "index.html"
            target = (root / relative).resolve()
            if not target.is_relative_to(root):
                errors.append(f"{name}:{line}: local reference escapes site root: {reference}")
                continue
            if target.is_dir():
                target /= "index.html"
            if not target.is_file():
                errors.append(f"{name}:{line}: broken local reference: {reference}")
                continue
            if target.suffix.lower() == ".pdf":
                errors.append(f"{name}:{line}: public PDF reference: {reference}")
            fragment = unquote(absolute.fragment).split(":~:text=", 1)[0]
            if fragment and target.suffix.lower() == ".html":
                target_name = target.relative_to(root).as_posix()
                if target_name not in pages:
                    try:
                        target_page = Page(target)
                    except (OSError, UnicodeError, ValueError) as exc:
                        errors.append(f"{name}:{line}: cannot inspect fragment target: {exc}")
                        continue
                else:
                    target_page = pages[target_name]
                if fragment not in target_page.ids:
                    errors.append(f"{name}:{line}: broken fragment: {reference}")
    for title, names in titles.items():
        if title and len(names) > 1:
            errors.append("Duplicate title: " + ", ".join(names))

    sitemap_urls = []
    try:
        tree = ET.parse(root / "sitemap.xml")
        sitemap_urls = [node.text.strip() if node.text else "" for node in tree.findall(".//{*}loc")]
        for url, count in Counter(sitemap_urls).items():
            if count > 1:
                errors.append(f"sitemap.xml: duplicate URL: {url}")
        for url in sorted(expected_urls - set(sitemap_urls)):
            errors.append(f"sitemap.xml: missing page: {url}")
        for url in sorted(set(sitemap_urls) - expected_urls):
            errors.append(f"sitemap.xml: URL without matching root page/canonical: {url}")
    except (OSError, ET.ParseError) as exc:
        errors.append(f"sitemap.xml: cannot parse: {exc}")

    try:
        robots = (root / "robots.txt").read_text(encoding="utf-8")
        if not re.search(r"^Sitemap:\s*" + re.escape(base + "sitemap.xml") + r"\s*$", robots, re.M | re.I):
            errors.append("robots.txt: missing canonical sitemap declaration")
        if re.search(r"^Disallow:\s*/\s*$", robots, re.M | re.I):
            errors.append("robots.txt: site-wide Disallow found")
    except (OSError, UnicodeError) as exc:
        errors.append(f"robots.txt: cannot read: {exc}")

    tracked_pdfs = []
    try:
        result = subprocess.run(
            ["git", "-C", str(root), "ls-files", "-z"],
            capture_output=True, text=True, check=True,
        )
        tracked_pdfs = [name for name in result.stdout.split("\0") if name.lower().endswith(".pdf")]
        for name in tracked_pdfs:
            errors.append(f"Tracked PDF must stay out of the public repository: {name}")
    except (OSError, subprocess.CalledProcessError):
        errors.append("Unable to verify tracked PDFs with git ls-files")

    stats = {
        "root HTML pages": len(pages), "sitemap URLs": len(sitemap_urls),
        "JSON-LD blocks": schema_count, "local references": reference_count,
        "tracked PDFs": len(tracked_pdfs),
    }
    return errors, warnings, stats


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--site-url", default="https://wildriftcoaching.com")
    args = parser.parse_args()
    errors, warnings, stats = validate(args.root.resolve(), args.site_url)
    for key, value in stats.items():
        print(f"{key}: {value}")
    for warning in warnings:
        print(f"WARNING: {warning}")
    for error in errors:
        print(f"ERROR: {error}")
    print(f"Static SEO validation: {len(errors)} errors, {len(warnings)} warnings")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())

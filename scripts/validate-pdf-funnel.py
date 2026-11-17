#!/usr/bin/env python3
"""Read-only PDF funnel regression checks using only the Python standard library.

Usage: python3 scripts/validate-pdf-funnel.py [--root PATH]
Exit 0 means static checks passed, not that checkout, mobile rendering, or live
deployment works. No network requests, private PDF reads, or file writes occur.
"""

import argparse
from collections import Counter
from html import unescape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import unquote, urljoin, urlsplit


SITE = "https://wildriftcoaching.com/"
PRODUCT = "wild-rift-challenger-sovereign-guide.html"
PRODUCT_URL = SITE + PRODUCT
BUY = "https://payhip.com/b/kXKR7"
SAMPLE = "https://payhip.com/preview/kXKR7"
COVER = "payhip-wild-rift-guide-cover.png"
PAGES = ("index.html", "blog.html", PRODUCT)
VOID = set("area base br col embed hr img input link meta param source track wbr".split())
BLOCK = set("p div li ul ol section article h1 h2 h3 br".split())


def normalize(text):
    return " ".join(unescape(text).split())


class Node:
    def __init__(self, tag="", attrs=None, line=1, parent=None):
        self.tag = tag
        self.attrs = attrs or {}
        self.line = line
        self.parent = parent
        self.children = []

    def has_class(self, name):
        return name in self.attrs.get("class", "").split()

    def visible(self):
        # Closed details are intentionally included: their answers are accessible.
        node = self
        while node:
            if (node.tag in {"script", "style", "template"}
                    or "hidden" in node.attrs
                    or node.attrs.get("aria-hidden", "").lower() == "true"):
                return False
            node = node.parent
        return True

    def text(self, visible=True, omit=None):
        if self is omit or (visible and not self.visible()):
            return ""
        value = "".join(child.text(visible, omit) if isinstance(child, Node)
                        else child for child in self.children)
        return value + ("\n" if self.tag in BLOCK else "")

    def nodes(self):
        for child in self.children:
            if isinstance(child, Node):
                yield child
                yield from child.nodes()


class Page(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.stack = [self.root]
        self.feed(text)
        self.close()
        self.nodes = list(self.root.nodes())

    def handle_starttag(self, tag, attrs):
        node = Node(tag, dict(attrs), self.getpos()[0], self.stack[-1])
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                break

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_data(self, text):
        self.stack[-1].children.append(text)


def schema_nodes(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from schema_nodes(child)
    elif isinstance(value, list):
        for child in value:
            yield from schema_nodes(child)


def typed(node, kind):
    value = node.get("@type", [])
    return kind in (value if isinstance(value, list) else [value])


def markup_text(value):
    return normalize(Page(str(value)).root.text())


def validate(root):
    root = root.resolve()
    errors = []
    pages = {}

    def check(ok, message):
        if not ok:
            errors.append(message)

    def local_file(reference, where):
        parsed = urlsplit(urljoin(SITE, reference))
        if parsed.scheme != "https" or parsed.netloc != "wildriftcoaching.com":
            check(False, f"{where}: expected a local image file: {reference}")
            return
        path = (root / unquote(parsed.path).lstrip("/")).resolve()
        check(path.is_relative_to(root) and path.is_file(),
              f"{where}: missing or unsafe image file: {reference}")

    for name in PAGES:
        try:
            pages[name] = Page((root / name).read_text(encoding="utf-8"))
        except (OSError, UnicodeError, ValueError) as exc:
            check(False, f"{name}: cannot read HTML: {exc}")

    for name, page in pages.items():
        ids = Counter(n.attrs["id"] for n in page.nodes if n.attrs.get("id"))
        for identity, count in ids.items():
            check(count == 1, f"{name}: duplicate id {identity!r}")
        links = [n for n in page.nodes if n.tag == "a"]
        check(any(n.visible() and n.attrs.get("href") == BUY for n in links),
              f"{name}: missing visible Payhip buy link")
        expected_nav = {"index.html": "#pdf-guide", "blog.html": PRODUCT,
                        PRODUCT: "#buy-guide"}[name]
        check(any(n.visible() and n.has_class("nav-guide-cta")
                  and n.attrs.get("href") == expected_nav for n in links),
              f"{name}: PDF navigation must link to {expected_nav}")

        for node in links:
            attrs = node.attrs
            href = attrs.get("href", "")
            where = f"{name}:{node.line}"
            identity = attrs.get("id", "")
            label = normalize(node.text()).lower()
            is_sample = ("/preview/" in href or identity.endswith("-preview")
                         or ("pdf" in label and "sample" in label))
            is_buy = identity.startswith("pdf-") and identity.endswith("-buy")
            if is_buy:
                is_sample = False
            if "payhip" in href.lower() or is_sample or is_buy:
                expected = SAMPLE if is_sample else BUY
                check(href == expected, f"{where}: PDF link must be exactly {expected}")
                check(attrs.get("target") == "_blank", f"{where}: expected target=_blank")
                rel = set(attrs.get("rel", "").lower().split())
                check("noopener" in rel, f"{where}: missing rel=noopener")
                if is_sample:
                    check("noreferrer" in rel, f"{where}: sample needs rel=noreferrer")
                else:
                    check("noreferrer" not in rel, f"{where}: buy link must preserve origin referrer")
                    check(attrs.get("referrerpolicy") == "strict-origin",
                          f"{where}: buy link needs referrerpolicy=strict-origin")
            parsed = urlsplit(urljoin(SITE + name, href))
            check(not unquote(parsed.path).lower().endswith(".pdf"),
                  f"{where}: direct public PDF link is not allowed")
            if parsed.netloc == "wildriftcoaching.com":
                target_name = unquote(parsed.path).lstrip("/") or "index.html"
                if target_name in pages and parsed.fragment:
                    target_ids = {n.attrs.get("id") for n in pages[target_name].nodes}
                    check(unquote(parsed.fragment) in target_ids,
                          f"{where}: missing fragment target: {href}")

        cover_images = [n for n in page.nodes if n.tag == "img"
                        and n.attrs.get("src") == COVER and n.visible()]
        check(bool(cover_images), f"{name}: missing visible PNG cover fallback {COVER}")
        for node in page.nodes:
            where = f"{name}:{node.line}"
            if node.tag == "picture":
                fallbacks = [n for n in node.nodes() if n.tag == "img"]
                check(bool(fallbacks), f"{where}: picture needs an img fallback")
                for fallback in fallbacks:
                    local_file(fallback.attrs.get("src", ""), where)
            if node in cover_images:
                local_file(node.attrs["src"], where)
            if node.tag in {"img", "source"} and "srcset" in node.attrs:
                candidates = node.attrs["srcset"].split(",")
                for candidate in candidates:
                    fields = candidate.split()
                    check(bool(fields), f"{where}: empty srcset candidate")
                    if fields:
                        local_file(fields[0], where)

        schemas = []
        for node in page.nodes:
            if node.tag == "script" and node.attrs.get("type") == "application/ld+json":
                try:
                    schemas.extend(schema_nodes(json.loads(node.text(visible=False))))
                except ValueError as exc:
                    check(False, f"{name}:{node.line}: invalid JSON-LD: {exc}")
        products = [n for n in schemas if typed(n, "Product")]
        if name in {"index.html", PRODUCT}:
            check(len(products) == 1, f"{name}: expected one Product schema")
        for product in products:
            expected_id = (SITE + "#wild-rift-climb-guide-pdf" if name == "index.html"
                           else PRODUCT_URL + "#product")
            check(product.get("@id") == expected_id,
                  f"{name}: Product @id changed")
            check(product.get("url") == PRODUCT_URL, f"{name}: Product URL changed")
            offers = product.get("offers", [])
            offers = offers if isinstance(offers, list) else [offers]
            check(bool(offers), f"{name}: missing Product offer")
            for offer in offers:
                check(isinstance(offer, dict) and str(offer.get("price")) == "9.99"
                      and offer.get("priceCurrency") == "EUR" and offer.get("url") == BUY,
                      f"{name}: Product offer must remain 9.99 EUR at {BUY}")
        prices = [n for n in page.nodes if n.has_class("guide-price") and n.visible()]
        check(bool(prices), f"{name}: missing visible guide price")
        for price in prices:
            check(bool(re.match(r"^\u20ac\s*9\.99(?![\d.,])", normalize(price.text()))),
                  f"{name}:{price.line}: visible guide price must remain EUR 9.99")

        # Only the product FAQ belongs to this funnel's equality contract.
        # Compare pairs, not order, formatting, or FAQ item counts.
        visible_faq = []
        for item in (page.nodes if name == PRODUCT else []):
            if item.has_class("faq-item") and item.visible():
                summaries = [n for n in item.nodes() if n.tag == "summary"]
                check(len(summaries) == 1, f"{name}:{item.line}: FAQ needs one summary")
                if len(summaries) == 1:
                    summary = summaries[0]
                    visible_faq.append((normalize(summary.text()),
                                        normalize(item.text(omit=summary))))
        schema_faq = []
        faq_schemas = [n for n in schemas if name == PRODUCT and typed(n, "FAQPage")]
        for faq in faq_schemas:
            questions = faq.get("mainEntity", [])
            questions = questions if isinstance(questions, list) else [questions]
            for question in questions:
                if not isinstance(question, dict) or not typed(question, "Question"):
                    check(False, f"{name}: malformed FAQ Question")
                    continue
                answer = question.get("acceptedAnswer", {})
                if not isinstance(answer, dict) or not typed(answer, "Answer"):
                    check(False, f"{name}: malformed FAQ acceptedAnswer")
                    continue
                schema_faq.append((markup_text(question.get("name", "")),
                                   markup_text(answer.get("text", ""))))
        if name == PRODUCT:
            check(bool(visible_faq) and bool(faq_schemas), f"{name}: missing visible/schema FAQ")
        for question, answer in visible_faq:
            check(bool(question and answer), f"{name}: empty visible FAQ question/answer")
        mismatched = (Counter(visible_faq) - Counter(schema_faq)) + (Counter(schema_faq) - Counter(visible_faq))
        for question in sorted({question for question, _ in mismatched}):
            check(False, f"{name}: visible/schema FAQ mismatch: {question}")

        if name == PRODUCT:
            canonicals = [n.attrs.get("href") for n in page.nodes if n.tag == "link"
                          and "canonical" in n.attrs.get("rel", "").split()]
            check(canonicals == [PRODUCT_URL], f"{name}: product canonical changed")
            webpages = [n for n in schemas if typed(n, "WebPage")
                        and n.get("@id") == PRODUCT_URL + "#webpage"]
            check(len(webpages) == 1 and isinstance(webpages[0].get("mainEntity"), dict)
                  and webpages[0]["mainEntity"].get("@id") == PRODUCT_URL + "#product",
                  f"{name}: WebPage mainEntity must identify the Product")

        if name in {"index.html", PRODUCT}:
            hero_class = "hero" if name == "index.html" else "page-hero"
            expected = PRODUCT if name == "index.html" else SAMPLE
            secondary = [n for hero in page.nodes if hero.has_class(hero_class)
                         for n in hero.nodes() if n.tag == "a"
                         and n.has_class("btn-secondary") and n.visible()]
            check(bool(secondary) and all(n.attrs.get("href") == expected for n in secondary),
                  f"{name}: hero secondary must link to {expected}")
        if name == "blog.html":
            features = [n for n in page.nodes if n.has_class("guide-blog-feature")
                        and n.attrs.get("id") == "pdf-self-study" and n.visible()]
            intro = [n for n in links if n.attrs.get("href") == "#pdf-self-study"
                     and n.visible() and features and n.line < features[0].line]
            check(bool(features) and bool(intro),
                  f"{name}: intro must link to #pdf-self-study before that feature")

    try:
        result = subprocess.run(
            ["git", "-C", str(root), "ls-files", "-z"],
            capture_output=True, text=True, check=True,
        )
        for name in result.stdout.split("\0"):
            check(not name.lower().endswith(".pdf"),
                  f"Tracked PDF must stay private: {name}")
    except (OSError, subprocess.CalledProcessError):
        check(False, "Unable to verify tracked PDFs with git ls-files")
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    errors = validate(args.root)
    for error in errors:
        print(f"ERROR: {error}")
    print(f"PDF funnel validation: {len(errors)} errors across {len(PAGES)} expected pages")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Pack an HTML file into a single self-contained HTML (inline CSS + base64 images)."""

from __future__ import annotations

import argparse
import base64
import re
import urllib.request
from pathlib import Path

MIME = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".css": "text/css",
    ".js": "application/javascript",
}


def fetch_text(url: str, timeout: int = 30) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")


def to_data_uri(path: Path) -> str:
    mime = MIME.get(path.suffix.lower(), "application/octet-stream")
    b64 = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{b64}"


def resolve_local(base_dir: Path, ref: str) -> Path | None:
    if ref.startswith(("data:", "http://", "https://", "//", "mailto:", "#")):
        return None
    cleaned = ref.split("?", 1)[0].split("#", 1)[0]
    if not cleaned:
        return None
    path = Path(cleaned)
    if not path.is_absolute():
        path = (base_dir / cleaned.lstrip("./")).resolve()
    return path if path.exists() else None


def inline_stylesheets(html: str) -> str:
    pattern = re.compile(
        r'<link\b[^>]*\brel=["\']stylesheet["\'][^>]*\bhref=["\']([^"\']+)["\'][^>]*/?>|'
        r'<link\b[^>]*\bhref=["\']([^"\']+)["\'][^>]*\brel=["\']stylesheet["\'][^>]*/?>',
        re.I,
    )

    def repl(match: re.Match[str]) -> str:
        url = match.group(1) or match.group(2)
        try:
            css = fetch_text(url)
            print(f"[css] inlined {url} ({len(css)} chars)")
            return f"<style>/* inlined from {url} */\n{css}\n</style>"
        except Exception as exc:  # noqa: BLE001
            print(f"[css] keep remote (fetch failed): {url} -> {exc}")
            return match.group(0)

    return pattern.sub(repl, html)


def embed_src_attrs(html: str, base_dir: Path) -> str:
    pattern = re.compile(r'\bsrc=(["\'])([^"\']+)\1', re.I)

    def repl(match: re.Match[str]) -> str:
        quote, ref = match.group(1), match.group(2)
        path = resolve_local(base_dir, ref)
        if path is None:
            return match.group(0)
        print(f"[img] embedded {ref} ({path.stat().st_size} bytes)")
        return f"src={quote}{to_data_uri(path)}{quote}"

    return pattern.sub(repl, html)


def embed_css_urls(html: str, base_dir: Path) -> str:
    pattern = re.compile(r"url\(([^)]+)\)", re.I)

    def repl(match: re.Match[str]) -> str:
        raw = match.group(1).strip().strip("\"'")
        path = resolve_local(base_dir, raw)
        if path is None:
            return match.group(0)
        print(f"[url] embedded {raw}")
        return f"url({to_data_uri(path)})"

    return pattern.sub(repl, html)


def pack(src: Path, out: Path) -> None:
    html = src.read_text(encoding="utf-8")
    base_dir = src.parent
    html = inline_stylesheets(html)
    html = embed_src_attrs(html, base_dir)
    html = embed_css_urls(html, base_dir)
    out.write_text(html, encoding="utf-8")
    print(f"[ok] wrote {out} ({out.stat().st_size} bytes)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Pack HTML into a single self-contained file")
    parser.add_argument("src", type=Path, help="source html")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=None,
        help="output path (default: <stem>.single.html)",
    )
    args = parser.parse_args()
    src = args.src.resolve()
    out = args.output.resolve() if args.output else src.with_name(f"{src.stem}.single.html")
    pack(src, out)


if __name__ == "__main__":
    main()

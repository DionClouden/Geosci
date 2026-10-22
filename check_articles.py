#!/usr/bin/env python3
"""
Check article links in data/volcanoes.json.

Local check (recommended while developing):
    python check_articles.py --root .

Live website check:
    python check_articles.py --base-url https://your-site.example/

Outputs:
    data/broken-article-urls.json  - URLs confirmed missing (local) or returning HTTP 404 (live)
    article-link-report.csv        - all unique article paths and their results

Uses only the Python standard library.
"""
import argparse
import csv
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


def load_volcanoes(root: Path, json_path: str):
    path = Path(json_path)
    if not path.is_absolute():
        path = root / path
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError(f"{path} should contain a JSON array of volcanoes")
    return data, path


def local_check(root: Path, article: str):
    # Article values are site-relative paths, e.g. articles/fuji.html.
    rel = urllib.parse.urlsplit(article).path.lstrip("/")
    target = (root / rel).resolve()
    try:
        target.relative_to(root.resolve())
    except ValueError:
        return {"article": article, "result": "unsafe path", "status": "", "checked": str(target)}
    exists = target.is_file()
    return {
        "article": article,
        "result": "OK" if exists else "MISSING",
        "status": "file exists" if exists else "file not found",
        "checked": str(target),
    }


def remote_check(base_url: str, article: str, timeout: float):
    url = urllib.parse.urljoin(base_url.rstrip("/") + "/", article.lstrip("/"))
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "VolcanoArticleLinkChecker/1.0"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            status = response.getcode()
        return {
            "article": article, "result": "OK" if 200 <= status < 400 else "HTTP_ERROR",
            "status": status, "checked": url,
        }
    except urllib.error.HTTPError as exc:
        # Only a 404 is automatically treated as a broken link.
        return {
            "article": article,
            "result": "MISSING" if exc.code == 404 else "HTTP_ERROR",
            "status": exc.code,
            "checked": url,
        }
    except Exception as exc:
        # Network errors/timeouts are not proof that a URL is broken.
        return {
            "article": article, "result": "CHECK_ERROR",
            "status": type(exc).__name__, "checked": url,
        }


def main():
    parser = argparse.ArgumentParser(description="Check volcano article links.")
    parser.add_argument("--root", default=".", help="Website project root (default: current directory)")
    parser.add_argument("--json", default="data/volcanoes.json", help="Path to volcanoes JSON, relative to root by default")
    parser.add_argument("--base-url", help="Optional deployed site base URL, e.g. https://example.com/")
    parser.add_argument("--timeout", type=float, default=12, help="Timeout per request in seconds (default: 12)")
    parser.add_argument("--workers", type=int, default=8, help="Concurrent live requests (default: 8)")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    volcanoes, json_file = load_volcanoes(root, args.json)
    articles = sorted({str(v.get("article", "")).strip() for v in volcanoes if str(v.get("article", "")).strip()})
    missing_article_field = sum(not str(v.get("article", "")).strip() for v in volcanoes)

    if args.base_url:
        base_url = args.base_url.strip()
        if not base_url.startswith(("https://", "http://")):
            parser.error("--base-url must begin with http:// or https://")
        results = []
        with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
            futures = {pool.submit(remote_check, base_url, article, args.timeout): article for article in articles}
            for future in as_completed(futures):
                results.append(future.result())
        results.sort(key=lambda row: row["article"].lower())
        mode = f"live: {base_url}"
    else:
        results = [local_check(root, article) for article in articles]
        mode = f"local files under: {root}"

    output_dir = root / "data"
    output_dir.mkdir(parents=True, exist_ok=True)
    broken = sorted(
        [row["article"] for row in results if row["result"] == "MISSING"],
        key=str.lower,
    )
    (output_dir / "broken-article-urls.json").write_text(
        json.dumps(broken, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    report_path = root / "article-link-report.csv"
    with report_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["article", "result", "status", "checked"])
        writer.writeheader()
        writer.writerows(results)

    counts = {}
    for row in results:
        counts[row["result"]] = counts.get(row["result"], 0) + 1

    print(f"Loaded {len(volcanoes)} volcano records from {json_file}")
    print(f"Checked {len(articles)} unique article paths ({mode})")
    print("Results: " + ", ".join(f"{k}={v}" for k, v in sorted(counts.items())))
    if missing_article_field:
        print(f"Records without an article path: {missing_article_field}")
    print(f"Confirmed missing links: {len(broken)}")
    print(f"Wrote: {output_dir / 'broken-article-urls.json'}")
    print(f"Wrote: {report_path}")
    if any(row["result"] in ("HTTP_ERROR", "CHECK_ERROR") for row in results):
        print("Note: HTTP_ERROR/CHECK_ERROR entries need review; they are not added to the broken list.")
    if broken:
        print("\nConfirmed missing article paths:")
        for article in broken:
            print(f"  - {article}")


if __name__ == "__main__":
    main()

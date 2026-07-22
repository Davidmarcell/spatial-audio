#!/usr/bin/env python3
"""Search Wikimedia Commons for file titles. Usage: search_commons.py "query" [limit]"""
import json
import sys
import time
import urllib.parse
import urllib.request

API = "https://commons.wikimedia.org/w/api.php"
UA = "saudade-image-sourcing/1.0 (research; contact local)"


def api_get(params):
    params = dict(params)
    params["format"] = "json"
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 5:
                time.sleep(20 * (attempt + 1))
                continue
            raise


def main():
    query = sys.argv[1]
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 20
    data = api_get({
        "action": "query",
        "generator": "search",
        "gsrsearch": f"filetype:bitmap {query}",
        "gsrnamespace": 6,
        "gsrlimit": limit,
        "prop": "imageinfo",
        "iiprop": "url|mime|size",
        "iiurlwidth": 300,
    })
    pages = data.get("query", {}).get("pages", {})
    rows = []
    for p in pages.values():
        ii = p.get("imageinfo", [{}])[0]
        rows.append({
            "title": p.get("title"),
            "dim": f"{ii.get('width')}x{ii.get('height')}",
            "mime": ii.get("mime"),
        })
    rows.sort(key=lambda r: r["title"])
    for r in rows:
        print(f"{r['dim']:>12}  {r['mime']:>12}  {r['title']}")


if __name__ == "__main__":
    main()

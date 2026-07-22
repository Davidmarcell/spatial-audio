#!/usr/bin/env python3
"""List members of a Commons category. Usage: cat_commons.py "Category:Name" [limit]"""
import json
import sys
import urllib.parse
import urllib.request

API = "https://commons.wikimedia.org/w/api.php"
UA = "saudade-image-sourcing/1.0 (research; contact local)"


def api_get(params):
    params = dict(params)
    params["format"] = "json"
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def main():
    cat = sys.argv[1]
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 50
    data = api_get({
        "action": "query",
        "list": "categorymembers",
        "cmtitle": cat,
        "cmlimit": limit,
        "cmtype": "file|subcat",
    })
    for m in data.get("query", {}).get("categorymembers", []):
        print(m["title"])


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Print key extmetadata for Commons files. Titles read from argv."""
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


def em(meta, key):
    return (meta.get("extmetadata", {}).get(key, {}) or {}).get("value", "")


for title in sys.argv[1:]:
    data = api_get({
        "action": "query",
        "titles": title,
        "prop": "imageinfo",
        "iiprop": "url|mime|size|extmetadata",
    })
    page = next(iter(data["query"]["pages"].values()))
    ii = page.get("imageinfo", [None])[0]
    print("=" * 80)
    print(title)
    if not ii:
        print("  (no imageinfo)")
        continue
    print(f"  dim: {ii.get('width')}x{ii.get('height')}  mime: {ii.get('mime')}")
    print(f"  licence: {em(ii,'LicenseShortName')}  ({em(ii,'UsageTerms')})")
    print(f"  artist: {em(ii,'Artist')}")
    print(f"  objectname: {em(ii,'ObjectName')}")
    desc = em(ii, "ImageDescription")
    if desc:
        desc = desc.replace("\n", " ")
        print(f"  desc: {desc[:400]}")
    cats = em(ii, "Categories")
    if cats:
        print(f"  cats: {cats[:300]}")

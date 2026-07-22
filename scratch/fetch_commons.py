#!/usr/bin/env python3
"""Fetch scaled Wikimedia Commons images + metadata into scratch/image-options.

Usage: python3 fetch_commons.py <location-folder> <outfile.json> <width>
Reads a JSON list on stdin: [{"file": "File:...", "out": "prefix-name.jpg", "note": "..."}]
"""
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


def fetch(title, width):
    data = api_get({
        "action": "query",
        "titles": title,
        "prop": "imageinfo",
        "iiprop": "url|mime|size|extmetadata",
        "iiurlwidth": width,
    })
    pages = data["query"]["pages"]
    page = next(iter(pages.values()))
    if "imageinfo" not in page:
        return None
    return page["imageinfo"][0]


def em(meta, key):
    ex = meta.get("extmetadata", {})
    v = ex.get(key, {}).get("value")
    return v


def main():
    folder = sys.argv[1]
    outfile = sys.argv[2]
    width = int(sys.argv[3]) if len(sys.argv) > 3 else 1500
    items = json.load(sys.stdin)
    base = f"/Users/david.kirschberg/Projects/saudade/scratch/image-options/{folder}"
    results = []
    for it in items:
        title = it["file"]
        out = it["out"]
        ii = fetch(title, width)
        if ii is None:
            print(f"MISSING: {title}", file=sys.stderr)
            results.append({"file": out, "title": title, "error": "not found"})
            continue
        dl = ii.get("thumburl") or ii["url"]
        dest = f"{base}/{out}"
        req = urllib.request.Request(dl, headers={"User-Agent": UA})
        payload = None
        for attempt in range(6):
            try:
                with urllib.request.urlopen(req, timeout=120) as r:
                    payload = r.read()
                break
            except urllib.error.HTTPError as e:
                if e.code == 429 and attempt < 5:
                    time.sleep(20 * (attempt + 1))
                    continue
                raise
        time.sleep(2)
        with open(dest, "wb") as f:
            f.write(payload)
        rec = {
            "file": out,
            "title": title,
            "mime": ii.get("mime"),
            "orig_dim": f"{ii.get('width')}x{ii.get('height')}",
            "thumb_dim": f"{ii.get('thumbwidth')}x{ii.get('thumbheight')}",
            "bytes": len(payload),
            "licence": (em(ii, "LicenseShortName") or "").strip(),
            "artist": (em(ii, "Artist") or "").strip(),
            "date": (em(ii, "DateTimeOriginal") or "").strip(),
            "credit": (em(ii, "Credit") or "").strip(),
            "descpage": ii.get("descriptionurl"),
            "note": it.get("note", ""),
        }
        results.append(rec)
        print(f"OK: {out}  {rec['thumb_dim']}  {rec['licence']}")
    with open(f"{base}/../{outfile}", "w") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"\nWrote metadata -> scratch/image-options/{outfile}")


if __name__ == "__main__":
    main()

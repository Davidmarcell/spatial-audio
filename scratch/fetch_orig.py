#!/usr/bin/env python3
"""Fetch ORIGINAL Commons files via curl, then downscale locally with PIL.

Usage: python3 fetch_orig.py <location-folder> <outfile.json> <maxedge>
Reads JSON list on stdin: [{"file":"File:...","out":"name.jpg","note":"..."}]
"""
import json
import subprocess
import sys
import urllib.parse
import urllib.request
from PIL import Image

API = "https://commons.wikimedia.org/w/api.php"
UA = "saudade-research/1.0 (https://example.org; sourcing@example.org)"


def filepath_url(title, width):
    name = title.split(":", 1)[1]
    return (
        "https://commons.wikimedia.org/wiki/Special:FilePath/"
        + urllib.parse.quote(name)
        + f"?width={width}"
    )


def api_get(params):
    params = dict(params)
    params["format"] = "json"
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def info(title):
    data = api_get({
        "action": "query",
        "titles": title,
        "prop": "imageinfo",
        "iiprop": "url|mime|size|extmetadata",
    })
    page = next(iter(data["query"]["pages"].values()))
    return page.get("imageinfo", [None])[0]


def em(meta, key):
    return (meta.get("extmetadata", {}).get(key, {}) or {}).get("value")


def main():
    folder = sys.argv[1]
    outfile = sys.argv[2]
    maxedge = int(sys.argv[3]) if len(sys.argv) > 3 else 1500
    items = json.load(sys.stdin)
    base = f"/Users/david.kirschberg/Projects/saudade/scratch/image-options/{folder}"
    results = []
    for it in items:
        title = it["file"]
        out = it["out"]
        ii = info(title)
        if not ii:
            print(f"MISSING: {title}", file=sys.stderr)
            continue
        url = filepath_url(title, maxedge)
        tmp = f"/tmp/_orig_{out}"
        rc = subprocess.run(
            ["curl", "-sL", "--max-time", "90", "-A", UA, "-o", tmp, url]
        ).returncode
        if rc != 0:
            print(f"CURL FAIL ({rc}): {title}", file=sys.stderr)
            continue
        dest = f"{base}/{out}"
        try:
            img = Image.open(tmp)
            img = img.convert("RGB")
            w, h = img.size
            scale = maxedge / max(w, h)
            if scale < 1:
                img = img.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
            img.save(dest, "JPEG", quality=88)
            fw, fh = img.size
        except Exception as e:
            print(f"PIL FAIL: {title}: {e}", file=sys.stderr)
            continue
        rec = {
            "file": out,
            "title": title,
            "orig_dim": f"{w}x{h}",
            "saved_dim": f"{fw}x{fh}",
            "licence": (em(ii, "LicenseShortName") or "").strip(),
            "artist": (em(ii, "Artist") or "").strip(),
            "date": (em(ii, "DateTimeOriginal") or "").strip(),
            "credit": (em(ii, "Credit") or "").strip(),
            "descpage": ii.get("descriptionurl"),
            "note": it.get("note", ""),
        }
        results.append(rec)
        print(f"OK: {out}  {rec['saved_dim']}  {rec['licence']}")
    with open(f"{base}/../{outfile}", "w") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"Wrote -> scratch/image-options/{outfile}")


if __name__ == "__main__":
    main()

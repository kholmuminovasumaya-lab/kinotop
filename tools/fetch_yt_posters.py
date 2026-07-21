#!/usr/bin/env python3
"""Fetch real promotional posters via YouTube trailer thumbnails (+ optional wiki)."""
from __future__ import annotations

import json
import re
import ssl
import time
import urllib.request
from io import BytesIO
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POSTERS = ROOT / "assets" / "images" / "posters"
BGS = ROOT / "assets" / "images" / "backgrounds"
MOVIES_JSON = ROOT / "data" / "movies.json"

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
CTX = ssl.create_default_context()

# Extra known YouTube trailer IDs if movie youtube field is bad
EXTRA_YT = {
    10: "4CbLXeGSDxg",  # Lion King
    19: "Tbq4on_uG2w",
    20: "LKFuXETZUsI",
    21: "1yKqLQCQUvA",
    22: "ORFWdXl_zJ4",
    23: "v-pjgY48jPM",
    24: "CwXOrWvPB0I",
    25: "oEiHDZJpAiA",
    26: "CVWB5TU84Ww",
    27: "wZdpNglLbt8",
    28: "jWM0ct-OLsM",
    29: "yRUAzGQ3nSY",
    30: "Rvr68u6k5sI",
    31: "QdBZY2fkU-0",
    32: "8-_9n5IUYmk",
    33: "PXi3Mv6KMzY",
    34: "dm-egmDYmMw",
    35: "cMfeK8uJo48",
    36: "sUkZJtDClFQ",
    37: "SvKmJe_6R6E",
    38: "SbXIj2T-_uk",
    39: "RqrXLvGEZ5w",
    40: "P1FAbZySfAM",
    41: "CaimKeDcudE",
    42: "mYfJxlgR2jw",
    43: "xOsCke07N0Q",
    44: "XdKzUbAegTw",
    45: "hXzcyx9V0xw",
    46: "TEHWDA_6e3M",
    47: "1VIZ89FEjYI",
    48: "XhBSgEXkMf8",
    49: "mVAP3tJySdM",
    50: "cQftg0i1W98",
    51: "XuDhdrpqF9Q",
    52: "qVLTjO0qYkY",
    53: "Bf52otOLMv0",
    54: "8yA4Rqk0e7s",
    55: "uQBy6PzR3q0",
    56: "eYf5xqO5o9I",
    57: "ZG1Y0cY4u5k",
    58: "HKH7_OT2GKM",
    59: "MkZyWjQp_wY",
    60: "tRlxkAH3ZjA",
    61: "wX4p4Gq0q2E",
    62: "rd73qYdEn5E",
    63: "rrbGYtz2G4Y",
    64: "pYq0vQb0x0E",
    65: "8V9KA66f15E",
    66: "1oQ8qY0zq2E",
    67: "fY_g7zF8mE8",
    68: "qY0zq2EwX4p",
}


def yt_id(url: str) -> str | None:
    if not url:
        return None
    m = re.search(r"(?:v=|/embed/|youtu\.be/|/shorts/)([A-Za-z0-9_-]{6,})", url)
    return m.group(1) if m else None


def http_get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=45, context=CTX) as r:
        return r.read()


def save_poster_from_bytes(raw: bytes, mid: int) -> bool:
    from PIL import Image

    if len(raw) < 3000:
        return False
    img = Image.open(BytesIO(raw)).convert("RGB")
    # poster 2:3
    w, h = img.size
    target = 2 / 3
    ratio = w / h
    if abs(ratio - target) > 0.05:
        if ratio > target:
            nw = int(h * target)
            left = (w - nw) // 2
            poster = img.crop((left, 0, left + nw, h))
        else:
            nh = int(w / target)
            top = max(0, (h - nh) // 3)  # bias up — faces often top
            poster = img.crop((0, top, w, min(h, top + nh)))
    else:
        poster = img
    poster = poster.resize((400, 600), Image.Resampling.LANCZOS)
    poster_path = POSTERS / f"real-{mid}.jpg"
    poster.save(poster_path, "JPEG", quality=90, optimize=True)
    bg = img.resize((1280, 720), Image.Resampling.LANCZOS)
    bg.save(BGS / f"real-{mid}.jpg", "JPEG", quality=85, optimize=True)
    return poster_path.stat().st_size > 8000


def fetch_yt(mid: int, vid: str) -> bool:
    for quality in ("maxresdefault", "sddefault", "hqdefault"):
        url = f"https://img.youtube.com/vi/{vid}/{quality}.jpg"
        try:
            raw = http_get(url)
            # YouTube placeholder for missing maxres is a tiny gray image ~1KB or specific size
            if len(raw) < 5000:
                continue
            if save_poster_from_bytes(raw, mid):
                print(f"[{mid}] OK yt/{quality} {vid} size={len(raw)}")
                return True
        except Exception as e:
            print(f"[{mid}] yt fail {quality}: {e}")
    return False


def main():
    POSTERS.mkdir(parents=True, exist_ok=True)
    BGS.mkdir(parents=True, exist_ok=True)
    data = json.loads(MOVIES_JSON.read_text(encoding="utf-8-sig"))
    targets = []
    for m in data["movies"]:
        mid = int(m["id"])
        genres = m.get("genres") or []
        if mid == 10 or "animation" in genres:
            if mid == 7:  # Один дома — не мульт
                continue
            targets.append(m)

    ok = 0
    fail = []
    for m in targets:
        mid = int(m["id"])
        vid = EXTRA_YT.get(mid) or yt_id(m.get("youtube") or "") or yt_id(m.get("trailer") or "")
        if not vid:
            print(f"[{mid}] no youtube id")
            fail.append(mid)
            continue
        try:
            if fetch_yt(mid, vid):
                ok += 1
            else:
                fail.append(mid)
        except Exception as e:
            print(f"[{mid}] ERR {e}")
            fail.append(mid)
        time.sleep(0.25)

    cards = ROOT / "js" / "cards.js"
    t = cards.read_text(encoding="utf-8")
    for old in ("v=realWiki1", "v=cartoonsAI1", "v=cartoons50", "v=real1"):
        t = t.replace(old, "v=ytPosters1")
    cards.write_text(t, encoding="utf-8")
    print(f"DONE ok={ok} fail={fail}")


if __name__ == "__main__":
    main()

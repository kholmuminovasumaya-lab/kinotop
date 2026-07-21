#!/usr/bin/env python3
"""Download real cartoon movie posters (Wikipedia thumbnails) into KINOBRO."""
from __future__ import annotations

import json
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POSTERS = ROOT / "assets" / "images" / "posters"
BGS = ROOT / "assets" / "images" / "backgrounds"
MOVIES_JSON = ROOT / "data" / "movies.json"
EMBEDDED = ROOT / "js" / "embedded-data.js"
DB_PATH = ROOT / "data" / "kinobro.db"

UA = "KINOBROPosterBot/1.0 (local cinema project; educational)"
CTX = ssl.create_default_context()

# id -> English Wikipedia page title (or RU where better)
WIKI_PAGES = {
    10: "The_Lion_King_(1994_film)",
    19: "Frozen_(2013_film)",
    20: "Moana_(2016_film)",
    21: "Ratatouille_(film)",
    22: "Up_(2009_film)",
    23: "Toy_Story",
    24: "Shrek",
    25: "How_to_Train_Your_Dragon_(2010_film)",
    26: "Monsters,_Inc.",
    27: "Finding_Nemo",
    28: "Zootopia",
    29: "Inside_Out_(2015_film)",
    30: "Coco_(2017_film)",
    31: "The_Incredibles",
    32: "WALL-E",
    33: "Kung_Fu_Panda",
    34: "Madagascar_(2005_film)",
    35: "Ice_Age_(2002_film)",
    36: "Despicable_Me",
    37: "Minions_(film)",
    38: "Cars_(film)",
    39: "Puss_in_Boots_(2011_film)",
    40: "Rio_(2011_film)",
    41: "Encanto_(film)",
    42: "Luca_(2021_film)",
    43: "Soul_(2020_film)",
    44: "Turning_Red",
    45: "Elemental_(2023_film)",
    46: "Brave_(2012_film)",
    47: "Raya_and_the_Last_Dragon",
    48: "The_Croods",
    49: "The_Bad_Guys_(film)",
    50: "Migration_(2023_film)",
    51: "Megamind",
    52: "Hotel_Transylvania",
    53: "The_Grinch_(2018_film)",
    54: "Spirit:_Stallion_of_the_Cimarron",
    55: "The_Princess_and_the_Frog",
    56: "Aladdin_(1992_Disney_film)",
    57: "The_Little_Mermaid_(1989_film)",
    58: "Mulan_(1998_film)",
    59: "Tarzan_(1999_film)",
    60: "Beauty_and_the_Beast_(1991_film)",
    61: "The_Bremen_Town_Musicians",
    62: "Hedgehog_in_the_Fog",
    63: "Winnie-the-Pooh_(Soviet_film)",
    64: "Adventures_of_Mowgli",
    65: "Karlsson-on-the-Roof",
    66: "Cheburashka",
    67: "Nu,_Pogodi!",
    68: "Alyosha_Popovich_and_Tugarin_the_Dragon",
}

# Fallbacks for Russian wiki if EN fails
WIKI_RU = {
    61: "Бременские_музыканты_(мультфильм)",
    62: "Ёжик_в_тумане",
    63: "Винни-Пух_(мультфильм)",
    64: "Маугли_(мультфильм)",
    65: "Малыш_и_Карлсон",
    66: "Чебурашка",
    67: "Ну,_погоди!",
    68: "Алёша_Попович_и_Тугарин_Змей",
}


def http_get(url: str, timeout: int = 40) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout, context=CTX) as resp:
        return resp.read()


def wiki_image_url(title: str, lang: str = "en") -> str | None:
    api = f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(title)}"
    try:
        data = json.loads(http_get(api).decode("utf-8"))
    except Exception as e:
        print(f"  summary fail {lang}:{title}: {e}")
        return None
    for key in ("originalimage", "thumbnail"):
        block = data.get(key) or {}
        src = block.get("source")
        if src:
            # Prefer larger thumbnail
            if "thumb" in src and "/thumb/" in src:
                # try to bump size
                src = src.replace("/220px-", "/600px-").replace("/320px-", "/600px-")
            return src
    return None


def download_image(url: str, dest: Path):
    try:
        raw = http_get(url)
        if len(raw) < 2000:
            print(f"  too small {len(raw)}")
            return False, None
        try:
            from io import BytesIO
            from PIL import Image

            src = Image.open(BytesIO(raw)).convert("RGB")
            poster = src.copy()
            w, h = poster.size
            target_ratio = 2 / 3
            cur = w / h
            if cur > target_ratio * 1.15:
                nw = int(h * target_ratio)
                left = (w - nw) // 2
                poster = poster.crop((left, 0, left + nw, h))
            elif cur < target_ratio * 0.85:
                nh = int(w / target_ratio)
                top = max(0, (h - nh) // 2)
                poster = poster.crop((0, top, w, min(h, top + nh)))
            poster = poster.resize((400, 600), Image.Resampling.LANCZOS)
            poster.save(dest, "JPEG", quality=90, optimize=True)
            bg = src.resize((1280, 720), Image.Resampling.LANCZOS)
            return True, bg
        except Exception as e:
            print(f"  pillow fail, raw save: {e}")
            dest.write_bytes(raw)
            return True, None
    except Exception as e:
        print(f"  download fail: {e}")
        return False, None


def fetch_one(mid: int) -> bool:
    titles = [(WIKI_PAGES.get(mid), "en")]
    if mid in WIKI_RU:
        titles.append((WIKI_RU[mid], "ru"))
    img_url = None
    for title, lang in titles:
        if not title:
            continue
        print(f"[{mid}] try {lang} {title}")
        img_url = wiki_image_url(title, lang)
        if img_url:
            print(f"  got {img_url[:90]}...")
            break
        time.sleep(0.3)
    if not img_url:
        print(f"[{mid}] NO IMAGE")
        return False

    poster_path = POSTERS / f"real-{mid}.jpg"
    bg_path = BGS / f"real-{mid}.jpg"
    ok, bg_img = download_image(img_url, poster_path)
    if not ok:
        return False
    if bg_img is not None:
        bg_img.save(bg_path, "JPEG", quality=88, optimize=True)
    else:
        # copy poster as bg
        bg_path.write_bytes(poster_path.read_bytes())
    print(f"[{mid}] OK {poster_path.stat().st_size} bytes")
    time.sleep(0.4)
    return True


def main():
    POSTERS.mkdir(parents=True, exist_ok=True)
    BGS.mkdir(parents=True, exist_ok=True)
    ok = 0
    fail = []
    for mid in sorted(WIKI_PAGES.keys()):
        try:
            if fetch_one(mid):
                ok += 1
            else:
                fail.append(mid)
        except Exception as e:
            print(f"[{mid}] ERR {e}")
            fail.append(mid)
    print(f"DONE ok={ok} fail={fail}")

    # bump cache in cards.js
    cards = ROOT / "js" / "cards.js"
    text = cards.read_text(encoding="utf-8")
    text2 = text.replace("v=cartoonsAI1", "v=realWiki1").replace("v=cartoons50", "v=realWiki1")
    if text2 != text:
        cards.write_text(text2, encoding="utf-8")
        print("bumped cards.js cache")


if __name__ == "__main__":
    main()

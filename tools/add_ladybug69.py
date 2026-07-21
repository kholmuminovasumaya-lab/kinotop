#!/usr/bin/env python3
"""Add movie id 69 (Ladybug) + real poster."""
from __future__ import annotations

import json
import re
import sqlite3
import ssl
import urllib.error
import urllib.parse
import urllib.request
from io import BytesIO
from pathlib import Path

ROOT = Path(r"C:\Users\Lenovo user\OneDrive\Рабочий стол\KIBO BOOM\cinema")
POSTERS = ROOT / "assets" / "images" / "posters"
BGS = ROOT / "assets" / "images" / "backgrounds"
MOVIES_JSON = ROOT / "data" / "movies.json"
EMBEDDED = ROOT / "js" / "embedded-data.js"
API_JS = ROOT / "js" / "api.js"
CARDS_JS = ROOT / "js" / "cards.js"
DB_PATH = ROOT / "data" / "kinobro.db"

NEW_MOVIE = {
    "id": 69,
    "title": "Леди Баг и Супер-Кот: 6–7 сезон",
    "description": "Маринетт и Адриан продолжают защищать Париж как Леди Баг и Супер-Кот. В 6–7 сезонах их ждут новые силы, тайны Чудес и ещё более опасные враги.",
    "year": 2025,
    "genres": ["animation", "series", "action"],
    "rating": 7.8,
    "duration": 22,
    "poster": "assets/images/posters/real-69.jpg",
    "background": "assets/images/backgrounds/real-69.jpg",
    "video": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    "trailer": "https://rutube.ru/video/e3cae98199bc001d2cb6b0020920df4c/",
    "cast": ["Кристина Ви", "Брайс Папенбрук", "Кит Сильверстайн"],
    "director": "Томас Астрюк",
    "country": "Франция",
    "quality": "HD",
    "age": "6+",
    "type": "series",
    "popular": True,
    "trending": True,
    "price": 10,
    "youtube": "https://rutube.ru/video/e3cae98199bc001d2cb6b0020920df4c/",
}

UA = "KINOBROPosterBot/1.0"
CTX = ssl.create_default_context()
errors: list[str] = []
poster_source = ""


def fetch_json(url: str) -> dict | None:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, context=CTX, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8", errors="replace"))
    except Exception as e:
        errors.append(f"fetch_json {url}: {e}")
        return None


def download_bytes(url: str) -> bytes | None:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, context=CTX, timeout=60) as resp:
            return resp.read()
    except Exception as e:
        errors.append(f"download {url}: {e}")
        return None


def get_poster_url() -> str | None:
    global poster_source
    omdb_urls = [
        "http://www.omdbapi.com/?t=Miraculous&apikey=trilogy",
        "http://www.omdbapi.com/?t=Miraculous:+Tales+of+Ladybug+%26+Cat+Noir&apikey=trilogy",
    ]
    for url in omdb_urls:
        data = fetch_json(url)
        if not data:
            continue
        if data.get("Response") == "True":
            p = (data.get("Poster") or "").strip()
            if p and p.upper() != "N/A":
                poster_source = f"OMDb: {url}"
                return p
        else:
            errors.append(f"OMDb: {data.get('Error', 'unknown')}")

    yt = "https://img.youtube.com/vi/Ox5CiUeCcog/hqdefault.jpg"
    b = download_bytes(yt)
    if b and len(b) > 1000:
        poster_source = "YouTube thumbnail"
        return yt

    wiki = fetch_json(
        "https://en.wikipedia.org/api/rest_v1/page/summary/Miraculous_(TV_series)"
    )
    if wiki:
        thumb = wiki.get("thumbnail") or {}
        src = thumb.get("source")
        if src:
            poster_source = "Wikipedia EN summary"
            return src
    return None


def save_images(poster_url: str) -> None:
    from PIL import Image

    POSTERS.mkdir(parents=True, exist_ok=True)
    BGS.mkdir(parents=True, exist_ok=True)
    raw = download_bytes(poster_url)
    if not raw:
        raise RuntimeError("Could not download poster bytes")
    img = Image.open(BytesIO(raw)).convert("RGB")
    poster_path = POSTERS / "real-69.jpg"
    bg_path = BGS / "real-69.jpg"
    img.resize((400, 600), Image.Resampling.LANCZOS).save(poster_path, "JPEG", quality=88)
    img.resize((1280, 720), Image.Resampling.LANCZOS).save(bg_path, "JPEG", quality=88)


def update_movies_json() -> None:
    payload = json.loads(MOVIES_JSON.read_text(encoding="utf-8-sig"))
    movies = payload.get("movies") or []
    movies = [m for m in movies if int(m.get("id", -1)) != 69]
    movies.append(NEW_MOVIE)
    movies.sort(key=lambda m: int(m["id"]))
    payload["movies"] = movies
    MOVIES_JSON.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def update_embedded() -> None:
    payload = json.loads(MOVIES_JSON.read_text(encoding="utf-8-sig"))
    genres = json.loads((ROOT / "data" / "genres.json").read_text(encoding="utf-8-sig")).get(
        "genres", []
    )
    emb = {"genres": genres, "movies": payload["movies"]}
    EMBEDDED.write_text(
        "window.KinoBoom_EMBEDDED = "
        + json.dumps(emb, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )


def update_api_js() -> None:
    text = API_JS.read_text(encoding="utf-8")
    if re.search(r"\b69:\s*\[", text):
        text = re.sub(
            r"\s*69:\s*\['assets/images/posters/real-69\.jpg',\s*'assets/images/backgrounds/real-69\.jpg'\],?\n",
            "",
            text,
        )
    needle = "68: ['assets/images/posters/real-68.jpg', 'assets/images/backgrounds/real-68.jpg']"
    insert = (
        needle
        + ",\n    69: ['assets/images/posters/real-69.jpg', 'assets/images/backgrounds/real-69.jpg']"
    )
    if needle not in text:
        errors.append("api.js: could not find id 68 line for PHOTO_BY_ID")
        return
    text = text.replace(needle, insert, 1)
    text = re.sub(
        r"(PHOTO_BY_ID\s*=\s*\{[\s\S]*?\n\s*)\}(\s*\n\s*function\s+isWeakPoster)",
        r"\1};\2",
        text,
        count=1,
    )
    API_JS.write_text(text, encoding="utf-8")


def update_db() -> None:
    if not DB_PATH.is_file():
        errors.append("kinobro.db not found (skipped)")
        return
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute(
            "INSERT INTO movies (id, data, is_deleted) VALUES (?, ?, 0) "
            "ON CONFLICT(id) DO UPDATE SET data = excluded.data, is_deleted = 0",
            (69, json.dumps(NEW_MOVIE, ensure_ascii=False)),
        )
        conn.commit()
    finally:
        conn.close()


def bump_cards_cache() -> None:
    text = CARDS_JS.read_text(encoding="utf-8")
    new_text, n = re.subn(r"v=[^'\"]+", "v=ladybug69", text, count=1)
    if n:
        CARDS_JS.write_text(new_text, encoding="utf-8")
    else:
        errors.append("cards.js: cache v= not found")


def main() -> None:
    url = get_poster_url()
    if not url:
        raise SystemExit("No poster URL from any source")
    save_images(url)
    update_movies_json()
    update_api_js()
    update_embedded()
    update_db()
    bump_cards_cache()

    poster_path = POSTERS / "real-69.jpg"
    size = poster_path.stat().st_size
    payload = json.loads(MOVIES_JSON.read_text(encoding="utf-8-sig"))
    m69 = next(m for m in payload["movies"] if m["id"] == 69)
    print("POSTER_SIZE", size)
    print("POSTER_SOURCE", poster_source)
    print("TITLE", m69["title"])
    print("MOVIES_COUNT", len(payload["movies"]))
    if errors:
        print("WARNINGS", errors)


if __name__ == "__main__":
    main()

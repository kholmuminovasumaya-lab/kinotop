# -*- coding: utf-8 -*-
import json
import sqlite3
import sys
import urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8") if hasattr(sys.stdout, "reconfigure") else None

ROOT = Path(__file__).resolve().parent
POSTERS = ROOT / "assets" / "images" / "posters"
BACKGROUNDS = ROOT / "assets" / "images" / "backgrounds"
MOVIES_JSON = ROOT / "data" / "movies.json"
GENRES_JSON = ROOT / "data" / "genres.json"
EMBEDDED = ROOT / "js" / "embedded-data.js"
DB = ROOT / "data" / "kinobro.db"

POSTERS.mkdir(parents=True, exist_ok=True)
BACKGROUNDS.mkdir(parents=True, exist_ok=True)

# Unique realistic photo seeds (Lorem Picsum = real photos)
SEEDS = {
    2: ("city-night-skyline", "urban-lights"),
    3: ("galaxy-nebula-space", "deep-space-stars"),
    4: ("dark-street-neon", "night-crowd"),
    5: ("modern-house-interior", "luxury-stairs"),
    6: ("desert-sand-dunes", "arid-landscape"),
    7: ("christmas-snow-house", "winter-cottage"),
    8: ("empty-hotel-hallway", "eerie-corridor"),
    9: ("cyber-neon-code", "green-matrix-tech"),
    10: ("lion-africa-savanna", "wildlife-sunset"),
    11: ("dark-misty-forest", "foggy-woods"),
    12: ("desert-road-usa", "southwest-canyon"),
    13: ("epic-city-skyline", "dramatic-buildings"),
    14: ("paris-eiffel-warm", "friendly-city"),
    15: ("stars-milky-way", "outer-space"),
    16: ("red-balloon-rain", "dark-alley-rain"),
    17: ("ocean-ship-waves", "blue-sea"),
    18: ("medieval-castle-snow", "mountain-fortress"),
}


def fetch(url: str, dest: Path) -> bool:
    print(f"GET {url} -> {dest.name}", flush=True)
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            data = resp.read()
        if len(data) < 2000:
            print(f"  too small: {len(data)}", flush=True)
            return False
        dest.write_bytes(data)
        print(f"  OK {len(data)} bytes", flush=True)
        return True
    except Exception as e:
        print(f"  FAIL {e}", flush=True)
        return False


def main():
    data = json.loads(MOVIES_JSON.read_text(encoding="utf-8"))
    ok = 0
    for movie in data["movies"]:
        mid = int(movie["id"])
        seed_p, seed_b = SEEDS[mid]
        poster = POSTERS / f"real-{mid}.jpg"
        bg = BACKGROUNDS / f"real-{mid}.jpg"
        # picsum seed URLs return real unique photos
        p_url = f"https://picsum.photos/seed/{seed_p}/400/600.jpg"
        b_url = f"https://picsum.photos/seed/{seed_b}/1920/1080.jpg"
        p_ok = poster.exists() and poster.stat().st_size > 2000
        b_ok = bg.exists() and bg.stat().st_size > 2000
        if not p_ok:
            p_ok = fetch(p_url, poster)
        else:
            print(f"keep {poster.name}", flush=True)
        if not b_ok:
            b_ok = fetch(b_url, bg)
        else:
            print(f"keep {bg.name}", flush=True)
        if p_ok:
            movie["poster"] = f"assets/images/posters/real-{mid}.jpg"
        if b_ok:
            movie["background"] = f"assets/images/backgrounds/real-{mid}.jpg"
        if p_ok:
            ok += 1
            print(f"mapped {mid} {movie['title']}", flush=True)

    MOVIES_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    genres = json.loads(GENRES_JSON.read_text(encoding="utf-8"))
    emb = {"genres": genres.get("genres", []), "movies": data["movies"]}
    EMBEDDED.write_text(
        "window.KinoBoom_EMBEDDED = " + json.dumps(emb, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    if DB.exists():
        conn = sqlite3.connect(str(DB))
        conn.execute("DELETE FROM movies")
        for movie in data["movies"]:
            conn.execute(
                "INSERT INTO movies (id, data, is_deleted) VALUES (?, ?, 0)",
                (movie["id"], json.dumps(movie, ensure_ascii=False)),
            )
        conn.commit()
        conn.close()
    print(f"DONE ok={ok}/{len(data['movies'])}", flush=True)


if __name__ == "__main__":
    main()

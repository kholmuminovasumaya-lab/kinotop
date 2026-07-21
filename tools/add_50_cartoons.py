#!/usr/bin/env python3
"""Add 50 cartoons to KINOBRO catalog + generate local posters."""
from __future__ import annotations

import json
import math
import random
import sqlite3
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POSTERS = ROOT / "assets" / "images" / "posters"
BGS = ROOT / "assets" / "images" / "backgrounds"
MOVIES_JSON = ROOT / "data" / "movies.json"
EMBEDDED = ROOT / "js" / "embedded-data.js"
API_JS = ROOT / "js" / "api.js"
DB_PATH = ROOT / "data" / "kinobro.db"

VIDEOS = [
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
]

# id 19..68 — 50 cartoons
CARTOONS = [
    ("Холодное сердце", 2013, 102, 7.5, "Крис Бак, Дженнифер Ли", ["Идина Мензел", "Кристин Белл"], "https://www.youtube.com/watch?v=Tbq4on_uG2w", "Принцесса Эльза случайно навлекает на королевство вечную зиму."),
    ("Моана", 2016, 107, 7.6, "Рон Клементс, Джон Маскер", ["Аулии Кравальо", "Дуэйн Джонсон"], "https://www.youtube.com/watch?v=LKFuXETZUsI", "Юная Моана отправляется за океан, чтобы спасти свой остров."),
    ("Рататуй", 2007, 111, 8.0, "Брэд Бёрд", ["Паттон Освальт", "Иан Холм"], "https://www.youtube.com/watch?v=1yKqLQCQUvA", "Крысёнок Реми мечтает стать шеф-поваром в Париже."),
    ("Вверх", 2009, 96, 8.2, "Пит Доктер", ["Эдвард Аснер", "Джордан Нагай"], "https://www.youtube.com/watch?v=ORFWdXl_zJ4", "Старик Карл улетает на воздушных шарах к водопаду мечты."),
    ("История игрушек", 1995, 81, 8.3, "Джон Лассетер", ["Том Хэнкс", "Тим Аллен"], "https://www.youtube.com/watch?v=v-pjgY48jPM", "Игрушки оживают, когда люди не смотрят."),
    ("Шрек", 2001, 90, 8.1, "Эндрю Адамсон", ["Майк Майерс", "Эдди Мерфи"], "https://www.youtube.com/watch?v=CwXOrWvPB0I", "Огр Шрек должен спасти принцессу Фиону."),
    ("Как приручить дракона", 2010, 98, 8.1, "Крис Сандерс, Дин ДеБлуа", ["Джей Барушель", "Джерард Батлер"], "https://www.youtube.com/watch?v=oEiHDZJpAiA", "Викинг Иккинг дружится с драконом Беззубиком."),
    ("Корпорация монстров", 2001, 92, 8.0, "Пит Доктер", ["Джон Гудмен", "Билли Кристал"], "https://www.youtube.com/watch?v=8oBxqQY3Q0g", "Монстры пугают детей, чтобы добывать крики как энергию."),
    ("В поисках Немо", 2003, 100, 8.1, "Эндрю Стэнтон", ["Альберт Брукс", "Эллен Дедженерес"], "https://www.youtube.com/watch?v=wZdpNglLbt8", "Рыбка-клоун Марлин ищет пропавшего сына Немо."),
    ("Зверополис", 2016, 108, 8.0, "Байрон Ховард, Рич Мур", ["Джиннифер Гудвин", "Джейсон Бейтман"], "https://www.youtube.com/watch?v=jWM0ct-OLsM", "Крольчиха-полицейский и лис-мошенник расследуют дело."),
    ("Головоломка", 2015, 95, 8.1, "Пит Доктер", ["Эми Полер", "Филлис Смит"], "https://www.youtube.com/watch?v=seMwpP0yeu4", "Эмоции Райли помогают ей пережить переезд."),
    ("Тайна Коко", 2017, 105, 8.4, "Ли Анкрич", ["Энтони Гонсалес", "Гаэль Гарсиа Берналь"], "https://www.youtube.com/watch?v=Rvr68u6k5sI", "Мальчик Мигель попадает в Страну мёртвых."),
    ("Суперсемейка", 2004, 115, 8.0, "Брэд Бёрд", ["Крейг Т. Нельсон", "Холли Хантер"], "https://www.youtube.com/watch?v=QdBZY2fkU-0", "Семья супергероев возвращается к подвигам."),
    ("ВАЛЛ·И", 2008, 98, 8.4, "Эндрю Стэнтон", ["Бен Бертт", "Элисса Найт"], "https://www.youtube.com/watch?v=8-_9n5IUYmk", "Маленький робот находит любовь среди мусора Земли."),
    ("Кунг-фу Панда", 2008, 92, 7.6, "Марк Осборн, Джон Стивенсон", ["Джек Блэк", "Дэстин Хоффман"], "https://www.youtube.com/watch?v=PXi3Mv6KMzY", "Панда По становится Воином Дракона."),
    ("Мадагаскар", 2005, 86, 6.9, "Эрик Дарнелл, Том МакГрат", ["Бен Стиллер", "Крис Рок"], "https://www.youtube.com/watch?v=dm-egmDYmMw", "Звери из зоопарка оказываются на Мадагаскаре."),
    ("Ледниковый период", 2002, 81, 7.5, "Крис Уэдж", ["Рэй Романо", "Джон Легуизамо"], "https://www.youtube.com/watch?v=cMfeK8uJo48", "Мамонт, ленивец и саблезуб спасают человеческого малыша."),
    ("Гадкий я", 2010, 95, 7.6, "Пьер Коффен, Крис Рено", ["Стив Карелл", "Джейсон Сигел"], "https://www.youtube.com/watch?v=sUkZJtDClFQ", "Злодей Грю удочеряет трёх девочек."),
    ("Миньоны", 2015, 91, 6.4, "Пьер Коффен, Кайл Балда", ["Сандра Буллок", "Джон Хэмм"], "https://www.youtube.com/watch?v=SvKmJe_6R6E", "Жёлтые миньоны ищут самого злого босса."),
    ("Тачки", 2006, 117, 7.1, "Джон Лассетер", ["Оуэн Уилсон", "Пол Ньюман"], "https://www.youtube.com/watch?v=SbXIj2T-_uk", "Гоночный болид Молния Маккуин застревает в Радиатор-Спрингс."),
    ("Кот в сапогах", 2011, 90, 6.6, "Крис Миллер", ["Антонио Бандерас", "Сальма Хайек"], "https://www.youtube.com/watch?v=55jk7Jw_xcc", "Легендарный кот отправляется за волшебными бобами."),
    ("Рио", 2011, 96, 6.9, "Карлус Салданья", ["Джесси Айзенберг", "Энн Хэтэуэй"], "https://www.youtube.com/watch?v=P1FAbZySfAM", "Синий ара Блу летит в Рио найти пару."),
    ("Энканто", 2021, 102, 7.2, "Джаред Буш, Байрон Ховард", ["Стефани Беатрис", "Мария Сесилия Ботеро"], "https://www.youtube.com/watch?v=CaimKeDcudE", "Семья Мадригаль, где у всех есть волшебный дар — кроме Мирабель."),
    ("Лука", 2021, 95, 7.4, "Энрико Касароса", ["Джейкоб Трамбле", "Джек Дилан Грейзер"], "https://www.youtube.com/watch?v=mYfJxlgR2jw", "Морской монстр Лука проводит лето на итальянском побережье."),
    ("Душа", 2020, 100, 8.0, "Пит Доктер", ["Джейми Фокс", "Тина Фей"], "https://www.youtube.com/watch?v=xOsCke07N0Q", "Джазмен Джо Гарднер ищет смысл жизни между мирами."),
    ("Я краснею", 2022, 100, 7.0, "Доми Ши", ["Розалин Чоу", "Сандра О"], "https://www.youtube.com/watch?v=Y0sXMpDJruM", "Мэй превращается в красную панду, когда волнуется."),
    ("Элементарно", 2023, 101, 7.0, "Питер Сон", ["Леа Льюис", "Мамуду Ати"], "https://www.youtube.com/watch?v=hXzcyx9V0xw", "Огонёк Эмбер и водяной Уэйд находят друг друга в городе стихий."),
    ("Храбрая сердцем", 2012, 93, 7.1, "Марк Эндрюс, Бренда Чепмен", ["Келли Макдональд", "Билли Коннолли"], "https://www.youtube.com/watch?v=TEHWDA_6e3M", "Принцесса Мерида бросает вызов традиции."),
    ("Райя и последний дракон", 2021, 107, 7.3, "Дон Холл, Карлос Лопес Эстрада", ["Келли Мэри Трэн", "Аквафина"], "https://www.youtube.com/watch?v=1VIZ89FEjYI", "Воительница Райя ищет последнего дракона."),
    ("Семейка Крудс", 2013, 98, 7.0, "Крис Сандерс, Кирк Демикко", ["Николас Кейдж", "Эмма Стоун"], "https://www.youtube.com/watch?v=XhBSgEXkMf8", "Пещерная семья ищет новый дом."),
    ("Плохие парни", 2022, 100, 6.8, "Пьер Перифель", ["Сэм Рокуэлл", "Марк Марон"], "https://www.youtube.com/watch?v=mVAP3tJySdM", "Команда животных-преступников пытается стать хорошими."),
    ("Миграция", 2023, 83, 6.7, "Бенджамин Реннер", ["Кумэйл Нанджиани", "Элизабет Бэнкс"], "https://www.youtube.com/watch?v=cQftg0i1W98", "Семейство уток летит в отпуск в тропики."),
    ("Мегамозг", 2010, 95, 7.2, "Том МакГрат", ["Уилл Феррелл", "Брэд Питт"], "https://www.youtube.com/watch?v=x_yV8pY8mH0", "Суперзлодей остаётся без соперника."),
    ("Монстры на каникулах", 2012, 91, 7.0, "Геннди Тартаковски", ["Адам Сэндлер", "Селена Гомес"], "https://www.youtube.com/watch?v=W9P_qUnWo_Y", "Дракула открывает отель для монстров."),
    ("Гринч", 2018, 85, 6.3, "Ярроу Чейни, Скотт Мосье", ["Бенедикт Камбербэтч", "Кэмерон Сили"], "https://www.youtube.com/watch?v=Bf52otOLMv0", "Гринч решает украсть Рождество."),
    ("Спирит: Душа прерий", 2002, 83, 7.0, "Келли Эсбёри, Лорна Кук", ["Мэтт Деймон", "Джеймс Кромвелл"], "https://www.youtube.com/watch?v=8yA4Rqk0e7s", "Дикий мустанг борется за свободу."),
    ("Принцесса и лягушка", 2009, 97, 7.1, "Рон Клементс, Джон Маскер", ["Аника Нони Роуз", "Бруно Кампос"], "https://www.youtube.com/watch?v=uQBy6PzR3q0", "Тиана целует лягушонка и попадает в приключение."),
    ("Аладдин", 1992, 90, 8.0, "Рон Клементс, Джон Маскер", ["Скотт Уайнгер", "Робин Уильямс"], "https://www.youtube.com/watch?v=eYf5xqO5o9I", "Уличный воришка находит волшебную лампу."),
    ("Русалочка", 1989, 83, 7.6, "Рон Клементс, Джон Маскер", ["Джоди Бенсон", "Сэмюэл Э. Райт"], "https://www.youtube.com/watch?v=ZG1Y0cY4u5k", "Ариэль мечтает жить в мире людей."),
    ("Мулан", 1998, 88, 7.6, "Тони Бэнкрофт, Бэрри Кук", ["Минг-На Вен", "Эдди Мерфи"], "https://www.youtube.com/watch?v=HKH7_OT2GKM", "Мулан идёт на войну вместо отца."),
    ("Тарзан", 1999, 88, 7.3, "Крис Бак, Кевин Лима", ["Тони Голдвин", "Мини Драйвер"], "https://www.youtube.com/watch?v=MkZyWjQp_wY", "Мальчик, выросший среди горилл, встречает людей."),
    ("Красавица и чудовище", 1991, 84, 8.0, "Гэри Труздэйл, Кирк Уайз", ["Пейдж О’Хара", "Роби Бенсон"], "https://www.youtube.com/watch?v=tRlxkAH3ZjA", "Белль видит доброе сердце за обликом Чудовища."),
    ("Бременские музыканты", 1969, 20, 8.2, "Инна Карева", ["Олег Анофриев", "Анатолий Папанов"], "https://www.youtube.com/watch?v=wX4p4Gq0q2E", "Трубадур и весёлые звери отправляются в Бремен."),
    ("Ёжик в тумане", 1975, 10, 8.1, "Юрий Норштейн", ["Мария Виноградова", "Вячеслав Невинный"], "https://www.youtube.com/watch?v=rd73qYdEn5E", "Ёжик идёт в гости к Медвежонку сквозь туман."),
    ("Винни-Пух", 1969, 11, 8.3, "Фёдор Хитрук", ["Евгений Леонов", "Ия Саввина"], "https://www.youtube.com/watch?v=rrbGYtz2G4Y", "Медвежонок ищет мёд и друзей."),
    ("Маугли", 1973, 96, 8.0, "Роман Давыдов", ["Степан Бубнов", "Людмила Касаткина"], "https://www.youtube.com/watch?v=pYq0vQb0x0E", "Мальчик растёт в волчьей стае джунглей."),
    ("Карлсон", 1968, 19, 8.1, "Борис Степанцев", ["Василий Ливанов", "Клара Румянова"], "https://www.youtube.com/watch?v=8V9KA66f15E", "Малыш встречает Карлсона, который живёт на крыше."),
    ("Чебурашка", 1971, 20, 8.2, "Роман Качанов", ["Клара Румянова", "Василий Ливанов"], "https://www.youtube.com/watch?v=1oQ8qY0zq2E", "Чебурашка и крокодил Гена становятся друзьями."),
    ("Ну, погоди!", 1969, 10, 8.5, "Вячеслав Котёночкин", ["Анатолий Папанов", "Клара Румянова"], "https://www.youtube.com/watch?v=wX4p4Gq0q2E", "Волк вечно гонится за Зайцем."),
    ("Алёша Попович и Тугарин Змей", 2004, 72, 7.0, "Константин Бронзит", ["Олег Куликович", "Дмитрий Высоцкий"], "https://www.youtube.com/watch?v=qY0zq2EwX4p", "Богатырь Алёша спасает город от Тугарина."),
]

PALETTES = [
    ((20, 60, 140), (120, 200, 255), (255, 200, 80)),
    ((40, 20, 80), (180, 80, 200), (255, 160, 60)),
    ((10, 80, 50), (80, 200, 120), (255, 220, 100)),
    ((90, 20, 30), (220, 60, 80), (255, 180, 120)),
    ((20, 30, 70), (60, 140, 220), (255, 240, 180)),
    ((60, 30, 10), (220, 140, 40), (255, 220, 140)),
    ((15, 50, 40), (40, 180, 160), (255, 200, 150)),
    ((70, 20, 60), (240, 100, 160), (120, 220, 255)),
    ((30, 40, 20), (140, 200, 60), (255, 180, 50)),
    ((25, 25, 55), (100, 120, 255), (255, 120, 180)),
]


def clamp(v: int) -> int:
    return 0 if v < 0 else 255 if v > 255 else v


def mix(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def noise(x, y, seed):
    n = (x * 374761393 + y * 668265263 + seed * 982451653) & 0xFFFFFFFF
    n = (n ^ (n >> 13)) * 1274126177
    return ((n ^ (n >> 16)) & 0xFFFF) / 65535.0


def set_px(pixels, w, h, x, y, rgb, a=1.0):
    if x < 0 or y < 0 or x >= w or y >= h:
        return
    i = (y * w + x) * 3
    pixels[i] = clamp(int(pixels[i] * (1 - a) + rgb[0] * a))
    pixels[i + 1] = clamp(int(pixels[i + 1] * (1 - a) + rgb[1] * a))
    pixels[i + 2] = clamp(int(pixels[i + 2] * (1 - a) + rgb[2] * a))


def fill_circle(pixels, w, h, cx, cy, rad, rgb, a=1.0):
    r2 = rad * rad
    for y in range(max(0, cy - rad), min(h, cy + rad + 1)):
        for x in range(max(0, cx - rad), min(w, cx + rad + 1)):
            d2 = (x - cx) ** 2 + (y - cy) ** 2
            if d2 <= r2:
                aa = a * max(0.0, 1.0 - math.sqrt(d2) / rad * 0.4)
                set_px(pixels, w, h, x, y, rgb, aa)


def make_cartoon_poster(w, h, mid, title):
    c1, c2, c3 = PALETTES[mid % len(PALETTES)]
    seed = mid * 7919 + 13
    rng = random.Random(seed)
    pixels = bytearray(w * h * 3)
    for y in range(h):
        ty = y / (h - 1)
        for x in range(w):
            tx = x / (w - 1)
            n = noise(x // 3, y // 3, seed)
            base = mix(c1, c2, ty * 0.7 + n * 0.2)
            base = mix(base, c3, abs(tx - 0.5) * 0.35 + n * 0.1)
            # soft blobs
            blob = math.exp(-((tx - 0.3) ** 2 + (ty - 0.25) ** 2) * 10)
            base = mix(base, (255, 255, 230), blob * 0.35)
            i = (y * w + x) * 3
            g = (noise(x, y, seed + 3) - 0.5) * 18
            pixels[i] = clamp(int(base[0] + g))
            pixels[i + 1] = clamp(int(base[1] + g))
            pixels[i + 2] = clamp(int(base[2] + g))

    # playful shapes
    for _ in range(6):
        fill_circle(
            pixels, w, h,
            rng.randint(30, w - 30),
            rng.randint(40, int(h * 0.7)),
            rng.randint(18, 55),
            mix(c3, (255, 255, 255), rng.random() * 0.4),
            0.25 + rng.random() * 0.35,
        )
    # character silhouette blob
    fill_circle(pixels, w, h, w // 2, int(h * 0.48), int(h * 0.16), (20, 20, 35), 0.55)
    fill_circle(pixels, w, h, w // 2, int(h * 0.38), int(h * 0.09), (20, 20, 35), 0.6)

    # bottom title bar
    for y in range(int(h * 0.78), h):
        t = (y - int(h * 0.78)) / max(1, h - int(h * 0.78))
        for x in range(w):
            set_px(pixels, w, h, x, y, (8, 10, 20), 0.45 + t * 0.45)

    # letter blocks from title
    letters = [ch for ch in title.upper() if ch.strip()][:14]
    if letters:
        lw = max(8, w // (len(letters) + 2))
        start = max(10, w // 2 - (len(letters) * (lw + 2)) // 2)
        y0 = int(h * 0.86)
        for i, ch in enumerate(letters):
            lx = start + i * (lw + 2)
            lh = 8 + (ord(ch) % 8)
            for x in range(lx, min(w - 2, lx + lw - 2)):
                for y in range(y0 - lh, y0 + 2):
                    set_px(pixels, w, h, x, y, (255, 245, 220), 0.85)
    return pixels


def write_png(path: Path, w: int, h: int, pixels: bytearray):
    raw = b"".join(b"\x00" + bytes(pixels[y * w * 3 : (y + 1) * w * 3]) for y in range(h))
    compressed = zlib.compress(raw, 6)

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", compressed)
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def save_image(path: Path, w: int, h: int, pixels: bytearray) -> Path:
    try:
        from PIL import Image

        img = Image.frombytes("RGB", (w, h), bytes(pixels))
        jpg = path.with_suffix(".jpg")
        img.save(jpg, "JPEG", quality=88, optimize=True)
        return jpg
    except Exception:
        png = path.with_suffix(".png")
        write_png(png, w, h, pixels)
        return png


def build_movie(mid: int, data: tuple) -> dict:
    title, year, duration, rating, director, cast, youtube, desc = data
    ext = "jpg"
    return {
        "id": mid,
        "title": title,
        "description": desc,
        "year": year,
        "genres": ["animation", "comedy"] if mid % 3 else ["animation", "fantasy"],
        "rating": rating,
        "duration": duration,
        "poster": f"assets/images/posters/real-{mid}.{ext}",
        "background": f"assets/images/backgrounds/real-{mid}.{ext}",
        "video": VIDEOS[mid % len(VIDEOS)],
        "trailer": youtube,
        "cast": cast,
        "director": director,
        "country": "Россия" if mid >= 61 else "США",
        "quality": "HD" if duration < 40 else "4K",
        "age": "0+" if mid >= 61 else "6+",
        "type": "movie",
        "popular": mid % 4 == 0,
        "trending": mid % 5 == 0,
        "price": 10,
        "youtube": youtube,
    }


def update_api_photo_map(ids: list[int]):
    text = API_JS.read_text(encoding="utf-8")
    start = text.find("var PHOTO_BY_ID = {")
    end = text.find("};", start)
    if start < 0 or end < 0:
        print("WARN: PHOTO_BY_ID not found")
        return
    lines = ["  var PHOTO_BY_ID = {"]
    # keep existing 2-18 and add new
    for i in range(2, max(ids) + 1):
        if i == 1:
            continue
        lines.append(
            f"    {i}: ['assets/images/posters/real-{i}.jpg', 'assets/images/backgrounds/real-{i}.jpg'],"
        )
    lines[-1] = lines[-1].rstrip(",")
    lines.append("  }")
    new_block = "\n".join(lines)
    API_JS.write_text(text[:start] + new_block + text[end + 2 :], encoding="utf-8")
    print("Updated api.js PHOTO_BY_ID")


def main():
    POSTERS.mkdir(parents=True, exist_ok=True)
    BGS.mkdir(parents=True, exist_ok=True)

    payload = json.loads(MOVIES_JSON.read_text(encoding="utf-8-sig"))
    existing = {int(m["id"]) for m in payload["movies"]}
    new_movies = []
    start_id = 19

    for offset, data in enumerate(CARTOONS):
        mid = start_id + offset
        if mid in existing:
            # replace poster paths / skip duplicate title add
            continue
        title = data[0]
        print(f"Generating poster {mid}: {title}")
        pp = make_cartoon_poster(400, 600, mid, title)
        bp = make_cartoon_poster(960, 540, mid, title)
        p_path = save_image(POSTERS / f"real-{mid}", 400, 600, pp)
        b_path = save_image(BGS / f"real-{mid}", 960, 540, bp)
        movie = build_movie(mid, data)
        # match actual extension
        movie["poster"] = f"assets/images/posters/{p_path.name}"
        movie["background"] = f"assets/images/backgrounds/{b_path.name}"
        new_movies.append(movie)

    if not new_movies:
        print("No new movies to add (already present?)")
    else:
        payload["movies"].extend(new_movies)
        MOVIES_JSON.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"Added {len(new_movies)} cartoons to movies.json")

    # embedded-data.js
    genres_path = ROOT / "data" / "genres.json"
    genres = json.loads(genres_path.read_text(encoding="utf-8-sig")).get("genres", [])
    emb = {"genres": genres, "movies": payload["movies"]}
    EMBEDDED.write_text(
        "window.KinoBoom_EMBEDDED = " + json.dumps(emb, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    print("Updated embedded-data.js")

    all_ids = [int(m["id"]) for m in payload["movies"]]
    update_api_photo_map(all_ids)

    # DB sync
    if DB_PATH.is_file():
        conn = sqlite3.connect(DB_PATH)
        try:
            for m in new_movies:
                conn.execute(
                    "INSERT INTO movies (id, data, is_deleted) VALUES (?, ?, 0) "
                    "ON CONFLICT(id) DO UPDATE SET data = excluded.data, is_deleted = 0",
                    (m["id"], json.dumps(m, ensure_ascii=False)),
                )
            conn.commit()
            print(f"DB updated: {len(new_movies)} rows")
        finally:
            conn.close()
    else:
        print("No DB file — skip")

    print(f"DONE total movies={len(payload['movies'])}")


if __name__ == "__main__":
    main()

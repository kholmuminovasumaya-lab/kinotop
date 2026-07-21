"""
KINOBRO — сервер с SQLite БД и REST API.
Стандартная библиотека Python, pip не нужен.
"""
from __future__ import annotations

import json
import re
import sqlite3
import threading
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

CINEMA_DIR = Path(__file__).resolve().parent.parent
DB_PATH = CINEMA_DIR / "data" / "kinobro.db"

try:
    import telegram_pay
except ImportError:
    from . import telegram_pay  # type: ignore

_db_lock = threading.Lock()


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _db_lock:
        conn = get_connection()
        try:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS movies (
                    id INTEGER PRIMARY KEY,
                    data TEXT NOT NULL,
                    is_deleted INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE IF NOT EXISTS genres (
                    id TEXT PRIMARY KEY,
                    data TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS kv (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );
                """
            )
            count = conn.execute("SELECT COUNT(*) FROM movies").fetchone()[0]
            if count == 0:
                _seed_from_json(conn)
            conn.commit()
        finally:
            conn.close()


def _load_json(path: Path) -> dict | list:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def _seed_from_json(conn: sqlite3.Connection) -> None:
    movies_path = CINEMA_DIR / "data" / "movies.json"
    genres_path = CINEMA_DIR / "data" / "genres.json"
    if movies_path.is_file():
        payload = _load_json(movies_path)
        for movie in payload.get("movies", []):
            conn.execute(
                "INSERT OR REPLACE INTO movies (id, data, is_deleted) VALUES (?, ?, 0)",
                (movie["id"], json.dumps(movie, ensure_ascii=False)),
            )
    if genres_path.is_file():
        payload = _load_json(genres_path)
        for genre in payload.get("genres", []):
            conn.execute(
                "INSERT OR REPLACE INTO genres (id, data) VALUES (?, ?)",
                (genre["id"], json.dumps(genre, ensure_ascii=False)),
            )


def json_response(handler: SimpleHTTPRequestHandler, data, status: int = 200) -> None:
    body = json.dumps(data, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def read_body(handler: SimpleHTTPRequestHandler) -> dict | list | None:
    length = int(handler.headers.get("Content-Length", 0))
    if length <= 0:
        return None
    raw = handler.rfile.read(length)
    try:
        return json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError:
        return None


HIDDEN_IDS = {1}
HIDDEN_TITLES = ("тёмный рыцарь", "dark knight")


def is_hidden(movie: dict) -> bool:
    if not movie:
        return True
    if movie.get("id") in HIDDEN_IDS:
        return True
    title = str(movie.get("title", "")).lower()
    return any(t in title for t in HIDDEN_TITLES)


def get_movies() -> list[dict]:
    with _db_lock:
        conn = get_connection()
        try:
            rows = conn.execute(
                "SELECT data FROM movies WHERE is_deleted = 0 ORDER BY id"
            ).fetchall()
            movies = [json.loads(r["data"]) for r in rows]
        finally:
            conn.close()
    return [m for m in movies if not is_hidden(m)]


def save_movie(movie: dict) -> dict:
    movie_id = int(movie["id"])
    with _db_lock:
        conn = get_connection()
        try:
            conn.execute(
                """
                INSERT INTO movies (id, data, is_deleted) VALUES (?, ?, 0)
                ON CONFLICT(id) DO UPDATE SET data = excluded.data, is_deleted = 0
                """,
                (movie_id, json.dumps(movie, ensure_ascii=False)),
            )
            conn.commit()
        finally:
            conn.close()
    return movie


def delete_movie(movie_id: int) -> None:
    with _db_lock:
        conn = get_connection()
        try:
            conn.execute(
                "UPDATE movies SET is_deleted = 1 WHERE id = ?",
                (movie_id,),
            )
            conn.commit()
        finally:
            conn.close()


def reset_movies() -> None:
    with _db_lock:
        conn = get_connection()
        try:
            conn.execute("DELETE FROM movies")
            _seed_from_json(conn)
            conn.commit()
        finally:
            conn.close()


def get_genres() -> list[dict]:
    with _db_lock:
        conn = get_connection()
        try:
            rows = conn.execute("SELECT data FROM genres ORDER BY id").fetchall()
            return [json.loads(r["data"]) for r in rows]
        finally:
            conn.close()


def get_all_kv() -> dict:
    with _db_lock:
        conn = get_connection()
        try:
            rows = conn.execute("SELECT key, value FROM kv").fetchall()
            return {r["key"]: json.loads(r["value"]) for r in rows}
        finally:
            conn.close()


def get_kv(key: str):
    with _db_lock:
        conn = get_connection()
        try:
            row = conn.execute("SELECT value FROM kv WHERE key = ?", (key,)).fetchone()
            if not row:
                return None
            return json.loads(row["value"])
        finally:
            conn.close()


def set_kv(key: str, value) -> None:
    with _db_lock:
        conn = get_connection()
        try:
            conn.execute(
                """
                INSERT INTO kv (key, value) VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
                """,
                (key, json.dumps(value, ensure_ascii=False)),
            )
            conn.commit()
        finally:
            conn.close()


def delete_kv(key: str) -> None:
    with _db_lock:
        conn = get_connection()
        try:
            conn.execute("DELETE FROM kv WHERE key = ?", (key,))
            conn.commit()
        finally:
            conn.close()


def list_tables() -> list[dict]:
    with _db_lock:
        conn = get_connection()
        try:
            tables = []
            for name in ("movies", "genres", "kv", "payment_orders", "telegram_settings"):
                count = conn.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0]
                tables.append({"name": name, "rows": count})
            return tables
        finally:
            conn.close()


def query_table(name: str, page: int = 1, limit: int = 50) -> dict:
    allowed = {"movies", "genres", "kv", "payment_orders", "telegram_settings"}
    if name not in allowed:
        return {"error": "unknown table"}
    page = max(1, page)
    limit = min(max(1, limit), 200)
    offset = (page - 1) * limit
    with _db_lock:
        conn = get_connection()
        try:
            total = conn.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0]
            rows = conn.execute(
                f"SELECT * FROM {name} LIMIT ? OFFSET ?", (limit, offset)
            ).fetchall()
            return {
                "table": name,
                "total": total,
                "page": page,
                "limit": limit,
                "rows": [dict(r) for r in rows],
            }
        finally:
            conn.close()


class KinobroHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(CINEMA_DIR), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def log_message(self, format: str, *args) -> None:
        print(f"[KINOBRO DB] {args[0]}")

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        qs = parse_qs(parsed.query)

        if path == "/api/health":
            tg = telegram_pay.get_telegram_info()
            return json_response(
                self,
                {
                    "ok": True,
                    "engine": "sqlite",
                    "db": str(DB_PATH.name),
                    "telegram": tg,
                },
            )

        if path == "/api/payments/access":
            session_id = qs.get("sessionId", [""])[0]
            movie_id = int(qs.get("movieId", ["0"])[0] or 0)
            watch_type = qs.get("watchType", ["trailer"])[0] or "trailer"
            if not session_id or not movie_id:
                return json_response(self, {"error": "invalid params"}, 400)
            return json_response(
                self,
                {
                    "ok": True,
                    "access": telegram_pay.has_access(session_id, movie_id, watch_type),
                },
            )

        if path == "/api/payments/pending":
            session_id = qs.get("sessionId", [""])[0]
            movie_id = int(qs.get("movieId", ["0"])[0] or 0)
            watch_type = qs.get("watchType", ["trailer"])[0] or "trailer"
            if not session_id or not movie_id:
                return json_response(self, {"error": "invalid params"}, 400)
            order = telegram_pay.get_pending_order(session_id, movie_id, watch_type)
            if not order:
                return json_response(self, {"ok": True, "pending": False})
            return json_response(
                self,
                {
                    "ok": True,
                    "pending": True,
                    "orderId": order["id"],
                    "status": order["status"],
                    "movieId": order["movie_id"],
                    "movieTitle": order.get("movie_title") or "",
                    "watchType": order.get("watch_type") or watch_type,
                    "hasReceipt": bool(order.get("receipt_path")),
                },
            )

        if path == "/api/payments/grants":
            session_id = qs.get("sessionId", [""])[0]
            if not session_id:
                return json_response(self, {"error": "sessionId required"}, 400)
            grants = telegram_pay.get_active_grants(session_id)
            return json_response(self, {"ok": True, "grants": grants})

        m = re.match(r"^/api/payments/([a-f0-9]+)/status$", path)
        if m:
            return json_response(self, telegram_pay.get_order_status(m.group(1)))

        if path == "/api/payments/orders":
            limit = int(qs.get("limit", ["50"])[0] or 50)
            status = str(qs.get("status", [""])[0] or "")
            orders = telegram_pay.list_orders(limit=limit, status=status)
            return json_response(self, {"ok": True, "orders": orders})

        m = re.match(r"^/api/payments/([a-f0-9]+)/receipt$", path)
        if m:
            order = telegram_pay.get_order(m.group(1))
            if not order:
                return json_response(self, {"error": "not found"}, 404)
            receipt = telegram_pay.get_receipt_abs_path(order)
            if not receipt:
                return json_response(self, {"error": "receipt not found"}, 404)
            try:
                data = receipt.read_bytes()
            except OSError:
                return json_response(self, {"error": "receipt read failed"}, 500)
            ext = receipt.suffix.lower()
            ctype = {
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".png": "image/png",
                ".webp": "image/webp",
                ".gif": "image/gif",
                ".pdf": "application/pdf",
            }.get(ext, "application/octet-stream")
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.send_header(
                "Content-Disposition",
                f'inline; filename="{receipt.name}"',
            )
            self.end_headers()
            self.wfile.write(data)
            return

        if path == "/api/movies":
            return json_response(self, {"movies": get_movies()})

        if path == "/api/genres":
            return json_response(self, {"genres": get_genres()})

        if path == "/api/kv":
            return json_response(self, {"data": get_all_kv()})

        m = re.match(r"^/api/kv/(.+)$", path)
        if m:
            key = m.group(1)
            value = get_kv(key)
            if value is None:
                return json_response(self, {"error": "not found"}, 404)
            return json_response(self, {"key": key, "value": value})

        if path == "/api/db/tables":
            return json_response(self, {"tables": list_tables()})

        m = re.match(r"^/api/db/table/(\w+)$", path)
        if m:
            page = int(qs.get("page", ["1"])[0])
            limit = int(qs.get("limit", ["50"])[0])
            return json_response(self, query_table(m.group(1), page, limit))

        return super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = unquote(parsed.path)

        if path == "/api/movies":
            body = read_body(self)
            if not body or "id" not in body:
                return json_response(self, {"error": "invalid movie"}, 400)
            movie = save_movie(body)
            return json_response(self, {"ok": True, "movie": movie})

        if path == "/api/movies/reset":
            reset_movies()
            return json_response(self, {"ok": True, "movies": get_movies()})

        if path == "/api/payments/create":
            body = read_body(self)
            if not body:
                return json_response(self, {"error": "invalid body"}, 400)
            session_id = str(body.get("sessionId", "")).strip()
            movie_id = int(body.get("movieId", 0) or 0)
            if not session_id or not movie_id:
                return json_response(self, {"error": "sessionId and movieId required"}, 400)
            if not telegram_pay.is_configured():
                return json_response(self, {"error": "telegram not configured"}, 503)
            fixed_price = 10
            receipt_b64 = str(
                body.get("receiptBase64")
                or body.get("receipt_b64")
                or body.get("receipt")
                or ""
            )
            if not receipt_b64.strip():
                return json_response(
                    self,
                    {"ok": False, "error": "receipt_required", "message": "Прикрепите чек оплаты"},
                )
            result = telegram_pay.create_order(
                session_id=session_id,
                movie_id=movie_id,
                movie_title=str(body.get("movieTitle", "Фильм")),
                price=fixed_price,
                watch_type=str(body.get("watchType", "trailer") or "trailer"),
                user_name=str(body.get("userName", "") or ""),
                user_email=str(body.get("userEmail", "") or ""),
                pay_method=str(body.get("payMethod", "") or ""),
                receipt_b64=receipt_b64,
                receipt_name=str(body.get("receiptName") or body.get("receipt_name") or ""),
                receipt_mime=str(body.get("receiptMime") or body.get("receipt_mime") or ""),
            )
            return json_response(self, result)

        m = re.match(r"^/api/payments/([a-f0-9]+)/approve$", path)
        if m:
            return json_response(self, telegram_pay.approve_order(m.group(1)))

        m = re.match(r"^/api/payments/([a-f0-9]+)/reject$", path)
        if m:
            return json_response(self, telegram_pay.reject_order(m.group(1)))

        return json_response(self, {"error": "not found"}, 404)

    def do_PUT(self) -> None:
        parsed = urlparse(self.path)
        path = unquote(parsed.path)

        m = re.match(r"^/api/kv/(.+)$", path)
        if m:
            key = m.group(1)
            body = read_body(self)
            set_kv(key, body)
            return json_response(self, {"ok": True, "key": key})

        m = re.match(r"^/api/movies/(\d+)$", path)
        if m:
            body = read_body(self)
            if not body:
                return json_response(self, {"error": "invalid body"}, 400)
            body["id"] = int(m.group(1))
            movie = save_movie(body)
            return json_response(self, {"ok": True, "movie": movie})

        return json_response(self, {"error": "not found"}, 404)

    def do_DELETE(self) -> None:
        parsed = urlparse(self.path)
        path = unquote(parsed.path)

        m = re.match(r"^/api/movies/(\d+)$", path)
        if m:
            delete_movie(int(m.group(1)))
            return json_response(self, {"ok": True})

        m = re.match(r"^/api/kv/(.+)$", path)
        if m:
            delete_kv(m.group(1))
            return json_response(self, {"ok": True})

        return json_response(self, {"error": "not found"}, 404)


def create_server(host: str = "127.0.0.1", port: int = 8081) -> ThreadingHTTPServer:
    init_db()
    telegram_pay.ensure_payment_table()
    telegram_pay.start_poller()
    server = ThreadingHTTPServer((host, port), KinobroHandler)
    server.server_name = "KINOBRO (SQLite DB)"
    return server

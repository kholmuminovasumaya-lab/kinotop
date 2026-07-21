"""
Telegram-оплата: заявки админу с кнопкой «Одобрить».
Только стандартная библиотека Python.
"""
from __future__ import annotations

import json
import secrets
import sqlite3
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

CINEMA_DIR = Path(__file__).resolve().parent.parent
CONFIG_PATH = CINEMA_DIR / "data" / "telegram_config.json"
ENV_PATH = CINEMA_DIR / ".env"
DB_PATH = CINEMA_DIR / "data" / "kinobro.db"
RECEIPTS_DIR = CINEMA_DIR / "data" / "receipts"

_lock = threading.Lock()
_poller_started = False
_update_offset = 0
_env_cache: dict[str, str] | None = None

MAX_RECEIPT_BYTES = 6 * 1024 * 1024
ALLOWED_RECEIPT_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf"}


def _parse_env_file(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.is_file():
        return out
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return out
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            out[key] = value
    return out


def load_env() -> dict[str, str]:
    global _env_cache
    if _env_cache is None:
        _env_cache = _parse_env_file(ENV_PATH)
        # Также подхватываем переменные окружения ОС (приоритет выше файла).
        for key in (
            "TELEGRAM_BOT_TOKEN",
            "TELEGRAM_ADMIN_CHAT_ID",
            "TELEGRAM_AUTO_APPROVE",
            "TELEGRAM_AUTO_APPROVE_DELAY_SEC",
        ):
            os_val = __import__("os").environ.get(key)
            if os_val is not None and str(os_val).strip() != "":
                _env_cache[key] = str(os_val).strip()
    return _env_cache


def env_get(key: str, default: str = "") -> str:
    return str(load_env().get(key, default) or default).strip()


def _set_env_key(key: str, value: str) -> None:
    global _env_cache
    if not ENV_PATH.is_file():
        try:
            ENV_PATH.write_text(f"{key}={value}\n", encoding="utf-8")
            _env_cache = None
        except OSError:
            pass
        return
    try:
        lines = ENV_PATH.read_text(encoding="utf-8").splitlines()
        found = False
        out = []
        for line in lines:
            if line.strip().startswith(f"{key}="):
                out.append(f"{key}={value}")
                found = True
            else:
                out.append(line)
        if not found:
            out.append(f"{key}={value}")
        ENV_PATH.write_text("\n".join(out) + "\n", encoding="utf-8")
        _env_cache = None
    except OSError:
        pass


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def ensure_payment_table() -> None:
    with _lock:
        conn = _get_conn()
        try:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS payment_orders (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    movie_id INTEGER NOT NULL,
                    movie_title TEXT NOT NULL,
                    price INTEGER NOT NULL,
                    watch_type TEXT NOT NULL DEFAULT 'trailer',
                    user_name TEXT,
                    user_email TEXT,
                    status TEXT NOT NULL DEFAULT 'pending',
                    created_at INTEGER NOT NULL,
                    approved_at INTEGER,
                    telegram_message_id INTEGER
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS telegram_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
                """
            )
            conn.commit()
            try:
                conn.execute(
                    "ALTER TABLE payment_orders ADD COLUMN pay_method TEXT DEFAULT ''"
                )
                conn.commit()
            except sqlite3.OperationalError:
                pass
            for col, decl in (
                ("receipt_path", "TEXT DEFAULT ''"),
                ("receipt_name", "TEXT DEFAULT ''"),
            ):
                try:
                    conn.execute(
                        f"ALTER TABLE payment_orders ADD COLUMN {col} {decl}"
                    )
                    conn.commit()
                except sqlite3.OperationalError:
                    pass
        finally:
            conn.close()
    RECEIPTS_DIR.mkdir(parents=True, exist_ok=True)


def load_config() -> dict:
    if not CONFIG_PATH.is_file():
        return {}
    try:
        with CONFIG_PATH.open(encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}


def save_config(data: dict) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CONFIG_PATH.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_bot_token() -> str:
    token = env_get("TELEGRAM_BOT_TOKEN")
    if token and token != "ВАШ_ТОКЕН_ОТ_BOTFATHER":
        return token
    return str(load_config().get("bot_token", "")).strip()


def get_admin_chat_ids() -> list[str]:
    """Все chat_id админов. Если задан .env — берём только его (через запятую)."""
    raw = env_get("TELEGRAM_ADMIN_CHAT_ID")
    ids: list[str] = []
    if raw:
        for part in raw.replace(";", ",").split(","):
            cid = part.strip()
            if cid and cid not in ids:
                ids.append(cid)
        return ids
    cfg = load_config()
    cfg_id = str(cfg.get("admin_chat_id", "")).strip()
    if cfg_id:
        ids.append(cfg_id)
        return ids
    with _lock:
        conn = _get_conn()
        try:
            row = conn.execute(
                "SELECT value FROM telegram_settings WHERE key = 'admin_chat_id'"
            ).fetchone()
            if row and str(row["value"]).strip():
                ids.append(str(row["value"]).strip())
        finally:
            conn.close()
    return ids


def get_admin_chat_id() -> str:
    ids = get_admin_chat_ids()
    return ids[0] if ids else ""


def set_admin_chat_id(chat_id: str) -> None:
    chat_id = str(chat_id).strip()
    if not chat_id:
        return
    # Добавляем админа в список, не затирая остальных.
    ids = get_admin_chat_ids()
    if chat_id not in ids:
        ids.append(chat_id)
    joined = ",".join(ids)
    cfg = load_config()
    cfg["admin_chat_id"] = chat_id  # последний /start — основной
    save_config(cfg)
    _set_env_key("TELEGRAM_ADMIN_CHAT_ID", joined)
    global _env_cache
    _env_cache = None
    with _lock:
        conn = _get_conn()
        try:
            conn.execute(
                """
                INSERT INTO telegram_settings (key, value) VALUES ('admin_chat_id', ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
                """,
                (chat_id,),
            )
            conn.commit()
        finally:
            conn.close()


def tg_request(method: str, payload: dict | None = None) -> dict:
    token = get_bot_token()
    if not token:
        return {"ok": False, "description": "bot token missing"}
    url = f"https://api.telegram.org/bot{token}/{method}"
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method="POST" if payload else "GET")
    try:
        with urllib.request.urlopen(req, timeout=50) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read().decode("utf-8"))
        except Exception:
            return {"ok": False, "description": str(e)}
    except Exception as e:
        return {"ok": False, "description": str(e)}


def tg_send_file(
    method: str,
    chat_id: str,
    file_field: str,
    file_path: Path,
    caption: str = "",
    reply_markup: dict | None = None,
) -> dict:
    """Multipart upload for sendPhoto / sendDocument."""
    token = get_bot_token()
    if not token:
        return {"ok": False, "description": "bot token missing"}
    if not file_path.is_file():
        return {"ok": False, "description": "file missing"}
    boundary = f"----KinoBoundary{secrets.token_hex(8)}"
    filename = file_path.name
    file_bytes = file_path.read_bytes()
    parts: list[bytes] = []

    def add_field(name: str, value: str) -> None:
        parts.append(
            (
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n'
                f"{value}\r\n"
            ).encode("utf-8")
        )

    add_field("chat_id", str(chat_id))
    if caption:
        add_field("caption", caption)
        add_field("parse_mode", "HTML")
    if reply_markup:
        add_field("reply_markup", json.dumps(reply_markup, ensure_ascii=False))
    parts.append(
        (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="{file_field}"; filename="{filename}"\r\n'
            f"Content-Type: application/octet-stream\r\n\r\n"
        ).encode("utf-8")
    )
    parts.append(file_bytes)
    parts.append(b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode("utf-8"))
    body = b"".join(parts)
    url = f"https://api.telegram.org/bot{token}/{method}"
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read().decode("utf-8"))
        except Exception:
            return {"ok": False, "description": str(e)}
    except Exception as e:
        return {"ok": False, "description": str(e)}


def save_receipt_file(
    order_id: str,
    receipt_b64: str,
    receipt_name: str = "",
    receipt_mime: str = "",
) -> tuple[str, str]:
    """Decode base64 receipt, save under data/receipts/. Returns (rel_path, original_name)."""
    import base64
    import re as _re

    raw = (receipt_b64 or "").strip()
    if not raw:
        return "", ""
    if "," in raw and raw.lower().startswith("data:"):
        raw = raw.split(",", 1)[1]
    try:
        data = base64.b64decode(raw, validate=False)
    except Exception:
        return "", ""
    if not data or len(data) > MAX_RECEIPT_BYTES:
        return "", ""

    name = Path(str(receipt_name or "receipt.jpg")).name
    ext = Path(name).suffix.lower()
    mime = (receipt_mime or "").lower()
    if ext not in ALLOWED_RECEIPT_EXT:
        if "png" in mime:
            ext = ".png"
        elif "webp" in mime:
            ext = ".webp"
        elif "gif" in mime:
            ext = ".gif"
        elif "pdf" in mime:
            ext = ".pdf"
        else:
            ext = ".jpg"
            name = f"{Path(name).stem or 'receipt'}.jpg"
    safe_stem = _re.sub(r"[^a-zA-Z0-9._-]+", "_", Path(name).stem)[:40] or "receipt"
    RECEIPTS_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{order_id}_{safe_stem}{ext}"
    dest = RECEIPTS_DIR / filename
    dest.write_bytes(data)
    rel = f"data/receipts/{filename}"
    return rel, name


def is_configured() -> bool:
    return bool(get_bot_token())


_bot_username_cache = ""


def get_bot_username() -> str:
    global _bot_username_cache
    if _bot_username_cache:
        return _bot_username_cache
    if not is_configured():
        return ""
    res = tg_request("getMe")
    if res.get("ok") and res.get("result"):
        _bot_username_cache = str(res["result"].get("username", "")).strip()
    return _bot_username_cache


def get_telegram_info() -> dict:
    admin_chat = get_admin_chat_id()
    username = get_bot_username()
    auto = is_auto_approve()
    return {
        "configured": is_configured(),
        "adminReady": bool(get_admin_chat_ids()),
        "adminChatId": admin_chat,
        "botUsername": username,
        "botUrl": f"https://t.me/{username}" if username else "",
        "autoApprove": auto,
        "autoApproveDelaySec": get_auto_approve_delay(),
    }


def is_auto_approve() -> bool:
    # Ручное одобрение по умолчанию. Вкл. авто только явно через .env / конфиг / /auto.
    env_val = env_get("TELEGRAM_AUTO_APPROVE").lower()
    if env_val in ("0", "false", "no", "off"):
        return False
    if env_val in ("1", "true", "yes", "on"):
        return True
    cfg = load_config()
    if "auto_approve" in cfg:
        return bool(cfg.get("auto_approve"))
    return False


def get_auto_approve_delay() -> float:
    env_delay = env_get("TELEGRAM_AUTO_APPROVE_DELAY_SEC")
    cfg = load_config()
    try:
        delay = float(env_delay or cfg.get("auto_approve_delay_sec", 3))
    except (TypeError, ValueError):
        delay = 3.0
    return max(1.0, min(delay, 30.0))


def _auto_approve_worker(order_id: str) -> None:
    delay = get_auto_approve_delay()
    time.sleep(delay)
    order = get_order(order_id)
    if not order or order.get("status") != "pending":
        return
    result = approve_order(order_id)
    if not result.get("ok"):
        return
    order = result.get("order") or get_order(order_id)
    if not order:
        return
    chat_id = get_admin_chat_id()
    if chat_id:
        watch_label = "Трейлер" if order["watch_type"] == "trailer" else "Фильм"
        tg_request(
            "sendMessage",
            {
                "chat_id": chat_id,
                "text": (
                    "✅ <b>Авто-одобрение</b>\n\n"
                    f"Фильм: {order['movie_title']}\n"
                    f"Цена: {order['price']} ₽\n"
                    f"Тип: {watch_label}\n"
                    f"ID: <code>{order_id}</code>\n\n"
                    "Бот подтвердил оплату автоматически."
                ),
                "parse_mode": "HTML",
            },
        )
    print(f"[Telegram] Авто-одобрение заявки {order_id}")


def schedule_auto_approve(order_id: str) -> None:
    if not is_auto_approve():
        return
    thread = threading.Thread(
        target=_auto_approve_worker,
        args=(order_id,),
        daemon=True,
        name=f"auto-approve-{order_id[:8]}",
    )
    thread.start()


def create_order(
    session_id: str,
    movie_id: int,
    movie_title: str,
    price: int,
    watch_type: str = "trailer",
    user_name: str = "",
    user_email: str = "",
    pay_method: str = "",
    receipt_b64: str = "",
    receipt_name: str = "",
    receipt_mime: str = "",
) -> dict:
    ensure_payment_table()
    watch_type = watch_type or "trailer"
    existing = get_pending_order(session_id, movie_id, watch_type)
    if existing:
        tg_info = get_telegram_info()
        return {
            "ok": True,
            "orderId": existing["id"],
            "status": "pending",
            "alreadyPending": True,
            "telegramSent": True,
            "hasReceipt": bool(existing.get("receipt_path")),
            "adminReady": tg_info["adminReady"],
            "botUsername": tg_info["botUsername"],
            "botUrl": tg_info["botUrl"],
            "autoApprove": tg_info["autoApprove"],
            "autoApproveDelaySec": tg_info["autoApproveDelaySec"],
            "message": "Заявка по этому фильму уже на проверке",
        }

    order_id = secrets.token_hex(8)
    now = int(time.time())
    rel_path, orig_name = save_receipt_file(
        order_id, receipt_b64, receipt_name, receipt_mime
    )
    if (receipt_b64 or "").strip() and not rel_path:
        return {"ok": False, "error": "invalid_receipt", "message": "Не удалось сохранить чек"}
    with _lock:
        conn = _get_conn()
        try:
            conn.execute(
                """
                INSERT INTO payment_orders
                (id, session_id, movie_id, movie_title, price, watch_type,
                 user_name, user_email, pay_method, status, created_at,
                 receipt_path, receipt_name)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
                """,
                (
                    order_id,
                    session_id,
                    movie_id,
                    movie_title,
                    price,
                    watch_type,
                    user_name or "",
                    user_email or "",
                    pay_method or "",
                    now,
                    rel_path or "",
                    orig_name or "",
                ),
            )
            conn.commit()
        finally:
            conn.close()

    if is_auto_approve():
        schedule_auto_approve(order_id)
        sent = notify_admin(order_id, auto_mode=True)
    else:
        sent = notify_admin(order_id, auto_mode=False)
    tg_info = get_telegram_info()
    return {
        "ok": True,
        "orderId": order_id,
        "status": "pending",
        "alreadyPending": False,
        "telegramSent": sent,
        "hasReceipt": bool(rel_path),
        "adminReady": tg_info["adminReady"],
        "botUsername": tg_info["botUsername"],
        "botUrl": tg_info["botUrl"],
        "autoApprove": tg_info["autoApprove"],
        "autoApproveDelaySec": tg_info["autoApproveDelaySec"],
    }


def get_order(order_id: str) -> dict | None:
    ensure_payment_table()
    with _lock:
        conn = _get_conn()
        try:
            row = conn.execute(
                "SELECT * FROM payment_orders WHERE id = ?", (order_id,)
            ).fetchone()
            return dict(row) if row else None
        finally:
            conn.close()


def get_order_status(order_id: str) -> dict:
    order = get_order(order_id)
    if not order:
        return {"ok": False, "error": "not_found"}
    return {
        "ok": True,
        "orderId": order["id"],
        "status": order["status"],
        "approved": order["status"] == "approved",
    }


def has_access(session_id: str, movie_id: int, watch_type: str = "trailer") -> bool:
    ensure_payment_table()
    min_approved = int(time.time()) - 86400
    with _lock:
        conn = _get_conn()
        try:
            row = conn.execute(
                """
                SELECT id FROM payment_orders
                WHERE session_id = ? AND movie_id = ? AND watch_type = ?
                  AND status = 'approved'
                  AND approved_at IS NOT NULL
                  AND approved_at >= ?
                LIMIT 1
                """,
                (session_id, movie_id, watch_type or "trailer", min_approved),
            ).fetchone()
            return row is not None
        finally:
            conn.close()


def get_pending_order(
    session_id: str, movie_id: int, watch_type: str = "trailer"
) -> dict | None:
    """Return latest pending order for this session + movie + watch type."""
    ensure_payment_table()
    session_id = (session_id or "").strip()
    if not session_id or not movie_id:
        return None
    with _lock:
        conn = _get_conn()
        try:
            row = conn.execute(
                """
                SELECT * FROM payment_orders
                WHERE session_id = ? AND movie_id = ? AND watch_type = ?
                  AND status = 'pending'
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (session_id, int(movie_id), watch_type or "trailer"),
            ).fetchone()
            return dict(row) if row else None
        finally:
            conn.close()


def get_active_grants(session_id: str) -> list[dict]:
    ensure_payment_table()
    min_approved = int(time.time()) - 86400
    with _lock:
        conn = _get_conn()
        try:
            rows = conn.execute(
                """
                SELECT movie_id, movie_title, watch_type, price, approved_at
                FROM payment_orders
                WHERE session_id = ? AND status = 'approved'
                  AND approved_at IS NOT NULL
                  AND approved_at >= ?
                ORDER BY approved_at DESC
                """,
                (session_id, min_approved),
            ).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()


def approve_order(order_id: str) -> dict:
    ensure_payment_table()
    now = int(time.time())
    with _lock:
        conn = _get_conn()
        try:
            existing = conn.execute(
                "SELECT * FROM payment_orders WHERE id = ?", (order_id,)
            ).fetchone()
            if not existing:
                return {"ok": False, "error": "not_found"}
            if existing["status"] == "approved":
                return {"ok": True, "order": dict(existing)}
            conn.execute(
                """
                UPDATE payment_orders
                SET status = 'approved', approved_at = ?
                WHERE id = ? AND status = 'pending'
                """,
                (now, order_id),
            )
            conn.commit()
            row = conn.execute(
                "SELECT * FROM payment_orders WHERE id = ?", (order_id,)
            ).fetchone()
        finally:
            conn.close()
    if not row:
        return {"ok": False, "error": "not_found"}
    return {"ok": True, "order": dict(row)}


def reject_order(order_id: str) -> dict:
    ensure_payment_table()
    with _lock:
        conn = _get_conn()
        try:
            conn.execute(
                "UPDATE payment_orders SET status = 'rejected' WHERE id = ? AND status = 'pending'",
                (order_id,),
            )
            conn.commit()
        finally:
            conn.close()
    return {"ok": True}


def get_receipt_abs_path(order: dict) -> Path | None:
    rel = str(order.get("receipt_path") or "").strip().replace("\\", "/")
    if not rel:
        return None
    # only allow files under data/receipts/
    name = Path(rel).name
    path = (RECEIPTS_DIR / name).resolve()
    root = RECEIPTS_DIR.resolve()
    try:
        path.relative_to(root)
    except ValueError:
        return None
    if path.is_file():
        return path
    return None


def list_orders(limit: int = 50, status: str = "") -> list[dict]:
    ensure_payment_table()
    limit = max(1, min(int(limit or 50), 200))
    with _lock:
        conn = _get_conn()
        try:
            if status:
                rows = conn.execute(
                    """
                    SELECT * FROM payment_orders
                    WHERE status = ?
                    ORDER BY created_at DESC
                    LIMIT ?
                    """,
                    (status, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT * FROM payment_orders
                    ORDER BY created_at DESC
                    LIMIT ?
                    """,
                    (limit,),
                ).fetchall()
            out = []
            for row in rows:
                item = dict(row)
                item["hasReceipt"] = bool(item.get("receipt_path"))
                item["receiptUrl"] = (
                    f"/api/payments/{item['id']}/receipt" if item["hasReceipt"] else ""
                )
                out.append(item)
            return out
        finally:
            conn.close()


def notify_admin(order_id: str, auto_mode: bool = False) -> bool:
    order = get_order(order_id)
    if not order:
        return False
    chat_ids = get_admin_chat_ids()
    if not chat_ids:
        if auto_mode:
            return True
        print("[Telegram] admin_chat_id не задан. Напишите боту /start в Telegram.")
        return False

    user_line = order.get("user_name") or "Гость"
    if order.get("user_email"):
        user_line += f" ({order['user_email']})"

    watch_label = "Трейлер" if order["watch_type"] == "trailer" else "Фильм"
    pay_labels = {
        "card": "Карта",
        "mobile": "Мобильный",
        "wallet": "Кошелёк",
        "sbp": "СБП",
        "transfer": "Перевод",
    }
    pay_method = pay_labels.get(str(order.get("pay_method", "")), "Не указан")
    receipt_name = order.get("receipt_name") or ""
    has_receipt = bool(order.get("receipt_path"))
    receipt_line = (
        f"<b>Чек:</b> {receipt_name or 'прикреплён'}\n"
        if has_receipt
        else "<b>Чек:</b> не прикреплён\n"
    )
    delay = int(get_auto_approve_delay())
    if auto_mode:
        text = (
            "🎬 <b>Новая заявка на оплату</b>\n\n"
            f"<b>Фильм:</b> {order['movie_title']}\n"
            f"<b>Цена:</b> {order['price']} ₽\n"
            f"<b>Способ:</b> {pay_method}\n"
            f"<b>Тип:</b> {watch_label}\n"
            f"<b>Пользователь:</b> {user_line}\n"
            f"{receipt_line}"
            f"<b>ID заявки:</b> <code>{order_id}</code>\n\n"
            f"🤖 Бот автоматически одобрит через ~{delay} сек."
        )
        keyboard = None
    else:
        text = (
            "🎬 <b>Новая заявка на оплату</b>\n\n"
            f"<b>Фильм:</b> {order['movie_title']}\n"
            f"<b>Цена:</b> {order['price']} ₽\n"
            f"<b>Способ:</b> {pay_method}\n"
            f"<b>Тип:</b> {watch_label}\n"
            f"<b>Пользователь:</b> {user_line}\n"
            f"{receipt_line}"
            f"<b>ID заявки:</b> <code>{order_id}</code>\n\n"
            "Проверьте чек и нажмите кнопку:"
        )
        keyboard = {
            "inline_keyboard": [
                [
                    {"text": "✅ Одобрить", "callback_data": f"pay_approve:{order_id}"},
                    {"text": "❌ Отклонить", "callback_data": f"pay_reject:{order_id}"},
                ]
            ]
        }

    receipt_path = get_receipt_abs_path(order)
    ext = receipt_path.suffix.lower() if receipt_path else ""
    use_photo = ext in {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    use_doc = ext == ".pdf"

    any_ok = False
    last_msg_id = None
    for chat_id in chat_ids:
        res: dict = {"ok": False}
        if receipt_path and use_photo:
            res = tg_send_file(
                "sendPhoto",
                chat_id,
                "photo",
                receipt_path,
                caption=text,
                reply_markup=keyboard,
            )
            if not res.get("ok"):
                print("[Telegram] sendPhoto error to", chat_id, ":", res.get("description", res))
                res = {"ok": False}
        elif receipt_path and use_doc:
            res = tg_send_file(
                "sendDocument",
                chat_id,
                "document",
                receipt_path,
                caption=text,
                reply_markup=keyboard,
            )
            if not res.get("ok"):
                print(
                    "[Telegram] sendDocument error to",
                    chat_id,
                    ":",
                    res.get("description", res),
                )
                res = {"ok": False}

        if not res.get("ok"):
            payload = {
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "HTML",
            }
            if keyboard:
                payload["reply_markup"] = keyboard
            res = tg_request("sendMessage", payload)
            if not res.get("ok"):
                print(
                    "[Telegram] sendMessage error to",
                    chat_id,
                    ":",
                    res.get("description", res),
                )

        if res.get("ok") and res.get("result"):
            any_ok = True
            last_msg_id = res["result"].get("message_id")

    if any_ok and last_msg_id is not None:
        with _lock:
            conn = _get_conn()
            try:
                conn.execute(
                    "UPDATE payment_orders SET telegram_message_id = ? WHERE id = ?",
                    (last_msg_id, order_id),
                )
                conn.commit()
            finally:
                conn.close()
        return True
    return False


def _handle_callback(callback: dict) -> None:
    data = str(callback.get("data", ""))
    callback_id = callback.get("id")
    message = callback.get("message") or {}
    chat_id = message.get("chat", {}).get("id")
    message_id = message.get("message_id")

    if data.startswith("pay_approve:"):
        order_id = data.split(":", 1)[1]
        if callback_id:
            tg_request(
                "answerCallbackQuery",
                {
                    "callback_query_id": callback_id,
                    "text": "Покупка одобрена · доступ 24 часа",
                    "show_alert": False,
                },
            )
        result = approve_order(order_id)
        order = result.get("order") if result.get("ok") else get_order(order_id)
        if order and chat_id and message_id:
            tg_request(
                "editMessageText",
                {
                    "chat_id": chat_id,
                    "message_id": message_id,
                    "text": (
                        "✅ <b>Покупка одобрена</b>\n\n"
                        f"Фильм: {order['movie_title']}\n"
                        f"Цена: {order['price']} ₽\n"
                        f"Тип: {'Трейлер' if order['watch_type'] == 'trailer' else 'Фильм'}\n"
                        f"ID: <code>{order_id}</code>\n\n"
                        "Пользователь может смотреть 24 часа."
                    ),
                    "parse_mode": "HTML",
                },
            )
    elif data.startswith("pay_reject:"):
        order_id = data.split(":", 1)[1]
        if callback_id:
            tg_request(
                "answerCallbackQuery",
                {
                    "callback_query_id": callback_id,
                    "text": "Заявка отклонена",
                    "show_alert": False,
                },
            )
        reject_order(order_id)
        order = get_order(order_id)
        if order and chat_id and message_id:
            tg_request(
                "editMessageText",
                {
                    "chat_id": chat_id,
                    "message_id": message_id,
                    "text": (
                        "❌ <b>Заявка отклонена</b>\n\n"
                        f"Фильм: {order['movie_title']}\n"
                        f"ID: <code>{order_id}</code>"
                    ),
                    "parse_mode": "HTML",
                },
            )


def _handle_message(message: dict) -> None:
    text = str(message.get("text", "")).strip()
    chat = message.get("chat") or {}
    chat_id = chat.get("id")
    if not chat_id:
        return
    if text.startswith("/start"):
        set_admin_chat_id(str(chat_id))
        # Всегда ручной режим при подключении админа
        cfg = load_config()
        cfg["auto_approve"] = False
        save_config(cfg)
        _set_env_key("TELEGRAM_AUTO_APPROVE", "false")
        global _env_cache
        _env_cache = None
        tg_request(
            "sendMessage",
            {
                "chat_id": chat_id,
                "text": (
                    "✅ KINOTOP: вы администратор оплат.\n\n"
                    "👤 Режим: <b>ручной</b> — одобряйте кнопками в заявках.\n\n"
                    f"Ваш chat_id: <code>{chat_id}</code>\n\n"
                    "Команды:\n"
                    "/manual — ручное одобрение\n"
                    "/auto — авто-одобрение\n"
                    "/reject &lt;id&gt; — отклонить заявку"
                ),
                "parse_mode": "HTML",
            },
        )
        return
    if text.startswith("/auto"):
        cfg = load_config()
        cfg["auto_approve"] = True
        save_config(cfg)
        _set_env_key("TELEGRAM_AUTO_APPROVE", "true")
        tg_request(
            "sendMessage",
            {
                "chat_id": chat_id,
                "text": "🤖 Авто-одобрение включено. Бот сам подтверждает оплату.",
            },
        )
        return
    if text.startswith("/manual"):
        cfg = load_config()
        cfg["auto_approve"] = False
        save_config(cfg)
        _set_env_key("TELEGRAM_AUTO_APPROVE", "false")
        tg_request(
            "sendMessage",
            {
                "chat_id": chat_id,
                "text": "👤 Ручной режим. Одобряйте заявки кнопками в Telegram.",
            },
        )
        return
    if text.startswith("/reject"):
        parts = text.split(maxsplit=1)
        if len(parts) < 2:
            tg_request(
                "sendMessage",
                {
                    "chat_id": chat_id,
                    "text": "Использование: /reject <id_заявки>",
                },
            )
            return
        order_id = parts[1].strip()
        order = get_order(order_id)
        if not order:
            tg_request(
                "sendMessage",
                {"chat_id": chat_id, "text": "Заявка не найдена."},
            )
            return
        reject_order(order_id)
        tg_request(
            "sendMessage",
            {
                "chat_id": chat_id,
                "text": f"❌ Заявка {order_id} отклонена.",
            },
        )


def _poll_once() -> None:
    global _update_offset
    if not is_configured():
        return
    res = tg_request(
        "getUpdates",
        {"offset": _update_offset, "timeout": 25, "allowed_updates": ["message", "callback_query"]},
    )
    if not res.get("ok"):
        return
    for update in res.get("result", []):
        _update_offset = max(_update_offset, int(update.get("update_id", 0)) + 1)
        if "callback_query" in update:
            _handle_callback(update["callback_query"])
        elif "message" in update:
            _handle_message(update["message"])


def _poll_loop() -> None:
    while True:
        try:
            _poll_once()
        except Exception as e:
            print("[Telegram] poll error:", e)
            time.sleep(3)


def start_poller() -> None:
    global _poller_started
    if _poller_started or not is_configured():
        return
    _poller_started = True
    ensure_payment_table()
    tg_request("deleteWebhook", {})
    # Прогреваем username бота
    get_bot_username()
    thread = threading.Thread(target=_poll_loop, daemon=True, name="telegram-poller")
    thread.start()
    print("[Telegram] Бот оплаты запущен. Напишите боту /start для привязки админа.")
    # Уведомляем админа, что система готова
    for chat_id in get_admin_chat_ids():
        tg_request(
            "sendMessage",
            {
                "chat_id": chat_id,
                "text": (
                    "✅ <b>KINOTOP запущен</b>\n\n"
                    "Оплата работает в ручном режиме.\n"
                    "Когда кто-то нажмёт «Я ОПЛАТИЛ», сюда придёт заявка "
                    "с кнопками <b>Одобрить</b> / <b>Отклонить</b>.\n\n"
                    "Команда: /manual"
                ),
                "parse_mode": "HTML",
            },
        )

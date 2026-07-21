# KINOTOP — Онлайн-кинотеатр

Современный стриминговый сервис на **HTML5, CSS3 и Vanilla JavaScript**.

## Запуск

### Вариант 1 — Python (рекомендуется)
```bash
python start.py
```
Откроются:
- Portfolio (таджикский) — http://localhost:8080/
- KINOTOP (русский) — http://localhost:8081/
- Админ — http://localhost:8081/admin/
- База данных — http://localhost:8081/db-admin/

### Вариант 2 — вручную
```bash
cd cinema
python -m http.server 8081
```
Затем откройте `index.html` в браузере.

### Вариант 3 — без Python
Двойной клик по `cinema/index.html` (режим `file://`).

## Требования
| Нужно | Зачем |
|-------|--------|
| **Python 3.8+** | Локальный сервер (`start.py` или `python -m http.server`) |
| **Браузер** | Chrome, Edge, Firefox |
| **JavaScript** | Обязательно включён |
| **Интернет** | YouTube-трейлеры, шрифты, постеры |

Установка пакетов **не нужна** — только стандартная библиотека Python.

## Языки
- **KINOTOP** — русский (`lang="ru"`)
- **Portfolio** — таджикский (`lang="tg"`)

## База данных

**SQLite** (`cinema/data/kinobro.db`) — серверная БД при запуске через `python start.py`.

| Таблица | Что хранит |
|---------|------------|
| `movies` | Каталог фильмов |
| `genres` | Жанры |
| `kv` | Пользователи, избранное, история, оплаты, настройки |

### Интерфейс БД (как phpMyAdmin)
http://localhost:8081/db-admin/

Там можно смотреть все таблицы и строки в браузере.

### Резерв: IndexedDB в браузере
Если сайт открыт без сервера (`file://` или `python -m http.server`), используется **IndexedDB** (`kinobro_db`) + `localStorage`.

Файл сервера: `server/kinobro_server.py`  
API: `/api/movies`, `/api/genres`, `/api/kv`, `/api/health`

## Админ-панель
`admin/` — логин: **123456**, пароль: **123456**

Админка связана с основным сайтом через общий каталог (`api.js` + `localStorage`).

---
© KINOTOP · 2026

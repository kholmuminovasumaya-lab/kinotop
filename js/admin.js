(function (global) {
  'use strict';
  var KB = global.KinoBoom;
  var U = KB.utils;
  var api = KB.api;
  var storage = KB.storage;
  var ADMIN_LOGIN = '123456';
  var ADMIN_PASSWORD = '123456';
  var allMovies = [];
  var editingId = null;

  function removeFallback() {
    var fb = document.getElementById('admin-fallback');
    if (fb) fb.remove();
  }

  function formatOrderTime(ts) {
    if (!ts) return '—';
    try {
      return new Date(Number(ts) * 1000).toLocaleString('ru-RU');
    } catch (e) {
      return String(ts);
    }
  }

  function payMethodLabel(method) {
    var map = { card: 'Карта', mobile: 'Мобильный', wallet: 'Кошелёк', sbp: 'СБП', transfer: 'Перевод' };
    return map[method] || (method || '—');
  }

  function statusLabel(status) {
    if (status === 'approved') return 'Одобрено';
    if (status === 'rejected') return 'Отклонено';
    return 'Ожидает';
  }

  function loadPaymentOrders() {
    var empty = document.getElementById('admin-orders-empty');
    var list = document.getElementById('admin-orders-list');
    if (!list) return;
    if (!KB.backend) {
      if (empty) empty.textContent = 'Сервер недоступен — заявки не загружены.';
      return;
    }
    var ready = KB.backend.ensureReady ? KB.backend.ensureReady() : Promise.resolve();
    ready.then(function () {
      if (!KB.backend.isEnabled || !KB.backend.isEnabled()) {
        if (empty) empty.textContent = 'Сервер недоступен — заявки не загружены.';
        return;
      }
      var apiBase = KB.backend.getApiBase ? KB.backend.getApiBase() : '';
      return KB.backend.listPaymentOrders(40).then(function (res) {
      var orders = (res && res.orders) || [];
      if (!orders.length) {
        if (empty) empty.textContent = 'Пока нет заявок на оплату.';
        list.innerHTML = '';
        return;
      }
      if (empty) empty.textContent = '';
      list.innerHTML = orders.map(function (o) {
        var status = o.status || 'pending';
        var receiptHtml = o.hasReceipt
          ? '<a href="' + apiBase + 'api/payments/' + o.id + '/receipt" target="_blank" rel="noopener">' +
            '<img class="admin-order__thumb" src="' + apiBase + 'api/payments/' + o.id + '/receipt" alt="Чек" ' +
            'onerror="this.style.display=\'none\';this.nextSibling&&(this.nextSibling.hidden=false);" />' +
            '<span hidden>Открыть чек</span></a>'
          : '<div class="admin-order__thumb" style="display:flex;align-items:center;justify-content:center;font-size:12px;color:#888;">нет чека</div>';
        var actions = status === 'pending'
          ? '<button type="button" class="btn btn--sm btn--primary" data-approve="' + o.id + '">Одобрить</button>' +
            '<button type="button" class="btn btn--sm btn--danger" data-reject="' + o.id + '">Отклонить</button>'
          : '';
        return (
          '<article class="admin-order" data-order="' + o.id + '">' +
          receiptHtml +
          '<div class="admin-order__meta">' +
          '<div><strong>«' + (o.movie_title || 'Фильм') + '»</strong> · ' + (o.price || 10) + ' ₽</div>' +
          '<div>Способ: ' + payMethodLabel(o.pay_method) + ' · ' +
          (o.watch_type === 'movie' ? 'Фильм' : 'Трейлер') + '</div>' +
          '<div>Пользователь: ' + (o.user_name || 'Гость') +
          (o.user_email ? ' (' + o.user_email + ')' : '') + '</div>' +
          '<div>ID: <code>' + o.id + '</code> · ' + formatOrderTime(o.created_at) + '</div>' +
          '<div><span class="admin-order__status admin-order__status--' + status + '">' +
          statusLabel(status) + '</span></div></div>' +
          '<div class="admin-order__actions">' + actions + '</div></article>'
        );
      }).join('');

      list.onclick = function (e) {
        var approve = e.target.closest('[data-approve]');
        var reject = e.target.closest('[data-reject]');
        if (approve) {
          KB.backend.approvePaymentOrder(approve.getAttribute('data-approve')).then(function (r) {
            if (r && r.ok) {
              U.showToast('Заявка одобрена', 'success');
              loadPaymentOrders();
            } else {
              U.showToast('Не удалось одобрить', 'error');
            }
          }).catch(function () { U.showToast('Ошибка сервера', 'error'); });
        }
        if (reject) {
          KB.backend.rejectPaymentOrder(reject.getAttribute('data-reject')).then(function (r) {
            if (r && r.ok) {
              U.showToast('Заявка отклонена', 'success');
              loadPaymentOrders();
            } else {
              U.showToast('Не удалось отклонить', 'error');
            }
          }).catch(function () { U.showToast('Ошибка сервера', 'error'); });
        }
      };
      });
    }).catch(function () {
      if (empty) empty.textContent = 'Не удалось загрузить заявки. Проверьте, что сервер запущен.';
    });
  }

  function renderLogin() {
    removeFallback();
    var base = U.getBasePath();
    var header = document.querySelector('.header');
    var footer = document.querySelector('.footer');
    if (header) header.style.display = 'none';
    if (footer) footer.style.display = 'none';
    var main = document.querySelector('main');
    if (!main) {
      main = document.createElement('main');
      document.body.appendChild(main);
    }
    main.className = 'admin-login';
    main.innerHTML =
      '<a href="' + base + 'index.html" class="header__logo" style="position:absolute;top:24px;left:24px;color:#E50914;font-weight:bold;font-size:1.25rem;display:flex;align-items:center;gap:8px;"><img src="' + base + 'assets/logo/logo-boom.png" alt="KINOTOP" width="32" height="32" style="border-radius:6px;object-fit:cover;" /><span>KINOTOP</span></a>' +
      '<div class="admin-login__box">' +
      '<h1>KINOTOP Админ</h1>' +
      '<p style="color:#B0B0B0;margin-bottom:16px;font-size:14px;">Вход в панель управления</p>' +
      '<div class="form-group"><label style="color:#B0B0B0;font-size:13px;">Логин</label>' +
      '<input type="text" id="admin-login" placeholder="Логин" autocomplete="off" value="" style="width:100%;padding:12px;margin:8px 0 16px;background:#081638;border:1px solid rgba(168,85,247,0.3);color:#fff;border-radius:8px;" /></div>' +
      '<div class="form-group"><label style="color:#B0B0B0;font-size:13px;">Пароль</label>' +
      '<input type="password" id="admin-pass" placeholder="Пароль" autocomplete="new-password" style="width:100%;padding:12px;margin:8px 0 16px;background:#081638;border:1px solid rgba(168,85,247,0.3);color:#fff;border-radius:8px;" /></div>' +
      '<button class="btn btn--primary" id="admin-login-btn" style="width:100%;">Войти</button>' +
      '<a href="' + base + 'index.html" class="btn btn--ghost" style="display:block;margin-top:16px;">← Вернуться на сайт</a></div>';

    document.getElementById('admin-login-btn').onclick = function () {
      var login = document.getElementById('admin-login').value.trim();
      var pass = document.getElementById('admin-pass').value.trim();
      if (login === ADMIN_LOGIN && pass === ADMIN_PASSWORD) {
        storage.setAdminAuth(true);
        location.reload();
      } else {
        U.showToast('Неверный логин или пароль', 'error');
      }
    };
    document.getElementById('admin-pass').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') document.getElementById('admin-login-btn').click();
    });
  }

  function renderAdmin() {
    removeFallback();
    var base = U.getBasePath();
    var header = document.querySelector('.header');
    var footer = document.querySelector('.footer');
    if (header) header.style.display = '';
    if (footer) footer.style.display = '';
    var main = document.querySelector('main');
    if (main) main.className = 'page';
    main.innerHTML =
      '<div class="page__header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;">' +
      '<div><h1 class="page__title">Админ-панель KINOTOP</h1><p class="page__subtitle">Изменения сразу на главном сайте</p></div>' +
      '<a href="' + base + 'index.html" class="btn btn--secondary">← На сайт</a> ' +
      '<a href="' + base + 'db-admin/" class="btn btn--ghost">🗄 База данных</a></div>' +
      '<div class="admin-stats">' +
      '<div class="admin-stat"><div class="admin-stat__value">' + allMovies.length + '</div><div class="admin-stat__label">Фильмов</div></div>' +
      '<div class="admin-stat"><div class="admin-stat__value">' + storage.getMoviesOverride().length + '</div><div class="admin-stat__label">Изменено</div></div>' +
      '<div class="admin-stat"><div class="admin-stat__value">' + storage.getDeletedMovies().length + '</div><div class="admin-stat__label">Удалено</div></div></div>' +
      '<section class="admin-orders" id="admin-orders">' +
      '<h2 class="admin-orders__title">Заявки на оплату</h2>' +
      '<p class="admin-orders__empty" id="admin-orders-empty">Загрузка заявок…</p>' +
      '<div id="admin-orders-list"></div></section>' +
      '<div class="admin-grid"><div>' +
      '<button class="btn btn--primary" id="add-btn">+ Добавить</button> ' +
      '<button class="btn btn--secondary" id="reset-btn">Сбросить</button> ' +
      '<button class="btn btn--ghost" id="logout-btn">Выйти</button>' +
      '<div class="admin-table-wrap" style="margin-top:16px;"><table class="admin-table"><thead><tr>' +
      '<th>Постер</th><th>Название</th><th>Год</th><th>Цена</th><th>★</th><th></th></tr></thead><tbody id="tbody"></tbody></table></div></div>' +
      '<form class="admin-form" id="form"><h2 class="admin-form__title">Редактирование</h2>' +
      '<div class="form-group"><label>Название</label><input id="f-title" required /></div>' +
      '<div class="form-group"><label>Описание</label><textarea id="f-desc"></textarea></div>' +
      '<div class="form-row"><div class="form-group"><label>Год</label><input type="number" id="f-year" /></div>' +
      '<div class="form-group"><label>Рейтинг</label><input type="number" step="0.1" id="f-rating" /></div></div>' +
      '<div class="form-row"><div class="form-group"><label>Цена</label><input type="text" id="f-price" value="10р" readonly style="opacity:0.85;" /></div>' +
      '<div class="form-group"><label>URL постера</label><input type="text" id="f-poster" placeholder="https://..." /></div></div>' +
      '<div class="form-group"><label>Жанры</label><input id="f-genres" placeholder="action, drama" /></div>' +
      '<div class="form-group"><label>Режиссёр</label><input id="f-director" /></div>' +
      '<div class="form-group"><label>Актёры</label><input id="f-cast" /></div>' +
      '<div class="form-group"><label>YouTube трейлер (русский)</label><input id="f-youtube" placeholder="https://www.youtube.com/watch?v=..." /></div>' +
      '<div class="form-group"><label>URL видео (запасной)</label><input id="f-video" /></div>' +
      '<button type="submit" class="btn btn--primary">Сохранить</button></form></div>';

    loadPaymentOrders();

    var frag = document.createDocumentFragment();
    allMovies.forEach(function (m) {
      var tr = U.createEl('tr');
      var posterSrc = U.resolveAssetUrl(m.poster);
      tr.innerHTML =
        '<td><img class="admin-table__poster" src="' + posterSrc + '" alt="" onerror="this.src=\'' + base + 'assets/images/posters/poster-' + m.id + '.svg\'" /></td>' +
        '<td>' + m.title + '</td><td>' + m.year + '</td>' +
        '<td style="color:#E50914;font-weight:bold;">10р</td>' +
        '<td>' + m.rating + '</td>' +
        '<td><button class="btn btn--sm btn--secondary" data-e="' + m.id + '">✏️</button> ' +
        '<button class="btn btn--sm btn--danger" data-d="' + m.id + '">🗑</button></td>';
      frag.appendChild(tr);
    });
    document.getElementById('tbody').replaceChildren(frag);

    document.getElementById('tbody').onclick = function (e) {
      var ed = e.target.closest('[data-e]');
      var del = e.target.closest('[data-d]');
      if (ed) {
        var m = allMovies.find(function (x) { return x.id === +ed.dataset.e; });
        editingId = m.id;
        document.getElementById('f-title').value = m.title;
        document.getElementById('f-desc').value = m.description || '';
        document.getElementById('f-year').value = m.year;
        document.getElementById('f-rating').value = m.rating;
        document.getElementById('f-price').value = '10р';
        document.getElementById('f-poster').value = m.poster || '';
        document.getElementById('f-genres').value = (m.genres || []).join(', ');
        document.getElementById('f-director').value = m.director || '';
        document.getElementById('f-cast').value = (m.cast || []).join(', ');
        document.getElementById('f-youtube').value = m.youtube || '';
        document.getElementById('f-video').value = m.video || '';
      }
      if (del && confirm('Удалить «' + (allMovies.find(function (x) { return x.id === +del.dataset.d; }) || {}).title + '»?')) {
        Promise.resolve(api.deleteMovie(+del.dataset.d)).then(function () { location.reload(); });
      }
    };
    document.getElementById('add-btn').onclick = function () { editingId = null; document.getElementById('form').reset(); };
    document.getElementById('reset-btn').onclick = function () {
      if (confirm('Сбросить все изменения?')) {
        Promise.resolve(api.resetAdminChanges()).then(function () { location.reload(); });
      }
    };
    document.getElementById('logout-btn').onclick = function () { storage.setAdminAuth(false); location.reload(); };
    document.getElementById('form').onsubmit = function (e) {
      e.preventDefault();
      var ex = allMovies.find(function (m) { return m.id === editingId; });
      var id = editingId || U.generateMovieId(allMovies);
      var movie = {
        id: id,
        title: document.getElementById('f-title').value,
        description: document.getElementById('f-desc').value,
        year: +document.getElementById('f-year').value || 2024,
        rating: +document.getElementById('f-rating').value || 7,
        price: 10,
        duration: ex ? ex.duration : 90,
        age: ex ? ex.age : '12+',
        quality: ex ? ex.quality : 'HD',
        type: ex ? ex.type : 'movie',
        genres: U.parseGenres(document.getElementById('f-genres').value),
        director: document.getElementById('f-director').value,
        cast: U.parseCast(document.getElementById('f-cast').value),
        country: ex ? ex.country : '',
        youtube: document.getElementById('f-youtube').value,
        video: document.getElementById('f-video').value,
        trailer: ex ? ex.trailer : '',
        poster: document.getElementById('f-poster').value || (ex ? ex.poster : 'assets/images/posters/poster-' + id + '.svg'),
        background: ex ? ex.background : 'assets/images/backgrounds/bg-' + id + '.svg',
        popular: ex ? ex.popular : false,
        trending: ex ? ex.trending : false
      };
      Promise.resolve(editingId ? api.saveMovie(movie) : api.addMovie(movie)).then(function () {
        U.showToast('Сохранено', 'success');
        location.reload();
      });
    };
  }

  KB.adminInit = function () {
    if (!storage.isAdminAuthenticated()) {
      renderLogin();
      U.hidePreloader();
      return;
    }
    KB.router.initPage('admin');
    U.initScrollTop();
    api.loadMovies().then(function (movies) {
      allMovies = movies;
      renderAdmin();
      U.hidePreloader();
    }).catch(function () {
      removeFallback();
      document.querySelector('main').innerHTML = '<div class="empty-state"><h3>Ошибка загрузки данных</h3><p>Обновите страницу</p></div>';
      U.hidePreloader();
    });
  };
})(window);

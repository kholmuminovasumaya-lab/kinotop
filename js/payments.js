(function (global) {
  'use strict';
  var KB = global.KinoBoom;
  var storage = KB.storage;
  var U = KB.utils;
  var STEP_PRICE = 10;
  var FIXED_PRICE = 10;
  var POLL_MS = 2000;
  var POLL_MAX = 300;
  var ACCESS_TTL_MS = 24 * 60 * 60 * 1000;
  var ACCESS_STORE_KEY = 'kibo_access_grants';
  var PENDING_STORE_KEY = 'kibo_pending_orders';

  var PAY_METHODS = [
    { id: 'card', label: 'Карта', iconClass: 'payment-method__icon--card' },
    { id: 'mobile', label: 'Мобильный', iconClass: 'payment-method__icon--mobile' },
    { id: 'wallet', label: 'Кошелёк', iconClass: 'payment-method__icon--wallet' }
  ];

  var PAY_METHOD_LABELS = {
    card: 'Карта',
    mobile: 'Мобильный',
    wallet: 'Кошелёк',
    sbp: 'СБП',
    transfer: 'Перевод'
  };

  function getPurchaseCounts() {
    var counts = storage.getItem(storage.STORAGE_KEYS.PURCHASE_COUNTS, null);
    if (counts !== null) return counts;
    counts = {};
    var legacy = storage.getItem(storage.STORAGE_KEYS.PURCHASED, []);
    legacy.forEach(function (id) {
      counts[String(id)] = Number(counts[String(id)] || 0) + 1;
    });
    storage.setItem(storage.STORAGE_KEYS.PURCHASE_COUNTS, counts);
    return counts;
  }

  function getPurchaseCount(movieId) {
    var counts = getPurchaseCounts();
    return Number(counts[String(movieId)]) || 0;
  }

  function getNextPrice() {
    return FIXED_PRICE;
  }

  function recordPurchase(movieId) {
    var counts = getPurchaseCounts();
    var key = String(movieId);
    counts[key] = getPurchaseCount(movieId) + 1;
    storage.setItem(storage.STORAGE_KEYS.PURCHASE_COUNTS, counts);
  }

  function accessKey(movieId, watchType) {
    return String(movieId) + '_' + (watchType || 'trailer');
  }

  function getAccessStore() {
    try {
      var raw = sessionStorage.getItem(ACCESS_STORE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveAccessStore(store) {
    sessionStorage.setItem(ACCESS_STORE_KEY, JSON.stringify(store));
  }

  function getPendingStore() {
    try {
      var raw = sessionStorage.getItem(PENDING_STORE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function savePendingStore(store) {
    sessionStorage.setItem(PENDING_STORE_KEY, JSON.stringify(store || {}));
  }

  function setPendingOrder(movieId, watchType, orderId) {
    if (!orderId) return;
    var store = getPendingStore();
    store[accessKey(movieId, watchType)] = {
      orderId: String(orderId),
      movieId: Number(movieId),
      watchType: watchType || 'trailer',
      savedAt: Date.now()
    };
    savePendingStore(store);
    sessionStorage.setItem('kibo_pending_order', String(orderId));
  }

  function clearPendingOrder(movieId, watchType, orderId) {
    var store = getPendingStore();
    var key = accessKey(movieId, watchType);
    if (store[key] && (!orderId || store[key].orderId === String(orderId))) {
      delete store[key];
      savePendingStore(store);
    }
    var legacy = sessionStorage.getItem('kibo_pending_order');
    if (legacy && (!orderId || legacy === String(orderId))) {
      sessionStorage.removeItem('kibo_pending_order');
    }
  }

  function getLocalPendingOrder(movieId, watchType) {
    var entry = getPendingStore()[accessKey(movieId, watchType)];
    if (!entry || !entry.orderId) return null;
    return entry;
  }

  function findPendingForMovie(movieId, watchType) {
    watchType = watchType || 'trailer';
    var local = getLocalPendingOrder(movieId, watchType);
    return ensurePaymentServerReady().then(function (ready) {
      if (!ready || !KB.backend.getPendingPayment) {
        return local
          ? { pending: true, orderId: local.orderId, fromCache: true }
          : { pending: false };
      }
      return KB.backend.getPendingPayment(getPaySessionId(), movieId, watchType).then(function (res) {
        if (res && res.ok && res.pending && res.orderId) {
          setPendingOrder(movieId, watchType, res.orderId);
          return {
            pending: true,
            orderId: res.orderId,
            movieTitle: res.movieTitle || '',
            fromCache: false
          };
        }
        if (local) clearPendingOrder(movieId, watchType, local.orderId);
        return { pending: false };
      }).catch(function () {
        return local
          ? { pending: true, orderId: local.orderId, fromCache: true }
          : { pending: false };
      });
    });
  }

  function grantAccess(movieId, watchType) {
    var store = getAccessStore();
    var now = Date.now();
    store[accessKey(movieId, watchType)] = {
      grantedAt: now,
      expiresAt: now + ACCESS_TTL_MS
    };
    saveAccessStore(store);
  }

  function revokeAccess(movieId, watchType) {
    var store = getAccessStore();
    delete store[accessKey(movieId, watchType)];
    saveAccessStore(store);
  }

  function hasLocalAccess(movieId, watchType) {
    var store = getAccessStore();
    var entry = store[accessKey(movieId, watchType)];
    if (!entry) return false;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      revokeAccess(movieId, watchType);
      return false;
    }
    return true;
  }

  function syncGrantsFromServer() {
    if (!KB.backend || !KB.backend.isEnabled()) return Promise.resolve();
    return KB.backend.getPaymentGrants(getPaySessionId()).then(function (res) {
      if (!res || !res.ok || !res.grants) return;
      var store = getAccessStore();
      res.grants.forEach(function (g) {
        var approvedAt = Number(g.approved_at || 0) * 1000;
        var expiresAt = approvedAt + ACCESS_TTL_MS;
        if (expiresAt > Date.now()) {
          store[accessKey(g.movie_id, g.watch_type)] = {
            grantedAt: approvedAt || Date.now(),
            expiresAt: expiresAt
          };
        }
      });
      saveAccessStore(store);
    }).catch(function () {});
  }

  function ensurePaymentServerReady() {
    if (!KB.backend) return Promise.resolve(false);
    if (KB.backend.isEnabled && KB.backend.isEnabled()) return Promise.resolve(true);
    if (KB.backend.ensureReady) return KB.backend.ensureReady();
    return Promise.resolve(false);
  }

  function isPaymentServerReady() {
    return !!(KB.backend && KB.backend.isEnabled && KB.backend.isEnabled());
  }

  function checkAccess(movieId, watchType) {
    watchType = watchType || 'trailer';
    if (hasLocalAccess(movieId, watchType)) {
      return Promise.resolve(true);
    }
    return ensurePaymentServerReady().then(function (ready) {
      if (!ready) return false;
      return syncGrantsFromServer().then(function () {
        return KB.backend.checkPaymentAccess(getPaySessionId(), movieId, watchType);
      }).then(function (res) {
        if (res && res.access) {
          grantAccess(movieId, watchType);
          return true;
        }
        return false;
      }).catch(function () {
        return false;
      });
    });
  }

  function ensureAccessThenWatch(movie, onWatch, watchType) {
    if (!movie) return;
    watchType = watchType === 'trailer' ? 'trailer' : 'movie';
    checkAccess(movie.id, watchType).then(function (hasAccess) {
      if (hasAccess) {
        if (typeof onWatch === 'function') onWatch(movie);
        return;
      }
      // Cloudflare / static: нет API оплаты → сразу фильм, иначе пустой плеер
      ensurePaymentServerReady().then(function (ready) {
        if (!ready) {
          grantAccess(movie.id, watchType);
          if (typeof onWatch === 'function') onWatch(movie);
          return;
        }
        openPaymentModal(movie, onWatch, watchType);
      });
    });
  }

  function completeLocalPayment(movie, price, watchType, overlay, onPaid) {
    recordPurchase(movie.id);
    grantAccess(movie.id, watchType);
    U.showToast('Оплата принята — 10р', 'success');
    setModalConfirmed(overlay, movie, price, onPaid);
  }

  function getPaySessionId() {
    var key = 'kibo_pay_session';
    var id = sessionStorage.getItem(key);
    if (!id) {
      id = 'ps_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem(key, id);
    }
    return id;
  }

  function getUserInfo() {
    if (KB.auth && typeof KB.auth.getCurrentUser === 'function') {
      var user = KB.auth.getCurrentUser();
      if (user) {
        return {
          name: user.name || user.login || user.username || '',
          email: user.email || ''
        };
      }
    }
    return { name: '', email: '' };
  }

  function closeModal(overlay) {
    if (!overlay) return;
    overlay.classList.remove('modal-overlay--open');
    document.body.classList.remove('modal-open');
    setTimeout(function () { overlay.remove(); }, 250);
  }

  function setModalWaiting(overlay, text, options) {
    options = options || {};
    var body = overlay.querySelector('.payment-modal');
    if (!body) return;
    var movieTitle = options.movieTitle ? '«' + options.movieTitle + '»' : '';
    var tgLink = '';
    var hint = options.autoApprove
      ? 'Бот проверяет оплату и подтвердит автоматически…'
      : 'Администратор проверит чек и откроет доступ к этому фильму.';
    if (!options.autoApprove && !options.telegramSent && options.botUrl) {
      tgLink =
        '<a href="' + options.botUrl + '" target="_blank" rel="noopener noreferrer" class="payment-modal__tg-link">' +
        'Открыть бота в Telegram</a>' +
        '<p class="payment-modal__hint">Напишите боту <strong>/start</strong>, чтобы получать заявки</p>';
    }
    body.innerHTML =
      '<div class="payment-review">' +
      '<div class="payment-review__badge">На проверке</div>' +
      '<h2 class="payment-modal__title payment-modal__title--wait">Платёж на проверке</h2>' +
      (movieTitle ? '<p class="payment-modal__movie">' + movieTitle + '</p>' : '') +
      '<div class="payment-modal__wait">' +
      '<div class="payment-review__pulse" aria-hidden="true"><span></span></div>' +
      '<p class="payment-modal__wait-text">' + (text || 'Заявка отправлена. Ожидайте подтверждения…') + '</p>' +
      tgLink +
      '<p class="payment-modal__hint">' + hint + '</p>' +
      '</div>' +
      '<button type="button" class="btn btn--ghost payment-modal__cancel" id="pay-cancel-wait">Закрыть</button>' +
      '</div>';
    var cancel = document.getElementById('pay-cancel-wait');
    if (cancel) cancel.onclick = function () { closeModal(overlay); };
  }

  function openPendingReviewModal(movie, watchType, orderId, onPaid) {
    var overlay = U.createEl('div', '', 'modal-overlay modal-overlay--blocking modal-overlay--payment');
    overlay.innerHTML = '<div class="modal payment-modal"></div>';
    document.body.appendChild(overlay);
    document.body.classList.add('modal-open');
    requestAnimationFrame(function () { overlay.classList.add('modal-overlay--open'); });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal(overlay);
    });
    setModalWaiting(
      overlay,
      'Заявка по фильму «' + movie.title + '» уже отправлена. Доступ откроется после проверки чека.',
      {
        movieTitle: movie.title,
        telegramSent: true,
        autoApprove: false
      }
    );
    pollPaymentStatus(orderId, overlay, movie, watchType, onPaid);
  }

  function setModalIPaid(overlay, movie, price, watchType, payMethod, useTelegram, onPaid) {
    var body = overlay.querySelector('.payment-modal');
    if (!body) return;
    var premiumIcon = (KB.router && KB.router.PREMIUM_BADGE)
      ? KB.router.PREMIUM_BADGE.replace('header__premium-badge', 'header__premium-badge payment-receipt__premium')
      : '<span class="payment-receipt__premium" aria-hidden="true">★</span>';
    body.innerHTML =
      '<p class="payment-modal__movie">«' + movie.title + '»</p>' +
      '<div class="payment-modal__price-wrap">' + U.getPriceTagHtml(price, 'md') + '</div>' +
      '<p class="payment-modal__hint payment-modal__hint--center">Оплатите <strong>' + price + 'р</strong>, затем загрузите чек:</p>' +
      '<label class="payment-receipt" id="pay-receipt-box">' +
      '<input type="file" id="pay-receipt-input" accept="image/*,.pdf,application/pdf" hidden />' +
      '<span class="payment-receipt__icon payment-receipt__icon--premium" aria-hidden="true">' + premiumIcon + '</span>' +
      '<span class="payment-receipt__title">Загрузить чек ' + premiumIcon + '</span>' +
      '<span class="payment-receipt__sub">JPG, PNG или PDF · до 6 МБ</span>' +
      '<img class="payment-receipt__preview" id="pay-receipt-preview" alt="" hidden />' +
      '<span class="payment-receipt__name" id="pay-receipt-name" hidden></span>' +
      '</label>' +
      '<button type="button" class="payment-modal__pay-btn payment-modal__pay-btn--ipaid" id="pay-ipaid-btn" disabled>' +
      '<span class="payment-modal__green-check" aria-hidden="true"></span>Я ОПЛАТИЛ</button>' +
      '<p class="payment-modal__secure"><span class="payment-modal__shield" aria-hidden="true"></span>Безопасная оплата</p>';

    var receiptState = { base64: '', name: '', mime: '' };
    var input = overlay.querySelector('#pay-receipt-input');
    var preview = overlay.querySelector('#pay-receipt-preview');
    var nameEl = overlay.querySelector('#pay-receipt-name');
    var box = overlay.querySelector('#pay-receipt-box');
    var btn = overlay.querySelector('#pay-ipaid-btn');

    function setReceiptReady(ready) {
      if (btn) btn.disabled = !ready;
      if (box) box.classList.toggle('payment-receipt--ready', !!ready);
    }

    if (input) {
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        receiptState = { base64: '', name: '', mime: '' };
        setReceiptReady(false);
        if (preview) {
          preview.hidden = true;
          preview.removeAttribute('src');
        }
        if (nameEl) {
          nameEl.hidden = true;
          nameEl.textContent = '';
        }
        if (!file) return;
        if (file.size > 6 * 1024 * 1024) {
          U.showToast('Чек слишком большой (макс. 6 МБ)', 'error');
          input.value = '';
          return;
        }
        var reader = new FileReader();
        reader.onload = function () {
          var result = String(reader.result || '');
          receiptState = {
            base64: result,
            name: file.name || 'receipt.jpg',
            mime: file.type || ''
          };
          if (preview && /^image\//i.test(file.type || '')) {
            preview.src = result;
            preview.hidden = false;
          }
          if (nameEl) {
            nameEl.textContent = file.name;
            nameEl.hidden = false;
          }
          setReceiptReady(true);
        };
        reader.onerror = function () {
          U.showToast('Не удалось прочитать файл чека', 'error');
          input.value = '';
        };
        reader.readAsDataURL(file);
      });
    }

    if (btn) {
      btn.onclick = function () {
        if (!receiptState.base64) {
          U.showToast('Сначала загрузите чек оплаты', 'error');
          return;
        }
        ensurePaymentServerReady().then(function (ready) {
          if (ready) {
            startTelegramPayment(movie, price, watchType, payMethod, overlay, onPaid, receiptState);
          } else {
            U.showToast('Сервер оплаты недоступен. Запустите start.py', 'error');
          }
        });
      };
    }
  }

  function setModalConfirmed(overlay, movie, price, onPaid) {
    var body = overlay.querySelector('.payment-modal');
    if (!body) return;
    body.innerHTML =
      '<h2 class="payment-modal__title payment-modal__title--success">Оплата прошла успешно</h2>' +
      '<p class="payment-modal__movie">«' + movie.title + '»</p>' +
      '<div class="payment-modal__price-wrap">' + U.getPriceTagHtml(price, 'md') + '</div>' +
      '<div class="payment-modal__success-icon" aria-hidden="true"></div>' +
      '<p class="payment-modal__confirmed-text">Оплата одобрена. Сейчас откроется YouTube</p>' +
      '<button type="button" class="payment-modal__pay-btn payment-modal__pay-btn--confirmed" id="pay-confirmed-btn">' +
      '<span class="payment-modal__pay-icon payment-modal__pay-icon--check" aria-hidden="true"></span>' +
      'СМОТРЕТЬ НА YOUTUBE</button>' +
      '<p class="payment-modal__secure"><span class="payment-modal__shield" aria-hidden="true"></span>Безопасная оплата</p>';
    var btn = overlay.querySelector('#pay-confirmed-btn');
    if (btn) {
      btn.onclick = function () {
        closeModal(overlay);
        U.showToast('Открываем YouTube…', 'success');
        if (typeof onPaid === 'function') onPaid(movie);
      };
    }
  }

  function pollPaymentStatus(orderId, overlay, movie, watchType, onPaid) {
    var attempts = 0;
    var timer = null;

    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    function done() {
      stop();
      clearPendingOrder(movie.id, watchType, orderId);
    }

    function tick() {
      attempts += 1;
      if (attempts > POLL_MAX) {
        done();
        U.showToast('Время ожидания истекло. Попробуйте снова.', 'error');
        closeModal(overlay);
        return;
      }
      if (!KB.backend || !KB.backend.isEnabled()) return;
      KB.backend.getPaymentStatus(orderId).then(function (res) {
        if (!res) return;
        if (!res.ok) {
          done();
          U.showToast('Заявка не найдена. Попробуйте снова.', 'error');
          closeModal(overlay);
          return;
        }
        if (res.status === 'approved' || res.approved) {
          done();
          recordPurchase(movie.id);
          grantAccess(movie.id, watchType);
          if (watchType === 'movie') grantAccess(movie.id, 'trailer');
          U.showToast('Оплата подтверждена!', 'success');
          var started = false;
          function startOnce() {
            if (started) return;
            started = true;
            closeModal(overlay);
            if (typeof onPaid === 'function') onPaid(movie);
          }
          setModalConfirmed(overlay, movie, getNextPrice(), startOnce);
          setTimeout(startOnce, 700);
        } else if (res.status === 'rejected') {
          done();
          U.showToast('Заявка отклонена администратором.', 'error');
          closeModal(overlay);
        }
      }).catch(function () {});
    }

    timer = setInterval(tick, POLL_MS);
    tick();
  }

  function resolveBotUrl(res) {
    if (res && res.botUrl) return Promise.resolve(res.botUrl);
    if (res && res.botUsername) return Promise.resolve('https://t.me/' + res.botUsername);
    if (!KB.backend || !KB.backend.isEnabled()) return Promise.resolve('');
    var base = KB.backend.getApiBase ? KB.backend.getApiBase() : '';
    return fetch(base + 'api/health', { method: 'GET', cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (health) {
        var tg = health && health.telegram;
        if (!tg) return '';
        return tg.botUrl || (tg.botUsername ? 'https://t.me/' + tg.botUsername : '');
      })
      .catch(function () { return ''; });
  }

  function startTelegramPayment(movie, price, watchType, payMethod, overlay, onPaid, receipt) {
    var user = getUserInfo();
    var sessionId = getPaySessionId();
    receipt = receipt || {};
    KB.backend.createPaymentOrder({
      sessionId: sessionId,
      movieId: movie.id,
      movieTitle: movie.title,
      price: FIXED_PRICE,
      watchType: watchType || 'trailer',
      payMethod: payMethod,
      userName: user.name,
      userEmail: user.email,
      receiptBase64: receipt.base64 || '',
      receiptName: receipt.name || '',
      receiptMime: receipt.mime || ''
    }).then(function (res) {
      if (!res || !res.ok || !res.orderId) {
        var msg = (res && res.message) || 'Не удалось создать заявку на оплату';
        U.showToast(msg, 'error');
        closeModal(overlay);
        return;
      }
      setPendingOrder(movie.id, watchType, res.orderId);
      var autoApprove = !!res.autoApprove;
      var delaySec = Number(res.autoApproveDelaySec) || 3;
      var waitText = res.alreadyPending
        ? 'Заявка по фильму «' + movie.title + '» уже на проверке.'
        : (autoApprove
          ? 'Бот проверяет оплату… Подтверждение через ~' + delaySec + ' сек.'
          : (res.telegramSent
            ? 'Заявка и чек отправлены. Ожидайте подтверждения…'
            : 'Заявка создана. Напишите боту /start в Telegram, чтобы получать заявки.'));
      resolveBotUrl(res).then(function (botUrl) {
        setModalWaiting(overlay, waitText, {
          movieTitle: movie.title,
          telegramSent: !!res.telegramSent || !!res.alreadyPending,
          botUrl: botUrl,
          autoApprove: autoApprove
        });
        pollPaymentStatus(res.orderId, overlay, movie, watchType, onPaid);
      });
    }).catch(function () {
      U.showToast('Ошибка связи с сервером оплаты', 'error');
      closeModal(overlay);
    });
  }

  function bindPaymentModal(overlay, movie, price, watchType, useTelegram, onPaid) {
    var selectedMethod = '';
    var payBtn = overlay.querySelector('#pay-confirm');
    var cancelBtn = overlay.querySelector('#pay-cancel');
    var labelEl = overlay.querySelector('#pay-confirm-label');
    var methods = overlay.querySelectorAll('.payment-method');

    function setPayButtonLabel(text) {
      if (labelEl) labelEl.textContent = text;
    }

    function updatePayButton() {
      if (!payBtn) return;
      if (!selectedMethod) {
        payBtn.classList.add('payment-modal__pay-btn--idle');
        payBtn.classList.remove('payment-modal__pay-btn--ready');
        setPayButtonLabel('ВЫБЕРИТЕ СПОСОБ ОПЛАТЫ');
        return;
      }
      payBtn.classList.remove('payment-modal__pay-btn--idle');
      payBtn.classList.add('payment-modal__pay-btn--ready');
      setPayButtonLabel('ОПЛАТИТЬ ' + price + 'Р');
    }

    methods.forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectedMethod = btn.getAttribute('data-method') || '';
        methods.forEach(function (b) {
          var active = b === btn;
          b.classList.toggle('payment-method--active', active);
          b.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        updatePayButton();
      });
    });

    if (cancelBtn) cancelBtn.onclick = function () { closeModal(overlay); };
    if (payBtn) {
      payBtn.onclick = function () {
        if (!selectedMethod) {
          U.showToast('Выберите способ оплаты', 'error');
          return;
        }
        setModalIPaid(overlay, movie, price, watchType, selectedMethod, useTelegram, onPaid);
      };
    }
    updatePayButton();
  }

  function showPaymentModal(movie, onPaid, watchType) {
    openPaymentModal(movie, onPaid, watchType);
  }

  function renderPayMethodsModal(movie, onPaid, watchType) {
    var price = getNextPrice();
    var methodsHtml = PAY_METHODS.map(function (m) {
      return '<button type="button" class="payment-method" data-method="' + m.id + '" aria-pressed="false">' +
        '<span class="payment-method__icon ' + m.iconClass + '" aria-hidden="true"></span>' +
        '<span class="payment-method__label">' + m.label + '</span></button>';
    }).join('');
    var overlay = U.createEl('div', '', 'modal-overlay modal-overlay--blocking modal-overlay--payment');
    overlay.innerHTML =
      '<div class="modal payment-modal">' +
      '<button type="button" class="payment-modal__close" id="pay-cancel" aria-label="Закрыть">&times;</button>' +
      '<p class="payment-modal__movie">«' + movie.title + '»</p>' +
      '<div class="payment-modal__price-wrap">' + U.getPriceTagHtml(price, 'md') + '</div>' +
      '<ul class="payment-modal__benefits">' +
      '<li><span class="payment-modal__check" aria-hidden="true"></span>HD качество</li>' +
      '<li><span class="payment-modal__check" aria-hidden="true"></span>Без рекламы</li>' +
      '<li><span class="payment-modal__check" aria-hidden="true"></span>Доступ на 24 часа</li>' +
      '<li><span class="payment-modal__check" aria-hidden="true"></span>Подтверждение оплаты в Telegram</li>' +
      '</ul>' +
      '<p class="payment-modal__methods-title">Способ оплаты:</p>' +
      '<div class="payment-modal__methods">' + methodsHtml + '</div>' +
      '<button type="button" class="payment-modal__pay-btn payment-modal__pay-btn--idle" id="pay-confirm">' +
      '<span class="payment-modal__pay-icon" aria-hidden="true"></span>' +
      '<span id="pay-confirm-label">ВЫБЕРИТЕ СПОСОБ ОПЛАТЫ</span></button>' +
      '<p class="payment-modal__secure"><span class="payment-modal__shield" aria-hidden="true"></span>Безопасная оплата · одобрение админом в боте</p>' +
      '</div>';
    document.body.appendChild(overlay);
    document.body.classList.add('modal-open');
    requestAnimationFrame(function () { overlay.classList.add('modal-overlay--open'); });

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal(overlay);
    });
    bindPaymentModal(overlay, movie, price, watchType, true, onPaid);
  }

  function openPaymentModal(movie, onPaid, watchType) {
    watchType = watchType === 'trailer' ? 'trailer' : 'movie';
    findPendingForMovie(movie.id, watchType).then(function (info) {
      if (info && info.pending && info.orderId) {
        openPendingReviewModal(movie, watchType, info.orderId, onPaid);
        return;
      }
      renderPayMethodsModal(movie, onPaid, watchType);
    }).catch(function () {
      renderPayMethodsModal(movie, onPaid, watchType);
    });
  }

  function watchWithPayment(movie, onWatch, watchType) {
    if (!movie) return;
    ensureAccessThenWatch(movie, onWatch, watchType === 'trailer' ? 'trailer' : 'movie');
  }

  syncGrantsFromServer();

  KB.payments = {
    STEP_PRICE: STEP_PRICE,
    FIXED_PRICE: FIXED_PRICE,
    ACCESS_TTL_MS: ACCESS_TTL_MS,
    getPurchaseCount: getPurchaseCount,
    getNextPrice: getNextPrice,
    getMoviePrice: getNextPrice,
    recordPurchase: recordPurchase,
    grantAccess: grantAccess,
    hasLocalAccess: hasLocalAccess,
    isPaymentServerReady: isPaymentServerReady,
    ensurePaymentServerReady: ensurePaymentServerReady,
    checkAccess: checkAccess,
    ensureAccessThenWatch: ensureAccessThenWatch,
    watchWithPayment: watchWithPayment,
    getPaySessionId: getPaySessionId,
    syncGrantsFromServer: syncGrantsFromServer,
    PAY_METHOD_LABELS: PAY_METHOD_LABELS
  };
})(window);

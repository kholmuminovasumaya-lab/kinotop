(function (global) {
  'use strict';
  var KB = global.KinoBoom;
  var storage = KB.storage;
  var U = KB.utils;

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getUsers() {
    return storage.getItem(storage.STORAGE_KEYS.USERS, []);
  }

  function saveUsers(users) {
    storage.setItem(storage.STORAGE_KEYS.USERS, users);
  }

  function getCurrentUser() {
    return storage.getSession(storage.STORAGE_KEYS.USER_SESSION, null);
  }

  function setCurrentUser(user) {
    if (user) {
      storage.setSession(storage.STORAGE_KEYS.USER_SESSION, {
        id: user.id,
        name: user.name,
        email: user.email
      });
    } else {
      try { sessionStorage.removeItem(storage.STORAGE_KEYS.USER_SESSION); } catch (e) {}
    }
  }

  function isLoggedIn() {
    return !!getCurrentUser();
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function findUserByEmail(email) {
    var normalized = String(email || '').trim().toLowerCase();
    return getUsers().find(function (user) {
      return user.email === normalized;
    }) || null;
  }

  function register(name, email, password) {
    var cleanName = String(name || '').trim();
    var cleanEmail = String(email || '').trim().toLowerCase();
    var cleanPassword = String(password || '');

    if (cleanName.length < 2) return { ok: false, message: 'Имя должно быть не короче 2 символов' };
    if (!isValidEmail(cleanEmail)) return { ok: false, message: 'Введите корректный email' };
    if (cleanPassword.length < 4) return { ok: false, message: 'Пароль — минимум 4 символа' };
    if (findUserByEmail(cleanEmail)) return { ok: false, message: 'Пользователь с таким email уже есть' };

    var users = getUsers();
    var user = {
      id: Date.now(),
      name: cleanName,
      email: cleanEmail,
      password: cleanPassword,
      createdAt: Date.now()
    };
    users.push(user);
    saveUsers(users);
    setCurrentUser(user);
    return { ok: true, user: user };
  }

  function login(email, password) {
    var cleanEmail = String(email || '').trim().toLowerCase();
    var cleanPassword = String(password || '');
    var user = findUserByEmail(cleanEmail);

    if (!user || user.password !== cleanPassword) {
      return { ok: false, message: 'Неверный email или пароль' };
    }

    setCurrentUser(user);
    return { ok: true, user: user };
  }

  function logout() {
    setCurrentUser(null);
    U.showToast('Вы вышли из аккаунта', 'info');
    refreshHeaderAuth();
  }

  function lockBodyScroll() {
    document.body.classList.add('modal-open');
  }

  function unlockBodyScroll() {
    document.body.classList.remove('modal-open');
  }

  function closeModal(overlay) {
    if (!overlay) return;
    overlay.classList.remove('modal-overlay--open');
    unlockBodyScroll();
    setTimeout(function () { overlay.remove(); }, 250);
  }

  function renderAuthModalContent(overlay, mode) {
    var isRegister = mode === 'register';
    var modal = overlay.querySelector('.auth-modal');
    if (!modal) return;

    modal.innerHTML =
      '<h2 class="modal__title">' + (isRegister ? 'Регистрация' : 'Вход') + '</h2>' +
      '<div class="auth-tabs">' +
      '<button type="button" class="auth-tabs__btn' + (isRegister ? '' : ' auth-tabs__btn--active') + '" data-auth-mode="login">Вход</button>' +
      '<button type="button" class="auth-tabs__btn' + (isRegister ? ' auth-tabs__btn--active' : '') + '" data-auth-mode="register">Регистрация</button>' +
      '</div>' +
      '<form class="auth-form" id="auth-form" novalidate>' +
      (isRegister
        ? '<div class="form-group"><label for="auth-name">Имя</label><input id="auth-name" type="text" placeholder="Ваше имя" autocomplete="name" required /></div>'
        : '') +
      '<div class="form-group"><label for="auth-email">Email</label><input id="auth-email" type="email" placeholder="you@example.com" autocomplete="email" required /></div>' +
      '<div class="form-group"><label for="auth-password">Пароль</label><input id="auth-password" type="password" placeholder="••••••" autocomplete="' + (isRegister ? 'new-password' : 'current-password') + '" required /></div>' +
      '<p class="auth-form__error" id="auth-error" hidden></p>' +
      '<div class="modal__actions auth-form__actions">' +
      '<button type="button" class="btn btn--ghost" id="auth-cancel">Отмена</button>' +
      '<button type="submit" class="btn btn--primary" id="auth-submit">' + (isRegister ? 'Зарегистрироваться' : 'Войти') + '</button>' +
      '</div></form>';

    overlay.setAttribute('data-auth-mode', mode);
    bindAuthModalEvents(overlay, mode);
  }

  function bindAuthModalEvents(overlay, mode) {
    var isRegister = mode === 'register';
    var form = overlay.querySelector('#auth-form');
    var errorEl = overlay.querySelector('#auth-error');

    function showError(message) {
      if (!errorEl) return;
      errorEl.textContent = message;
      errorEl.hidden = !message;
    }

    overlay.querySelector('#auth-cancel').onclick = function () { closeModal(overlay); };
    overlay.querySelectorAll('[data-auth-mode]').forEach(function (btn) {
      btn.onclick = function () {
        var nextMode = btn.getAttribute('data-auth-mode');
        if (nextMode !== overlay.getAttribute('data-auth-mode')) {
          renderAuthModalContent(overlay, nextMode);
        }
      };
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      showError('');
      var email = overlay.querySelector('#auth-email').value;
      var password = overlay.querySelector('#auth-password').value;
      var result;

      if (isRegister) {
        result = register(overlay.querySelector('#auth-name').value, email, password);
      } else {
        result = login(email, password);
      }

      if (!result.ok) {
        showError(result.message);
        return;
      }

      closeModal(overlay);
      U.showToast(isRegister ? 'Регистрация успешна' : 'Добро пожаловать, ' + result.user.name + '!', 'success');
      refreshHeaderAuth();
    });

    var focusId = isRegister ? 'auth-name' : 'auth-email';
    var focusEl = overlay.querySelector('#' + focusId);
    if (focusEl) focusEl.focus();
  }

  function showAuthModal(mode) {
    if (mode === undefined) mode = 'login';
    var overlay = U.createEl('div', '', 'modal-overlay modal-overlay--blocking');
    overlay.innerHTML = '<div class="modal auth-modal"></div>';
    document.body.appendChild(overlay);
    lockBodyScroll();
    renderAuthModalContent(overlay, mode);
    requestAnimationFrame(function () { overlay.classList.add('modal-overlay--open'); });

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal(overlay);
    });
  }

  function getHeaderAuthHtml() {
    var user = getCurrentUser();
    if (user) {
      return '<div class="header__auth">' +
        '<span class="header__user" title="' + escapeHtml(user.email) + '">' + escapeHtml(user.name) + '</span>' +
        '<button type="button" class="btn btn--ghost btn--sm" id="auth-logout-btn">Выйти</button></div>';
    }
    return '<div class="header__auth">' +
      '<button type="button" class="btn btn--primary btn--sm" id="auth-open-btn">Аккаунт</button></div>';
  }

  function bindHeaderAuth() {
    var openBtn = document.getElementById('auth-open-btn');
    var logoutBtn = document.getElementById('auth-logout-btn');

    if (openBtn) openBtn.addEventListener('click', function () { showAuthModal('login'); });
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
  }

  function refreshHeaderAuth() {
    var container = document.getElementById('header-auth');
    if (!container) return;
    container.innerHTML = getHeaderAuthHtml();
    bindHeaderAuth();
  }

  KB.auth = {
    getCurrentUser: getCurrentUser,
    isLoggedIn: isLoggedIn,
    register: register,
    login: login,
    logout: logout,
    showAuthModal: showAuthModal,
    getHeaderAuthHtml: getHeaderAuthHtml,
    bindHeaderAuth: bindHeaderAuth,
    refreshHeaderAuth: refreshHeaderAuth
  };
})(window);

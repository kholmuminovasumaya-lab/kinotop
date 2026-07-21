(function (global) {
  'use strict';
  var KB = global.KinoBoom;
  var U = KB.utils;
  var storage = KB.storage;

  KB.settingsPageInit = function () {
    KB.router.initPage('settings');
    U.initScrollTop();
    var titleEl = document.getElementById('settings-page-title') || document.querySelector('.page__title');
    if (titleEl) titleEl.textContent = 'Настройки';
    document.title = 'Настройки';
    var s = storage.getSettings();
    document.getElementById('settings-container').innerHTML =
      '<div class="settings-card"><h3 class="settings-card__title">Тема</h3><div class="settings-row"><span>' + (s.theme === 'dark' ? 'Тёмная' : 'Светлая') + '</span>' +
      '<button class="toggle' + (s.theme === 'light' ? ' toggle--active' : '') + '" id="theme-toggle"><span class="toggle__thumb"></span></button></div></div>' +
      '<div class="settings-card"><h3 class="settings-card__title">Админ-панель</h3><p class="settings-card__desc">Управление каталогом KINOTOP</p>' +
      '<div class="settings-row"><span>Редактирование фильмов</span><a href="' + U.getAdminPath() + '" class="btn btn--primary btn--sm">Открыть админку</a></div></div>' +
      '<div class="settings-card"><h3 class="settings-card__title">Данные</h3>' +
      '<div class="settings-row"><span>Избранное</span><button class="btn btn--secondary btn--sm" id="clear-fav">Очистить</button></div>' +
      '<div class="settings-row"><span>История</span><button class="btn btn--secondary btn--sm" id="clear-hist">Очистить</button></div></div>';
    document.getElementById('theme-toggle').onclick = function () { KB.theme.toggleTheme(); U.showToast('Тема изменена', 'info'); };
    document.getElementById('clear-fav').onclick = function () { if (confirm('Очистить?')) KB.favorites.clearFavorites(); };
    document.getElementById('clear-hist').onclick = function () { if (confirm('Очистить?')) KB.history.clearHistory(); };
    U.hidePreloader();
  };
})(window);

(function (global) {
  'use strict';
  var KB = global.KinoBoom;
  var storage = KB.storage;

  function initTheme() {
    applyTheme(storage.getSettings().theme);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  function toggleTheme() {
    var next = storage.getSettings().theme === 'dark' ? 'light' : 'dark';
    storage.saveSettings({ theme: next });
    applyTheme(next);
    return next;
  }

  KB.theme = { initTheme: initTheme, applyTheme: applyTheme, toggleTheme: toggleTheme, getCurrentTheme: function () { return storage.getSettings().theme; } };
})(window);

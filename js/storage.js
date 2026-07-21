(function (global) {
  'use strict';
  var KB = global.KinoBoom = global.KinoBoom || {};

  var STORAGE_KEYS = {
    FAVORITES: 'kibo_favorites',
    HISTORY: 'kibo_history',
    SETTINGS: 'kibo_settings',
    MOVIES_OVERRIDE: 'kibo_movies_override',
    DELETED_MOVIES: 'kibo_deleted_movies',
    PURCHASED: 'kibo_purchased_movies',
    PURCHASE_COUNTS: 'kibo_purchase_counts',
    WATCH_PROGRESS: 'kibo_watch_progress',
    ADMIN_AUTH: 'kibo_admin_auth',
    USERS: 'kibo_users',
    USER_SESSION: 'kibo_user_session',
    CACHE: 'kibo_cache_movies'
  };

  var DEFAULT_SETTINGS = { theme: 'dark', defaultQuality: 'auto', playbackSpeed: 1, autoplay: false };

  function getItem(key, defaultValue) {
    if (defaultValue === undefined) defaultValue = null;
    var value;

    if (KB.backend && KB.backend.isEnabled()) {
      var fromServer = KB.backend.getKv(key, undefined);
      if (fromServer !== undefined) value = fromServer;
    }

    if (value === undefined && KB.db && KB.db.getCache) {
      var fromDb = KB.db.getCache(key, undefined);
      if (fromDb !== undefined) value = fromDb;
    }

    if (value === undefined) {
      try {
        var raw = localStorage.getItem(key);
        value = raw ? JSON.parse(raw) : defaultValue;
      } catch (e) {
        value = defaultValue;
      }
    }

    if (value === null || value === undefined) return defaultValue;
    return value;
  }

  function setItem(key, value) {
    if (KB.backend && KB.backend.isEnabled()) {
      KB.backend.setKv(key, value);
    }
    if (KB.db && KB.db.setCache) {
      KB.db.setCache(key, value);
      return;
    }
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.error(e); }
  }

  function getSession(key, defaultValue) {
    if (defaultValue === undefined) defaultValue = null;
    try {
      var raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : defaultValue;
    } catch (e) { return defaultValue; }
  }

  function setSession(key, value) {
    try { sessionStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.error(e); }
  }

  KB.storage = {
    STORAGE_KEYS: STORAGE_KEYS,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    getItem: getItem,
    setItem: setItem,
    removeItem: function (key) {
      if (KB.backend && KB.backend.isEnabled()) KB.backend.removeKv(key);
      if (KB.db && KB.db.removeCache) KB.db.removeCache(key);
      else localStorage.removeItem(key);
    },
    getSession: getSession,
    setSession: setSession,
    getFavorites: function () {
      var favs = getItem(STORAGE_KEYS.FAVORITES, []);
      return Array.isArray(favs) ? favs : [];
    },
    setFavorites: function (ids) { setItem(STORAGE_KEYS.FAVORITES, Array.isArray(ids) ? ids : []); },
    getHistory: function () {
      var history = getItem(STORAGE_KEYS.HISTORY, []);
      return Array.isArray(history) ? history : [];
    },
    setHistory: function (h) { setItem(STORAGE_KEYS.HISTORY, h); },
    getSettings: function () { return Object.assign({}, DEFAULT_SETTINGS, getItem(STORAGE_KEYS.SETTINGS, {})); },
    saveSettings: function (s) { setItem(STORAGE_KEYS.SETTINGS, Object.assign(KB.storage.getSettings(), s)); },
    getMoviesOverride: function () {
      var list = getItem(STORAGE_KEYS.MOVIES_OVERRIDE, []);
      return Array.isArray(list) ? list : [];
    },
    setMoviesOverride: function (m) { setItem(STORAGE_KEYS.MOVIES_OVERRIDE, Array.isArray(m) ? m : []); },
    getDeletedMovies: function () {
      var list = getItem(STORAGE_KEYS.DELETED_MOVIES, []);
      return Array.isArray(list) ? list : [];
    },
    setDeletedMovies: function (ids) { setItem(STORAGE_KEYS.DELETED_MOVIES, ids); },
    isAdminAuthenticated: function () { return getSession(STORAGE_KEYS.ADMIN_AUTH, false) === true; },
    setAdminAuth: function (v) { setSession(STORAGE_KEYS.ADMIN_AUTH, v); }
  };
})(window);

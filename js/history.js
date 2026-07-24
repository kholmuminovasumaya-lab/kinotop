(function (global) {
  'use strict';
  var KB = global.KinoBoom;
  var storage = KB.storage;
  var showToast = KB.utils.showToast;

  function progressKey(movieId, type) {
    return String(movieId) + ':' + (type || 'trailer');
  }

  function getAllProgress() {
    return storage.getItem(storage.STORAGE_KEYS.WATCH_PROGRESS, {});
  }

  function getProgressEntry(movieId, type) {
    return getAllProgress()[progressKey(movieId, type)] || null;
  }

  function getProgressSeconds(movieId, type) {
    var entry = getProgressEntry(movieId, type);
    return entry ? Number(entry.progress) || 0 : 0;
  }

  function saveProgress(movie, type, progress, duration) {
    if (!movie) return;
    var all = getAllProgress();
    var key = progressKey(movie.id, type);
    all[key] = {
      progress: Math.max(0, Number(progress) || 0),
      duration: Number(duration) || 0,
      type: type || 'trailer',
      title: movie.title,
      poster: movie.poster,
      updatedAt: Date.now()
    };
    storage.setItem(storage.STORAGE_KEYS.WATCH_PROGRESS, all);
    addToHistory(movie, progress, type, duration);
  }

  function addToHistory(movie, progress, type, duration) {
    if (progress === undefined) progress = 0;
    if (type === undefined) type = 'movie';
    var history = storage.getHistory().filter(function (h) {
      return !(h.id === movie.id && h.type === type);
    });
    history.unshift({
      id: movie.id,
      title: movie.title,
      poster: movie.poster,
      watchedAt: Date.now(),
      progress: progress,
      duration: duration || 0,
      type: type
    });
    if (history.length > 50) history = history.slice(0, 50);
    storage.setHistory(history);
  }

  function formatWatchedDate(timestamp) {
    var days = Math.floor((Date.now() - timestamp) / 86400000);
    if (days === 0) return 'Сегодня';
    if (days === 1) return 'Вчера';
    if (days < 7) return days + ' дн. назад';
    return new Date(timestamp).toLocaleDateString('ru-RU');
  }

  function formatProgressLabel(entry) {
    if (!entry || !entry.duration) return 'Продолжить';
    var pct = Math.min(100, Math.round((entry.progress / entry.duration) * 100));
    return 'Продолжить · ' + pct + '%';
  }

  function getContinueList(allMovies) {
    var all = getAllProgress();
    var list = [];
    Object.keys(all).forEach(function (key) {
      var data = all[key];
      var parts = key.split(':');
      var id = Number(parts[0]);
      var type = parts[1] || 'trailer';
      var movie = allMovies.find(function (m) { return m.id === id; });
      if (!movie || !data.progress || data.progress < 8) return;
      if (data.duration && data.progress >= data.duration * 0.97) return;
      list.push(Object.assign({}, movie, {
        continueType: type,
        continueProgress: data.progress,
        continueDuration: data.duration,
        continueUpdatedAt: data.updatedAt
      }));
    });
    return list.sort(function (a, b) { return b.continueUpdatedAt - a.continueUpdatedAt; });
  }

  KB.history = {
    addToHistory: addToHistory,
    saveProgress: saveProgress,
    getProgressEntry: getProgressEntry,
    getProgressSeconds: getProgressSeconds,
    getContinueList: getContinueList,
    formatProgressLabel: formatProgressLabel,
    getHistoryMovies: function (all) {
      return storage.getHistory().map(function (h) {
        var movie = all.find(function (m) { return m.id === h.id; });
        return movie ? Object.assign({}, movie, {
          watchedAt: h.watchedAt,
          progress: h.progress,
          duration: h.duration,
          watchType: h.type || 'trailer'
        }) : null;
      }).filter(Boolean);
    },
    clearHistory: function () {
      storage.setHistory([]);
      storage.setItem(storage.STORAGE_KEYS.WATCH_PROGRESS, {});
      showToast('История очищена', 'info');
    },
    formatWatchedDate: formatWatchedDate
  };
})(window);

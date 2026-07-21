(function (global) {
  'use strict';
  var KB = global.KinoBoom;
  var U = KB.utils;
  var api = KB.api;

  KB.historyPageInit = function () {
    KB.router.initPage('history');
    U.initScrollTop();
    var titleEl = document.getElementById('history-page-title') || document.querySelector('.page__title');
    if (titleEl) titleEl.textContent = 'История';
    document.title = 'История';
    Promise.all([api.loadMovies(), api.loadGenres()]).then(function (res) {
      var history = KB.history.getHistoryMovies(res[0]);
      var grid = document.getElementById('history-grid');
      if (!history.length) {
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="empty-state__icon">🕐</div><h3>История пуста</h3></div>';
      } else {
        var frag = document.createDocumentFragment();
        history.forEach(function (m) {
          var w = U.createEl('div');
          m.continueType = m.watchType || 'trailer';
          m.continueProgress = m.progress;
          m.continueDuration = m.duration;
          var c = KB.cards.createMovieCard(m, res[1]);
          c.style.width = '100%';
          w.appendChild(c);
          var meta = (m.watchType === 'movie' ? 'Фильм' : 'Трейлер') + ' · ' + KB.history.formatWatchedDate(m.watchedAt);
          if (m.duration) meta += ' · ' + Math.min(100, Math.round((m.progress / m.duration) * 100)) + '%';
          w.appendChild(U.createEl('p', meta, 'card__meta'));
          frag.appendChild(w);
        });
        grid.replaceChildren(frag);
      }
      U.hidePreloader();
    });
  };
})(window);

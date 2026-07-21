(function (global) {
  'use strict';
  var KB = global.KinoBoom;
  var U = KB.utils;
  var api = KB.api;

  KB.favoritesPageInit = function () {
    KB.router.initPage('favorites');
    U.initScrollTop();
    var titleEl = document.getElementById('favorites-page-title') || document.querySelector('.page__title');
    if (titleEl) titleEl.textContent = 'Избранные';
    document.title = 'Избранные';
    Promise.all([api.loadMovies(), api.loadGenres()]).then(function (res) {
      var favs = KB.favorites.getFavoriteMovies(res[0]);
      var grid = document.getElementById('favorites-grid');
      if (!favs.length) {
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><h3>Избранные пусты</h3></div>';
      } else {
        var frag = document.createDocumentFragment();
        favs.forEach(function (m) {
          var w = U.createEl('div');
          var c = KB.cards.createMovieCard(m, res[1]);
          c.style.width = '100%';
          w.appendChild(c);
          frag.appendChild(w);
        });
        grid.replaceChildren(frag);
      }
      U.hidePreloader();
    });
  };
})(window);

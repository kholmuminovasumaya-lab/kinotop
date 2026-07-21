(function (global) {
  'use strict';
  var KB = global.KinoBoom;
  var U = KB.utils;
  var api = KB.api;

  KB.search = {
    initSearchPage: function (movies, genres) {
      var queryInput = document.getElementById('search-query');
      var genreSelect = document.getElementById('search-genre');
      var yearInput = document.getElementById('search-year');
      var ratingSelect = document.getElementById('search-rating');
      var resultsContainer = document.getElementById('search-results');
      var countEl = document.getElementById('search-count');
      if (!resultsContainer) return;

      var urlQuery = new URLSearchParams(window.location.search).get('q');
      if (urlQuery && queryInput) queryInput.value = urlQuery;

      function runSearch() {
        var results = api.searchMovies(movies, {
          query: queryInput ? queryInput.value : '',
          genre: genreSelect ? genreSelect.value : '',
          year: yearInput ? yearInput.value : '',
          minRating: ratingSelect ? ratingSelect.value : 0
        });
        if (countEl) countEl.textContent = 'Найдено: ' + results.length;
        if (!results.length) {
          resultsContainer.replaceChildren();
          var empty = U.createEl('div', '', 'empty-state');
          empty.style.gridColumn = '1 / -1';
          empty.appendChild(U.createEl('div', '🔍', 'empty-state__icon'));
          empty.appendChild(U.createEl('h3', 'Ничего не найдено', 'empty-state__title'));
          resultsContainer.appendChild(empty);
          return;
        }
        var frag = document.createDocumentFragment();
        results.forEach(function (movie) {
          var w = U.createEl('div', '');
          var card = KB.cards.createMovieCard(movie, genres);
          card.style.width = '100%';
          w.appendChild(card);
          frag.appendChild(w);
        });
        resultsContainer.replaceChildren(frag);
      }

      var debounced = U.debounce(runSearch, 300);
      if (queryInput) queryInput.addEventListener('input', debounced);
      if (genreSelect) genreSelect.addEventListener('change', runSearch);
      if (yearInput) yearInput.addEventListener('input', debounced);
      if (ratingSelect) ratingSelect.addEventListener('change', runSearch);
      runSearch();
    },
    initHeaderSearch: function () {
      document.querySelectorAll('.header__search input').forEach(function (searchInput) {
        searchInput.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            var q = searchInput.value.trim();
            window.location.href = U.getBasePath() + 'pages/search.html' + (q ? '?q=' + encodeURIComponent(q) : '');
          }
        });
      });
    },
    populateGenreSelect: function (select, genres) {
      if (!select) return;
      genres.forEach(function (g) {
        var opt = U.createEl('option', g.name);
        opt.value = g.id;
        select.appendChild(opt);
      });
    }
  };
})(window);

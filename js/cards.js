(function (global) {
  'use strict';
  var KB = global.KinoBoom;
  var U = KB.utils;
  var api = KB.api;

  function navigateToMovie(id) {
    window.location.href = U.getBasePath() + 'pages/movie.html?id=' + id;
  }

  function navigateToPlayer(movieOrId, type) {
    type = (type === 'trailer') ? 'trailer' : 'movie';
    if (movieOrId && typeof movieOrId === 'object') {
      U.openMovieWatch(movieOrId, type);
      return;
    }
    api.getMovieById(movieOrId).then(function (movie) {
      if (movie) U.openMovieWatch(movie, type);
    });
  }

  function createMovieCard(movie, genres) {
    if (!genres) genres = [];
    var base = U.getBasePath();
    var card = U.createEl('article', '', 'card');
    card.dataset.movieId = movie.id;

    var posterWrap = U.createEl('div', '', 'card__poster-wrap');
    var img = document.createElement('img');
    img.className = 'card__poster';
    var posterSrc = U.resolveAssetUrl(movie.poster) || U.posterFallbackUrl(movie.title);
    if (posterSrc && posterSrc.indexOf('data:') !== 0) {
      posterSrc += (posterSrc.indexOf('?') >= 0 ? '&' : '?') + 'v=smokeFix1';
    }
    img.src = posterSrc;
    img.alt = '';
    img.loading = 'lazy';
    U.bindPosterFallback(img, movie.title);
    posterWrap.appendChild(img);

    var badges = U.createEl('div', '', 'card__badges');
    badges.appendChild(U.createEl('span', String(movie.rating), 'card__badge card__badge--rating'));
    badges.appendChild(U.createEl('span', movie.quality || 'HD', 'card__badge card__badge--quality'));
    if (movie.continueProgress) {
      var pct = movie.continueDuration
        ? Math.min(100, Math.round((movie.continueProgress / movie.continueDuration) * 100))
        : 0;
      var bar = U.createEl('div', '', 'card__progress');
      bar.innerHTML = '<div class="card__progress-fill" style="width:' + pct + '%"></div>';
      posterWrap.appendChild(bar);
      badges.insertBefore(U.createEl('span', 'Продолжить', 'card__badge card__badge--continue'), badges.firstChild);
    }
    posterWrap.appendChild(badges);

    var overlay = U.createEl('div', '', 'card__overlay');
    var actions = U.createEl('div', '', 'card__overlay-actions');
    var playBtn = U.createEl('button', 'Смотреть фильм', 'card__overlay-btn card__overlay-btn--watch');
    playBtn.setAttribute('aria-label', 'Смотреть фильм');
    playBtn.type = 'button';
    actions.appendChild(playBtn);
    overlay.appendChild(actions);
    posterWrap.appendChild(overlay);
    card.appendChild(posterWrap);

    var info = U.createEl('div', '', 'card__info');
    info.appendChild(U.createEl('h3', movie.title, 'card__title'));
    var genresList = api.movieGenres ? api.movieGenres(movie) : (movie.genres || []);
    var genreName = genresList[0] ? api.getGenreName(genresList[0], genres) : '';
    info.appendChild(U.createEl('p', movie.year + ' · ' + genreName + ' · ' + U.formatDuration(movie.duration), 'card__meta'));
    info.appendChild(U.createPriceLabel(10));
    card.appendChild(info);

    playBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      // Всегда полный фильм — не трейлер из истории
      navigateToPlayer(movie, 'movie');
    });
    card.addEventListener('click', function (e) {
      if (e.target.closest('[data-action]')) return;
      navigateToMovie(movie.id);
    });
    return card;
  }

  KB.cards = {
    createMovieCard: createMovieCard,
    renderCards: function (container, movies, genres) {
      var frag = document.createDocumentFragment();
      movies.forEach(function (m) { frag.appendChild(createMovieCard(m, genres)); });
      container.replaceChildren(frag);
    }
  };
})(window);


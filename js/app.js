(function (global) {
  'use strict';
  var KB = global.KinoBoom;
  var U = KB.utils;
  var api = KB.api;

  function renderHero(movie, genres) {
    var hero = document.getElementById('hero');
    if (!hero || !movie) return;
    var movieGenres = api.movieGenres ? api.movieGenres(movie) : (movie.genres || []);
    var base = U.getBasePath();
    var genreTags = movieGenres.slice(0, 3).map(function (g) {
      return '<span class="hero__genre-tag">' + api.getGenreName(g, genres) + '</span>';
    }).join('');
    var movieSec = KB.history.getProgressSeconds(movie.id, 'movie');
    var movieLabel = movieSec > 8 ? 'Продолжить фильм' : 'Смотреть фильм';
    hero.innerHTML =
      '<div class="hero__shell">' +
      '<div class="hero__content">' +
      '<div class="hero__badge">Топ недели</div>' +
      '<h1 class="hero__title">' + movie.title + '</h1>' +
      '<div class="hero__meta"><span class="hero__rating">' + movie.rating + '</span><span>' + movie.year + '</span><span>' + movie.age + '</span></div>' +
      '<div class="hero__price">' + U.getPriceLabelHtml(10) + '</div>' +
      '<div class="hero__genres">' + genreTags + '</div>' +
      '<p class="hero__description">' + movie.description + '</p>' +
      '<div class="hero__actions">' +
      '<button type="button" class="btn btn--primary" id="hero-movie-btn">' + movieLabel + '</button>' +
      '<button type="button" class="btn btn--secondary" id="hero-fav-btn">' + (KB.favorites.isFavorite(movie.id) ? 'В избранном' : 'В избранное') + '</button>' +
      '</div></div>' +
      '<figure class="hero__visual">' +
      '<img src="' + U.resolveAssetUrl(movie.poster || movie.background) + '" alt="' + movie.title + '" width="150" height="225" loading="eager" />' +
      '</figure></div>';
    var favBtn = document.getElementById('hero-fav-btn');
    var movieBtn = document.getElementById('hero-movie-btn');
    if (movieBtn) {
      movieBtn.addEventListener('click', function () { U.openMovieWatch(movie, 'movie'); });
    }
    if (favBtn) favBtn.addEventListener('click', function () {
      var active = KB.favorites.toggleFavorite(movie.id, movie.title);
      favBtn.textContent = active ? 'В избранном' : 'В избранное';
    });
  }

  KB.appInit = function () {
    KB.router.initPage('home');
    U.initScrollTop();
    Promise.all([api.loadMovies(), api.loadGenres()]).then(function (res) {
      var movies = res[0] || [];
      var genres = res[1] || [];
      if (!movies.length) {
        throw new Error('empty catalog');
      }
      renderHero(movies.find(function (m) { return m.trending; }) || movies[0], genres);
      var catalog = document.getElementById('catalog');
      if (catalog) KB.slider.renderAllSections(catalog, movies, api.getMoviesBySection, genres);
      U.hidePreloader();
    }).catch(function (err) {
      console.error(err);
      U.hidePreloader();
      var embedded = (global.KinoBoom_EMBEDDED || {});
      var fallbackMovies = (embedded.movies || []).map(function (m) {
        return api.normalizeMovie ? api.normalizeMovie(m) : m;
      }).filter(function (m) {
        return m && (!api.isHiddenMovie || !api.isHiddenMovie(m));
      });
      if (fallbackMovies.length) {
        var fallbackGenres = embedded.genres || [];
        renderHero(fallbackMovies.find(function (m) { return m.trending; }) || fallbackMovies[0], fallbackGenres);
        var catalog = document.getElementById('catalog');
        if (catalog) KB.slider.renderAllSections(catalog, fallbackMovies, api.getMoviesBySection, fallbackGenres);
        return;
      }
      U.showToast('Ошибка загрузки каталога', 'error');
    });
  };
})(window);

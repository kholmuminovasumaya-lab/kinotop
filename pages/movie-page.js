(function (global) {
  'use strict';
  var KB = global.KinoBoom;
  var U = KB.utils;
  var api = KB.api;

  KB.moviePageInit = function () {
    KB.router.initPage('home');
    U.initScrollTop();
    var id = U.getQueryParam('id');
    Promise.all([api.getMovieById(id), api.loadGenres(), api.loadMovies()]).then(function (res) {
      var movie = res[0];
      var genres = res[1];
      var allMovies = res[2];
      if (!movie) {
        document.querySelector('main').innerHTML = '<div class="empty-state"><h3>Фильм не найден</h3></div>';
        U.hidePreloader();
        return;
      }
      var base = U.getBasePath();
      var genreStr = movie.genres.map(function (g) { return api.getGenreName(g, genres); }).join(', ');
      var movieSec = KB.history.getProgressSeconds(movie.id, 'movie');
      var movieLabel = movieSec > 8 ? 'Продолжить фильм' : 'Смотреть фильм';
      document.getElementById('movie-detail').innerHTML =
        '<div class="movie-detail__hero"><div class="movie-detail__hero-bg"><img src="' + U.resolveAssetUrl(movie.background) + '" alt="" /></div>' +
        '<div class="movie-detail__hero-overlay"></div><div class="movie-detail__content">' +
        '<div class="movie-detail__poster-wrap">' +
        '<img class="movie-detail__poster" id="movie-poster-img" src="' + (U.resolveAssetUrl(movie.poster) || U.posterFallbackUrl(movie.title)) + '" alt="" />' +
        '<div class="movie-detail__price">' + U.getPriceLabelHtml(10) + '</div>' +
        '</div>' +
        '<div class="movie-detail__info"><h1>' + movie.title + '</h1>' +
        '<div class="hero__meta"><span class="hero__rating">' + movie.rating + '</span><span>' + movie.year + '</span></div>' +
        '<p style="color:var(--color-text-secondary)">' + genreStr + '</p>' +
        '<p class="movie-detail__description">' + movie.description + '</p>' +
        '<p><strong>Режиссёр:</strong> ' + movie.director + '</p>' +
        '<div class="hero__actions">' +
        '<button type="button" class="btn btn--primary btn--lg" id="watch-movie-btn">' + movieLabel + '</button>' +
        '<button class="btn btn--secondary" id="fav-btn">' + (KB.favorites.isFavorite(movie.id) ? 'В избранном' : 'В избранное') + '</button></div></div></div></div>';
      var cast = document.getElementById('movie-cast');
      cast.innerHTML = '<h3>В ролях</h3><div class="movie-detail__cast-list"></div>';
      movie.cast.forEach(function (c) {
        var span = document.createElement('span');
        span.className = 'movie-detail__cast-item';
        span.textContent = c;
        cast.querySelector('.movie-detail__cast-list').appendChild(span);
      });
      var similar = api.getSimilarMovies(allMovies, movie);
      if (similar.length) document.getElementById('similar').appendChild(KB.slider.createSliderSection('similar', 'Похожие фильмы', similar, genres));
      document.getElementById('fav-btn').onclick = function () {
        var a = KB.favorites.toggleFavorite(movie.id, movie.title);
        document.getElementById('fav-btn').textContent = a ? 'В избранном' : 'В избранное';
      };
      document.getElementById('watch-movie-btn').onclick = function () { U.openMovieWatch(movie, 'movie'); };
      U.bindPosterFallback(document.getElementById('movie-poster-img'), movie.title);
      U.hidePreloader();
    });
  };
})(window);

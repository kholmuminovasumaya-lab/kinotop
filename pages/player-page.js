(function (global) {
  'use strict';
  var KB = global.KinoBoom;
  var U = KB.utils;
  var api = KB.api;

  function playFilmOnPage(movie) {
    if (!movie) return;
    var videoUrl = U.getMovieVideoUrl ? U.getMovieVideoUrl(movie) : String(movie.video || '').trim();
    if (!videoUrl) {
      U.showToast('Фильм недоступен', 'error');
      window.location.href = U.getBasePath() + 'index.html';
      return;
    }
    if (U.isExternalVideoUrl && U.isExternalVideoUrl(videoUrl) && U.openExternalVideo) {
      U.openExternalVideo(videoUrl, movie, 'movie');
      return;
    }
    if (KB.player && KB.player.initPlayer) {
      KB.player.initPlayer(movie);
      U.hidePreloader();
      return;
    }
    var video = document.getElementById('video-player');
    var titleEl = document.querySelector('.player-title');
    if (titleEl) titleEl.textContent = movie.title || 'Фильм';
    if (video) {
      video.src = videoUrl;
      video.play().catch(function () {});
    }
    U.hidePreloader();
  }

  KB.playerPageInit = function () {
    var id = U.getQueryParam('id');
    KB.router.initPage('player');

    api.getMovieById(id).then(function (movie) {
      if (!movie) {
        document.body.innerHTML = '<p style="color:#fff;padding:40px;">Фильм не найден</p>';
        return;
      }

      function afterAccess(paidMovie) {
        playFilmOnPage(paidMovie || movie);
      }

      if (KB.payments && KB.payments.watchWithPayment) {
        KB.payments.watchWithPayment(movie, afterAccess, 'movie');
      } else {
        afterAccess(movie);
      }
    }).catch(function () {
      document.body.innerHTML = '<p style="color:#fff;padding:40px;">Ошибка загрузки</p>';
    });
  };
})(window);

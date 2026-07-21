(function (global) {
  'use strict';
  var KB = global.KinoBoom;
  var U = KB.utils;
  var api = KB.api;

  function getWatchType() {
    var t = U.getQueryParam('type');
    return t === 'movie' ? 'movie' : 'trailer';
  }

  function playFullMovie(movie) {
    var videoUrl = String(movie.video || '').trim();
    if (!videoUrl) {
      U.showToast('Полный фильм пока недоступен', 'error');
      return false;
    }

    // YouTube как полный фильм — редко, но поддерживаем
    if (/youtube\.com|youtu\.be/i.test(videoUrl)) {
      U.openYoutubeWatch(movie, 'movie');
      return true;
    }

    if (!KB.player || !KB.player.initPlayer) {
      U.showToast('Плеер не загружен. Обновите страницу (Ctrl+Shift+R).', 'error');
      return false;
    }

    var player = KB.player.initPlayer(movie);
    var videoEl = document.getElementById('video-player');
    if (videoEl) {
      videoEl.onerror = function () {
        U.showToast('Не удалось загрузить видео. Проверьте интернет.', 'error');
      };
      var playPromise = videoEl.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(function () {
          U.showToast('Нажмите ▶ чтобы начать просмотр', 'info', 2500);
        });
      }
    }
    U.showToast('Приятного просмотра!', 'success', 1800);
    return !!player;
  }

  KB.playerPageInit = function () {
    var id = U.getQueryParam('id');
    var type = getWatchType();
    KB.router.initPage('player');
    U.hidePreloader();

    // Трейлер с этой страницы не смотрим — сразу наружу
    if (type !== 'movie') {
      api.getMovieById(id).then(function (movie) {
        if (movie) U.openMovieWatch(movie, 'trailer');
        window.location.href = U.getBasePath() + 'index.html';
      });
      return;
    }

    api.getMovieById(id).then(function (movie) {
      if (!movie) {
        document.body.innerHTML = '<p style="color:#fff;padding:40px;">Фильм не найден</p>';
        return;
      }

      var titleEl = document.querySelector('.player-title');
      if (titleEl) titleEl.textContent = movie.title || 'Плеер';

      function afterAccess(paidMovie) {
        playFullMovie(paidMovie || movie);
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

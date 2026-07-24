(function (global) {
  'use strict';
  var KB = global.KinoBoom;
  var U = KB.utils;
  var api = KB.api;

  function playFilm(movie) {
    if (!movie) return false;
    var videoUrl = String(movie.video || '').trim();
    if (!videoUrl) {
      U.showToast('Полный фильм недоступен', 'error');
      return false;
    }

    // Фильм на YouTube / Rutube — открываем ссылку фильма (не трейлер)
    if (/youtube\.com|youtu\.be|rutube\.ru/i.test(videoUrl)) {
      if (/youtube\.com|youtu\.be/i.test(videoUrl)) {
        var m = videoUrl.match(/(?:v=|\/embed\/|youtu\.be\/)([\w-]{11})/);
        if (m) videoUrl = 'https://www.youtube.com/watch?v=' + m[1] + '&hl=ru&gl=RU';
      }
      U.showToast('Открываем фильм…', 'success', 1200);
      window.location.href = videoUrl;
      return true;
    }

    if (!KB.player || !KB.player.initPlayer) {
      U.showToast('Плеер не загружен. Обновите страницу (Ctrl+Shift+R).', 'error');
      return false;
    }

    var titleEl = document.querySelector('.player-title');
    if (titleEl) titleEl.textContent = movie.title || 'Фильм';

    KB.player.initPlayer(movie);
    var videoEl = document.getElementById('video-player');
    if (videoEl) {
      videoEl.onerror = function () {
        U.showToast('Не удалось загрузить фильм', 'error');
      };
      var playPromise = videoEl.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(function () {
          U.showToast('Нажмите ▶ чтобы начать просмотр', 'info', 2500);
        });
      }
    }
    U.showToast('Приятного просмотра!', 'success', 1800);
    return true;
  }

  KB.playerPageInit = function () {
    var id = U.getQueryParam('id');
    KB.router.initPage('player');
    U.hidePreloader();

    api.getMovieById(id).then(function (movie) {
      if (!movie) {
        document.body.innerHTML = '<p style="color:#fff;padding:40px;">Фильм не найден</p>';
        return;
      }

      function afterAccess(paidMovie) {
        playFilm(paidMovie || movie);
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

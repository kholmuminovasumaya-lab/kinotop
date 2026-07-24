(function (global) {
  'use strict';
  var KB = global.KinoBoom;
  var U = KB.utils;
  var api = KB.api;

  function playFilmOnly(movie) {
    if (!movie) return false;
    var film = String(movie.video || '').trim();
    var trailer = String(movie.trailer || movie.youtube || '').trim();

    if (!film) {
      U.showToast('Полный фильм недоступен', 'error');
      return false;
    }

    // Запрет: не открывать трейлер под видом фильма
    if (trailer && film.split('?')[0] === trailer.split('?')[0]) {
      U.showToast('Нет файла фильма — в каталоге только трейлер', 'error');
      return false;
    }
    if (/youtube\.com|youtu\.be/i.test(film) && /trailer|трейлер|дубл/i.test(film + ' ' + (movie.title || ''))) {
      // всё равно если video = youtube, откроем только если это НЕ тот же id что у trailer
      var fid = (film.match(/(?:v=|youtu\.be\/)([\w-]{11})/) || [])[1];
      var tid = (trailer.match(/(?:v=|youtu\.be\/)([\w-]{11})/) || [])[1];
      if (fid && tid && fid === tid) {
        U.showToast('Нет файла фильма — в каталоге только трейлер', 'error');
        return false;
      }
    }

    if (/youtube\.com|youtu\.be|rutube\.ru/i.test(film)) {
      U.showToast('Открываем фильм…', 'success', 1200);
      window.location.href = film;
      return true;
    }

    if (!KB.player || !KB.player.initPlayer) {
      // Прямой fallback без плеера-обёртки
      var el = document.getElementById('video-player');
      if (el) {
        el.src = film;
        el.play().catch(function () {});
        var titleEl = document.querySelector('.player-title');
        if (titleEl) titleEl.textContent = movie.title || 'Фильм';
        return true;
      }
      U.showToast('Плеер не загружен', 'error');
      return false;
    }

    var titleEl = document.querySelector('.player-title');
    if (titleEl) titleEl.textContent = movie.title || 'Фильм';
    KB.player.initPlayer(movie);
    var videoEl = document.getElementById('video-player');
    if (videoEl) {
      videoEl.src = film;
      videoEl.onerror = function () {
        U.showToast('Не удалось загрузить фильм', 'error');
      };
      var p = videoEl.play();
      if (p && p.catch) p.catch(function () {
        U.showToast('Нажмите ▶ чтобы смотреть фильм', 'info', 2500);
      });
    }
    U.showToast('Приятного просмотра!', 'success', 1600);
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
        playFilmOnly(paidMovie || movie);
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

(function (global) {
  'use strict';
  var KB = global.KinoBoom;
  var U = KB.utils;
  var api = KB.api;

  function goYoutube(movie) {
    if (!movie) return;
    var url = U.getTrailerUrl ? U.getTrailerUrl(movie) : (movie.trailer || movie.youtube || '');
    if (!url) {
      U.showToast('YouTube недоступен', 'error');
      window.location.href = U.getBasePath() + 'index.html';
      return;
    }
    if (/youtube\.com|youtu\.be/i.test(url)) {
      var m = String(url).match(/(?:v=|\/embed\/|youtu\.be\/)([\w-]{11})/);
      if (m) url = 'https://www.youtube.com/watch?v=' + m[1] + '&hl=ru&gl=RU&cc_lang_pref=ru';
    }
    U.showToast('Открываем YouTube…', 'success', 1200);
    window.location.href = url;
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
        goYoutube(paidMovie || movie);
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

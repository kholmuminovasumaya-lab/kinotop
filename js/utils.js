(function (global) {
  'use strict';
  var KB = global.KinoBoom = global.KinoBoom || {};

  function debounce(fn, delay) {
    if (delay === undefined) delay = 300;
    var timer;
    return function () {
      var args = arguments;
      var self = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(self, args); }, delay);
    };
  }

  function formatDuration(minutes) {
    if (!minutes) return '—';
    var h = Math.floor(minutes / 60);
    var m = minutes % 60;
    return h > 0 ? h + 'ч ' + m + 'мин' : m + 'мин';
  }

  function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = Math.floor(seconds % 60);
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return h > 0 ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
  }

  function createEl(tag, text, className) {
    var el = document.createElement(tag);
    if (text) el.textContent = text;
    if (className) el.className = className;
    return el;
  }

  function showToast(message, type, duration) {
    if (type === undefined) type = 'info';
    if (duration === undefined) duration = 3000;
    var container = document.querySelector('.toast-container');
    if (!container) {
      container = createEl('div', '', 'toast-container');
      document.body.appendChild(container);
    }
    var toast = createEl('div', '', 'toast toast--' + type);
    var icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
    toast.appendChild(createEl('span', icons[type] || 'ℹ'));
    toast.appendChild(createEl('span', message));
    container.appendChild(toast);
    setTimeout(function () {
      toast.classList.add('toast--exit');
      setTimeout(function () { toast.remove(); }, 300);
    }, duration);
  }

  function hidePreloader() {
    var preloader = document.querySelector('.preloader');
    if (preloader) {
      preloader.classList.add('preloader--hidden');
      setTimeout(function () { preloader.remove(); }, 500);
    }
  }

  function initScrollTop() {
    var btn = createEl('button', '↑', 'scroll-top');
    btn.setAttribute('aria-label', 'Наверх');
    document.body.appendChild(btn);
    window.addEventListener('scroll', function () {
      btn.classList.toggle('scroll-top--visible', window.scrollY > 400);
    }, { passive: true });
    btn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }

  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function generateMovieId(movies) {
    var ids = movies.map(function (m) { return m.id; });
    return ids.length ? Math.max.apply(null, ids) + 1 : 1;
  }

  function parseGenres(str) {
    return str.split(',').map(function (g) { return g.trim().toLowerCase(); }).filter(Boolean);
  }

  function parseCast(str) {
    return str.split(',').map(function (c) { return c.trim(); }).filter(Boolean);
  }

  function isNestedRoute(path, href) {
    return path.indexOf('/pages/') !== -1
      || path.indexOf('/admin/') !== -1
      || /\/pages\/[^/]+\.html/i.test(path)
      || /\/admin(\/|$|\/index\.html)/i.test(path)
      || /\/pages\/[^/]+\.html/i.test(href)
      || /\/admin(\/|$|\/index\.html)/i.test(href);
  }

  function getBasePath() {
    var path = (window.location.pathname || '').replace(/\\/g, '/');
    var href = (window.location.href || '').replace(/\\/g, '/');
    if (isNestedRoute(path, href)) return '../';
    return '';
  }

  function getAdminPath() {
    return getBasePath() + 'admin/';
  }

  function resolveAssetUrl(path) {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    return getBasePath() + path;
  }

  function formatPrice(price) {
    var n = Number(price);
    if (!n && n !== 0) n = 10;
    return n + 'р';
  }

  function getMoviePrice() {
    return 10;
  }

  function getPriceLabelHtml(price) {
    var n = Number(price);
    if (!n && n !== 0) n = 10;
    return '<p class="price-label">Стоимость просмотра ' + n + 'Р.</p>';
  }

  function createPriceLabel(price) {
    var wrap = document.createElement('div');
    wrap.innerHTML = getPriceLabelHtml(price);
    return wrap.firstChild;
  }

  function getPriceTagHtml(price, size) {
    var n = Number(price);
    if (!n && n !== 0) n = 10;
    var sizeCls = '';
    if (size === true || size === 'compact') sizeCls = ' price-tag--compact';
    else if (size === 'md') sizeCls = ' price-tag--md';
    return '<div class="price-tag' + sizeCls + '">' +
      '<span class="price-tag__label">Стоимость:</span>' +
      '<div class="price-tag__value">' +
      '<span class="price-tag__num">' + n + '</span>' +
      '<span class="price-tag__cur">р</span>' +
      '</div></div>';
  }

  function createPriceTag(price, size) {
    var wrap = document.createElement('div');
    wrap.innerHTML = getPriceTagHtml(price, size);
    return wrap.firstChild;
  }

  function posterFallbackUrl(title) {
    var safe = String(title || 'Фильм')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .slice(0, 24);
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#1a1560"/><stop offset="100%" stop-color="#0f0c35"/>' +
      '</linearGradient></defs>' +
      '<rect width="400" height="600" fill="url(#g)"/>' +
      '<text x="200" y="300" fill="#fff" font-family="Arial,sans-serif" font-size="28" ' +
      'text-anchor="middle" dominant-baseline="middle">' + safe + '</text></svg>';
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }

  function bindPosterFallback(img, title) {
    if (!img) return;
    img.addEventListener('error', function onPosterError() {
      img.removeEventListener('error', onPosterError);
      img.src = posterFallbackUrl(title);
    });
  }

  function getTrailerUrl(movie) {
    if (!movie) return '';
    var trailer = String(movie.trailer || '').trim();
    var youtube = String(movie.youtube || '').trim();
    // Сначала trailer (можно Rutube на русском), потом youtube
    if (trailer) return trailer;
    if (youtube) return youtube;
    return '';
  }

  function isYoutubeUrl(url) {
    return !!(url && /youtube\.com|youtu\.be/i.test(String(url)));
  }

  function isExternalVideoUrl(url) {
    if (!url) return false;
    return isYoutubeUrl(url) || /rutube\.ru|vk\.com\/video|ok\.ru\/video/i.test(String(url));
  }

  function getMovieVideoUrl(movie) {
    if (!movie) return '';
    return String(movie.video || '').trim();
  }

  function extractYoutubeId(url) {
    if (!url) return '';
    var match = String(url).match(/(?:v=|\/embed\/|youtu\.be\/)([\w-]{11})/);
    return match ? match[1] : '';
  }

  function withRussianYoutube(url) {
    if (!isYoutubeUrl(url)) return url;
    var videoId = extractYoutubeId(url);
    if (!videoId) return url;
    return 'https://www.youtube.com/watch?v=' + videoId + '&hl=ru&gl=RU&cc_lang_pref=ru';
  }

  function buildYoutubeWatchUrl(movie, type) {
    if (!movie) return '';
    type = type || 'trailer';
    var url = '';
    if (type === 'movie') {
      var video = getMovieVideoUrl(movie);
      if (isYoutubeUrl(video)) url = video;
    } else {
      url = getTrailerUrl(movie);
      if (!isYoutubeUrl(url)) return '';
    }
    var videoId = extractYoutubeId(url);
    if (!videoId) return '';
    var startAt = 0;
    if (global.KinoBoom && global.KinoBoom.history) {
      startAt = global.KinoBoom.history.getProgressSeconds(movie.id, type);
    }
    var watchUrl = withRussianYoutube('https://www.youtube.com/watch?v=' + videoId);
    if (startAt > 0) watchUrl += '&t=' + Math.floor(startAt) + 's';
    return watchUrl;
  }

  function openYoutubeWatch(movie, type) {
    if (!movie) return;
    type = type || 'trailer';
    var url = '';

    if (type === 'trailer') {
      url = getTrailerUrl(movie);
      if (isYoutubeUrl(url)) url = withRussianYoutube(url);
    } else {
      url = buildYoutubeWatchUrl(movie, 'movie');
    }

    if (!url) {
      showToast(type === 'movie' ? 'Полный фильм недоступен' : 'Трейлер недоступен', 'error');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    if (global.KinoBoom && global.KinoBoom.history) {
      global.KinoBoom.history.addToHistory(
        movie,
        global.KinoBoom.history.getProgressSeconds(movie.id, type),
        type
      );
    }
    showToast(type === 'movie' ? 'Открываем фильм…' : 'Открываем трейлер…', 'success', 2000);
  }

  function goToPlayer(movie, type) {
    openMovieWatch(movie, type);
  }

  function playMovie(movie, type) {
    openMovieWatch(movie, type || 'movie');
  }

  function openExternalVideo(url, movie, type) {
    if (!url) return false;
    if (isYoutubeUrl(url)) url = withRussianYoutube(url);
    if (global.KinoBoom && global.KinoBoom.history) {
      global.KinoBoom.history.addToHistory(
        movie,
        global.KinoBoom.history.getProgressSeconds(movie.id, type),
        type
      );
    }
    showToast(type === 'movie' ? 'Открываем фильм…' : 'Открываем трейлер…', 'success', 1500);
    window.location.href = url;
    return true;
  }

  function openInAppPlayer(movie, type) {
    if (!movie) return;
    type = type || 'movie';
    window.location.href = getBasePath() + 'pages/player.html?id=' + encodeURIComponent(movie.id) + '&type=' + encodeURIComponent(type);
  }

  function openMovieWatch(movie, type) {
    if (!movie) return;
    type = type === 'trailer' ? 'trailer' : 'movie';

    function doWatch() {
      // Трейлер — только если явно type=trailer
      if (type === 'trailer') {
        var trailer = getTrailerUrl(movie);
        if (!trailer) {
          showToast('Трейлер недоступен', 'error');
          return;
        }
        openExternalVideo(trailer, movie, 'trailer');
        return;
      }

      // Смотреть фильм — ТОЛЬКО поле video (фильм), НЕ трейлер
      var film = getMovieVideoUrl(movie);
      if (!film) {
        showToast('Полный фильм недоступен', 'error');
        return;
      }
      if (isExternalVideoUrl(film)) {
        openExternalVideo(film, movie, 'movie');
        return;
      }
      openInAppPlayer(movie, 'movie');
    }

    if (global.KinoBoom && global.KinoBoom.payments) {
      global.KinoBoom.payments.ensureAccessThenWatch(movie, doWatch, type);
      return;
    }
    doWatch();
  }

  function getMovieWatchUrl(movie, type) {
    if (!movie) return '';
    if (type === 'trailer') {
      var trailer = getTrailerUrl(movie);
      if (isYoutubeUrl(trailer)) return withRussianYoutube(trailer);
      return trailer || '';
    }
    var film = getMovieVideoUrl(movie);
    if (isYoutubeUrl(film)) return withRussianYoutube(film);
    if (isExternalVideoUrl(film)) return film;
    if (film) return getBasePath() + 'pages/player.html?id=' + movie.id + '&type=movie';
    return '';
  }

  KB.utils = {
    debounce: debounce,
    formatDuration: formatDuration,
    formatTime: formatTime,
    createEl: createEl,
    showToast: showToast,
    hidePreloader: hidePreloader,
    initScrollTop: initScrollTop,
    getQueryParam: getQueryParam,
    generateMovieId: generateMovieId,
    parseGenres: parseGenres,
    parseCast: parseCast,
    getBasePath: getBasePath,
    getAdminPath: getAdminPath,
    resolveAssetUrl: resolveAssetUrl,
    formatPrice: formatPrice,
    getMoviePrice: getMoviePrice,
    getPriceTagHtml: getPriceTagHtml,
    createPriceTag: createPriceTag,
    getPriceLabelHtml: getPriceLabelHtml,
    createPriceLabel: createPriceLabel,
    posterFallbackUrl: posterFallbackUrl,
    bindPosterFallback: bindPosterFallback,
    openMovieWatch: openMovieWatch,
    playMovie: playMovie,
    goToPlayer: goToPlayer,
    openYoutubeWatch: openYoutubeWatch,
    buildYoutubeWatchUrl: buildYoutubeWatchUrl,
    getMovieWatchUrl: getMovieWatchUrl,
    getTrailerUrl: getTrailerUrl,
    extractYoutubeId: extractYoutubeId,
  };
})(window);

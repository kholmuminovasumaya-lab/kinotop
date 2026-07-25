/**
 * backend.js — связь с серверной SQLite БД (REST API)
 */
(function (global) {
  'use strict';

  var KB = global.KinoBoom = global.KinoBoom || {};
  var enabled = false;
  var kvCache = {};
  var initPromise = null;
  var apiBase = null;

  var FALLBACK_BASES = [
    'http://127.0.0.1:8081/',
    'http://localhost:8081/',
    'http://127.0.0.1:8082/',
    'http://localhost:8082/',
    'http://127.0.0.1:8083/',
    'http://localhost:8083/'
  ];

  function normalizeBase(base) {
    if (!base) return '';
    return base.endsWith('/') ? base : base + '/';
  }

  function currentOriginBase() {
    var proto = global.location.protocol || '';
    if (proto === 'http:' || proto === 'https:') {
      return normalizeBase(global.location.origin || '');
    }
    return '';
  }

  function getApiBase() {
    return apiBase || currentOriginBase() || FALLBACK_BASES[0];
  }

  function apiUrl(path) {
    return getApiBase() + String(path || '').replace(/^\//, '');
  }

  function probeBase(base) {
    var url = normalizeBase(base) + 'api/health';
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, 2500) : null;
    return fetch(url, { method: 'GET', cache: 'no-store', signal: ctrl ? ctrl.signal : undefined }).then(function (r) {
      if (timer) clearTimeout(timer);
      if (!r.ok) throw new Error('API ' + r.status);
      return r.json();
    }).then(function (res) {
      if (!res || !res.ok) throw new Error('health not ok');
      return normalizeBase(base);
    }).catch(function (err) {
      if (timer) clearTimeout(timer);
      throw err;
    });
  }

  function discoverApiBase() {
    var host = String((global.location && global.location.hostname) || '').toLowerCase();
    var isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '';
    var origin = currentOriginBase();
    var candidates = [];
    if (origin) candidates.push(origin);
    // Локальные fallback только с localhost — иначе Cloudflare ловит 127.0.0.1 и зависает
    if (isLocalHost) {
      FALLBACK_BASES.forEach(function (b) {
        if (candidates.indexOf(b) === -1) candidates.push(b);
      });
    }

    function tryNext(i) {
      if (i >= candidates.length) return Promise.reject(new Error('server not found'));
      return probeBase(candidates[i]).then(function (base) {
        apiBase = base;
        return base;
      }).catch(function () {
        return tryNext(i + 1);
      });
    }

    return tryNext(0);
  }

  function request(method, path, body) {
    var opts = { method: method, headers: { 'Content-Type': 'application/json' }, cache: 'no-store' };
    if (body !== undefined) opts.body = JSON.stringify(body);
    return fetch(apiUrl(path), opts).then(function (r) {
      if (!r.ok) throw new Error('API ' + r.status);
      return r.json();
    });
  }

  function loadKv() {
    return request('GET', '/api/kv').then(function (res) {
      kvCache = res.data || {};
      return kvCache;
    }).catch(function () {
      kvCache = {};
      return kvCache;
    });
  }

  function init(force) {
    if (!force && initPromise) return initPromise;
    if (force) initPromise = null;
    var proto = global.location.protocol || '';
    if (proto === 'file:') {
      enabled = false;
      apiBase = null;
      initPromise = Promise.resolve(false);
      return initPromise;
    }
    initPromise = discoverApiBase().then(function () {
      enabled = true;
      return loadKv().then(function () { return true; });
    }).catch(function () {
      enabled = false;
      apiBase = currentOriginBase() || null;
      return false;
    });
    return initPromise;
  }

  function ensureReady() {
    if (enabled) return Promise.resolve(true);
    return init(true);
  }

  function isEnabled() {
    return enabled;
  }

  function getKv(key, defaultValue) {
    if (defaultValue === undefined) defaultValue = null;
    if (!enabled || !(key in kvCache)) return defaultValue;
    return kvCache[key];
  }

  function setKv(key, value) {
    if (!enabled) return Promise.resolve(false);
    kvCache[key] = value;
    return request('PUT', '/api/kv/' + encodeURIComponent(key), value).then(function () {
      return true;
    }).catch(function () {
      return false;
    });
  }

  function removeKv(key) {
    if (!enabled) return Promise.resolve(false);
    delete kvCache[key];
    return request('DELETE', '/api/kv/' + encodeURIComponent(key)).then(function () {
      return true;
    }).catch(function () {
      return false;
    });
  }

  function getMovies() {
    return request('GET', '/api/movies').then(function (res) {
      return (res.movies || []).slice();
    });
  }

  function getGenres() {
    return request('GET', '/api/genres').then(function (res) {
      return (res.genres || []).slice();
    });
  }

  function saveMovie(movie) {
    return request('POST', '/api/movies', movie);
  }

  function deleteMovie(id) {
    return request('DELETE', '/api/movies/' + id);
  }

  function resetMovies() {
    return request('POST', '/api/movies/reset');
  }

  function createPaymentOrder(data) {
    return request('POST', '/api/payments/create', data);
  }

  function getPaymentStatus(orderId) {
    return request('GET', '/api/payments/' + encodeURIComponent(orderId) + '/status');
  }

  function getPendingPayment(sessionId, movieId, watchType) {
    var q = 'sessionId=' + encodeURIComponent(sessionId) +
      '&movieId=' + encodeURIComponent(movieId) +
      '&watchType=' + encodeURIComponent(watchType || 'trailer');
    return request('GET', '/api/payments/pending?' + q);
  }

  function listPaymentOrders(limit, status) {
    var q = 'limit=' + encodeURIComponent(limit || 50);
    if (status) q += '&status=' + encodeURIComponent(status);
    return request('GET', '/api/payments/orders?' + q);
  }

  function approvePaymentOrder(orderId) {
    return request('POST', '/api/payments/' + encodeURIComponent(orderId) + '/approve');
  }

  function rejectPaymentOrder(orderId) {
    return request('POST', '/api/payments/' + encodeURIComponent(orderId) + '/reject');
  }

  function checkPaymentAccess(sessionId, movieId, watchType) {
    var q = 'sessionId=' + encodeURIComponent(sessionId) +
      '&movieId=' + encodeURIComponent(movieId) +
      '&watchType=' + encodeURIComponent(watchType || 'trailer');
    return request('GET', '/api/payments/access?' + q);
  }

  function getPaymentGrants(sessionId) {
    return request('GET', '/api/payments/grants?sessionId=' + encodeURIComponent(sessionId));
  }

  KB.backend = {
    init: init,
    ensureReady: ensureReady,
    isEnabled: isEnabled,
    getApiBase: getApiBase,
    getKv: getKv,
    setKv: setKv,
    removeKv: removeKv,
    getMovies: getMovies,
    getGenres: getGenres,
    saveMovie: saveMovie,
    deleteMovie: deleteMovie,
    resetMovies: resetMovies,
    createPaymentOrder: createPaymentOrder,
    getPaymentStatus: getPaymentStatus,
    getPendingPayment: getPendingPayment,
    listPaymentOrders: listPaymentOrders,
    approvePaymentOrder: approvePaymentOrder,
    rejectPaymentOrder: rejectPaymentOrder,
    checkPaymentAccess: checkPaymentAccess,
    getPaymentGrants: getPaymentGrants
  };
})(window);

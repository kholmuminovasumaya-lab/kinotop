/**
 * boot.js — загрузчик для работы через file:// (двойной клик)
 */
(function (global) {
  'use strict';

  var script = document.currentScript;
  var entry = (script && script.getAttribute('data-entry')) || 'app.js';
  var path = (global.location.pathname || '').replace(/\\/g, '/');
  var href = (global.location.href || '').replace(/\\/g, '/');
  var inPages = path.indexOf('/pages/') !== -1 || href.indexOf('/pages/') !== -1 || /\/pages\/[^/]+\.html/i.test(path);
  var inAdmin = path.indexOf('/admin/') !== -1 || /\/admin(\/|$|\/index\.html)/i.test(path) || /\/admin(\/|$|\/index\.html)/i.test(href);
  var inSubfolder = inPages || inAdmin;
  var jsBase = inSubfolder ? '../js/' : 'js/';
  var cacheBust = 'v=noTrailer2';

  var core = [
    'storage.js', 'utils.js', 'payments.js', 'theme.js', 'favorites.js', 'history.js',
    'api.js', 'cards.js', 'slider.js', 'search.js', 'player.js', 'auth.js', 'router.js'
  ];

  function loadScript(src, done) {
    var s = document.createElement('script');
    s.src = src + (src.indexOf('?') >= 0 ? '&' : '?') + cacheBust;
    s.onload = function () { done(); };
    s.onerror = function () { console.error('KinoBoom: не загружен ' + src); done(); };
    document.head.appendChild(s);
  }

  function resolveEntry() {
    if (entry.indexOf('../') === 0) return entry;
    if (inPages && entry.slice(-8) === '-page.js') return entry;
    return jsBase + entry;
  }

  function invokeEntry() {
    var KB = global.KinoBoom;
    if (!KB) return;
    var keys = ['appInit', 'adminInit', 'moviePageInit', 'playerPageInit', 'searchPageInit', 'favoritesPageInit', 'historyPageInit', 'settingsPageInit'];
    for (var i = 0; i < keys.length; i++) {
      if (typeof KB[keys[i]] === 'function') { KB[keys[i]](); return; }
    }
  }

  function loadChain(i, cb) {
    if (i >= core.length) return cb();
    loadScript(jsBase + core[i], function () { loadChain(i + 1, cb); });
  }

  function continueBoot() {
    loadChain(0, function () {
      loadScript(resolveEntry(), invokeEntry);
    });
  }

  function clearStaleMovieCache(done) {
    try {
      if (!global.indexedDB) return done();
      var req = global.indexedDB.open('kinobro_db');
      req.onerror = function () { done(); };
      req.onsuccess = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('movies')) {
          try { db.close(); } catch (e) {}
          return done();
        }
        var tx = db.transaction('movies', 'readwrite');
        tx.objectStore('movies').clear();
        tx.oncomplete = function () {
          try { db.close(); } catch (e) {}
          done();
        };
        tx.onerror = function () {
          try { db.close(); } catch (e) {}
          done();
        };
      };
    } catch (e) {
      done();
    }
  }

  function probeLocalServer(bases, index, cb) {
    if (index >= bases.length) return cb(false);
    var base = bases[index];
    fetch(base + 'api/health', { method: 'GET', cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('bad status');
        return r.json();
      })
      .then(function (res) {
        if (res && res.ok) cb(base);
        else probeLocalServer(bases, index + 1, cb);
      })
      .catch(function () {
        probeLocalServer(bases, index + 1, cb);
      });
  }

  function maybeRedirectFromFile(cb) {
    if (global.location.protocol !== 'file:') return cb();
    var path = (global.location.pathname || '').replace(/\\/g, '/');
    var href = (global.location.href || '').replace(/\\/g, '/');
    var inPages = path.indexOf('/pages/') !== -1 || href.indexOf('/pages/') !== -1;
    var inAdmin = path.indexOf('/admin/') !== -1 || href.indexOf('/admin/') !== -1;
    var page = 'index.html';
    if (inPages) {
      var pageMatch = path.match(/\/pages\/([^/]+\.html)/i) || href.match(/\/pages\/([^/]+\.html)/i);
      if (pageMatch) page = 'pages/' + pageMatch[1] + (global.location.search || '');
    } else if (inAdmin) {
      page = 'admin/';
    }
    var bases = ['http://127.0.0.1:8081/', 'http://localhost:8081/', 'http://127.0.0.1:8082/', 'http://localhost:8082/'];
    probeLocalServer(bases, 0, function (base) {
      if (!base) return cb();
      var target = base + page;
      if (page.indexOf('?') === -1 && global.location.search) {
        target += global.location.search;
      }
      global.location.replace(target);
    });
  }

  function start() {
    maybeRedirectFromFile(function () {
      loadScript(jsBase + 'embedded-data.js', function () {
        loadScript(jsBase + 'backend.js', function () {
          loadScript(jsBase + 'db.js', function () {
            var initBackend = global.KinoBoom && global.KinoBoom.backend && global.KinoBoom.backend.init
              ? global.KinoBoom.backend.init()
              : Promise.resolve(false);
            var initDb = global.KinoBoom && global.KinoBoom.db && global.KinoBoom.db.init
              ? global.KinoBoom.db.init()
              : Promise.resolve();

            Promise.all([initBackend, initDb]).then(function () {
              clearStaleMovieCache(continueBoot);
            }).catch(function (err) {
              console.error('KINOBRO init failed, continue:', err);
              clearStaleMovieCache(continueBoot);
            });
          });
        });
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window);

(function (global) {
  'use strict';

  var KB = global.KinoBoom = global.KinoBoom || {};
  var DB_NAME = 'kinobro_db';
  var DB_VERSION = 1;
  var INIT_TIMEOUT_MS = 6000;
  var KV_FLUSH_MS = 250;

  var cache = {};
  var db = null;
  var ready = false;
  var readyPromise = null;
  var writeQueue = Promise.resolve();
  var kvPending = null;
  var kvTimer = null;

  function enqueue(task) {
    var job = writeQueue.then(function () { return task(); });
    writeQueue = job.catch(function () {});
    return job;
  }

  function openDatabase() {
    return new Promise(function (resolve, reject) {
      if (!global.indexedDB) {
        reject(new Error('IndexedDB unavailable'));
        return;
      }
      var request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = function () { reject(request.error || new Error('IndexedDB open failed')); };
      request.onblocked = function () {
        console.warn('KINOBRO DB: update blocked, using cache');
        reject(new Error('IndexedDB blocked'));
      };
      request.onupgradeneeded = function (e) {
        var database = e.target.result;
        if (!database.objectStoreNames.contains('kv')) {
          database.createObjectStore('kv', { keyPath: 'key' });
        }
        if (!database.objectStoreNames.contains('movies')) {
          database.createObjectStore('movies', { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains('genres')) {
          database.createObjectStore('genres', { keyPath: 'id' });
        }
      };
      request.onsuccess = function () {
        db = request.result;
        db.onversionchange = function () {
          try { db.close(); } catch (e) {}
          db = null;
        };
        resolve(db);
      };
    });
  }

  function runTransaction(storeName, mode, fn) {
    return enqueue(function () {
      return new Promise(function (resolve, reject) {
        if (!db) {
          resolve();
          return;
        }
        var tx;
        try {
          tx = db.transaction(storeName, mode);
        } catch (err) {
          reject(err);
          return;
        }
        var store = tx.objectStore(storeName);
        try {
          fn(store, tx);
        } catch (err) {
          reject(err);
          return;
        }
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error || new Error('IndexedDB transaction failed')); };
        tx.onabort = function () { reject(tx.error || new Error('IndexedDB transaction aborted')); };
      });
    });
  }

  function idbGetAll(storeName) {
    return enqueue(function () {
      return new Promise(function (resolve, reject) {
        if (!db) {
          resolve([]);
          return;
        }
        var tx = db.transaction(storeName, 'readonly');
        var req = tx.objectStore(storeName).getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function loadLocalStorageToCache() {
    cache = {};
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (!key || key.indexOf('kibo_') !== 0) continue;
      try {
        cache[key] = JSON.parse(localStorage.getItem(key));
      } catch (e) {}
    }
  }

  function loadKVCache() {
    return idbGetAll('kv').then(function (rows) {
      rows.forEach(function (row) {
        if (row && row.key) cache[row.key] = row.value;
      });
    });
  }

  function migrateLocalStorageToDb() {
    var keys = Object.keys(cache).filter(function (key) {
      return key.indexOf('kibo_') === 0;
    });
    if (!keys.length || !db) return Promise.resolve();
    return runTransaction('kv', 'readwrite', function (store) {
      keys.forEach(function (key) {
        store.put({ key: key, value: cache[key] });
      });
    });
  }

  function seedCatalog() {
    var emb = global.KinoBoom_EMBEDDED || {};
    return idbGetAll('movies').then(function (movies) {
      if (movies.length > 0) return;
      var list = (emb.movies || []).slice();
      if (!list.length || !db) return;
      return runTransaction('movies', 'readwrite', function (store) {
        list.forEach(function (movie) { store.put(movie); });
      });
    }).then(function () {
      return idbGetAll('genres');
    }).then(function (genres) {
      if (genres.length > 0) return;
      var list = emb.genres || [];
      if (!list.length || !db) return;
      return runTransaction('genres', 'readwrite', function (store) {
        list.forEach(function (genre) { store.put(genre); });
      });
    });
  }

  function activateFallback(reason) {
    if (reason) console.warn('KINOBRO DB: localStorage mode —', reason);
    db = null;
    ready = true;
    loadLocalStorageToCache();
    return { engine: 'localStorage', ready: true };
  }

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise(function (resolve) {
        setTimeout(function () { resolve({ timeout: true }); }, ms);
      })
    ]);
  }

  function init() {
    if (readyPromise) return readyPromise;

    if (!global.indexedDB) {
      readyPromise = Promise.resolve(activateFallback('IndexedDB not supported'));
      return readyPromise;
    }

    readyPromise = withTimeout(
      openDatabase()
        .then(function () {
          loadLocalStorageToCache();
          return loadKVCache();
        })
        .then(migrateLocalStorageToDb)
        .then(seedCatalog)
        .then(function () {
          ready = true;
          return { engine: 'IndexedDB', ready: true };
        }),
      INIT_TIMEOUT_MS
    ).then(function (result) {
      if (result && result.timeout) return activateFallback('init timeout');
      ready = true;
      return result;
    }).catch(function (err) {
      return activateFallback(err && err.message ? err.message : 'init error');
    });

    return readyPromise;
  }

  function flushKvPending() {
    kvTimer = null;
    if (!kvPending || !db) {
      kvPending = null;
      return;
    }
    var batch = kvPending;
    kvPending = null;
    var keys = Object.keys(batch);
    if (!keys.length) return;

    runTransaction('kv', 'readwrite', function (store) {
      keys.forEach(function (key) {
        store.put({ key: key, value: batch[key] });
      });
    }).catch(function (e) {
      console.error('KINOBRO DB kv flush:', e);
    });
  }

  function getCache(key, defaultValue) {
    if (defaultValue === undefined) defaultValue = null;
    return Object.prototype.hasOwnProperty.call(cache, key) ? cache[key] : defaultValue;
  }

  function setCache(key, value) {
    cache[key] = value;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}

    if (!db) return;

    if (!kvPending) kvPending = {};
    kvPending[key] = value;
    clearTimeout(kvTimer);
    kvTimer = setTimeout(flushKvPending, KV_FLUSH_MS);
  }

  function removeCache(key) {
    delete cache[key];
    try { localStorage.removeItem(key); } catch (e) {}
    if (!db) return;
    runTransaction('kv', 'readwrite', function (store) {
      store.delete(key);
    }).catch(function () {});
  }

  KB.db = {
    DB_NAME: DB_NAME,
    ENGINE: 'IndexedDB',
    init: init,
    isReady: function () { return ready; },
    usesIndexedDB: function () { return !!db; },
    getCache: getCache,
    setCache: setCache,
    removeCache: removeCache,
    getMovies: function () {
      if (!db) return Promise.resolve([]);
      return idbGetAll('movies');
    },
    saveMovie: function (movie) {
      if (!db || !movie) return Promise.resolve();
      return runTransaction('movies', 'readwrite', function (store) {
        store.put(movie);
      });
    },
    deleteMovie: function (id) {
      if (!db) return Promise.resolve();
      return runTransaction('movies', 'readwrite', function (store) {
        store.delete(Number(id));
      });
    },
    replaceMovies: function (movies) {
      if (!db) return Promise.resolve();
      return runTransaction('movies', 'readwrite', function (store) {
        store.clear();
        (movies || []).forEach(function (movie) { store.put(movie); });
      });
    },
    getGenres: function () {
      if (!db) return Promise.resolve([]);
      return idbGetAll('genres');
    },
    replaceGenres: function (genres) {
      if (!db) return Promise.resolve();
      return runTransaction('genres', 'readwrite', function (store) {
        store.clear();
        (genres || []).forEach(function (genre) { store.put(genre); });
      });
    }
  };
})(window);

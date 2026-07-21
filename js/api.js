(function (global) {
  'use strict';
  var KB = global.KinoBoom;
  var storage = KB.storage;
  var getBasePath = KB.utils.getBasePath;
  var moviesCache = null;
  var genresCache = null;

  function getEmbeddedPayload() {
    return global.KinoBoom_EMBEDDED || {};
  }

  function getEmbeddedMovies() {
    return (getEmbeddedPayload().movies || []).slice();
  }

  function getEmbeddedGenres() {
    return (getEmbeddedPayload().genres || []).slice();
  }

    var PHOTO_BY_ID = {
    2: ['assets/images/posters/real-2.jpg', 'assets/images/backgrounds/real-2.jpg'],
    3: ['assets/images/posters/real-3.jpg', 'assets/images/backgrounds/real-3.jpg'],
    4: ['assets/images/posters/real-4.jpg', 'assets/images/backgrounds/real-4.jpg'],
    5: ['assets/images/posters/real-5.jpg', 'assets/images/backgrounds/real-5.jpg'],
    6: ['assets/images/posters/real-6.jpg', 'assets/images/backgrounds/real-6.jpg'],
    7: ['assets/images/posters/real-7.jpg', 'assets/images/backgrounds/real-7.jpg'],
    8: ['assets/images/posters/real-8.jpg', 'assets/images/backgrounds/real-8.jpg'],
    9: ['assets/images/posters/real-9.jpg', 'assets/images/backgrounds/real-9.jpg'],
    10: ['assets/images/posters/real-10.jpg', 'assets/images/backgrounds/real-10.jpg'],
    11: ['assets/images/posters/real-11.jpg', 'assets/images/backgrounds/real-11.jpg'],
    12: ['assets/images/posters/real-12.jpg', 'assets/images/backgrounds/real-12.jpg'],
    13: ['assets/images/posters/real-13.jpg', 'assets/images/backgrounds/real-13.jpg'],
    14: ['assets/images/posters/real-14.jpg', 'assets/images/backgrounds/real-14.jpg'],
    15: ['assets/images/posters/real-15.jpg', 'assets/images/backgrounds/real-15.jpg'],
    16: ['assets/images/posters/real-16.jpg', 'assets/images/backgrounds/real-16.jpg'],
    17: ['assets/images/posters/real-17.jpg', 'assets/images/backgrounds/real-17.jpg'],
    18: ['assets/images/posters/real-18.jpg', 'assets/images/backgrounds/real-18.jpg'],
    19: ['assets/images/posters/real-19.jpg', 'assets/images/backgrounds/real-19.jpg'],
    20: ['assets/images/posters/real-20.jpg', 'assets/images/backgrounds/real-20.jpg'],
    21: ['assets/images/posters/real-21.jpg', 'assets/images/backgrounds/real-21.jpg'],
    22: ['assets/images/posters/real-22.jpg', 'assets/images/backgrounds/real-22.jpg'],
    23: ['assets/images/posters/real-23.jpg', 'assets/images/backgrounds/real-23.jpg'],
    24: ['assets/images/posters/real-24.jpg', 'assets/images/backgrounds/real-24.jpg'],
    25: ['assets/images/posters/real-25.jpg', 'assets/images/backgrounds/real-25.jpg'],
    26: ['assets/images/posters/real-26.jpg', 'assets/images/backgrounds/real-26.jpg'],
    27: ['assets/images/posters/real-27.jpg', 'assets/images/backgrounds/real-27.jpg'],
    28: ['assets/images/posters/real-28.jpg', 'assets/images/backgrounds/real-28.jpg'],
    29: ['assets/images/posters/real-29.jpg', 'assets/images/backgrounds/real-29.jpg'],
    30: ['assets/images/posters/real-30.jpg', 'assets/images/backgrounds/real-30.jpg'],
    31: ['assets/images/posters/real-31.jpg', 'assets/images/backgrounds/real-31.jpg'],
    32: ['assets/images/posters/real-32.jpg', 'assets/images/backgrounds/real-32.jpg'],
    33: ['assets/images/posters/real-33.jpg', 'assets/images/backgrounds/real-33.jpg'],
    34: ['assets/images/posters/real-34.jpg', 'assets/images/backgrounds/real-34.jpg'],
    35: ['assets/images/posters/real-35.jpg', 'assets/images/backgrounds/real-35.jpg'],
    36: ['assets/images/posters/real-36.jpg', 'assets/images/backgrounds/real-36.jpg'],
    37: ['assets/images/posters/real-37.jpg', 'assets/images/backgrounds/real-37.jpg'],
    38: ['assets/images/posters/real-38.jpg', 'assets/images/backgrounds/real-38.jpg'],
    39: ['assets/images/posters/real-39.jpg', 'assets/images/backgrounds/real-39.jpg'],
    40: ['assets/images/posters/real-40.jpg', 'assets/images/backgrounds/real-40.jpg'],
    41: ['assets/images/posters/real-41.jpg', 'assets/images/backgrounds/real-41.jpg'],
    42: ['assets/images/posters/real-42.jpg', 'assets/images/backgrounds/real-42.jpg'],
    43: ['assets/images/posters/real-43.jpg', 'assets/images/backgrounds/real-43.jpg'],
    44: ['assets/images/posters/real-44.jpg', 'assets/images/backgrounds/real-44.jpg'],
    45: ['assets/images/posters/real-45.jpg', 'assets/images/backgrounds/real-45.jpg'],
    46: ['assets/images/posters/real-46.jpg', 'assets/images/backgrounds/real-46.jpg'],
    47: ['assets/images/posters/real-47.jpg', 'assets/images/backgrounds/real-47.jpg'],
    48: ['assets/images/posters/real-48.jpg', 'assets/images/backgrounds/real-48.jpg'],
    49: ['assets/images/posters/real-49.jpg', 'assets/images/backgrounds/real-49.jpg'],
    50: ['assets/images/posters/real-50.jpg', 'assets/images/backgrounds/real-50.jpg'],
    51: ['assets/images/posters/real-51.jpg', 'assets/images/backgrounds/real-51.jpg'],
    52: ['assets/images/posters/real-52.jpg', 'assets/images/backgrounds/real-52.jpg'],
    53: ['assets/images/posters/real-53.jpg', 'assets/images/backgrounds/real-53.jpg'],
    54: ['assets/images/posters/real-54.jpg', 'assets/images/backgrounds/real-54.jpg'],
    55: ['assets/images/posters/real-55.jpg', 'assets/images/backgrounds/real-55.jpg'],
    56: ['assets/images/posters/real-56.jpg', 'assets/images/backgrounds/real-56.jpg'],
    57: ['assets/images/posters/real-57.jpg', 'assets/images/backgrounds/real-57.jpg'],
    58: ['assets/images/posters/real-58.jpg', 'assets/images/backgrounds/real-58.jpg'],
    59: ['assets/images/posters/real-59.jpg', 'assets/images/backgrounds/real-59.jpg'],
    60: ['assets/images/posters/real-60.jpg', 'assets/images/backgrounds/real-60.jpg'],
    61: ['assets/images/posters/real-61.jpg', 'assets/images/backgrounds/real-61.jpg'],
    62: ['assets/images/posters/real-62.jpg', 'assets/images/backgrounds/real-62.jpg'],
    63: ['assets/images/posters/real-63.jpg', 'assets/images/backgrounds/real-63.jpg'],
    64: ['assets/images/posters/real-64.jpg', 'assets/images/backgrounds/real-64.jpg'],
    65: ['assets/images/posters/real-65.jpg', 'assets/images/backgrounds/real-65.jpg'],
    66: ['assets/images/posters/real-66.jpg', 'assets/images/backgrounds/real-66.jpg'],
    67: ['assets/images/posters/real-67.jpg', 'assets/images/backgrounds/real-67.jpg'],
    68: ['assets/images/posters/real-68.jpg', 'assets/images/backgrounds/real-68.jpg'],
    69: ['assets/images/posters/real-69.jpg', 'assets/images/backgrounds/real-69.jpg'],  };

  function isWeakPoster(url) {
    if (!url) return true;
    return /\.svg($|\?)/i.test(url)
      || /placehold\.co|picsum\.photos/i.test(url)
      || /assets\/images\/posters\/(poster|cover|photo)-/i.test(url) || /unsplash\.com/i.test(url);
  }

  function isWeakBackground(url) {
    if (!url) return true;
    return /\.svg($|\?)/i.test(url)
      || /placehold\.co|picsum\.photos/i.test(url)
      || /assets\/images\/backgrounds\/(bg|scene|photo)-/i.test(url) || /unsplash\.com/i.test(url);
  }

  function normalizeMovie(movie) {
    if (!movie || typeof movie !== 'object') return null;
    var normalized = Object.assign({}, movie);
    if (!Array.isArray(normalized.genres)) normalized.genres = [];
    if (!Array.isArray(normalized.cast)) normalized.cast = [];
    if (!normalized.title) normalized.title = 'Без названия';
    var id = Number(normalized.id);
    var photos = PHOTO_BY_ID[id];
    if (photos) {
      if (isWeakPoster(normalized.poster)) normalized.poster = photos[0];
      if (isWeakBackground(normalized.background)) normalized.background = photos[1];
    }
    return normalized;
  }

  function normalizeMoviesList(list) {
    return (list || []).map(normalizeMovie).filter(Boolean);
  }

  function hasCachedMovies() {
    return !!(moviesCache && moviesCache.length);
  }

  function hasCachedGenres() {
    return !!(genresCache && genresCache.length);
  }

  function loadJson(path) {
    return fetch(path).then(function (r) {
      if (!r.ok) throw new Error('fetch failed');
      return r.json();
    }).catch(function () {
      var emb = global.KinoBoom_EMBEDDED || {};
      if (path.indexOf('movies.json') !== -1 && emb.movies) return { movies: emb.movies };
      if (path.indexOf('genres.json') !== -1 && emb.genres) return { genres: emb.genres };
      throw new Error('No data for ' + path);
    });
  }

  var HIDDEN_MOVIE_IDS = [1];
  var HIDDEN_MOVIE_TITLES = ['тёмный рыцарь', 'dark knight'];

  function isHiddenMovie(movie) {
    if (!movie) return true;
    if (HIDDEN_MOVIE_IDS.indexOf(movie.id) !== -1) return true;
    var title = String(movie.title || '').toLowerCase();
    return HIDDEN_MOVIE_TITLES.some(function (t) { return title.indexOf(t) !== -1; });
  }

  function mergeMovies(raw) {
    var movies = normalizeMoviesList(raw.movies || raw);
    var deleted = storage.getDeletedMovies();
    var overrides = storage.getMoviesOverride();
    movies = movies.filter(function (m) { return deleted.indexOf(m.id) === -1; });
    overrides.forEach(function (override) {
      var norm = normalizeMovie(override);
      if (!norm) return;
      var idx = movies.findIndex(function (m) { return m.id === norm.id; });
      if (idx >= 0) movies[idx] = Object.assign({}, movies[idx], norm);
      else if (deleted.indexOf(norm.id) === -1) movies.push(norm);
    });
    return movies.filter(function (m) { return !isHiddenMovie(m); });
  }

  function applyMoviesList(rawMovies, engine) {
    var list = normalizeMoviesList(rawMovies);
    if (KB.backend && KB.backend.isEnabled()) {
      moviesCache = list.filter(function (m) { return !isHiddenMovie(m); });
    } else {
      moviesCache = mergeMovies({ movies: list });
    }
    if (!moviesCache.length) {
      moviesCache = mergeMovies({ movies: getEmbeddedMovies() });
    }
    try {
      storage.setItem(storage.STORAGE_KEYS.CACHE, {
        timestamp: Date.now(),
        engine: engine || (KB.backend && KB.backend.isEnabled() ? 'sqlite' : (KB.db && KB.db.usesIndexedDB() ? 'IndexedDB' : 'json'))
      });
    } catch (e) {}
    return moviesCache.slice();
  }

  function loadMovies() {
    if (hasCachedMovies()) return Promise.resolve(moviesCache.slice());

    function applyMovies(rawMovies) {
      return applyMoviesList(rawMovies);
    }

    if (KB.backend && KB.backend.isEnabled()) {
      return KB.backend.getMovies().then(function (list) {
        return applyMovies(list);
      }).catch(function (err) {
        console.error(err);
        return loadMoviesFromLocal();
      });
    }

    return loadMoviesFromLocal().catch(function (err) {
      console.error(err);
      return applyMoviesList(getEmbeddedMovies(), 'embedded');
    });
  }

  function loadMoviesFromLocal() {
    function loadFromJson() {
      var base = getBasePath();
      return loadJson(base + 'data/movies.json').then(function (data) {
        var list = normalizeMoviesList(data.movies || []);
        if (KB.db && KB.db.replaceMovies && list.length && KB.db.usesIndexedDB()) {
          return KB.db.replaceMovies(list).then(function () { return applyMoviesList(list); });
        }
        return applyMoviesList(list);
      }).catch(function () {
        return applyMoviesList(getEmbeddedMovies(), 'embedded');
      });
    }

    if (KB.db && KB.db.getMovies && KB.db.usesIndexedDB()) {
      return KB.db.getMovies().then(function (dbMovies) {
        var list = normalizeMoviesList(dbMovies);
        if (list.length) return applyMoviesList(list);
        return loadFromJson();
      }).catch(function (err) {
        console.error(err);
        return loadFromJson();
      });
    }

    return loadFromJson();
  }

  function loadGenres() {
    if (hasCachedGenres()) return Promise.resolve(genresCache.slice());

    if (KB.backend && KB.backend.isEnabled()) {
      return KB.backend.getGenres().then(function (list) {
        genresCache = (list && list.length) ? list : getEmbeddedGenres();
        return genresCache.slice();
      }).catch(function () {
        return loadGenresFromLocal();
      });
    }

    return loadGenresFromLocal().catch(function () {
      genresCache = getEmbeddedGenres();
      return genresCache.slice();
    });
  }

  function loadGenresFromLocal() {
    function applyGenres(list) {
      genresCache = (list && list.length) ? list.slice() : getEmbeddedGenres();
      return genresCache.slice();
    }

    function loadFromJson() {
      var base = getBasePath();
      return loadJson(base + 'data/genres.json').then(function (data) {
        var list = data.genres || [];
        if (KB.db && KB.db.replaceGenres && list.length && KB.db.usesIndexedDB()) {
          return KB.db.replaceGenres(list).then(function () { return applyGenres(list); });
        }
        return applyGenres(list);
      }).catch(function () {
        return applyGenres(getEmbeddedGenres());
      });
    }

    if (KB.db && KB.db.getGenres && KB.db.usesIndexedDB()) {
      return KB.db.getGenres().then(function (dbGenres) {
        if (dbGenres.length) return applyGenres(dbGenres);
        return loadFromJson();
      }).catch(function () {
        return loadFromJson();
      });
    }

    return loadFromJson();
  }

  function movieGenres(movie) {
    return Array.isArray(movie && movie.genres) ? movie.genres : [];
  }

  KB.api = {
    isHiddenMovie: isHiddenMovie,
    normalizeMovie: normalizeMovie,
    movieGenres: movieGenres,
    loadMovies: loadMovies,
    loadGenres: loadGenres,
    getMovieById: function (id) {
      return loadMovies().then(function (movies) {
        return movies.find(function (m) { return m.id === Number(id); }) || null;
      });
    },
    getGenreName: function (genreId, genres) {
      if (!genres) genres = [];
      var g = genres.find(function (x) { return x.id === genreId; });
      return g ? g.name : genreId;
    },
    getMoviesBySection: function (movies, section) {
      switch (section) {
        case 'popular': return movies.filter(function (m) { return m.popular; }).sort(function (a, b) { return b.rating - a.rating; });
        case 'new': return movies.slice().sort(function (a, b) { return b.year - a.year; }).slice(0, 12);
        case 'trending': return movies.filter(function (m) { return m.trending; });
        case 'top': return movies.slice().sort(function (a, b) { return b.rating - a.rating; }).slice(0, 12);
        case 'action': return movies.filter(function (m) { return movieGenres(m).indexOf('action') !== -1; });
        case 'comedy': return movies.filter(function (m) { return movieGenres(m).indexOf('comedy') !== -1; });
        case 'horror': return movies.filter(function (m) { return movieGenres(m).indexOf('horror') !== -1; });
        case 'scifi': return movies.filter(function (m) { return movieGenres(m).indexOf('scifi') !== -1; });
        case 'drama': return movies.filter(function (m) { return movieGenres(m).indexOf('drama') !== -1; });
        case 'animation': return movies.filter(function (m) { return movieGenres(m).indexOf('animation') !== -1; });
        case 'series': return movies.filter(function (m) { return m.type === 'series' || movieGenres(m).indexOf('series') !== -1; });
        default: return movies;
      }
    },
    searchMovies: function (movies, filters) {
      var q = (filters.query || '').toLowerCase().trim();
      return movies.filter(function (m) {
        var genres = movieGenres(m);
        var matchQuery = !q || m.title.toLowerCase().indexOf(q) !== -1 || genres.some(function (g) { return g.indexOf(q) !== -1; }) || String(m.year).indexOf(q) !== -1;
        return matchQuery && (!filters.genre || genres.indexOf(filters.genre) !== -1) && (!filters.year || m.year === Number(filters.year)) && m.rating >= Number(filters.minRating || 0);
      });
    },
    getSimilarMovies: function (movies, movie, limit) {
      if (limit === undefined) limit = 8;
      return movies.filter(function (m) { return m.id !== movie.id; }).map(function (m) {
        return { movie: m, score: movieGenres(m).filter(function (g) { return movieGenres(movie).indexOf(g) !== -1; }).length };
      }).filter(function (i) { return i.score > 0; }).sort(function (a, b) { return b.score - a.score || b.movie.rating - a.movie.rating; }).slice(0, limit).map(function (i) { return i.movie; });
    },
    saveMovie: function (movie) {
      if (KB.backend && KB.backend.isEnabled()) {
        return KB.backend.saveMovie(movie).then(function () {
          moviesCache = null;
        });
      }
      var overrides = storage.getMoviesOverride();
      var idx = overrides.findIndex(function (m) { return m.id === movie.id; });
      if (idx >= 0) overrides[idx] = movie; else overrides.push(movie);
      storage.setMoviesOverride(overrides);
      if (KB.db && KB.db.saveMovie && KB.db.usesIndexedDB()) {
        KB.db.saveMovie(movie).catch(function () {});
      }
      moviesCache = null;
      return Promise.resolve();
    },
    deleteMovie: function (id) {
      if (KB.backend && KB.backend.isEnabled()) {
        return KB.backend.deleteMovie(id).then(function () {
          moviesCache = null;
        });
      }
      var deleted = storage.getDeletedMovies();
      if (deleted.indexOf(id) === -1) deleted.push(id);
      storage.setDeletedMovies(deleted);
      storage.setMoviesOverride(storage.getMoviesOverride().filter(function (m) { return m.id !== id; }));
      if (KB.db && KB.db.deleteMovie && KB.db.usesIndexedDB()) {
        KB.db.deleteMovie(id).catch(function () {});
      }
      moviesCache = null;
      return Promise.resolve();
    },
    addMovie: function (movie) { return KB.api.saveMovie(movie); },
    resetAdminChanges: function () {
      if (KB.backend && KB.backend.isEnabled()) {
        return KB.backend.resetMovies().then(function () {
          moviesCache = null;
        });
      }
      storage.setMoviesOverride([]);
      storage.setDeletedMovies([]);
      moviesCache = null;
      var base = getBasePath();
      function restoreList(list) {
        var clean = (list || []).filter(function (m) { return !isHiddenMovie(m); });
        if (KB.db && KB.db.replaceMovies && KB.db.usesIndexedDB()) {
          return KB.db.replaceMovies(clean).then(function () { moviesCache = null; });
        }
        moviesCache = null;
        return Promise.resolve();
      }
      return loadJson(base + 'data/movies.json').then(function (data) {
        return restoreList(data.movies || []);
      }).catch(function () {
        var emb = global.KinoBoom_EMBEDDED;
        return restoreList(emb && emb.movies ? emb.movies : []);
      });
    }
  };
})(window);

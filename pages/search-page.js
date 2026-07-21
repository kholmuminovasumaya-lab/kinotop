(function (global) {
  'use strict';
  var KB = global.KinoBoom;
  var U = KB.utils;
  var api = KB.api;

  KB.searchPageInit = function () {
    KB.router.initPage('search');
    U.initScrollTop();
    Promise.all([api.loadMovies(), api.loadGenres()]).then(function (res) {
      KB.search.populateGenreSelect(document.getElementById('search-genre'), res[1]);
      KB.search.initSearchPage(res[0], res[1]);
      U.hidePreloader();
    });
  };
})(window);

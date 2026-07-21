(function (global) {
  'use strict';
  var KB = global.KinoBoom;
  var storage = KB.storage;
  var showToast = KB.utils.showToast;

  function isFavorite(id) {
    return storage.getFavorites().includes(Number(id));
  }

  function toggleFavorite(id, title) {
    if (title === undefined) title = '';
    var numId = Number(id);
    var favorites = storage.getFavorites().slice();
    var exists = favorites.includes(numId);
    if (exists) {
      favorites = favorites.filter(function (f) { return f !== numId; });
      showToast('«' + title + '» удалён из избранного', 'info');
    } else {
      favorites.push(numId);
      showToast('«' + title + '» добавлен в избранное', 'success');
    }
    storage.setFavorites(favorites);
    return !exists;
  }

  KB.favorites = {
    isFavorite: isFavorite,
    toggleFavorite: toggleFavorite,
    getFavoriteMovies: function (all) {
      return storage.getFavorites().map(function (id) { return all.find(function (m) { return m.id === id; }); }).filter(Boolean);
    },
    clearFavorites: function () { storage.setFavorites([]); showToast('Избранное очищено', 'info'); }
  };
})(window);

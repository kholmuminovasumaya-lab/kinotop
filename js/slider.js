(function (global) {
  'use strict';
  var KB = global.KinoBoom;
  var U = KB.utils;
  var createMovieCard = KB.cards.createMovieCard;

  var SECTIONS = [
    { id: 'popular', title: 'Популярное' }, { id: 'new', title: 'Новинки' },
    { id: 'trending', title: 'Сейчас смотрят' }, { id: 'top', title: 'Лучшие' },
    { id: 'action', title: 'Боевики' }, { id: 'comedy', title: 'Комедии' },
    { id: 'horror', title: 'Ужасы' }, { id: 'scifi', title: 'Фантастика' },
    { id: 'drama', title: 'Драмы' }, { id: 'animation', title: 'Мультфильмы' },
    { id: 'series', title: 'Сериалы' }
  ];

  function updateButtons(track, prevBtn, nextBtn) {
    prevBtn.disabled = track.scrollLeft <= 0;
    nextBtn.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 5;
  }

  function createSliderSection(sectionId, title, movies, genres) {
    var section = U.createEl('section', '', 'section');
    section.id = 'section-' + sectionId;
    var header = U.createEl('div', '', 'section__header');
    header.appendChild(U.createEl('h2', title, 'section__title'));
    section.appendChild(header);
    if (!movies.length) return section;
    var slider = U.createEl('div', '', 'slider');
    var track = U.createEl('div', '', 'slider__track');
    movies.forEach(function (m) { track.appendChild(createMovieCard(m, genres)); });
    var prevBtn = U.createEl('button', '‹', 'slider__btn slider__btn--prev');
    var nextBtn = U.createEl('button', '›', 'slider__btn slider__btn--next');
    prevBtn.addEventListener('click', function () { track.scrollBy({ left: -track.clientWidth * 0.75, behavior: 'smooth' }); });
    nextBtn.addEventListener('click', function () { track.scrollBy({ left: track.clientWidth * 0.75, behavior: 'smooth' }); });
    track.addEventListener('scroll', function () { updateButtons(track, prevBtn, nextBtn); }, { passive: true });
    slider.appendChild(prevBtn);
    slider.appendChild(track);
    slider.appendChild(nextBtn);
    section.appendChild(slider);
    requestAnimationFrame(function () { updateButtons(track, prevBtn, nextBtn); });
    return section;
  }

  KB.slider = {
    SECTIONS: SECTIONS,
    createSliderSection: createSliderSection,
    renderAllSections: function (container, allMovies, getBySection, genres) {
      var frag = document.createDocumentFragment();
      var continueList = KB.history.getContinueList(allMovies);
      if (continueList.length) {
        frag.appendChild(createSliderSection('continue', 'Продолжить просмотр', continueList, genres));
      }
      SECTIONS.forEach(function (s) {
        var movies = getBySection(allMovies, s.id);
        if (movies.length) frag.appendChild(createSliderSection(s.id, s.title, movies, genres));
      });
      container.replaceChildren(frag);
    }
  };
})(window);

(function (global) {
  'use strict';
  var KB = global.KinoBoom;
  var U = KB.utils;

  var BRAND = 'KINOTOP';

  var NAV = [
    { href: 'index.html', label: 'Главная', page: 'home' },
    { href: 'pages/search.html', label: 'Поиск', page: 'search' },
    { href: 'pages/favorites.html', label: 'Избранные', page: 'favorites' },
    { href: 'pages/history.html', label: 'История', page: 'history' },
    { href: 'pages/settings.html', label: 'Настройки', page: 'settings' },
    { href: 'admin/', label: 'Админ', page: 'admin' }
  ];

  function renderHeader(activePage) {
    if (activePage === undefined) activePage = 'home';
    var base = U.getBasePath();
    var header = document.querySelector('.header');
    if (!header) return;
    header.innerHTML = '<div class="header__left"><a href="' + base + 'index.html" class="header__logo">' +
      '<img src="' + base + 'assets/logo/logo-boom.png" alt="' + BRAND + '" width="36" height="36" class="header__logo-icon" /><span>' + BRAND + '</span></a>' +
      '<nav class="header__nav" id="main-nav" aria-hidden="true">' +
      '<div class="header__nav-top">' +
      '<a href="' + base + 'index.html" class="header__nav-brand">' +
      '<img src="' + base + 'assets/logo/logo-boom.png" alt="" width="32" height="32" />' +
      '<span>' + BRAND + '</span></a>' +
      '<button type="button" class="header__nav-close" id="nav-close-btn" aria-label="Закрыть меню">&times;</button>' +
      '</div>' +
      '<form class="header__search header__search--mobile" onsubmit="return false;">' +
      '<span class="header__search-icon" aria-hidden="true"></span>' +
      '<input type="search" placeholder="фильмы, сериалы, персоны" /></form>' +
      '<div class="header__nav-links">' +
      NAV.map(function (i) {
        return '<a href="' + base + i.href + '" class="header__nav-link' + (activePage === i.page ? ' header__nav-link--active' : '') + '">' + i.label + '</a>';
      }).join('') +
      '</div>' +
      '<div class="header__nav-foot">' +
      '<a href="' + U.getAdminPath() + '" class="header__nav-foot-link">Админ-панель</a>' +
      '</div></nav></div>' +
      '<div class="header__right"><form class="header__search" onsubmit="return false;" role="search">' +
      '<span class="header__search-icon" aria-hidden="true"></span>' +
      '<input type="search" placeholder="фильмы, сериалы, персоны" aria-label="Поиск: фильмы, сериалы, персоны" /></form>' +
      '<a href="' + base + 'pages/favorites.html" class="header__icon-btn header__icon-btn--text" title="Избранные">Избранные</a>' +
      '<div class="header__auth-wrap" id="header-auth">' + (KB.auth ? KB.auth.getHeaderAuthHtml() : '') + '</div>' +
      '<a href="' + U.getAdminPath() + '" class="header__icon-btn' + (activePage === 'admin' ? ' header__icon-btn--active' : '') + '" title="Админ-панель"><span aria-hidden="true">*</span></a>' +
      '<button class="header__burger" id="burger-btn" aria-label="Меню" aria-expanded="false" aria-controls="main-nav"><span></span><span></span><span></span></button></div>' +
      '<div class="header__nav-backdrop" id="nav-backdrop" hidden></div>';

    window.addEventListener('scroll', function () {
      header.classList.toggle('header--scrolled', window.scrollY > 50);
    }, { passive: true });

    var burger = document.getElementById('burger-btn');
    var nav = document.getElementById('main-nav');
    var backdrop = document.getElementById('nav-backdrop');
    var closeBtn = document.getElementById('nav-close-btn');

    function setNavOpen(open) {
      if (!nav) return;
      nav.classList.toggle('header__nav--open', open);
      nav.setAttribute('aria-hidden', open ? 'false' : 'true');
      if (burger) {
        burger.classList.toggle('header__burger--open', open);
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
      if (backdrop) {
        backdrop.hidden = !open;
        backdrop.classList.toggle('header__nav-backdrop--open', open);
      }
      document.body.classList.toggle('nav-open', open);
    }

    function toggleNav() {
      setNavOpen(!(nav && nav.classList.contains('header__nav--open')));
    }

    if (burger) burger.addEventListener('click', toggleNav);
    if (closeBtn) closeBtn.addEventListener('click', function () { setNavOpen(false); });
    if (backdrop) backdrop.addEventListener('click', function () { setNavOpen(false); });
    nav.querySelectorAll('.header__nav-link, .header__nav-foot-link, .header__nav-brand').forEach(function (link) {
      link.addEventListener('click', function () { setNavOpen(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setNavOpen(false);
    });

    KB.search.initHeaderSearch();
    if (KB.auth && KB.auth.bindHeaderAuth) KB.auth.bindHeaderAuth();
  }

  function renderFooter() {
    var footer = document.querySelector('.footer');
    if (!footer) return;
    footer.innerHTML =
      '<div class="footer__logo">' + BRAND + '</div>' +
      '<p style="margin-top:8px;"><a href="' + U.getAdminPath() + '" style="color:var(--color-text-secondary);font-size:12px;">Админ-панель</a></p>';
  }

  function renderPreloader() {
    if (document.querySelector('.preloader')) return;
    var p = document.createElement('div');
    p.className = 'preloader';
    p.innerHTML = '<div class="preloader__logo">' + BRAND + '</div><div class="preloader__bar"><div class="preloader__bar-fill"></div></div>';
    document.body.prepend(p);
  }

  KB.router = {
    BRAND: BRAND,
    renderHeader: renderHeader,
    renderFooter: renderFooter,
    renderPreloader: renderPreloader,
    initPage: function (activePage) {
      KB.theme.initTheme();
      renderPreloader();
      renderHeader(activePage);
      renderFooter();
      var snowCanvas = document.getElementById('snow-canvas');
      if (snowCanvas) snowCanvas.remove();
    }
  };
})(window);

(function (global) {
  'use strict';
  var KB = global.KinoBoom;
  var U = KB.utils;
  var storage = KB.storage;
  var addToHistory = KB.history.addToHistory;
  var formatTime = U.formatTime;
  var showToast = U.showToast;

  function VideoPlayer(video, controlsContainer, movie) {
    this.video = video;
    this.container = controlsContainer;
    this.movie = movie;
    this.hideTimer = null;
    this.settings = storage.getSettings();
    this.video.playbackRate = this.settings.playbackSpeed || 1;
    this.buildControls();
    this.bindEvents();
    this.startHideTimer();
  }

  VideoPlayer.prototype.buildControls = function () {
    this.progressBar = this.container.querySelector('.player-progress');
    this.bufferedBar = this.container.querySelector('.player-progress__buffered');
    this.playedBar = this.container.querySelector('.player-progress__played');
    this.thumb = this.container.querySelector('.player-progress__thumb');
    this.playBtn = this.container.querySelector('[data-player="play"]');
    this.stopBtn = this.container.querySelector('[data-player="stop"]');
    this.timeCurrent = this.container.querySelector('[data-player="time-current"]');
    this.timeTotal = this.container.querySelector('[data-player="time-total"]');
    this.volumeSlider = this.container.querySelector('[data-player="volume"]');
    this.speedSelect = this.container.querySelector('[data-player="speed"]');
    this.fullscreenBtn = this.container.querySelector('[data-player="fullscreen"]');
    this.pipBtn = this.container.querySelector('[data-player="pip"]');
    this.titleEl = document.querySelector('.player-title');
    this.controlsWrap = this.container;
    if (this.volumeSlider) this.volumeSlider.value = this.video.volume;
    if (this.speedSelect) this.speedSelect.value = String(this.settings.playbackSpeed || 1);
  };

  VideoPlayer.prototype.bindEvents = function () {
    var self = this;
    if (this.playBtn) this.playBtn.addEventListener('click', function () { self.togglePlay(); });
    if (this.stopBtn) this.stopBtn.addEventListener('click', function () { self.stop(); });
    if (this.fullscreenBtn) this.fullscreenBtn.addEventListener('click', function () { self.toggleFullscreen(); });
    if (this.pipBtn) this.pipBtn.addEventListener('click', function () { self.togglePiP(); });
    this.video.addEventListener('click', function () { self.togglePlay(); });
    this.video.addEventListener('dblclick', function () { self.toggleFullscreen(); });
    this.video.addEventListener('timeupdate', function () { self.updateProgress(); });
    this.video.addEventListener('loadedmetadata', function () { self.onLoaded(); });
    this.video.addEventListener('ended', function () { self.onEnded(); });
    if (this.progressBar) this.progressBar.addEventListener('click', function (e) { self.seek(e); });
    if (this.volumeSlider) this.volumeSlider.addEventListener('input', function (e) { self.video.volume = parseFloat(e.target.value); });
    if (this.speedSelect) this.speedSelect.addEventListener('change', function (e) { self.video.playbackRate = parseFloat(e.target.value); });
    var wrapper = this.video.parentElement;
    if (wrapper) {
      wrapper.addEventListener('mousemove', function () { self.showControls(); });
      wrapper.addEventListener('mouseleave', function () { self.startHideTimer(); });
    }
    document.addEventListener('keydown', function (e) { self.handleKeyboard(e); });
  };

  VideoPlayer.prototype.togglePlay = function () {
    var self = this;
    if (this.video.paused) {
      this.video.play().catch(function () { showToast('Не удалось воспроизвести', 'error'); });
      if (this.playBtn) this.playBtn.textContent = '⏸';
    } else {
      this.video.pause();
      if (this.playBtn) this.playBtn.textContent = '▶';
    }
    this.resetHideTimer();
  };

  VideoPlayer.prototype.stop = function () {
    this.video.pause();
    this.video.currentTime = 0;
    if (this.playBtn) this.playBtn.textContent = '▶';
    this.updateProgress();
  };

  VideoPlayer.prototype.toggleFullscreen = function () {
    var wrapper = this.video.parentElement;
    if (!document.fullscreenElement && wrapper && wrapper.requestFullscreen) wrapper.requestFullscreen();
    else if (document.exitFullscreen) document.exitFullscreen();
    this.resetHideTimer();
  };

  VideoPlayer.prototype.togglePiP = function () {
    var self = this;
    if (document.pictureInPictureElement && document.exitPictureInPicture) document.exitPictureInPicture();
    else if (this.video.requestPictureInPicture) this.video.requestPictureInPicture().catch(function () { showToast('PiP недоступен', 'warning'); });
    this.resetHideTimer();
  };

  VideoPlayer.prototype.seek = function (e) {
    var rect = this.progressBar.getBoundingClientRect();
    this.video.currentTime = ((e.clientX - rect.left) / rect.width) * this.video.duration;
    this.updateProgress();
  };

  VideoPlayer.prototype.updateProgress = function () {
    if (!this.video.duration) return;
    var ratio = this.video.currentTime / this.video.duration;
    if (this.playedBar) this.playedBar.style.width = (ratio * 100) + '%';
    if (this.thumb) this.thumb.style.left = (ratio * 100) + '%';
    if (this.timeCurrent) this.timeCurrent.textContent = formatTime(this.video.currentTime);
    if (this.timeTotal) this.timeTotal.textContent = formatTime(this.video.duration);
  };

  VideoPlayer.prototype.onLoaded = function () { this.updateProgress(); };
  VideoPlayer.prototype.onEnded = function () {
    if (this.playBtn) this.playBtn.textContent = '▶';
    addToHistory(this.movie, this.video.duration, 'movie', this.video.duration);
    this.showControls();
  };

  VideoPlayer.prototype.handleKeyboard = function (e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); this.togglePlay(); }
    if (e.key === 'f') this.toggleFullscreen();
    if (e.key === 'ArrowRight') this.video.currentTime = Math.min(this.video.duration, this.video.currentTime + 10);
    if (e.key === 'ArrowLeft') this.video.currentTime = Math.max(0, this.video.currentTime - 10);
    this.resetHideTimer();
  };

  VideoPlayer.prototype.showControls = function () {
    if (this.controlsWrap) this.controlsWrap.classList.remove('player-controls--hidden');
    if (this.titleEl) this.titleEl.classList.remove('player-title--hidden');
    this.resetHideTimer();
  };

  VideoPlayer.prototype.startHideTimer = function () {
    var self = this;
    clearTimeout(this.hideTimer);
    if (!this.video.paused) {
      this.hideTimer = setTimeout(function () {
        if (self.controlsWrap) self.controlsWrap.classList.add('player-controls--hidden');
        if (self.titleEl) self.titleEl.classList.add('player-title--hidden');
      }, 3000);
    }
  };

  VideoPlayer.prototype.resetHideTimer = function () {
    this.showControls();
    this.startHideTimer();
  };

  KB.player = {
    VideoPlayer: VideoPlayer,
    initPlayer: function (movie) {
      var video = document.getElementById('video-player');
      var controls = document.querySelector('.player-controls');
      if (!video || !controls) return null;
      video.src = movie.video;
      video.setAttribute('playsinline', '');
      video.setAttribute('controls', '');
      var titleEl = document.querySelector('.player-title');
      if (titleEl) titleEl.textContent = movie.title;
      var player = new VideoPlayer(video, controls, movie);
      video.addEventListener('play', function () { addToHistory(movie, video.currentTime, 'movie', video.duration); });
      // Автозапуск полного фильма
      setTimeout(function () {
        var p = video.play();
        if (p && typeof p.catch === 'function') p.catch(function () {});
      }, 200);
      return player;
    }
  };
})(window);

/**
 * snow.js — снег снизу вверх
 */
(function (global) {
  'use strict';

  function initSnow() {
    var canvas = document.getElementById('snow-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'snow-canvas';
      canvas.className = 'snow-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      document.body.appendChild(canvas);
    }

    if (canvas.dataset.snowReady === '1') return;
    canvas.dataset.snowReady = '1';
    canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;';

    var ctx = canvas.getContext('2d');
    var flakes = [];
    var count = 90;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    function spawnFlake(spread) {
      var h = canvas.height || window.innerHeight || 600;
      var w = canvas.width || window.innerWidth;
      return {
        x: Math.random() * w,
        y: spread ? h + Math.random() * h : h + Math.random() * 50 + 8,
        r: Math.random() * 2.5 + 1,
        speed: Math.random() * 1.4 + 0.5,
        drift: Math.random() * 0.7 - 0.35,
        opacity: Math.random() * 0.45 + 0.45
      };
    }

    resize();
    for (var i = 0; i < count; i++) flakes.push(spawnFlake(true));

    window.addEventListener('resize', resize);

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      flakes.forEach(function (f) {
        f.y -= f.speed;
        f.x += f.drift;

        if (f.y < -f.r) {
          f.y = canvas.height + Math.random() * 40 + 8;
          f.x = Math.random() * canvas.width;
        }
        if (f.x > canvas.width + 5) f.x = -5;
        if (f.x < -5) f.x = canvas.width + 5;

        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,' + f.opacity + ')';
        ctx.fill();
      });
      requestAnimationFrame(draw);
    }

    draw();
  }

  global.KinoBoom = global.KinoBoom || {};
  global.KinoBoom.snow = { init: initSnow };
})(window);

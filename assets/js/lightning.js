(function () {
  "use strict";

  // Mobile nav toggle
  var toggle = document.getElementById("navToggle");
  var links = document.getElementById("navLinks");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var canvas = document.getElementById("storm-canvas");
  if (!canvas || reduceMotion) return;

  var ctx = canvas.getContext("2d");
  var flash = document.getElementById("flash-overlay");
  var width, height, dpr;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  // Recursive midpoint-displacement lightning bolt.
  function buildBolt(x1, y1, x2, y2, displace, segments) {
    var points = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
    for (var s = 0; s < segments; s++) {
      var next = [points[0]];
      for (var i = 0; i < points.length - 1; i++) {
        var a = points[i], b = points[i + 1];
        var mx = (a.x + b.x) / 2 + (Math.random() - 0.5) * displace;
        var my = (a.y + b.y) / 2 + (Math.random() - 0.5) * displace;
        next.push({ x: mx, y: my });
        next.push(b);
      }
      points = next;
      displace *= 0.55;
    }
    return points;
  }

  function drawBoltPath(points, width, color, blur) {
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
    ctx.restore();
  }

  function spawnBranch(points) {
    if (points.length < 4 || Math.random() > 0.65) return null;
    var idx = 1 + Math.floor(Math.random() * (points.length - 3));
    var start = points[idx];
    var angle = Math.atan2(
      points[idx + 1].y - points[idx - 1].y,
      points[idx + 1].x - points[idx - 1].x
    ) + (Math.random() > 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.5);
    var len = 60 + Math.random() * 120;
    var endX = start.x + Math.cos(angle) * len;
    var endY = start.y + Math.sin(angle) * len;
    return buildBolt(start.x, start.y, endX, endY, len * 0.35, 4);
  }

  var activeStrikes = [];

  function strike() {
    var startX = Math.random() * width;
    var endX = startX + (Math.random() - 0.5) * width * 0.35;
    var endY = height * (0.55 + Math.random() * 0.45);

    var main = buildBolt(startX, 0, endX, endY, width * 0.12, 6);
    var branches = [];
    var branchCount = 1 + Math.floor(Math.random() * 3);
    for (var i = 0; i < branchCount; i++) {
      var b = spawnBranch(main);
      if (b) branches.push(b);
    }

    activeStrikes.push({
      main: main,
      branches: branches,
      born: performance.now(),
      life: 500 + Math.random() * 350,
      flicker: Math.random() > 0.4
    });

    if (flash) {
      flash.style.transitionDuration = "40ms";
      flash.style.opacity = String(0.38 + Math.random() * 0.28);
      setTimeout(function () {
        flash.style.transitionDuration = "320ms";
        flash.style.opacity = "0";
      }, 110 + Math.random() * 100);
    }
  }

  function render(now) {
    ctx.clearRect(0, 0, width, height);

    for (var i = activeStrikes.length - 1; i >= 0; i--) {
      var s = activeStrikes[i];
      var age = now - s.born;
      if (age > s.life) {
        activeStrikes.splice(i, 1);
        continue;
      }
      var t = age / s.life;
      var alpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
      if (s.flicker && Math.random() > 0.85) alpha *= 0.3;
      alpha = Math.max(0, Math.min(1, alpha));

      var core = "rgba(255, 255, 255, " + alpha + ")";
      var glow = "rgba(196, 181, 253, " + Math.min(1, alpha * 0.95) + ")";
      var outerGlow = "rgba(139, 92, 246, " + (alpha * 0.6) + ")";

      drawBoltPath(s.main, 6, outerGlow, 42);
      drawBoltPath(s.main, 3.2, glow, 26);
      drawBoltPath(s.main, 1.8, core, 10);

      s.branches.forEach(function (branch) {
        drawBoltPath(branch, 3.5, outerGlow, 28);
        drawBoltPath(branch, 2, glow, 18);
        drawBoltPath(branch, 1.1, core, 8);
      });
    }

    requestAnimationFrame(render);
  }

  function scheduleNextStrike() {
    var delay = 2200 + Math.random() * 3800;
    setTimeout(function () {
      strike();
      if (Math.random() > 0.6) {
        setTimeout(strike, 90 + Math.random() * 160);
      }
      scheduleNextStrike();
    }, delay);
  }

  requestAnimationFrame(render);
  setTimeout(strike, 900);
  scheduleNextStrike();
})();

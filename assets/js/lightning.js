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

  // Line/word text-curtain splitting for [data-reveal-split] elements (font-safe, resize-safe)
  function buildSplitLine(text) {
    var line = document.createElement("span");
    line.className = "split-line";
    var inner = document.createElement("span");
    inner.className = "split-inner";
    inner.textContent = text;
    line.appendChild(inner);
    return line;
  }

  function splitWords(el) {
    var text = el.dataset.originalText || el.textContent;
    el.dataset.originalText = text;
    var words = text.split(/\s+/).filter(Boolean);
    el.textContent = "";
    words.forEach(function (w, i) {
      var word = buildSplitLine(w);
      word.className = "split-word";
      el.appendChild(word);
      if (i < words.length - 1) el.appendChild(document.createTextNode(" "));
    });
  }

  function splitLines(el) {
    var text = el.dataset.originalText || el.textContent;
    el.dataset.originalText = text;
    var words = text.split(/\s+/).filter(Boolean);
    el.textContent = "";
    var temp = words.map(function (w) {
      var span = document.createElement("span");
      span.textContent = w + " ";
      el.appendChild(span);
      return span;
    });
    var lines = [];
    var lastTop = null;
    temp.forEach(function (span) {
      var top = span.offsetTop;
      if (lastTop === null || Math.abs(top - lastTop) > 4) {
        lines.push([]);
        lastTop = top;
      }
      lines[lines.length - 1].push(span.textContent);
    });
    el.textContent = "";
    lines.forEach(function (lineWords) {
      el.appendChild(buildSplitLine(lineWords.join("").trim()));
    });
  }

  function applyStagger(el, msPerItem) {
    var items = el.querySelectorAll(".split-inner");
    items.forEach(function (item, i) {
      item.style.transitionDelay = Math.min(i, 8) * msPerItem + "ms";
    });
  }

  var splitWordEls = Array.prototype.slice.call(document.querySelectorAll('[data-reveal-split="words"]'));
  var splitLineEls = Array.prototype.slice.call(document.querySelectorAll('[data-reveal-split="lines"]'));

  function runSplits() {
    splitWordEls.forEach(function (el) { splitWords(el); applyStagger(el, 45); });
    splitLineEls.forEach(function (el) { splitLines(el); applyStagger(el, 110); });
  }

  if (splitWordEls.length || splitLineEls.length) {
    runSplits();
    var splitResizeTimer = null;
    window.addEventListener("resize", function () {
      clearTimeout(splitResizeTimer);
      splitResizeTimer = setTimeout(runSplits, 200);
    });
  }

  // Scroll-driven reveal choreography for [data-reveal], [data-reveal-mask] and [data-reveal-split] elements
  var revealEls = document.querySelectorAll("[data-reveal], [data-reveal-mask], [data-reveal-split]");
  if (revealEls.length) {
    if (reduceMotion || !("IntersectionObserver" in window)) {
      revealEls.forEach(function (el) { el.classList.add("reveal-in"); });
    } else {
      var revealObserver = new IntersectionObserver(
        function (entries, obs) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("reveal-in");
              obs.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.2, rootMargin: "0px 0px -60px 0px" }
      );
      revealEls.forEach(function (el, i) {
        el.style.transitionDelay = Math.min(i % 6, 5) * 90 + "ms";
        revealObserver.observe(el);
      });
    }
  }

  // Sigil coin flip
  var sigilWrap = document.querySelector(".sigil-wrap");
  if (sigilWrap && !reduceMotion) {
    sigilWrap.addEventListener("click", function () {
      sigilWrap.classList.remove("is-flipping");
      void sigilWrap.offsetWidth; // restart the animation on repeat clicks
      sigilWrap.classList.add("is-flipping");
    });
    sigilWrap.addEventListener("animationend", function () {
      sigilWrap.classList.remove("is-flipping");
    });
  }

  // Scroll parallax for [data-parallax] elements (transform-only, rAF-throttled).
  // Also drives a --proximity custom property (0..1, peaks when centered) for
  // elements opted into data-parallax-scale / data-parallax-glow.
  var parallaxEls = Array.prototype.slice.call(document.querySelectorAll("[data-parallax]"));
  if (parallaxEls.length && !reduceMotion) {
    var parallaxTicking = false;
    var updateParallax = function () {
      var vh = window.innerHeight;
      parallaxEls.forEach(function (el) {
        var factor = parseFloat(el.getAttribute("data-parallax")) || 0.1;
        var rect = el.getBoundingClientRect();
        var center = rect.top + rect.height / 2;
        var delta = center - vh / 2;
        var offset = delta * factor;
        var proximity = Math.max(0, 1 - Math.abs(delta) / (vh * 0.8));
        var transform = "translateY(" + (-offset).toFixed(2) + "px)";
        if (el.hasAttribute("data-parallax-scale")) {
          var scale = 0.97 + proximity * 0.04;
          transform += " scale(" + scale.toFixed(4) + ")";
        }
        el.style.transform = transform;
        if (el.hasAttribute("data-parallax-glow")) {
          el.style.setProperty("--proximity", proximity.toFixed(3));
        }
      });
      parallaxTicking = false;
    };
    window.addEventListener("scroll", function () {
      if (!parallaxTicking) {
        requestAnimationFrame(updateParallax);
        parallaxTicking = true;
      }
    }, { passive: true });
    updateParallax();
  }

  // Pointer tilt for the cinematic helm frame
  var tiltOuter = document.querySelector(".hierarchy-visual-sticky .bezel-outer.is-square");
  var tiltInner = tiltOuter && tiltOuter.querySelector(".bezel-inner");
  if (tiltOuter && tiltInner && !reduceMotion && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    var maxTilt = 7;
    tiltOuter.addEventListener("pointermove", function (e) {
      var rect = tiltOuter.getBoundingClientRect();
      var px = (e.clientX - rect.left) / rect.width - 0.5;
      var py = (e.clientY - rect.top) / rect.height - 0.5;
      tiltInner.style.transform =
        "rotateY(" + (px * maxTilt).toFixed(2) + "deg) rotateX(" + (-py * maxTilt).toFixed(2) + "deg)";
    });
    tiltOuter.addEventListener("pointerleave", function () {
      tiltInner.style.transform = "rotateY(0deg) rotateX(0deg)";
    });
  }

  // Scrollspy: active nav link + sliding glow indicator
  var navLinksEl = document.getElementById("navLinks");
  var navIndicator = document.querySelector(".nav-indicator");
  var sections = Array.prototype.slice.call(document.querySelectorAll("main > section[id]"));
  if (sections.length && navLinksEl && "IntersectionObserver" in window) {
    var navLinkMap = {};
    navLinksEl.querySelectorAll("a[href^='#']").forEach(function (a) {
      navLinkMap[a.getAttribute("href").slice(1)] = a;
    });

    var moveIndicator = function (link) {
      if (!navIndicator || !link) return;
      var linkRect = link.getBoundingClientRect();
      var listRect = navLinksEl.getBoundingClientRect();
      navIndicator.style.opacity = "1";
      navIndicator.style.width = linkRect.width + "px";
      navIndicator.style.transform = "translateX(" + (linkRect.left - listRect.left).toFixed(2) + "px)";
    };

    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var link = navLinkMap[entry.target.id];
          if (!link) return;
          navLinksEl.querySelectorAll("a").forEach(function (a) { a.classList.remove("is-active"); });
          link.classList.add("is-active");
          moveIndicator(link);
        });
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );
    sections.forEach(function (s) { spy.observe(s); });

    window.addEventListener("resize", function () {
      var active = navLinksEl.querySelector("a.is-active");
      if (active) moveIndicator(active);
    });
  }

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
      flash.style.transitionDuration = "60ms";
      flash.style.opacity = String(0.14 + Math.random() * 0.12);
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

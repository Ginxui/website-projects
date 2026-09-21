import * as THREE from "./vendor/three/three.module.js";
import { EffectComposer } from "./vendor/three/postprocessing/EffectComposer.js";
import { RenderPass } from "./vendor/three/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "./vendor/three/postprocessing/UnrealBloomPass.js";

(function () {
  "use strict";

  var mount = document.getElementById("hero-webgl");
  var heroSection = document.querySelector(".hero");
  if (!mount || !heroSection) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return; // keep the existing CSS/2D-canvas hero as the static fallback
  if (window.innerWidth < 700) return; // skip the heavier WebGL scene on small/low-power devices

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: mount,
      alpha: true,
      antialias: true,
      powerPreference: "low-power"
    });
  } catch (e) {
    return; // WebGL unavailable — fall back to the existing hero silently
  }
  if (!renderer) return;

  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  // ---------- Volumetric storm backdrop (full-screen fbm shader) ----------
  var stormUniforms = {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) }
  };

  var stormMaterial = new THREE.ShaderMaterial({
    uniforms: stormUniforms,
    depthWrite: false,
    vertexShader: [
      "varying vec2 vUv;",
      "void main() {",
      "  vUv = uv;",
      "  gl_Position = vec4(position.xy, 0.0, 1.0);",
      "}"
    ].join("\n"),
    fragmentShader: [
      "precision highp float;",
      "varying vec2 vUv;",
      "uniform float uTime;",
      "uniform vec2 uResolution;",
      "",
      "vec2 hash(vec2 p) {",
      "  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));",
      "  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);",
      "}",
      "",
      "float noise(vec2 p) {",
      "  const float K1 = 0.366025404;",
      "  const float K2 = 0.211324865;",
      "  vec2 i = floor(p + (p.x + p.y) * K1);",
      "  vec2 a = p - i + (i.x + i.y) * K2;",
      "  vec2 o = (a.x > a.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);",
      "  vec2 b = a - o + K2;",
      "  vec2 c = a - 1.0 + 2.0 * K2;",
      "  vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);",
      "  vec3 n = h * h * h * h * vec3(dot(a, hash(i)), dot(b, hash(i + o)), dot(c, hash(i + 1.0)));",
      "  return dot(n, vec3(70.0));",
      "}",
      "",
      "float fbm(vec2 p) {",
      "  float v = 0.0;",
      "  float a = 0.5;",
      "  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);",
      "  for (int i = 0; i < 6; i++) {",
      "    v += a * noise(p);",
      "    p = rot * p * 2.0 + 4.2;",
      "    a *= 0.5;",
      "  }",
      "  return v;",
      "}",
      "",
      "void main() {",
      "  vec2 uv = vUv;",
      "  vec2 aspectUv = (uv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0) + 0.5;",
      "  float t = uTime * 0.035;",
      "",
      "  vec2 warpedP = aspectUv * 2.2 + vec2(t * 0.6, t * 0.25);",
      "  vec2 warp = vec2(fbm(warpedP), fbm(warpedP + 5.2));",
      "  float clouds = fbm(warpedP + warp * 1.1);",
      "",
      "  vec3 voidCol = vec3(0.006, 0.003, 0.014);",
      "  vec3 deepPurple = vec3(0.05, 0.02, 0.11);",
      "  vec3 midPurple = vec3(0.16, 0.075, 0.32);",
      "  vec3 emberOrange = vec3(0.7, 0.3, 0.08);",
      "",
      "  float cloudMix = smoothstep(0.15, 0.7, clouds);",
      "  vec3 col = mix(voidCol, deepPurple, cloudMix);",
      "  col = mix(col, midPurple, smoothstep(0.55, 0.98, clouds) * 0.55);",
      "",
      "  float ember = pow(max(fbm(warpedP * 1.7 - vec2(t * 1.1, 0.0)), 0.0), 6.0);",
      "  col += emberOrange * ember * 0.4;",
      "",
      "  float vgn = distance(uv, vec2(0.5, 0.42));",
      "  col *= 1.0 - smoothstep(0.25, 0.85, vgn);",
      "  col *= 0.85;",
      "",
      "  gl_FragColor = vec4(col, 1.0);",
      "}"
    ].join("\n")
  });

  var backdrop = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), stormMaterial);
  backdrop.frustumCulled = false;
  backdrop.renderOrder = -1;
  scene.add(backdrop);

  // ---------- The house sword, painted into the storm as a soft-edged presence ----------
  var swordGroup = new THREE.Group();
  swordGroup.position.set(2.35, -0.25, -1.2);
  swordGroup.rotation.set(0, -0.22, 0.04);
  scene.add(swordGroup);

  var swordUniforms = {
    uMap: { value: null },
    uReveal: { value: 0 }
  };

  var swordMaterial = new THREE.ShaderMaterial({
    uniforms: swordUniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: [
      "varying vec2 vUv;",
      "void main() {",
      "  vUv = uv;",
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
      "}"
    ].join("\n"),
    fragmentShader: [
      "precision highp float;",
      "varying vec2 vUv;",
      "uniform sampler2D uMap;",
      "uniform float uReveal;",
      "",
      "void main() {",
      "  vec4 tex = texture2D(uMap, vUv);",
      "  vec3 col = tex.rgb * vec3(0.85, 0.85, 0.98);",
      "  float lift = smoothstep(0.55, 1.0, max(tex.r, max(tex.g, tex.b)));",
      "  col += lift * vec3(0.16, 0.09, 0.3);",
      "  float fade = smoothstep(0.0, 0.14, vUv.y) * smoothstep(1.0, 0.86, vUv.y);",
      "  gl_FragColor = vec4(col, tex.a * 0.88 * fade * uReveal);",
      "}"
    ].join("\n")
  });

  var swordAspect = 292 / 1011;
  var swordHeight = 9.6;
  var swordMesh = new THREE.Mesh(new THREE.PlaneGeometry(swordHeight * swordAspect, swordHeight), swordMaterial);
  swordGroup.add(swordMesh);

  new THREE.TextureLoader().load("assets/images/dondarrion-sword.webp", function (tex) {
    tex.colorSpace = THREE.SRGBColorSpace;
    swordUniforms.uMap.value = tex;
  });

  // ---------- Procedural 3D lightning bolts ----------
  var boltGroup = new THREE.Group();
  scene.add(boltGroup);
  var activeBolts = [];

  function midpointDisplace3D(a, b, displace, segments) {
    var points = [a, b];
    for (var s = 0; s < segments; s++) {
      var next = [points[0]];
      for (var i = 0; i < points.length - 1; i++) {
        var p1 = points[i], p2 = points[i + 1];
        var mid = new THREE.Vector3(
          (p1.x + p2.x) / 2 + (Math.random() - 0.5) * displace,
          (p1.y + p2.y) / 2 + (Math.random() - 0.5) * displace,
          (p1.z + p2.z) / 2 + (Math.random() - 0.5) * displace * 0.4
        );
        next.push(mid, p2);
      }
      points = next;
      displace *= 0.55;
    }
    return points;
  }

  function spawnBolt() {
    var startX = (Math.random() - 0.5) * 9;
    var start = new THREE.Vector3(startX, 4.2, (Math.random() - 0.5) * 2);
    var end = new THREE.Vector3(
      startX + (Math.random() - 0.5) * 3.2,
      -2.5 - Math.random() * 1.5,
      (Math.random() - 0.5) * 2
    );
    var points = midpointDisplace3D(start, end, 2.2, 5);

    var geometry = new THREE.BufferGeometry().setFromPoints(points);
    var material = new THREE.LineBasicMaterial({
      color: Math.random() > 0.5 ? 0xc4b5fd : 0xf5f3ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending
    });
    var line = new THREE.Line(geometry, material);
    boltGroup.add(line);
    activeBolts.push({ line: line, born: performance.now(), life: 420 + Math.random() * 260 });
  }

  function scheduleNextBolt() {
    var delay = 2600 + Math.random() * 4200;
    setTimeout(function () {
      spawnBolt();
      scheduleNextBolt();
    }, delay);
  }

  // ---------- Composer / bloom ----------
  var effectComposer = new EffectComposer(renderer);
  effectComposer.addPass(new RenderPass(scene, camera));
  var bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.85, 0.6, 0.15);
  effectComposer.addPass(bloomPass);

  // ---------- Sizing ----------
  function resize() {
    var rect = heroSection.getBoundingClientRect();
    var w = Math.max(1, rect.width);
    var h = Math.max(1, rect.height);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    effectComposer.setSize(w, h);
    stormUniforms.uResolution.value.set(w, h);
  }
  window.addEventListener("resize", resize);
  resize();

  // ---------- Subtle pointer parallax on the camera ----------
  var pointerX = 0, pointerY = 0;
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    window.addEventListener("pointermove", function (e) {
      pointerX = (e.clientX / window.innerWidth - 0.5) * 2;
      pointerY = (e.clientY / window.innerHeight - 0.5) * 2;
    });
  }

  // ---------- Only render while the hero is visible ----------
  var isVisible = true;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      function (entries) { isVisible = entries[0].isIntersecting; },
      { threshold: 0 }
    ).observe(heroSection);
  }

  var timer = new THREE.Timer();

  function animate(timestamp) {
    requestAnimationFrame(animate);
    if (!isVisible) return;

    timer.update(timestamp);
    stormUniforms.uTime.value = timer.getElapsed();

    camera.position.x += (pointerX * 0.6 - camera.position.x) * 0.02;
    camera.position.y += (-pointerY * 0.4 - camera.position.y) * 0.02;
    camera.lookAt(0, 0, 0);

    if (swordUniforms.uMap.value && swordUniforms.uReveal.value < 1) {
      swordUniforms.uReveal.value = Math.min(1, swordUniforms.uReveal.value + 0.012);
    }
    var targetRotY = -0.22 + pointerX * 0.1;
    var targetRotX = pointerY * 0.06;
    swordGroup.rotation.y += (targetRotY - swordGroup.rotation.y) * 0.03;
    swordGroup.rotation.x += (targetRotX - swordGroup.rotation.x) * 0.03;

    var now = performance.now();
    for (var i = activeBolts.length - 1; i >= 0; i--) {
      var b = activeBolts[i];
      var age = now - b.born;
      if (age > b.life) {
        boltGroup.remove(b.line);
        b.line.geometry.dispose();
        b.line.material.dispose();
        activeBolts.splice(i, 1);
        continue;
      }
      var t = age / b.life;
      var alpha = t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88;
      b.line.material.opacity = Math.max(0, alpha);
    }

    effectComposer.render();
  }

  requestAnimationFrame(animate);
  requestAnimationFrame(function () { mount.classList.add("is-ready"); });
  setTimeout(spawnBolt, 1200);
  scheduleNextBolt();
})();

// src/scripts/starfield.ts
// WebGL warp-speed starfield. Loaded via dynamic import from
// StarfieldHero.astro only when the theme is dark and motion is allowed.
// Named three imports keep the chunk tree-shakeable.

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  LineBasicMaterial,
  LineSegments,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from 'three';

const PAUSE_SCROLL_FACTOR = 1.5;

export function startStarfield(canvas: HTMLCanvasElement): { stop(): void } {
  // -------------------------------------------------------------------------
  // Particle count - reduce on low-end devices
  // -------------------------------------------------------------------------
  const isLowEnd =
    typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;

  const PARTICLE_COUNT = isLowEnd ? 1200 : 3000;

  // -------------------------------------------------------------------------
  // Constants
  // -------------------------------------------------------------------------
  const SPREAD_XY = 800;
  const Z_NEAR = 0;
  const Z_FAR = -2000;
  const CRUISE_SPEED = 14; // units per frame at 60 fps equivalent
  const BOOT_DURATION_MS = 800;

  // -------------------------------------------------------------------------
  // Renderer, scene, camera
  // -------------------------------------------------------------------------
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 1);

  const scene = new Scene();
  const camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 3000);
  camera.position.set(0, 0, 0);

  // -------------------------------------------------------------------------
  // Particle data arrays
  // -------------------------------------------------------------------------
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const prevPositions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);

  const colorWhite = new Color(0xf0f0f0);
  const colorGreen = new Color(0x22c55e);
  const colorPink = new Color(0xec4899);

  function randomXY(): [number, number] {
    return [(Math.random() - 0.5) * 2 * SPREAD_XY, (Math.random() - 0.5) * 2 * SPREAD_XY];
  }

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const [x, y] = randomXY();
    const z = Math.random() * (Z_NEAR - Z_FAR) + Z_FAR;

    const idx = i * 3;
    positions[idx] = x;
    positions[idx + 1] = y;
    positions[idx + 2] = z;

    prevPositions[idx] = x;
    prevPositions[idx + 1] = y;
    prevPositions[idx + 2] = z;

    const rand = Math.random();
    let col: Color;
    if (rand < 0.8) {
      col = colorWhite;
    } else if (rand < 0.95) {
      col = colorGreen;
    } else {
      col = colorPink;
    }
    colors[idx] = col.r;
    colors[idx + 1] = col.g;
    colors[idx + 2] = col.b;
  }

  // -------------------------------------------------------------------------
  // Points geometry + custom shader material
  // -------------------------------------------------------------------------
  const pointsGeo = new BufferGeometry();
  const posAttr = new BufferAttribute(positions, 3);
  posAttr.setUsage(DynamicDrawUsage);
  pointsGeo.setAttribute('position', posAttr);

  const colorAttr = new BufferAttribute(colors, 3);
  pointsGeo.setAttribute('color', colorAttr);

  const vertexShader = /* glsl */ `
    attribute vec3 color;
    varying vec3 vColor;

    void main() {
      vColor = color;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

      float depth = clamp(1.0 + position.z / 2000.0, 0.0, 1.0);
      float size = mix(0.8, 5.0, depth * depth);

      gl_PointSize = size * (300.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = /* glsl */ `
    varying vec3 vColor;

    void main() {
      vec2 uv = gl_PointCoord - vec2(0.5);
      float d = length(uv);
      if (d > 0.5) discard;
      float alpha = smoothstep(0.5, 0.1, d);
      gl_FragColor = vec4(vColor, alpha);
    }
  `;

  const pointsMat = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    vertexColors: false,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });

  const points = new Points(pointsGeo, pointsMat);
  scene.add(points);

  // -------------------------------------------------------------------------
  // Line streaks geometry
  // -------------------------------------------------------------------------
  const linePositions = new Float32Array(PARTICLE_COUNT * 6);
  const lineColors = new Float32Array(PARTICLE_COUNT * 6);

  const lineGeo = new BufferGeometry();
  const linePosAttr = new BufferAttribute(linePositions, 3);
  linePosAttr.setUsage(DynamicDrawUsage);
  lineGeo.setAttribute('position', linePosAttr);

  const lineColorAttr = new BufferAttribute(lineColors, 3);
  lineColorAttr.setUsage(DynamicDrawUsage);
  lineGeo.setAttribute('color', lineColorAttr);

  const lineMat = new LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.5,
    blending: AdditiveBlending,
    depthWrite: false,
  });

  const lineSegments = new LineSegments(lineGeo, lineMat);
  scene.add(lineSegments);

  // -------------------------------------------------------------------------
  // Run state: pause RAF when the canvas is effectively invisible
  // (light theme, hidden tab, or scrolled past 1.5 viewports).
  // -------------------------------------------------------------------------
  const bootStartTime = performance.now();
  let currentSpeed = 0;

  let scrollY = window.scrollY;
  let smoothScrollFactor = 1.0;
  let rafId = 0;
  let paused = false;
  let stopped = false;
  let lastTime = performance.now();

  function isVisible(): boolean {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    return (
      !isLight &&
      !document.hidden &&
      scrollY <= window.innerHeight * PAUSE_SCROLL_FACTOR
    );
  }

  function easeInCubic(t: number): number {
    return t * t * t;
  }

  function animate(now: number): void {
    if (stopped) return;

    if (!isVisible()) {
      // Render one static frame, then stop scheduling frames.
      paused = true;
      renderer.render(scene, camera);
      return;
    }

    const delta = Math.min((now - lastTime) / 16.667, 3);
    lastTime = now;

    const elapsed = now - bootStartTime;
    if (elapsed < BOOT_DURATION_MS) {
      const t = elapsed / BOOT_DURATION_MS;
      currentSpeed = easeInCubic(t) * CRUISE_SPEED;
    } else {
      currentSpeed = CRUISE_SPEED;
    }

    const viewportHeight = window.innerHeight;
    const scrollRatio = Math.min(scrollY / viewportHeight, 1.0);
    const targetScrollFactor = scrollRatio >= 1.0 ? 0.3 : 1.0 - scrollRatio * 0.7;
    smoothScrollFactor += (targetScrollFactor - smoothScrollFactor) * 0.08;

    const targetOpacity = scrollRatio >= 1.0 ? 0.3 : 1.0 - scrollRatio * 0.7;
    canvas.style.opacity = String(Math.max(0.3, targetOpacity));

    const frameSpeed = currentSpeed * smoothScrollFactor * delta;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const idx = i * 3;

      prevPositions[idx] = positions[idx];
      prevPositions[idx + 1] = positions[idx + 1];
      prevPositions[idx + 2] = positions[idx + 2];

      positions[idx + 2] += frameSpeed;

      if (positions[idx + 2] > Z_NEAR) {
        const [x, y] = randomXY();
        positions[idx] = x;
        positions[idx + 1] = y;
        positions[idx + 2] = Z_FAR;

        prevPositions[idx] = x;
        prevPositions[idx + 1] = y;
        prevPositions[idx + 2] = Z_FAR;
      }

      const lineIdx = i * 6;
      const curZ = positions[idx + 2];

      const nearness = Math.max(0, (curZ - Z_FAR) / -Z_FAR);
      const trailScale = nearness > 0.75 ? 2.5 : 1.0;

      const trailZ = prevPositions[idx + 2] - frameSpeed * (trailScale - 1.0);
      linePositions[lineIdx] = prevPositions[idx];
      linePositions[lineIdx + 1] = prevPositions[idx + 1];
      linePositions[lineIdx + 2] = trailZ;

      linePositions[lineIdx + 3] = positions[idx];
      linePositions[lineIdx + 4] = positions[idx + 1];
      linePositions[lineIdx + 5] = curZ;

      const dimFactor = nearness * 0.6;
      lineColors[lineIdx] = colors[idx] * dimFactor;
      lineColors[lineIdx + 1] = colors[idx + 1] * dimFactor;
      lineColors[lineIdx + 2] = colors[idx + 2] * dimFactor;

      lineColors[lineIdx + 3] = colors[idx] * nearness;
      lineColors[lineIdx + 4] = colors[idx + 1] * nearness;
      lineColors[lineIdx + 5] = colors[idx + 2] * nearness;
    }

    posAttr.needsUpdate = true;
    linePosAttr.needsUpdate = true;
    lineColorAttr.needsUpdate = true;

    renderer.render(scene, camera);

    rafId = requestAnimationFrame(animate);
  }

  function resumeIfVisible(): void {
    if (stopped || !paused || !isVisible()) return;
    paused = false;
    lastTime = performance.now();
    rafId = requestAnimationFrame(animate);
  }

  function onScroll(): void {
    scrollY = window.scrollY;
    resumeIfVisible();
  }

  function onVisibilityChange(): void {
    resumeIfVisible();
  }

  const themeObserver = new MutationObserver(() => {
    resumeIfVisible();
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('visibilitychange', onVisibilityChange);

  // -------------------------------------------------------------------------
  // Resize handling (debounced)
  // -------------------------------------------------------------------------
  let resizeTimer: ReturnType<typeof setTimeout>;

  function onResize(): void {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }, 150);
  }

  window.addEventListener('resize', onResize, { passive: true });

  rafId = requestAnimationFrame(animate);

  return {
    stop(): void {
      stopped = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      themeObserver.disconnect();
      pointsGeo.dispose();
      lineGeo.dispose();
      pointsMat.dispose();
      lineMat.dispose();
      renderer.dispose();
    },
  };
}

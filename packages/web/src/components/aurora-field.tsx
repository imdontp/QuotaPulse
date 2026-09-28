import { useEffect, useMemo, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

/**
 * The moving layer behind the Live quota stage.
 *
 * Everything here is a function of measured throughput (`intensity`), not a timer, so the
 * background is doing a job: a busy afternoon looks busier than a quiet one because the
 * field is genuinely reacting to how much is happening. An idle dashboard at intensity 0
 * still shows a finished composition -- reduced motion is a rendering choice here, not a
 * punishment, and every screenshot this project commits is captured with it set.
 *
 * Three things keep it cheap enough to sit behind a page that repaints every second or so:
 * the soft blobs are painted once into offscreen sprites and blitted, particles are flat
 * arcs, and the device pixel ratio is capped. The loop is also torn down whenever the tab
 * is hidden, which is most of the time for a dashboard people leave open.
 */

/** Offscreen sprite edge, in CSS pixels. Blobs are scaled up from here when drawn. */
const SPRITE = 192;
/** Retina beyond 2x costs fill rate and shows nothing extra on a blurred blob. */
const DPR_CAP = 2;
const PARTICLES = 44;

interface Blob {
  /** 0-1 across the element. */
  x: number;
  y: number;
  /** Radius as a fraction of the smaller element dimension. */
  r: number;
  /** CSS custom property to tint the sprite with. */
  token: string;
  /** Parallax and travel speed, 0-1. */
  depth: number;
  phase: number;
}

interface Particle {
  x: number;
  y: number;
  r: number;
  depth: number;
  phase: number;
}

interface Field {
  blobs: Blob[];
  particles: Particle[];
}

/**
 * Seeded so the composition is byte-identical on every mount, in both themes, and across
 * the sixteen screenshot runs. `Math.random` would make every capture a different picture
 * and make a real regression impossible to spot by eye.
 */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TOKENS = ['--brand', '--brand-2', '--chart-7', '--brand'] as const;

/**
 * One blob per quadrant, jittered. The earlier version derived position from the blob's
 * index parity, which put two of the four in the same corner; with additive compositing
 * that corner glowed roughly twice as bright as the rest and pulled the eye onto empty
 * space. Four distinct anchors, slightly varied, keeps the field even.
 */
const ANCHORS: ReadonlyArray<readonly [number, number]> = [
  [0.2, 0.24],
  [0.8, 0.19],
  [0.17, 0.8],
  [0.81, 0.77],
];

function buildField(): Field {
  const rand = mulberry32(0x5170);
  const blobs: Blob[] = ANCHORS.map(([ax, ay], i) => ({
    x: ax + (rand() - 0.5) * 0.1,
    y: ay + (rand() - 0.5) * 0.1,
    r: 0.46 + rand() * 0.2,
    token: TOKENS[i % TOKENS.length]!,
    depth: 0.3 + rand() * 0.7,
    phase: rand() * Math.PI * 2,
  }));
  const particles: Particle[] = Array.from({ length: PARTICLES }, () => {
    const depth = 0.2 + rand() * 0.8;
    return {
      x: rand(),
      y: rand(),
      r: 0.5 + depth * 1.6,
      depth,
      phase: rand() * Math.PI * 2,
    };
  });
  return { blobs, particles };
}

/**
 * Canvas only understands colours it can parse, and this app's palette is OKLCH custom
 * properties. One reusable probe element resolves a token to a concrete `rgb()` per theme,
 * rather than hoping the browser's canvas parser keeps up with CSS Color 4.
 */
function useTokenResolver(): (token: string) => string {
  const probe = useRef<HTMLSpanElement | null>(null);
  const cache = useRef(new Map<string, string>());
  return useMemo(() => {
    const resolve = (token: string): string => {
      const hit = cache.current.get(token);
      if (hit) return hit;
      let value = token;
      if (typeof document !== 'undefined') {
        let el = probe.current;
        if (!el) {
          el = document.createElement('span');
          el.setAttribute('aria-hidden', 'true');
          el.style.cssText = 'position:absolute;width:0;height:0;opacity:0;pointer-events:none';
          document.body.appendChild(el);
          probe.current = el;
        }
        el.style.color = `var(${token})`;
        const computed = getComputedStyle(el).color;
        // An unresolved var() comes back as the inherited colour, which would paint the
        // whole field a single flat tint. Keep the token so the browser can try it.
        if (computed && computed !== 'rgb(0, 0, 0)') value = computed;
        else value = token;
      }
      cache.current.set(token, value);
      return value;
    };
    return resolve;
  }, []);
}

function paintBlob(ctx: CanvasRenderingContext2D, color: string): HTMLCanvasElement | null {
  const sprite = document.createElement('canvas');
  sprite.width = SPRITE;
  sprite.height = SPRITE;
  const sctx = sprite.getContext('2d');
  if (!sctx) return null;
  const half = SPRITE / 2;
  const gradient = sctx.createRadialGradient(half, half, 0, half, half, half);
  // A long flat core reads as a hard-edged disc once composited additively, so the colour
  // is held briefly and then given most of the sprite to fall away across.
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.18, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  sctx.globalAlpha = 1;
  sctx.fillStyle = gradient;
  // Two flat passes: a canvas gradient interpolates toward transparent-black, which
  // darkens the edge of a light blob instead of fading it out.
  sctx.globalCompositeOperation = 'source-over';
  sctx.fillRect(0, 0, SPRITE, SPRITE);
  return sprite;
}

export function AuroraField({ intensity, className }: { intensity: number; className?: string }) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const intensityRef = useRef(intensity);
  const resolve = useTokenResolver();
  const reduced = useReducedMotion();
  const field = useMemo(buildField, []);

  useEffect(() => {
    intensityRef.current = intensity;
  }, [intensity]);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let frame = 0;
    let running = true;
    let paints = 0;
    let sprites: Array<HTMLCanvasElement | null> = [];

    const measure = () => {
      const rect = el.getBoundingClientRect();
      // A collapsed or not-yet-laid-out element reports 0; a 0-sized backing store would
      // throw in the browser and take the page's error budget with it.
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);
      el.width = Math.round(width * dpr);
      el.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const buildSprites = () => {
      sprites = field.blobs.map((blob) => paintBlob(ctx, resolve(blob.token)));
    };

    const draw = (time: number) => {
      if (width <= 1 || height <= 1) return;
      const level = Math.max(0, Math.min(1, intensityRef.current));
      const base = Math.min(width, height);
      const t = reduced ? 0 : time / 1000;

      ctx.clearRect(0, 0, width, height);
      // Additive, so overlapping blobs brighten into a horizon instead of muddying.
      ctx.globalCompositeOperation = 'lighter';

      field.blobs.forEach((blob, index) => {
        const sprite = sprites[index];
        if (!sprite) return;
        // Slow enough to read as weather rather than a screensaver.
        const drift = Math.sin(t * 0.11 * blob.depth + blob.phase);
        const rise = Math.cos(t * 0.083 * blob.depth + blob.phase * 1.3);
        const radius = base * blob.r * (0.92 + level * 0.12);
        const x = (blob.x + drift * 0.05) * width - radius;
        const y = (blob.y + rise * 0.05) * height - radius;
        ctx.globalAlpha = 0.1 + level * 0.13;
        ctx.drawImage(sprite, x, y, radius * 2, radius * 2);
      });

      field.particles.forEach((particle) => {
        const travel = reduced ? 0 : t * 0.008 * particle.depth;
        // Wrap vertically so a long session never runs the field out of stars.
        const y = ((particle.y - travel) % 1 + 1) % 1;
        const x = (particle.x + Math.sin(t * 0.05 * particle.depth + particle.phase) * 0.012 + 1) % 1;
        ctx.globalAlpha = 0.06 + particle.depth * 0.1 + level * 0.06;
        ctx.beginPath();
        ctx.arc(x * width, y * height, particle.r, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
      });

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    };

    const loop = (time: number) => {
      if (!running) return;
      draw(time);
      // A count of real paints, because a frame-rate measurement taken with rAF measures
      // the browser's vsync rather than this loop -- it reports a healthy 60fps whether or
      // not a single pixel was drawn. Scripts compare this attribute across a scroll to
      // show the loop actually stopped.
      el.dataset.frames = String(++paints);
      frame = requestAnimationFrame(loop);
    };

    /*
     * Two independent reasons to stop, because a dashboard people leave open all day is the
     * normal case, not the exception. `document.hidden` catches the tab being in the
     * background. The intersection check catches the common one: the hero is off the top of
     * the screen for most of a session, and animating a field nobody can see is pure waste.
     */
    const hidden = { tab: false, offscreen: false };
    const sync = () => {
      const shouldRun = !hidden.tab && !hidden.offscreen;
      if (shouldRun === running) return;
      running = shouldRun;
      if (shouldRun && !reduced) frame = requestAnimationFrame(loop);
      else cancelAnimationFrame(frame);
    };

    const observer = new MutationObserver(() => {
      buildSprites();
      if (reduced) draw(0);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    const resize = new ResizeObserver(() => {
      measure();
      if (reduced) draw(0);
    });
    resize.observe(el);

    // An intersection observer is the only way to know the hero is off screen; a scroll
    // listener would fire on every other section too.
    const seen = new IntersectionObserver(
      ([entry]) => {
        hidden.offscreen = !entry?.isIntersecting;
        sync();
      },
      { rootMargin: '80px' },
    );
    seen.observe(el);

    const onVisibility = () => {
      hidden.tab = document.hidden;
      sync();
    };

    measure();
    buildSprites();

    if (reduced) {
      // One frame, then nothing. `intensity` still changes the still image.
      draw(0);
    } else {
      running = true;
      frame = requestAnimationFrame(loop);
      document.addEventListener('visibilitychange', onVisibility);
    }

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
      seen.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [field, reduced, resolve]);

  return <canvas ref={canvas} aria-hidden="true" data-aurora="true" className={cn('pointer-events-none absolute inset-0 size-full', className)} />;
}

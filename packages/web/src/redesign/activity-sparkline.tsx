import { useId, useLayoutEffect, useRef, type PointerEvent } from 'react';

interface ActivityPoint {
  at: number;
  value: number;
}

const HEIGHT = 12;

/** Native-size bitmap; every straight segment represents the supplied minute buckets. */
export function ActivitySparkline({ points, label, language }: {
  points: readonly ActivityPoint[];
  label: string;
  language: 'en' | 'th';
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const descriptionId = useId();
  const locale = language === 'th' ? 'th-TH' : 'en-US';
  const stamp = (at: number) => new Date(at).toLocaleString(locale);
  const number = (value: number) => value.toLocaleString(locale);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.title = label;

    const draw = () => {
      const width = canvas.getBoundingClientRect().width;
      const dpr = window.devicePixelRatio || 1;
      const bitmapWidth = Math.max(1, Math.round(width * dpr));
      const bitmapHeight = Math.max(1, Math.round(HEIGHT * dpr));
      if (canvas.width !== bitmapWidth) canvas.width = bitmapWidth;
      if (canvas.height !== bitmapHeight) canvas.height = bitmapHeight;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, bitmapWidth, bitmapHeight);
      if (width <= 0 || points.length === 0) return;

      // Keep fractional layout width while fitting the bitmap to the actual device pixels.
      context.setTransform(bitmapWidth / width, 0, 0, bitmapHeight / HEIGHT, 0, 0);
      context.globalAlpha = 1;
      context.shadowColor = 'transparent';
      context.shadowBlur = 0;
      const accent = getComputedStyle(canvas).getPropertyValue('--qp-accent').trim();
      const light = canvas.closest('.qp-redesign')?.getAttribute('data-theme') === 'light';
      const maximum = points.reduce((value, point) => Number.isFinite(point.value) ? Math.max(value, point.value) : value, 0);
      const from = points.reduce((value, point) => Number.isFinite(point.at) ? Math.min(value, point.at) : value, Infinity);
      const to = points.reduce((value, point) => Number.isFinite(point.at) ? Math.max(value, point.at) : value, -Infinity);
      const margin = Math.min(width / 2, Math.max(1, width * .008));
      const x = (point: ActivityPoint) => to > from ? margin + (width - margin * 2) * (point.at - from) / (to - from) : width / 2;
      const y = (point: ActivityPoint) => HEIGHT - 1 - (HEIGHT - 2) * point.value / (maximum || 1);
      const valid = (point: ActivityPoint) => Number.isFinite(point.at) && Number.isFinite(point.value);

      // Fill only contiguous real buckets; invalid input never bridges a missing segment.
      const gradient = context.createLinearGradient(0, 1, 0, HEIGHT - 1);
      gradient.addColorStop(0, accent || 'transparent');
      gradient.addColorStop(1, 'transparent');
      context.fillStyle = gradient;
      context.globalAlpha = .28;
      let start = 0;
      while (start < points.length) {
        while (start < points.length && !valid(points[start])) start++;
        let end = start;
        while (end < points.length && valid(points[end])) end++;
        if (end - start > 1) {
          context.beginPath();
          context.moveTo(x(points[start]), HEIGHT - 1);
          for (let index = start; index < end; index++) context.lineTo(x(points[index]), y(points[index]));
          context.lineTo(x(points[end - 1]), HEIGHT - 1);
          context.closePath();
          context.fill();
        }
        start = end + 1;
      }

      context.globalAlpha = 1;
      context.strokeStyle = accent || 'transparent';
      context.fillStyle = accent || 'transparent';
      context.lineWidth = 2;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.shadowColor = light ? 'transparent' : accent || 'transparent';
      context.shadowBlur = light ? 0 : 1.5 * bitmapHeight / HEIGHT;
      context.beginPath();
      let connected = false;
      for (const point of points) {
        if (!valid(point)) {
          connected = false;
          continue;
        }
        if (connected) context.lineTo(x(point), y(point));
        else context.moveTo(x(point), y(point));
        connected = true;
      }
      context.stroke();
      if (points.length === 1 && valid(points[0])) {
        context.beginPath();
        context.arc(x(points[0]), y(points[0]), 1, 0, Math.PI * 2);
        context.fill();
      }
    };

    draw();
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(draw);
    resizeObserver?.observe(canvas);
    const themeRoot = canvas.closest('.qp-redesign');
    const themeObserver = themeRoot ? new MutationObserver(draw) : null;
    if (themeRoot) themeObserver?.observe(themeRoot, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
    window.addEventListener('resize', draw);

    // Moving between displays can change DPR without changing the CSS chart size.
    let resolution: MediaQueryList | null = null;
    const watchResolution = () => {
      resolution?.removeEventListener('change', onResolutionChange);
      if (typeof window.matchMedia !== 'function') return;
      resolution = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      resolution.addEventListener('change', onResolutionChange);
    };
    const onResolutionChange = () => {
      watchResolution();
      draw();
    };
    watchResolution();

    return () => {
      resizeObserver?.disconnect();
      themeObserver?.disconnect();
      resolution?.removeEventListener('change', onResolutionChange);
      window.removeEventListener('resize', draw);
    };
  }, [points, label, language]);

  const pointTitle = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rectangle = canvas.getBoundingClientRect();
    if (points.length === 0 || rectangle.width <= 0) {
      canvas.title = label;
      return;
    }
    const from = points.reduce((value, point) => Number.isFinite(point.at) ? Math.min(value, point.at) : value, Infinity);
    const to = points.reduce((value, point) => Number.isFinite(point.at) ? Math.max(value, point.at) : value, -Infinity);
    const margin = Math.min(rectangle.width / 2, Math.max(1, rectangle.width * .008));
    const fraction = Math.max(0, Math.min(1, (event.clientX - rectangle.left - margin) / Math.max(1, rectangle.width - margin * 2)));
    const at = from + fraction * (to - from);
    let nearest: ActivityPoint | undefined;
    for (const point of points) {
      if (!Number.isFinite(point.at) || !Number.isFinite(point.value)) continue;
      if (!nearest || Math.abs(point.at - at) < Math.abs(nearest.at - at)) nearest = point;
    }
    canvas.title = nearest ? `${label} · ${stamp(nearest.at)} · ${number(nearest.value)}` : label;
  };

  return <><canvas ref={canvasRef} className="qp-activity-sparkline" role="img" aria-label={label} aria-describedby={descriptionId} title={label}
    onPointerMove={pointTitle} onPointerLeave={event => { event.currentTarget.title = label; }}>{label}</canvas>
    <ol id={descriptionId} className="qp-visually-hidden" aria-label={label}>{points.map((point, index) => <li key={`${point.at}-${index}`} data-at={point.at} data-value={point.value}>
      <time dateTime={Number.isFinite(new Date(point.at).getTime()) ? new Date(point.at).toISOString() : undefined}>{stamp(point.at)}</time>{' · '}{number(point.value)}
    </li>)}</ol>
  </>;
}

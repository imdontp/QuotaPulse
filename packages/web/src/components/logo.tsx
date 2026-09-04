import { useId } from 'react';
import { cn } from '@/lib/utils';

/*
 * The QuotaPulse mark: a quota ring broken at the top right, a column chart inside it, and
 * a filled dot sitting in the break. Ring = the limit, bars = what has been spent against
 * it, dot = the reading is live. It is the same three ideas the dashboard is about, which
 * is why the tab carries this rather than a generic chart glyph.
 *
 * Everything is drawn with strokes rather than filled shapes so the mark survives being
 * scaled down; the ring is an explicit arc rather than a dashed circle because dashoffset
 * moves the gap when the stroke width changes, and the gap has to stay under the dot.
 *
 * The gradient reads var(--brand) and var(--brand-2), so it follows the theme toggle
 * instead of pinning the light theme to a colour picked for a dark background.
 */
export function QuotaPulseMark({ className }: { className?: string }) {
  /*
   * An SVG gradient id is document-global. Two marks on one page sharing a literal id
   * means the second one resolves to the first one's gradient, and if the first unmounts
   * the survivor paints black. useId is per-instance, so each mark owns its own.
   */
  const gid = useId().replace(/:/g, '');
  const grad = `qp-brand-${gid}`;

  return (
    <svg
      viewBox="0 0 32 32"
      className={cn('size-[18px]', className)}
      role="img"
      aria-label="QuotaPulse"
      fill="none"
    >
      <title>QuotaPulse</title>
      <defs>
        {/*
         * Bottom left to top right, so the sweep runs uphill into the live dot.
         *
         * userSpaceOnUse is REQUIRED here, not a preference. A gradient defaults to
         * objectBoundingBox, which resolves against each element that references it, and
         * every bar below is a vertical line whose bounding box is zero pixels wide. An
         * objectBoundingBox gradient on a degenerate box is undefined, so the browser
         * dropped all four bars and painted only the ring and the dot: the mark rendered
         * as a bare circle, silently, with nothing in the console. Coordinates are in
         * viewBox units, which also makes the sweep continuous across the whole mark
         * instead of restarting inside every sub-shape.
         */}
        <linearGradient id={grad} gradientUnits="userSpaceOnUse" x1="4" y1="28" x2="28" y2="4">
          <stop offset="0%" stopColor="var(--brand-2)" />
          <stop offset="100%" stopColor="var(--brand)" />
        </linearGradient>
      </defs>

      <g stroke={`url(#${grad})`} strokeLinecap="round">
        {/* 317 degrees, counter-clockwise from just past the break round to just before it. */}
        <path d="M20.495 4.874 A12 12 0 1 0 26.876 10.929" strokeWidth="2.75" />
        <g strokeWidth="2.2">
          <path d="M11.3 21.5 V18.2" />
          <path d="M14.4 21.5 V14.6" />
          <path d="M17.5 21.5 V16.4" />
          <path d="M20.6 21.5 V11.8" />
        </g>
      </g>
      <circle cx="24.26" cy="7.296" r="2.75" fill={`url(#${grad})`} />
    </svg>
  );
}

/**
 * The horizontal lockup from the brand sheet. "Pulse" carries the brand colour so the
 * wordmark still reads as the logo when the mark is too small to make out, which is the
 * case in the collapsed sidebar and the 460px tray popup.
 */
export function QuotaPulseWordmark({ className }: { className?: string }) {
  return (
    <span className={cn('text-[15px] font-semibold tracking-tight', className)}>
      Quota<span className="text-brand">Pulse</span>
    </span>
  );
}

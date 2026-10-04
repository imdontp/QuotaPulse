import { cloneElement, type ReactElement, type SVGProps } from 'react';
import './section-mark.css';

/** Decorative panel identity; the surrounding heading retains its accessible name. */
export function SectionMark({ icon, size = 34, tone = 'blue' }: {
  icon: ReactElement<SVGProps<SVGSVGElement>>;
  size?: 20 | 28 | 34;
  tone?: 'blue' | 'warm';
}) {
  return <i className="qp-section-mark" data-size={size} data-tone={tone} aria-hidden="true">
    {cloneElement(icon, { 'aria-hidden': true, focusable: 'false' })}
  </i>;
}

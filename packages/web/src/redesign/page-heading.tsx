import { cloneElement, type ReactElement, type SVGProps } from 'react';
import './page-heading.css';

/** A page identity; the framed mark is decorative and the title stays a single h1. */
export function PageHeading({ icon, title, subtitle, compact = false }: {
  icon: ReactElement<SVGProps<SVGSVGElement>>;
  title: string;
  subtitle: string;
  compact?: boolean;
}) {
  return <div className={`qp-page-heading qp-page-heading-framed${compact ? ' qp-page-heading-compact' : ''}`}>
    <i className="qp-page-heading-icon" aria-hidden="true">{cloneElement(icon, { 'aria-hidden': true, focusable: 'false' })}</i>
    <div className="qp-page-heading-copy"><h1>{title}</h1><p>{subtitle}</p></div>
  </div>;
}

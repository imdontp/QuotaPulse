import { useId, type SVGProps } from 'react';
import { Activity, BarChart3, BellRing, Box, Cloud } from 'lucide-react';

/** Decorative native heading artwork; the existing Lucide paths remain the fallback. */
export function HeadingReferenceIcon({ kind, ...props }: SVGProps<SVGSVGElement> & { kind: 'live' | 'models' | 'alerts' | 'cost' | 'providers' }) {
  const liveDotId = `qp-heading-live-dot-${useId().replace(/:/g, '')}`;
  const Fallback = kind === 'providers' ? Cloud : kind === 'cost' ? BarChart3 : kind === 'live' ? Activity : kind === 'models' ? Box : BellRing;
  return <Fallback size={24} {...props} className={`qp-heading-reference-svg qp-heading-reference-svg--${kind}`} aria-hidden="true" focusable="false">
    <g className="qp-heading-reference-mark">
      {kind === 'live' ? <>
        <defs><radialGradient id={liveDotId}><stop stopColor="#a3efff"/><stop offset="1" stopColor="#19aaff"/></radialGradient></defs>
        <circle cx="12" cy="12" r="4.15" fill="currentColor" stroke="none"/>
        <circle cx="12" cy="12" r="1.55" fill="#08162c" stroke="none"/>
        {[[12,4],[17.6,6.4],[20,12.5],[18.3,18],[12,19.5],[6.9,18],[5.1,12.5],[6.4,6.5]].map(([cx,cy],i)=><circle key={i} cx={cx} cy={cy} r={i===5||i===0||i===2?1.05:1.3} fill={`url(#${liveDotId})`} stroke="none"/>)}
      </> : kind === 'models' ? <>
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
        <path d="m3.3 7 8.7 5 8.7-5 M12 22V12"/>
      </> : kind === 'providers' ? <>
        <path d="M6 20h12a4 4 0 0 0 .7-7.94A6.5 6.5 0 0 0 6 10a5 5 0 0 0 0 10Z"/>
      </> : kind === 'alerts' ? <>
        <path d="M10.6 4V2.7a1.4 1.4 0 0 1 2.8 0V4 M18 10a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21a2 2 0 0 0 4 0"/>
      </> : <>
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </>}
    </g>
  </Fallback>;
}

import { useId } from 'react';

/** Static decorative rings; forecast values are rendered separately as real text. */
export function ForecastOrbArt() {
  const upperPaint = `qp-forecast-upper-${useId().replace(/:/g, '')}`;
  return <svg className="qp-alert-reference-ring" viewBox="0 0 170 170" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={upperPaint} gradientUnits="userSpaceOnUse" x1="14" y1="85" x2="85" y2="14">
        <stop stopColor="#b456f7"/><stop offset=".48" stopColor="#8560fb"/><stop offset="1" stopColor="#557dff"/>
      </linearGradient>
    </defs>
    <circle cx="85" cy="85" r="82" fill="none" stroke="#00d6fa" strokeWidth="9" strokeLinecap="round" pathLength="360" transform="rotate(-90 85 85)" strokeDasharray="65 360" strokeDashoffset="0" style={{ filter: 'drop-shadow(0 0 2px #00d6fa88)' }}/>
    <circle cx="85" cy="85" r="71" fill="none" stroke={`url(#${upperPaint})`} strokeWidth="9" strokeLinecap="butt" pathLength="360" transform="rotate(-90 85 85)" strokeDasharray="86 360" strokeDashoffset="-274" style={{ filter: 'drop-shadow(0 0 2px #6780fc88)' }}/>
    <circle cx="85" cy="85" r="82" fill="none" stroke="#e541c8" strokeWidth="9" strokeLinecap="butt" pathLength="360" transform="rotate(-90 85 85)" strokeDasharray="40 360" strokeDashoffset="-236" style={{ filter: 'drop-shadow(0 0 2px #e541c888)' }}/>
    <circle cx="85" cy="85" r="82" fill="none" stroke="#03d6c8" strokeWidth="9" strokeLinecap="butt" pathLength="360" transform="rotate(-90 85 85)" strokeDasharray="43 360" strokeDashoffset="-187" style={{ filter: 'drop-shadow(0 0 2px #03d6c888)' }}/>
    <circle cx="85" cy="85" r="82" fill="none" stroke="#8c49ff" strokeWidth="9" strokeLinecap="butt" pathLength="360" transform="rotate(-90 85 85)" strokeDasharray="60 360" strokeDashoffset="-121" style={{ filter: 'drop-shadow(0 0 2px #8c49ff88)' }}/>
  </svg>;
}

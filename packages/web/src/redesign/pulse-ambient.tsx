import { useId } from 'react';

const WIDTH = 760;
const HEIGHT = 320;
const waves = [
  { amplitude: 18, cycles: 4.1, phase: .3, offset: 7, width: .8, opacity: .55 },
  { amplitude: 26, cycles: 3.2, phase: 1.2, offset: -4, width: 1.1, opacity: .8 },
  { amplitude: 32, cycles: 2.7, phase: 2.4, offset: 4, width: .9, opacity: .65 },
  { amplitude: 39, cycles: 2.2, phase: 3.1, offset: -7, width: .7, opacity: .38 },
  { amplitude: 22, cycles: 3.7, phase: 4.2, offset: 11, width: 1.2, opacity: .7 },
  { amplitude: 31, cycles: 2.9, phase: 5.3, offset: -3, width: .8, opacity: .5 },
] as const;

type AmbientWave = typeof waves[number];

const waveY = (wave: AmbientWave, x: number) => HEIGHT / 2 + wave.offset + wave.amplitude * Math.sin(x / WIDTH * Math.PI * 2 * wave.cycles + wave.phase);

/** Cubic segments follow a fixed sine curve; this artwork does not encode usage. */
function wavePath(wave: AmbientWave): string {
  const step = WIDTH / 64;
  const omega = Math.PI * 2 * wave.cycles / WIDTH;
  const slope = (x: number) => wave.amplitude * omega * Math.cos(omega * x + wave.phase);
  const n = (value: number) => value.toFixed(3);
  let path = `M 0 ${n(waveY(wave, 0))}`;
  for (let index = 1; index <= 64; index++) {
    const x = index * step;
    const previous = x - step;
    path += ` C ${n(previous + step / 3)} ${n(waveY(wave, previous) + slope(previous) * step / 3)}, ${n(x - step / 3)} ${n(waveY(wave, x) - slope(x) * step / 3)}, ${n(x)} ${n(waveY(wave, x))}`;
  }
  return path;
}

const junctions = [
  { x: 172, wave: 1, color: '#43dfff' },
  { x: 223, wave: 2, color: '#52d9ff' },
  { x: 594, wave: 4, color: '#b683ff' },
  { x: 619, wave: 5, color: '#cb9aff' },
] as const;

/** Static decoration behind Pulse Core; no account state, chart values or live-flow signal. */
export function PulseAmbient() {
  const id = useId().replace(/:/g, '');
  return <svg className="qp-pulse-ambient" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width={WIDTH} height={HEIGHT}
    aria-hidden="true" focusable="false" preserveAspectRatio="none" style={{ pointerEvents: 'none' }}>
    <defs>
      <linearGradient id={`${id}-waves`} x1="0" y1="0" x2={WIDTH} y2="0" gradientUnits="userSpaceOnUse">
        <stop stopColor="#16c9ff" stopOpacity="0"/>
        <stop offset=".12" stopColor="#16c9ff" stopOpacity=".9"/>
        <stop offset=".36" stopColor="#1cbeff"/>
        <stop offset=".56" stopColor="#3976ff"/>
        <stop offset=".79" stopColor="#ab61ff"/>
        <stop offset=".85" stopColor="#ad68ff" stopOpacity="0"/>
        <stop offset="1" stopColor="#ab61ff" stopOpacity="0"/>
      </linearGradient>
      <radialGradient id={`${id}-atmosphere`}>
        <stop stopColor="#125dba" stopOpacity=".13"/>
        <stop offset=".65" stopColor="#083a71" stopOpacity=".06"/>
        <stop offset="1" stopColor="#083a71" stopOpacity="0"/>
      </radialGradient>
      <filter id={`${id}-soft-glow`} x="-15%" y="-60%" width="130%" height="220%">
        <feGaussianBlur stdDeviation="1.6"/>
        <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id={`${id}-star-glow`} x="-200%" y="-200%" width="500%" height="500%">
        <feGaussianBlur stdDeviation="2"/>
        <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <ellipse cx="375" cy="160" rx="305" ry="136" fill={`url(#${id}-atmosphere)`}/>
    <g fill="#258acf">{Array.from({ length: 58 }, (_, index) => <circle key={index}
      cx={64 + index * 137.508 % 550} cy={42 + index * 71.31 % 236}
      r={index % 7 === 0 ? .7 : .4} opacity={.12 + index % 5 * .045}/>)}</g>
    <g fill="none" stroke={`url(#${id}-waves)`} strokeLinecap="round" filter={`url(#${id}-soft-glow)`}>
      {waves.map((wave, index) => <path key={index} d={wavePath(wave)} strokeWidth={wave.width} opacity={wave.opacity}/>)}
    </g>
    <g filter={`url(#${id}-star-glow)`}>{junctions.map(({ x, wave, color }) => {
      const y = waveY(waves[wave], x);
      return <g key={x} fill={color} stroke={color}>
        <circle cx={x} cy={y} r="2.2" stroke="none"/>
        <circle cx={x} cy={y} r=".65" fill="#eefaff" stroke="none"/>
        <path d={`M ${x - 4} ${y} H ${x + 4} M ${x} ${y - 4} V ${y + 4}`} fill="none" strokeWidth=".65" opacity=".7"/>
      </g>;
    })}</g>
  </svg>;
}

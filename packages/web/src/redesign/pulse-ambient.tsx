import { useId } from 'react';
import { referenceJunctionY, referenceWavePaths } from './pulse-ambient-reference';

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

// Decorative reference arcs: these never represent a quota or usage series.
const referenceOrbits = [
  { side: 'left', path: 'M 120 167 C 139 134, 154 69, 190 84 C 207 82, 226 95, 245 119', star: [214, 85], x: 0, y: 0, opacity: .75 },
  { side: 'left', path: 'M 124 189 C 145 231, 161 258, 201 259 C 220 259, 237 247, 249 227', star: [224, 257], x: -3, y: 0, opacity: .45 },
  { side: 'right', path: 'M 487 109 C 501 82, 507 67, 517 67 C 548 66, 570 82, 586 115 C 600 143, 611 157, 629 165', star: [517, 67], x: 0, y: 3, opacity: .75 },
  { side: 'right', path: 'M 490 212 C 506 239, 527 247, 551 225 C 575 205, 594 178, 629 173', star: [529, 239], x: 0, y: 3, opacity: 1 },
] as const;

/** Static decoration behind Pulse Core; no account state, chart values or live-flow signal. */
export function PulseAmbient({ reference = false }: { reference?: boolean }) {
  const id = useId().replace(/:/g, '');
  return <svg className="qp-pulse-ambient" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width={WIDTH} height={HEIGHT}
    data-reference-art={reference || undefined} aria-hidden="true" focusable="false" preserveAspectRatio="none" style={{ pointerEvents: 'none' }}>
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
      {reference && <>
        <linearGradient id={`${id}-orbit-left`} x1="110" y1="0" x2="250" y2="0" gradientUnits="userSpaceOnUse"><stop stopColor="#16c9ff" stopOpacity="0"/><stop offset=".38" stopColor="#16c9ff" stopOpacity=".85"/><stop offset="1" stopColor="#248fff" stopOpacity=".25"/></linearGradient>
        <linearGradient id={`${id}-orbit-right`} x1="480" y1="0" x2="630" y2="0" gradientUnits="userSpaceOnUse"><stop stopColor="#b663ff" stopOpacity=".25"/><stop offset=".32" stopColor="#c183ff" stopOpacity=".85"/><stop offset="1" stopColor="#a761ff" stopOpacity="0"/></linearGradient>
      </>}
    </defs>
    <ellipse cx="375" cy="160" rx="305" ry="136" fill={`url(#${id}-atmosphere)`}/>
    <g fill="#258acf">{Array.from({ length: 58 }, (_, index) => <circle key={index}
      cx={64 + index * 137.508 % 550} cy={42 + index * 71.31 % 236}
      r={index % 7 === 0 ? .7 : .4} opacity={.12 + index % 5 * .045}/>)}</g>
    <g fill="none" stroke={`url(#${id}-waves)`} strokeLinecap="round" filter={`url(#${id}-soft-glow)`}>
      {waves.map((wave, index) => <path key={index} d={reference ? referenceWavePaths[index] : wavePath(wave)} strokeWidth={wave.width} opacity={wave.opacity}/>)}
    </g>
    {reference && <g data-reference-orbits>{referenceOrbits.map(({ side, path, star, x, y, opacity }, index) => <g key={index} transform={`translate(${x},${y})`} opacity={opacity}>
      <path d={path} fill="none" stroke={`url(#${id}-orbit-${side})`} strokeLinecap="round" strokeWidth="1.1" strokeDasharray="1.1 3.2" opacity=".9"/>
      <g filter={`url(#${id}-star-glow)`}><circle fill={side === 'left' ? '#46dfff' : '#c993ff'} cx={star[0]} cy={star[1]} r="2.3"/><circle fill="#f4f8ff" cx={star[0]} cy={star[1]} r=".7"/></g>
    </g>)}</g>}
    <g filter={`url(#${id}-star-glow)`}>{junctions.map(({ x, wave, color }, index) => {
      const y = reference ? referenceJunctionY[index] : waveY(waves[wave], x);
      return <g key={x} fill={color} stroke={color}>
        <circle cx={x} cy={y} r="2.2" stroke="none"/>
        <circle cx={x} cy={y} r=".65" fill="#eefaff" stroke="none"/>
        <path d={`M ${x - 4} ${y} H ${x + 4} M ${x} ${y - 4} V ${y + 4}`} fill="none" strokeWidth=".65" opacity=".7"/>
      </g>;
    })}</g>
  </svg>;
}

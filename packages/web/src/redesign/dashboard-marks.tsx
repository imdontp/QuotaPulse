import { useId } from 'react';
import { HarnessIcon, type HarnessIconProps } from '@/components/harness-icon';
import { VendorIcon } from '@/components/vendor-icon';
import { cn } from '@/lib/utils';
import { dashboardGlyphs } from './dashboard-mark-glyphs';

const harnessPaint = {
  hermes: { top: '#07dfac', bottom: '#04aa82', rim: '#58f3ce', ink: '#00382c' },
  codex: { top: '#7933e9', bottom: '#481694', rim: '#ac75f5', ink: '#eee5ff' },
  'claude-code': { top: '#f4a060', bottom: '#dc7d43', rim: '#ffbb81', ink: '#2c1b16' },
  opencode: { top: '#418df5', bottom: '#1c5bb7', rim: '#76b5ff', ink: '#b5dbff' },
} as const;

/** Production dashboard glyphs follow the blueprint's tool-specific badges. */
export function DashboardHarnessIcon(props: HarnessIconProps) {
  const id = useId().replace(/:/g, '');
  if (!Object.hasOwn(harnessPaint, props.harness)) return <HarnessIcon {...props}/>;
  const key = props.harness as keyof typeof harnessPaint;
  const paint = harnessPaint[key];
  return <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false" data-dashboard-harness={key}
    className={cn('inline-block size-[1em] shrink-0', props.className)}>
    <defs><linearGradient id={`${id}-plate`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={paint.top}/><stop offset="1" stopColor={paint.bottom}/></linearGradient></defs>
    <rect x="1" y="1" width="22" height="22" rx="4" fill={`url(#${id}-plate)`} stroke={paint.rim} strokeWidth=".65"/>
    {key === 'opencode' ? <><rect x="5" y="5" width="14" height="14" rx="4" fill="#062854" stroke="#609ef2" strokeWidth="1.2"/><circle cx="12" cy="12" r="4" fill="#194679" stroke={paint.ink} strokeWidth="1.4"/></>
      : <path d={dashboardGlyphs[key]} fill={paint.ink} fillRule="evenodd"/>}
  </svg>;
}

/** Subscription artwork is selected by the recorded subscription identity. */
export function SubscriptionMark({ vendor, framed = true, className }: { vendor: string; framed?: boolean; className?: string }) {
  const id = useId().replace(/:/g, '');
  if (vendor.toLowerCase() !== 'opencode') return <VendorIcon vendor={vendor} className={className}/>;
  return <svg viewBox="0 0 32 32" width="1em" height="1em" aria-hidden="true" focusable="false" data-subscription-mark="opencode" className={cn('inline-block size-[1em] shrink-0', className)}>
    {framed && <><defs><linearGradient id={`${id}-subscription`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#7432f2"/><stop offset="1" stopColor="#4c1eab"/></linearGradient></defs><rect x=".6" y=".6" width="30.8" height="30.8" rx="6" fill={`url(#${id}-subscription)`} stroke="#9b6df1" strokeWidth=".7"/></>}
    <path d={dashboardGlyphs.subscription} fill="#f4efff" fillRule="evenodd"/>
  </svg>;
}

import { VendorIcon, type VendorIconProps } from '@/components/vendor-icon';
import { cn } from '@/lib/utils';

/** Company identity in recorded-provider fields; model/product marks stay separate. */
export function ProviderMark({ vendor, className, label, mono, ...rest }: VendorIconProps) {
  if (vendor !== 'anthropic') return <VendorIcon vendor={vendor} className={className} label={label} mono={mono} {...rest}/>;
  return <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" focusable="false"
    className={cn('inline-block size-[1em] shrink-0', className)} {...rest} data-provider-mark="anthropic">
    <path fillRule="evenodd" d="M1 20 8.1 4h4.1l7.1 16h-4.1l-1.4-3.4H6.4L5 20H1Zm6.8-6.8h4.6L10.1 7.7l-2.3 5.5ZM20 4h3v16h-3V4Z"/>
  </svg>;
}

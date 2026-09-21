import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Info, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CURRENCIES, useI18n, type CurrencyCode, type Lang } from '@/i18n';
import { cn } from '@/lib/utils';

const LANGS: Array<{ id: Lang; label: string }> = [
  { id: 'en', label: 'English' },
  { id: 'th', label: 'Thai' },
];

/**
 * Language and display currency stay available as quick preferences. Persistent runtime,
 * subscription, notification and pricing controls live on the full Settings page.
 */
export function SettingsMenu({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const { lang, currency, rate, setLang, setCurrency, setRate, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(String(rate));
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => setDraft(String(rate)), [rate]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const panel = ref.current?.querySelector<HTMLElement>('[role="dialog"]');
    panel?.querySelector<HTMLElement>('button, input')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        ref.current?.querySelector('button')?.focus();
      }
      if (e.key === 'Tab' && panel) {
        const controls = [...panel.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select, [tabindex="0"]')];
        const first = controls[0];
        const last = controls.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const commitRate = () => {
    const n = Number(draft.replace(/,/g, ''));
    if (Number.isFinite(n) && n > 0) setRate(n);
    else setDraft(String(rate));
  };

  return (
    <div className="relative" ref={ref}>
      <Button
        size="sm"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={t('settings.title')}
        className="text-muted-foreground gap-1.5"
      >
        <Settings className="size-[14px]" />
        <span className="hidden font-medium uppercase sm:inline">{lang}</span>
        {currency !== 'USD' && <span className="text-muted-foreground/70">{CURRENCIES[currency].symbol}</span>}
      </Button>

      {open && (
        <div role="dialog" aria-label={t('settings.title')} className="bg-popover text-popover-foreground absolute right-0 z-50 mt-1.5 w-72 max-w-[calc(100vw-5rem)] max-h-[75vh] overflow-y-auto rounded-xl border p-4 shadow-xl">
          <div className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wider uppercase">
            {t('settings.title')}
          </div>

          <div className="mb-3">
            <div className="text-muted-foreground mb-1.5 text-[11.5px]">{t('settings.language')}</div>
            <div className="grid grid-cols-2 gap-1">
              {LANGS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setLang(l.id)}
                  className={cn(
                    'rounded-md border px-2 py-1.5 text-[12.5px] transition-colors',
                    lang === l.id
                      ? 'border-foreground/25 bg-secondary font-medium'
                      : 'text-muted-foreground hover:bg-accent/60',
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <div className="text-muted-foreground mb-1.5 text-[11.5px]">{t('settings.currency')}</div>
            <div className="grid grid-cols-2 gap-1">
              {(Object.keys(CURRENCIES) as CurrencyCode[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={cn(
                    'rounded-md border px-2 py-1.5 text-[12.5px] transition-colors',
                    currency === c
                      ? 'border-foreground/25 bg-secondary font-medium'
                      : 'text-muted-foreground hover:bg-accent/60',
                  )}
                >
                  {CURRENCIES[c].symbol} {c}
                </button>
              ))}
            </div>
          </div>

          {currency !== 'USD' && (
            <div className="mb-2">
              <div className="text-muted-foreground mb-1.5 text-[11.5px]">{t('settings.rate')}</div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-[12.5px] whitespace-nowrap">{t('settings.ratePerUsd')}</span>
                <span className="text-[12.5px]">{CURRENCIES[currency].symbol}</span>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commitRate}
                  onKeyDown={(e) => e.key === 'Enter' && commitRate()}
                  inputMode="decimal"
                  aria-label={t('settings.rate')}
                  className="border-input bg-card focus-visible:ring-ring/40 tabular h-7 w-20 rounded-md border px-2 text-right font-mono text-[12.5px] outline-none focus-visible:ring-[3px]"
                />
              </div>
            </div>
          )}

          <div className="mt-3 border-t pt-3">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenSettings?.();
              }}
              className="border-input bg-card hover:bg-accent/60 flex w-full items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[12px] transition-colors"
            >
              <ArrowUpRight className="size-3" />
              {t('settings.openPage')}
            </button>
          </div>

          <p className="text-muted-foreground/70 mt-2 flex gap-1.5 text-[11px] leading-relaxed">
            <Info className="mt-px size-3 shrink-0" />
            {t('settings.rateHelp')}
          </p>
        </div>
      )}
    </div>
  );
}

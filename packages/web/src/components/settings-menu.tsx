import { useEffect, useRef, useState } from 'react';
import { Languages, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CURRENCIES, useI18n, type CurrencyCode, type Lang } from '@/i18n';
import { cn } from '@/lib/utils';

const LANGS: Array<{ id: Lang; label: string }> = [
  { id: 'en', label: 'English' },
  { id: 'th', label: 'ไทย' },
];

/**
 * Language, currency and the exchange rate in one popover. They live together because
 * they are one decision: the rate only matters once a non-USD currency is chosen, and
 * choosing Thai is the usual reason to want baht.
 */
export function SettingsMenu() {
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
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
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
        className="text-muted-foreground gap-1.5"
      >
        <Languages className="size-[14px]" />
        <span className="font-medium uppercase">{lang}</span>
        {currency !== 'USD' && (
          <span className="text-muted-foreground/70">{CURRENCIES[currency].symbol}</span>
        )}
      </Button>

      {open && (
        <div className="bg-popover text-popover-foreground absolute right-0 z-50 mt-1.5 w-72 rounded-lg border p-3 shadow-md">
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
                <span className="text-muted-foreground text-[12.5px] whitespace-nowrap">
                  {t('settings.ratePerUsd')}
                </span>
                <span className="text-[12.5px]">{CURRENCIES[currency].symbol}</span>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commitRate}
                  onKeyDown={(e) => e.key === 'Enter' && commitRate()}
                  inputMode="decimal"
                  className="border-input bg-card focus-visible:ring-ring/40 tabular h-7 w-20 rounded-md border px-2 text-right font-mono text-[12.5px] outline-none focus-visible:ring-[3px]"
                />
              </div>
            </div>
          )}

          {/* The rate is the user's own number, and every converted figure on the page
              depends on it. Saying so here is the difference between a display setting
              and a claim about money. */}
          <p className="text-muted-foreground/70 mt-2 flex gap-1.5 text-[11px] leading-relaxed">
            <Info className="mt-px size-3 shrink-0" />
            {t('settings.rateHelp')}
          </p>
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Settings, Info } from 'lucide-react';
import type { SubscriptionStatus } from '@/api';
import { api, type NotificationSettings } from '@/api';
import { Button } from '@/components/ui/button';
import { CURRENCIES, useI18n, type CurrencyCode, type Lang } from '@/i18n';
import { cn } from '@/lib/utils';

const LANGS: Array<{ id: Lang; label: string }> = [
  { id: 'en', label: 'English' },
  { id: 'th', label: 'ไทย' },
];

/**
 * Language, currency, exchange rate and subscription visibility in one popover. They live
 * together because they are lightweight display preferences rather than provider settings.
 */
export function SettingsMenu({ subscriptions = [] }: { subscriptions?: SubscriptionStatus[] }) {
  const {
    lang,
    currency,
    rate,
    hiddenSubscriptions,
    setLang,
    setCurrency,
    setRate,
    setSubscriptionVisible,
    t,
  } = useI18n();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(String(rate));
  const [notifications, setNotifications] = useState<NotificationSettings | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => setDraft(String(rate)), [rate]);

  useEffect(() => {
    if (!open) return;
    void api.notificationSettings().then(setNotifications).catch(() => undefined);
  }, [open]);

  const updateNotifications = (patch: Partial<NotificationSettings>) => {
    setNotifications((current) => current ? { ...current, ...patch } : current);
    void api.updateNotificationSettings(patch).then(setNotifications).catch(() => undefined);
  };
  const clockValue = (minutes: number | null) => minutes == null ? '' : `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  const minutesValue = (value: string) => { const [hours, minutes] = value.split(':').map(Number); return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : null; };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const panel = ref.current?.querySelector<HTMLElement>('[role="dialog"]');
    panel?.querySelector<HTMLElement>('button, input')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); ref.current?.querySelector('button')?.focus(); }
      if (e.key === 'Tab' && panel) {
        const controls = [...panel.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select, [tabindex="0"]')];
        const first = controls[0], last = controls.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
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
        {currency !== 'USD' && (
          <span className="text-muted-foreground/70">{CURRENCIES[currency].symbol}</span>
        )}
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

          {subscriptions.length > 0 && (
            <div className="mb-3">
              <div className="text-muted-foreground mb-1.5 text-[11.5px]">{t('settings.subscriptions')}</div>
              <div className="flex max-h-36 flex-col gap-1 overflow-y-auto">
                {subscriptions.map((subscription) => {
                  const visible = !hiddenSubscriptions.includes(subscription.subscription_key);
                  return (
                    <label
                      key={subscription.subscription_key}
                      className="hover:bg-accent/60 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={visible}
                        onChange={(event) =>
                          setSubscriptionVisible(subscription.subscription_key, event.target.checked)
                        }
                        aria-label={subscription.subscription_display_name}
                        className="accent-foreground size-3.5 shrink-0"
                      />
                      <span className="min-w-0 flex-1 truncate text-[12px]">
                        {subscription.subscription_display_name}
                      </span>
                      <span className="text-muted-foreground/60 text-[10.5px]">
                        {visible ? t('settings.visible') : t('settings.hidden')}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {notifications && <div className="mb-3 border-t pt-3">
            <div className="text-muted-foreground mb-1.5 text-[11.5px]">{t('settings.notifications')}</div>
            <label className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px]"><input type="checkbox" checked={notifications.enabled} onChange={(event) => updateNotifications({ enabled: event.target.checked })} className="accent-foreground size-3.5" />{t('settings.notificationsEnabled')}</label>
            <div className="mt-2 flex flex-wrap gap-1"><button className="rounded border px-2 py-1 text-[11px]" onClick={() => updateNotifications({ snooze_until: Date.now() + 60 * 60_000 })}>{t('settings.snooze1h')}</button><button className="rounded border px-2 py-1 text-[11px]" onClick={() => updateNotifications({ snooze_until: Date.now() + 4 * 60 * 60_000 })}>{t('settings.snooze4h')}</button><button className="rounded border px-2 py-1 text-[11px]" onClick={() => updateNotifications({ snooze_until: null })}>{t('settings.unsnooze')}</button></div>
            <div className="text-muted-foreground mt-2 text-[11px]">{t('settings.quietHours')}</div>
            <div className="mt-1 flex items-center gap-2"><input type="time" aria-label={t('settings.quietStart')} value={clockValue(notifications.quiet_start)} onChange={(event) => updateNotifications({ quiet_start: minutesValue(event.target.value) })} className="bg-card border-input h-7 rounded border px-1 text-[11px]" /><span className="text-muted-foreground text-[11px]">–</span><input type="time" aria-label={t('settings.quietEnd')} value={clockValue(notifications.quiet_end)} onChange={(event) => updateNotifications({ quiet_end: minutesValue(event.target.value) })} className="bg-card border-input h-7 rounded border px-1 text-[11px]" /></div>
          </div>}

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
                  aria-label={t('settings.rate')}
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

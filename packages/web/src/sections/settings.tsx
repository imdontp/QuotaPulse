import { useEffect, useState } from 'react';
import { Info, RefreshCw } from 'lucide-react';
import { api, type AppSettings, type NotificationSettings, type SubscriptionStatus } from '@/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, ErrorBox, RetryableError, Stagger, StaggerItem } from '@/components/primitives';
import { SkeletonLines } from '@/components/skeleton';
import { CURRENCIES, useI18n, useT, type CurrencyCode, type Lang } from '@/i18n';
import { useLiveRefresh } from '@/lib/use-live';
import { loadWindowSize, resetWindowSize, saveWindowSize, type WindowSize } from '@/lib/utils';

const LANGS: Array<{ id: Lang; label: string }> = [
  { id: 'en', label: 'English' },
  { id: 'th', label: 'Thai' },
];

function clockValue(minutes: number | null): string {
  return minutes == null
    ? ''
    : `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function minutesValue(value: string): number | null {
  const [hours, minutes] = value.split(':').map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : null;
}

export function SettingsSection({
  subscriptions,
  onPricingUpdated,
}: {
  subscriptions: SubscriptionStatus[];
  onPricingUpdated?: () => void;
}) {
  const t = useT();
  const {
    lang,
    currency,
    rate,
    hiddenSubscriptions,
    setLang,
    setCurrency,
    setRate,
    setSubscriptionVisible,
    syncHiddenSubscriptions,
  } = useI18n();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [notifications, setNotifications] = useState<NotificationSettings | null>(null);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [draft, setDraft] = useState(String(rate));
  const [busy, setBusy] = useState<string | null>(null);
  const [pricingBusy, setPricingBusy] = useState(false);
  const [pricingMessage, setPricingMessage] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [windowSize, setWindowSize] = useState<WindowSize>(loadWindowSize());
  const [windowSizeMessage, setWindowSizeMessage] = useState<string | null>(null);

  useEffect(() => setDraft(String(rate)), [rate]);

  useEffect(() => {
    if (!subscriptions.length || location.hash.slice(1).split('?')[0] !== 'settings') return;
    const key = new URLSearchParams(location.hash.split('?')[1] ?? '').get('subscription');
    if (!key) return;
    const row = document.getElementById(`subscription-${encodeURIComponent(key)}`);
    row?.scrollIntoView({ block: 'center' });
  }, [subscriptions]);

  useLiveRefresh(() => Promise.all([
    api.settings().then((next) => {
      setSettings(next);
      syncHiddenSubscriptions(next.hidden_subscriptions, next.updated_at);
    }),
    /*
     * Notification settings used to be fetched with `.catch(() => undefined)`, which is
     * indistinguishable from "still loading" to everything downstream. A permanently
     * failing endpoint therefore rendered this card as "loading…" for the rest of the
     * session, next to four other cards that were fine -- a card that had given up looking
     * like a card that was working. It also swallowed the failure from the shared error
     * state, so nothing anywhere said so.
     *
     * Swallowing stays, deliberately: one optional endpoint must not make the whole refresh
     * look broken. But the failure is now recorded, so the card can admit it and offer a
     * retry.
     */
    api.notificationSettings()
      .then((next) => {
        setNotifications(next);
        setNotificationsError(null);
      })
      .catch((error: unknown) => setNotificationsError(String(error))),
  ]).then(() => {
    setErr(null);
  }).catch((error) => {
    setErr(String(error));
    throw error;
  }), [syncHiddenSubscriptions]);

  const update = async (patch: Partial<AppSettings>, key: string) => {
    if (!settings || busy) return;
    setBusy(key);
    setSettings((current) => current ? { ...current, ...patch } : current);
    try {
      const next = await api.updateSettings(patch);
      setSettings(next);
      syncHiddenSubscriptions(next.hidden_subscriptions, next.updated_at);
      setErr(null);
    } catch (error) {
      setErr(String(error));
      const next = await api.settings().catch(() => null);
      if (next) setSettings(next);
    } finally {
      setBusy(null);
    }
  };

  const updateNotifications = async (patch: Partial<NotificationSettings>, key: string) => {
    if (!notifications || busy) return;
    setBusy(key);
    setNotifications((current) => current ? { ...current, ...patch } : current);
    try {
      const next = await api.updateNotificationSettings(patch);
      setNotifications(next);
      setNotificationsError(null);
      setErr(null);
    } catch (error) {
      setErr(String(error));
      const next = await api.notificationSettings().catch(() => null);
      if (next) setNotifications(next);
    } finally {
      setBusy(null);
    }
  };

  /**
   * Ask for notification settings again, on their own.
   *
   * The shared refresh runs on every stream tick, so retrying through it would be a way of
   * saying "please eventually" rather than "now" -- and the card that failed is the only
   * part of this screen the reader is looking at.
   */
  const retryNotifications = async () => {
    setNotificationsError(null);
    const next = await api.notificationSettings()
      .then((value) => {
        setNotifications(value);
        return true;
      })
      .catch((error: unknown) => {
        setNotificationsError(String(error));
        return false;
      });
    return next;
  };

  const commitRate = () => {
    const next = Number(draft.replace(/,/g, ''));
    if (Number.isFinite(next) && next > 0) setRate(next);
    else setDraft(String(rate));
  };

  const refreshPricing = async () => {
    if (pricingBusy) return;
    setPricingBusy(true);
    setPricingMessage(null);
    try {
      const result = await api.refreshPricing();
      setPricingMessage(t('settings.pricingUpdated', { models: result.models, repriced: result.repriced }));
      onPricingUpdated?.();
    } catch {
      setPricingMessage(t('settings.pricingFailed'));
    } finally {
      setPricingBusy(false);
    }
  };

  const handleWindowSizeChange = async (field: keyof WindowSize, value: string) => {
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) {
      const updated = { ...windowSize, [field]: num };
      setWindowSize(updated);
      saveWindowSize(updated);
      setWindowSizeMessage(null);
      // Also send to Electron main process if available
      if (typeof window !== 'undefined' && window.qpDashboard?.setWindowSize) {
        try {
          const success = await window.qpDashboard.setWindowSize(updated);
          setWindowSizeMessage(success ? t('settings.windowSizeApplied') : t('settings.windowSizeFailed'));
          setTimeout(() => setWindowSizeMessage(null), 3000);
        } catch {
          setWindowSizeMessage(t('settings.windowSizeFailed'));
          setTimeout(() => setWindowSizeMessage(null), 3000);
        }
      }
    }
  };

  const handleResetWindowSize = async () => {
    const defaults = resetWindowSize();
    setWindowSize(defaults);
    setWindowSizeMessage(null);
    // Also send to Electron main process if available
    if (typeof window !== 'undefined' && window.qpDashboard?.setWindowSize) {
      try {
        const success = await window.qpDashboard.setWindowSize(defaults);
        setWindowSizeMessage(success ? t('settings.windowSizeApplied') : t('settings.windowSizeFailed'));
        setTimeout(() => setWindowSizeMessage(null), 3000);
      } catch {
        setWindowSizeMessage(t('settings.windowSizeFailed'));
        setTimeout(() => setWindowSizeMessage(null), 3000);
      }
    }
  };

  if (err && !settings) return <ErrorBox>{err}</ErrorBox>;
  if (!settings) return <Empty>{t('app.loading')}</Empty>;

  return (
    <Stagger className="flex flex-col gap-3.5">
      <StaggerItem>
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">{t('settings.pageTitle')}</h2>
          <p className="text-muted-foreground note mt-1 text-[12.5px] leading-relaxed">{t('settings.pageBlurb')}</p>
        </div>
      </StaggerItem>

      {err && <StaggerItem><ErrorBox>{err}</ErrorBox></StaggerItem>}

      <StaggerItem>
        <Card>
          <CardHeader className="flex-col items-start gap-1">
            <CardTitle as="h2">{t('settings.display')}</CardTitle>
            <CardDescription>{t('settings.displayBlurb')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-muted-foreground mb-1.5 text-[11.5px]">{t('settings.language')}</div>
              <div className="grid max-w-sm grid-cols-2 gap-1">
                {LANGS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setLang(item.id)}
                    className={`rounded-md border px-2 py-1.5 text-[12.5px] transition-colors ${lang === item.id ? 'border-foreground/25 bg-secondary font-medium' : 'text-muted-foreground hover:bg-accent/60'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-muted-foreground mb-1.5 text-[11.5px]">{t('settings.currency')}</div>
              <div className="grid max-w-sm grid-cols-2 gap-1">
                {(Object.keys(CURRENCIES) as CurrencyCode[]).map((item) => (
                  <button
                    key={item}
                    onClick={() => setCurrency(item)}
                    className={`rounded-md border px-2 py-1.5 text-[12.5px] transition-colors ${currency === item ? 'border-foreground/25 bg-secondary font-medium' : 'text-muted-foreground hover:bg-accent/60'}`}
                  >
                    {CURRENCIES[item].symbol} {item}
                  </button>
                ))}
              </div>
            </div>

            {currency !== 'USD' && (
              <div>
                <div className="text-muted-foreground mb-1.5 text-[11.5px]">{t('settings.rate')}</div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-[12.5px] whitespace-nowrap">{t('settings.ratePerUsd')}</span>
                  <span className="text-[12.5px]">{CURRENCIES[currency].symbol}</span>
                  <input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onBlur={commitRate}
                    onKeyDown={(event) => event.key === 'Enter' && commitRate()}
                    inputMode="decimal"
                    aria-label={t('settings.rate')}
                    className="border-input bg-card focus-visible:ring-ring/40 tabular h-8 w-24 rounded-md border px-2 text-right font-mono text-[12.5px] outline-none focus-visible:ring-[3px]"
                  />
                </div>
              </div>
            )}

            <p className="text-muted-foreground/70 flex gap-1.5 text-[11px] leading-relaxed">
              <Info className="mt-px size-3 shrink-0" />
              {t('settings.rateHelp')}
            </p>
          </CardContent>
        </Card>
      </StaggerItem>

      <StaggerItem>
        <Card>
          <CardHeader className="flex-col items-start gap-1">
            <CardTitle as="h2">{t('settings.windowSize')}</CardTitle>
            <CardDescription>{t('settings.windowSizeBlurb')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-muted-foreground mb-1.5 text-[11.5px]">{t('settings.windowWidth')}</div>
                <input
                  type="number"
                  value={windowSize.width}
                  onChange={(e) => handleWindowSizeChange('width', e.target.value)}
                  min="540"
                  max="2560"
                  step="10"
                  aria-label={t('settings.windowWidth')}
                  className="border-input bg-card focus-visible:ring-ring/40 h-8 w-full rounded-md border px-2 text-right font-mono text-[12.5px] outline-none focus-visible:ring-[3px]"
                />
              </div>
              <div>
                <div className="text-muted-foreground mb-1.5 text-[11.5px]">{t('settings.windowHeight')}</div>
                <input
                  type="number"
                  value={windowSize.height}
                  onChange={(e) => handleWindowSizeChange('height', e.target.value)}
                  min="640"
                  max="1440"
                  step="10"
                  aria-label={t('settings.windowHeight')}
                  className="border-input bg-card focus-visible:ring-ring/40 h-8 w-full rounded-md border px-2 text-right font-mono text-[12.5px] outline-none focus-visible:ring-[3px]"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground/70 text-[11px] leading-relaxed">{t('settings.windowSizeHelp')}</p>
                {windowSizeMessage && (
                  <p className="text-muted-foreground text-[11px] leading-relaxed mt-1">{windowSizeMessage}</p>
                )}
              </div>
              <Button size="sm" variant="outline" onClick={handleResetWindowSize}>
                {t('settings.resetWindowSize')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </StaggerItem>

      <StaggerItem>
        <Card>
          <CardHeader className="flex-col items-start gap-1">
            <CardTitle as="h2">{t('settings.subscriptions')}</CardTitle>
            <CardDescription>{t('settings.subscriptionHelp')}</CardDescription>
          </CardHeader>
          <CardContent>
            {subscriptions.length === 0 ? <Empty>{t('settings.noSubscriptions')}</Empty> : (
              <div className="flex flex-col divide-y">
                {subscriptions.map((subscription) => {
                  const visible = !hiddenSubscriptions.includes(subscription.subscription_key);
                  return (
                    <label key={subscription.subscription_key} id={`subscription-${encodeURIComponent(subscription.subscription_key)}`} className="flex cursor-pointer items-center justify-between gap-4 py-3">
                      <span className="min-w-0"><span className="block truncate text-sm font-medium">{subscription.subscription_display_name}</span><span className="text-muted-foreground text-xs">{visible ? t('settings.visible') : t('settings.hidden')}</span></span>
                      <input
                        type="checkbox"
                        checked={visible}
                        disabled={busy !== null}
                        onChange={(event) => {
                          setSubscriptionVisible(subscription.subscription_key, event.target.checked);
                          setSettings((current) => current ? {
                            ...current,
                            hidden_subscriptions: event.target.checked
                              ? current.hidden_subscriptions.filter((key) => key !== subscription.subscription_key)
                              : [...new Set([...current.hidden_subscriptions, subscription.subscription_key])],
                          } : current);
                        }}
                        aria-label={subscription.subscription_display_name}
                        className="accent-foreground size-4 shrink-0"
                      />
                    </label>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </StaggerItem>

      <StaggerItem>
        <Card>
          <CardHeader className="flex-col items-start gap-1">
            <CardTitle as="h2">{t('settings.notifications')}</CardTitle>
            <CardDescription>{t('settings.notificationsBlurb')}</CardDescription>
          </CardHeader>
          <CardContent>
            {/*
              Three states, and the middle one used to be missing. `notificationsError` is
              checked before `!notifications` because a failure leaves `notifications` null
              -- so without this order the card would report that it is still waiting, for a
              request that already came back and failed.
            */}
            {notificationsError && !notifications ? (
              <RetryableError onRetry={() => void retryNotifications()} retryLabel={t('app.retry')}>
                {t('app.couldNotLoad')}
              </RetryableError>
            ) : !notifications ? (
              <SkeletonLines lines={3} />
            ) : (
              <div className="divide-y">
                <label className="flex cursor-pointer items-center justify-between gap-4 py-3">
                  <span><span className="block text-sm font-medium">{t('settings.notificationsEnabled')}</span></span>
                  <input type="checkbox" checked={notifications.enabled} disabled={busy !== null} onChange={(event) => void updateNotifications({ enabled: event.target.checked }, 'notifications')} className="accent-foreground size-4 shrink-0" />
                </label>
                <div className="py-3">
                  <div className="text-sm font-medium">{t('settings.snooze')}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Button size="sm" disabled={busy !== null} onClick={() => void updateNotifications({ snooze_until: Date.now() + 60 * 60_000 }, 'snooze')}>{t('settings.snooze1h')}</Button>
                    <Button size="sm" disabled={busy !== null} onClick={() => void updateNotifications({ snooze_until: Date.now() + 4 * 60 * 60_000 }, 'snooze')}>{t('settings.snooze4h')}</Button>
                    <Button size="sm" disabled={busy !== null} onClick={() => void updateNotifications({ snooze_until: null }, 'snooze')}>{t('settings.unsnooze')}</Button>
                  </div>
                </div>
                <div className="py-3">
                  <div className="text-sm font-medium">{t('settings.quietHours')}</div>
                  <div className="text-muted-foreground mt-1 text-xs">{t('settings.quietHoursBlurb')}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input type="time" aria-label={t('settings.quietStart')} value={clockValue(notifications.quiet_start)} disabled={busy !== null} onChange={(event) => void updateNotifications({ quiet_start: minutesValue(event.target.value) }, 'quiet-hours')} className="bg-card border-input h-8 rounded border px-2 text-xs" />
                    <span className="text-muted-foreground text-xs">–</span>
                    <input type="time" aria-label={t('settings.quietEnd')} value={clockValue(notifications.quiet_end)} disabled={busy !== null} onChange={(event) => void updateNotifications({ quiet_end: minutesValue(event.target.value) }, 'quiet-hours')} className="bg-card border-input h-8 rounded border px-2 text-xs" />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </StaggerItem>

      <StaggerItem>
        <Card>
          <CardHeader className="flex-col items-start gap-1">
            <CardTitle as="h2">{t('settings.pricing')}</CardTitle>
            <CardDescription>{t('settings.pricingBlurb')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm" onClick={() => void refreshPricing()} disabled={pricingBusy} className="gap-1.5">
              <RefreshCw className={pricingBusy ? 'size-3.5 animate-spin' : 'size-3.5'} />
              {pricingBusy ? t('settings.pricingRefreshing') : t('settings.pricingRefresh')}
            </Button>
            {pricingMessage && <p className="text-muted-foreground mt-2 text-xs leading-relaxed">{pricingMessage}</p>}
          </CardContent>
        </Card>
      </StaggerItem>

      <StaggerItem>
        <Card>
          <CardHeader className="flex-col items-start gap-1">
            <CardTitle as="h2">{t('settings.runtime')}</CardTitle>
            <CardDescription>{t('settings.runtimeBlurb')}</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <label className="flex cursor-pointer items-center justify-between gap-4 py-3">
              <span><span className="block text-sm font-medium">{t('settings.petMode')}</span><span className="text-muted-foreground text-xs">{t('settings.petModeHelp')}</span></span>
              <input type="checkbox" checked={settings.pet_enabled} disabled={busy !== null} onChange={(event) => void update({ pet_enabled: event.target.checked }, 'pet')} className="accent-foreground size-4 shrink-0" />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-4 py-3">
              <span><span className="block text-sm font-medium">{t('settings.trayAnimation')}</span><span className="text-muted-foreground text-xs">{t('settings.trayAnimationHelp')}</span></span>
              <input type="checkbox" checked={settings.tray_animation_enabled} disabled={busy !== null} onChange={(event) => void update({ tray_animation_enabled: event.target.checked }, 'tray')} className="accent-foreground size-4 shrink-0" />
            </label>
          </CardContent>
        </Card>
      </StaggerItem>
    </Stagger>
  );
}

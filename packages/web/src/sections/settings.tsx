import { useEffect, useState } from 'react';
import { Info, RefreshCw } from 'lucide-react';
import { api, type AppSettings, type NotificationSettings, type SubscriptionStatus } from '@/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, ErrorBox, Stagger, StaggerItem } from '@/components/primitives';
import { CURRENCIES, useI18n, useT, type CurrencyCode, type Lang } from '@/i18n';
import { useLiveRefresh } from '@/lib/use-live';

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
  const [draft, setDraft] = useState(String(rate));
  const [busy, setBusy] = useState<string | null>(null);
  const [pricingBusy, setPricingBusy] = useState(false);
  const [pricingMessage, setPricingMessage] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => setDraft(String(rate)), [rate]);

  useLiveRefresh(() => Promise.all([
    api.settings().then((next) => {
      setSettings(next);
      syncHiddenSubscriptions(next.hidden_subscriptions, next.updated_at);
    }),
    api.notificationSettings().then(setNotifications).catch(() => undefined),
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
      setErr(null);
    } catch (error) {
      setErr(String(error));
      const next = await api.notificationSettings().catch(() => null);
      if (next) setNotifications(next);
    } finally {
      setBusy(null);
    }
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
            <CardTitle>{t('settings.display')}</CardTitle>
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
            <CardTitle>{t('settings.subscriptions')}</CardTitle>
            <CardDescription>{t('settings.subscriptionHelp')}</CardDescription>
          </CardHeader>
          <CardContent>
            {subscriptions.length === 0 ? <Empty>{t('settings.noSubscriptions')}</Empty> : (
              <div className="flex flex-col divide-y">
                {subscriptions.map((subscription) => {
                  const visible = !hiddenSubscriptions.includes(subscription.subscription_key);
                  return (
                    <label key={subscription.subscription_key} className="flex cursor-pointer items-center justify-between gap-4 py-3">
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
            <CardTitle>{t('settings.notifications')}</CardTitle>
            <CardDescription>{t('settings.notificationsBlurb')}</CardDescription>
          </CardHeader>
          <CardContent>
            {!notifications ? <Empty>{t('app.loading')}</Empty> : (
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
            <CardTitle>{t('settings.pricing')}</CardTitle>
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
            <CardTitle>{t('settings.runtime')}</CardTitle>
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

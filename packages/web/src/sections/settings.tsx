import { useState } from 'react';
import { api, type AppSettings, type SubscriptionStatus } from '@/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, ErrorBox, Stagger, StaggerItem } from '@/components/primitives';
import { useI18n, useT } from '@/i18n';
import { useLiveRefresh } from '@/lib/use-live';

export function SettingsSection({ subscriptions }: { subscriptions: SubscriptionStatus[] }) {
  const t = useT();
  const { hiddenSubscriptions, setSubscriptionVisible, syncHiddenSubscriptions } = useI18n();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useLiveRefresh(() => api.settings().then((next) => {
    setSettings(next);
    syncHiddenSubscriptions(next.hidden_subscriptions, next.updated_at);
    setErr(null);
  }).catch((error) => {
    setErr(String(error));
    throw error;
  }), []);

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
                  return <label key={subscription.subscription_key} className="flex cursor-pointer items-center justify-between gap-4 py-3">
                    <span className="min-w-0"><span className="block truncate text-sm font-medium">{subscription.subscription_display_name}</span><span className="text-muted-foreground text-xs">{visible ? t('settings.visible') : t('settings.hidden')}</span></span>
                    <input type="checkbox" checked={visible} onChange={(event) => {
                      setSubscriptionVisible(subscription.subscription_key, event.target.checked);
                      setSettings((current) => current ? { ...current, hidden_subscriptions: event.target.checked
                        ? current.hidden_subscriptions.filter((key) => key !== subscription.subscription_key)
                        : [...new Set([...current.hidden_subscriptions, subscription.subscription_key])] } : current);
                    }} className="accent-foreground size-4 shrink-0" />
                  </label>;
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </StaggerItem>
    </Stagger>
  );
}

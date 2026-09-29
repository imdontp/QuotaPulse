import { useState } from 'react';
import { en } from '@/i18n/en';
import { th } from '@/i18n/th';
import { Overview } from './overview';
import { fixtureNow, fixtureQuotas, fixtureRecords } from './fixture';

/** Deliberately no preference provider: preview must not migrate or write user settings. */
export default function Preview() {
  const [language, setLanguage] = useState<'en' | 'th'>('en');
  const messages = language === 'th' ? th : en;
  const scenario = new URLSearchParams(location.search).get('scenario');
  const records = scenario === 'empty' ? [] : scenario === 'long-names'
    ? fixtureRecords.map(row => ({ ...row, project: row.project ? `${row.project} / a-very-long-project-name-with-many-segments` : null })) : fixtureRecords;
  const quotas = scenario === 'empty' ? [] : fixtureQuotas.map(quota => ({
    ...quota,
    usedPercent: scenario === 'critical' ? 97 : quota.usedPercent,
    observedAt: scenario === 'stale' ? fixtureNow - 600000 : quota.observedAt,
  }));
  return <Overview preview records={records} quotas={quotas} now={fixtureNow} language={language} onLanguage={() => setLanguage(language === 'en' ? 'th' : 'en')} t={key => messages[key]}/>;
}

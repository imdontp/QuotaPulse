import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/** Keep cookies, preferences and cache inside an explicitly selected instance. */
export function configureInstanceProfile(app: { setPath(name: 'userData' | 'sessionData', path: string): void }, dataDir?: string): string | undefined {
  if (!dataDir) return undefined;
  const profile = resolve(dataDir, 'electron');
  mkdirSync(profile, { recursive: true });
  app.setPath('userData', profile);
  app.setPath('sessionData', profile);
  return profile;
}

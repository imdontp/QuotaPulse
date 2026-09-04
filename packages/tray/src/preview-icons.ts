/** Render a strip of icon states to files so the badge can be eyeballed without Electron. */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { renderTrayIcon } from './icon.js';

const out = process.argv[2] ?? join(process.cwd(), 'icon-preview');
mkdirSync(out, { recursive: true });
for (const p of [null, 0, 15, 35, 55, 62, 75, 88, 96, 100]) {
  const buf = renderTrayIcon(p);
  const name = p == null ? 'unknown' : String(p).padStart(3, '0');
  writeFileSync(join(out, `tray-${name}.png`), buf);
  console.log(`${name.padStart(7)}  ${String(buf.length).padStart(5)} bytes`);
}
console.log(`\nwrote to ${out}`);

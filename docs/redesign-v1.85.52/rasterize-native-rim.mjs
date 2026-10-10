import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="46" viewBox="0 0 8 44" preserveAspectRatio="none"><path d="M7 .75C3 .75 1.5 3 1.5 7V37C1.5 41 3 43.25 7 43.25" fill="none" stroke="#009eea" stroke-width="1.5"/></svg>';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-gpu', '--force-color-profile=srgb'] });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const data = await page.evaluate(async source => {
    const image = new Image();
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 8; canvas.height = 46;
    canvas.getContext('2d').drawImage(image, 0, 0, 8, 46);
    return canvas.toDataURL('image/png');
  }, svg);
  writeFileSync('tmp/native-rim52.png', Buffer.from(data.split(',')[1], 'base64'));
  writeFileSync('tmp/native-rim52.svg', svg + '\n');
  writeFileSync('tmp/native-rim52-data-url.txt', data);
  writeFileSync('tmp/native-rim52-provenance.json', JSON.stringify({ width: 8, height: 46, svg, pngSha256: createHash('sha256').update(readFileSync('tmp/native-rim52.png')).digest('hex'), browser: browser.version(), method: 'One-time canvas rasterization of the existing decorative vector; no reference image editing' }, null, 2));
} finally {
  await browser.close();
}

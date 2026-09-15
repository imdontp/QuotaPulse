/** Local visual checks; build the tray first. No daemon, accounts or native windows. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { CONCEPT_LAYOUTS, conceptAssetPath, renderConceptPet } from '../packages/tray/dist/pet/concept-art.js';
import { galleryRoster } from '../packages/tray/dist/pet/catalog.js';
import { skinsForCharacter } from '../packages/tray/dist/pet/skins.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const assets = resolve(root, 'packages/tray/assets');
const output = resolve(root, 'screens/pet-concept');
mkdirSync(output, { recursive: true });
const characters = Object.keys(CONCEPT_LAYOUTS);
const moods = ['healthy', 'working', 'warning', 'critical', 'reset', 'unknown'];
const sprites = {};
for (const character of characters) {
  const bytes = readFileSync(resolve(assets, conceptAssetPath(character)));
  assert.equal(bytes.toString('hex', 0, 8), '89504e470d0a1a0a');
  assert.equal(bytes[25], 6, `${character}: sheet must have an alpha channel`);
  const href = `data:image/png;base64,${bytes.toString('base64')}`;
  sprites[character] = Object.fromEntries(moods.map(mood => [mood, renderConceptPet(character, mood, href)]));
  assert.equal(new Set(Object.values(sprites[character])).size, 6);
  assert.ok(readFileSync(resolve(root, 'packages/tray/dist-package', conceptAssetPath(character))).equals(bytes), 'packaged artwork matches source');
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1180, height: 960 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent(`<style>body{margin:24px;background:#0b1119;color:#d6eaf2;font:14px system-ui}h1{font-size:22px}.row{display:grid;grid-template-columns:130px repeat(6,1fr);align-items:center}.pose{text-align:center}.pose > svg{width:148px;height:148px}.light{background:#f0f4f8;color:#132638;border-radius:12px}</style><h1>Pet concept · runtime poses</h1>${characters.map(character => `<div class="row"><h3>${character.replaceAll('_', ' ')}</h3>${moods.map(mood => `<div class="pose">${sprites[character][mood]}<div>${mood}</div></div>`).join('')}</div>`).join('')}<div class="row light"><h3>Light backdrop</h3>${characters.map(character => `<div class="pose">${sprites[character].healthy}</div>`).join('')}</div>`);
  await page.evaluate(async () => {
    await Promise.all([...document.querySelectorAll('image')].map(el => new Promise((done, reject) => {
      const img = new Image(); img.onload = done; img.onerror = reject; img.src = el.getAttribute('href');
    })));
  });
  await page.screenshot({ path: resolve(output, 'all-poses.png'), fullPage: true });

  // Exercise the actual desktop renderer, including repeated frames and reduced motion.
  await page.addInitScript(() => {
    window.qpPet = { onState(fn) { window.deliverPet = fn; }, hover() {}, moved() {} };
  });
  await page.goto(pathToFileURL(resolve(root, 'packages/tray/src/pet.html')).href);
  const frame = { hasData: true, mood: 'healthy', colorCss: '#22d3ee', alertColorCss: '#ef4444',
    global: { severity: 'ok' }, focus: null, bubble: null, badge: null, reducedMotion: true,
    movement: 'minimal', animation: 'healthy_idle', animationSrc: null, spriteIndex: 0 };
  for (const character of characters) {
    for (const mood of moods) {
      const next = { ...frame, character, mood, spriteSvg: renderConceptPet(character, mood, `../assets/${conceptAssetPath(character)}`) };
      await page.evaluate(next => window.deliverPet(next), next);
      assert.equal(await page.locator('#pet > svg').getAttribute('data-concept-pose'), mood);
      assert.equal(await page.locator('#pet-wrap').evaluate(el => el.classList.contains('unknown')), mood === 'unknown');
      await page.locator('#pet image').evaluate(el => new Promise((done, reject) => {
        const img = new Image(); img.onload = done; img.onerror = reject; img.src = el.getAttribute('href');
      }));
      assert.equal(await page.locator('#pet').evaluate(el => getComputedStyle(el).backgroundImage), 'none');
      assert.equal(await page.locator('#pet .qp-sprite').evaluate(el => getComputedStyle(el).animationName), 'none');
      assert.ok(await page.evaluate(next => {
        const before = document.querySelector('#pet > svg'); window.deliverPet(next);
        return before === document.querySelector('#pet > svg');
      }, next), 'unchanged polling must preserve the image node');
    }
  }

  // Motion Extension Pack sheets are opt-in runtime art: healthy/working may use a crop,
  // while warning/critical still keep the authored concept frame for semantic clarity.
  const motion = {
    coreSheet: '../assets/pets/orbit-bot/motion-extension/core-pose-sheet.png',
    actionSheet: '../assets/pets/orbit-bot/motion-extension/action-pose-sheet.png',
    columns: 5,
    source: 'motion-extension',
  };
  await page.evaluate(next => window.deliverPet(next), { ...frame, character: 'orbit_bot', motion, spriteSvg: null });
  await page.locator('#pet > svg image').waitFor();
  await page.locator('#pet > svg image').evaluate(el => new Promise((done, reject) => {
    const img = new Image(); img.onload = done; img.onerror = reject; img.src = el.getAttribute('href');
  }));
  assert.equal(await page.locator('#pet-wrap').evaluate(el => el.classList.contains('concept-art')), false);

  // The gallery must show artwork and update it on both state and character selection.
  await page.addInitScript(({ characters, sprites, entries, skins }) => {
    const settings = { character: characters[0], skin: 'default', movement: 'minimal', quietHours: {} };
    window.qpGallery = {
      roster: async () => ({ entries, skins: skins[settings.character], movementModes: ['minimal', 'companion', 'roaming'] }),
      settings: async () => settings,
      update: async patch => {
        if (patch.character && !characters.includes(patch.character)) return { settings, error: 'Unknown character' };
        Object.assign(settings, patch.flags || {}, patch.quiet ? { quietHours: { ...settings.quietHours, ...patch.quiet } } : {}, patch.character ? { character: patch.character } : {}, patch.skin ? { skin: patch.skin } : {}, patch.movement ? { movement: patch.movement } : {});
        return { settings };
      },
      preview: async mood => ({ svg: sprites[settings.character][mood] }),
      returnHome() {},
    };
  }, { characters, sprites, entries: galleryRoster().map(entry => ({ ...entry, previewSvg: sprites[entry.id].healthy })), skins: Object.fromEntries(characters.map(id => [id, skinsForCharacter(id)])) });
  await page.setViewportSize({ width: 1080, height: 860 });
  await page.goto(pathToFileURL(resolve(root, 'packages/tray/src/gallery.html')).href);
  await page.locator('#previewArt > svg').waitFor();
  assert.equal(await page.locator('.card-art > svg').count(), 8);
  await page.getByRole('button', { name: 'Critical', exact: true }).click();
  await page.locator('#previewArt [data-concept-pose="critical"]').waitFor();
  await page.locator('#characters button').nth(1).focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#previewArt').getAttribute('aria-label').startsWith('pulse fox'));
  await page.screenshot({ path: resolve(output, 'gallery.png'), fullPage: true });
  for (const id of ['nova', 'byte', 'mochi', 'kuro']) {
    await page.locator(`[data-character="${id}"]`).click();
    await page.waitForFunction(id => document.querySelector('#previewArt').getAttribute('aria-label').startsWith(id), id);
    assert.equal(await page.locator(`[data-character="${id}"]`).getAttribute('aria-pressed'), 'true');
  }
  await page.locator('[data-character="nova"]').click();
  await page.waitForFunction(() => document.querySelector('#selectedName').textContent === 'Nova');
  await page.getByRole('button', { name: 'Healthy', exact: true }).click();
  await page.locator('#previewArt [data-concept-pose="healthy"]').waitFor();
  await page.getByRole('switch', { name: 'Reduced motion', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-toggle="reducedMotion"]').getAttribute('aria-checked') === 'true');
  await page.screenshot({ path: resolve(output, 'gallery-bonus.png'), fullPage: true });
  await page.setViewportSize({ width: 560, height: 720 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'narrow gallery has no horizontal overflow');
  await page.screenshot({ path: resolve(output, 'gallery-compact.png'), fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS: 48 poses, transparent PNGs, packaged files, desktop updates, reduced motion, unchanged-frame identity, eight gallery selections and preferences.');
  console.log(`Screenshots: ${output}`);
} finally {
  await browser.close();
}

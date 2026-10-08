/** Source-derived panel marks; geometry evidence is not a whole-screen likeness score. */
import assert from 'node:assert/strict';
import type { Page } from 'playwright';

interface Target {
  selector: string; size: 20 | 28 | 34; warm?: boolean;
  names: { en: string; th: string };
}

// Names are the pre-pass production headings. Sizes follow the original PNG tile measurements,
// independently of SectionMark props/data attributes and current production translations.
const targets: Record<string, Target[]> = {
  live: [
    { selector: '.qp-live-sessions h2', size: 28, names: { en: 'Observed sessions', th: 'เซสชันที่ตรวจพบ' } },
    { selector: '.qp-live-trend h2', size: 28, names: { en: 'Recorded tokens per minute', th: 'โทเคนที่บันทึกต่อนาที' } },
    { selector: '.qp-live-records h2', size: 28, names: { en: 'Usage record feed', th: 'รายการใช้งานที่บันทึก' } },
    { selector: '.qp-live-rail>.qp-live-section:first-child>h2', size: 28, names: { en: 'Source advisories', th: 'คำเตือนของแหล่งข้อมูล' } },
    { selector: '.qp-live-matrix-heading>h2', size: 28, names: { en: 'Observed provider and model activity', th: 'กิจกรรมผู้ให้บริการและโมเดลที่ตรวจพบ' } },
  ],
  cost: [
    { selector: '.qp-cost-providers h2', size: 34, names: { en: 'Value by recorded provider', th: 'มูลค่าตามผู้ให้บริการที่บันทึก' } },
    { selector: '.qp-cost-trend h2', size: 34, names: { en: 'Value and priced-token trend', th: 'แนวโน้มมูลค่าและโทเค็นที่มีราคา' } },
    { selector: '.qp-cost-models h2', size: 34, names: { en: 'Value by model and route', th: 'มูลค่าตามโมเดลและเส้นทาง' } },
    { selector: '.qp-cost-projects h2', size: 34, names: { en: 'Value by project', th: 'มูลค่าตามโปรเจกต์' } },
    { selector: '.qp-cost-sessions h2', size: 34, warm: true, names: { en: 'Most expensive recorded sessions', th: 'เซสชันที่มีมูลค่าสูงสุด' } },
    { selector: '.qp-cost-insights h2', size: 34, names: { en: 'Coverage insights', th: 'ข้อมูลความครอบคลุม' } },
  ],
  providers: [
    { selector: '.qp-provider-comparison h2', size: 34, names: { en: 'Compare one quota window', th: 'เปรียบเทียบโควตาหนึ่งช่วง' } },
    { selector: '.qp-provider-health h2', size: 34, names: { en: 'Reader health and freshness', th: 'สถานะตัวอ่านและความสดของข้อมูล' } },
  ],
  models: [
    { selector: '.qp-model-comparison h2', size: 34, names: { en: 'Model comparison', th: 'เปรียบเทียบโมเดล' } },
    { selector: '.qp-model-providers h2', size: 20, names: { en: 'Recorded provider distribution', th: 'สัดส่วนผู้ให้บริการที่บันทึก' } },
  ],
};

async function bounded<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<T>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`Section-mark gate timed out: ${label}`)), 12000);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

async function measure(page: Page, definitions: Target[], lang: 'en' | 'th', theme: string) {
  const snapshot = await bounded(page.evaluate(definitions => {
    // Anonymous array entries avoid tsx keepNames helpers in this serialized browser callback.
    const box = [(element: Element) => {
      const r = element.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    }][0]!;
    const overlaps = [(a: ReturnType<typeof box>, b: ReturnType<typeof box>) =>
      Math.min(a.right, b.right) - Math.max(a.x, b.x) > .1 && Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > .1][0]!;
    const contained = [(inner: ReturnType<typeof box>, outer: ReturnType<typeof box>) =>
      inner.x >= outer.x - .1 && inner.y >= outer.y - .1 && inner.right <= outer.right + .1 && inner.bottom <= outer.bottom + .1][0]!;
    const marks = definitions.map(target => {
      const headings = document.querySelectorAll<HTMLElement>(target.selector);
      if (headings.length !== 1) throw new Error(`${target.selector}: expected one heading, got ${headings.length}`);
      const heading = headings[0]!;
      const frames = heading.querySelectorAll<HTMLElement>(':scope>.qp-section-mark');
      if (frames.length !== 1) throw new Error(`${target.selector}: expected one direct mark, got ${frames.length}`);
      const mark = frames[0]!, svgs = mark.querySelectorAll<SVGSVGElement>(':scope>svg');
      if (svgs.length !== 1) throw new Error(`${target.selector}: expected one direct SVG`);
      const svg = svgs[0]!, panel = heading.closest('.qp-panel');
      if (!panel) throw new Error(`${target.selector}: no containing panel`);
      const frame = box(mark), vector = box(svg), style = getComputedStyle(mark), svgStyle = getComputedStyle(svg);
      const clippedBy: string[] = [];
      for (let ancestor: Element | null = mark; ancestor; ancestor = ancestor.parentElement) {
        const computed = getComputedStyle(ancestor), bounds = box(ancestor);
        const xClips = /^(hidden|clip|scroll|auto)$/.test(computed.overflowX);
        const yClips = /^(hidden|clip|scroll|auto)$/.test(computed.overflowY);
        if ((xClips && (frame.x < bounds.x - .1 || frame.right > bounds.right + .1)) ||
            (yClips && (frame.y < bounds.y - .1 || frame.bottom > bounds.bottom + .1)) ||
            computed.clipPath !== 'none') clippedBy.push(ancestor.tagName + '.' + ancestor.getAttribute('class'));
        if (ancestor.classList.contains('qp-redesign')) break;
      }
      const controls = Array.from(panel.querySelectorAll<HTMLElement>('button,a,input,select,textarea,summary'))
        .filter(element => !mark.contains(element) && !heading.contains(element))
        .map(element => ({ name: element.getAttribute('aria-label') ?? element.textContent?.trim(), box: box(element) }))
        .filter(element => element.box.width > 0 && element.box.height > 0);
      const controlOverlaps = controls.filter(control => overlaps(frame, control.box));
      const textRects: ReturnType<typeof box>[] = [];
      for (const child of heading.childNodes) {
        if (child.nodeType !== Node.TEXT_NODE || !child.textContent?.trim()) continue;
        const range = document.createRange(); range.selectNodeContents(child);
        for (const r of range.getClientRects()) textRects.push({ x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom });
      }
      // Negative block margins preserve row height; check the actual following
      // paragraph/table ink as well as heading text and interactive controls.
      const adjacentTextOverlaps: Array<{ text: string; bounds: ReturnType<typeof box> }> = [];
      const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.trim() || heading.contains(node)) continue;
        const range = document.createRange(); range.selectNodeContents(node);
        for (const r of range.getClientRects()) {
          const bounds = { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
          if (r.width > 0 && r.height > 0 && overlaps(frame, bounds)) adjacentTextOverlaps.push({ text: node.textContent.trim(), bounds });
        }
      }
      const glyph = svg.getBBox(), viewBox = svg.viewBox.baseVal;
      const stroke = Number.parseFloat(svgStyle.strokeWidth) || 0;
      const glyphContained = viewBox.width > 0 && viewBox.height > 0 && glyph.x - stroke / 2 >= viewBox.x - .1 &&
        glyph.y - stroke / 2 >= viewBox.y - .1 && glyph.x + glyph.width + stroke / 2 <= viewBox.x + viewBox.width + .1 &&
        glyph.y + glyph.height + stroke / 2 <= viewBox.y + viewBox.height + .1;
      const minControlGap = controls.length ? Math.min(...controls.map(control => Math.hypot(
        Math.max(0, control.box.x - frame.right, frame.x - control.box.right),
        Math.max(0, control.box.y - frame.bottom, frame.y - control.box.bottom)))) : null;
      return { selector: target.selector, heading: heading.textContent?.trim(), frame, vector,
        containedSvg: contained(vector, frame), containedPanel: contained(frame, box(panel)), glyphContained,
        wrapperHidden: mark.getAttribute('aria-hidden'), svgHidden: svg.getAttribute('aria-hidden'),
        svgFocusable: svg.getAttribute('focusable'), wrapperTabIndex: mark.tabIndex, svgTabIndex: svg.tabIndex,
        focusableChildren: mark.querySelectorAll('a,button,input,select,textarea,[tabindex="0"]').length,
        visible: style.display !== 'none' && style.visibility === 'visible' && Number(style.opacity) > 0,
        frameColor: style.color, svgColor: svgStyle.color, gradient: style.backgroundImage,
        clippedBy, controlOverlaps, adjacentTextOverlaps, textOverlap: textRects.some(rect => overlaps(frame, rect)), minControlGap,
        footprint: frame.height + Number.parseFloat(style.marginTop) + Number.parseFloat(style.marginBottom) };
    });
    return { marks, count: document.querySelectorAll('.qp-redesign main .qp-section-mark').length,
      overflow: document.documentElement.scrollWidth - innerWidth,
      plainDetails: document.querySelectorAll('.qp-model-detail h2 .qp-section-mark').length };
  }, definitions), 'panel geometry');
  assert.equal(snapshot.count, definitions.length, 'Unexpected or missing section marks');
  assert.ok(snapshot.overflow <= 0, `Section marks introduced horizontal overflow (${snapshot.overflow}px)`);
  assert.equal(snapshot.plainDetails, 0, 'Model detail headings must retain their plain source treatment');
  for (const [index, mark] of snapshot.marks.entries()) {
    const expected = definitions[index]!, label = `${expected.selector} ${lang}/${theme}`;
    assert.equal(mark.heading, expected.names[lang], `${label}: localized heading changed`);
    assert.ok(Math.abs(mark.frame.width - expected.size) <= .1 && Math.abs(mark.frame.height - expected.size) <= .1,
      `${label}: source tile must be ${expected.size}px square`);
    assert.ok(mark.vector.width >= 14 && mark.vector.height >= 14 && mark.containedSvg && mark.glyphContained,
      `${label}: SVG paint must fit its frame and viewBox`);
    assert.ok(mark.containedPanel && mark.visible, `${label}: frame must remain visibly inside its panel`);
    assert.equal(mark.wrapperHidden, 'true'); assert.equal(mark.svgHidden, 'true');
    assert.equal(mark.svgFocusable, 'false'); assert.ok(mark.wrapperTabIndex < 0 && mark.svgTabIndex < 0);
    assert.equal(mark.focusableChildren, 0);
    assert.deepEqual(mark.clippedBy, [], `${label}: frame clipped by an ancestor`);
    assert.deepEqual(mark.controlOverlaps, [], `${label}: frame overlaps a neighboring control`);
    assert.equal(mark.textOverlap, false, `${label}: frame overlaps heading text`);
    assert.deepEqual(mark.adjacentTextOverlaps, [], `${label}: frame overlaps adjacent paragraph/table text`);
    assert.ok(Math.abs(mark.footprint - 20) <= .1, `${label}: mark must preserve the existing 20px layout footprint`);
    assert.equal(mark.svgColor, mark.frameColor, `${label}: global h2 SVG color must not override its mark`);
    if (theme === 'dark' && !expected.warm) {
      assert.ok(mark.gradient.includes('rgb(0, 30, 99)') && mark.gradient.includes('rgb(0, 26, 81)'),
        `${label}: dark frame must retain the sampled blue palette (${mark.gradient})`);
    }
    if (expected.warm) {
      assert.equal(mark.frameColor, theme === 'dark' ? 'rgb(255, 107, 117)' : 'rgb(180, 35, 53)', `${label}: warm sessions identity color`);
      if (theme === 'dark') assert.ok(mark.gradient.includes('rgb(27, 24, 35)') && mark.gradient.includes('rgb(25, 20, 27)'), `${label}: warm tile background`);
    }
  }
  return { marks: snapshot.marks, horizontalOverflow: snapshot.overflow };
}

/** Called after a canonical capture; returns geometry only and restores the canonical viewport/top. */
export async function checkSectionMarks(page: Page, destination: string, lang: string, theme: string) {
  const definitions = targets[destination];
  assert.ok(definitions, `Section marks are scoped to Live, Cost, Providers and Models: ${destination}`);
  assert.ok(lang === 'en' || lang === 'th'); assert.ok(theme === 'dark' || theme === 'light');
  const deadline = performance.now() + 45000;
  try {
    await bounded(page.setViewportSize({ width: 1672, height: 941 }), 'canonical viewport');
    await bounded(page.evaluate(() => document.fonts.ready.then(() => undefined)), 'fonts');
    await page.waitForTimeout(75);
    const canonical = await measure(page, definitions, lang, theme);
    const widths = [];
    for (const width of [390, 900, 1280]) {
      assert.ok(performance.now() < deadline, 'Section-mark responsive checks exceeded their bounded deadline');
      await bounded(page.setViewportSize({ width, height: 941 }), `${width}px viewport`);
      await bounded(page.evaluate(() => document.fonts.ready.then(() => undefined)), `${width}px fonts`);
      await page.waitForTimeout(75);
      widths.push({ width, ...await measure(page, definitions, lang, theme) });
    }
    return { page: destination, lang, theme, marks: canonical.marks, widths,
      source: 'Original refs tile measurements and pre-pass localized headings; geometry is not a likeness percentage' };
  } finally {
    await bounded(page.setViewportSize({ width: 1672, height: 941 }), 'restore viewport');
    await bounded(page.evaluate(() => window.scrollTo(0, 0)), 'restore scroll');
    await page.waitForTimeout(75);
  }
}

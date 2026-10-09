import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { chromium } from 'playwright';

const [referencePath, candidatePath, outputPath, referencePage = 'overview'] = process.argv.slice(2);
assert.ok(referencePath && candidatePath && outputPath,
  'Usage: node --import tsx scripts/measure-reference-parity.mts <reference.png> <candidate.png> <output-directory> [overview|live|projects|models|history|alerts|cost|providers]');
assert.ok(['overview', 'live', 'projects', 'models', 'history', 'alerts', 'cost', 'providers'].includes(referencePage), 'Unknown reference page');
const reference = readFileSync(resolve(referencePath));
const candidate = readFileSync(resolve(candidatePath));
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  const browserAnalysis = `async ({ referencePng, candidatePng, referencePage }) => {
    async function decode(base64) {
      const image = new Image();
      image.src = "data:image/png;base64," + base64;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      return { canvas, pixels: context.getImageData(0, 0, canvas.width, canvas.height).data };
    }
    const [source, app] = await Promise.all([decode(referencePng), decode(candidatePng)]);
    if (source.canvas.width !== app.canvas.width || source.canvas.height !== app.canvas.height) {
      throw new Error("Image dimensions differ: reference " + source.canvas.width + "x" + source.canvas.height + ", app " + app.canvas.width + "x" + app.canvas.height);
    }
    const width = source.canvas.width, height = source.canvas.height;
    function luminanceAt(pixels, index) {
      return .2126 * pixels[index] + .7152 * pixels[index + 1] + .0722 * pixels[index + 2];
    }
    const c1 = (0.01 * 255) ** 2, c2 = (0.03 * 255) ** 2;
    const luminanceSource = new Float32Array(width * height), luminanceApp = new Float32Array(width * height);
    for (let pixel = 0; pixel < width * height; pixel++) {
      const channel = pixel * 4;
      luminanceSource[pixel] = luminanceAt(source.pixels, channel);
      luminanceApp[pixel] = luminanceAt(app.pixels, channel);
    }
    const integralWidth = width + 1, integralSize = integralWidth * (height + 1);
    const integralA = new Float64Array(integralSize), integralB = new Float64Array(integralSize);
    const integralA2 = new Float64Array(integralSize), integralB2 = new Float64Array(integralSize);
    const integralAB = new Float64Array(integralSize);
    for (let y = 0; y < height; y++) {
      let rowA = 0, rowB = 0, rowA2 = 0, rowB2 = 0, rowAB = 0;
      for (let x = 0; x < width; x++) {
        const pixel = y * width + x, index = (y + 1) * integralWidth + x + 1;
        const a = luminanceSource[pixel], b = luminanceApp[pixel];
        rowA += a; rowB += b; rowA2 += a * a; rowB2 += b * b; rowAB += a * b;
        integralA[index] = integralA[index - integralWidth] + rowA;
        integralB[index] = integralB[index - integralWidth] + rowB;
        integralA2[index] = integralA2[index - integralWidth] + rowA2;
        integralB2[index] = integralB2[index - integralWidth] + rowB2;
        integralAB[index] = integralAB[index - integralWidth] + rowAB;
      }
    }
    const windowRadius = 5, windowSide = windowRadius * 2 + 1, windowArea = windowSide * windowSide;
    function rectangleSum(integral, x0, y0, x1, y1) {
      const top = y0 * integralWidth, bottom = (y1 + 1) * integralWidth;
      return integral[bottom + x1 + 1] - integral[top + x1 + 1] - integral[bottom + x0] + integral[top + x0];
    }
    function localSsimAverage(x0, y0, x1, y1) {
      const left = Math.max(windowRadius, x0), top = Math.max(windowRadius, y0);
      const right = Math.min(width - windowRadius, x1), bottom = Math.min(height - windowRadius, y1);
      let total = 0, count = 0;
      for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
        const x0 = x - windowRadius, y0 = y - windowRadius, x1 = x + windowRadius, y1 = y + windowRadius;
        const meanA = rectangleSum(integralA, x0, y0, x1, y1) / windowArea;
        const meanB = rectangleSum(integralB, x0, y0, x1, y1) / windowArea;
        const varianceA = Math.max(0, rectangleSum(integralA2, x0, y0, x1, y1) / windowArea - meanA * meanA);
        const varianceB = Math.max(0, rectangleSum(integralB2, x0, y0, x1, y1) / windowArea - meanB * meanB);
        const covariance = rectangleSum(integralAB, x0, y0, x1, y1) / windowArea - meanA * meanB;
        total += ((2 * meanA * meanB + c1) * (2 * covariance + c2)) /
          ((meanA * meanA + meanB * meanB + c1) * (varianceA + varianceB + c2));
        count++;
      }
      return count ? total / count : 1;
    }
    function measure(x0, y0, x1, y1) {
      let n = 0, sumA = 0, sumB = 0, squareA = 0, squareB = 0, cross = 0;
      let absoluteRgb = 0, squaredRgb = 0, exactPixels = 0, withinTwo = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const index = (y * width + x) * 4;
        const a = luminanceAt(source.pixels, index), b = luminanceAt(app.pixels, index);
        sumA += a; sumB += b; squareA += a * a; squareB += b * b; cross += a * b; n++;
        let pixelExact = true, pixelWithinTwo = true;
        for (let channel = 0; channel < 3; channel++) {
          const delta = Math.abs(source.pixels[index + channel] - app.pixels[index + channel]);
          absoluteRgb += delta; squaredRgb += delta * delta;
          pixelExact &&= delta === 0;
          pixelWithinTwo &&= delta <= 2;
        }
        if (pixelExact) exactPixels++;
        if (pixelWithinTwo) withinTwo++;
      }
      const meanA = sumA / n, meanB = sumB / n;
      const varianceA = Math.max(0, squareA / n - meanA * meanA);
      const varianceB = Math.max(0, squareB / n - meanB * meanB);
      const covariance = cross / n - meanA * meanB;
      const ssim = ((2 * meanA * meanB + c1) * (2 * covariance + c2)) /
        ((meanA * meanA + meanB * meanB + c1) * (varianceA + varianceB + c2));
      return { pixels: n, ssim, meanAbsoluteRgbDelta: absoluteRgb / (n * 3), rootMeanSquareRgbDelta: Math.sqrt(squaredRgb / (n * 3)),
        exactPixelPercent: exactPixels / n * 100, withinTwoChannelsPercent: withinTwo / n * 100 };
    }

    const tileSize = 32;
    const tiles = [];
    const tileCols = Math.ceil(width / tileSize), tileRows = Math.ceil(height / tileSize);
    let weightedSsim = 0, comparedPixels = 0;
    for (let row = 0; row < tileRows; row++) for (let col = 0; col < tileCols; col++) {
      const x = col * tileSize, y = row * tileSize, right = Math.min(width, x + tileSize), bottom = Math.min(height, y + tileSize);
      const sample = measure(x, y, right, bottom);
      sample.singleWindowSsim = sample.ssim;
      sample.ssim = localSsimAverage(x, y, right, bottom);
      const localPixels = Math.max(0, Math.min(right, width - windowRadius) - Math.max(x, windowRadius)) *
        Math.max(0, Math.min(bottom, height - windowRadius) - Math.max(y, windowRadius));
      weightedSsim += sample.ssim * localPixels; comparedPixels += localPixels;
      tiles.push({ x, y, width: right - x, height: bottom - y, ssim: sample.ssim, meanAbsoluteRgbDelta: sample.meanAbsoluteRgbDelta });
    }
    const regionBoxes = referencePage === 'overview' ? [
      { name: 'header', x: 0, y: 0, width: 1586, height: 60 },
      { name: 'sidebar', x: 0, y: 60, width: 216, height: 932 },
      { name: 'pulse-core', x: 228, y: 68, width: 977, height: 395 },
      { name: 'subscriptions', x: 1217, y: 68, width: 348, height: 395 },
      { name: 'runtime-map', x: 228, y: 473, width: 1337, height: 231 },
      { name: 'quota-runway', x: 228, y: 714, width: 707, height: 176 },
      { name: 'pulse-insights', x: 947, y: 714, width: 618, height: 176 },
      { name: 'live-activity', x: 228, y: 899, width: 1337, height: 84 },
    ] : [
      { name: 'header', x: 0, y: 0, width, height: 60 },
      { name: 'sidebar', x: 0, y: 60, width: 226, height: height - 60 },
      { name: referencePage + '-workspace', x: 226, y: 60, width: width - 226, height: height - 60 },
    ];
    const regions = [];
    for (const region of regionBoxes) {
      const x1 = Math.min(width, region.x + region.width), y1 = Math.min(height, region.y + region.height);
      const comparison = measure(region.x, region.y, x1, y1);
      comparison.singleWindowSsim = comparison.ssim;
      comparison.ssim = localSsimAverage(region.x, region.y, x1, y1);
      regions.push({ ...region, comparison });
    }

    const heatmap = document.createElement('canvas');
    heatmap.width = width; heatmap.height = height;
    const heatContext = heatmap.getContext('2d');
    heatContext.drawImage(source.canvas, 0, 0);
    let worstSsim = 1;
    for (const tile of tiles) if (tile.ssim < worstSsim) worstSsim = tile.ssim;
    for (const tile of tiles) {
      const severity = Math.max(0, Math.min(1, (1 - tile.ssim) / Math.max(.01, 1 - worstSsim)));
      heatContext.fillStyle = "rgba(255," + Math.round(126 - severity * 88) + "," + Math.round(72 - severity * 44) + "," + (.1 + severity * .42).toFixed(3) + ")";
      heatContext.fillRect(tile.x, tile.y, tile.width, tile.height);
    }
    function compareTiles(a, b) { return a.ssim - b.ssim; }
    const global = measure(0, 0, width, height);
    global.singleWindowSsim = global.ssim;
    global.ssim = localSsimAverage(0, 0, width, height);
    return {
      width, height, tileSize,
      global,
      tileWeightedSsim: weightedSsim / comparedPixels,
      regions,
      worstTiles: tiles.slice().sort(compareTiles).slice(0, 30),
      heatmapBase64: heatmap.toDataURL('image/png').split(',')[1],
    };
  }`;
  await page.addScriptTag({ content: `window.__quotapulseAnalyze = ${browserAnalysis};` });
  const result = await page.evaluate((input) => (window as any).__quotapulseAnalyze(input), {
    referencePng: reference.toString('base64'),
    candidatePng: candidate.toString('base64'),
    referencePage,
  });

  const outputDir = resolve(outputPath);
  mkdirSync(outputDir, { recursive: true });
  const { heatmapBase64, ...report } = result;
  const verification = {
    referencePage,
    reference: basename(referencePath),
    candidate: basename(candidatePath),
    referenceSha256: createHash('sha256').update(reference).digest('hex'),
    candidateSha256: createHash('sha256').update(candidate).digest('hex'),
    masks: false,
    acceptance: 'Source mismatch diagnostic only; real-data differences are included and no baseline or likeness threshold is approved by this report.',
    note: 'SSIM is averaged over sliding 11x11 uniform luminance windows; tile scores summarize those local values in non-overlapping 32x32 regions. The heatmap overlays relative tile mismatch on the reference. Dynamic real-data differences remain included.',
    ...report,
  };
  writeFileSync(resolve(outputDir, 'reference-parity.json'), JSON.stringify(verification, null, 2));
  writeFileSync(resolve(outputDir, 'reference-heatmap.png'), Buffer.from(heatmapBase64, 'base64'));
  console.log(JSON.stringify({ outputDir, global: report.global, tileWeightedSsim: report.tileWeightedSsim, regions: report.regions }, null, 2));
} finally {
  await browser.close();
}

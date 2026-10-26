import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const base = process.env.BASE_URL || 'http://127.0.0.1:5176';
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(`${base}/catalog/`);
  const card = page.getByRole('link', { name: 'Explore prototype v2 by (concept)', exact: true });
  assert.equal(await card.count(), 1, 'The catalog includes prototype by apov');
  await card.click();
  await page.getByRole('heading', { name: 'prototype v2 (concept)', exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/catalog/product/prototype/');
  await page.getByRole('heading', { name: 'Specifications' }).waitFor();
  assert.equal(await page.locator('.colorway-tile').count(), 24);
  await page.locator('.hero-collage img[src]').evaluateAll(images => Promise.all(images.map(img => img.decode())));
  for (const id of ['01', '02']) {
    const tile = page.locator(`[data-colorway="${id}"]`);
    const before = await page.locator('.hero-collage').boundingBox();
    await tile.click();
    await page.waitForFunction(() => document.querySelector('#colorway-preview-image').naturalWidth === 1800);
    assert.equal(await page.locator('#colorway-preview-image').evaluate(img => img.naturalHeight), 2400);
    const expanded = await page.locator('#colorway-preview').boundingBox();
    assert.ok(Math.abs(before.width - expanded.width) < 1 && Math.abs(before.height - expanded.height) < 1, 'Preview fills only the collage area');
    assert.equal(await page.locator('.colorway-tile:visible').count(), 0);
    if (id === '01') {
      await page.locator('.hero').screenshot({ path: '/tmp/prototype-expanded.png' });
      await page.locator('#colorway-preview').click();
    } else await page.keyboard.press('Escape');
    assert.equal(await page.locator('.colorway-tile:visible').count(), 24);
    assert.equal(await tile.evaluate(element => element === document.activeElement), true);
  }
  assert.equal(await page.locator('.hero').getByText('Explore in 3D', { exact: true }).count(), 0);
  assert.equal(await page.locator('#product-title').evaluate(element => getComputedStyle(element.querySelector('strong')).fontSize === getComputedStyle(element.querySelector('span')).fontSize), true);
  await page.locator('.hero').screenshot({ path: '/tmp/prototype-hero.png' });
  await page.locator('[data-viewer-state="ready"]').waitFor({ timeout: 30000 });
  assert.equal(await page.locator('#viewer').getAttribute('data-viewer-finish'), 'teal');
  assert.equal(await page.locator('#color-case').inputValue(), '#87b6ad');
  const previous = await page.locator('#color-case').inputValue();
  await page.getByRole('button', { name: 'Randomize', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('#random-colorway').disabled);
  assert.notEqual(await page.locator('#color-case').inputValue(), previous);
  assert.equal(await page.locator('#viewer').getAttribute('data-custom-colors'), 'true');
  assert.equal(await page.locator('#customization-panel').isVisible(), false);
  await page.getByRole('button', { name: 'Design my own', exact: true }).click();
  assert.equal(await page.locator('#customization-panel').isVisible(), true);
  const palette = await page.locator('[data-color-part]').evaluateAll(inputs => inputs.map(input => input.value));
  for (const [texture, finish] of [['metal', 'silver'], ['glossy', 'teal'], ['matte', 'teal']]) {
    await page.locator(`[data-texture="${texture}"]`).click();
    await page.locator(`[data-viewer-finish="${finish}"][data-viewer-texture="${texture}"][data-viewer-state="ready"]`).waitFor();
    assert.deepEqual(await page.locator('[data-color-part]').evaluateAll(inputs => inputs.map(input => input.value)), palette, 'Texture changes preserve all colors');
  }
  assert.equal(await page.locator('.color-controls select').count(), 0);
  assert.equal(await page.locator('[data-texture]').count(), 3);
  assert.equal(await page.locator('.color-controls').evaluate(element => getComputedStyle(element).justifyContent), 'center');
  for (const [random, texture] of [[.1, 'glossy'], [.5, 'matte'], [.9, 'metal']]) {
    await page.evaluate(random => {
      const original = Math.random;
      let first = true;
      Math.random = () => { if (first) { first = false; return random; } return original(); };
      try { document.querySelector('#random-colorway').click(); } finally { Math.random = original; }
    }, random);
    await page.locator(`[data-viewer-texture="${texture}"][data-viewer-state="ready"]`).waitFor();
    assert.equal(await page.locator(`[data-texture="${texture}"]`).getAttribute('aria-pressed'), 'true');
  }
  await page.locator('[data-texture="matte"]').click();
  assert.equal(await page.locator('#viewer').getAttribute('data-random-streak'), '0');
  for (let index = 1; index <= 20; index++) {
    await page.getByRole('button', { name: 'Randomize', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('#random-colorway').disabled);
    assert.equal(await page.locator('#viewer').getAttribute('data-random-streak'), String(index));
    if (index < 20) assert.equal(await page.locator('#viewer').getAttribute('data-rare-texture'), null);
  }
  assert.equal(await page.locator('#viewer').getAttribute('data-rare-texture'), 'streets');
  assert.equal(await page.locator('#pattern-credit').isVisible(), true);
  await page.locator('#explore').screenshot({ path: '/tmp/prototype-rare.png' });
  await page.locator('#auto-rotate').click();
  const beforeRotate = await page.locator('#model-canvas').screenshot();
  await page.evaluate(() => new Promise(resolve => { let frames = 0; const step = () => ++frames >= 30 ? resolve() : requestAnimationFrame(step); requestAnimationFrame(step); }));
  assert.notDeepEqual(await page.locator('#model-canvas').screenshot(), beforeRotate, 'Auto rotation changes the view');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save image', exact: true }).click()]);
  await download.saveAs('/tmp/prototype-download.png');
  const png = await readFile('/tmp/prototype-download.png');
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(Math.max(png.readUInt32BE(16), png.readUInt32BE(20)), 7680);
  await page.waitForFunction(() => !document.querySelector('#save-image').disabled);
  assert.equal(await page.locator('#save-image').evaluate(el => document.activeElement === el), true);
  assert.equal(await page.locator('#auto-rotate').getAttribute('aria-pressed'), 'true');
  await page.locator('#auto-rotate').click();
  await page.locator('#color-case').fill('#50786e');
  assert.equal(await page.locator('#viewer').getAttribute('data-random-streak'), '0');
  assert.equal(await page.locator('#viewer').getAttribute('data-rare-texture'), null);
  assert.equal(await page.locator('#pattern-credit').isVisible(), false);
  assert.equal(await page.locator('#design').count(), 0);
  assert.equal(await page.locator('main > section:last-child').getAttribute('id'), 'user-photos');
  assert.equal(await page.locator('.design-specs > div:last-child a').getAttribute('href'), '../prototype-developer/');
  assert.equal(await page.locator('#user-photos').count(), 1);
  await page.locator('#user-photos').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('#user-photos img').count(), 0);
  assert.equal(await page.locator('.user-photos-empty').innerText(), 'No community photos yet.');
  await page.locator('#user-photos').screenshot({ path: '/tmp/prototype-community.png' });
  assert.match(await page.locator('#specifications').innerText(), /ESP32-S31/);
  assert.match(await page.locator('#specifications').innerText(), /16 GB built-in storage/);
  assert.doesNotMatch(await page.locator('#specifications').innerText(), /32 GB|64 GB|Cortex|Linux/);
  assert.equal(await page.locator('.viewer-help, .finish-options, .downloads').count(), 0);
  for (const link of await page.locator('[data-preorder]').all()) {
    assert.equal(await link.getAttribute('href'), '/catalog/purchase/');
  }
  await page.locator('#color-case').fill('#be5547');
  await page.locator('#color-front').fill('#dedbd0');
  await page.locator('#color-buttons').fill('#2f535e');
  assert.equal(await page.locator('#viewer').getAttribute('data-custom-colors'), 'true');
  await page.locator('#model-canvas canvas').focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('+');
  await page.getByRole('button', { name: '中文', exact: true }).click();
  assert.equal(await page.locator('html').getAttribute('lang'), 'zh-CN');
  await page.getByRole('heading', { name: '规格' }).waitFor();
  await page.reload();
  assert.equal(await page.locator('html').getAttribute('lang'), 'zh-CN');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  for (const img of await page.locator('img[src]:visible').all()) {
    await img.scrollIntoViewIfNeeded();
    await img.evaluate(element => element.decode());
  }
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: '/tmp/prototype-desktop.png', fullPage: true });
  await page.locator('[data-viewer-state="ready"]').waitFor({ timeout: 30000 });
  await page.locator('#explore').screenshot({ path: '/tmp/prototype-viewer.png' });
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(`${base}/catalog/product/prototype/`);
  await mobile.locator('[data-viewer-state="ready"]').waitFor({ timeout: 30000 });
  await mobile.screenshot({ path: '/tmp/prototype-mobile.png' });
  await mobile.locator('#explore').screenshot({ path: '/tmp/prototype-mobile-viewer.png' });
  for (const width of [390, 320]) {
    await mobile.setViewportSize({ width, height: 844 });
    await mobile.locator('#design-own').click();
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `No overflow at ${width}px`);
    await mobile.locator('[data-colorway="03"]').click();
    assert.equal(await mobile.locator('#colorway-preview').isVisible(), true);
    await mobile.locator('#colorway-preview').click();
  }
  await mobile.close();
  await page.getByRole('link', { name: 'All products', exact: true }).first().click();
  await page.getByRole('link', { name: 'Explore OBOOK5 by Guowen', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  await page.getByRole('button', { name: 'Close product' }).click();
  assert.equal(await page.locator('dialog[open]').count(), 0);
  await page.getByRole('button', { name: '中文', exact: true }).click();
  assert.equal(await page.locator('a[href="/catalog/product/prototype/"]').count(), 1);
  await page.route('**/*.glb*', route => route.abort());
  await page.goto(`${base}/catalog/product/prototype/`);
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.locator('[data-viewer-state="error"]').waitFor();
  assert.equal(await page.locator('#viewer-poster').isVisible(), true);
  await page.unroute('**/*.glb*');
  await page.getByRole('button', { name: 'Load 3D model' }).click();
  await page.locator('[data-viewer-state="ready"]').waitFor({ timeout: 30000 });
  assert.deepEqual(errors, [], 'No uncaught browser errors');
  const noJS = await browser.newPage({ javaScriptEnabled: false });
  await noJS.goto(`${base}/catalog/product/prototype/`);
  assert.equal(await noJS.getByRole('heading', { name: 'Specifications' }).isVisible(), true);
  assert.equal(await noJS.locator('.downloads').count(), 0);
  console.log('PASS: auto-loading model, 24 high-resolution tiles, inline expansion/click/Escape/focus, catalog navigation, existing product modal, three textures, color preservation, 20-random easter egg, 8K PNG, auto rotation, concept pre-order buttons, keyboard controls, languages, reload, mobile, model failure/retry, no-JS content, browser errors.');
} finally { await browser.close(); }

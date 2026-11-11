import assert from 'node:assert/strict';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || '/Users/Ke/side_projects/obook5_3d_model/node_modules/@playwright/test/index.mjs');
const base = process.env.BASE_URL || 'http://127.0.0.1:5187';
const browser = await chromium.launch({...(process.env.PLAYWRIGHT_EXECUTABLE ? {executablePath:process.env.PLAYWRIGHT_EXECUTABLE} : {channel:'chrome'}), headless:true});
const errors = [];
async function pageFor(options = {}, fallback = false) {
  const page = await browser.newPage(options);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://cloud.umami.is/**', route => route.abort());
  if (fallback) await page.addInitScript(() => {
    Element.prototype.requestFullscreen = () => Promise.reject(new Error('Fullscreen unavailable'));
  });
  return page;
}
async function open(page, id) {
  await page.goto(`${base}/catalog/product/${id}/`);
  await page.locator('#viewer').scrollIntoViewIfNeeded();
  await page.waitForSelector('#viewer[data-viewer-state=ready]');
  await page.getByRole('button', {name:'Full screen', exact:true}).click({timeout:5000});
  await page.waitForSelector('dialog[open]');
  assert(await page.locator('dialog #customization-panel').isVisible(), `${id}: colors visible in fullscreen`);
  assert.equal(await page.locator('#model-canvas canvas').evaluate(el => getComputedStyle(el).touchAction), 'none');
}
try {
  const page = await pageFor({viewport:{width:1200,height:900}});
  for (const id of ['obook5-v2','paper-mono-v2','mindreset-read-pico','metalio-eink4-plus-47','prototype-game','pkd','prototype','m5stack-paper-s3']) {
    await open(page, id);
    await page.waitForFunction(() => document.fullscreenElement, null, {timeout:5000});
    assert(await page.evaluate(() => document.fullscreenElement?.contains(document.querySelector('#customization-panel'))), 'native fullscreen includes controls');
    const input = page.locator('input[type=color]').first();
    const appearance=page.locator('canvas').first();
    const before = await appearance.screenshot();
    await input.fill('#c84362');
    assert(!before.equals(await appearance.screenshot()), `${id}: model visibly recolored`);
    await page.getByRole('button', {name:'Exit full screen', exact:true}).click();
    await page.waitForSelector('dialog[open]', {state:'detached'});
    assert.equal(await input.inputValue(), '#c84362');
    assert.equal(await page.locator('#model-canvas canvas').evaluate(el => getComputedStyle(el).touchAction), id==='m5stack-paper-s3'?'none':'pan-y');
    assert.equal(await page.locator('#customization-panel').isVisible(), false, 'restore collapsed panel');
    assert(await page.getByRole('button',{name:'Full screen',exact:true}).evaluate(el => el === document.activeElement));
    await page.getByRole('button',{name:'中文',exact:true}).click();
    await page.getByRole('button',{name:'全屏',exact:true}).click();
    await page.waitForFunction(() => document.fullscreenElement);
    await page.evaluate(() => document.exitFullscreen());
    await page.waitForSelector('dialog[open]',{state:'detached'});
    assert(await page.getByRole('button',{name:'全屏',exact:true}).isVisible());
    await page.getByRole('button',{name:'English',exact:true}).click();
    console.log('PASS fullscreen, recolor, restoration and native exit:', id);
  }
  await page.goto(`${base}/catalog/product/prototype-developer/`);
  await page.locator('.developer-viewer--ready').waitFor();
  await page.getByRole('button',{name:'Full screen',exact:true}).click();
  await page.waitForFunction(()=>document.fullscreenElement);
  await page.getByRole('button',{name:'Side page keys',exact:true}).click();
  assert.equal(await page.locator('#developer-viewer').getAttribute('data-developer-layout'),'side');
  assert.equal(await page.locator('canvas').evaluate(el=>getComputedStyle(el).touchAction),'none');
  await page.getByRole('button',{name:'Exit full screen',exact:true}).click();
  await page.waitForSelector('dialog[open]',{state:'detached'});
  assert.equal(await page.locator('#developer-viewer').getAttribute('data-developer-layout'),'side');
  console.log('PASS developer edition fullscreen and layout controls');
  await page.close();
  const mobile = await pageFor({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}, true);
  await open(mobile, 'metalio-eink4-plus-47');
  assert.equal(await mobile.evaluate(() => document.fullscreenElement), null, 'fallback used');
  const dialog = await mobile.locator('dialog').boundingBox();
  assert(dialog.x === 0 && dialog.y === 0 && dialog.width === 390 && dialog.height === 844, 'fallback fills viewport');
  const canvas = mobile.locator('#model-canvas canvas');
  const box = await canvas.boundingBox();
  const cdp = await mobile.context().newCDPSession(mobile);
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const gesture = async points => {
    await cdp.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:points[0]});
    for (const touchPoints of points.slice(1)) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  };
  let before = await canvas.screenshot();
  await gesture(Array.from({length:9},(_,i)=>[{x,y:y+i*12,id:1}]));
  assert(!before.equals(await canvas.screenshot()),'vertical touch rotates model');
  assert.equal(await mobile.locator('dialog').evaluate(el=>el.scrollTop),0,'vertical drag does not scroll dialog');
  before = await canvas.screenshot();
  await gesture(Array.from({length:9},(_,i)=>[{x:x-30-i*8,y,id:1},{x:x+30+i*8,y,id:2}]));
  assert(!before.equals(await canvas.screenshot()),'pinch zoom changes model');
  assert.equal(await mobile.evaluate(()=>visualViewport.scale),1,'pinch does not zoom page');
  await mobile.locator('input[type=color]').first().fill('#226688');
  await mobile.screenshot({path:'/private/tmp/catalog-fullscreen-mobile.png'});
  await mobile.setViewportSize({width:844,height:390});
  const exitBox = await mobile.getByRole('button',{name:'Exit full screen',exact:true}).boundingBox();
  assert(exitBox.x >= 0 && exitBox.y >= 0 && exitBox.y + exitBox.height <= 390, 'landscape exit stays visible');
  await mobile.screenshot({path:'/private/tmp/catalog-fullscreen-landscape.png'});
  await mobile.keyboard.press('Escape');
  await mobile.waitForSelector('dialog[open]',{state:'detached'});
  assert.equal(await mobile.locator('input[type=color]').first().inputValue(),'#226688');
  assert.equal(await mobile.locator('body').evaluate(el=>el.style.position),'');
  await mobile.close();
  assert.deepEqual(errors,[]);
  console.log('PASS mobile fallback, vertical rotation, pinch zoom, color, landscape and Escape; no browser exceptions');
} finally { await browser.close(); }

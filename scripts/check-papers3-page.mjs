import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || '/Users/Ke/side_projects/obook5_3d_model/node_modules/@playwright/test/index.mjs');
const browser = await chromium.launch({...(process.env.PLAYWRIGHT_EXECUTABLE ? {executablePath:process.env.PLAYWRIGHT_EXECUTABLE} : {channel:'chrome'}), headless:true});
const base = process.env.BASE_URL || 'http://127.0.0.1:5187';
const page = await browser.newPage({viewport:{width:1200,height:950}});
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.route('https://cloud.umami.is/**', r => r.abort());
if(process.env.SIMULATOR_WASM_PATH)await page.route('**/wasm/esp32sim.wasm',async r=>r.fulfill({contentType:'application/wasm',body:await readFile(process.env.SIMULATOR_WASM_PATH)}));
// Record actual UI input receipts so click duration follows guest time even
// when several browser checks compete for CPU on the host.
const adapter=await readFile(new URL('../catalog/product/m5stack-paper-s3/runtime.js',import.meta.url),'utf8');
await page.route('**/catalog/product/m5stack-paper-s3/runtime.js*',route=>route.fulfill({contentType:'text/javascript',body:adapter.replace(
  "touch: ({x, y, pressed}) => runtime.input({type: 'touch', x, y, down: pressed}),",
  "touch: async ({x,y,pressed}) => {const receipt=await runtime.input({type:'touch',x,y,down:pressed});window.lastTouchReceipt={x,y,pressed,...receipt};return receipt;},"
)}));
async function press(x,y){
  await page.evaluate(()=>window.lastTouchReceipt=null);
  await page.mouse.move(x,y);await page.mouse.down();
  await page.waitForFunction(()=>window.lastTouchReceipt?.pressed);
  const first=await page.evaluate(()=>window.lastTouchReceipt);
  assert(Math.abs(first.x-116)<=1&&Math.abs(first.y-330)<=1,'DOM click maps to guest touch');
  await page.evaluate(async first=>{
    let time=first.guestTime;
    while(time<first.guestTime+.12){await new Promise(r=>setTimeout(r,10));time=(await window.__paperS3.runtime.touch({x:first.x,y:first.y,pressed:true})).guestTime;}
  },first);
  await page.mouse.up();
}
try {
  await page.goto(`${base}/catalog/product/m5stack-paper-s3/`);
  await page.locator('#viewer[data-viewer-state=ready]').waitFor({timeout:20000});
  assert.equal(await page.getByRole('heading', {name:'Virtual Paper S3 (concept)'}).count(), 1);
  await page.getByRole('button',{name:'Design my own',exact:true}).click();
  await page.locator('#shell-color').fill('#617e74');
  assert.equal(await page.locator('#viewer').getAttribute('data-shell-color'),'#617e74');
  await page.locator('#boot-official').click();
  await page.waitForFunction(()=>window.__paperS3.runtime?.state.stats.time>14&&document.querySelector('#serial-output').textContent.includes('AppWifi'),null,{timeout:180000});
  assert.equal(await page.locator('#viewer').getAttribute('data-interaction-mode'),'firmware');
  assert(await page.locator('#runtime-status').textContent());
  await page.locator('#viewer').scrollIntoViewIfNeeded();
  const touchPoint = await page.evaluate(()=>window.__paperS3.viewer.screenPoint(116,330));
  const mutePixels = () => page.evaluate(async()=>{
    const frame=await window.__paperS3.runtime.capture();let dark=0;
    for(let y=326;y<336;y++)for(let x=112;x<122;x++)if(frame.pixels[(y*frame.width+x)*4]<128)dark++;
    return dark;
  });
  assert(await mutePixels()>40,'official firmware mute icon initially visible');
  const touchX=touchPoint.x,touchY=touchPoint.y;
  assert(touchX>0&&touchY>0&&touchY<950,'firmware touch target is in viewport');
  await press(touchX,touchY);
  const touchTime=await page.evaluate(()=>window.__paperS3.runtime.state.stats.time);
  await page.waitForFunction(time=>window.__paperS3.runtime.state.stats.time>time+5,touchTime,{timeout:60000});
  assert(await mutePixels()<10,'click on the firmware screen reaches guest GT911 touch');
  await page.locator('#rotate-device').click();
  const rotatedPoint=await page.evaluate(()=>window.__paperS3.viewer.screenPoint(116,330));
  await press(rotatedPoint.x,rotatedPoint.y);
  const secondTouchTime=await page.evaluate(()=>window.__paperS3.runtime.state.stats.time);
  await page.waitForFunction(time=>window.__paperS3.runtime.state.stats.time>time+5,secondTouchTime,{timeout:60000});
  assert(await mutePixels()>40,'rotated screen maps touch back to original firmware coordinates');
  await page.locator('#pause-firmware').click();
  await page.waitForFunction(()=>window.__paperS3.runtime.state.status==='paused');
  await page.locator('#pause-firmware').click();
  await page.waitForFunction(()=>window.__paperS3.runtime.state.status==='running');
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  await page.screenshot({path:'/private/tmp/papers3-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Full screen',exact:true}).click();
  assert(await page.locator('dialog #firmware-controls').isVisible());
  assert(await page.locator('dialog #model-canvas canvas').isVisible());
  assert(await page.locator('dialog #customization-panel').isVisible());
  await page.getByRole('button',{name:'Exit full screen',exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  await page.locator('#rotate-device').click();
  await page.screenshot({path:'/private/tmp/papers3-mobile.png',fullPage:true});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#firmware-file').setInputFiles({name:'invalid.bin',mimeType:'application/octet-stream',buffer:Buffer.from('invalid')});
  await page.locator('#firmware-error:not(:empty)').waitFor();
  assert.equal(await page.evaluate(()=>window.__paperS3.runtime.state.status),'running','invalid file keeps running device');
  // Exercise BFCache lifecycle even on browser builds that evict worker pages.
  await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
  await page.waitForFunction(()=>window.__paperS3.runtime.state.status==='paused');
  await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
  await page.locator('#pause-firmware').click();
  await page.waitForFunction(()=>window.__paperS3.runtime.state.status==='running');
  await page.getByRole('button',{name:'中文',exact:true}).click();
  assert.equal(await page.locator('html').getAttribute('lang'),'zh-CN');
  await page.goto(`${base}/catalog/`);
  await page.locator('a.product-link[href="/catalog/product/m5stack-paper-s3/"]').click();
  await page.waitForURL('**/catalog/product/m5stack-paper-s3/');
  assert.deepEqual(errors,[]);
  console.log('PASS PaperS3 catalog page, real firmware boot, rotation, pause/resume, invalid file recovery, fullscreen and mobile layout');
} finally {await browser.close();}

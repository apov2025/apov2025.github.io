import assert from 'node:assert/strict';
import {chromium} from '/Users/Ke/side_projects/obook5_3d_model/node_modules/@playwright/test/index.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/catalog/product/m5stack-paper-s3/runtime.js*',r=>r.fulfill({contentType:'text/javascript',body:`export async function createPaperRuntime({onState}){let state={status:'configured'};window.touches=[];return{get state(){return state},async bootDefault(){state={status:'running'};onState(state)},async touch(p){window.touches.push(p)},async dispose(){}}}`}));
async function bounds(){return page.evaluate(()=>window.__paperS3.viewer.screenBounds());}
async function tap(x,y){const p=await page.evaluate(([x,y])=>window.__paperS3.viewer.screenPoint(x,y),[x,y]);await page.touchscreen.tap(p.x,p.y);const t=await page.evaluate(()=>window.touches.slice(-2));assert.equal(t[0].pressed,true);assert(Math.abs(t[0].x-x)<2&&Math.abs(t[0].y-y)<2);}
try{
await page.goto('http://127.0.0.1:5187/catalog/product/m5stack-paper-s3/');await page.locator('#viewer[data-viewer-state=ready]').waitFor();await page.locator('#boot-firmware').click();const old=await bounds();
await page.getByRole('button',{name:'Full screen',exact:true}).click();await page.waitForTimeout(150);
const large=await bounds();assert(large.height>844*.6,JSON.stringify(large));assert(large.height>old.height*1.4);assert(large.left>=10&&large.left+large.width<380);assert(large.top>=40&&large.top+large.height<790);
assert(!(await page.locator('#customization-panel').isVisible()));await tap(115,330);
await page.screenshot({path:'/private/tmp/papers3-fullscreen-large-phone.png'});
await page.getByRole('button',{name:'Controls & colors',exact:true}).click();assert(await page.locator('#customization-panel').isVisible());assert(await page.locator('#firmware-file').isVisible());
await page.locator('#shell-color').fill('#436a56');await page.locator('#hook-visible').uncheck();await page.getByRole('button',{name:'Hide controls',exact:true}).click();assert(!(await page.locator('#customization-panel').isVisible()));assert.deepEqual(await bounds(),large,'opening controls must not shrink or move device');
await tap(410,700);
await page.locator('#rotate-device').click();await page.setViewportSize({width:844,height:390});await page.waitForTimeout(150);
const landscape=await bounds();assert(landscape.width>400&&landscape.left>=0&&landscape.left+landscape.width<=844,JSON.stringify(landscape));assert(landscape.top>=35&&landscape.top+landscape.height<340);await tap(115,330);
await page.screenshot({path:'/private/tmp/papers3-fullscreen-large-landscape.png'});
await page.getByRole('button',{name:'Controls & colors',exact:true}).click();assert(await page.locator('#customization-panel').isVisible());await page.getByRole('button',{name:'Exit full screen',exact:true}).click();assert.equal(await page.locator('#shell-color').inputValue(),'#436a56');assert(!(await page.locator('#hook-visible').isChecked()));assert.equal(await page.locator('dialog[open]').count(),0);
assert.deepEqual(errors,[]);console.log('PASS phone display',JSON.stringify({before:old,fullscreen:large,landscape}), 'collapsed/overlay controls, touch, colors, hook and exit restoration');
}finally{await browser.close();}

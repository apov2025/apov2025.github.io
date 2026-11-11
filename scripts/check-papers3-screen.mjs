import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/Users/Ke/side_projects/obook5_3d_model/node_modules/@playwright/test/index.mjs');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
await page.route('**/catalog/product/m5stack-paper-s3/runtime.js*',route=>route.fulfill({contentType:'text/javascript',body:`
export async function createPaperRuntime({onState}){
 let state={status:'configured',stats:{}};window.touches=[];
 return {get state(){return state},async bootDefault(){state={status:'running',stats:{}};onState(state);},async touch(p){window.touches.push(p);},async dispose(){}};
}`}));
try{
 await page.goto((process.env.BASE_URL||'http://127.0.0.1:5187')+'/catalog/product/m5stack-paper-s3/');
 await page.locator('#viewer[data-viewer-state=ready]').waitFor();
 assert.equal(await page.locator('#model-mode').count(),0);
 assert.equal(await page.locator('#firmware-mode').getAttribute('aria-pressed'),'true');
 const canvas=page.locator('#model-canvas canvas');
 await canvas.focus();
 const initial=await canvas.screenshot();const box=await canvas.boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
 await page.mouse.move(box.x+box.width/2+70,box.y+box.height/2+40,{steps:8});await page.mouse.up();
 await canvas.focus();await page.keyboard.press('ArrowRight');
 assert(initial.equals(await canvas.screenshot()),'screen dragging and arrow keys do not rotate the original model');
 await page.locator('#boot-firmware').click();
 await page.waitForFunction(()=>window.__paperS3.runtime?.state.status==='running');
 for(const full of [false,true]){
  if(full)await page.getByRole('button',{name:'Full screen',exact:true}).click();
  for(let rotation=0;rotation<4;rotation++){
   await page.locator('#viewer').scrollIntoViewIfNeeded();
   const p=await page.evaluate(()=>window.__paperS3.viewer.screenPoint(116,330));
   await page.touchscreen.tap(p.x,p.y);
   const touch=await page.evaluate(()=>window.touches.slice(-2));
   assert.equal(touch.length,2);
   assert.equal(touch[0].pressed,true);assert.equal(touch[1].pressed,false);
   assert(Math.abs(touch[0].x-116)<=2&&Math.abs(touch[0].y-330)<=2,JSON.stringify({rotation,full,touch}));
   const b=await page.locator('#model-canvas').boundingBox();
   assert(b.width>0&&b.x>=0&&b.x+b.width<=391);
   await page.locator('#rotate-device').click();
  }
 }
 await page.locator('#shell-color').fill('#347165');
 assert.equal(await page.locator('#viewer').getAttribute('data-shell-color'),'#347165');
 await page.screenshot({path:'/private/tmp/papers3-flat-mobile-fullscreen.png'});
 await page.getByRole('button',{name:'Exit full screen',exact:true}).click();
 assert.equal(await page.locator('#shell-color').inputValue(),'#347165');
 console.log('PASS original model restored, screen drag isolated from orbit, mobile touch in all four orientations, fullscreen mapping, shell sizing and colors');
}finally{await browser.close();}

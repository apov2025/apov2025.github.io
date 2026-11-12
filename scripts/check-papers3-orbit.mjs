import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/Users/Ke/side_projects/obook5_3d_model/node_modules/@playwright/test/index.mjs');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1000,height:1000},hasTouch:true});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.route('**/catalog/product/m5stack-paper-s3/runtime.js*',route=>route.fulfill({contentType:'text/javascript',body:`
export async function createPaperRuntime({onState}){let state={status:'configured',stats:{}};window.touches=[];return {get state(){return state},async bootDefault(){state={status:'running',stats:{}};onState(state)},async touch(p){window.touches.push(p)},async dispose(){}}}
`}));
const point=(x,y)=>page.evaluate(([x,y])=>window.__paperS3.viewer.screenPoint(x,y),[x,y]);
async function dragOutside(dx,dy=0){
 const b=await page.locator('#model-canvas canvas').boundingBox();
 await page.mouse.move(b.x+15,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+15+dx,b.y+b.height/2+dy,{steps:12});await page.mouse.up();
}
async function checkTouch(x,y){
 const p=await point(x,y);await page.touchscreen.tap(p.x,p.y);
 const events=await page.evaluate(()=>window.touches.slice(-2));
 assert.equal(events[0].pressed,true);assert.equal(events[1].pressed,false);
 assert(Math.abs(events[0].x-x)<=1&&Math.abs(events[0].y-y)<=1,JSON.stringify(events));
}
try{
 await page.goto((process.env.BASE_URL||'http://127.0.0.1:5187')+'/catalog/product/m5stack-paper-s3/');await page.locator('#viewer[data-viewer-state=ready]').waitFor();
 await page.locator('#boot-firmware').click();await page.locator('#viewer').scrollIntoViewIfNeeded();
 const initial=await point(110,300);
 await dragOutside(65,28);assert.notDeepEqual(await point(110,300),initial,'outside drag rotates camera');
 assert.equal(await page.evaluate(()=>window.touches.length),0,'orbit sends no firmware touch');
 await checkTouch(110,300);await checkTouch(410,760);
 const before=await point(270,480),p=await point(170,350);
 await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+30,p.y+20,{steps:5});await page.mouse.up();
 assert.deepEqual(await point(270,480),before,'screen drag cannot orbit the model');
 await page.locator('#reset-view').click();await page.locator('#viewer').scrollIntoViewIfNeeded();
 await dragOutside(Math.PI/.008);
 const count=await page.evaluate(()=>window.touches.length);const back=await point(270,480);await page.mouse.click(back.x,back.y);
 assert.equal(await page.evaluate(()=>window.touches.length),count,'back of device cannot touch its hidden display');
 await page.locator('#reset-view').click();await page.locator('#viewer').scrollIntoViewIfNeeded();
 const center=await point(270,480),bounds=await page.evaluate(()=>window.__paperS3.viewer.screenBounds());
 await page.mouse.move(center.x,center.y);await page.mouse.wheel(0,-80);
 assert((await page.evaluate(()=>window.__paperS3.viewer.screenBounds())).width>bounds.width,'wheel zooms');
 await page.locator('#reset-view').click();
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Full screen',exact:true}).click();
 const c=await point(270,480),old=await page.evaluate(()=>({bounds:window.__paperS3.viewer.screenBounds(),touches:window.touches.length,scroll:scrollY}));
 const client=await page.context().newCDPSession(page);
 const touches=d=>[{x:c.x-d,y:c.y,id:1},{x:c.x+d,y:c.y,id:2}];
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touches(25)});
 await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:touches(45)});
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 // A second finger may arrive well after an ordinary tap delay.
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touches(25).slice(0,1)});
 await page.waitForTimeout(350);
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touches(25)});
 await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:touches(40)});
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const after=await page.evaluate(()=>({bounds:window.__paperS3.viewer.screenBounds(),touches:window.touches.length,scroll:scrollY}));
 assert(after.bounds.width>old.bounds.width,'two-finger gesture zooms');assert.equal(after.touches,old.touches,'pinch does not send an accidental book tap');assert.equal(after.scroll,old.scroll,'fullscreen gesture does not scroll page');
 await page.locator('#reset-view').click();
 for(let i=0;i<4;i++){await dragOutside(35,10);await checkTouch(180,500);await page.locator('#rotate-device').click();}
 await page.getByRole('button',{name:'Controls & colors',exact:true}).click();
 await page.locator('#shell-color').fill('#ed576a');await page.locator('#front-color').fill('#353951');
 await page.screenshot({path:'/private/tmp/papers3-orbit-mobile.png'});
 assert.deepEqual(errors,[]);console.log('PASS orbit outside screen, perspective touch, screen drag isolation, hidden-back rejection, wheel/pinch zoom without guest input or page scroll, four orientations and fullscreen colors');
}finally{await browser.close();}

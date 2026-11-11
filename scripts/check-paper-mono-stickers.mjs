import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'@playwright/test');
const base=process.env.BASE_URL||'http://127.0.0.1:5176';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1280,height:1200}}),errors=[],writes=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('request',req=>{if(req.method()!=='GET')writes.push(req.url());});
 await page.route('https://cloud.umami.is/**',r=>r.abort());
 await page.goto(`${base}/catalog/product/paper-mono-v2/`);
 await page.waitForSelector('#viewer[data-viewer-state="ready"]');
 await page.locator('#design-own').click();
 assert.equal(await page.locator('[data-sticker]').count(),1);
 await page.locator('[data-view="back"]').click();
 const model=page.locator('#model-canvas canvas'),before=await model.screenshot();
 const fixture=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=400;c.height=500;const x=c.getContext('2d');x.fillStyle='#ffffff';x.fillRect(0,0,400,500);x.fillStyle='#e63b32';x.fillRect(0,0,400,100);x.fillStyle='#297c48';x.fillRect(0,400,400,100);x.fillStyle='#111';x.font='bold 60px sans-serif';x.fillText('MY',100,220);x.fillText('STICKER',45,300);return c.toDataURL().split(',')[1];});
 await page.locator('#sticker-upload').setInputFiles({name:'my-sticker.png',mimeType:'image/png',buffer:Buffer.from(fixture,'base64')});
 await page.waitForFunction(()=>document.querySelectorAll('[data-sticker]').length===5);
 assert.equal(await page.locator('#sticker-editor').getAttribute('data-selected-sticker'),'0');
 const thumbnails=await page.locator('[data-sticker] canvas').evaluateAll(nodes=>nodes.map(c=>c.toDataURL()));assert.equal(new Set(thumbnails).size,5);
 const poses=[];
 for(let index=0;index<4;index++){
  await page.locator(`[data-sticker="${index}"]`).click();
  const pose=await model.screenshot();assert(!before.equals(pose),'Uploaded image visibly changes actual model');assert(!poses.some(previous=>previous.equals(pose)),'Each layout visibly changes model');poses.push(pose);
 }
 await page.locator('[data-sticker="0"]').click();
 await model.screenshot({path:'/private/tmp/paper-mono-upload-model.png'});
 await page.locator('#explore').screenshot({path:'/private/tmp/paper-mono-stickers-desktop.png'});
 await page.locator('[data-sticker="-1"]').click();
 assert(before.equals(await model.screenshot()),'Original restores original model render exactly');
 await page.locator('#sticker-shuffle').click();
 const newThumbnails=await page.locator('[data-sticker] canvas').evaluateAll(nodes=>nodes.map(c=>c.toDataURL()));assert(newThumbnails.slice(1).every((v,i)=>v!==thumbnails[i+1]));
 await page.getByRole('button',{name:'中文',exact:true}).click();assert.equal(await page.locator('#sticker-shuffle').innerText(),'重新生成');assert.equal(await page.locator('[data-sticker="-1"]').innerText(),'原版');
 await page.locator('[data-sticker="2"]').click();assert.equal(await page.locator('[data-sticker="2"]').getAttribute('aria-pressed'),'true');
 await page.locator('#sticker-upload').setInputFiles({name:'bad.txt',mimeType:'text/plain',buffer:Buffer.from('not an image')});await page.waitForFunction(()=>document.querySelector('.sticker-status').textContent.includes('20 MB'));
 assert.equal(await page.locator('#sticker-editor').getAttribute('data-selected-sticker'),'2');
 assert.equal(await page.locator('#sticker-shuffle').isDisabled(),false);
 await page.setViewportSize({width:320,height:844});await page.locator('#sticker-editor').scrollIntoViewIfNeeded();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.locator('#sticker-editor').screenshot({path:'/private/tmp/paper-mono-stickers-mobile.png'});
 assert.deepEqual(writes,[],'No image upload/network writes');assert.deepEqual(errors,[]);
 console.log('PASS: image uploads locally, four distinct actual rear-label layouts, previews, regeneration, exact original restoration, invalid-file recovery, bilingual UI, mobile fit, no network writes/errors.');
} finally {await browser.close()}

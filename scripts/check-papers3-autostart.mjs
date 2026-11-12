// Actual EDCBook startup, no Run/Restart clicks; pinned firmware and guest pixels.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'@playwright/test');
const browser=await chromium.launch({channel:'chrome',headless:true});
const proof=process.env.PROOF_DIR||'/private/tmp/papers3-autostart';await mkdir(proof,{recursive:true});
try {
 const page=await browser.newPage({viewport:{width:1200,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 if(process.env.EDCBOOK_BIN){const bytes=await readFile(process.env.EDCBOOK_BIN);assert.equal(createHash('sha256').update(bytes).digest('hex'),'06eb3b595fc47bc5d35f760a16cdc5795ea8c0fad6295bcee8db5268cf906986');await page.route('**/e9a34bd8a7095acf6a43dae2b1565a60.bin',r=>r.fulfill({body:bytes,contentType:'application/octet-stream'}));}
 const waitReady=()=>page.waitForFunction(()=>window.__paperS3?.runtime?.state.startup?.phase==='ready',null,{timeout:Number(process.env.STARTUP_TIMEOUT||180000)});
 const capture=async name=>{const frame=await page.evaluate(async()=>{const r=window.__paperS3.runtime,f=await r.capture(),c=document.createElement('canvas');c.width=f.width;c.height=f.height;c.getContext('2d').putImageData(new ImageData(f.pixels,f.width,f.height),0,0);let h=2166136261;for(let y=18;y<50;y++)for(let x=180;x<360;x++)h=Math.imul(h^(f.pixels[(y*f.width+x)*4]<128?1:0),16777619)>>>0;const body=await crypto.subtle.digest('SHA-256',f.pixels.slice(f.width*80*4,f.width*900*4));return {png:c.toDataURL().split(',')[1],header:h,bodyHash:[...new Uint8Array(body)].map(n=>n.toString(16).padStart(2,'0')).join(''),startup:r.state.startup};});await writeFile(`${proof}/${name}.png`,Buffer.from(frame.png,'base64'));delete frame.png;console.log(name,frame);return frame;};
 await page.goto((process.env.BASE_URL||'http://127.0.0.1:5187')+'/catalog/product/m5stack-paper-s3/');
 await waitReady();assert.equal((await capture('cold-library')).header,0xe10d372e,'Default startup reaches /book in real firmware');
 assert(!/预置|includes Journey/.test(await page.locator('#book-import-status').textContent()),'No unconditional bundled-book claim');
 await page.evaluate(async()=>{const r=window.__paperS3.runtime;await r.touch({x:450,y:905,pressed:true});await r.touch({x:450,y:905,pressed:false});});
 const time=await page.evaluate(()=>window.__paperS3.runtime.state.stats.time);await page.waitForFunction(t=>window.__paperS3.runtime.state.stats.time>t+3,time,{timeout:120000});
 const reading=await capture('xiyouji-reading');assert.equal(reading.bodyHash,'5c675f0e21341133493ee341d3f33c4b8a014a025b0e4650f148220e92c4f7e5','Bundled Journey to the West opens in actual EDCBook');
 await page.evaluate(()=>window.__paperS3.runtime.pause());await page.reload();await waitReady();
 assert.equal((await capture('restored-library')).header,0xe10d372e,'Stored device also starts at /book without a manual restart');
 await page.locator('#pause-firmware').click();await page.waitForFunction(()=>window.__paperS3.runtime.state.status==='paused');assert.equal(await page.evaluate(()=>window.__paperS3.runtime.state.status),'paused');
 await page.locator('#viewer').scrollIntoViewIfNeeded();
 const key=await page.evaluate(()=>window.__paperS3.viewer.screenPoint(584,880));
 await page.mouse.click(key.x,key.y);
 await page.waitForFunction(()=>window.__paperS3.runtime.state.status==='running'&&(window.__paperS3.runtime.state.stats.time||0)<4,null,{timeout:120000});
 await page.waitForFunction(()=>window.__paperS3.runtime.state.stats.time>=12,null,{timeout:120000});
 assert((await page.locator('#serial-output').textContent()).includes('ESP-ROM:esp32s3'),'3D side key really rebooted the original firmware');
 await capture('physical-key-reboot');
 await page.evaluate(()=>window.__paperS3.runtime.pause());await page.reload();
 await page.waitForFunction(()=>window.__paperS3?.runtime?.state.startup?.phase==='starting',null,{timeout:120000});
 await page.evaluate(()=>window.__paperS3.runtime.pause());await page.waitForTimeout(300);
 assert.equal(await page.evaluate(()=>window.__paperS3.runtime.state.status),'paused');
 assert.equal(await page.evaluate(()=>window.__paperS3.runtime.state.startup.phase),'manual','Pause cancels pending automatic navigation');
 assert(await page.locator('#boot-official').isEnabled(),'Startup does not lock firmware controls');
 assert.deepEqual(errors,[]);console.log('PASS automatic EDCBook startup, readable bundled book, persisted startup and pause');
}finally{await browser.close();}

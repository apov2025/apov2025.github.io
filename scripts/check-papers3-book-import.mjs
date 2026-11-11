// Real EDC firmware, virtual FAT32 import, guest text OCR, touch and persistence.
// EDCBOOK_BIN selects a local merged image. Requires Playwright and Tesseract English.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/Users/Ke/side_projects/obook5_3d_model/node_modules/@playwright/test/index.mjs');
const base=process.env.BASE_URL||'http://127.0.0.1:5187';
const output=process.env.PROOF_DIR||'/private/tmp/papers3-book-import-page';await mkdir(output,{recursive:true});
const firmware=process.env.EDCBOOK_BIN?await readFile(process.env.EDCBOOK_BIN):Buffer.from(await(await fetch('https://m5burner-cdn.m5stack.com/firmware/e9a34bd8a7095acf6a43dae2b1565a60.bin')).arrayBuffer());
assert.equal(createHash('sha256').update(firmware).digest('hex'),'06eb3b595fc47bc5d35f760a16cdc5795ea8c0fad6295bcee8db5268cf906986');
const text='VIRTUAL LIBRARY TEST\r\n\r\n'+Array.from({length:100},(_,i)=>`Chapter ${i+1}. The amber fox reads beside the blue river. This text was imported into the virtual TF card from a local TXT file. A real book page must display these words.\r\n\r\n`).join('');
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE}:{channel:'chrome'})});
const page=await browser.newPage({viewport:{width:1200,height:1000},hasTouch:true}),errors=[],evidence=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('https://cloud.umami.is/**',r=>r.abort());
async function wait(time){
 await page.waitForFunction(time=>window.__paperS3.runtime?.state.status==='error'||(window.__paperS3.runtime?.state.stats.time||0)>time,time,{timeout:180000});
 assert.equal(await page.evaluate(()=>window.__paperS3.runtime.state.status),'running');
}
async function boot(){
 await page.locator('#firmware-file').setInputFiles({name:'edcbook-3.1.2.bin',mimeType:'application/octet-stream',buffer:firmware});
 await page.waitForFunction(()=>window.__paperS3.runtime?.state.status==='running');await wait(12);
}
async function capture(name){
 const shot=await page.evaluate(async()=>{
  const r=window.__paperS3.runtime,f=await r.capture(),c=document.createElement('canvas');c.width=f.width;c.height=f.height;
  c.getContext('2d').putImageData(new ImageData(f.pixels,f.width,f.height),0,0);
  return {png:c.toDataURL().split(',')[1],status:r.state.status,time:r.state.stats.time,frames:r.state.frame.frameNumber};
 });
 assert.equal(shot.status,'running');assert(shot.frames>0);
 const path=`${output}/${name}.png`;await writeFile(path,Buffer.from(shot.png,'base64'));delete shot.png;
 const ocr=execFileSync(process.env.TESSERACT||'tesseract',[path,'stdout','-l','eng','--psm','6'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
 await writeFile(`${output}/${name}.txt`,ocr);const result={name,...shot,ocr};evidence.push(result);console.log('CAPTURE',name,shot.time,ocr.replace(/\s+/g,' ').slice(0,120));return result;
}
async function tap(x,y,touch=false){
 await page.locator('#viewer').scrollIntoViewIfNeeded();
 const p=await page.evaluate(([x,y])=>window.__paperS3.viewer.screenPoint(x,y),[x,y]);
 const time=await page.evaluate(()=>window.__paperS3.runtime.state.stats.time);
 if(touch)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);
 await wait(time+6);
}
const reading=shot=>{assert.match(shot.ocr,/amber fox/i,'Guest renders our imported prose');assert.match(shot.ocr,/blue river/i);};
try{
 await page.goto(`${base}/catalog/product/m5stack-paper-s3/`);await page.locator('#viewer[data-viewer-state=ready]').waitFor();await boot();
 await page.locator('#book-files').setInputFiles({name:'TEST.TXT',mimeType:'text/plain',buffer:Buffer.from(text)});
 await page.waitForFunction(()=>document.querySelector('#book-import-status').textContent.includes('Imported 1'));
 assert.equal(await page.locator('#firmware-error').textContent(),'');await wait(12);
 await tap(478,753);await tap(267,753);await tap(265,905);await tap(265,905);
 assert.match((await capture('library')).ocr,/TEST/);
 await tap(450,905);const first=await capture('first-page');reading(first);assert.match(first.ocr,/VIRTUAL LIBRARY TEST/);
 await page.screenshot({path:`${output}/import-control-and-reader.png`,fullPage:true});
 await tap(485,480,true);const second=await capture('next-page');reading(second);assert.notEqual(second.ocr,first.ocr);
 await page.locator('#restart-firmware').click();
 await page.waitForFunction(()=>window.__paperS3.runtime.state.status==='running'&&(window.__paperS3.runtime.state.stats.time||0)<12);await wait(12);
 await tap(267,753);reading(await capture('after-restart'));
 // Flush the guest SD and flash before navigation; the next load uses the same browser storage.
 await page.evaluate(async()=>{await window.__paperS3.runtime.pause();await window.__paperS3.runtime.dispose();});
 await page.reload();await page.locator('#viewer[data-viewer-state=ready]').waitFor();await boot();
 await tap(267,753);reading(await capture('after-reload'));
 assert.deepEqual(errors,[]);
 await writeFile(`${output}/receipt.json`,JSON.stringify({result:'PASS',firmwareSha256:createHash('sha256').update(firmware).digest('hex'),file:'TEST.TXT',bytes:Buffer.byteLength(text),evidence},null,2)+'\n');
 console.log('PASS actual page TXT import, EDC library/open/page turn, restart and same-BIN reload persistence');
}finally{await browser.close();}

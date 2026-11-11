import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/Users/Ke/side_projects/obook5_3d_model/node_modules/@playwright/test/index.mjs');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1200,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const wait=t=>page.waitForFunction(t=>window.__paperS3.runtime.state.status==='error'||window.__paperS3.runtime.state.stats.time>t,t,{timeout:180000});
async function capture(label){
 const result=await page.evaluate(async()=>{
  const r=window.__paperS3.runtime,f=await r.capture(),c=document.createElement('canvas');c.width=f.width;c.height=f.height;c.getContext('2d').putImageData(new ImageData(f.pixels,f.width,f.height),0,0);
  const body=f.pixels.slice(f.width*80*4,f.width*900*4);
  const digest=await crypto.subtle.digest('SHA-256',body);
  return {status:r.state.status,time:r.state.stats.time,frames:r.state.frame.frameNumber,bodyHash:[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join(''),png:c.toDataURL().split(',')[1]};
 });
 await writeFile(`/private/tmp/edcbook-page-${label}.png`,Buffer.from(result.png,'base64'));delete result.png;
 assert.equal(result.status,'running');assert(result.frames>0);console.log(label,JSON.stringify(result));return result;
}
async function tap(x,y){
 await page.locator('#viewer').scrollIntoViewIfNeeded();
 const p=await page.evaluate(([x,y])=>window.__paperS3.viewer.screenPoint(x,y),[x,y]);
 const time=await page.evaluate(()=>window.__paperS3.runtime.state.stats.time);
 await page.mouse.click(p.x,p.y);await wait(time+6);
}
try{
 const firmware=process.env.EDCBOOK_BIN?await readFile(process.env.EDCBOOK_BIN):Buffer.from(await(await fetch('https://m5burner-cdn.m5stack.com/firmware/e9a34bd8a7095acf6a43dae2b1565a60.bin')).arrayBuffer());
 assert.equal(createHash('sha256').update(firmware).digest('hex'),'06eb3b595fc47bc5d35f760a16cdc5795ea8c0fad6295bcee8db5268cf906986');
 await page.goto((process.env.BASE_URL||'http://127.0.0.1:5187')+'/catalog/product/m5stack-paper-s3/');await page.locator('#viewer[data-viewer-state=ready]').waitFor();
 await page.locator('#firmware-file').setInputFiles({name:'edcbook-3.1.2.bin',mimeType:'application/octet-stream',buffer:firmware});
 await page.waitForFunction(()=>window.__paperS3.runtime?.state.status==='running');await wait(12);
 const welcome=await capture('welcome');await tap(270,755);const guide=await capture('guide');assert.notEqual(guide.bodyHash,welcome.bodyHash);
 await tap(475,600);const next=await capture('next');assert.notEqual(next.bodyHash,guide.bodyHash);
 await wait(125);const idle=await capture('idle');assert.equal(idle.bodyHash,next.bodyHash,'reading page remains intact, without low-battery shutdown or display residue');
 assert.deepEqual(errors,[]);console.log('PASS EDCBook local BIN, actual welcome/guide/page turn and sustained reading without low-battery shutdown');
}finally{await browser.close();}

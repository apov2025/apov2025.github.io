import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'@playwright/test');
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const paths={baseline:process.env.BASELINE_WASM,candidate:process.env.CANDIDATE_WASM};
assert(paths.baseline&&paths.candidate&&process.env.EDCBOOK_BIN,'Set BASELINE_WASM, CANDIDATE_WASM and EDCBOOK_BIN.');
const browser=await chromium.launch({channel:'chrome',headless:true});
const firmware=await readFile(process.env.EDCBOOK_BIN),results=[];
assert.equal(createHash('sha256').update(firmware).digest('hex'),'06eb3b595fc47bc5d35f760a16cdc5795ea8c0fad6295bcee8db5268cf906986');
try {
for(const arm of (process.env.ARMS||'baseline,candidate,candidate,baseline').split(',')){
 const context=await browser.newContext({viewport:{width:1200,height:1000}});
 let routed=0;await context.route('**/esp32sim.wasm*',async route=>{routed++;await route.fulfill({path:paths[arm],contentType:'application/wasm'});});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.BASE_URL||'http://127.0.0.1:5187')+'/catalog/product/m5stack-paper-s3/');await page.locator('#viewer[data-viewer-state=ready]').waitFor();
 await page.evaluate(()=>{window.measured=[];const v=window.__paperS3.viewer,original=v.setFrame;v.setFrame=f=>{const at=performance.now();original(f);window.measured.push({at,time:window.__paperS3.runtime?.state.stats?.time});};});
 await page.locator('#firmware-file').setInputFiles({name:'edcbook.bin',mimeType:'application/octet-stream',buffer:firmware});
 const wait=t=>page.waitForFunction(t=>window.__paperS3.runtime?.state.stats?.time>=t,t,{timeout:120000});
 await wait(12);const flips=[];
 for(const [name,x,y] of [['open',270,755],['page1',475,600],['page2',475,600]]){
  await page.locator('#viewer').scrollIntoViewIfNeeded();
  const before=await page.evaluate(()=>({at:performance.now(),stats:window.__paperS3.runtime.state.stats,count:window.measured.length}));
  const p=await page.evaluate(([x,y])=>window.__paperS3.viewer.screenPoint(x,y),[x,y]);await page.mouse.click(p.x,p.y);await wait(before.stats.time+3);
  const result=await page.evaluate(async before=>{
   const r=window.__paperS3.runtime,f=await r.capture();
   const hash=await crypto.subtle.digest('SHA-256',f.pixels.slice(f.width*80*4,f.width*900*4));
   const frames=window.measured.slice(before.count);
   return {elapsed:performance.now()-before.at,refreshMs:frames.length>1?frames.at(-1).at-frames[0].at:0,guestRefresh:frames.length>1?frames.at(-1).time-frames[0].time:0,frames,bodyHash:[...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join(''),stats:r.state.stats};
  },before);
  flips.push({name,...result});console.log(arm,name,JSON.stringify({refreshMs:result.refreshMs,guestRefresh:result.guestRefresh,bodyHash:result.bodyHash}));
 }
 assert(routed>0,'candidate/baseline WASM actually served');assert.deepEqual(errors,[]);assert.notEqual(flips[1].bodyHash,flips[2].bodyHash,'real next page');
 results.push({arm,routed,flips});if(process.env.SPEED_REPORT)await writeFile(process.env.SPEED_REPORT,JSON.stringify(results,null,2));await context.close();
}
for(const result of results)assert.deepEqual(result.flips.map(f=>f.bodyHash),results[0].flips.map(f=>f.bodyHash),'unchanged firmware output');
}finally{await browser.close();}

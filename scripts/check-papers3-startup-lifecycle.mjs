// Adapter queue contracts. Controlled transport promises reproduce a user taking
// over while an automatic touch or firmware load is still in flight.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'@playwright/test');
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage(),root='/catalog/product/m5stack-paper-s3/';
 await page.route('**/startup-test.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Adapter lifecycle test</title>'}));
 await page.route('**/vendor/platform/catalog.js',r=>r.fulfill({contentType:'text/javascript',body:'export async function loadCatalog(){return {}};export function createDefaultScene(){return {}}'}));
 await page.route('**/vendor/platform/runtime.js*',r=>r.fulfill({contentType:'text/javascript',body:`
 export function validateMergedImage(){};export async function fetchBytes(){};
 export function createPlatformRuntime({onEvent}){
  let state={status:'configured',stats:{time:10},firmware:{artifacts:[]}};
  const emit=status=>{state={...state,status};onEvent({type:'state',state});return state;};
  window.inputs=[];
  return {configure:async()=>emit('configured'),loadFirmware:async()=>{emit('loading');if(window.holdLoad)await new Promise(resolve=>window.releaseLoad=resolve);return emit('ready');},
   start:async()=>emit('running'),pause:async()=>emit('paused'),dispose:async()=>emit('disposed'),
   input:async e=>{window.inputs.push(e);if(window.holdInput&&e.down){window.holdInput=false;await new Promise(resolve=>window.releaseInput=resolve);}return {guestTime:0};}};
 }`}));
 await page.route('**/edcbook-startup.js*',r=>r.fulfill({contentType:'text/javascript',body:'export async function enterEdcbookLibrary(o){await o.tap(478,753);if(o.active())o.onProgress({phase:"ready",restarts:0});}'}));
 if(process.env.MUTATE_TAKEOVER){const source=(await readFile('catalog/product/m5stack-paper-s3/runtime.js','utf8')).replace('if(cancelStartup())void releaseActiveTouch();','cancelStartup();');await page.route('**/m5stack-paper-s3/runtime.js*',r=>r.fulfill({contentType:'text/javascript',body:source}));}
 await page.goto((process.env.BASE_URL||'http://127.0.0.1:5187')+'/startup-test.html');
 await page.evaluate(async root=>{const {createPaperRuntime}=await import(root+'runtime.js');window.adapter=await createPaperRuntime();window.holdInput=true;await adapter.bootDefault();},root);
 await page.waitForFunction(()=>typeof window.releaseInput==='function');
 await page.evaluate(()=>{window.manual=adapter.touch({x:100,y:200,pressed:true}).then(()=>adapter.touch({x:100,y:200,pressed:false}));releaseInput();});
 await page.evaluate(()=>window.manual);
 assert.deepEqual(await page.evaluate(()=>inputs.map(({x,y,down})=>[x,y,down])),[[478,753,true],[478,753,false],[100,200,true],[100,200,false]],'Release automatic contact before a separate manual tap');
 await page.evaluate(async()=>{window.holdLoad=true;window.pending=adapter.bootDefault();});await page.waitForFunction(()=>typeof releaseLoad==='function');
 await page.evaluate(async()=>{await adapter.suspend();releaseLoad();await pending;});
 assert.equal(await page.evaluate(()=>adapter.state.status),'paused','A load that finishes after pagehide remains paused');
 assert.equal(await page.evaluate(()=>inputs.length),4,'No automatic touch after pagehide');
 console.log('PASS manual takeover releases pending contact; suspended loading cannot auto-navigate');
}finally{await browser.close();}

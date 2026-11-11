import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/Users/Ke/side_projects/obook5_3d_model/node_modules/@playwright/test/index.mjs');
assert(process.env.EDC_FIRMWARE,'Set EDC_FIRMWARE to the original EDCBook 3.1.2 merged BIN.');
const firmware=await readFile(process.env.EDC_FIRMWARE);
assert.equal(createHash('sha256').update(firmware).digest('hex'),'06eb3b595fc47bc5d35f760a16cdc5795ea8c0fad6295bcee8db5268cf906986');
const checkpoints=process.env.GUEST_CHECKPOINTS?process.env.GUEST_CHECKPOINTS.split(',').map(Number):[15,60,125];
assert(checkpoints.length&&checkpoints.every(value=>Number.isFinite(value)&&value>0));
const dir=process.env.PROOF_DIR||'/private/tmp/papers3-battery-proof';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
try {
  await page.route('**/__battery_probe.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><canvas width="540" height="960"></canvas>'}));
  await page.route('**/__battery_firmware.bin',route=>route.fulfill({contentType:'application/octet-stream',body:firmware}));
  await page.goto((process.env.BASE_URL||'http://127.0.0.1:5187')+'/__battery_probe.html');
  await page.evaluate(async()=>{
    const root='/catalog/product/m5stack-paper-s3/vendor/';
    const {createPlatformRuntime}=await import(root+'platform/runtime.js');
    const {loadCatalog,createDefaultScene}=await import(root+'platform/catalog.js');
    const catalog=await loadCatalog();window.loadedScripts=[];window.frameCount=0;window.clock=0;window.lastError=null;
    window.runtime=createPlatformRuntime({catalog,assetBaseUrl:location.origin+root,requestTimeout:60000,
      workerFactory:url=>{const worker=new Worker(url,{type:'module'});const send=worker.postMessage.bind(worker);worker.postMessage=(message,transfer)=>{if(message.op==='load'&&message.kind===6)loadedScripts.push(new TextDecoder().decode(message.data));send(message,transfer);};return worker;},
      onEvent:event=>{if(event.type==='frame'){frameCount++;document.querySelector('canvas').getContext('2d').putImageData(new ImageData(event.pixels,event.width,event.height),0,0);}if(event.type==='stats')clock=event.stats.time||clock;if(event.type==='error')lastError=event.error;}});
    await runtime.configure(createDefaultScene(catalog,'m5stack-c139'));
    const file=new File([await(await fetch('/__battery_firmware.bin')).arrayBuffer()],'edcbook-original.bin');
    await runtime.loadFirmware({format:'merged',file});
  });
  assert.deepEqual(await page.evaluate(()=>loadedScripts),['0 adc 3 2.0\n'],'seed the real GPIO3 ADC before boot');
  await page.evaluate(()=>runtime.start());
  let firstImage;
  for(const seconds of checkpoints) {
    await page.waitForFunction(t=>clock>=t||lastError,seconds,{timeout:360000});
    const state=await page.evaluate(async()=>{await runtime.pause();const state=await runtime.observe();return {time:clock,frames:frameCount,error:lastError,status:state.status,serial:state.serialByPort,canvas:document.querySelector('canvas').toDataURL()};});
    assert.equal(state.error,null);assert(state.frames>0);
    if(firstImage&&seconds>=60)assert.equal(state.canvas,firstImage,'idle firmware must retain the welcome screen, without a low-battery shutdown image');
    firstImage??=state.canvas;
    await writeFile(`${dir}/idle${seconds}.png`,Buffer.from(state.canvas.split(',')[1],'base64'));delete state.canvas;
    await writeFile(`${dir}/idle${seconds}.json`,JSON.stringify(state,null,2));console.log(JSON.stringify({time:state.time,frames:state.frames,error:state.error}));
    await page.evaluate(()=>runtime.start());
  }
  await page.route('**/__battery_script.txt',route=>route.fulfill({contentType:'text/plain',body:'0 adc 3 1.95\n1 gpio 21 0\n'}));
  await page.route('**/__battery_manifest.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({board:'papers3',files:{flash:'/__battery_firmware.bin',script:'/__battery_script.txt'}})}));
  await page.evaluate(async()=>{await runtime.pause();await runtime.loadFirmware({manifestUrl:location.origin+'/__battery_manifest.json'});});
  assert.equal(await page.evaluate(()=>loadedScripts.at(-1)),'0 adc 3 2.0\n0 adc 3 1.95\n1 gpio 21 0\n','preserve explicit firmware scripts after the default battery source');
  assert.deepEqual(errors,[]);console.log(`PASS original firmware with physical GPIO3 battery source through ${Math.max(...checkpoints)} guest seconds and existing script preservation; review saved display captures.`);
} finally {await page.evaluate(()=>window.runtime?.dispose()).catch(()=>{});await browser.close();}

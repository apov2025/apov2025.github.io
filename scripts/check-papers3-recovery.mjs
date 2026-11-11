import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/Users/Ke/side_projects/obook5_3d_model/node_modules/@playwright/test/index.mjs');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage();
const base=process.env.BASE_URL||'http://127.0.0.1:5187';
// Simulate worker failures at the adapter boundary to exercise the page's
// asynchronous error and recovery UI independently of a particular firmware.
await page.route('**/catalog/product/m5stack-paper-s3/runtime.js*',route=>route.fulfill({contentType:'text/javascript',body:`
export async function createPaperRuntime({onState,onSerial}) {
  let state={status:'configured',stats:{},firmware:null,lastError:null};
  const publish=patch=>{state={...state,...patch};onState(state);};
  window.failRuntime=(code,message)=>publish({status:'error',lastError:{code,message}});
  window.restartCount=0;
  window.emitSerial=(port,data)=>onSerial({port,data});
  window.beginBoot=()=>publish({status:'loading',stats:{},frame:null,lastError:null});
  return {get state(){return state;},
    async bootDefault(){publish({status:'running',firmware:{source:'remote'},firmwareName:'UserDemo v0.5',lastError:null});},
    async reset(){window.restartCount++;publish({status:'running',lastError:null});},
    async start(){publish({status:'running'});},
    async pause(){publish({status:'paused'});},async touch(){},async dispose(){},
  };
}`}));
try{
  await page.goto(`${base}/catalog/product/m5stack-paper-s3/`);
  await page.locator('#viewer[data-viewer-state=ready]').waitFor();
  await page.locator('#boot-firmware').click();
  await page.waitForFunction(()=>window.__paperS3.runtime?.state.status==='running');
  for(const [code,message,expected] of [
    ['EMULATOR_STOPPED','Emulator stopped with code 2.','code 2'],
    ['STORAGE_CONFLICT','Another tab saved or cleared this device storage.','Another tab'],
    ['WORKER_ERROR','WebAssembly worker failed.','worker'],
  ]){
    await page.evaluate(([code,message])=>window.failRuntime(code,message),[code,message]);
    assert((await page.locator('#firmware-error').textContent()).includes(expected),`${code}: show the asynchronous failure reason`);
    assert(await page.locator('#restart-firmware').isEnabled(),`${code}: allow recovery`);
    await page.locator('#restart-firmware').click();
    await page.waitForFunction(()=>window.__paperS3.runtime.state.status==='running');
    assert.equal(await page.locator('#firmware-error').textContent(),'','recovery clears the old error');
  }
  assert.equal(await page.evaluate(()=>window.restartCount),3);
  await page.evaluate(()=>window.failRuntime('EMULATOR_STOPPED','Emulator stopped with code 2.'));
  await page.getByRole('button',{name:'中文',exact:true}).click();
  assert((await page.locator('#firmware-error').textContent()).includes('重启'));
  await page.evaluate(()=>window.emitSerial('uart0','Previous firmware boot\n'));
  assert((await page.locator('#serial-output').textContent()).includes('Previous firmware'));
  await page.evaluate(()=>window.beginBoot());
  assert.equal(await page.locator('#serial-output').textContent(),'','new boot clears the previous firmware log');
  await page.evaluate(()=>{
    window.emitSerial('uart0','Current firmware boot\n');
    window.emitSerial('emulator','[emu] unimplemented instruction at 420a0da0 (raw 0xe0723d4e)\n');
    window.failRuntime('EMULATOR_STOPPED','Emulator stopped with code 2.');
  });
  assert((await page.locator('#firmware-error').textContent()).includes('420a0da0'),'show unsupported instruction cause');
  await page.getByRole('button',{name:'English',exact:true}).click();
  assert((await page.locator('#firmware-error').textContent()).includes('unsupported CPU instruction'));
  console.log('PASS asynchronous firmware failure messages, restart recovery, clearing errors and translations');
}finally{await browser.close();}

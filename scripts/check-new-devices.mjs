import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/Users/Ke/side_projects/obook5_3d_model/node_modules/@playwright/test/index.mjs');
const base=process.env.BASE_URL||'http://127.0.0.1:5176';
const ids=['mindreset-read-pico','metalio-eink4-plus-47','prototype-game'];
for(const id of ids){
 const data=await readFile(`catalog/product/${id}/models/device.glb`);
 assert.equal(data.toString('utf8',0,4),'glTF');
 const gltf=JSON.parse(data.toString('utf8',20,20+data.readUInt32LE(12)));
 const materials=new Map(gltf.materials.map(m=>[m.name,m.pbrMetallicRoughness]));
 for(const name of ['Case','Front','Buttons','Screen'])assert(materials.has(name),`${id}: ${name}`);
 if(id!=='prototype-game'){
  for(const part of ['TouchLeft','TouchCenter','TouchRight'])assert(materials.has(part),`${id}: independent ${part}`);
  assert(materials.get('Case').metallicFactor>=.85);
  assert(materials.get('Front').roughnessFactor>=.4);
  assert.equal(materials.get('Back').roughnessFactor,id==='mindreset-read-pico'?.14:.48);
 }
 const nodes=gltf.nodes.map(n=>n.name);
 const requiredPorts=id==='prototype-game'?['usb-c-metal-shell','usb-c-black-tongue','usb-c-dark-backing','microsd-flush-cover']:['USB_C_shell','USB_C_tongue','USB_C_cavity','MicroSD_cover_lid'];
 for(const name of requiredPorts)assert(nodes.includes(name),`${id}: missing ${name}`);
 if(id==='mindreset-read-pico'){
  const bounds=name=>{const n=gltf.nodes.find(n=>n.name===name);return gltf.accessors[gltf.meshes[n.mesh].primitives[0].attributes.POSITION];};
  const usb=bounds('USB_C_shell'),sd=bounds('MicroSD_cover_lid'),power=bounds('mindreset-read-pico_1_Buttons');
  assert(usb.max[0]<0&&usb.max[1]<0,'Photo reference: Pico USB left/lower');
  assert(sd.min[0]>0&&sd.max[1]<0,'Photo reference: Pico card right/lower');
  assert(power.min[0]>0&&power.min[1]>0,'Photo reference: Pico power right/above center');
  assert(bounds('Pico_display').max[2]<.0036,'Pico display must sit below front glass');
 }
 if(id==='prototype-game'){
  const names=gltf.nodes.map(n=>n.name);
  for(const part of ['power-lock-key','page-volume-up-key','page-volume-down-key'])assert(names.includes(part));
  assert(!names.some(n=>/shoulder|start|select/i.test(n)));
  const wordmark=gltf.materials.find(m=>m.name==='Wordmark');assert(wordmark&&!wordmark.pbrMetallicRoughness?.baseColorTexture,'Title must use vector ink, no rectangular texture');
  const rearNode=gltf.nodes.find(n=>n.name==='unibody-rear');
  assert.equal(rearNode.extras.rearLettering,'prototype');
  assert.equal(rearNode.extras.font,'Helvetiker Bold');
  assert.equal(rearNode.extras.debossDepthMm,.31);
  assert(!materials.has('Back'),'Unibody must not have a separate rear material');
  assert.equal(gltf.meshes[rearNode.mesh].primitives[0].material,gltf.meshes[gltf.nodes.find(n=>n.name==='body').mesh].primitives[0].material,'Rear and sides must share the same shell material');
  const rear=gltf.accessors[gltf.meshes[rearNode.mesh].primitives[0].attributes.POSITION];
  assert(rear.max[2]-rear.min[2]>.0014,'Game rear must have a broad shoulder instead of a tiny edge bevel');
  assert(data.length<12*1024*1024,'Refined game model must remain practical to load');
 }
}
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:900}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.route('https://cloud.umami.is/**',r=>r.abort());
 await page.goto(`${base}/catalog/`);
 for(const id of ids){
  const link=page.locator(`a.product-link[href='/catalog/product/${id}/']`);assert.equal(await link.count(),1);
  await link.locator('img').evaluate(img=>img.decode());
 }
 await page.screenshot({path:'/private/tmp/catalog-new-devices-home.png',fullPage:true});
 // Pico's original link must now navigate to its dedicated viewer, not the old dialog.
 await page.locator("a.product-link[href='/catalog/product/mindreset-read-pico/']").click();
 await page.waitForSelector('#viewer[data-viewer-state=ready]');
 for(const id of ids){
  await page.goto(`${base}/catalog/product/${id}/`);await page.waitForSelector('#viewer[data-viewer-state=ready]');
  if(id!=='prototype-game'){
   await page.getByRole('button',{name:'Design my own',exact:true}).click();
   for(const [part,color] of [['touchLeftColor','#d3324a'],['touchCenterColor','#267e3a'],['touchRightColor','#233bcc']]){
    const prior=await page.evaluate(()=>window.__apovCustom.look),imageBefore=await page.locator('canvas').screenshot();
    await page.locator(`input[data-color-part=${part}]`).fill(color);
    const updated=await page.evaluate(()=>window.__apovCustom.look);assert.equal(updated[part],color);
    for(const key of ['buttonColor','touchLeftColor','touchCenterColor','touchRightColor'])if(key!==part)assert.equal(updated[key],prior[key],'Independent control must not recolor another key');
    assert(!imageBefore.equals(await page.locator('canvas').screenshot()),`${part} must recolor visible pattern`);
   }
   const pc=page.locator('[data-shell-material=polycarbonate]');assert.equal(await pc.count(),1,'Polycarbonate option must be available');
   const originalLook=await page.evaluate(()=>window.__apovCustom.look),originalImage=await page.locator('canvas').screenshot();
   await pc.click();assert.equal(await pc.getAttribute('aria-pressed'),'true');
   assert.equal(await page.evaluate(()=>window.__apovCustom.look.shellMaterial),'polycarbonate');
   assert(!originalImage.equals(await page.locator('canvas').screenshot()),'Material must change rendered surface');
   assert.equal(await page.evaluate(()=>window.__apovCustom.look.frontColor),originalLook.frontColor);
   await page.getByRole('button',{name:'Randomize',exact:true}).click();
   assert.equal(await page.evaluate(()=>window.__apovCustom.look.shellMaterial),'polycarbonate','Randomize preserves material');
   await page.locator('[data-shell-material=original]').click();assert.equal(await page.evaluate(()=>window.__apovCustom.look.shellMaterial),'original');
  }
  if(id==='prototype-game'){
   assert.deepEqual(await page.locator('[data-game-preset]').evaluateAll(bs=>bs.map(b=>b.dataset.gamePreset)),['rose','sage','tetris','pacman','mario']);
   assert((await page.locator('[data-game-preset]').allTextContents()).every(t=>!t.trim()),'Color presets have no visible names');
   for(const preset of ['rose','sage','tetris','pacman','mario']){
    await page.locator(`[data-game-preset=${preset}]`).click();
    assert.equal(await page.locator(`[data-game-preset=${preset}]`).getAttribute('aria-pressed'),'true');
   }
   assert.equal(await page.locator('input[data-color-part=backColor]').count(),0);
   await page.evaluate(()=>window.__apovCustom.setLook({caseColor:'#b27c63',backColor:'#000000'}));
   const look=await page.evaluate(()=>window.__apovCustom.look);assert.equal(look.backColor,look.caseColor);
  }
  const before=await page.locator('canvas').screenshot();await page.getByRole('button',{name:'Randomize',exact:true}).click();
  const after=await page.locator('canvas').screenshot();assert(!before.equals(after),`${id} visible recolor`);
  await page.getByRole('button',{name:'Auto rotate',exact:true}).click();assert.equal(await page.locator('#auto-rotate').getAttribute('aria-pressed'),'true');
  await page.locator('canvas').focus();await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('#auto-rotate').getAttribute('aria-pressed'),'false');
  for(const view of ['Front','Back','Side'])await page.getByRole('button',{name:view,exact:true}).click();
  await page.getByRole('button',{name:'中文',exact:true}).click();assert.equal(await page.locator('html').getAttribute('lang'),'zh-CN');
  await page.getByRole('button',{name:'English',exact:true}).click();
  console.log('PASS interactions',id);
 }
 await page.goto(`${base}/catalog/#product/mindreset-read-pico`);await page.waitForURL('**/catalog/product/mindreset-read-pico/');await page.waitForSelector('#viewer[data-viewer-state=ready]');
 // A failed GLB request must leave a usable retry, then successfully recover.
 await page.route('**/mindreset-read-pico/models/device.glb',r=>r.abort());
 await page.goto(`${base}/catalog/product/mindreset-read-pico/`);await page.waitForSelector('#viewer[data-viewer-state=error]');
 assert(await page.locator('#load-model').isVisible());await page.unroute('**/mindreset-read-pico/models/device.glb');
 await page.locator('#load-model').click();await page.waitForSelector('#viewer[data-viewer-state=ready]');
 for(const id of ['obook5-v2','paper-mono-v2']){
  await page.goto(`${base}/catalog/product/${id}/`);await page.waitForSelector('#viewer[data-viewer-state=ready]');
  await page.getByRole('button',{name:'Randomize',exact:true}).click();console.log('PASS existing viewer',id);
 }
 assert.deepEqual(errors,[]);console.log('PASS catalog links, model materials, game controls, retry recovery; no browser exceptions');
}finally{await browser.close();}

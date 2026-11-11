import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/Users/Ke/side_projects/obook5_3d_model/node_modules/@playwright/test/index.mjs');
const base=process.env.BASE_URL||'http://127.0.0.1:5187';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
const page=await browser.newPage({viewport:{width:1200,height:950}});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.route('**/apov-custom-page.js*',async route=>{const response=await route.fetch();const source=await response.text();await route.fulfill({response,body:`import {GLTFLoader as TestLoader} from '/catalog/product/prototype/vendor/three-runtime.js';const originalLoad=TestLoader.prototype.loadAsync;TestLoader.prototype.loadAsync=async function(...args){const result=await originalLoad.apply(this,args);if(String(args[0]).endsWith("device.glb"))window.__monoScene=result.scene;return result;};\n${source}`});});
await page.goto(`${base}/catalog/product/paper-mono-v2/`);
await page.locator('#viewer[data-viewer-state=ready]').waitFor();

const colors=()=>page.evaluate(()=>Object.fromEntries(['PaperMono_front_cover','PaperMono_chassis','PaperMono_black_NFC_panel'].map(n=>{const m=window.__monoScene.getObjectByName(n).material;return[n,{id:m.uuid,color:m.color.getHexString()}]})));
await page.locator('#design-own').click();
const initial=await colors();assert.equal(new Set(Object.values(initial).map(m=>m.id)).size,3);
const parts=[['frontColor','PaperMono_front_cover','#ef2532'],['caseColor','PaperMono_chassis','#1c62dd'],['backColor','PaperMono_black_NFC_panel','#f0bb1d']];
for(const [part,name,color] of parts){const before=await colors();await page.locator(`[data-color-part=${part}]`).fill(color);const after=await colors();for(const n in before)assert.equal(after[n].color,n===name?color.slice(1):before[n].color);}
await page.getByRole('button',{name:'Full screen',exact:true}).click();
await page.locator('[data-color-part=frontColor]').fill('#1bc89f');
await page.getByRole('button',{name:'Exit full screen',exact:true}).click();assert.equal((await colors()).PaperMono_front_cover.color,'1bc89f');
await page.getByRole('button',{name:'Front',exact:true}).click();await page.locator('#viewer').screenshot({path:'/private/tmp/mono-front-colors.png'});
await page.getByRole('button',{name:'Back',exact:true}).click();await page.locator('#viewer').screenshot({path:'/private/tmp/mono-back-colors.png'});
const hardware=await page.evaluate(()=>['PaperMono_USB_C_metal_socket','PaperMono_USB_C_tongue','PaperMono_LED_light_guide','PaperMono_TF_metal_socket','PaperMono_internal_backing'].map(n=>!!window.__monoScene.getObjectByName(n)));assert(hardware.every(Boolean));
await page.evaluate(()=>window.__apovCustom.capturePose({direction:[-1,0,-.12],distance:.265}));await page.locator('#viewer').screenshot({path:'/private/tmp/mono-side-hardware.png'});
await page.evaluate(()=>window.__apovCustom.capturePose({direction:[-.08,-1,.13],distance:.19,target:[0,-.03,0]}));await page.locator('#viewer').screenshot({path:'/private/tmp/mono-usb-hardware.png'});
assert.deepEqual(errors,[]);
console.log('PASS three independent materials, fullscreen persistence, actual USB/LED/TF geometry; four screenshots saved');
}finally{await browser.close()}

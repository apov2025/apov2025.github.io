// Render actual viewer output for catalog covers and verify the new device interactions.
// Uses the same local browser dependencies as the repository's existing render scripts.
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/Users/Ke/side_projects/obook5_3d_model/node_modules/@playwright/test/index.mjs');
import {spawnSync} from 'node:child_process';
function writeWebp(png,path){const r=spawnSync(process.env.CAD_PYTHON||'/private/tmp/catalog-cad-env/bin/python',['-c',"from PIL import Image; from pathlib import Path; import io,sys; p=Path(sys.argv[1]); t=p.with_name(p.stem+'.tmp'+p.suffix); Image.open(io.BytesIO(sys.stdin.buffer.read())).save(t,quality=92); t.replace(p)",path],{input:png});if(r.status)throw Error(r.stderr.toString());}
import {mkdir} from 'node:fs/promises';
const ids=process.argv.slice(2).length?process.argv.slice(2):['mindreset-read-pico','metalio-eink4-plus-47','prototype-game'];
const base=process.env.BASE_URL||'http://127.0.0.1:5176';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:900},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://cloud.umami.is/**',r=>r.abort());
 for(const id of ids){
  await page.goto(`${base}/catalog/product/${id}/`);await page.waitForSelector('#viewer[data-viewer-state=ready]',{timeout:30000});
  const initial=await page.evaluate(()=>window.__apovCustom.look);
  await page.getByRole('button',{name:'Randomize',exact:true}).click();
  const changed=await page.evaluate(()=>window.__apovCustom.look);
  if(initial.caseColor===changed.caseColor||changed.finish!=='matte'||!/^#[a-f0-9]{6}$/i.test(changed.backColor))throw Error(`Color failed ${id}`);
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await page.screenshot({path:`/private/tmp/${id}-back.png`});
  await page.getByRole('button',{name:'中文',exact:true}).click();
  if(await page.locator('html').getAttribute('lang')!=='zh-CN')throw Error('language');
  await page.getByRole('button',{name:'English',exact:true}).click();
  await page.getByRole('button',{name:'Design my own',exact:true}).click();
  if(!await page.locator('#customization-panel').isVisible())throw Error('customization');
  await page.locator(`input[data-color-part=${id==='prototype-game'?'caseColor':'backColor'}]`).fill('#b27c63');
  if((await page.evaluate(()=>window.__apovCustom.look.backColor))!=='#b27c63')throw Error('rear color');
  await page.evaluate(initial=>window.__apovCustom.setLook(initial),initial);
  if(id==='prototype-game')await page.locator('[data-game-preset]').first().click();
  await page.addStyleTag({content:'.single-view-tools{visibility:hidden!important}'});
  await page.evaluate(()=>document.querySelector('#viewer').style.cssText='position:fixed;inset:0;width:1200px;height:900px;z-index:99');
  await page.evaluate(id=>window.__apovCustom.capturePose({direction:[.32,.13,1],distance:id==='prototype-game'?.36:.325}),id);
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const dir=`catalog/product/${id}/media`;await mkdir(dir,{recursive:true});
  writeWebp(await page.locator('canvas').screenshot(),`${dir}/viewer.webp`);
  await page.setViewportSize({width:900,height:1200});
  await page.evaluate(id=>{document.querySelector('#viewer').style.cssText='position:fixed;inset:0;width:900px;height:1200px;z-index:99';window.__apovCustom.capturePose({direction:[.18,.08,1],distance:id==='prototype-game'?.36:.325,background:'#ffffff'});},id);
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  writeWebp(await page.locator('canvas').screenshot(),`${dir}/card.webp`);
  await page.setViewportSize({width:390,height:844});await page.reload();await page.waitForSelector('#viewer[data-viewer-state=ready]');
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error(`Mobile overflow ${id}`);
  await page.screenshot({path:`/private/tmp/${id}-mobile.png`,fullPage:true});
  await page.setViewportSize({width:1200,height:900});
  console.log('PASS',id,'model, random colors, back color, view, language, mobile; rendered cover/poster');
 }
 if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();}

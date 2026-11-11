// Close-up QA views of added connectors and covers. Artifacts remain in /tmp.
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/Users/Ke/side_projects/obook5_3d_model/node_modules/@playwright/test/index.mjs');
const b=await chromium.launch({channel:'chrome',headless:true});
try{
 const p=await b.newPage({viewport:{width:1200,height:800}});
 await p.route('https://cloud.umami.is/**',r=>r.abort());
 const shots=[
  ['mindreset-read-pico','usb',[-1,0,.25],[-.03,-.045,0]],
  ['mindreset-read-pico','card',[1,0,.25],[.03,-.035,0]],
  ['metalio-eink4-plus-47','bottom',[0,-1,.32],[0,-.057,0]],
  ['prototype-game','bottom',[0,-1,.3],[0,-.07,0]],
  ['prototype-game','card',[-1,0,.3],[-.038,-.035,0]],
  ['prototype-game','rear',[-.65,.25,-1],[0,0,0],.32],
  ['prototype-game','keys',[.18,-.12,1],[0,-.034,.004]],
  ['prototype-game','title',[0,.1,1],[-.01,.061,.004]],
 ];
 for(const [id,view,direction,target,distance=.16] of shots){
  if(process.argv.length>2&&!process.argv.slice(2).includes(id))continue;
  await p.goto(`http://127.0.0.1:5176/catalog/product/${id}/`);await p.waitForSelector('#viewer[data-viewer-state=ready]');
  await p.addStyleTag({content:'.single-view-tools{display:none!important}'});
  await p.evaluate(({direction,target,distance})=>{document.querySelector('#viewer').style.cssText='position:fixed;inset:0;width:1200px;height:800px;z-index:99';window.__apovCustom.capturePose({direction,target,distance});},{direction,target,distance});
  await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await p.locator('canvas').screenshot({path:`/private/tmp/${id}-${view}-details.png`});console.log('Rendered',id,view);
 }
}finally{await b.close();}

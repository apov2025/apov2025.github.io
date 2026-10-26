const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1100,height:900}});
  await page.emulateMedia({reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/__developer-preview*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/catalog/product/prototype/developer-edition.css"><style>body{margin:0;background:#eeefeb}#demo{max-width:900px;margin:auto}</style><div id="demo"></div><script type="module">import {initDeveloperEdition} from "/catalog/product/prototype/developer-edition.js";window.viewer=await initDeveloperEdition(document.querySelector("#demo"));if(location.search)window.viewer.setLayout("side");</script>'}));
  await page.goto('http://127.0.0.1:5176/__developer-preview');
  await page.locator('.developer-viewer--ready').waitFor({timeout:30000});
  await page.screenshot({path:'/tmp/developer-viewer-desktop.png'});
  const canvas=page.locator('canvas');
  if(await page.locator('#demo').getAttribute('data-developer-layout')!=='off')throw Error('Default layout is not off');
  const off=await canvas.screenshot();const layoutImages=[];
  for(const id of ['side','bottom','custom']){await page.evaluate(id=>window.viewer.setLayout(id),id);const screenshot=await canvas.screenshot();if(off.equals(screenshot)||layoutImages.some(previous=>previous.equals(screenshot)))throw Error('Layout is missing or duplicates another design: '+id);layoutImages.push(screenshot);}
  await page.evaluate(()=>window.viewer.setLayout(null));if(!off.equals(await canvas.screenshot()))throw Error('Clearing layout did not restore blank front');
  const before=await canvas.screenshot(); await canvas.focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('+');
  const after=await canvas.screenshot(); if(before.equals(after)) throw Error('Keyboard orbit/zoom did not change the view');
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
  await page.screenshot({path:'/tmp/developer-viewer-mobile.png'});
  await page.evaluate(() => window.viewer.setLanguage('zh'));
  if (!(await canvas.getAttribute('aria-label')).includes('交互式')) throw Error('Chinese accessible label missing');
  const result=await page.evaluate(()=>({ready:document.querySelector('#demo').classList.contains('developer-viewer--ready'),canvasCount:document.querySelectorAll('canvas').length,horizontalOverflow:document.documentElement.scrollWidth>innerWidth,canvasSize:[document.querySelector('canvas').width,document.querySelector('canvas').height]}));
  if(errors.length||!result.ready||result.horizontalOverflow)throw Error(JSON.stringify({errors,result}));
  await page.goto('http://127.0.0.1:5176/__developer-preview?layout=side');
  await page.locator('.developer-viewer--ready').waitFor({timeout:30000});
  if(await page.locator('#demo').getAttribute('data-developer-layout')!=='side')throw Error('Preload layout selection lost');
  const preselected=await canvas.screenshot();await page.evaluate(()=>window.viewer.setLayout(null));if(preselected.equals(await canvas.screenshot()))throw Error('Preselected layout did not render');
  await page.route('**/models/prototype-developer.glb*', route => route.abort());
  await page.reload();
  await page.locator('.developer-viewer--fallback').waitFor({timeout:30000});
  await page.evaluate(() => window.viewer.setLanguage('zh'));
  if (!(await page.locator('[role=status]').textContent()).includes('3D 预览暂不可用')) throw Error('Fallback status missing');
  console.log(JSON.stringify({errors,result,fallbackVerified:true,threeDistinctLayouts:true,defaultOff:true,preloadSelection:true}));
}finally{await browser.close();}

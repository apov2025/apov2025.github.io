import {generateDuoLook} from './color-harmony.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const translations=$$('[data-zh]').map(el=>({el,en:el.innerHTML,zh:el.dataset.zh}));
let language='en',viewer,busy=false;
try{if(localStorage.getItem('catalog-language')==='zh-CN')language='zh-CN';}catch{}
const stage=$('#viewer');
function languageUI(){
 document.documentElement.lang=language;
 translations.forEach(({el,en,zh})=>{el.innerHTML=language==='en'?en:zh;});
 $$('[data-language]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.language===language)));
 viewer?.setLanguage(language);sync();
}
function sync(){
 const play=$('#assembly-play'),active=viewer?.playing??false;
 play.setAttribute('aria-pressed',String(active));
 play.textContent=language==='en'?(active?'Pause assembly':'Play assembly'):(active?'暂停拆装':'播放拆装');
 if(viewer){const look=viewer.look;$('#shell-color').value=look.caseColor;
  $$('button[data-keyboard]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.keyboard===look.keyboard)));
  $$('button[data-texture]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.texture===look.finish)));
 }
 const error=stage.dataset.viewerState==='error';
 $('#viewer-status').textContent=error?(language==='en'?'Model could not load. Try again.':'模型加载失败，请重试。'):busy?(language==='en'?'Loading 3D model…':'正在加载 3D 模型…'):'';
}
$$('[data-language]').forEach(b=>b.addEventListener('click',()=>{language=b.dataset.language;try{localStorage.setItem('catalog-language',language);}catch{}languageUI();}));
async function load(){
 if(busy)return;busy=true;stage.dataset.viewerState='loading';$('#load-model').hidden=true;sync();
 try{
  const {createViewer}=await import('./viewer.js');
  viewer=await createViewer($('#model-canvas'),{onState:()=>sync()});
  window.__pkdCatalog=viewer;stage.dataset.viewerState='ready';$('#viewer-poster').hidden=true;
  viewer.setLanguage(language);$$('[data-model-control]').forEach(b=>b.disabled=false);
 }catch{stage.dataset.viewerState='error';$('#load-model').hidden=false;$('#viewer-poster').hidden=false;}
 finally{busy=false;sync();}
}
$('#load-model').addEventListener('click',load);
$('#assembly-play').addEventListener('click',()=>viewer?.setPlaying(!viewer.playing));
$$('[data-assembly]').forEach(b=>b.addEventListener('click',()=>viewer?.setAssembly(b.dataset.assembly==='exploded'?1:0)));
$('#reset-view').addEventListener('click',()=>viewer?.setView());
$('#random-colorway').addEventListener('click',()=>viewer?.setLook(generateDuoLook({previousCaseColor:viewer.look.caseColor})));
$('#shell-color').addEventListener('input',e=>viewer?.setLook({caseColor:e.target.value}));
$$('[data-keyboard]').forEach(b=>b.addEventListener('click',()=>viewer?.setLook({keyboard:b.dataset.keyboard})));
$$('[data-texture]').forEach(b=>b.addEventListener('click',()=>viewer?.setLook({finish:b.dataset.texture})));
$('#design-own').addEventListener('click',()=>{const p=$('#customization-panel');p.hidden=!p.hidden;$('#design-own').setAttribute('aria-expanded',String(!p.hidden));});
let lastTile;
const preview=$('#colorway-preview'),collage=$('.hero-collage');
if(preview){
function closePreview(){preview.hidden=true;collage.classList.remove('is-expanded');lastTile?.setAttribute('aria-expanded','false');lastTile?.focus({preventScroll:true});}
$$('.colorway-tile').forEach(tile=>tile.addEventListener('click',e=>{e.preventDefault();lastTile=tile;$('#colorway-preview-image').src=tile.href;preview.hidden=false;collage.classList.add('is-expanded');tile.setAttribute('aria-expanded','true');preview.focus({preventScroll:true});}));
preview.addEventListener('click',closePreview);preview.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closePreview();}});
}
languageUI();
const observer=new IntersectionObserver(([e])=>{if(e.isIntersecting){observer.disconnect();load();}},{rootMargin:'300px'});observer.observe(stage);
addEventListener('pagehide',()=>viewer?.setPlaying(false));

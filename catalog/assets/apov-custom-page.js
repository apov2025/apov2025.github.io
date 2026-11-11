import {generateHarmoniousLook} from '../product/pkd/color-harmony.js';
import {initViewerFullscreen} from './viewer-fullscreen.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const translations=$$('[data-zh]').map(el=>({el,en:el.innerHTML,zh:el.dataset.zh}));
let language='en',viewer,stickerEditor,busy=false;try{if(localStorage.getItem('catalog-language')==='zh-CN')language='zh-CN';}catch{}
const stage=$('#viewer'),kind=document.body.dataset.device;
function sync(){
 if(viewer){for(const input of $$('[data-color-part]'))input.value=viewer.look[input.dataset.colorPart];$$('button[data-texture]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.texture===viewer.look.finish)));$('#auto-rotate').setAttribute('aria-pressed',String(viewer.rotating));}
 if(viewer)$$('[data-game-preset]').forEach(b=>b.setAttribute('aria-pressed',String(viewer.look.caseColor===b.dataset.case&&viewer.look.frontColor===b.dataset.front&&viewer.look.buttonColor===b.dataset.buttons)));
 if(viewer)$$('[data-shell-material]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.shellMaterial===viewer.look.shellMaterial)));
 if(stage)$('#viewer-status').textContent=stage.dataset.viewerState==='error'?(language==='en'?'Model could not load. Try again.':'模型加载失败，请重试。'):busy?(language==='en'?'Loading 3D model…':'正在加载 3D 模型…'):'';
}
function languageUI(){document.documentElement.lang=language;translations.forEach(({el,en,zh})=>{el.innerHTML=language==='en'?en:zh;});$$('[data-language]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.language===language)));viewer?.setLanguage(language);stickerEditor?.setLanguage(language);sync();}
$$('[data-language]').forEach(b=>b.addEventListener('click',()=>{language=b.dataset.language;try{localStorage.setItem('catalog-language',language);}catch{}languageUI();}));
async function load(){if(busy)return;busy=true;stage.dataset.viewerState='loading';$('#load-model').hidden=true;sync();
 try{const {createViewer}=await import('./apov-custom-viewer.js?v=mono-stickers-2');viewer=await createViewer($('#model-canvas'),{kind,url:new URL('./models/device.glb',location.href).href,onState:sync});window.__apovCustom=viewer;if(kind==='paper-mono-v2'){const {initStickerEditor}=await import('./paper-mono-stickers.js');stickerEditor=initStickerEditor($('#sticker-editor'),viewer,language);}if(kind==='prototype-game'){const b=$('[data-game-preset]');viewer.setLook({caseColor:b.dataset.case,frontColor:b.dataset.front,buttonColor:b.dataset.buttons});}stage.dataset.viewerState='ready';$('#viewer-poster').hidden=true;viewer.setLanguage(language);$$('[data-model-control]').forEach(b=>b.disabled=false);}
 catch{stage.dataset.viewerState='error';$('#load-model').hidden=false;$('#viewer-poster').hidden=false;}finally{busy=false;sync();}
}
if(stage){
 $$('[data-game-preset]').forEach(b=>b.addEventListener('click',()=>viewer?.setLook({caseColor:b.dataset.case,frontColor:b.dataset.front,buttonColor:b.dataset.buttons})));
 $('#load-model').addEventListener('click',load);$('#random-colorway').addEventListener('click',()=>{if(!viewer)return;const look=generateHarmoniousLook({previousCaseColor:viewer.look.caseColor});viewer.setLook({...look,backColor:look.caseColor,touchLeftColor:look.buttonColor,touchCenterColor:look.buttonColor,touchRightColor:look.buttonColor});});
 $('#auto-rotate').addEventListener('click',()=>viewer?.setRotate(!viewer.rotating));$$('[data-view]').forEach(b=>b.addEventListener('click',()=>viewer?.setView(b.dataset.view)));
 $$('[data-color-part]').forEach(i=>i.addEventListener('input',()=>viewer?.setLook({[i.dataset.colorPart]:i.value})));
 $$('button[data-texture]').forEach(b=>b.addEventListener('click',()=>viewer?.setLook({finish:b.dataset.texture})));
 $$('[data-shell-material]').forEach(b=>b.addEventListener('click',()=>viewer?.setLook({shellMaterial:b.dataset.shellMaterial})));
 $('#design-own').addEventListener('click',()=>{const p=$('#customization-panel');p.hidden=!p.hidden;$('#design-own').setAttribute('aria-expanded',String(!p.hidden));});
 const observer=new IntersectionObserver(([e])=>{if(e.isIntersecting){observer.disconnect();load();}},{rootMargin:'300px'});observer.observe(stage);
 addEventListener('pagehide',()=>viewer?.setRotate(false));
}
const preview=$('#colorway-preview');let lastTile;
if(preview){
 const close=()=>{preview.hidden=true;$('.hero-collage').classList.remove('is-expanded');lastTile?.setAttribute('aria-expanded','false');lastTile?.focus({preventScroll:true});};
 $$('.colorway-tile').forEach(tile=>tile.addEventListener('click',e=>{e.preventDefault();lastTile=tile;$('#colorway-preview-image').src=tile.href;$('#colorway-preview-image').alt=tile.dataset.title||'';preview.hidden=false;$('.hero-collage').classList.add('is-expanded');tile.setAttribute('aria-expanded','true');preview.focus({preventScroll:true});}));
 preview.addEventListener('click',close);preview.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}});
}
const copy=$('#copy-wechat');if(copy)copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText('weilaifuture65');$('#copy-status').textContent=language==='en'?'WeChat ID copied.':'微信号已复制。';}catch{$('#copy-status').textContent=language==='en'?'Select the WeChat ID above to copy it.':'请选中上方微信号手动复制。';}});
languageUI();
initViewerFullscreen();

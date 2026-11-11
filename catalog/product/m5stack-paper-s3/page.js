import {initViewerFullscreen} from '../../assets/viewer-fullscreen.js';
import {generateHarmoniousLook} from '../pkd/color-harmony.js';
import {createPaperViewer} from './viewer.js?v=internals-1';
const $=selector=>document.querySelector(selector);
const translations=[...document.querySelectorAll('[data-zh]')].map(el=>({el,en:el.textContent,zh:el.dataset.zh}));
let language='en',viewer,runtime,runtimePromise,busy=false,mode='firmware',frameCount=0,serial='',actionError=null,lastState={status:'idle'};
let importedCount=0,importedNames='',importingBooks=false;
try {if(localStorage.getItem('catalog-language')==='zh-CN')language='zh-CN';} catch {}
const stage=$('#viewer');
const text=(en,zh)=>language==='zh-CN'?zh:en;
function sync(){
  const state=lastState.status,paused=state==='paused';
  $('#pause-firmware').disabled=busy||!['running','paused'].includes(state);
  $('#restart-firmware').disabled=busy||!(['running','paused','ready'].includes(state)||(state==='error'&&lastState.firmware));
  $('#pause-firmware').textContent=paused?text('Resume','继续'):text('Pause','暂停');
  $('#boot-firmware').disabled=busy||!viewer;
  $('#boot-official').disabled=busy||!viewer;
  $('#firmware-file').disabled=busy||!viewer;
  $('#book-files').disabled=busy||!['running','paused','ready'].includes(state);
  $('#book-import-status').textContent=importingBooks?text('Importing books…','正在导入书籍…'):importedCount?text(`Imported ${importedCount}: ${importedNames} · Choose “Open library”`,`已导入 ${importedCount} 本：${importedNames} · 选择“打开书库”`):text('EDCBook includes Journey to the West · Import TXT, then choose “Open library”','EDCBook 预置《西游记》 · 导入 TXT 后选择“打开书库”');
  $('#firmware-mode').disabled=!viewer||busy;
  $('#firmware-mode').setAttribute('aria-pressed',String(mode==='firmware'));
  const labels={idle:text('Ready to start','待启动'),configured:text('Ready to start','待启动'),loading:text('Loading firmware…','正在载入固件…'),ready:text('Starting…','正在启动…'),running:frameCount?text('Running','运行中'):text('Starting…','正在启动…'),paused:text('Paused','已暂停'),error:text('Stopped','已停止'),disposed:text('Stopped','已停止')};
  let status=labels[state]||text('Ready to start','待启动');
  const progress=lastState.loadProgress;
  if(progress?.totalBytes&&progress.loadedBytes!=null)status+=` ${Math.min(100,Math.round(progress.loadedBytes/progress.totalBytes*100))}%`;
  $('#runtime-status').textContent=status;
  const failure=(state==='error'?lastState.lastError:null)||actionError;
  $('#firmware-error').textContent=failure?errorText(failure):'';
  if(lastState.firmwareName)$('#firmware-name').textContent=lastState.firmwareName;
  stage.dataset.runtimeState=state;
  $('#viewer-status').textContent=stage.dataset.viewerState==='error'?text('Model could not load. Reload to try again.','模型加载失败，请刷新重试。'):stage.dataset.viewerState!=='ready'?text('Loading 3D model…','正在加载 3D 模型…'):mode==='firmware'?text('Touch the screen · Drag outside the screen to rotate','点击屏幕操作 · 拖动屏幕外区域旋转'):'';
}
function renderLanguage(){
  document.documentElement.lang=language;
  for(const {el,en,zh} of translations)el.textContent=language==='zh-CN'?zh:en;
  for(const b of document.querySelectorAll('[data-language]'))b.setAttribute('aria-pressed',String(b.dataset.language===language));
  $('#zoom-in').setAttribute('aria-label',text('Zoom in','放大'));$('#zoom-out').setAttribute('aria-label',text('Zoom out','缩小'));
  $('#rotate-device').setAttribute('aria-label',text('Rotate device','转动设备'));$('#rotate-device').title=text('Rotate device','转动设备');
  viewer?.setLanguage(language);sync();
}
for(const b of document.querySelectorAll('[data-language]'))b.addEventListener('click',()=>{language=b.dataset.language;try{localStorage.setItem('catalog-language',language);}catch{}renderLanguage();});
function setMode(value){mode=value;stage.dataset.interactionMode=mode;viewer?.setMode(mode);sync();}
function errorText(error){
  const code=error?.code;
  if(code==='BOOK_LOAD_FAILED')return text('Could not load the bundled book. Try starting EDCBook again.','预置书籍未能载入，请重新运行 EDCBook。');
  if(code==='SD_FULL')return text('The virtual TF card is full.','虚拟 TF 卡空间不足。');
  if(code==='INVALID_BOOK')return text('Choose non-empty TXT files, up to 64 MB in total.','请选择非空 TXT 文件，总大小不超过 64 MB。');
  if(code==='SD_NOT_LOADED')return text('Start the firmware before importing books.','请先启动固件，再导入书籍。');
  if(['INVALID_SD_IMAGE','UNSUPPORTED_SD_IMAGE'].includes(code))return text('Could not read this virtual TF card.','无法读取此虚拟 TF 卡。');
  if(code==='EMULATOR_STOPPED'){
    const instruction=serial.match(/unimplemented instruction at ([0-9a-f]+)/i)?.[1];
    if(instruction)return text(`This firmware uses an unsupported CPU instruction (${instruction}).`,`此固件使用了模拟器尚未支持的 CPU 指令（${instruction}）。`);
    const stopCode=error.message?.match(/code (\d+)/)?.[1];
    return stopCode?text(`The simulator stopped (code ${stopCode}). Restart to try again.`,`模拟器已停止（代码 ${stopCode}），请点击“重启”重试。`):text('The simulator stopped. Restart to try again.','模拟器已停止，请点击“重启”重试。');
  }
  if(code==='STORAGE_CONFLICT')return text('Another tab changed this device. Close the other tab, then restart.','另一个页面修改了此设备的数据。请关闭另一个页面后重启。');
  if(['WORKER_ERROR','STORAGE_WORKER_ERROR'].includes(code))return text('The simulator worker stopped. Restart to try again.','模拟器运行进程已停止，请点击“重启”重试。');
  if(['INCOMPLETE_IMAGE','CHIP_MISMATCH','FLASH_OVERFLOW','INVALID_PARTITION_TABLE'].includes(code))return text('Choose a complete PaperS3 merged .bin image.','请选择 PaperS3 完整合并的 .bin 固件镜像。');
  if(['FETCH_FAILED','FETCH_ABORTED','HTTP_ERROR'].includes(code))return text('Firmware download failed. Try again or load a local .bin file.','固件下载失败，请重试或载入本地 .bin 文件。');
  return text('Could not load this firmware. Try again or choose another image.','固件未能载入，请重试或选择其他镜像。');
}
async function run(action){if(busy)return;busy=true;actionError=null;sync();try{await action();}catch(error){actionError=error;}finally{busy=false;sync();}}
async function getRuntime(){
  if(!runtimePromise)runtimePromise=import('./runtime.js?v=book-preload-1').then(({createPaperRuntime})=>createPaperRuntime({
    onFrame(frame){frameCount=frame.frameNumber;stage.dataset.frames=String(frameCount);viewer?.setFrame(frame);},
    onState(state){if(state.status==='loading'&&lastState.status!=='loading'){serial='';frameCount=0;stage.dataset.frames='0';$('#serial-output').textContent='';viewer?.clear();}lastState=state;sync();},
    onSerial({data}){serial=(serial+data).slice(-32768);$('#serial-output').textContent=serial;},
  })).then(value=>runtime=value).catch(error=>{runtimePromise=null;throw error;});
  return runtimePromise;
}
async function boot(){await run(async()=>{setMode('firmware');const device=await getRuntime();await device.bootDefault();});}
$('#boot-firmware').addEventListener('click',boot);
$('#boot-official').addEventListener('click',()=>run(async()=>{const device=await getRuntime();await device.bootOfficial();}));
$('#firmware-mode').addEventListener('click',()=>{if(!frameCount&&!busy)boot();else setMode('firmware');});
$('#firmware-file').addEventListener('change',e=>{const file=e.target.files[0];e.target.value='';if(!file)return;run(async()=>{const device=await getRuntime();await device.loadFile(file);setMode('firmware');});});
$('#book-files').addEventListener('change',e=>{const files=Array.from(e.target.files);e.target.value='';if(!files.length||busy)return;importingBooks=true;run(async()=>{try{viewer?.release();const result=await runtime.importBooks(files);importedCount=result.files.length;importedNames=result.files.slice(0,3).map(file=>file.name).join('、')+(result.files.length>3?'…':'');}finally{importingBooks=false;}});});
$('#pause-firmware').addEventListener('click',()=>run(async()=>{viewer?.release();if(runtime.state.status==='paused')await runtime.start();else await runtime.pause();}));
$('#restart-firmware').addEventListener('click',()=>run(async()=>{viewer?.release();await runtime.reset();await runtime.start();setMode('firmware');}));
$('#reset-view').addEventListener('click',()=>viewer?.setView());
$('#rotate-device').addEventListener('click',()=>viewer?.rotateDevice());
$('#zoom-in').addEventListener('click',()=>viewer?.zoom(.88));$('#zoom-out').addEventListener('click',()=>viewer?.zoom(1.12));
$('#design-own').addEventListener('click',()=>{const p=$('#customization-panel');p.hidden=!p.hidden;$('#design-own').setAttribute('aria-expanded',String(!p.hidden));});
$('#hook-visible').addEventListener('change',e=>viewer?.setHook(e.target.checked));
for(const [id,part] of [['shell-color','Case'],['front-color','Front'],['button-color','Buttons']])$('#'+id).addEventListener('input',e=>viewer?.setLook({[part]:e.target.value}));
$('#random-colorway').addEventListener('click',()=>{const look=generateHarmoniousLook({previousCaseColor:$('#shell-color').value});$('#shell-color').value=look.caseColor;$('#front-color').value=look.frontColor;$('#button-color').value=look.buttonColor;viewer?.setLook({Case:look.caseColor,Front:look.frontColor,Buttons:look.buttonColor});});
initViewerFullscreen(stage,'.customization-actions, #customization-panel, #firmware-controls, #firmware-details');
renderLanguage();
try {
  viewer=await createPaperViewer($('#model-canvas'),{onTouch:point=>{if(runtime&&['running','paused'].includes(runtime.state.status))runtime.touch(point).catch(()=>{});}});
  viewer.setMode('firmware');viewer.setLanguage(language);stage.dataset.viewerState='ready';$('#viewer-poster').hidden=true;
  for(const selector of ['#firmware-mode','#reset-view','#rotate-device','#zoom-in','#zoom-out','#random-colorway','#shell-color','#front-color','#button-color','#hook-visible'])$(selector).disabled=false;
} catch(error){stage.dataset.viewerState='error';}
sync();
window.__paperS3={get runtime(){return runtime;},viewer};
addEventListener('pagehide',event=>{
  viewer?.release();
  if(event.persisted){if(runtime?.state.status==='running')runtime.pause().catch(()=>{});}
  else runtime?.dispose();
});
addEventListener('pageshow',event=>{if(event.persisted)sync();});

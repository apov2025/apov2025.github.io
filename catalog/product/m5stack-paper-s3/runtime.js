import {createPlatformRuntime, validateMergedImage, fetchBytes} from './vendor/platform/runtime.js?v=refresh-jit-1';
import {loadCatalog, createDefaultScene} from './vendor/platform/catalog.js';
import {addBooksToSd,hasBookOnSd} from './sd-books.js';
import {enterEdcbookLibrary} from './edcbook-startup.js?v=auto-library-2';

export const OFFICIAL_FIRMWARE = Object.freeze({
  name: 'UserDemo v0.5',
  url: 'https://m5burner-cdn.m5stack.com/firmware/16287f6984f8ec7fe8058a6c3497b3b4.bin',
  sha256: 'd6733a0ca378f95335fa5fba4d4d992fb1dd97c17557b20e9aebfca08ba6d624',
});

export const DEFAULT_FIRMWARE = Object.freeze({
  name: 'EDCBook 3.1.2',
  url: 'https://m5burner-cdn.m5stack.com/firmware/e9a34bd8a7095acf6a43dae2b1565a60.bin',
  sha256: '06eb3b595fc47bc5d35f760a16cdc5795ea8c0fad6295bcee8db5268cf906986',
});

export const DEFAULT_BOOK=Object.freeze({
  name:'西游记.txt',
  url:new URL('./books/xiyouji.txt',import.meta.url).href,
  sha256:'bd18088ccb70d3164e3a4bc9805a6ea72095d6cc3891e4f172ed0a3d281292bb',
});

// This host only loads virtual flash. The upstream physical flasher is not imported.
export async function createPaperRuntime({onFrame, onState, onSerial} = {}) {
  const catalog = await loadCatalog();
  let lastFrame=null,session=0,suspended=false;
  let state = {status: 'idle', stats: {}, frame: null, firmwareName: null};
  const publish = patch => {
    state = {...state, ...patch};
    onState?.(state);
  };
  const cancelStartup=()=>{if(state.startup?.phase!=='starting')return false;session++;publish({startup:{...state.startup,phase:'manual'}});return true;};
  const runtime = createPlatformRuntime({
    catalog,
    assetBaseUrl: new URL('./vendor/', import.meta.url).href,
    requestTimeout: 60000,
    onEvent(event) {
      if (event.type === 'state') {if(event.state.status==='loading')lastFrame=null;publish({...event.state, loadProgress: null});}
      else if (event.type === 'load-progress') publish({loadProgress: event});
      else if (event.type === 'stats') publish({stats: event.stats});
      else if (event.type === 'error') publish({lastError: event.error});
      else if (event.type === 'serial') onSerial?.({port: event.source, data: event.data});
      else if (event.type === 'frame') {
        lastFrame=event;
        publish({frame: {width: event.width, height: event.height, frameNumber: event.frameNumber}});
        onFrame?.(event);
      }
    },
  });
  const scene = createDefaultScene(catalog, 'm5stack-c139');
  scene.firmware = {url: DEFAULT_FIRMWARE.url, sha256: DEFAULT_FIRMWARE.sha256};
  await runtime.configure(scene);

  let touchQueue=Promise.resolve(),touchStart=null,touchEpoch=0;
  const cancelTouches=()=>{touchEpoch++;touchStart=null;touchQueue=Promise.resolve();};
  const touch=({x,y,pressed,duration=0})=>{
    const epoch=touchEpoch;
    const pending=touchQueue.then(async()=>{
      if(epoch!==touchEpoch)return;
      if(!pressed&&touchStart){
        // A host click may be much shorter than one emulated touch scan. Keep
        // it down for a guest-clock interval rather than collapsing down/up.
        const deadline=performance.now()+5000;
        while(epoch===touchEpoch&&state.status==='running'&&(state.stats.time??0)<touchStart.until&&performance.now()<deadline)await new Promise(resolve=>setTimeout(resolve,16));
      }
      if(epoch!==touchEpoch||!['running','paused'].includes(state.status)||(pressed&&state.status!=='running'))return;
      const receipt=await runtime.input({type:'touch',x,y,down:pressed});
      if(epoch!==touchEpoch)return receipt;
      if(pressed&&!touchStart)touchStart={x,y,until:receipt.guestTime+Math.max(.16,Math.min(2,duration))};
      if(!pressed)touchStart=null;
      return receipt;
    });
    touchQueue=pending.catch(()=>{});
    return pending;
  };
  const releaseActiveTouch=()=>{
    const epoch=touchEpoch;
    const pending=touchQueue.then(async()=>{
      if(epoch!==touchEpoch||!touchStart)return;
      if(['running','paused'].includes(state.status))await runtime.input({type:'touch',x:touchStart.x,y:touchStart.y,down:false});
      if(epoch===touchEpoch)touchStart=null;
    });
    touchQueue=pending.catch(()=>{});return pending;
  };
  const resetGuest=async()=>{cancelTouches();const result=await runtime.reset();if(suspended&&state.status==='running')return runtime.pause();return result;};
  const load = async (source, name, current=++session) => {
    const check=()=>{if(current!==session)throw Object.assign(new Error('Firmware session replaced'),{code:'SESSION_REPLACED'});};
    suspended=false;publish({startup:null});cancelTouches();
    await runtime.loadFirmware(source);check();
    publish({firmwareName: name, lastError: null});
    if(state.firmware?.artifacts?.some(file=>file.sha256===DEFAULT_FIRMWARE.sha256)){
      const card=await runtime.exportSdCard();check();
      if(!hasBookOnSd(card.bytes,DEFAULT_BOOK.name)){
        let data;
        try{data=await fetchBytes(DEFAULT_BOOK.url,{maxBytes:3*1024*1024,sha256:DEFAULT_BOOK.sha256});}
        catch(error){throw Object.assign(error,{code:'BOOK_LOAD_FAILED'});}
        check();
        const result=addBooksToSd(card.bytes,[{name:DEFAULT_BOOK.name,data}]);
        await runtime.attachSdCard({bytes:result.image});check();
      }
    }
    const result=await runtime.start();if(suspended&&state.status==='running')return runtime.pause();return result;
  };
  return Object.freeze({
    get state() { return state; },
    async bootDefault() {
      const current=++session;
      await load(scene.firmware, DEFAULT_FIRMWARE.name,current);
      if(current!==session||suspended)return state;
      publish({startup:{phase:'starting',restarts:0}});
      void enterEdcbookLibrary({
        state:()=>state,frame:()=>lastFrame,active:()=>current===session,
        onProgress:startup=>{if(current===session)publish({startup});},
        tap:async(x,y)=>{if(current!==session)return;await touch({x,y,pressed:true});if(current===session)await touch({x,y,pressed:false});},
        restart:()=>{if(current!==session)return;return resetGuest();},
      }).catch(error=>{if(current===session)publish({startup:{...state.startup,phase:'manual'},lastError:error});});
      return state;
    },
    bootOfficial: () => load(OFFICIAL_FIRMWARE, OFFICIAL_FIRMWARE.name),
    async loadFile(file) {
      if (!file || typeof file.arrayBuffer !== 'function' || !Number.isSafeInteger(file.size) || file.size <= 0 || file.size > 16*1024*1024) {
        throw Object.assign(new Error('请选择不超过 16 MB 的 PaperS3 完整固件。'), {code: 'INVALID_FILE'});
      }
      // Validate before upstream loadFirmware stops/replaces the current guest.
      validateMergedImage(new Uint8Array(await file.arrayBuffer()), 'papers3', 16*1024*1024);
      return load({format: 'merged', file}, file.name);
    },
    async importBooks(files) {
      cancelStartup();
      if (!['running','paused','ready'].includes(state.status)) {
        throw Object.assign(new Error('Load firmware first.'), {code:'SD_NOT_LOADED'});
      }
      const selected=Array.from(files||[]);
      if (!selected.length||selected.some(file=>!file.name?.toLowerCase().endsWith('.txt')||!file.size)||selected.reduce((sum,file)=>sum+file.size,0)>64*1024*1024) {
        throw Object.assign(new Error('Choose TXT books fitting the virtual TF card.'), {code:'INVALID_BOOK'});
      }
      const books=await Promise.all(selected.map(async file=>({name:file.name,data:new Uint8Array(await file.arrayBuffer())})));
      await touchQueue;
      if(touchStart&&['running','paused'].includes(state.status))await runtime.input({type:'touch',x:touchStart.x,y:touchStart.y,down:false});
      cancelTouches();
      const resume=state.status==='running';
      if(resume)await runtime.pause();
      try {
        const card=await runtime.exportSdCard();
        const result=addBooksToSd(card.bytes,books);
        await runtime.attachSdCard({bytes:result.image});
        await runtime.start();
        return {files:result.files,freeBytes:result.freeBytes};
      } catch(error) {
        if(resume&&state.status==='paused')await runtime.start();
        throw error;
      }
    },
    start: () => {suspended=false;return runtime.start();},
    async pause() {cancelStartup();await releaseActiveTouch();cancelTouches();return runtime.pause();},
    async suspend() {suspended=true;cancelStartup();await releaseActiveTouch();if(state.status==='running')await runtime.pause();},
    reset: () => {suspended=false;session++;publish({startup:null});return resetGuest();},
    touch:point=>{if(cancelStartup())void releaseActiveTouch();return touch(point);},
    button: (id, pressed) => runtime.input({type: 'button', id, pressed}),
    observe: () => runtime.observe(),
    capture: (options = {format: 'rgba'}) => runtime.capture(options),
    dispose: () => {session++;cancelTouches();return runtime.dispose();},
  });
}

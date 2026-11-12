import {Scene,Color,CanvasTexture,SRGBColorSpace,PerspectiveCamera,WebGLRenderer,HemisphereLight,DirectionalLight,PMREMGenerator,Vector3,ACESFilmicToneMapping,OrbitControls,GLTFLoader,RoomEnvironment} from '../prototype/vendor/three-runtime.js';

export async function createPaperViewer(container,{onTouch=()=>{},onPower=()=>{},onHookChange=()=>{}}={}) {
  const scene=new Scene();scene.background=new Color('#edf0f2');
  const camera=new PerspectiveCamera(32,1,.01,2),renderer=new WebGLRenderer({antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=ACESFilmicToneMapping;
  const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('role','img');container.append(canvas);
  const controls=new OrbitControls(camera,canvas);controls.enabled=false;controls.enablePan=false;controls.enableRotate=false;controls.minDistance=.17;controls.maxDistance=.55;controls.rotateSpeed=.65;
  canvas.style.touchAction='pan-y';
  const room=new RoomEnvironment(),pmrem=new PMREMGenerator(renderer),env=pmrem.fromScene(room,.04);
  scene.environment=env.texture;scene.environmentIntensity=.7;room.dispose();pmrem.dispose();
  scene.add(new HemisphereLight(0xffffff,0xb5bdc3,.6));const light=new DirectionalLight(0xffffff,.4);light.position.set(-1,2,3);scene.add(light);
  const screen=document.createElement('canvas');screen.width=540;screen.height=960;
  const ctx=screen.getContext('2d',{alpha:false});ctx.fillStyle='#e1e3dc';ctx.fillRect(0,0,540,960);
  const texture=new CanvasTexture(screen);texture.flipY=false;texture.colorSpace=SRGBColorSpace;
  let model,labelTexture,mode='firmware',pointer=null,hardware=null,disposed=false,rotation=0,language='en';
  const mounts=[-1,1].map(side=>{const button=document.createElement('button');button.type='button';button.hidden=true;button.className='papers3-hook-mount';button.addEventListener('click',()=>setHook(true));container.append(button);return {button,side};});
  const removeHook=document.createElement('button');removeHook.type='button';removeHook.hidden=true;removeHook.className='papers3-hook-action';container.append(removeHook);removeHook.addEventListener('click',()=>setHook(false));
  let selectedScrew=null;
  const contacts=new Map();let gesture=null,pinchDistance=0;
  const materials={};
  let fullscreenFit=null,outsideDistance=.29;
  const compactFullscreen=()=>!!container.closest('.viewer-fullscreen-compact');
  function fitDistance(){
    const width=rotation%2?.1335:.0684,height=rotation%2?.0684:.1335;
    return Math.max(height,width/camera.aspect)/(2*Math.tan(camera.fov*Math.PI/360))*1.04+.004;
  }
  function render(){if(!disposed){renderer.render(scene,camera);updateMount();}}
  function projectLocal(p){const box=canvas.getBoundingClientRect();model.localToWorld(p);p.project(camera);return {x:box.left+(p.x+1)*box.width/2,y:box.top+(1-p.y)*box.height/2};}
  function placeControl(button,point,offset=0){const p=projectLocal(point),box=container.getBoundingClientRect();button.style.left=`${p.x-box.left}px`;button.style.top=`${p.y-box.top+offset}px`;}
  function updateMount(){
    if(!model)return;
    const attached=model.getObjectByName('BottomHook').visible,eye=model.worldToLocal(camera.position.clone());
    for(const {button,side} of mounts){button.hidden=attached||eye.y>-.060; if(!button.hidden)placeControl(button,new Vector3(side*.012,-.06075,0));}
    if(!removeHook.hidden&&selectedScrew)placeControl(removeHook,new Vector3(selectedScrew.endsWith('L')?-.012:.012,-.06186,0),24);
  }
  function setHook(visible){
    if(!model)return;removeHook.hidden=true;
    for(const name of ['BottomHook','HookScrew_L','HookScrew_L_Recess','HookScrew_R','HookScrew_R_Recess'])model.getObjectByName(name).visible=!!visible;
    onHookChange(!!visible);render();
  }
  function partHit(event){
    if(!model)return null;
    for(const name of ['PowerButton','HookScrew_L','HookScrew_R']){
      const part=model.getObjectByName(name);if(!part?.visible)continue;
      const b=part.geometry.boundingBox,box=canvas.getBoundingClientRect(),xs=[],ys=[];
      for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){const p=part.localToWorld(new Vector3(x,y,z)).project(camera);xs.push(box.left+(p.x+1)*box.width/2);ys.push(box.top+(1-p.y)*box.height/2);}
      if(event.clientX>=Math.min(...xs)-4&&event.clientX<=Math.max(...xs)+4&&event.clientY>=Math.min(...ys)-4&&event.clientY<=Math.max(...ys)+4){
        // Mesh.raycast uses this raycaster contract; the first visible triangle
        // prevents a hidden side key being activated through the case.
        for(const [dx,dy] of [[0,0],[-2,0],[2,0],[0,-2],[0,2],[-4,0],[4,0],[0,-4],[0,4]]){
          const ray={origin:camera.position.clone(),direction:new Vector3((event.clientX+dx-box.left)/box.width*2-1,1-(event.clientY+dy-box.top)/box.height*2,.5).unproject(camera).sub(camera.position).normalize()};
          const hits=[];model.traverseVisible(o=>{if(o.isMesh)o.raycast({ray,near:camera.near,far:camera.far},hits);});
          hits.sort((a,b)=>a.distance-b.distance);
          if(hits[0]?.object===part||hits[0]?.object.name===name+'_Recess')return name;
        }
      }
    }
    return null;
  }
  function endHardware(activate=false){
    if(!hardware)return;const {name}=hardware;hardware=null;
    if(name==='PowerButton'){model.getObjectByName(name).position.x=0;render();if(activate)onPower();}
    else if(activate){selectedScrew=name;removeHook.hidden=false;render();}
  }
  controls.addEventListener('change',render);
  function setView(){
    release();
    const distance=compactFullscreen()?fitDistance():rotation%2?Math.max(.18,Math.min(.55,Math.max(.0677,.1275/camera.aspect)/(2*Math.tan(camera.fov*Math.PI/360))*1.15)):.29;
    if(compactFullscreen())fullscreenFit=distance;
    camera.position.set(...(mode==='firmware'?[0,0,distance]:[.055,.018,distance]));controls.target.set(0,0,0);controls.update();render();
  }
  function zoom(factor){camera.position.multiplyScalar(factor);camera.position.clampLength(controls.minDistance,controls.maxDistance);controls.update();render();}
  function setMode(value){release();mode=value;canvas.style.touchAction='none';setView();}
  function setLook(look){for(const [name,color] of Object.entries(look))materials[name]?.forEach(m=>m.color.set(color));container.closest('.viewer').dataset.shellColor=materials.Case?.[0].color.getHexString()?`#${materials.Case[0].color.getHexString()}`:'';render();}
  function setFrame({width,height,pixels}){if(screen.width!==width||screen.height!==height){screen.width=width;screen.height=height;}ctx.putImageData(new ImageData(pixels,width,height),0,0);texture.needsUpdate=true;render();}
  function screenPoint(x,y){
    const box=canvas.getBoundingClientRect(),p=new Vector3(-.02916+x/screen.width*.05832,.05564-y/screen.height*.10368,.00372);
    model.localToWorld(p);p.project(camera);
    return {x:box.left+(p.x+1)*box.width/2,y:box.top+(1-p.y)*box.height/2};
  }
  function screenBounds(){
    const corners=[[0,0],[screen.width,0],[0,screen.height],[screen.width,screen.height]].map(([x,y])=>screenPoint(x,y));
    const xs=corners.map(p=>p.x),ys=corners.map(p=>p.y);
    return {left:Math.min(...xs),top:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
  }
  function point(event,clamp=false){
    if(!model)return null;
    // Intersect the pointer ray with the display in model space. Unlike an
    // affine screen rectangle, this remains accurate under perspective orbit.
    const box=canvas.getBoundingClientRect();
    const origin=model.worldToLocal(camera.position.clone());
    const target=model.worldToLocal(new Vector3((event.clientX-box.left)/box.width*2-1,1-(event.clientY-box.top)/box.height*2,.5).unproject(camera));
    const direction=target.sub(origin);
    if(origin.z<=.00372||Math.abs(direction.z)<1e-9)return null;
    const t=(.00372-origin.z)/direction.z;if(t<0)return null;
    const hit=origin.addScaledVector(direction,t);
    const x=(hit.x+.02916)/.05832,y=(.05564-hit.y)/.10368;
    if(!clamp&&(x<0||x>1||y<0||y>1))return null;
    return {x:Math.max(0,Math.min(screen.width-1,Math.floor(x*screen.width))),y:Math.max(0,Math.min(screen.height-1,Math.floor(y*screen.height)))};
  }
  function endTouch(){
    if(pointer?.sent)onTouch({...pointer.point,pressed:false});pointer=null;
  }
  function release(){removeHook.hidden=true;endTouch();endHardware();contacts.clear();gesture=null;pinchDistance=0;}
  function beginTouch(duration=0){
    if(pointer&&!pointer.sent){pointer.sent=true;onTouch({...pointer.point,pressed:true,duration});}
  }
  function distance(){const [a,b]=[...contacts.values()];return Math.hypot(a.x-b.x,a.y-b.y);}
  function orbit(dx,dy){
    const offset=camera.position.clone().sub(controls.target),r=offset.length();
    const yaw=Math.atan2(offset.x,offset.z)-dx*.008;
    const pitch=Math.max(-Math.PI/2+.03,Math.min(Math.PI/2-.03,Math.asin(offset.y/r)+dy*.008));
    camera.position.set(r*Math.cos(pitch)*Math.sin(yaw),r*Math.sin(pitch),r*Math.cos(pitch)*Math.cos(yaw)).add(controls.target);
    controls.update();render();
  }
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;removeHook.hidden=true;e.preventDefault();canvas.setPointerCapture(e.pointerId);
    contacts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(contacts.size>1){const committed=pointer?.sent;endTouch();endHardware();gesture=committed?'suppress':'pinch';pinchDistance=distance();return;}
    const p=mode==='firmware'?point(e):null;
    const part=p?null:partHit(e);
    if(part){hardware={id:e.pointerId,name:part,x:e.clientX,y:e.clientY,at:performance.now()};gesture='hardware';if(part==='PowerButton'){model.getObjectByName(part).position.x=-.0006;render();}return;}
    gesture=p?'screen':'orbit';
    if(p){pointer={id:e.pointerId,point:p,sent:false,startX:e.clientX,startY:e.clientY,started:performance.now(),isTouch:e.pointerType==='touch'};
      // Touch taps commit on release, leaving time for a second finger. A
      // deliberate single-finger drag commits to firmware until all fingers lift.
      if(!pointer.isTouch)beginTouch();
    }
  });
  canvas.addEventListener('pointermove',e=>{
    const previous=contacts.get(e.pointerId);if(!previous){const part=partHit(e);canvas.style.cursor=part?'pointer':'';canvas.title=part==='PowerButton'?(language==='zh-CN'?'电源 / 重启':'Power / Restart'):part?.startsWith('HookScrew_')?(language==='zh-CN'?'吊环固定螺钉':'Loop screw'):'';return;}
    contacts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(gesture==='pinch'&&contacts.size>=2){const next=distance();if(pinchDistance>0&&next>0)zoom(pinchDistance/next);pinchDistance=next;}
    else if(gesture==='hardware'&&hardware&&Math.hypot(e.clientX-hardware.x,e.clientY-hardware.y)>8){endHardware();gesture='orbit';orbit(e.clientX-previous.x,e.clientY-previous.y);}
    else if(gesture==='orbit')orbit(e.clientX-previous.x,e.clientY-previous.y);
    else if(pointer?.id===e.pointerId){if(!pointer.sent&&Math.hypot(e.clientX-pointer.startX,e.clientY-pointer.startY)>12)beginTouch();pointer.point=point(e,true)||pointer.point;if(pointer.sent)onTouch({...pointer.point,pressed:true});}
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>{
    if(!contacts.has(e.pointerId))return;
    if(hardware?.id===e.pointerId)endHardware(type==='pointerup'&&performance.now()-hardware.at<800);
    if(pointer?.id===e.pointerId){if(type==='pointerup')beginTouch(pointer.isTouch?Math.min(2,(performance.now()-pointer.started)/1000):0);endTouch();}
    contacts.delete(e.pointerId);
    // A finger left after a pinch cannot accidentally start a screen touch.
    if(!contacts.size){gesture=null;pinchDistance=0;}
  });
  canvas.addEventListener('wheel',e=>{e.preventDefault();release();zoom(Math.exp(Math.max(-100,Math.min(100,e.deltaY))*.002));},{passive:false});
  const blur=()=>release();window.addEventListener('blur',blur);
  canvas.addEventListener('keydown',e=>{
    if(e.key.toLowerCase()==='p'&&!e.repeat){e.preventDefault();onPower();return;}
    if(['+','=','-'].includes(e.key)){e.preventDefault();zoom(e.key==='-'?1.1:.9);return;}

  });
  const resize=new ResizeObserver(()=>{
    const {width,height}=container.getBoundingClientRect();if(!width||!height)return;
    renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
    const offset=camera.position.clone().sub(controls.target);
    if(compactFullscreen()){
      const fit=fitDistance();
      if(fullscreenFit===null){outsideDistance=offset.length();offset.setLength(fit);}
      else offset.multiplyScalar(fit/fullscreenFit);
      fullscreenFit=fit;controls.minDistance=.08;controls.maxDistance=Math.max(.55,fit*2);
    }else if(fullscreenFit!==null){offset.setLength(outsideDistance);fullscreenFit=null;controls.minDistance=.17;controls.maxDistance=.55;}
    camera.position.copy(controls.target).add(offset);controls.update();render();
  });resize.observe(container);
  function dispose(){release();disposed=true;resize.disconnect();window.removeEventListener('blur',blur);controls.dispose();env.dispose();texture.dispose();labelTexture?.dispose();model?.traverse(o=>{o.geometry?.dispose();for(const m of o.material?[].concat(o.material):[])m.dispose();});renderer.dispose();canvas.remove();for(const {button} of mounts)button.remove();removeHook.remove();}
  try {
    model=(await new GLTFLoader().loadAsync(new URL('./models/device.glb?v=hook-screws-1',import.meta.url).href)).scene;
    const labelImage=new Image();labelImage.src=new URL('./media/virtual-paper-s3-label.svg',import.meta.url).href;await labelImage.decode();
    const labelCanvas=document.createElement('canvas');labelCanvas.width=1080;labelCanvas.height=1520;labelCanvas.getContext('2d').drawImage(labelImage,0,0,1080,1520);
    labelTexture=new CanvasTexture(labelCanvas);labelTexture.flipY=false;labelTexture.colorSpace=SRGBColorSpace;labelTexture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    model.traverse(o=>{for(const m of o.material?[].concat(o.material):[]){(materials[m.name]??=[]).push(m);if(o.name==='Screen'){m.color.set('#000000');m.emissive.set('#ffffff');m.emissiveMap=texture;m.emissiveIntensity=1;m.toneMapped=false;m.needsUpdate=true;}}});
    model.getObjectByName('RearLabel').material.map=labelTexture;
    for(const name of ['PowerButton','HookScrew_L','HookScrew_R'])model.getObjectByName(name).geometry.computeBoundingBox();
    scene.add(model);setView();
  } catch(error){dispose();throw error;}
  return {setMode,setView,setLook,setFrame,clear(){ctx.fillStyle='#e1e3dc';ctx.fillRect(0,0,540,960);texture.needsUpdate=true;render();},zoom,dispose,screenBounds,screenPoint,release,
    setHook,
    partPoint(name){const part=model.getObjectByName(name),p=part.geometry.boundingBox.getCenter(new Vector3());return projectLocal(p);},
    rotateDevice(){release();rotation=(rotation+1)%4;model.rotation.z=rotation*Math.PI/2;model.updateMatrixWorld(true);setView();},
    setLanguage(lang){language=lang;for(const {button} of mounts){button.setAttribute('aria-label',lang==='zh-CN'?'装上吊环':'Attach loop');button.title=button.getAttribute('aria-label');}removeHook.textContent=lang==='zh-CN'?'取下吊环':'Remove loop';canvas.setAttribute('aria-label',lang==='zh-CN'?'PaperS3 固件模拟器。点击屏幕操作，拖动外壳旋转，双指缩放。点击侧键或按 P 重启，点击固定螺钉拆下吊环。':'PaperS3 firmware simulator. Touch the screen, drag the case to rotate, pinch to zoom. Click the side key or press P to restart; click a fixing screw to remove the loop.');},
  };
}

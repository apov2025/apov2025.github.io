import {Scene,Color,CanvasTexture,SRGBColorSpace,PerspectiveCamera,WebGLRenderer,HemisphereLight,DirectionalLight,PMREMGenerator,Vector3,ACESFilmicToneMapping,OrbitControls,GLTFLoader,RoomEnvironment} from '../prototype/vendor/three-runtime.js';

export async function createPaperViewer(container,{onTouch=()=>{}}={}) {
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
  let model,labelTexture,mode='firmware',pointer=null,disposed=false,rotation=0;
  const contacts=new Map();let gesture=null,pinchDistance=0;
  const materials={};
  function render(){if(!disposed)renderer.render(scene,camera);}
  controls.addEventListener('change',render);
  function setView(){
    release();
    const distance=rotation%2?Math.max(.18,Math.min(.55,Math.max(.0677,.1275/camera.aspect)/(2*Math.tan(camera.fov*Math.PI/360))*1.15)):.29;
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
  function release(){endTouch();contacts.clear();gesture=null;pinchDistance=0;}
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
    if(e.button!==0)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);
    contacts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(contacts.size>1){const committed=pointer?.sent;endTouch();gesture=committed?'suppress':'pinch';pinchDistance=distance();return;}
    const p=mode==='firmware'?point(e):null;
    gesture=p?'screen':'orbit';
    if(p){pointer={id:e.pointerId,point:p,sent:false,startX:e.clientX,startY:e.clientY,started:performance.now(),isTouch:e.pointerType==='touch'};
      // Touch taps commit on release, leaving time for a second finger. A
      // deliberate single-finger drag commits to firmware until all fingers lift.
      if(!pointer.isTouch)beginTouch();
    }
  });
  canvas.addEventListener('pointermove',e=>{
    const previous=contacts.get(e.pointerId);if(!previous)return;
    contacts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(gesture==='pinch'&&contacts.size>=2){const next=distance();if(pinchDistance>0&&next>0)zoom(pinchDistance/next);pinchDistance=next;}
    else if(gesture==='orbit')orbit(e.clientX-previous.x,e.clientY-previous.y);
    else if(pointer?.id===e.pointerId){if(!pointer.sent&&Math.hypot(e.clientX-pointer.startX,e.clientY-pointer.startY)>12)beginTouch();pointer.point=point(e,true)||pointer.point;if(pointer.sent)onTouch({...pointer.point,pressed:true});}
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>{
    if(!contacts.has(e.pointerId))return;
    if(pointer?.id===e.pointerId){if(type==='pointerup')beginTouch(pointer.isTouch?Math.min(2,(performance.now()-pointer.started)/1000):0);endTouch();}
    contacts.delete(e.pointerId);
    // A finger left after a pinch cannot accidentally start a screen touch.
    if(!contacts.size){gesture=null;pinchDistance=0;}
  });
  canvas.addEventListener('wheel',e=>{e.preventDefault();release();zoom(Math.exp(Math.max(-100,Math.min(100,e.deltaY))*.002));},{passive:false});
  const blur=()=>release();window.addEventListener('blur',blur);
  canvas.addEventListener('keydown',e=>{
    if(['+','=','-'].includes(e.key)){e.preventDefault();zoom(e.key==='-'?1.1:.9);return;}

  });
  const resize=new ResizeObserver(()=>{const {width,height}=container.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();render();});resize.observe(container);
  function dispose(){release();disposed=true;resize.disconnect();window.removeEventListener('blur',blur);controls.dispose();env.dispose();texture.dispose();labelTexture?.dispose();model?.traverse(o=>{o.geometry?.dispose();for(const m of o.material?[].concat(o.material):[])m.dispose();});renderer.dispose();canvas.remove();}
  try {
    model=(await new GLTFLoader().loadAsync(new URL('./models/device.glb?v=internals-1',import.meta.url).href)).scene;
    const labelImage=new Image();labelImage.src=new URL('./media/virtual-paper-s3-label.svg',import.meta.url).href;await labelImage.decode();
    const labelCanvas=document.createElement('canvas');labelCanvas.width=1080;labelCanvas.height=1520;labelCanvas.getContext('2d').drawImage(labelImage,0,0,1080,1520);
    labelTexture=new CanvasTexture(labelCanvas);labelTexture.flipY=false;labelTexture.colorSpace=SRGBColorSpace;labelTexture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    model.traverse(o=>{for(const m of o.material?[].concat(o.material):[]){(materials[m.name]??=[]).push(m);if(o.name==='Screen'){m.color.set('#000000');m.emissive.set('#ffffff');m.emissiveMap=texture;m.emissiveIntensity=1;m.toneMapped=false;m.needsUpdate=true;}}});
    model.getObjectByName('RearLabel').material.map=labelTexture;
    scene.add(model);setView();
  } catch(error){dispose();throw error;}
  return {setMode,setView,setLook,setFrame,clear(){ctx.fillStyle='#e1e3dc';ctx.fillRect(0,0,540,960);texture.needsUpdate=true;render();},zoom,dispose,screenBounds,screenPoint,release,
    setHook(visible){model.getObjectByName('BottomHook').visible=!!visible;render();},
    rotateDevice(){release();rotation=(rotation+1)%4;model.rotation.z=rotation*Math.PI/2;model.updateMatrixWorld(true);setView();},
    setLanguage(lang){canvas.setAttribute('aria-label',lang==='zh-CN'?'PaperS3 固件模拟器。点击屏幕操作，拖动外壳旋转，双指缩放。':'PaperS3 firmware simulator. Touch the screen, drag the case to rotate, pinch to zoom.');},
  };
}

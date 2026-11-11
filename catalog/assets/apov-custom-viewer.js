import {Scene,Color,CanvasTexture,RepeatWrapping,PerspectiveCamera,WebGLRenderer,HemisphereLight,DirectionalLight,PMREMGenerator,Box3,Vector3,Spherical,ACESFilmicToneMapping,OrbitControls,GLTFLoader,RoomEnvironment} from '../product/prototype/vendor/three-runtime.js';
import {addPaperMonoHardware} from './paper-mono-hardware.js';

export async function createViewer(container,{kind,url,onState=()=>{}}){
 const paper=kind==='paper-mono-v2',cad=['mindreset-read-pico','metalio-eink4-plus-47'].includes(kind),game=kind==='prototype-game',layered=cad||game,scene=new Scene();scene.background=new Color('#edf0f2');
 const camera=new PerspectiveCamera(32,1,.01,2),renderer=new WebGLRenderer({antialias:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=ACESFilmicToneMapping;renderer.toneMappingExposure=1;
 renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('role','img');container.append(renderer.domElement);
 const room=new RoomEnvironment(),pmrem=new PMREMGenerator(renderer),env=pmrem.fromScene(room,.04);scene.environment=env.texture;scene.environmentIntensity=.7;room.dispose();pmrem.dispose();
 scene.add(new HemisphereLight(0xffffff,0xc4c8cc,.5));const light=new DirectionalLight(0xffffff,.3);light.position.set(-1,2,3);scene.add(light);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enablePan=false;controls.minDistance=.16;controls.maxDistance=.7;controls.rotateSpeed=.7;controls.autoRotateSpeed=.8;
 renderer.domElement.style.touchAction='pan-y';
 let root,disposed=false,frame=0,last=0,rotating=false,visible=false;
 let labelMaterial,originalLabelMap,customLabelMap;
 let look=layered?{caseColor:game?'#229ac4':'#b5babc',frontColor:game?'#424642':'#eaebe5',buttonColor:game?'#60645f':kind==='mindreset-read-pico'?'#aeb4af':'#e07837',backColor:game?'#229ac4':'#e6e8e3',finish:'matte'}:paper?{caseColor:'#b8bdb9',frontColor:'#b8bdb9',backColor:'#17191a',finish:'matte'}:{caseColor:'#873b91',frontColor:'#ededeb',buttonColor:'#41454c',finish:'glossy'};
 if(cad)Object.assign(look,{shellMaterial:'original',touchLeftColor:kind==='mindreset-read-pico'?'#aeb4af':'#e07837',touchCenterColor:'#a3acab',touchRightColor:'#a3acab'});
 const body=new Set(),front=new Set(),buttons=new Set(),back=new Set(),ink=new Set();
 const touchParts={touchLeftColor:new Set(),touchCenterColor:new Set(),touchRightColor:new Set()};
 // Microscopic roughness variation, rather than coarse brushed-metal grooves.
 let grain;
 if(cad){
  const tile=document.createElement('canvas');tile.width=tile.height=128;
  const ctx=tile.getContext('2d'),pixels=ctx.createImageData(128,128);let seed=1729;
  for(let i=0;i<pixels.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=218+(seed%38);pixels.data.set([v,v,v,255],i);}
  ctx.putImageData(pixels,0,0);grain=new CanvasTexture(tile);grain.wrapS=grain.wrapT=RepeatWrapping;
 }
 function render(){if(!disposed)renderer.render(scene,camera);}
 controls.addEventListener('change',render);
 function tick(time){frame=0;if(!rotating||!visible||document.hidden||disposed)return;controls.update(last?Math.min((time-last)/1000,.1):0);last=time;render();frame=requestAnimationFrame(tick);}
 function schedule(){cancelAnimationFrame(frame);last=0;if(rotating&&visible&&!document.hidden&&!disposed)frame=requestAnimationFrame(tick);}
 function setRotate(value){rotating=value;controls.autoRotate=value;onState();schedule();}
 controls.addEventListener('start',()=>setRotate(false));
 const resize=new ResizeObserver(()=>{const {width,height}=container.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();render();});resize.observe(container);
 const observer=new IntersectionObserver(([e])=>{visible=e.isIntersecting;schedule();});observer.observe(container);
 document.addEventListener('visibilitychange',schedule);
 function setView(view=paper?'back':'perspective'){
  const angles={front:[0,0,1],back:[-.5,.18,-1],side:[1,.18,.12],perspective:[.4,.2,1]};
  camera.position.set(...(angles[view]||angles.perspective)).normalize().multiplyScalar(paper?.265:game?.36:.325);controls.target.set(0,0,0);controls.update();render();
 }
 function setLabel(source){
  if(!labelMaterial||!originalLabelMap)return;
  const previous=customLabelMap;
  customLabelMap=source?new CanvasTexture(source):undefined;
  if(customLabelMap){
   // The embedded label artwork is vertically pre-flipped for this mesh's UVs.
   // Uploaded canvases are upright, so compensate without changing the geometry.
   customLabelMap.flipY=!originalLabelMap.flipY;customLabelMap.colorSpace=originalLabelMap.colorSpace;
   customLabelMap.wrapS=originalLabelMap.wrapS;customLabelMap.wrapT=originalLabelMap.wrapT;
   customLabelMap.offset.copy(originalLabelMap.offset);customLabelMap.repeat.copy(originalLabelMap.repeat);customLabelMap.center.copy(originalLabelMap.center);customLabelMap.rotation=originalLabelMap.rotation;
  }
  labelMaterial.map=customLabelMap||originalLabelMap;labelMaterial.needsUpdate=true;previous?.dispose();render();
 }
 function setLook(value){
  look={...look,...value,...(layered?{finish:'matte'}:{})};
  if(game)look.backColor=look.caseColor;
  for(const m of body){m.color.set(look.caseColor);if(!layered){m.metalness=0;m.roughness=look.finish==='matte'?.86:.25;if('clearcoat'in m)m.clearcoat=look.finish==='matte'?0:1;}}
  for(const m of front)m.color.set(look.frontColor);for(const m of buttons)m.color.set(look.buttonColor);for(const m of back)m.color.set(look.backColor);
  if(paper)for(const m of front){m.roughness=look.finish==='matte'?.86:.25;if('clearcoat'in m)m.clearcoat=look.finish==='matte'?0:1;}
  if(cad){
   const plastic=look.shellMaterial==='polycarbonate';
   for(const m of body){const map=plastic?null:grain;if(m.roughnessMap!==map){m.roughnessMap=map;m.needsUpdate=true;}m.metalness=plastic?0:.9;m.roughness=plastic?.58:.48;}
   for(const m of back){m.metalness=0;m.roughness=plastic?.58:kind==='mindreset-read-pico'?.14:.48;}
   for(const [part,materials] of Object.entries(touchParts))for(const m of materials)m.color.set(look[part]);
  }
  if(game){const c=new Color(look.frontColor),light=c.r*.2126+c.g*.7152+c.b*.0722;for(const m of ink)m.color.set(light>.35?'#333333':'#ffffff');}
  const stage=container.closest('.viewer');stage.dataset.shellColor=look.caseColor;stage.dataset.texture=look.finish;if(cad)stage.dataset.material=look.shellMaterial;onState();render();
 }
 const keydown=e=>{
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(e.key))return;e.preventDefault();setRotate(false);
  const s=new Spherical().setFromVector3(camera.position.clone().sub(controls.target));
  if(e.key==='ArrowLeft')s.theta-=.14;if(e.key==='ArrowRight')s.theta+=.14;if(e.key==='ArrowUp')s.phi-=.14;if(e.key==='ArrowDown')s.phi+=.14;
  if(['+','='].includes(e.key))s.radius*=.9;if(e.key==='-')s.radius*=1.1;s.radius=Math.max(controls.minDistance,Math.min(controls.maxDistance,s.radius));s.makeSafe();camera.position.setFromSpherical(s).add(controls.target);controls.update();render();
 };
 renderer.domElement.addEventListener('keydown',keydown);
 function dispose(){disposed=true;cancelAnimationFrame(frame);resize.disconnect();observer.disconnect();document.removeEventListener('visibilitychange',schedule);controls.dispose();env.dispose();grain?.dispose();
  const materials=new Set(),textures=new Set(),geometry=new Set();if(originalLabelMap)textures.add(originalLabelMap);root?.traverse(o=>{if(o.geometry)geometry.add(o.geometry);for(const m of o.material?[].concat(o.material):[]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});materials.forEach(m=>m.dispose());textures.forEach(t=>{t.source?.data?.close?.();t.dispose();});geometry.forEach(g=>g.dispose());renderer.dispose();renderer.domElement.remove();
 }
 try{
  const gltf=await new GLTFLoader().loadAsync(url);root=gltf.scene;scene.add(root);
  if(paper)await addPaperMonoHardware(root);
  root.position.sub(new Box3().setFromObject(root).getCenter(new Vector3()));
  // The source GLB shares the chassis material with its separate front panel.
  // Give that existing panel its own material; the NFC rear cover is already separate.
  if(paper)root.traverse(o=>{if(o.name==='PaperMono_front_cover')o.material=o.material.clone();});
  root.traverse(o=>{for(const m of o.material?[].concat(o.material):[]){
   if(layered){const target={Case:body,Rim:body,Front:front,Buttons:buttons,Back:back,TouchLeft:touchParts.touchLeftColor,TouchCenter:touchParts.touchCenterColor,TouchRight:touchParts.touchRightColor}[m.name];target?.add(m);if(game&&m.name==='Wordmark')ink.add(m);}
   else if(paper){({PaperMono_chassis:body,PaperMono_front_cover:front,PaperMono_black_NFC_panel:back}[o.name])?.add(m);}
   else {if(/polycarbonate/i.test(m.name))body.add(m);if(/^Front plate/.test(m.name))front.add(m);if(/^Side buttons/.test(m.name))buttons.add(m);}
  }});
  if(paper){const label=root.getObjectByName('PaperMono_custom_rear_label');labelMaterial=label?.material;originalLabelMap=labelMaterial?.map;}
  if(!body.size)throw new Error('Missing case material');setLook(look);setView();
 }catch(error){dispose();throw error;}
 return {setLook,setView,setRotate,setLabel,dispose,get look(){return {...look};},get rotating(){return rotating;},
  getLabelImage(){return originalLabelMap?.image;},
  setLanguage(lang){renderer.domElement.setAttribute('aria-label',lang==='zh-CN'?'交互三维模型。拖动或方向键旋转，加减号缩放。':'Interactive 3D model. Drag or use arrow keys to rotate; plus and minus to zoom.');},
  capturePose({direction=[.4,.2,1],distance=paper?.29:.34,background='#edf0f2',target=[0,0,0]}={}){setRotate(false);scene.background.set(background);controls.target.set(...target);camera.position.set(...direction).normalize().multiplyScalar(distance).add(controls.target);controls.update();render();},
  hasCustomLabel(){let found=false;root.traverse(o=>{if(o.name==='PaperMono_custom_rear_label'&&o.material?.map)found=true;});return found;},
 };
}

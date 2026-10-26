import {Scene,Color,PerspectiveCamera,WebGLRenderer,HemisphereLight,DirectionalLight,PMREMGenerator,Box3,Vector3,Spherical,ACESFilmicToneMapping,OrbitControls,GLTFLoader,RoomEnvironment} from '../product/prototype/vendor/three-runtime.js';

export async function createViewer(container,{kind,url,onState=()=>{}}){
 const paper=kind==='paper-mono-v2',scene=new Scene();scene.background=new Color('#edf0f2');
 const camera=new PerspectiveCamera(32,1,.01,2),renderer=new WebGLRenderer({antialias:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=ACESFilmicToneMapping;renderer.toneMappingExposure=1;
 renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('role','img');container.append(renderer.domElement);
 const room=new RoomEnvironment(),pmrem=new PMREMGenerator(renderer),env=pmrem.fromScene(room,.04);scene.environment=env.texture;scene.environmentIntensity=.7;room.dispose();pmrem.dispose();
 scene.add(new HemisphereLight(0xffffff,0xc4c8cc,.5));const light=new DirectionalLight(0xffffff,.3);light.position.set(-1,2,3);scene.add(light);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enablePan=false;controls.minDistance=.16;controls.maxDistance=.7;controls.rotateSpeed=.7;controls.autoRotateSpeed=.8;
 renderer.domElement.style.touchAction='pan-y';
 let root,disposed=false,frame=0,last=0,rotating=false,visible=false;
 let look=paper?{caseColor:'#b8bdb9',finish:'matte'}:{caseColor:'#873b91',frontColor:'#ededeb',buttonColor:'#41454c',finish:'glossy'};
 const body=new Set(),front=new Set(),buttons=new Set();
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
  camera.position.set(...(angles[view]||angles.perspective)).normalize().multiplyScalar(paper?.265:.325);controls.target.set(0,0,0);controls.update();render();
 }
 function setLook(value){
  look={...look,...value};
  for(const m of body){m.color.set(look.caseColor);m.metalness=0;m.roughness=look.finish==='matte'?.86:.25;if('clearcoat'in m)m.clearcoat=look.finish==='matte'?0:1;}
  for(const m of front)m.color.set(look.frontColor);for(const m of buttons)m.color.set(look.buttonColor);
  const stage=container.closest('.viewer');stage.dataset.shellColor=look.caseColor;stage.dataset.texture=look.finish;onState();render();
 }
 const keydown=e=>{
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(e.key))return;e.preventDefault();setRotate(false);
  const s=new Spherical().setFromVector3(camera.position.clone().sub(controls.target));
  if(e.key==='ArrowLeft')s.theta-=.14;if(e.key==='ArrowRight')s.theta+=.14;if(e.key==='ArrowUp')s.phi-=.14;if(e.key==='ArrowDown')s.phi+=.14;
  if(['+','='].includes(e.key))s.radius*=.9;if(e.key==='-')s.radius*=1.1;s.radius=Math.max(controls.minDistance,Math.min(controls.maxDistance,s.radius));s.makeSafe();camera.position.setFromSpherical(s).add(controls.target);controls.update();render();
 };
 renderer.domElement.addEventListener('keydown',keydown);
 function dispose(){disposed=true;cancelAnimationFrame(frame);resize.disconnect();observer.disconnect();document.removeEventListener('visibilitychange',schedule);controls.dispose();env.dispose();
  const materials=new Set(),textures=new Set(),geometry=new Set();root?.traverse(o=>{if(o.geometry)geometry.add(o.geometry);for(const m of o.material?[].concat(o.material):[]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});materials.forEach(m=>m.dispose());textures.forEach(t=>{t.source?.data?.close?.();t.dispose();});geometry.forEach(g=>g.dispose());renderer.dispose();renderer.domElement.remove();
 }
 try{
  const gltf=await new GLTFLoader().loadAsync(url);root=gltf.scene;scene.add(root);
  root.position.sub(new Box3().setFromObject(root).getCenter(new Vector3()));
  root.traverse(o=>{for(const m of o.material?[].concat(o.material):[]){
   if(paper){if(/^PaperMono_(chassis|front_cover)$/.test(o.name))body.add(m);}
   else {if(/polycarbonate/i.test(m.name))body.add(m);if(/^Front plate/.test(m.name))front.add(m);if(/^Side buttons/.test(m.name))buttons.add(m);}
  }});
  if(!body.size)throw new Error('Missing case material');setLook(look);setView();
 }catch(error){dispose();throw error;}
 return {setLook,setView,setRotate,dispose,get look(){return {...look};},get rotating(){return rotating;},
  setLanguage(lang){renderer.domElement.setAttribute('aria-label',lang==='zh-CN'?'交互三维模型。拖动或方向键旋转，加减号缩放。':'Interactive 3D model. Drag or use arrow keys to rotate; plus and minus to zoom.');},
  capturePose({direction=[.4,.2,1],distance=paper?.29:.34,background='#edf0f2'}={}){setRotate(false);scene.background.set(background);camera.position.set(...direction).normalize().multiplyScalar(distance);controls.target.set(0,0,0);controls.update();render();},
  hasCustomLabel(){let found=false;root.traverse(o=>{if(o.name==='PaperMono_custom_rear_label'&&o.material?.map)found=true;});return found;},
 };
}

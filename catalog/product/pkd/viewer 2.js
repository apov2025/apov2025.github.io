import {
 Scene,Color,PerspectiveCamera,WebGLRenderer,HemisphereLight,DirectionalLight,
 PMREMGenerator,Vector3,Spherical,ACESFilmicToneMapping,OrbitControls,GLTFLoader,RoomEnvironment,
} from '../prototype/vendor/three-runtime.js';

const palettes={
 silver:{body:'#b9bdc0',keys:'#c1c5c9',pad:'#b1b6b8',legend:'#3939b4'},
 graphite:{body:'#454a49',keys:'#21302e',pad:'#282d2d',legend:'#79e6dc'},
 copper:{body:'#bc7748',keys:'#23302f',pad:'#29302f',legend:'#79e6dc'},
};
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export async function createViewer(container,{onState=()=>{}}={}) {
 const stage=container.closest('.viewer'),scene=new Scene();scene.background=new Color('#edf0f2');
 const camera=new PerspectiveCamera(32,1,.01,3);
 const renderer=new WebGLRenderer({antialias:true,alpha:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=ACESFilmicToneMapping;
 renderer.toneMappingExposure=1;renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('role','img');
 container.append(renderer.domElement);
 const env=new RoomEnvironment(),pmrem=new PMREMGenerator(renderer),map=pmrem.fromScene(env,.04);
 scene.environment=map.texture;scene.environmentIntensity=.65;env.dispose();pmrem.dispose();
 scene.add(new HemisphereLight(0xffffff,0xbec5cc,.5));
 const light=new DirectionalLight(0xffffff,.5);light.position.set(-1,2,3);scene.add(light);
 const controls=new OrbitControls(camera,renderer.domElement);
 controls.enablePan=false;controls.minDistance=.25;controls.maxDistance=.85;controls.rotateSpeed=.65;
 renderer.domElement.style.touchAction='pan-y';
 let root,paper,keyboard,shell,disposed=false,frame=0,last=0,time=1.35,visible=false;
 let playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;
 let look={caseColor:'#353c41',keyboard:'silver',finish:'glossy'};
 const render=()=>{if(!disposed)renderer.render(scene,camera);};
 const emit=()=>{stage.dataset.playing=String(playing);onState({playing,...look});};
 function resize(){const {width,height}=container.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();render();}
 const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(container);
 function setView(view='perspective'){
  const views={perspective:[1.2,.34,1],front:[0,0,1],back:[-.3,.12,-1],side:[1,.15,.18]};
  camera.position.set(...(views[view]||views.perspective)).normalize().multiplyScalar(.41);
  controls.target.set(0,0,.012);controls.update();render();
 }
 function seat(group,q,y,z,pivotY,depth,sign){
  const angle=sign*.32*smooth(q/.5),pivot=new Vector3(0,pivotY,depth);
  const rotated=pivot.clone().applyAxisAngle(new Vector3(1,0,0),angle);
  group.rotation.x=angle;group.position.set(0,y+pivot.y-rotated.y,z+pivot.z-rotated.z+32*smooth((q-.25)/.75));
 }
 function pose(p,k){
  if(!paper)return;
  seat(paper,p,34.9,2.5,33.85,7.7,-1);seat(keyboard,k,-34.4,1.2,-34,9,1);
  stage.dataset.assemblyProgress=((p+k)/2).toFixed(3);render();
 }
 function sequence(t){
  t%=11.5;
  const outward=(start)=>smooth((t-start)/1.6);
  const p=t<5.1?outward(2.2):1-smooth((t-5.1)/1.8);
  const k=t<7.2?outward(.8):1-smooth((t-7.2)/1.8);
  pose(p,k);
 }
 function tick(now){
  frame=0;if(!playing||!visible||document.hidden||disposed)return;
  if(last)time+=Math.min((now-last)/1000,.1);last=now;sequence(time);frame=requestAnimationFrame(tick);
 }
 function schedule(){cancelAnimationFrame(frame);last=0;if(playing&&visible&&!document.hidden&&!disposed)frame=requestAnimationFrame(tick);}
 function setPlaying(value){playing=value;emit();schedule();}
 function setAssembly(value){setPlaying(false);time=value?4.4:0;pose(value,value);}
 const visibility=()=>schedule();document.addEventListener('visibilitychange',visibility);
 const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;schedule();});observer.observe(container);
 controls.addEventListener('change',render);
 controls.addEventListener('start',()=>setPlaying(false));
 const keyboardControl=event=>{
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(event.key))return;
  event.preventDefault();setPlaying(false);
  const s=new Spherical().setFromVector3(camera.position.clone().sub(controls.target));
  if(event.key==='ArrowLeft')s.theta-=.14;if(event.key==='ArrowRight')s.theta+=.14;
  if(event.key==='ArrowUp')s.phi-=.14;if(event.key==='ArrowDown')s.phi+=.14;
  if(['+','='].includes(event.key))s.radius*=.9;if(event.key==='-')s.radius*=1.1;
  s.radius=Math.max(controls.minDistance,Math.min(controls.maxDistance,s.radius));s.makeSafe();
  camera.position.setFromSpherical(s).add(controls.target);controls.update();render();
 };
 renderer.domElement.addEventListener('keydown',keyboardControl);
 function dispose(){
  disposed=true;cancelAnimationFrame(frame);observer.disconnect();resizeObserver.disconnect();
  document.removeEventListener('visibilitychange',visibility);controls.dispose();map.dispose();
  const textures=new Set(),materials=new Set(),geometries=new Set();
  root?.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of o.material?[].concat(o.material):[]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});
  textures.forEach(t=>{t.source?.data?.close?.();t.dispose();});materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());renderer.dispose();renderer.domElement.remove();
 }
 function setLook(next){
  look={...look,...next};
  shell.traverse(o=>{if(!o.isMesh||o.userData.fixedFinish)return;for(const m of [].concat(o.material)){m.color.set(look.caseColor);m.roughness=look.finish==='matte'?.86:.25;m.metalness=0;if('clearcoat'in m)m.clearcoat=look.finish==='matte'?0:1;}});
  const p=palettes[look.keyboard];
  keyboard.traverse(o=>{
   if(!o.isMesh)return;const n=o.name.replaceAll('_',' ');let c;
   if(n.endsWith('keycap')||n==='Navigation ring')c=p.keys;
   if(['Keyboard lower shell','Keyboard face'].includes(n))c=p.body;
   if(n==='Touchpad')c=p.pad;if(n.startsWith('Label '))c=p.legend;
   if(c)o.material.color.set(c);
  });
  stage.dataset.shellColor=look.caseColor;stage.dataset.keyboard=look.keyboard;stage.dataset.texture=look.finish;
  emit();render();
 }
 try {
  const gltf=await new GLTFLoader().loadAsync(new URL('./models/pkd.glb',import.meta.url).href);
  root=gltf.scene;scene.add(root);
  root.traverse(o=>{
   if(o.name.startsWith('M5Stack'))paper=o;
   if(o.name.startsWith('M1_Keyboard'))keyboard=o;
   if(o.name.startsWith('pkd_integrated'))shell=o;
  });
  if(!paper||!keyboard||!shell)throw new Error('Missing assembly groups');
  // The optimizer shares identical materials; detach recolorable ones from the fixed PaperS3.
  for(const group of [shell,keyboard])group.traverse(o=>{if(o.material)o.material=o.material.clone();});
  setView();resize();setLook(look);sequence(time);emit();schedule();
 }catch(error){dispose();throw error;}
 return {
  setView,setAssembly,setPlaying,setLook,dispose,
  setLanguage(language){renderer.domElement.setAttribute('aria-label',language==='zh-CN'?'pkd 三维模型。拖动或使用方向键旋转，加减号缩放。':'Interactive pkd model. Drag or use arrow keys to rotate; plus and minus to zoom.');},
  get playing(){return playing;},get look(){return {...look};},
  paperColors(){const colors=[];paper.traverse(o=>{if(o.material?.color)colors.push(o.material.color.getHexString());});return colors;},
  capturePose({direction=[1.2,.34,1],distance=.41,explosion=0,background='#edf0f2'}={}){setAssembly(explosion);scene.background=background===null?null:new Color(background);camera.position.set(...direction).normalize().multiplyScalar(distance);controls.target.set(0,0,.012);controls.update();render();return renderer.domElement.toDataURL('image/png');},
 };
}

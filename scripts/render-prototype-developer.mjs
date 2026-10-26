// Derive the neutral-gray developer concept from the slim production-page model.
// PLAYWRIGHT_MODULE=/.../@playwright/test/index.mjs node scripts/render-prototype-developer.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/Users/Ke/side_projects/obook5_3d_model/node_modules/@playwright/test/index.mjs');
const dependencyRoot = process.env.THREE_ROOT || '/Users/Ke/side_projects/obook5_3d_model/node_modules/three';
const output = resolve('catalog/product/prototype');
const base = process.env.BASE_URL || 'http://127.0.0.1:5176';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
try {
  await page.route('**/__developer-three/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/__developer-three/', '');
    if (path.includes('..')) return route.abort();
    await route.fulfill({ body: await readFile(resolve(dependencyRoot, path)), contentType: 'text/javascript' });
  });
  await page.route('**/__developer-deps/**', async route => route.fulfill({ body: await readFile(resolve(dependencyRoot, '..', new URL(route.request().url()).pathname.replace('/__developer-deps/', ''))), contentType: 'text/javascript' }));
  await page.route('**/__developer-font.json', async route => route.fulfill({body:await readFile('/Users/Ke/side_projects/obook5_3d_model/public/obook5-bold.typeface.json'),contentType:'application/json'}));
  await page.route('**/__developer-case.js', async route => route.fulfill({body:(await readFile('/Users/Ke/side_projects/obook5_3d_model/src/case.js','utf8')).replace('`${import.meta.env.BASE_URL}obook5-bold.typeface.json`', "'/__developer-font.json'"),contentType:'text/javascript'}));
  await page.route('**/__developer-profile.js', async route => route.fulfill({body:await readFile('scripts/prototype-profile.mjs'),contentType:'text/javascript'}));
  await page.route('**/__developer-stage', route => route.fulfill({ body: '<html><head><script type="importmap">{"imports":{"three":"/__developer-three/build/three.module.js","three/addons/":"/__developer-three/examples/jsm/","three-bvh-csg":"/__developer-deps/three-bvh-csg/build/index.module.js","three-mesh-bvh":"/__developer-deps/three-mesh-bvh/build/index.module.js"}}</script></head><body></body></html>', contentType: 'text/html' }));
  await page.goto(`${base}/__developer-stage`);
  const result = await page.evaluate(async () => {
    const T = await import('three');
    const { GLTFLoader } = await import('/__developer-three/examples/jsm/loaders/GLTFLoader.js');
    const { GLTFExporter } = await import('/__developer-three/examples/jsm/exporters/GLTFExporter.js');
    const { RoomEnvironment } = await import('/__developer-three/examples/jsm/environments/RoomEnvironment.js');
    const gltf = await new GLTFLoader().loadAsync('/catalog/product/prototype/models/prototype-teal.glb');
    const root = gltf.scene.children[0];
    // Reuse the exact convex outer contour; old display openings never enter the hull.
    const sourcePosition=root.getObjectByName('Prototype_front_plate').geometry.attributes.position;
    const unique=new Map();for(let i=0;i<sourcePosition.count;i++){const point=[sourcePosition.getX(i),sourcePosition.getY(i)];unique.set(point.join(','),point);}
    const points=[...unique.values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    const half=list=>{const out=[];for(const p of list){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=1e-8)out.pop();out.push(p);}out.pop();return out;};
    const contour=[...half(points),...half([...points].reverse())];
    const removed = [];
    root.traverse(mesh => {
      if (/^(Front_page|Front_function|Front_prototype_wordmark|Prototype_front_plate|25D_glass|Flush_glass)/.test(mesh.name)) removed.push(mesh);
      if (!mesh.isMesh) return;
      mesh.material = mesh.material.clone();
      if (/^(Matte polycarbonate|Brushed aluminum)/.test(mesh.material.name)) { mesh.material.color.set('#555555'); mesh.material.roughness = .65; mesh.material.specularIntensity = .12; }
      if (/^Side buttons/.test(mesh.material.name)) mesh.material.color.set('#555555');
      if (/^Prototype blank/.test(mesh.material.name)) mesh.material.color.set('#555555');
      if (/^Prototype front wordmark/.test(mesh.material.name)) mesh.material.color.set('#787e7c');
      if (/^Connector and speaker/.test(mesh.material.name)) mesh.material.color.set('#444444');
    });
    removed.forEach(mesh => mesh.removeFromParent());
    const newFront = new T.Group(); newFront.name="Developer_front_assembly"; newFront.scale.setScalar(.001); root.add(newFront);
    const shape = new T.Shape(contour.map(p=>new T.Vector2(...p)));shape.closePath();
    // Build the rear from the original parametric case, changing its real CSG cut.
    const {createDebossedCaseGeometry}=await import('/__developer-case.js');
    const {roundPrototypeBack}=await import('/__developer-profile.js');
    const caseMesh=root.getObjectByName('Case_enclosure');
    const cut=await createDebossedCaseGeometry({width:76.0086455331412,height:125,radius:125/694*18,rearShoulderStart:-2.25,text:'developer prototype',textWidth:52,textHeight:5.1});
    const nonindexed=cut.index?cut.toNonIndexed():cut;
    const partitions=[[],[]];const attr=nonindexed.attributes.position;
    for(let i=0;i<attr.count;i+=3){
      const cx=(attr.getX(i)+attr.getX(i+1)+attr.getX(i+2))/3,cy=(attr.getY(i)+attr.getY(i+1)+attr.getY(i+2))/3;
      const cavity=Math.abs(cx)<27&&Math.abs(cy)<3.6&&Math.max(attr.getZ(i),attr.getZ(i+1),attr.getZ(i+2))>-4.145&&Math.max(attr.getZ(i),attr.getZ(i+1),attr.getZ(i+2))<-3.5;
      partitions[cavity?1:0].push(i,i+1,i+2);
    }
    function part(indices){const geo=new T.BufferGeometry();for(const name of ['position','normal','uv']){const source=nonindexed.attributes[name];const array=[];for(const index of indices)for(let j=0;j<source.itemSize;j++)array.push(source.array[index*source.itemSize+j]);geo.setAttribute(name,new T.Float32BufferAttribute(array,source.itemSize));}geo.scale(1,132/125,6.2/8.3);return roundPrototypeBack(geo,{height:132});}
    caseMesh.geometry=part(partitions[0]);caseMesh.material.vertexColors=false;
    caseMesh.userData.rearLettering='developer prototype, actual debossed cavity with light gray fill';
    const whiteDeboss=new T.Mesh(part(partitions[1]),new T.MeshStandardMaterial({name:'Light gray fill in debossed developer prototype',color:'#b8b8b8',roughness:.85,metalness:0}));
    whiteDeboss.name='Developer_rear_white_deboss';whiteDeboss.userData={text:'developer prototype',technique:'Light gray fill on actual CSG-subtracted cavity surfaces',fillHex:'#b8b8b8',depthMm:.31};newFront.add(whiteDeboss);
    const plate = new T.Mesh(new T.ExtrudeGeometry(shape, {depth:.254,bevelEnabled:false,curveSegments:24}),new T.MeshPhysicalMaterial({color:'#555555',roughness:.65,specularIntensity:.12,clearcoat:.05,clearcoatRoughness:.35}));
    plate.position.z=2.76385; plate.name='Developer_uninterrupted_black_front'; newFront.add(plate);
    const lensShape=shape.clone();
    root.traverse(mesh=>{if(!/^Front_speaker_perforation/.test(mesh.name))return;mesh.material=new T.MeshBasicMaterial({name:'Black speaker openings',color:'#030303',toneMapped:false});mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox;const cx=(box.min.x+box.max.x)/2,cy=(box.min.y+box.max.y)/2;const hole=new T.Path();hole.absellipse(cx,cy,(box.max.x-box.min.x)/2,(box.max.y-box.min.y)/2,0,Math.PI*2,true);lensShape.holes.push(hole);});
    const glass = new T.Mesh(new T.ShapeGeometry(lensShape,24),new T.MeshPhysicalMaterial({color:'#ffffff',transmission:1,thickness:.08,roughness:0,ior:1.45,specularIntensity:.025,envMapIntensity:.04}));
    glass.name='Developer_continuous_cover_glass'; glass.position.z=3.1; newFront.add(glass);
    const {FontLoader}=await import('/__developer-three/examples/jsm/loaders/FontLoader.js');
    const messageFont=await new FontLoader().loadAsync('/__developer-font.json');
    const messageGeometry=new T.ShapeGeometry(messageFont.generateShapes('develop your own',10));
    messageGeometry.computeBoundingBox();const messageBox=messageGeometry.boundingBox;const messageSize=messageBox.getSize(new T.Vector3());
    messageGeometry.translate(-(messageBox.min.x+messageBox.max.x)/2,-(messageBox.min.y+messageBox.max.y)/2,0);
    const messageScale=Math.min(40/messageSize.x,3.3/messageSize.y);messageGeometry.scale(messageScale,messageScale,1);
    const screenMessage=new T.Mesh(messageGeometry,new T.MeshBasicMaterial({name:'Reflected light-gray e-ink lettering',color:'#b8b8b8',toneMapped:false}));
    screenMessage.name='Developer_screen_message';screenMessage.position.set(-4.1426516,2.8530273,3.055);screenMessage.userData={text:'develop your own',appearance:'Light gray reflected e-ink, no emissive material',alignment:'Centered within display'};newFront.add(screenMessage);
    const fillPosition=whiteDeboss.geometry.attributes.position;const recessDepths=[];
    for(let i=0;i<fillPosition.count;i++){const x=fillPosition.getX(i),y=fillPosition.getY(i);const radial=1-(1-(x/(76.0086455331412/2))**2)*(1-(y/66)**2);recessDepths.push(fillPosition.getZ(i)-(-3.1+1.05*radial));}
    const recessRange=[Math.min(...recessDepths),Math.max(...recessDepths)];
    if(recessRange[0]<-.005||recessRange[1]<.12)throw Error('Rear lettering is not recessed beneath the case surface');
    whiteDeboss.userData.measuredDepthRangeMm=recessRange;
    const layouts={};
    for(const id of ['side','bottom','custom']){const group=new T.Group();group.name='Developer_LED_'+id;group.userData={layout:id,defaultVisible:false};newFront.add(group);layouts[id]=group;}
    const dotGeometry = new T.CircleGeometry(.16,10);
    const dotMaterial = new T.MeshBasicMaterial({color:'#eeeeee',toneMapped:false});
    function dots(id,cx,cy,rows) { rows.forEach((row,j)=>[...row].forEach((on,i)=>{if(on!=='1')return;const dot=new T.Mesh(dotGeometry,dotMaterial);dot.position.set(cx+(i-(row.length-1)/2)*.66,cy-(j-(rows.length-1)/2)*.66,3.075);layouts[id].add(dot);})); }
    // A consistent seven-dot grid: paired open chevrons and a custom-action diamond.
    const up = ['0001000','0010100','0100010','1000001','0000000','0000000','0000000'];
    const down = [...up].reverse();
    const custom = ['0001000','0010100','0100010','1001001','0100010','0010100','0001000'];
    dots('side',30.5,26,up);
    dots('side',30.5,2,down);
    // Three distinct custom actions: four-point spark, orbit, and a faceted diamond.
    dots('custom',30.5,26,['0001000','0001000','0011100','1111111','0011100','0001000','0001000']);
    dots('custom',30.5,2,['0011100','0100010','1000001','1001001','1000001','0100010','0011100']);
    dots('custom',30.5,-22,custom);
    layouts.side.userData.controls = ['previous-page','next-page'];
    layouts.custom.userData.controls = ['spark','orbit','diamond'];
    // Equal spacing about the actual display center, within its left/right bounds.
    const screenBounds = root.getObjectByName('E-ink_screen').geometry;
    screenBounds.computeBoundingBox();
    const screenCenterX = (screenBounds.boundingBox.min.x + screenBounds.boundingBox.max.x) / 2;
    const screenWidth = screenBounds.boundingBox.max.x - screenBounds.boundingBox.min.x;
    dots('bottom',screenCenterX-screenWidth/4,-58,['0001000','0010000','0100000','1000000','0100000','0010000','0001000']);
    dots('bottom',screenCenterX+screenWidth/4,-58,['0001000','0000100','0000010','0000001','0000010','0000100','0001000']);
    layouts.bottom.userData.alignment = 'Two equally spaced controls centered beneath the display';
    const allDots=Object.values(layouts).flatMap(group=>group.children);
    function layout(id){for(const [key,group] of Object.entries(layouts))group.visible=id===key;}
    Object.assign(root.userData,{name:'prototype developer edition',finish:'neutral dark gray matched to e-ink black',frontControls:'Zero physical front keys; programmable capacitive zones on right and full bottom strip',indicator:'White under-glass dot-matrix LEDs; illustrated layouts are programmable concepts',defaultLEDLayout:null,ledLayouts:Object.keys(layouts)});
    const forbidden=[];root.traverse(o=>{if(/Front_(page|function)/.test(o.name))forbidden.push(o.name);});
    if(forbidden.length)throw Error(`Front hardware remains: ${forbidden}`);
    const encode=bytes=>{let str='';for(let i=0;i<bytes.length;i+=16384)str+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(str);};
    const outputs={};

    const scene=new T.Scene();scene.background=new T.Color('#000000');
    const renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setClearColor(0x000000,0);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
    const pmrem=new T.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;scene.environmentIntensity=.8;
    scene.add(new T.HemisphereLight(0xffffff,0x808080,.75));const key=new T.DirectionalLight(0xffffff,1.2);key.position.set(-1,1,3);scene.add(key);
    scene.add(gltf.scene);gltf.scene.updateMatrixWorld(true);
    const bounds=new T.Box3().setFromObject(gltf.scene); const center=bounds.getCenter(new T.Vector3());
    const camera=new T.OrthographicCamera(-.042,.042,.07,-.07,.001,2);camera.position.set(0,0,.32);camera.lookAt(0,0,0);renderer.setSize(900,1500,false);
    layout(null);
    const pixel=(xMm,yMm)=>{const data=new Uint8Array(4);renderer.getContext().readPixels(Math.round(450+xMm*900/84),Math.round(750+yMm*1500/140),1,1,renderer.getContext().RGBA,renderer.getContext().UNSIGNED_BYTE,data);return Array.from(data).slice(0,3);};
    const mean=rgb=>rgb.reduce((a,b)=>a+b,0)/3;
    renderer.render(scene,camera);const targetInk=pixel(0,20);
    function matchMaterial(material,samplePoint){let low=0,high=255,best={error:Infinity};for(let step=0;step<9;step++){const gray=Math.round((low+high)/2);const hex='#'+gray.toString(16).padStart(2,'0').repeat(3);material.color.set(hex);renderer.render(scene,camera);const rendered=pixel(...samplePoint);const error=Math.abs(mean(rendered)-mean(targetInk));if(error<best.error)best={hex,rendered,error};if(mean(rendered)<mean(targetInk))low=gray+1;else high=gray-1;}material.color.set(best.hex);return best;}
    const frontMatch=matchMaterial(plate.material,[30.5,0]);
    camera.position.set(0,0,-.32);camera.lookAt(0,0,0);const rearMatch=matchMaterial(caseMesh.material,[0,20]);
    root.traverse(mesh=>{if(mesh.isMesh&&/^Side buttons/.test(mesh.material.name))mesh.material.color.set(rearMatch.hex);});
    camera.position.set(0,0,.32);camera.lookAt(0,0,0);renderer.render(scene,camera);
    // Match the front-facing shoulder separately: it receives the key light,
    // while the rear receives only the neutral studio environment.
    const shellPosition=caseMesh.geometry.attributes.position;
    const shellColors=new T.Float32BufferAttribute(new Float32Array(shellPosition.count*3),3);
    caseMesh.geometry.setAttribute('color',shellColors);caseMesh.material.vertexColors=true;caseMesh.material.needsUpdate=true;
    function shadeRim(gray){const frontLinear=new T.Color('#'+gray.toString(16).padStart(2,'0').repeat(3)).r;const ratio=frontLinear/caseMesh.material.color.r;for(let i=0;i<shellPosition.count;i++){const t=T.MathUtils.smoothstep(shellPosition.getZ(i),-.8,1.7);const value=1+(ratio-1)*t;shellColors.setXYZ(i,value,value,value);}shellColors.needsUpdate=true;}
    let rimLow=0,rimHigh=255,rimMatch={error:Infinity};
    for(let step=0;step<9;step++){const gray=Math.round((rimLow+rimHigh)/2);shadeRim(gray);renderer.render(scene,camera);const rendered=pixel(37.7,0);const error=Math.abs(mean(rendered)-mean(targetInk));if(error<rimMatch.error)rimMatch={gray,rendered,error};if(mean(rendered)<mean(targetInk))rimLow=gray+1;else rimHigh=gray-1;}
    shadeRim(rimMatch.gray);renderer.render(scene,camera);
    const grayCalibration={frontRimBaseHex:'#'+rimMatch.gray.toString(16).padStart(2,'0').repeat(3),frontRimRenderedRGB:pixel(37.7,0),inkHex:'#555555',inkRenderedRGB:pixel(0,20),frontBaseHex:frontMatch.hex,frontRenderedRGB:pixel(30.5,0),rearBaseHex:rearMatch.hex,rearRenderedRGB:rearMatch.rendered};
    if(frontMatch.error>10||rearMatch.error>10||rimMatch.error>10)throw Error('Gray material matching exceeds tolerance');
    Object.assign(root.userData,{plasticCustomColor:rearMatch.hex,frontCustomColor:frontMatch.hex,buttonCustomColor:rearMatch.hex,grayCalibration});
    root.traverse(node=>{if('plasticCustomColor' in node.userData)Object.assign(node.userData,{name:'prototype developer edition',finish:'neutral dark gray matched to e-ink black',plasticCustomColor:rearMatch.hex,frontCustomColor:frontMatch.hex,buttonCustomColor:rearMatch.hex,grayCalibration});});
    Object.values(layouts).forEach(group=>group.visible=true);
    outputs['models/prototype-developer.glb']=encode(new Uint8Array(await new GLTFExporter().parseAsync(gltf.scene,{binary:true})));
    layout(null);renderer.render(scene,camera);outputs['media/developer-front.webp']=renderer.domElement.toDataURL('image/webp',.98).split(',')[1];outputs['media/developer-front-clean.webp']=outputs['media/developer-front.webp'];
    const defaultCamera=new T.PerspectiveCamera(30,1,.01,2);defaultCamera.position.set(0,0,.34);defaultCamera.lookAt(0,0,0);renderer.setSize(1500,1500,false);renderer.render(scene,defaultCamera);outputs['media/developer-default.webp']=renderer.domElement.toDataURL('image/webp',.98).split(',')[1];
    const angle=new T.PerspectiveCamera(30,1,.01,2);angle.position.set(.11,.065,.31);angle.lookAt(0,0,0);renderer.setSize(1500,1500,false);renderer.render(scene,angle);outputs['media/developer-angle.webp']=renderer.domElement.toDataURL('image/webp',.98).split(',')[1];
    for(const id of Object.keys(layouts)){layout(id);renderer.render(scene,angle);outputs[`media/developer-layout-${id}.webp`]=renderer.domElement.toDataURL('image/webp',.98).split(',')[1];}
    layout(null);angle.position.set(-.11,.065,-.31);angle.lookAt(0,0,0);renderer.render(scene,angle);outputs['media/developer-back.webp']=renderer.domElement.toDataURL('image/webp',.98).split(',')[1];
    const dimensions=bounds.getSize(new T.Vector3()).multiplyScalar(1000).toArray();
    if (Math.abs(dimensions[0]-76.0086)>.05 || dimensions[1]>133 || dimensions[2]>6.25) throw Error(`Unexpected developer envelope ${dimensions}`);
    if (Math.abs(Math.max(...contour.filter(p=>Math.abs(p[1]-65.2343979)<.01).map(p=>p[0]))-34.76934)>.005) throw Error('Incorrect front corner contour '+JSON.stringify(contour.filter(p=>Math.abs(p[1]-65.2343979)<.01)));
    if (shape.holes.length) throw Error("Developer front must be uninterrupted");
    for (const dot of allDots) { const {x,y,z}=dot.position; if (!(z<3.1 && ((x>=25&&x<=36&&y>=-64&&y<=56)||(x>=-36&&x<=36&&y>=-64&&y<=-52)))) throw Error("LED outside the programmable touch strips"); }
    if (allDots.some(dot=>dot.position.x>25&&dot.position.y<-42)) throw Error('LED overlaps speaker grille');
    return {outputs,metadata:{grayCalibration,screenMessage:screenMessage.userData,removed:removed.map(o=>o.name),remainingFrontKeys:forbidden,dimensionsIncludingPowerAndUSBmm:dimensions,ledLayouts:Object.fromEntries(Object.entries(layouts).map(([id,group])=>[id,group.children.length])),defaultLEDLayout:null,frontContour:contour,rearText:whiteDeboss.userData,speakerCount:40,frontProjection:{image:[900,1500],worldMm:[84,140],originPx:[450,750],pixelsPerMm:900/84},touchAreasMm:{right:{x:[25,36],y:[-42,56]},bottom:{x:[-36,24],y:[-64,-52]}}}};
  });
  await mkdir(resolve(output,'media'),{recursive:true});
  for(const [path,bytes]of Object.entries(result.outputs))await writeFile(resolve(output,path),Buffer.from(bytes,'base64'));
  await writeFile(resolve(output,'models/prototype-developer.json'),JSON.stringify(result.metadata,null,2)+'\n');
  console.log(JSON.stringify({...result.metadata,frontContour:`${result.metadata.frontContour.length} exact source contour vertices`},null,2));
} finally {await browser.close();}

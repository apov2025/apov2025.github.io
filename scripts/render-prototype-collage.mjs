// Regenerate the slim catalog concept and its imagery from the supplied source GLBs.
// Usage: PLAYWRIGHT_MODULE=/path/to/@playwright/test/index.mjs node scripts/render-prototype-collage.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const base = process.env.BASE_URL || 'http://127.0.0.1:5176';
const source = process.env.PROTOTYPE_SOURCE || '/Users/Ke/side_projects/obook5_3d_model/exports/prototype';
const output = resolve('catalog/product/prototype');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
try {
  await page.route('**/__prototype-source/*', async route => {
    const filename = new URL(route.request().url()).pathname.split('/').pop();
    if (!/^prototype-(graphite|silver|teal)\.glb$/.test(filename)) return route.abort();
    await route.fulfill({ body: await readFile(resolve(source, filename)), contentType: 'model/gltf-binary' });
  });
  await page.route('**/__prototype-profile.mjs', async route => route.fulfill({ body: await readFile(resolve('scripts/prototype-profile.mjs')), contentType: 'text/javascript' }));
  await page.goto(`${base}/catalog/product/prototype/`);
  const result = await page.evaluate(async () => {
    const T = await import('/catalog/product/prototype/vendor/three-runtime.js');
    const { roundPrototypeBack } = await import('/__prototype-profile.mjs');
    const outputs = {};
    const encode = bytes => {
      let binary = '';
      for (let i = 0; i < bytes.length; i += 16384) binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
      return btoa(binary);
    };
    let model;
    const measurements = [];
    for (const finish of ['silver', 'teal', 'graphite']) {
      const gltf = await new T.GLTFLoader().loadAsync(`/__prototype-source/prototype-${finish}.glb`);
      const root = gltf.scene.children[0];
      const ratio = 6.2 / 8.3;
      const jackParts = [];
      root.traverse(mesh => { if (/headphone.jack/i.test(mesh.name)) jackParts.push(mesh); });
      jackParts.forEach(mesh => mesh.removeFromParent());
      root.traverse(mesh => {
        if (!mesh.isMesh) return;
        // Source meshes are direct children in millimeters. Bake local transforms,
        // then compress depth; USB-C retains its actual connector dimensions.
        if (mesh.parent !== root) throw new Error('Unexpected nested source mesh');
        mesh.updateMatrix();
        mesh.geometry = mesh.geometry.clone().applyMatrix4(mesh.matrix);
        if (!/^USB-C/.test(mesh.name)) mesh.geometry.scale(1, 1, ratio);
        if (/^USB-C/.test(mesh.name)) mesh.geometry.translate(0, -3.5, 0);
        else if (/^Top.power/.test(mesh.name)) mesh.geometry.translate(0, 3.5, 0);
        else mesh.geometry.scale(1, 132 / 125, 1);
        if (/^Case.enclosure/.test(mesh.name)) mesh.geometry = T.mergeVertices(roundPrototypeBack(mesh.geometry, { height: 132 }), .00001);
        mesh.position.set(0, 0, 0);
        mesh.quaternion.identity();
        mesh.scale.set(1, 1, 1);
        mesh.updateMatrix();
        if (mesh.material.transmission) {
          mesh.material.thickness *= ratio;
          mesh.material.specularIntensity = .02;
          mesh.material.roughness = 0;
          mesh.material.envMapIntensity = .05;
        }
        if (/^(Front plate|Coated glass perimeter)/.test(mesh.material.name)) {
          mesh.material.roughness = .65;
          mesh.material.clearcoat = .05;
        }
        if (finish === 'teal') {
          if (/^Matte polycarbonate/.test(mesh.material.name)) mesh.material.color.set('#87b6ad');
          if (/^(Front plate|Coated glass perimeter)/.test(mesh.material.name)) mesh.material.color.set('#e0e5d7');
          if (/^Side buttons/.test(mesh.material.name)) mesh.material.color.set('#b86643');
        }
      });
      root.userData.dimensionsMm.depth = 6.2;
      root.userData.dimensionsMm.height = 132;
      root.userData.rearProfile = 'Broad crowned back, tapered shoulders, maximum 6.2 mm center thickness';
      if (finish === 'teal') Object.assign(root.userData, { plasticColor: 'custom', frontColor: 'custom', buttonColor: 'custom', plasticCustomColor: '#87b6ad', frontCustomColor: '#e0e5d7', buttonCustomColor: '#b86643' });
      root.userData.detailAccuracy = 'Catalog concept revision: 6.2 mm body, no headphone jack; USB-C geometry retained. Not manufacturing CAD.';
      root.updateMatrixWorld(true);
      let body, usb;
      const envelope = new T.Box3();
      root.traverse(mesh => {
        if (/^(Case.enclosure|Prototype.front.plate|Flush.glass.lens|2.5D.glass.perimeter)/.test(mesh.name)) envelope.union(new T.Box3().setFromObject(mesh));
        if (/^USB-C.metal.surround/.test(mesh.name)) usb = new T.Box3().setFromObject(mesh).getSize(new T.Vector3()).z * 1000;
        if (/headphone.jack/i.test(mesh.name)) throw new Error('Headphone jack remains');
      });
      body = envelope.getSize(new T.Vector3()).z * 1000;
      if (Math.abs(body - 6.2) > .03 || Math.abs(usb - 3.45) > .03) throw new Error(`Unexpected dimensions: body ${body}, USB ${usb}`);
      measurements.push({ finish, bodyDepthMm: body, usbHeightMm: usb });
      outputs[`models/prototype-${finish}.glb`] = encode(new Uint8Array(await new T.GLTFExporter().parseAsync(gltf.scene, { binary: true })));
      if (finish === 'graphite') model = gltf.scene;
    }
    const scene = new T.Scene();
    scene.background = new T.Color('#ffffff');
    const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    const pmrem = new T.PMREMGenerator(renderer);
    const room = new T.RoomEnvironment();
    const environment = pmrem.fromScene(room, .04);
    scene.environment = environment.texture;
    scene.environmentIntensity = .6;
    scene.add(new T.HemisphereLight(0xffffff, 0xc4c8cc, .35));
    const key = new T.DirectionalLight(0xffffff, .15);
    key.position.set(-1, 2, 3);
    scene.add(key);
    const center = new T.Box3().setFromObject(model).getCenter(new T.Vector3());
    model.position.sub(center);
    scene.add(model);
    const camera = new T.PerspectiveCamera(32, 4 / 3, .025, 2);
    function colors(body, front, buttons) {
      model.traverse(mesh => {
        for (const material of mesh.material ? [].concat(mesh.material) : []) {
          if (/^(Matte polycarbonate|Brushed aluminum)/.test(material.name)) material.color.set(body);
          if (/^(Front plate|Coated glass perimeter)/.test(material.name)) material.color.set(front);
          if (/^Side buttons/.test(material.name)) material.color.set(buttons);
        }
      });
    }
    function pose(position) { camera.position.set(...position); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix(); }
    const palette = [
      ['#e7ded0','#e7ded0','#c26642'], ['#54716a','#293f3a','#e5ba70'], ['#d86e53','#793e38','#f1cb81'], ['#8c9eb4','#d5dce2','#324c73'], ['#d9b75b','#e5d4a1','#6c503e'], ['#665879','#b4a8c8','#edc395'],
      ['#66889b','#324b60','#e1b071'], ['#b76c6d','#dfb9ae','#723e46'], ['#b5bb9d','#e0e0ca','#5e6c50'], ['#3d4e78','#3d4e78','#eb8d4f'], ['#cf784c','#e6c8a3','#784a37'], ['#abc7c2','#426f70','#dc8a4f'],
      ['#696564','#323537','#c7b8a4'], ['#e2c5ab','#eee4d6','#8e5b49'], ['#8d9874','#4c5c45','#e8c990'], ['#b4a0c0','#cbbdd4','#6c537c'], ['#b45e42','#b45e42','#eadfba'], ['#bdc3c6','#dee0df','#47565d'],
      ['#7eada8','#bad5ca','#d77650'], ['#dac172','#dac172','#715b45'], ['#626f89','#303c59','#c49879'], ['#caa29d','#e5ccc4','#835653'], ['#9e6953','#583e33','#e4be8a'], ['#c6c8b7','#596456','#e1ba71'],
    ];
    const views = ['front','side','back','front','back','side','back','front','side','back','side','front','front','back','side','front','side','back','side','front','back','side','back','front'];
    const positions = { front: [0,0,.32], back: [0,0,-.32], side: [.32,0,0] };
    // Render each view at its own full viewport. Transmission materials sample
    // a screen-space buffer, which would otherwise leak across scissored tiles.
    const collage = document.createElement('canvas');
    collage.width = 2880; collage.height = 1440;
    const context = collage.getContext('2d');
    renderer.setSize(480, 360, false);
    for (let index = 0; index < palette.length; index++) {
      const x = index % 6 * 480, y = Math.floor(index / 6) * 360;
      colors(...palette[index]);
      pose(positions[views[index]]);
      renderer.render(scene, camera);
      context.drawImage(renderer.domElement, x, y);
    }
    outputs['media/colorway-collage.webp'] = collage.toDataURL('image/webp', .96).split(',')[1];
    for (let index = 0; index < palette.length; index++) {
      const id = String(index + 1).padStart(2, '0');
      colors(...palette[index]);
      camera.aspect = 4 / 3;
      renderer.setSize(800, 600, false);
      pose(positions[views[index]]);
      renderer.render(scene, camera);
      outputs[`media/colorways/${id}-thumb.webp`] = renderer.domElement.toDataURL('image/webp', .96).split(',')[1];
      camera.aspect = 3 / 4;
      renderer.setSize(1800, 2400, false);
      pose(positions[views[index]]);
      renderer.render(scene, camera);
      outputs[`media/colorways/${id}.webp`] = renderer.domElement.toDataURL('image/webp', .98).split(',')[1];
    }
    renderer.setSize(1200, 1000, false);
    renderer.setViewport(0, 0, 1200, 1000);
    camera.aspect = 1.2;
    scene.background.set('#edf0f2');
    colors('#70716e','#454545','#606060');
    for (const [name, position] of Object.entries({ perspective: [.16,.075,.32], top: [0,.29,.09], ports: [0,-.29,.09], back: [0,0,-.32], 'rear-perspective': [-.16,.075,-.32], front: [0,0,.32], 'glass-detail': [-.15,.17,.17] })) {
      if (name === 'top') colors('#3d4e78', '#d5dce2', '#e9a85b');
      else if (name === 'ports') colors('#9ca985', '#34463c', '#ddba72');
      else colors('#70716e','#454545','#606060');
      pose(position);
      renderer.render(scene, camera);
      outputs[`media/${name}.png`] = renderer.domElement.toDataURL('image/png').split(',')[1];
    }
    colors('#87b6ad','#e0e5d7','#b86643');
    for (const [name, position] of Object.entries({ 'viewer-side': [.30,.075,.17], 'sea-glass-back': [-.15,.04,-.25], 'sea-glass-front': [.1,.06,.29] })) {
      pose(position);
      renderer.render(scene, camera);
      outputs[`media/${name}.webp`] = renderer.domElement.toDataURL('image/webp', .94).split(',')[1];
    }
    for (const [name, palette, position] of [
      ['design-front-reference', ['#bf765f','#e8ddc8','#6c4147'], [.1,.06,.29]],
      ['design-back-reference', ['#a899b7','#e3dce8','#67527e'], [-.15,.04,-.25]],
    ]) {
      colors(...palette);
      pose(position);
      renderer.render(scene, camera);
      outputs[`media/${name}.png`] = renderer.domElement.toDataURL('image/png').split(',')[1];
    }
    return { outputs, measurements, palette, views };
  });
  await mkdir(resolve(output, 'media/colorways'), { recursive: true });
  for (const [name, data] of Object.entries(result.outputs)) await writeFile(resolve(output, name), Buffer.from(data, 'base64'));
  for (const finish of ['graphite','silver','teal']) {
    const config = JSON.parse(await readFile(resolve(source, `prototype-${finish}.json`), 'utf8'));
    config.dimensionsMm.depth = 6.2;
    config.dimensionsMm.height = 132;
    config.rearProfile = 'Broad crowned back with tapered shoulders';
    if (finish === 'teal') Object.assign(config.appearance, { caseColor: '#87b6ad', frontColor: '#e0e5d7', buttonColor: '#b86643' });
    config.designRevision = 'Slim catalog concept; headphone jack removed; USB-C dimensions retained.';
    await writeFile(resolve(output, `models/prototype-${finish}.json`), JSON.stringify(config, null, 2) + '\n');
  }
  await writeFile(resolve(output, 'media/colorway-collage.json'), JSON.stringify({ rows: 4, columns: 6, colors: result.palette, views: result.views, bodyDepthMm: 6.2, bodyHeightMm: 132, fullImageSize: [1800, 2400] }, null, 2) + '\n');
  console.log(JSON.stringify(result.measurements));
  console.log('Saved slim GLBs, 24-colorway collage, refreshed model renders, and configurations.');
} finally { await browser.close(); }

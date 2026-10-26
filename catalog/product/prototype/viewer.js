import { drawStreetPattern } from './street-pattern.js';
import {
  Scene, Color, CanvasTexture, SRGBColorSpace, PerspectiveCamera, WebGLRenderer, HemisphereLight, DirectionalLight,
  PMREMGenerator, Box3, Vector3, Spherical, ACESFilmicToneMapping,
  OrbitControls, GLTFLoader, GLTFExporter, RoomEnvironment,
} from './vendor/three-runtime.js';

// On-demand rendering keeps the static product page idle when the model is still.
export function createViewer(container, { onLayout = () => {} } = {}) {
  const scene = new Scene();
  scene.background = new Color('#edf0f2');
  const camera = new PerspectiveCamera(32, 1, .025, 2);
  const renderer = new WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'Interactive prototype 3D model. Drag or use arrow keys to rotate; plus and minus to zoom.');
  container.append(renderer.domElement);
  const environment = new RoomEnvironment();
  const pmrem = new PMREMGenerator(renderer);
  const environmentMap = pmrem.fromScene(environment, .04);
  scene.environment = environmentMap.texture;
  scene.environmentIntensity = .6;
  environment.dispose();
  pmrem.dispose();
  scene.add(new HemisphereLight(0xffffff, 0xc4c8cc, .35));
  const light = new DirectionalLight(0xffffff, .15);
  light.position.set(-1, 2, 3);
  scene.add(light);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.minDistance = .15;
  controls.maxDistance = .7;
  controls.zoomSpeed = .7;
  controls.rotateSpeed = .7;
  // Let touch users scroll the page vertically; horizontal drags rotate.
  renderer.domElement.style.touchAction = 'pan-y';
  let model, patternTexture;
  let experience = false, transitioning = false, transitionFrame = 0, savedCamera;
  let autoRotate = false, frame = 0, previousTime = 0, exportingImage = false;
  controls.autoRotateSpeed = .8;
  function animate(time) {
    frame = 0;
    if (!autoRotate || experience || transitioning || document.hidden || exportingImage) return;
    controls.update(previousTime ? Math.min((time - previousTime) / 1000, .1) : 0);
    previousTime = time;
    frame = requestAnimationFrame(animate);
  }
  function scheduleRotation() {
    cancelAnimationFrame(frame);
    frame = 0; previousTime = 0;
    if (autoRotate && !experience && !transitioning && !document.hidden && !exportingImage) frame = requestAnimationFrame(animate);
  }
  document.addEventListener('visibilitychange', scheduleRotation);
  function projectedRect(name) {
    const object = model?.getObjectByName(name);
    if (!object) return null;
    const box = new Box3().setFromObject(object);
    const top = new Vector3(box.min.x, box.max.y, box.max.z).project(camera);
    const bottom = new Vector3(box.max.x, box.min.y, box.max.z).project(camera);
    const { width, height } = container.getBoundingClientRect();
    return { left: (top.x + 1) * width / 2, top: (1 - top.y) * height / 2, width: (bottom.x - top.x) * width / 2, height: (top.y - bottom.y) * height / 2 };
  }
  function fitDistance() {
    const size = new Box3().setFromObject(model).getSize(new Vector3());
    const tangent = Math.tan(camera.fov * Math.PI / 360);
    return Math.max(size.y / (.84 * 2 * tangent), size.x / (.88 * 2 * tangent * camera.aspect));
  }
  const render = () => {
    renderer.render(scene, camera);
    if (experience && model && !transitioning) {
      const rocker = projectedRect('Front_page_rocker');
      const screen = projectedRect('E-ink_screen');
      if (screen && rocker) onLayout({ screen, power: projectedRect('Top_power_key'), menu: projectedRect('Front_function_key'), prev: { ...rocker, height: rocker.height / 2 }, next: { ...rocker, top: rocker.top + rocker.height / 2, height: rocker.height / 2 } });
    }
  };
  controls.addEventListener('change', render);
  const resize = new ResizeObserver(() => {
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (experience && model && !transitioning) { camera.position.set(0, 0, fitDistance()); controls.update(); }
    render();
  });
  resize.observe(container);
  const positions = { reset: [.30, .075, .17], perspective: [.16, .075, .32], front: [0, 0, .36], back: [0, 0, -.36], side: [.29, 0, 0] };
  function setView(name) {
    camera.position.set(...(positions[name] || positions.perspective));
    controls.target.set(0, 0, 0);
    controls.update();
    render();
  }
  setView('reset');
  renderer.domElement.addEventListener('keydown', event => {
    if (experience || transitioning) return;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_'].includes(event.key)) return;
    event.preventDefault();
    const spherical = new Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    if (event.key === 'ArrowLeft') spherical.theta -= .14;
    if (event.key === 'ArrowRight') spherical.theta += .14;
    if (event.key === 'ArrowUp') spherical.phi -= .14;
    if (event.key === 'ArrowDown') spherical.phi += .14;
    if (['+', '='].includes(event.key)) spherical.radius *= .9;
    if (['-', '_'].includes(event.key)) spherical.radius *= 1.1;
    spherical.radius = Math.max(controls.minDistance, Math.min(controls.maxDistance, spherical.radius));
    spherical.makeSafe();
    camera.position.setFromSpherical(spherical).add(controls.target);
    controls.update();
    render();
  });
  function disposeModel(root) {
    const geometries = new Set(), materials = new Set(), textures = new Set();
    root?.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      for (const material of object.material ? [].concat(object.material) : []) {
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      }
    });
    geometries.forEach(value => value.dispose());
    materials.forEach(value => value.dispose());
    textures.forEach(value => { value.source?.data?.close?.(); value.dispose(); });
  }
  const colorMaterials = part => {
    const matches = new Set();
    model?.traverse(object => {
      for (const material of object.material ? [].concat(object.material) : []) {
        if ((part === 'case' && /^(Matte polycarbonate|Brushed aluminum)/.test(material.name)) ||
            (part === 'front' && /^(Front plate|Coated glass perimeter)/.test(material.name)) ||
            (part === 'buttons' && /^Side buttons/.test(material.name))) matches.add(material);
      }
    });
    return [...matches];
  };
  function clearPattern() {
    if (!patternTexture) return;
    for (const material of colorMaterials('front')) {
      material.map = null;
      material.needsUpdate = true;
    }
    patternTexture.dispose();
    patternTexture = undefined;
  }
  return {
    async setExperience(value) {
      if (!model || value === experience || transitioning) return;
      if (value) savedCamera = camera.position.clone();
      const from = new Spherical().setFromVector3(camera.position);
      from.theta = Math.atan2(Math.sin(from.theta), Math.cos(from.theta));
      experience = value; transitioning = true;
      controls.enabled = false; controls.autoRotate = false;
      renderer.domElement.tabIndex = value ? -1 : 0;
      renderer.domElement.setAttribute('aria-hidden', String(value));
      scheduleRotation();
      const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 550;
      const start = performance.now();
      await new Promise(resolve => {
        const step = time => {
          const target = value ? new Spherical(fitDistance(), Math.PI / 2, 0) : new Spherical().setFromVector3(savedCamera);
          const thetaDelta = Math.atan2(Math.sin(target.theta - from.theta), Math.cos(target.theta - from.theta));
          const linear = duration ? Math.min(1, (time - start) / duration) : 1;
          const t = linear * linear * (3 - 2 * linear);
          camera.position.setFromSpherical(new Spherical(from.radius + (target.radius - from.radius) * t, from.phi + (target.phi - from.phi) * t, from.theta + thetaDelta * t));
          controls.update(); render();
          if (linear < 1) transitionFrame = requestAnimationFrame(step); else resolve();
        };
        transitionFrame = requestAnimationFrame(step);
      });
      transitioning = false;
      controls.enabled = !value;
      controls.autoRotate = autoRotate && !value;
      render(); scheduleRotation();
    },
    clearPattern,
    setStreetPattern(data, color) {
      clearPattern();
      patternTexture = new CanvasTexture(drawStreetPattern(data, color));
      patternTexture.colorSpace = SRGBColorSpace;
      patternTexture.repeat.set(1 / 7.465864658, 1 / 12.354999542);
      patternTexture.offset.set(.5, .5);
      // Normalize the source plate UV range without changing the rim or display.
      model.traverse(object => {
        if (!object.material || !/^Front plate/.test(object.material.name)) return;
        object.material.map = patternTexture;
        object.material.color.set('#ffffff');
        object.material.needsUpdate = true;
      });
      render();
    },
    setAutoRotate(value) {
      autoRotate = Boolean(value);
      controls.autoRotate = autoRotate && !experience && !transitioning;
      scheduleRotation();
    },
    async exportPNG() {
      exportingImage = true;
      scheduleRotation();
      const oldPixelRatio = renderer.getPixelRatio();
      const enabled = controls.enabled;
      controls.enabled = false;
      try {
        const { width, height } = container.getBoundingClientRect();
        const longEdge = Math.min(7680, renderer.capabilities.maxTextureSize, Math.sqrt(32000000 * Math.max(width, height) / Math.min(width, height)));
        const scale = longEdge / Math.max(width, height);
        renderer.setPixelRatio(1);
        renderer.setSize(Math.round(width * scale), Math.round(height * scale), false);
        render();
        const output = document.createElement('canvas');
        output.width = renderer.domElement.width; output.height = renderer.domElement.height;
        const context = output.getContext('2d');
        context.drawImage(renderer.domElement, 0, 0);
        if (patternTexture) {
          context.font = '18px sans-serif'; context.fillStyle = '#646b70';
          context.fillText('© OpenStreetMap contributors · ODbL', 24, output.height - 24);
        }
        return await new Promise((resolve, reject) => output.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG export failed')), 'image/png'));
      } finally {
        const { width, height } = container.getBoundingClientRect();
        renderer.setPixelRatio(oldPixelRatio);
        renderer.setSize(width, height, false);
        controls.enabled = enabled;
        exportingImage = false;
        render();
        scheduleRotation();
      }
    },
    getColors() {
      return Object.fromEntries(['case', 'front', 'buttons'].map(part => [part, '#' + colorMaterials(part)[0].color.getHexString()]));
    },
    setColor(part, color) {
      if (!/^#[0-9a-f]{6}$/i.test(color)) return;
      colorMaterials(part).forEach(material => material.color.set(color));
      render();
    },
    setTexture(texture) {
      const metal = texture === 'metal';
      const glossy = texture === 'glossy';
      for (const material of colorMaterials('case')) {
        material.metalness = metal ? 1 : 0;
        material.roughness = metal ? .38 : glossy ? .22 : .86;
        material.clearcoat = glossy ? 1 : 0;
        material.clearcoatRoughness = .12;
        material.anisotropy = metal ? .12 : 0;
        material.needsUpdate = true;
      }
      render();
    },
    async exportGLB() {
      const data = await new GLTFExporter().parseAsync(model, { binary: true, onlyVisible: true });
      return new Blob([data], { type: 'model/gltf-binary' });
    },
    focus() { renderer.domElement.focus({ preventScroll: true }); },
    setLanguage(language) {
      renderer.domElement.setAttribute('aria-label', language === 'zh-CN'
        ? '交互式 prototype 3D 模型。拖动或使用方向键旋转，加减键缩放。'
        : 'Interactive prototype 3D model. Drag or use arrow keys to rotate; plus and minus to zoom.');
    },
    async load(url) {
      const gltf = await new GLTFLoader().loadAsync(url);
      clearPattern();
      const next = gltf.scene;
      next.traverse(object => {
        for (const material of object.material ? [].concat(object.material) : []) if (material.transmission) { material.envMapIntensity = .05; material.roughness = 0; }
      });
      const center = new Box3().setFromObject(next).getCenter(new Vector3());
      next.position.sub(center);
      if (model) { scene.remove(model); disposeModel(model); }
      model = next;
      scene.add(model);
      render();
    },
    setView,
    dispose() {
      autoRotate = false;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(transitionFrame);
      document.removeEventListener('visibilitychange', scheduleRotation);
      clearPattern();
      resize.disconnect();
      controls.dispose();
      disposeModel(model);
      environmentMap.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

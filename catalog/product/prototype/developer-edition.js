// A separate, deliberately minimal 3D viewer for the developer edition.
// No product customization or operating-system demo is attached to this model.
export async function initDeveloperEdition(root, { language = document.documentElement.lang || 'en' } = {}) {
  if (!root || root.dataset.developerInitialized) return;
  root.dataset.developerInitialized = 'true';
  root.classList.add('developer-viewer');
  const poster = document.createElement('img');
  poster.className = 'developer-viewer__poster';
  poster.src = new URL('./media/developer-default.webp?v=developer-5', import.meta.url).href;
  poster.alt = 'Neutral dark gray prototype developer edition with a clean glass front, programmable touch strips and a speaker grille.';
  poster.width = 1500;
  poster.height = 1500;
  root.append(poster);
  let canvas, status;
  let selectedLayout = null;
  let resetCamera = () => {};
  function resetView() { resetCamera(); }
  let applyLayout = () => {};
  function setLayout(id) {
    selectedLayout = ['side', 'bottom', 'custom'].includes(id) ? id : null;
    root.dataset.developerLayout = selectedLayout || 'off';
    applyLayout();
  }
  setLayout(null);
  const copy = {
    en: { poster: 'Neutral dark gray prototype developer edition with a clean glass front, programmable touch strips and a speaker grille.', canvas: 'Interactive prototype developer edition. Drag or use arrow keys to rotate; scroll, pinch, or use plus and minus to zoom.', fallback: '3D preview unavailable. Product image shown.' },
    zh: { poster: '深灰 prototype 开发者版本，配备完整玻璃面板、可编程触控区域和扬声器网孔。', canvas: 'prototype 开发者版本 交互式 3D 模型。拖动或使用方向键旋转；滚动、双指缩放或使用加减键缩放。', fallback: '3D 预览暂不可用，当前显示产品图片。' },
  };
  function setLanguage(value) {
    language = String(value).startsWith('zh') ? 'zh' : 'en';
    poster.alt = copy[language].poster;
    canvas?.setAttribute('aria-label', copy[language].canvas);
    if (status) status.textContent = copy[language].fallback;
  }
  setLanguage(language);
  let disposed = false;
  let cleanup = () => {};
  async function start() {
    try {
      const T = await import('./vendor/three-runtime.js');
      if (disposed) return;
      const scene = new T.Scene();
      const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      renderer.domElement.className = 'developer-viewer__canvas';
      renderer.domElement.tabIndex = 0;
      renderer.domElement.setAttribute('role', 'img');
      canvas = renderer.domElement;
      setLanguage(language);
      root.append(renderer.domElement);
      const camera = new T.PerspectiveCamera(30, 1, .01, 2);
      const room = new T.RoomEnvironment();
      const pmrem = new T.PMREMGenerator(renderer);
      const environment = pmrem.fromScene(room, .04);
      scene.environment = environment.texture;
      scene.environmentIntensity = .8;
      room.dispose(); pmrem.dispose();
      scene.add(new T.HemisphereLight(0xffffff, 0x808080, .75));
      const key = new T.DirectionalLight(0xffffff, 1.2);
      key.position.set(-1, 1, 3); scene.add(key);
      const controls = new T.OrbitControls(camera, renderer.domElement);
      controls.enablePan = false;
      controls.minDistance = .19;
      controls.maxDistance = .6;
      controls.zoomSpeed = .65;
      controls.rotateSpeed = .65;
      renderer.domElement.style.touchAction = 'pan-y';
      camera.position.set(0, 0, .34);
      controls.update();
      const render = () => { if (!disposed) renderer.render(scene, camera); };
      controls.addEventListener('change', render);
      const resize = new ResizeObserver(() => {
        const { width, height } = root.getBoundingClientRect();
        if (!width || !height) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        render();
      });
      resize.observe(root);
      const onKey = event => {
        if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','_'].includes(event.key)) return;
        event.preventDefault();
        const orbit = new T.Spherical().setFromVector3(camera.position.clone());
        if (event.key === 'ArrowLeft') orbit.theta -= .14;
        if (event.key === 'ArrowRight') orbit.theta += .14;
        if (event.key === 'ArrowUp') orbit.phi -= .14;
        if (event.key === 'ArrowDown') orbit.phi += .14;
        if (['+','='].includes(event.key)) orbit.radius *= .9;
        if (['-','_'].includes(event.key)) orbit.radius *= 1.1;
        orbit.radius = Math.max(controls.minDistance, Math.min(controls.maxDistance, orbit.radius));
        orbit.makeSafe(); camera.position.setFromSpherical(orbit); controls.update(); render();
      };
      renderer.domElement.addEventListener('keydown', onKey);
      const release = model => {
        const geometries = new Set(), materials = new Set();
        model?.traverse(object => {
          if (object.geometry) geometries.add(object.geometry);
          for (const material of object.material ? [].concat(object.material) : []) materials.add(material);
        });
        geometries.forEach(item => item.dispose());
        materials.forEach(item => item.dispose());
      };
      let model;
      resetCamera = () => {
        controls.target.set(0, 0, 0);
        camera.position.set(0, 0, .34);
        controls.update(); render();
      };
      cleanup = () => {
        resetCamera = () => {};
        resize.disconnect(); controls.dispose(); environment.dispose();
        renderer.domElement.removeEventListener('keydown', onKey);
        release(model); renderer.dispose(); renderer.domElement.remove();
      };
      const gltf = await new T.GLTFLoader().loadAsync(new URL('./models/prototype-developer.glb?v=developer-5', import.meta.url).href);
      if (disposed) { release(gltf.scene); return; }
      model = gltf.scene;
      applyLayout = () => {
        for (const id of ['side', 'bottom', 'custom']) {
          const group = model.getObjectByName('Developer_LED_' + id);
          if (group) group.visible = selectedLayout === id;
        }
        render();
      };
      applyLayout();
      scene.add(model); render();
      root.classList.add('developer-viewer--ready');
    } catch (error) {
      cleanup();
      if (!disposed) {
        root.classList.add('developer-viewer--fallback');
        status = document.createElement('p');
        status.className = 'developer-viewer__status';
        status.setAttribute('role', 'status');
        root.append(status);
        setLanguage(language);
        console.warn('Developer edition 3D preview unavailable; displaying product image.', error);
      }
    }
  }
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); start(); }
  }, { rootMargin: '300px' });
  observer.observe(root);
  return { setLanguage, setLayout, resetView, dispose() { disposed = true; observer.disconnect(); cleanup(); applyLayout = () => {}; poster.remove(); status?.remove(); root.classList.remove('developer-viewer--ready', 'developer-viewer--fallback'); delete root.dataset.developerInitialized; } };
}

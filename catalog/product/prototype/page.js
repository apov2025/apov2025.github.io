import { generateHarmoniousLook } from './color-harmony.js';
import { createReader } from './reader.js?v=reader-4';
const translations = [...document.querySelectorAll('[data-zh]')].map(element => ({ element, en: element.innerHTML, zh: element.dataset.zh }));
let viewer, reader;
let systemMode = false, changingMode = false;
const attributeTranslations = [...document.querySelectorAll('[data-alt-zh], [data-aria-zh]')].flatMap(element => ['alt', 'aria'].filter(key => element.dataset[key + 'Zh']).map(key => ({ element, attribute: key === 'alt' ? 'alt' : 'aria-label', en: element.getAttribute(key === 'alt' ? 'alt' : 'aria-label'), zh: element.dataset[key + 'Zh'] })));
let language = 'en';
try { if (localStorage.getItem('catalog-language') === 'zh-CN') language = 'zh-CN'; } catch {}
let status = { en: 'Loading 3D model…', zh: '正在加载 3D 模型…' };
const statusElement = document.querySelector('#viewer-status');
function renderLanguage() {
  document.documentElement.lang = language;
  for (const item of translations) item.element.innerHTML = language === 'en' ? item.en : item.zh;
  for (const button of document.querySelectorAll('[data-language]')) button.setAttribute('aria-pressed', String(button.dataset.language === language));
  for (const item of attributeTranslations) item.element.setAttribute(item.attribute, language === 'en' ? item.en : item.zh);
  viewer?.setLanguage(language);
  reader?.setLanguage(language);
  statusElement.textContent = status[language === 'en' ? 'en' : 'zh'];
}
function setStatus(en, zh) {
  status = { en, zh };
  statusElement.textContent = status[language === 'en' ? 'en' : 'zh'];
}
for (const button of document.querySelectorAll('[data-language]')) button.addEventListener('click', () => {
  language = button.dataset.language;
  try { localStorage.setItem('catalog-language', language); } catch {}
  renderLanguage();
});
renderLanguage();

reader = createReader(document.querySelector('#reading-demo'), language);
const appearanceMode = document.querySelector('#appearance-mode');
const experienceMode = document.querySelector('#experience-mode');
const stage = document.querySelector('#viewer');
const loadButton = document.querySelector('#load-model');
const poster = document.querySelector('#viewer-poster');
const textureButtons = [...document.querySelectorAll('[data-texture]')];
const colorInputs = [...document.querySelectorAll('[data-color-part]')];
const randomButton = document.querySelector('#random-colorway');
const saveButton = document.querySelector('#save-image');
const rotateButton = document.querySelector('#auto-rotate');
const patternCredit = document.querySelector('#pattern-credit');
let randomStreak = 0;
let streetsPromise;
function clearSurprise(resetCount = true) {
  viewer?.clearPattern();
  if (stage.dataset.rareTexture) viewer?.setColor('front', document.querySelector('#color-front').value);
  delete stage.dataset.rareTexture;
  patternCredit.hidden = true;
  if (resetCount) randomStreak = 0;
  stage.dataset.randomStreak = String(randomStreak);
}
const designOwn = document.querySelector('#design-own');
designOwn.addEventListener('click', () => {
  const panel = document.querySelector('#customization-panel');
  panel.hidden = !panel.hidden;
  designOwn.setAttribute('aria-expanded', String(!panel.hidden));
});
rotateButton.addEventListener('click', () => {
  const enabled = rotateButton.getAttribute('aria-pressed') !== 'true';
  viewer?.setAutoRotate(enabled);
  rotateButton.setAttribute('aria-pressed', String(enabled));
});
saveButton.addEventListener('click', async () => {
  if (!viewer || busy) return;
  setBusy(true);
  try {
    const blob = await viewer.exportPNG();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'prototype.png';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch { setStatus('Could not save the image. Try again.', '图片保存失败，请重试。'); }
  finally { setBusy(false); saveButton.focus({ preventScroll: true }); }
});
let selectedFinish = 'teal';
let selectedTexture = 'matte';
function updateTextureControls() {
  stage.dataset.viewerTexture = selectedTexture;
  textureButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.texture === selectedTexture)));
}
let busy = false;
function setBusy(value) {
  busy = value;
  experienceMode.disabled = value || changingMode || stage.dataset.viewerState !== 'ready';
  appearanceMode.disabled = changingMode;
  loadButton.disabled = value;
  randomButton.disabled = value;
  saveButton.disabled = value || stage.dataset.viewerState !== 'ready';
  rotateButton.disabled = value || stage.dataset.viewerState !== 'ready';
  textureButtons.forEach(button => { button.disabled = value || stage.dataset.viewerState !== 'ready'; });
  colorInputs.forEach(input => { input.disabled = value || stage.dataset.viewerState !== 'ready'; });
}
async function loadModel(finish = selectedFinish, texture = selectedTexture) {
  if (busy) return;
  const trigger = document.activeElement;
  const selectedColors = Object.fromEntries(colorInputs.map(input => [input.dataset.colorPart, input.value]));
  setBusy(true);
  stage.dataset.viewerState = 'loading';
  loadButton.hidden = true;
  setStatus('Loading 3D model…', '正在加载 3D 模型…');
  try {
    if (!viewer) {
      const { createViewer } = await import('./viewer.js?v=reader-2');
      viewer = createViewer(document.querySelector('#model-canvas'), { onLayout: layout => reader.layout(layout) });
    }
    await viewer.load(new URL(`./models/prototype-${finish}.glb?v=profile-5`, import.meta.url).href);
    selectedFinish = finish;
    selectedTexture = texture;
    viewer.setTexture(texture);
    for (const [part, color] of Object.entries(selectedColors)) viewer.setColor(part, color);
    stage.dataset.customColors ||= 'false';
    const colors = viewer.getColors();
    colorInputs.forEach(input => { input.value = colors[input.dataset.colorPart]; });
    viewer.setLanguage(language);
    stage.dataset.viewerState = 'ready';
    stage.dataset.viewerFinish = finish;
    poster.hidden = true;
    loadButton.hidden = true;

    viewer.setAutoRotate(rotateButton.getAttribute('aria-pressed') === 'true');
    setStatus('', '');
  } catch {
    stage.dataset.viewerState = 'error';
    poster.hidden = false;
    loadButton.hidden = false;
    viewer?.dispose();
    viewer = undefined;
    setStatus('3D could not load. Try again, or explore the model renders below.', '3D 加载失败。请重试，或查看下方模型效果图。');
  } finally {
    updateTextureControls();
    setBusy(false);
    if (trigger === loadButton && stage.dataset.viewerState === 'ready') viewer.focus();
    else if (trigger?.matches('[data-texture], #load-model, #random-colorway')) trigger.focus({ preventScroll: true });
  }
}
loadButton.addEventListener('click', () => loadModel());
async function setTexture(texture) {
  if (busy || !viewer || stage.dataset.viewerState !== 'ready') return;
  const finish = texture === 'metal' ? 'silver' : 'teal';
  if (finish !== selectedFinish) await loadModel(finish, texture);
  else {
    viewer.setTexture(texture);
    selectedTexture = texture;
    updateTextureControls();
  }
}
for (const button of textureButtons) button.addEventListener('click', async () => {
  clearSurprise();
  await setTexture(button.dataset.texture);
  if (stage.dataset.viewerState === 'ready') setStatus('', '');
});

for (const input of colorInputs) input.addEventListener('input', () => {
  if (!viewer || busy) return;
  clearSurprise();
  viewer.setColor(input.dataset.colorPart, input.value);
  stage.dataset.customColors = 'true';
  setStatus('', '');
});
randomButton.addEventListener('click', async () => {
  if (busy) return;
  if (!viewer) await loadModel();
  if (stage.dataset.viewerState !== 'ready') return;
  clearSurprise(false);
  const look = generateHarmoniousLook({ previousCaseColor: viewer.getColors().case });
  const colors = { case: look.caseColor, front: look.frontColor, buttons: look.buttonColor };
  for (const input of colorInputs) {
    input.value = colors[input.dataset.colorPart];
    viewer.setColor(input.dataset.colorPart, input.value);
  }
  await setTexture(look.finish === 'aluminum' ? 'metal' : look.finish);
  if (stage.dataset.viewerState !== 'ready') return;
  stage.dataset.customColors = 'true';
  randomStreak++;
  stage.dataset.randomStreak = String(randomStreak);
  setStatus('', '');
  if (randomStreak % 20 === 0) {
    setBusy(true);
    try {
      streetsPromise ||= fetch(new URL('./media/hidden-streets.json', import.meta.url)).then(response => {
        if (!response.ok) throw new Error('Pattern unavailable');
        return response.json();
      });
      viewer.setStreetPattern(await streetsPromise, document.querySelector('#color-front').value);
      stage.dataset.rareTexture = 'streets';
      patternCredit.hidden = false;
      setStatus('A rare find.', '发现隐藏款。');
    } catch {
      streetsPromise = undefined;
      randomStreak--;
      stage.dataset.randomStreak = String(randomStreak);
      setStatus('Something special is waiting. Try randomizing again.', '有一份惊喜待解锁，再随机一次试试。');
    } finally { setBusy(false); randomButton.focus({ preventScroll: true }); }
  }
});

const collage = document.querySelector('.hero-collage');
const colorwayPreview = document.querySelector('#colorway-preview');
const colorwayImage = document.querySelector('#colorway-preview-image');
let returnTile;
let activeColorway;
function closeColorway() {
  if (colorwayPreview.hidden) return;
  colorwayPreview.hidden = true;
  collage.classList.remove('is-expanded');
  activeColorway = undefined;
  returnTile?.setAttribute('aria-expanded', 'false');
  returnTile?.focus({ preventScroll: true });
}
for (const tile of document.querySelectorAll('.colorway-tile')) tile.addEventListener('click', event => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  returnTile = tile;
  activeColorway = tile.dataset.colorway;
  const requestedColorway = activeColorway;
  colorwayImage.src = tile.querySelector('img').src;
  colorwayImage.alt = tile.getAttribute('aria-label');
  const fullImage = new Image();
  fullImage.onload = () => {
    if (!colorwayPreview.hidden && activeColorway === requestedColorway) colorwayImage.src = fullImage.src;
  };
  fullImage.src = tile.href;
  tile.setAttribute('aria-expanded', 'true');
  colorwayPreview.hidden = false;
  collage.classList.add('is-expanded');
  colorwayPreview.focus({ preventScroll: true });
});
colorwayPreview.addEventListener('click', closeColorway);
collage.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !colorwayPreview.hidden) {
    event.preventDefault();
    closeColorway();
  }
});

async function changeMode(next) {
  if (!viewer || busy || changingMode || systemMode === next) return;
  changingMode = true;
  appearanceMode.disabled = true; experienceMode.disabled = true;
  reader.setActive(false);
  stage.dataset.mode = next ? 'system' : 'appearance';
  document.querySelector('#explore').dataset.mode = stage.dataset.mode;
  try {
    await viewer.setExperience(next);
    systemMode = next;
    reader.setActive(next);
    appearanceMode.setAttribute('aria-pressed', String(!next));
    experienceMode.setAttribute('aria-pressed', String(next));
  } finally {
    changingMode = false;
    setBusy(false);
    (next ? experienceMode : appearanceMode).focus({ preventScroll: true });
  }
}
appearanceMode.addEventListener('click', () => changeMode(false));
experienceMode.addEventListener('click', () => changeMode(true));

// Begin loading immediately; the poster stays visible until the model is ready.
loadModel();

// Pre-order links navigate to the shared concept-product notice.

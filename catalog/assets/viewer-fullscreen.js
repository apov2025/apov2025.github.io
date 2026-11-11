// Move the live viewer and its original controls together; keep model state and listeners.
export function initViewerFullscreen(stage = document.querySelector('#viewer'), controlSelector = '.game-colorways, .customization-actions, #customization-panel') {
  if (!stage) return;
  if (!document.querySelector('link[data-viewer-fullscreen]')) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = new URL('./viewer-fullscreen.css', import.meta.url).href;
    style.dataset.viewerFullscreen = '';
    document.head.append(style);
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'viewer-fullscreen-toggle';
  button.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg><span></span>';
  button.setAttribute('aria-haspopup', 'dialog');
  stage.append(button);

  const dialog = document.createElement('dialog');
  dialog.className = 'viewer-fullscreen-dialog';
  const frame = document.createElement('div');
  frame.className = 'viewer-fullscreen-frame';
  const settings = document.createElement('div');
  settings.className = 'viewer-fullscreen-settings';
  const hint = document.createElement('p');
  hint.className = 'viewer-fullscreen-hint';
  settings.append(hint);
  frame.append(settings);
  dialog.append(frame);
  stage.parentElement.append(dialog);

  let active = false, native = false, pending = false, markers = [], savedPanelHidden;
  let scrollX = 0, scrollY = 0, bodyStyles;
  const panel = document.querySelector('#customization-panel');
  const design = document.querySelector('#design-own');
  const lockProperties = ['position', 'top', 'left', 'width', 'overflow'];
  function translate() {
    const zh = document.documentElement.lang.startsWith('zh');
    const label = zh ? (active ? '退出全屏' : '全屏') : (active ? 'Exit full screen' : 'Full screen');
    button.querySelector('span').textContent = label;
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-expanded', String(active));
    const firmware=stage.dataset.interactionMode === 'firmware';
    dialog.setAttribute('aria-label', firmware ? (zh ? '全屏固件模拟' : 'Full screen firmware simulator') : (zh ? '全屏交互模型' : 'Full screen interactive model'));
    hint.textContent = stage.dataset.screenOrbit === 'true'
      ? (zh ? '屏幕内操作 · 屏幕外拖动旋转 · 双指或滚轮缩放' : 'Touch the screen · Drag outside to rotate · Pinch or scroll to zoom')
      : stage.dataset.fixedOrientation === 'true'
      ? (zh ? '点击屏幕操作 · 使用 + / − 缩放 · 转动设备切换方向' : 'Touch the screen · Use + / − to zoom · Rotate to change orientation')
      : stage.dataset.interactionMode === 'firmware'
      ? (zh ? '点击屏幕操作 · 可旋转屏幕方向' : 'Touch the screen · Rotate to change orientation')
      : (zh ? '单指拖动旋转 · 双指缩放' : 'Drag to rotate · Pinch to zoom');
  }
  new MutationObserver(translate).observe(document.documentElement, {attributes:true, attributeFilter:['lang']});
  new MutationObserver(translate).observe(stage, {attributes:true, attributeFilter:['data-interaction-mode']});
  translate();

  function restore() {
    if (!active) return;
    active = false;
    native = false;
    for (const {node, marker} of markers) marker.replaceWith(node);
    markers = [];
    stage.classList.remove('viewer-fullscreen-stage');
    if (panel) {
      panel.hidden = savedPanelHidden;
      design?.setAttribute('aria-expanded', String(!savedPanelHidden));
    }
    dialog.close();
    for (const [property, value, priority] of bodyStyles) {
      if (value) document.body.style.setProperty(property, value, priority);
      else document.body.style.removeProperty(property);
    }
    window.scrollTo({left:scrollX, top:scrollY, behavior:'instant'});
    translate();
    button.focus({preventScroll:true});
  }
  async function exit() {
    if (pending) return;
    if (document.fullscreenElement === frame) {
      try { await document.exitFullscreen(); } catch { return; }
    }
    restore();
  }
  async function enter() {
    if (active || pending) return;
    active = true;
    scrollX = window.scrollX;
    scrollY = window.scrollY;
    bodyStyles = lockProperties.map(p => [p, document.body.style.getPropertyValue(p), document.body.style.getPropertyPriority(p)]);
    Object.assign(document.body.style, {position:'fixed', top:`-${scrollY}px`, left:`-${scrollX}px`, width:'100%', overflow:'hidden'});
    const controls = [...document.querySelectorAll(controlSelector)];
    for (const node of [stage, ...controls]) {
      const marker = document.createComment('fullscreen return position');
      node.before(marker);
      markers.push({node, marker});
      if (node === stage) frame.prepend(node);
      else settings.append(node);
    }
    stage.classList.add('viewer-fullscreen-stage');
    if (panel) {
      savedPanelHidden = panel.hidden;
      panel.hidden = false;
      design?.setAttribute('aria-expanded', 'true');
    }
    translate();
    dialog.showModal();
    button.focus({preventScroll:true});
    // A dialog itself cannot request native fullscreen. Its inner frame can.
    // Keep the modal viewport fallback when the browser rejects/omits this API.
    if (frame.requestFullscreen) {
      pending = true;
      try { await frame.requestFullscreen(); native = document.fullscreenElement === frame; }
      catch { /* Mobile browsers can still use the viewport-filling modal. */ }
      finally { pending = false; }
    }
  }
  button.addEventListener('click', () => active ? exit() : enter());
  dialog.addEventListener('cancel', event => { event.preventDefault(); exit(); });
  dialog.addEventListener('close', restore);
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement === frame) native = true;
    else if (active && native) restore();
  });
  // In addition to touch-action, block Safari gesture zoom over the model only.
  for (const event of ['touchmove', 'gesturestart', 'gesturechange']) {
    stage.addEventListener(event, e => {
      if (active && e.target instanceof Element && e.target.closest('canvas')) e.preventDefault();
    }, {passive:false});
  }
  window.addEventListener('pagehide', restore);
}

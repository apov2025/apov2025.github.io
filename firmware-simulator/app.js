// Host integration by apov. The unchanged CrossPoint/OnePage C++ firmware owns
// the framebuffer and all reading/menu behaviour. See README.md for provenance.
const $ = selector => document.querySelector(selector);
const canvas = $('#screen');
const context = canvas.getContext('2d', {alpha:false});
const pixels = context.createImageData(480, 800);
const monochrome = new Uint8Array(480 * 800);
const runtimeRoot = new URL('./vendor/crosspoint/', import.meta.url);
const names = ['返回', '确认', '向左', '向右', '上一页', '下一页', '电源'];
let runtime, inject, consumeDirty, framebuffer;
let frameCount = 0;
let activity = "";
let bootTimer;
const activeSources = new Map();
const releaseTimers = new Map();
const downSince = new Map();

function unavailable(message) {
  releaseAll();
  $('#unsupported-message').textContent = message;
  if (!$('#unsupported-dialog').open) $('#unsupported-dialog').showModal();
}
$('#dismiss-unsupported').addEventListener('click', () => $('#unsupported-dialog').close());

// Guard for the pinned 20260722-zh4 build's default Lyra/portrait home screen.
// Read the rendered highlight rather than count key presses: the firmware may
// auto-repeat keys, wrap selection, or restore a selection on returning Home.
function fileTransferSelected() {
  if (activity !== 'Home') return false;
  let dark = 0;
  for (let y = 472; y < 506; y++) {
    for (let x = 340; x < 440; x++) dark += 1 - monochrome[y * 480 + x];
  }
  return dark / (34 * 100) > 0.1;
}
function confirmButton() {
  try { return JSON.parse(runtime.FS.readFile('/sd/.crosspoint/settings.json', {encoding:'utf8'})).frontButtonConfirm ?? 1; }
  catch { return 1; }
}

function fail(message) {
  clearTimeout(bootTimer);
  document.body.dataset.state = 'error';
  $('#status').textContent = '启动未完成';
  $('#boot').hidden = false;
  $('#boot-text').textContent = message;
  $('#retry').hidden = false;
  releaseAll();
}

function render() {
  const heap = runtime.HEAPU8;
  for (let y = 0; y < 480; y++) {
    for (let x = 0; x < 800; x++) {
      // Upstream: landscape 800×480, MSB-first 1-bit pixels; rotate clockwise.
      const white = (heap[framebuffer + y * 100 + (x >> 3)] >> (7 - (x & 7))) & 1;
      monochrome[x * 480 + 479 - y] = white;
    }
  }
  // A 2×2 box filter smooths the firmware's checkerboard grays before CSS
  // scales the screen, avoiding moiré on menu highlights (as in the upstream host).
  for (let y = 0; y < 800; y++) {
    const nextRow = Math.min(y + 1, 799) * 480;
    for (let x = 0; x < 480; x++) {
      const index = y * 480 + x, nextX = Math.min(x + 1, 479);
      const coverage = (monochrome[index] + monochrome[y * 480 + nextX] + monochrome[nextRow + x] + monochrome[nextRow + nextX]) / 4;
      const offset = index * 4;
      pixels.data[offset] = 29 + 206 * coverage;
      pixels.data[offset + 1] = 33 + 204 * coverage;
      pixels.data[offset + 2] = 29 + 200 * coverage;
      pixels.data[offset + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  canvas.dataset.frames = String(++frameCount);
  if (document.body.dataset.state !== 'ready') {
    clearTimeout(bootTimer);
    document.body.dataset.state = 'ready';
    $('#boot').hidden = true;
    $('#status').textContent = 'CrossPoint 正在运行';
    for (const id of ['#book-file','#import-book','#capture']) $(id).disabled = false;
    $('#input-status').textContent = '可点击机身按键，也可直接使用键盘。';
  }
}
function loop() {
  if (consumeDirty?.()) render();
  requestAnimationFrame(loop);
}

function markKey(key, down) {
  document.querySelector(`[data-key="${key}"]`).classList.toggle('pressed', down);
}
function releaseKey(key, immediately = false) {
  clearTimeout(releaseTimers.get(key));
  if ([...activeSources.values()].includes(key)) return;
  const release = () => {
    if ([...activeSources.values()].includes(key)) return;
    inject?.(key, 0);
    markKey(key, false);
    downSince.delete(key);
    releaseTimers.delete(key);
  };
  // Very short clicks still need one firmware polling interval to be observed.
  const delay = immediately ? 0 : Math.max(0, 90 - (performance.now() - (downSince.get(key) || 0)));
  if (delay) releaseTimers.set(key, setTimeout(release, delay));
  else release();
}
function press(source, key) {
  if (!inject || document.body.dataset.state !== 'ready' || activeSources.has(source)) return;
  if ($('#unsupported-dialog').open) return;
  if (key === 6) {
    unavailable('此浏览器版本没有实现电源键的锁屏和唤醒。请继续体验阅读功能；需要重新开始时，可点击网页上的“重启模拟器”。');
    return;
  }
  if (key === confirmButton() && fileTransferSelected()) {
    unavailable('File Transfer 依赖实体设备的 Wi-Fi 服务，此浏览器版本暂不支持。已拦截此入口，阅读器仍可正常操作。请使用网页上的“导入一本书”添加 EPUB 或 TXT。');
    return;
  }
  activeSources.set(source, key);
  clearTimeout(releaseTimers.get(key));
  if (!downSince.has(key)) {
    inject(key, 1);
    downSince.set(key, performance.now());
  }
  markKey(key, true);
  $('#input-status').textContent = `按键：${names[key]}`;
}
function release(source) {
  const key = activeSources.get(source);
  if (key === undefined) return;
  activeSources.delete(source);
  releaseKey(key);
}
function releaseAll() {
  activeSources.clear();
  for (let key = 0; key < 7; key++) releaseKey(key, true);
}

for (const button of document.querySelectorAll('[data-key]')) {
  const key = Number(button.dataset.key);
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    press(`pointer:${event.pointerId}`, key);
  });
  for (const type of ['pointerup','pointercancel','lostpointercapture']) {
    button.addEventListener(type, event => release(`pointer:${event.pointerId}`));
  }
  // Native keyboard activation (Tab + Enter/Space) and assistive technology.
  button.addEventListener('click', event => {
    if (event.detail !== 0) return;
    const source = `accessible:${key}`;
    press(source, key);
    release(source);
  });
}
const keyboard = {Escape:0, Backspace:0, Enter:1, NumpadEnter:1, ArrowLeft:2, ArrowRight:3, ArrowUp:4, ArrowDown:5, KeyP:6};
window.addEventListener('keydown', event => {
  if ($('#unsupported-dialog').open) return;
  if (event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
  if (event.target.closest('button,a,summary') && ['Enter','Space'].includes(event.code)) return;
  const key = keyboard[event.code];
  if (key === undefined) return;
  event.preventDefault();
  if (!event.repeat) press(`keyboard:${event.code}`, key);
});
window.addEventListener('keyup', event => {
  if (!activeSources.has(`keyboard:${event.code}`)) return;
  event.preventDefault();
  release(`keyboard:${event.code}`);
});
window.addEventListener('blur', releaseAll);
document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });

$('#import-book').addEventListener('click', () => $('#book-file').click());
$('#book-file').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file || !runtime) return;
  try {
    if (!/\.(epub|txt)$/i.test(file.name)) throw new Error('请选择 EPUB 或 TXT 文件。');
    if (file.size > 16 * 1024 * 1024) throw new Error('这一版支持 16 MB 以内的书籍，请选择较小的文件。');
    if (!file.size) throw new Error('文件为空，请选择其他书籍。');
    let name = file.name.replace(/[\/\\\x00-\x1f]/g, '_').replace(/^\.+/, '_');
    if (runtime.FS.analyzePath(`/sd/${name}`).exists) {
      const dot = name.lastIndexOf('.');
      const stem = name.slice(0,dot), extension = name.slice(dot);
      let index = 2;
      while (runtime.FS.analyzePath(`/sd/${name}`).exists) name = `${stem} (${index++})${extension}`;
    }
    runtime.FS.writeFile(`/sd/${name}`, new Uint8Array(await file.arrayBuffer()));
    $('#message').textContent = `已导入 ${name}。返回并重新进入固件的文件浏览器，即可打开。`;
  } catch (error) { $('#message').textContent = error.message || '导入失败，请换一本书重试。'; }
  finally { event.target.value = ''; }
});
$('#capture').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'apov-crosspoint-screen.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});
for (const selector of ['#restart','#retry']) $(selector).addEventListener('click', () => location.reload());

async function start() {
  if (!window.isSecureContext || !('serviceWorker' in navigator)) {
    fail('请通过 localhost 或 HTTPS 打开此页面；当前浏览器环境无法启动模拟器。');
    return;
  }
  if (!window.crossOriginIsolated) {
    $('#boot-text').textContent = '首次启动正在准备环境，页面会自动刷新一次…';
    bootTimer = setTimeout(() => fail('环境准备失败。请允许此站点使用 Service Worker，然后重新加载。'), 15000);
    return;
  }
  $('#boot-text').textContent = '正在加载固件和示例书…';
  bootTimer = setTimeout(() => fail('加载时间较长，请检查网络后重新加载。'), 45000);
  try {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('crosspoint_simulator_wasm.js', runtimeRoot).href;
      script.onload = resolve;
      script.onerror = () => reject(new Error('固件文件加载失败，请重新加载。'));
      document.body.appendChild(script);
    });
    runtime = await window.createSimulator({
      arguments: ['--lang','ZH_CN'],
      locateFile: path => new URL(path, runtimeRoot).href,
      preRun: [module => {
        module.FS.mkdirTree('/sd/.crosspoint');
        module.FS.writeFile('/sd/.crosspoint/settings.json', JSON.stringify({language:'ZH_CN',sdFontFamilyName:'LXGWWenKai-Regular',fontSize:1,sleepTimeoutMinutes:0}));
        module.FS.writeFile('/sd/.crosspoint/recent.json', JSON.stringify({books:[
          {path:'/狂人日记.epub',title:'狂人日记',author:'鲁迅',coverBmpPath:''},
          {path:'/alice-in-wonderland.epub',title:'Alice’s Adventures in Wonderland',author:'Lewis Carroll',coverBmpPath:''}
        ]}));
      }],
      print: text => {
        const entered = text.match(/Entering activity: (\w+)/);
        if (entered) activity = entered[1];
        console.debug('[CrossPoint]',text);
      },
      printErr: text => {
        const entered = text.match(/Entering activity: (\w+)/);
        if (entered) activity = entered[1];
        console.warn('[CrossPoint]',text);
      },
      onAbort: () => fail('固件运行已停止，请重启模拟器。')
    });
    inject = runtime.cwrap('simulator_inject_button', null, ['number','number']);
    consumeDirty = runtime.cwrap('simulator_consume_dirty', 'number', []);
    framebuffer = runtime.cwrap('simulator_framebuffer_ptr', 'number', [])();
    requestAnimationFrame(loop);
  } catch (error) { fail(`启动失败：${error.message || error}`); }
}
start();

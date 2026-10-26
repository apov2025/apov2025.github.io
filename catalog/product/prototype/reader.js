import { readerBooks } from './reader-books.js';

// An independent interaction demo, not the CrossPoint firmware or ESP32 emulation.
export function createReader(root, initialLanguage = 'en') {
  const device = root.querySelector('#reader-device');
  const viewport = root.querySelector('.reader-display');
  const screen = root.querySelector('.reader-screen');
  const live = root.querySelector('.reader-announcement');
  const storageKey = 'prototype-reading-demo-v1';
  let language = initialLanguage, view = 'off', resumeView = 'library', bootTimer;
  let bookIndex = 0, page = 0, selectedBook = 0, fontSize = 'normal', pages = [], active = false;
  let progress = {};
  const sizes = { small: 38, normal: 44, large: 50 };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (Object.hasOwn(sizes, saved.fontSize)) fontSize = saved.fontSize;
    if (saved.progress && typeof saved.progress === 'object' && !Array.isArray(saved.progress)) {
      for (const [key, value] of Object.entries(saved.progress)) if (Number.isSafeInteger(value) && value >= 0 && value < 100000) progress[key] = value;
    }
  } catch {}
  const t = (en, zh) => language === 'zh-CN' ? zh : en;
  const book = () => readerBooks[bookIndex][language === 'zh-CN' ? 'zh' : 'en'];
  const progressKey = () => `${readerBooks[bookIndex].id}:${language}`;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const button = (action, text, extra = '') => `<button type="button" data-reader-action="${action}" ${extra}>${text}</button>`;
  function persist() { try { localStorage.setItem(storageKey, JSON.stringify({ fontSize, progress })); } catch {} }
  function remember() { if (pages[page]) { progress[progressKey()] = pages[page].start; persist(); } }
  function setView(next) { view = next; render(); }
  function render() {
    const focused = root.contains(document.activeElement) ? document.activeElement : null;
    const focusAction = focused?.dataset.readerAction;
    const focusSize = focused?.dataset.readerSize;
    device.dataset.readerState = view;
    device.dataset.readerPage = String(page);
    screen.style.setProperty('--reading-size', `${sizes[fontSize]}px`);
    screen.lang = language;
    if (view === 'off' || view === 'boot' || view === 'sleep') {
      const copy = view === 'off' ? t('Press the top power key', '按顶部电源键开机') : view === 'boot' ? t('Opening your library…', '正在打开书架…') : t('Sleeping', '休眠中');
      screen.innerHTML = `<div class="reader-rest ${view}">${view === 'off' ? '' : '<strong>prototype</strong>'}<span>${copy}</span>${view === 'sleep' ? `<small>${t('Press power to continue', '按电源键继续阅读')}</small>` : ''}</div>`;
    } else if (view === 'library') {
      screen.innerHTML = `<div class="reader-library"><header><span>${t('Library', '书架')}</span></header><div class="reader-book-list">${readerBooks.map((item, index) => {
        const content = item[language === 'zh-CN' ? 'zh' : 'en'];
        return `<button type="button" data-reader-book="${index}" class="reader-book ${selectedBook === index ? 'selected' : ''}"><span class="reader-book-cover" aria-hidden="true">${index === 0 ? '◒' : '⌁'}</span><span><strong>${content.title}</strong><small>${content.subtitle}</small><em>${progress[`${item.id}:${language}`] ? t('Continue reading', '继续阅读') : t('Start reading', '开始阅读')}</em></span></button>`;
      }).join('')}</div></div>`;
    } else if (view === 'reading') {
      screen.innerHTML = `<div class="reader-reading"><header>${button('menu', escape(book().title), `aria-label="${t('Open reading menu', '打开阅读菜单')}"`)}<span aria-hidden="true">···</span></header><div class="reader-touch" role="region" tabindex="0" aria-label="${t('Reading page. Tap left or right to turn; tap the center for the menu.', '阅读页面：点击左右翻页，点击中间打开菜单。')}"><div class="reader-prose"></div></div><footer><span class="reader-page-number"></span></footer></div>`;
      const prose = screen.querySelector('.reader-prose');
      paginate(prose);
      prose.textContent = pages[page]?.text || '';
      screen.querySelector('.reader-page-number').textContent = `${page + 1} / ${pages.length}`;
      device.dataset.readerPage = String(page);
      remember();
      const touch = screen.querySelector('.reader-touch');
      let down;
      let suppressClickUntil = 0;
      touch.addEventListener('pointerdown', event => { if (event.isPrimary && event.button === 0) down = { x: event.clientX, y: event.clientY, id: event.pointerId }; });
      touch.addEventListener('pointercancel', () => { down = null; });
      touch.addEventListener('pointerup', event => {
        if (!down || down.id !== event.pointerId) return;
        const dx = event.clientX - down.x, dy = event.clientY - down.y; down = null;
        if (Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(dy) * 1.25) {
          suppressClickUntil = performance.now() + 400;
          turn(dx < 0 ? 1 : -1);
        } else if (Math.abs(dy) > 20) suppressClickUntil = performance.now() + 400;
      });
      touch.addEventListener('click', event => {
        if (performance.now() < suppressClickUntil) return;
        const rect = touch.getBoundingClientRect();
        const ratio = (event.clientX - rect.left) / rect.width;
        if (ratio < .3) turn(-1); else if (ratio > .7) turn(1); else setView('menu');
      });
    } else if (view === 'menu') {
      screen.innerHTML = `<div class="reader-menu"><header>${button('resume', t('Back to reading', '继续阅读'))}<span>×</span></header><h3>${t('Reading settings', '阅读设置')}</h3><p>${t('Text size', '字号')}</p><div class="reader-sizes" role="group" aria-label="${t('Text size', '字号')}">${Object.keys(sizes).map((size, index) => `<button type="button" data-reader-size="${size}" aria-pressed="${fontSize === size}" aria-label="${[t('Small text', '小字号'), t('Normal text', '标准字号'), t('Large text', '大字号')][index]}" style="font-size:${38 + index * 10}px">${t('Aa', '字')}</button>`).join('')}</div><div class="reader-menu-actions">${button('library', t('My library', '返回书架'))}${button('sleep', t('Sleep', '休眠'))}${button('shutdown', t('Power off', '关机'))}</div></div>`;
    }
    const labels = { power: t('Power · P', '电源 · P'), prev: t('Previous page · ↑', '上一页 · ↑'), next: t('Next page · ↓', '下一页 · ↓'), menu: t('Reading menu · Enter', '阅读菜单 · Enter') };
    for (const key of root.querySelectorAll('.reader-hardware')) {
      const label = labels[key.dataset.readerAction]; key.setAttribute('aria-label', label); key.title = label;
    }
    live.textContent = view === 'reading' ? t(`Page ${page + 1} of ${pages.length}`, `第 ${page + 1} 页，共 ${pages.length} 页`) : ({ off: t('Powered off', '已关机'), boot: t('Starting', '正在开机'), library: t('Library', '书架'), menu: t('Reading settings', '阅读设置'), sleep: t('Sleeping', '休眠中') })[view];
    // Replaced screen controls retain keyboard focus without moving the page.
    if (focused && !focused.isConnected) {
      const replacement = focusSize ? screen.querySelector(`[data-reader-size="${focusSize}"]`) : focusAction ? screen.querySelector(`[data-reader-action="${focusAction}"]`) : null;
      (replacement || device).focus({ preventScroll: true });
    }
  }
  function paginate(prose) {
    const content = book().text;
    const anchor = progress[progressKey()] || 0;
    const result = [];
    let start = 0;
    while (start < content.length) {
      let low = start + 1, high = content.length, end = start + 1;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        prose.textContent = content.slice(start, mid);
        if (prose.scrollHeight <= prose.clientHeight + 1) { end = mid; low = mid + 1; } else high = mid - 1;
      }
      if (language !== 'zh-CN' && end < content.length) {
        const boundary = content.lastIndexOf(' ', end);
        if (boundary > start) end = boundary + 1;
      }
      result.push({ start, end, text: content.slice(start, end).trim() });
      start = end;
      while (/\s/.test(content[start] || '') && start < content.length) start++;
    }
    pages = result;
    page = Math.max(0, pages.findIndex(item => anchor < item.end));
    if (anchor >= content.length) page = pages.length - 1;
  }
  function openBook(index) { bookIndex = index; selectedBook = index; page = 0; setView('reading'); }
  function turn(delta) {
    if (view === 'library') { selectedBook = Math.max(0, Math.min(readerBooks.length - 1, selectedBook + delta)); render(); return; }
    if (view !== 'reading') return;
    const next = Math.max(0, Math.min(pages.length - 1, page + delta));
    if (next === page) return;
    page = next; remember(); render();
  }
  function power() {
    if (view === 'off') {
      setView('boot'); clearTimeout(bootTimer);
      bootTimer = setTimeout(() => setView('library'), 700);
    } else if (view === 'boot') { clearTimeout(bootTimer); setView('off'); }
    else if (view === 'sleep') setView(resumeView);
    else { resumeView = view === 'menu' ? 'reading' : view; setView('sleep'); }
  }
  function act(action) {
    if (action === 'power') return power();
    if (['off', 'boot', 'sleep'].includes(view)) return;
    if (action === 'prev' || action === 'next') turn(action === 'prev' ? -1 : 1);
    else if (action === 'menu') { if (view === 'library') openBook(selectedBook); else setView(view === 'menu' ? 'reading' : 'menu'); }
    else if (action === 'resume') setView('reading');
    else if (action === 'library') setView('library');
    else if (action === 'sleep') power();
    else if (action === 'shutdown') { clearTimeout(bootTimer); setView('off'); }
  }
  root.addEventListener('click', event => {
    const target = event.target.closest('button');
    if (!target || !active) return;
    if (target.dataset.readerAction) act(target.dataset.readerAction);
    else if (target.dataset.readerBook !== undefined && view === 'library') openBook(Number(target.dataset.readerBook));
    else if (target.dataset.readerSize && Object.hasOwn(sizes, target.dataset.readerSize)) { fontSize = target.dataset.readerSize; persist(); render(); }
  });
  device.addEventListener('keydown', event => {
    if (!active || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
    const actions = { ArrowLeft: 'prev', ArrowUp: 'prev', ArrowRight: 'next', ArrowDown: 'next', p: 'power', P: 'power' };
    if (actions[event.key]) { event.preventDefault(); act(actions[event.key]); }
    else if (event.key === 'Escape' && view === 'menu') { event.preventDefault(); act('resume'); }
    else if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('button')) { event.preventDefault(); act('menu'); }
  });
  function position(element, rect, minWidth = 0, minHeight = 0) {
    const width = Math.max(rect.width, minWidth), height = Math.max(rect.height, minHeight);
    Object.assign(element.style, { left: `${rect.left - (width - rect.width) / 2}px`, top: `${rect.top - (height - rect.height) / 2}px`, width: `${width}px`, height: `${height}px` });
  }
  render();
  return {
    setActive(value) { active = value; root.hidden = !value; if (value) render(); },
    setLanguage(value) { if (value === language) return; language = value; if (active) render(); },
    layout(rects) {
      if (!rects.screen) return;
      position(viewport, rects.screen);
      screen.style.transform = `scale(${rects.screen.width / 684}, ${rects.screen.height / 1216})`;
      for (const action of ['power', 'menu', 'prev', 'next']) if (rects[action]) position(root.querySelector(`.reader-hardware[data-reader-action="${action}"]`), rects[action], action === 'power' ? 44 : 28, action === 'power' ? 26 : 32);
    },
  };
}

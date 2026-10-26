import { initDeveloperEdition } from '../prototype/developer-edition.js?v=developer-5';
const translations = [...document.querySelectorAll('[data-zh]')].map(element => ({ element, en: element.textContent, zh: element.dataset.zh }));
let language = 'en';
try { if (localStorage.getItem('catalog-language') === 'zh-CN') language = 'zh-CN'; } catch {}
let viewer, layout = null;
function renderLanguage() {
  document.documentElement.lang = language;
  for (const { element, en, zh } of translations) element.textContent = language === 'zh-CN' ? zh : en;
  for (const button of document.querySelectorAll('[data-language]')) button.setAttribute('aria-pressed', String(button.dataset.language === language));
  document.querySelector('.developer-layouts').setAttribute('aria-label', language === 'zh-CN' ? '点阵按键设计' : 'Dot-matrix key layouts');
  document.title = language === 'zh-CN' ? 'prototype 开发者版本 — apov' : 'prototype developer edition — apov';
  viewer?.setLanguage(language);
}
for (const button of document.querySelectorAll('[data-language]')) button.addEventListener('click', () => {
  language = button.dataset.language;
  try { localStorage.setItem('catalog-language', language); } catch {}
  renderLanguage();
});
for (const button of document.querySelectorAll('[data-developer-layout]')) button.addEventListener('click', () => {
  layout = button.dataset.developerLayout === 'off' ? null : button.dataset.developerLayout;
  for (const option of document.querySelectorAll('[data-developer-layout]')) option.setAttribute('aria-pressed', String(option.dataset.developerLayout === (layout || 'off')));
  viewer?.setLayout(layout);
});
document.querySelector('#developer-reset').addEventListener('click', () => viewer?.resetView());
renderLanguage();
initDeveloperEdition(document.querySelector('#developer-viewer'), { language }).then(instance => {
  viewer = instance;
  viewer?.setLanguage(language);
  viewer?.setLayout(layout);
});

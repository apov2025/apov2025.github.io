const SIZE = { width: 944, height: 1016 };
const copy = {
  en: { title: 'Rear sticker', upload: 'Upload image', shuffle: 'New layouts', original: 'Original', layout: 'Layout', hint: 'Choose an image, then pick a layout. Your image stays in this browser.', ready: 'Four layouts are ready. Choose one to apply it.', error: 'Choose a PNG, JPEG, WebP or AVIF image under 20 MB.', loading: 'Preparing layouts…' },
  'zh-CN': { title: '后盖贴纸', upload: '上传图片', shuffle: '重新生成', original: '原版', layout: '方案', hint: '上传图片，再选择喜欢的排版。图片仅在当前浏览器中处理。', ready: '已生成四种排版，点击即可应用。', error: '请选择小于 20 MB 的 PNG、JPEG、WebP 或 AVIF 图片。', loading: '正在生成排版…' },
};

function canvas() {
  const output = document.createElement('canvas');
  output.width = SIZE.width;
  output.height = SIZE.height;
  return output;
}

function arrange(image, index) {
  const output = canvas(), context = output.getContext('2d');
  const { width, height } = SIZE;
  const random = (min, max) => min + Math.random() * (max - min);
  context.fillStyle = ['#f5f3ec', '#e8ede7', '#f0e8df', '#ececef'][index];
  context.fillRect(0, 0, width, height);
  const stamp = (x, y, size, angle) => {
    const scale = size / Math.max(image.width, image.height);
    context.save();
    context.translate(x * width, y * height);
    context.rotate(angle * Math.PI / 180);
    context.drawImage(image, -image.width * scale / 2, -image.height * scale / 2, image.width * scale, image.height * scale);
    context.restore();
  };
  if (index === 0) stamp(random(.46, .54), random(.46, .54), width * random(.68, .81), random(-9, 9));
  if (index === 1) {
    stamp(.34, .29, width * random(.48, .57), random(-18, -7));
    stamp(.65, .72, width * random(.48, .57), random(7, 18));
  }
  if (index === 2) {
    const angle = random(-14, 14), size = width * random(.22, .28);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) stamp((col + .5) / 3, (row + .5) / 3, size, angle + random(-7, 7));
  }
  if (index === 3) {
    stamp(random(.46, .54), .55, width * random(.56, .68), random(8, 16));
    stamp(.22, .18, width * .24, random(-20, -8));
    stamp(.8, .83, width * .22, random(-14, 2));
  }
  return output;
}

export function initStickerEditor(container, viewer, initialLanguage = 'en') {
  if (!container || !viewer.hasCustomLabel()) return;
  container.innerHTML = `<h2 class="sticker-title"></h2>
    <div class="sticker-actions"><button type="button" class="viewer-action" id="sticker-upload-button"></button><input id="sticker-upload" type="file" accept="image/png,image/jpeg,image/webp,image/avif" hidden><button type="button" class="viewer-action" id="sticker-shuffle" disabled></button></div>
    <p class="sticker-hint"></p><div class="sticker-options" role="group"></div><p class="sticker-status" role="status" aria-live="polite"></p>`;
  const $ = selector => container.querySelector(selector);
  const upload = $('#sticker-upload'), uploadButton = $('#sticker-upload-button'), shuffle = $('#sticker-shuffle'), options = $('.sticker-options');
  const original = canvas();
  const originalContext = original.getContext('2d');
  // The model's embedded artwork is pre-flipped for its existing rear-label UVs.
  originalContext.translate(0, SIZE.height); originalContext.scale(1, -1);
  originalContext.drawImage(viewer.getLabelImage(), 0, 0, SIZE.width, SIZE.height);
  let language = initialLanguage, image, variants = [], selected = -1, message = '', loading = false, uploadVersion = 0;

  function setLanguage(value) {
    language = value === 'zh-CN' ? 'zh-CN' : 'en';
    const text = copy[language];
    $('.sticker-title').textContent = text.title;
    uploadButton.textContent = text.upload;
    upload.setAttribute('aria-label', text.upload);
    shuffle.textContent = text.shuffle;
    $('.sticker-hint').textContent = text.hint;
    options.setAttribute('aria-label', text.title);
    $('.sticker-status').textContent = message ? text[message] : '';
    for (const button of options.children) {
      const index = Number(button.dataset.sticker);
      button.querySelector('span').textContent = index === -1 ? text.original : `${text.layout} ${index + 1}`;
    }
  }

  function select(index) {
    if (loading) return;
    viewer.setLabel(index === -1 ? null : variants[index]);
    viewer.setRotate(false);
    viewer.setView('back');
    selected = index;
    for (const button of options.children) button.setAttribute('aria-pressed', String(Number(button.dataset.sticker) === selected));
    container.dataset.selectedSticker = String(index);
  }

  function previews() {
    options.replaceChildren();
    [original, ...variants].forEach((source, position) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sticker-option';
      button.dataset.sticker = String(position - 1);
      button.setAttribute('aria-pressed', String(position - 1 === selected));
      const preview = document.createElement('canvas');
      preview.width = 118; preview.height = 127; preview.setAttribute('aria-hidden', 'true');
      preview.getContext('2d').drawImage(source, 0, 0, 118, 127);
      button.append(preview, document.createElement('span'));
      button.addEventListener('click', () => select(position - 1));
      options.append(button);
    });
    setLanguage(language);
  }

  function setLoading(value) {
    loading = value;
    uploadButton.disabled = value;
    shuffle.disabled = value || !image;
    for (const button of options.children) button.disabled = value;
  }

  function generate() {
    if (!image) return;
    variants = Array.from({ length: 4 }, (_, index) => arrange(image, index));
    message = 'ready';
    previews();
    select(0);
  }

  uploadButton.addEventListener('click', () => upload.click());
  shuffle.addEventListener('click', generate);
  upload.addEventListener('change', async () => {
    const file = upload.files?.[0];
    if (!file) return;
    const version = ++uploadVersion;
    message = 'loading'; setLoading(true); setLanguage(language);
    try {
      if (file.size > 20 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp', 'image/avif'].includes(file.type)) throw new Error('Unsupported image');
      const decoded = await createImageBitmap(file);
      if (version !== uploadVersion) { decoded.close(); return; }
      image?.close(); image = decoded;
      setLoading(false); generate();
    } catch {
      if (version === uploadVersion) { message = 'error'; setLanguage(language); }
    } finally {
      if (version === uploadVersion) { setLoading(false); upload.value = ''; }
    }
  });
  previews();
  return { setLanguage };
}

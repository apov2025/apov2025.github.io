import assert from 'node:assert/strict';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || '/Users/Ke/side_projects/obook5_3d_model/node_modules/@playwright/test/index.mjs');

const origin = process.env.SIMULATOR_ORIGIN || 'http://127.0.0.1:5187';
const browser = await chromium.launch({headless: true, executablePath: process.env.CHROMIUM_PATH || '/Users/Ke/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
const context = await browser.newContext();
const page = await context.newPage();
const errors = [], requests = [];
page.on('pageerror', e => errors.push(e.message));
page.on('requestfailed', r => errors.push(`${r.url()}: ${r.failure()?.errorText}`));
page.on('request', r => requests.push(r.url()));
await page.route('**/__paper_runtime_smoke.html', route => route.fulfill({contentType: 'text/html', body: '<!doctype html><title>PaperS3 runtime verification</title><canvas width="540" height="960"></canvas>'}));
try {
  await page.goto(`${origin}/__paper_runtime_smoke.html`);
  await page.evaluate(async () => {
    const {createPaperRuntime} = await import('/catalog/product/m5stack-paper-s3/runtime.js');
    window.framesSeen = 0;
    window.paper = await createPaperRuntime({onFrame(frame) {
      window.framesSeen++;
      document.querySelector('canvas').getContext('2d').putImageData(new ImageData(frame.pixels, frame.width, frame.height), 0, 0);
    }});
    await window.paper.bootOfficial();
  });
  await page.waitForFunction(() => paper.state.stats.time > 14 && framesSeen > 0, null, {timeout: 180000});
  const invalid = await page.evaluate(async () => {
    const name = paper.state.firmwareName;
    try {await paper.loadFile(new File([new Uint8Array(32)], 'invalid.bin'));}
    catch (error) {return {code:error.code, status:paper.state.status, sameName:paper.state.firmwareName===name};}
    return null;
  });
  assert.equal(invalid.code, 'INCOMPLETE_IMAGE');
  assert.equal(invalid.status, 'running');
  assert(invalid.sameName);
  const boot = await page.evaluate(async () => {
    await paper.pause();
    const observation = await paper.observe();
    window.slash = async () => {
      const frame = await paper.capture(); let dark = 0;
      for (let y=326; y<336; y++) for (let x=112; x<122; x++) if (frame.pixels[(y*frame.width+x)*4]<128) dark++;
      return dark;
    };
    return {status: observation.status, frame: observation.frame, board: observation.serial.includes('board_M5PaperS3'), dark: await slash()};
  });
  assert(boot.board, 'Real guest must identify PaperS3');
  assert.equal(boot.frame.width, 540); assert.equal(boot.frame.height, 960);
  const samples = [boot.dark];
  for (let i=0; i<2; i++) {
    const released = await page.evaluate(async () => {
      await paper.start();
      const first = await paper.touch({x:116,y:330,pressed:true});
      let time = first.guestTime;
      // Stats are emitted once a second, too coarse to time a click rather than
      // a long press. Reassert the same contact and use actual queue receipts.
      while (time < first.guestTime+0.12) {
        await new Promise(resolve => setTimeout(resolve, 10));
        time = (await paper.touch({x:116,y:330,pressed:true})).guestTime;
      }
      return (await paper.touch({x:116,y:330,pressed:false})).guestTime;
    });
    await page.waitForFunction(t => paper.state.stats.time > t+5, released, {timeout: 60000});
    samples.push(await page.evaluate(async () => {await paper.pause(); return slash();}));
  }
  assert(samples[0]>40 && samples[1]<10 && samples[2]>40, `Two actual touches must toggle and restore firmware icon: ${samples}`);
  const local = await page.evaluate(async () => {
    const {OFFICIAL_FIRMWARE} = await import('/catalog/product/m5stack-paper-s3/runtime.js');
    const bytes = await (await fetch(OFFICIAL_FIRMWARE.url)).arrayBuffer();
    await paper.loadFile(new File([bytes], 'papers3-userdemo.bin'));
    return paper.state.firmwareName;
  });
  assert.equal(local, 'papers3-userdemo.bin');
  await page.waitForFunction(() => paper.state.stats.time > 14 && paper.state.frame, null, {timeout: 180000});
  const localBoot = await page.evaluate(async () => (await paper.observe()).serial.includes('board_M5PaperS3'));
  assert(localBoot, 'Local merged BIN must also boot the real application');
  assert(!requests.some(url => /esptool|flasher\.js/.test(url)), 'No hardware flasher should load');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({passed:true, boot, touchSamples:samples, localFileBoot:localBoot, frames:await page.evaluate(()=>framesSeen)}, null, 2));
} finally {
  await page.evaluate(() => window.paper?.dispose()).catch(()=>{});
  await browser.close();
}

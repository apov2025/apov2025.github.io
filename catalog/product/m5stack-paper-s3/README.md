# PaperS3 virtual device

The dedicated catalog page retains the original CAD-derived PaperS3 model, shell/front/button colors and catalog design. Drag the case or the surrounding background to orbit the device while its firmware keeps running. Touches and drags starting on the display go to the guest; a perspective ray intersection preserves native coordinates at oblique angles and rejects touches from behind. Two-finger pinch and the mouse wheel zoom, Front view returns to the display, and the orientation button rotates the device in 90° steps. Fullscreen retains these gestures and all color controls. The screen shows the actual 540 × 960 guest framebuffer.

`runtime.js` wraps the browser-only runtime from [zhuzhe1983/esp-online-tester](https://github.com/zhuzhe1983/esp-online-tester/tree/4932dcd1803381fb64c0dd6252707c0176e8ac9e), derived from mikroverk/esp32sim. It executes the ROM, bootloader and application, rather than rebuilding firmware menus in HTML. The physical USB flasher is not imported.

The default firmware is EDCBook 3.1.2, fetched directly from M5Stack's CDN and verified against a pinned SHA-256. The Official demo button loads M5Stack UserDemo v0.5. It is not redistributed in this repository. Local loading accepts a complete merged PaperS3 `.bin` image, including the bootloader and partition table at offset 0x8000. Invalid files are checked before replacing the running device. Firmware and virtual flash state use the upstream browser storage adapter.

## Reused assets

- Original M5Stack MIT CAD converted to `models/device.glb`; provenance and license are retained beside it. Manufacturer shell, button and hook triangles are unchanged. The presentation bezel now follows the CAD corner contour with a 2.25 mm radius; firmware screen geometry and UVs are unchanged. The current GLB SHA-256 is recorded in `models/provenance.json`. Rebuild with `python3 scripts/build-papers3-model.py` (visual inserts are defined in `scripts/papers3_hardware.py`).

- Runtime JS: upstream import closure with a scoped PaperS3 virtual-battery initialization patch; the worker remains unchanged and the product catalog is reduced to PaperS3. See `vendor/PROVENANCE.json` and `vendor/licenses/`.
- WASM: locally rebuilt with Rust 1.99.1 from the pinned upstream source plus the two source patches in `vendor/patches/`. The original published artifact and the patched build hashes are recorded in `vendor/PROVENANCE.json`. The JavaScript worker remains unchanged.
- ROM: Espressif's Apache-2.0 ROM ELF. Checksums for all vendored files are in `vendor/SHA256SUMS`.

The research also found MIT-derived Paper Mono CAD and a Paper Mono runtime. Metalio INK4 Plus has manufacturer CAD and a firmware catalog entry, but its runtime is marked unavailable; it cannot be substituted for PaperS3 execution.

The original esp32sim MIT notice credits Joakim Eriksson, Alice and Mattia Fiumara, with the wider contributor community. Zhu Zhe's fork adds the PaperS3 board and platform integration; M5Stack supplies the default demo firmware, and Espressif supplies the ROM. The page links these sources in one short credit sentence.

### Default firmware selection

On 2026-11-11, EDC Book 3.1.2 was tested using the original [M5Burner image](https://m5burner-cdn.m5stack.com/firmware/e9a34bd8a7095acf6a43dae2b1565a60.bin), 16,777,216 bytes, SHA-256 `06eb3b595fc47bc5d35f760a16cdc5795ea8c0fad6295bcee8db5268cf906986`. The original runtime stopped on `EE.LDXQ.32` at `0x420a0da0`. Implementing its documented semantics and separate selector operands removed that halt. EDCBook also uses the LCD RGB DMA path, so the PaperS3 board now consumes its physical two-bit drive symbols with the actual pin mapping and scan boundaries. It does not extract application framebuffers or modify the firmware.

The corrected build displays the welcome screen, opens the built-in quick-start guide, and advances to the next page through guest GT911 input (12.02 / 18.26 / 24.44 guest seconds; 10 / 19 / 29 host frames). Native execution independently produced the same welcome screen. The existing black/white optical model still does not reproduce calibrated grayscale; RTC, physical power control and network services remain outside this verification. Source patches include regression tests; 57 Xtensa and 246 S3 tests pass.

## Verification and runtime boundaries

Browser checks cover official firmware boot, guest identification as `board_M5PaperS3`, actual framebuffer output, two GT911 touches toggling/restoring the mute icon, loading the same complete image as a local File, invalid-file preservation, pause/resume, screen rotation and touch mapping, fullscreens, mobile layout, and restored page lifecycle.

The [upstream PaperS3 runtime](https://github.com/zhuzhe1983/esp-online-tester/blob/4932dcd1803381fb64c0dd6252707c0176e8ac9e/docs/platform/papers3-runtime.md) implements CPU execution, parallel display, GT911 single-touch and virtual SPI SDHC. Gray-level optical integration, RTC, buzzer audio and the physical power key remain incomplete; arbitrary firmware and network services are not verified. These are emulator capabilities, not host-generated substitutes. UserDemo itself draws a landscape interface; the screen rotation control preserves native touch coordinates.

Serve the repository root at `http://127.0.0.1:5187`:

```sh
python3 -m http.server 5187 --bind 127.0.0.1
node scripts/check-papers3-page.mjs
node catalog/product/m5stack-paper-s3/runtime-smoke.mjs
node scripts/check-viewer-fullscreen.mjs
```

Tests reuse this workspace's Playwright installation by default. `PLAYWRIGHT_MODULE`, `PLAYWRIGHT_EXECUTABLE`, and `BASE_URL` override the page/fullscreen tests. The runtime smoke test accepts `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH`, and `SIMULATOR_ORIGIN`. Native fullscreen needs a supporting Chromium runtime; macOS desktop Chrome in headless mode rejects it, while the installed Chromium headless shell supports it.


Repeated UserDemo boots were checked on 2026-11-11: first boot, reset, reloading the same image, page navigation with persisted flash, and switching back after EDCBook stopped all reached the demo UI with 75 frames by 14 guest seconds. Each new boot clears the page’s serial output and framebuffer; asynchronous failures remain visible and allow restart. Unsupported-instruction messages identify the failing address when the emulator emits it.

PaperS3’s PMS150G-managed physical power key is not currently implemented by the upstream board model. The page’s Restart action resets the virtual machine; it does not pretend to press that key.

Two alternate merged reader images were tested without modifying their firmware: ReadPaper 1.7.8.1 (SHA-256 `89b67c446f781cd9bebd1285f04da6d09931a507a44734e3d47491d303c0cb09`) reaches its lock screen, but unlocking/reading was not verified. Microreader 0.2.11 (SHA-256 `df2c6f5f5fd5db1793e9f8f0d97d51739dcc02697b006186d99d43a148b1f13a`) repeatedly panics before producing a frame. Neither replaces EDCBook as default.

## Rebuilding the patched runtime

Check out `4932dcd1803381fb64c0dd6252707c0176e8ac9e` from the repository linked above. Apply `vendor/patches/0001-xtensa-ldxq.patch`, then `0002-papers3-rgb.patch` using `git apply`. With Rust 1.99.1 and the `wasm32-unknown-unknown` target installed, run `sh tools/wasm-build.sh`. Copy the generated `web/wasm/esp32sim.wasm` here and update `PROVENANCE.json` / `SHA256SUMS`. No EDCBook binary is checked into this repository.

### Virtual battery and page interaction

PaperS3 uses GPIO3 for battery ADC through equal 22 kΩ resistors (C139 schematic R24/R25). The host now supplies a constant 2.0 V to that pad, representing a 4.0 V virtual battery, through the emulator’s existing analog script. This retains real SAR conversion and firmware battery logic. Patch `0003-papers3-battery-host.patch` records the scoped host change; existing manifest scripts are preserved and may override the default. Apply it to the pinned source’s `web/platform/runtime.js` when reproducing the vendored host.

The production page defaults to firmware interaction and EDCBook; the official UserDemo remains a separate action. Browser verification loads the original EDCBook BIN through the file input, clicks Continue Reading, turns the guide page and keeps its reading body byte-identical through 125 guest seconds. The battery regression also holds the welcome screen unchanged through 125 seconds. These checks establish usable boot and text interaction, not calibrated gray-image fidelity.

The official UserDemo native render was byte-identical before and after RGB routing (`dab4085070a1b711d8a972894f19a890b212702b954458a5c110dae4c0813781`, PNG SHA-256). Three local 15-second guest runs gave median CPU time 12.89 s before / 12.32 s after; this small sample is a regression check, not a claimed speed improvement.

### Importing books

Start EDCBook, choose **Import books**, and select one or more TXT files. The host copies them into `/book` on the existing virtual FAT32 TF card and restarts the guest. In EDCBook choose **Open library** to read them. Existing files and settings remain intact; duplicate names receive a numeric suffix. Books persist in this browser with the same firmware image. This uses real SD storage and the firmware’s own library and text rendering.

`sd-books.js` updates FAT32/VFAT metadata in a new image before replacing the card. Tests cover Unicode names, collisions, fragmented chains, directory growth, existing file preservation, FAT/FSInfo copies and atomic full/corrupt-card failure. EDCBook’s initial SDMMC probe errors are nonfatal: its SPI fallback reads `/book/TEST.TXT` and turns pages successfully.

```sh
node scripts/check-sd-books.mjs
node scripts/check-papers3-orbit.mjs
EDCBOOK_BIN=/path/to/edcbook-3.1.2.bin node scripts/check-papers3-book-import.mjs
```

EDCBook now seeds `/book/西游记.txt` before its first guest start, including when the same pinned image is loaded locally. It checks the existing card before importing, so restarts/reloads do not create duplicate books or replace user files. Only Journey to the West is bundled; Dream of the Red Chamber remains a local manual-import test file. The unmodified UTF-8 source and its Gutenberg credits/license are recorded in `books/README.md`.

Real browser checks confirm imported TEST.TXT and its Chapter 4 reading position survive a full page reload and the same BIN loading. In this run the firmware initially showed its letter-cover lock screen after import/reload; one Restart returned to its menu. No automatic timed double boot is applied.

### Physical appearance

The unchanged shell now contains a display backing, simplified PCB/battery/shield envelopes, a rear carrier with connector clearances, USB-C shell/tongue/contacts, a recessed TF socket, and rear connector inserts. Their hidden geometry is a visual approximation; original CAD openings determine visible placement. Lower rear mounts have metal hex-socket screws; upper mounts retain the brass threaded inserts shown in the official reference photograph. The original `virtual paper s3` SVG label is drawn onto a separate rear surface, clear of the connectors and fastening points.

The **Loop / 吊环** checkbox under **Design my own / 自己设计** hides or restores the original CAD BottomHook mesh. It also works in fullscreen and retains the selected state through view resets and color changes. Firmware and native screen geometry are unchanged.

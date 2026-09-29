# 墨水屏固件模拟器 · apov

Static browser simulator using the existing CrossPoint / OnePage WebAssembly port by MoveCall. The C++ firmware runs in a Web Worker; the UI draws its framebuffer and forwards supported navigation button states. This is a firmware port, not instruction-accurate ESP32 emulation. Display waveforms, radio, real power consumption, charging and peripherals are not emulated. No device is connected or flashed.

## Design and implementation plan

User requested a working browser firmware simulator with a device enclosure and physical keys, and explicitly asked to reuse an existing implementation with author attribution. Use the existing MIT-licensed firmware build and write a minimal, independent apov host page. Do not recreate firmware screens in HTML. The enclosure represents the OnePage port and is an approximate CSS drawing, not an exact X4 hardware model.

- Run the pinned WASM, JS loader and virtual SD package from `vendor/crosspoint/` unchanged.
- Use the scope-local MIT coi-serviceworker to support SharedArrayBuffer on static HTTPS hosting (including GitHub Pages) and localhost.
- Display the 800×480 one-bit framebuffer rotated to 480×800. Keep a native-resolution canvas for readable text and screenshots.
- Forward actual down/up states for the six navigation hardware buttons; support pointer capture, long presses, keyboard shortcuts and release on blur. The power button shows a clear unsupported notice because the upstream HAL returns zero for its hold duration.
- Offer supplied demo books, optional local TXT/EPUB import, screen capture, and restart. Imported files exist only in the current runtime; disclose that they disappear on restart.
- Attribute Dave Allie / CrossPoint contributors and MoveCall visibly; include MIT notices and pinned source links.
- Verify actual rendered frames change after button and keyboard input, navigating menus, file import, loading failures and mobile fit.

Visual design: quiet white/slate page, graphite text, muted teal action accent. A silver device with an inset gray paper screen is the central object. System sans typography; responsive two-column layout with unboxed instructions. Device keys have visible pressed and focus states. Screen has no touch controls because this port uses physical keys.

## Run

No npm install or build is required. Serve this directory using `python3 -m http.server 5188 --bind 127.0.0.1`, then open http://127.0.0.1:5188/. On the first visit the page reloads to enable cross-origin isolation. Deploy the directory at `/firmware-simulator/` on an HTTPS static host. The service worker is scoped to this directory, not the parent site. Plain LAN HTTP URLs are unsupported.

Browser smoke test, using this workspace's installed Playwright: `node experiments/firmware-simulator/tests/smoke.mjs`. Override `SIMULATOR_URL` to verify the copied apov site.

## Upstream and provenance

- Original firmware: Dave Allie and [CrossPoint Reader contributors](https://github.com/crosspoint-reader/crosspoint-reader), MIT.
- OnePage port and browser build: [MoveCall/crosspoint-onepage](https://github.com/MoveCall/crosspoint-onepage), MIT. Source snapshot inspected: `23dec9dc794581f8350282d37a568b8a5e3e6a8a`; build instructions: `simulator/build_wasm.sh` (Emscripten). This is a source reference, not a claim that this revision produced the distributed binary.
- Existing runtime artifacts are copied byte-for-byte from [MoveCall/onepage-reader-web](https://github.com/MoveCall/onepage-reader-web/tree/0e0c2031f90e68958120ff58658e623a0fe7dc14/public/simulator), pinned commit `0e0c2031f90e68958120ff58658e623a0fe7dc14`. Upstream labels the build `20260722-zh4`. We did not compile this build; it is not claimed to be the latest CrossPoint release.
- Cross-origin isolation: Guido Zuidhof and contributors, [coi-serviceworker](https://github.com/gzuidhof/coi-serviceworker), MIT; copy from the same pinned OnePage website, including its upstream local modification.
- Preloaded demonstration books and fonts are part of the upstream `.data` file. Demo books: Lewis Carroll, *Alice’s Adventures in Wonderland*; 鲁迅，《狂人日记》.
- apov integration: independent host page, device frame and input/file controls. No OnePage website layout or device SVG is copied.

Licenses are in `licenses/`. Artifact checksums are in `vendor/crosspoint/SHA256SUMS`.

## Chinese font configuration

The distributed build defaults to a Latin reader font even though its SD package includes LXGW WenKai. The host seeds `/.crosspoint/settings.json` before firmware startup with `sdFontFamilyName: "LXGWWenKai-Regular"` and `fontSize: 1`, selecting the supplied font instead of rendering replacement glyphs. The book encoding and firmware binary are unchanged. The font is licensed under SIL OFL; see `licenses/LXGW-WenKai-OFL.txt`. The shell is Chinese; firmware UI translation coverage follows the upstream build.

## Unsupported features

Power/lock and wake, Wi-Fi File Transfer, Bluetooth and network services are not supported by the upstream browser build. The host shows a modal when power is pressed. It prevents the default Lyra/portrait Home File Transfer selection from entering a known upstream deadlock, identifying the selected row from the actual framebuffer and the activity log. This guard is specific to the pinned build and its default theme/layout; when upgrading firmware or changing themes/layout, validate and update it. Auto-sleep is disabled to avoid the same unsupported power path. Other networking menus are still upstream firmware and remain unsupported, as noted prominently on the page.

Validated: Chinese title/body render with LXGW WenKai, real EPUB pagination, navigation keys, local import, mobile layout, no device-wide keyboard outline, power notices and File Transfer prevention. Tests: `tests/smoke.mjs`, `tests/unsupported.mjs`.

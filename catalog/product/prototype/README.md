# prototype by apov

Static catalog detail page at `/catalog/product/prototype/`. Serve the repository root; no application server or runtime CDN is required.

## Source and content

Media and GLB/JSON exports come from `/Users/Ke/side_projects/obook5_3d_model/exports/prototype/`. `media/front-design.png` is the supplied `prototype_design/Group 4 (1).png`. Rendered finishes and dimensions are concept studies, not confirmed production hardware. Source exports use meters. All media is served locally. The sea-glass GLB loads automatically. Texture switches between the matte and brushed-metal models while preserving body, front, and key colors. The initial camera shows the front, right edge and top key, matching the requested three-quarter view. Rendering is on demand unless Auto rotate is enabled.

The catalog entry is in `../../assets/prototype-product.js`. The deployed `index-CZ9_AzTW.js` imports this entry, sorts dedicated entries first, and lets its link navigate normally rather than opening a modal. Existing catalog HTML references include a version query for cache invalidation. The older `website_eink_sg` source is not the current deployed catalog and must not overwrite it without reconciliation.

`index.html` contains readable content even without JavaScript. `page.js` manages language persistence and viewer loading. `viewer.js` contains the 3D controls and resource cleanup. `style.css` scopes the product layout.

## Three.js runtime

`vendor/three-runtime.js` is a local ES-module bundle of Three.js **0.186.0**, OrbitControls, GLTFLoader, GLTFExporter, and RoomEnvironment. The MIT license is in `vendor/THREE-LICENSE.txt`.

To regenerate, bundle an entry exporting these symbols using Vite's library mode (ES format, minified, output `three-runtime.js`):

```js
export {
  Scene, Color, PerspectiveCamera, WebGLRenderer, HemisphereLight,
  DirectionalLight, PMREMGenerator, Box3, Vector3, Spherical,
  ACESFilmicToneMapping, CanvasTexture, RepeatWrapping, SRGBColorSpace,
} from 'three';
export { OrbitControls } from 'three/addons/controls/OrbitControls.js';
export { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
export { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
export { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
export { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
```

The source model project's installed Three.js and Vite dependencies were used for this build. No package installation is required to host the committed assets.

## Verification

Serve the repository with `python3 -m http.server 5176 --bind 127.0.0.1`. With Playwright and Google Chrome available, run from the repository root:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/node_modules/@playwright/test/index.mjs node scripts/prototype-browser-check.mjs
```

The check covers automatic 3D loading, 24 high-resolution collage tiles, expansion within the collage area, click/Escape dismissal and focus restoration, catalog navigation, the existing OBOOK5 modal, three finishes, independent body/front/key colors, keyboard orbit/zoom, downloadable files, language persistence, 320/390-pixel layouts, model-load failure/retry, and content without JavaScript. Screenshots are saved in `/tmp/prototype-*.png`. Set `BASE_URL` to use a different local preview URL.

The Design section is removed. The final community-photo section is empty, with a localized “No community photos yet” message. All generated photo assets are retained but unused; provenance is recorded in `media/COMMUNITY-IMAGES.md` and earlier image documents. The independent interaction demo is described below; it does not run device firmware.

## Slim model and collage revision

The catalog models are now derived from the original exports with a **6.2 mm** enclosure-and-cover-glass envelope. The headphone jack is removed; USB-C meshes retain their original 3.45 mm surround height instead of being compressed with the enclosure. Width and height are 76.01 × 132 mm. The rear has a broad, gently crowned curve that tapers toward the perimeter. USB-C and top power controls retain their physical dimensions as the body becomes taller. Dimensions are still concept assumptions, not validated manufacturing specifications.

With the local preview server running, regenerate all three GLBs, configuration JSON, the 4 × 6 colorway collage, and reference renders:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/node_modules/@playwright/test/index.mjs node scripts/render-prototype-collage.mjs
```

Set `PROTOTYPE_SOURCE` to the original export directory if it moves. The script always derives from those originals, preventing repeated depth compression. It checks the body/glass envelope, unchanged USB-C height, and absence of jack geometry before saving. Palette and view order are recorded in `media/colorway-collage.json`; revised concept photo prompts are in `media/SLIM-REVISION.md`.

Design model renders each use a distinct coordinated palette. Updated prompts and high-resolution collage details are recorded in `media/COLORWAY-REVISION.md`. The random-colorway control uses `color-harmony.js`, copied from the source model project, to generate coordinated body/front/key colors. Glass reflections are reduced in both the viewer and model renders.

The viewer has no heading, description, download link, or camera-preset buttons. Drag/zoom, texture selection, color pickers, and the random-colorway control remain. The Design files section has been removed; source models remain local assets for the viewer. The product sub-navigation has been removed.

## Concept specification and purchase UI

Specifications are proposed targets for a future commerce-page mockup; concept labels are omitted from public-facing copy at the user’s request. The selected display dimensions are 4.7 inches, 684 × 1216 pixels (~297 ppi), consistent with the [Metalio E-INK4 Plus project](https://github.com/CloudZao/Metalio-E-INK4-Plus). The exact vendor panel datasheet was not available. Processor: [Espressif ESP32-S31](https://www.espressif.com/en/products/socs/esp32-s31), dual-core RISC-V at 320 MHz, Wi-Fi 6 and Bluetooth 5.4. Espressif offers a Linux developer preview in [esp-buildroot-external](https://github.com/espressif/esp-buildroot-external); the page claims only dedicated reading firmware and third-party firmware support, not a shipping Linux distribution. Storage is fixed at 16 GB, non-expandable; reading format is EPUB; the prototype bookstore is included. Other capacity, battery, lighting, weight and software specifications remain unvalidated product-design assumptions.

Two pre-order buttons display S$149. This is indicative pricing for the commerce-page mockup; public-facing concept-price labels have been removed. They open a local dialog stating pre-orders are not yet open. No checkout, payment, reservation or data collection is connected. Replace this flow with a supplied checkout URL when available.

Customization initially shows only Randomize and Design my own. Randomize changes both material and coordinated body/front/key colors. Design my own expands the three direct material choices (brushed metal, glossy polycarbonate, matte polycarbonate), independent color inputs and Auto rotate. Material changes preserve colors.

The download arrow inside the viewer exports the current design/view as PNG at up to 7680 pixels on the long edge, limited by GPU texture size and a 32-megapixel allocation cap. Auto rotation pauses during export and resumes afterward. Export does not include controls. A tighter 0.025–2 m camera depth range reduces artifacts between closely spaced screen layers; cover-glass roughness is zero to avoid transmission blur while low specular intensity limits glare.

Every 20 successive randomizations without manual material/color changes unlock one front-panel street pattern. Viewing, rotating and saving do not reset this sequence; manual customization does. There is no manual pattern selector. `media/hidden-streets.json` contains 7,097 OpenStreetMap road segments from central Singapore, rendered without labels or recognizable map markers. Data is © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright); attribution appears in the viewer and PNG when the pattern is active.

Final visual revision: opening grid restored to 4 rows × 6 columns. Each thumbnail is 800 × 600; the expanded image is 1800 × 2400 and stays within the collage area. The back profile was restored to the shallower 1.05 mm crown, starting behind z = −1.85 mm, replacing the more aggressive 1.9 mm deformation. Body and USB-C envelope checks still apply.

## Unified appearance and reading demo

The main viewer switches between Design appearance and Try the system. `viewer.js` animates the same colored model to a fitted front view, locks orbit/zoom, and projects its actual display, rocker halves, function key and power key into CSS coordinates. `reader.js` mounts an HTML 684 × 1216 logical display onto that screen; the initial camera, colors, rare pattern and auto-rotate state survive returning to appearance mode. The reading UI is hidden during camera movement and refits on resize. Save-image remains an appearance-mode control.

This is an original browser interaction demo, not CrossPoint or ESP32 firmware emulation. The existing `/firmware-simulator/` WASM page is unchanged. Click the top power key to boot into two sample books; tap left/right or swipe to turn pages, tap the center or function key for reading settings. The upper/lower rocker halves go back/forward. Settings offer three text sizes, library, sleep and shutdown. Power sleeps/wakes and cancels boot if pressed again. Keyboard arrows, Enter, Escape and P apply only inside the reader. Positions and font size persist in localStorage when available; blocked/malformed storage degrades to session use. Book prose is original demo content in `reader-books.js`, with English and Chinese following the page language. It supports no real EPUB import, bookstore, networking or hardware flashing.

Reading pagination measures the actual rendered serif text at each font size and preserves a character offset when reflowing. The DOM prose remains exposed to assistive technology. `scripts/prototype-reader-check.mjs` checks boot, touch and hardware controls, swipe without double advance, boundaries, sleep/wake, reflow, reload, mode round-trip/color preservation, keyboard isolation, localization, mobile touch and blocked storage. Run with the same PLAYWRIGHT_MODULE and BASE_URL conventions as the catalog check.

## Developer edition

The final Specifications row links to `/catalog/product/prototype-developer/`, a separate black-background page with an orbitable deep-gray 3D model, with no color/material customization or system mode. Two controls below it preview Side page keys and Bottom page keys dot-matrix layouts; all indicators start off, and clicking the selected layout again turns them off. The separate derivative GLB replaces the interrupted front with a continuous plate/glass, removes front physical key assemblies and the front wordmark, preserves the original bottom-right speaker grille, replaces the rear lettering with light-gray-filled “developer prototype”, and adds white dot-matrix LED indicators on the right and bottom touch regions. These two preset layouts illustrate programmable touch-key shapes; no layout editor or operating system is included. The uninterrupted front plate and glass use the original model’s outer contour so the corners align with the case. The top power key remains. `developer-edition.js` loads near the viewport, renders on demand, supports drag/zoom and keyboard orbit, and falls back to its model-rendered poster if WebGL/model loading fails. Asset provenance and regeneration are in the developer files supplied alongside the model.

The powered-off waiting screen contains only the power instruction, without a repeated prototype logo. The main mode selector is plain text in the viewer’s top-left corner, with weight/color indicating selection. All reading-screen UI colors are neutral grayscale; decorative library slogans and the duplicated “prototype library” reading footer have been removed. Only pagination remains in the reading footer.

The developer e-ink display reads “develop your own”; the rear inscription remains “developer prototype”. The screen message is non-emissive, separate from the selectable LED key indicators.

The two selectable layouts are side-only page keys and bottom-only page keys; decoration has been removed. Speaker perforations are excluded from LED areas.

Developer-page title is centered with no descriptive paragraph. Default and reset camera are exactly frontal at [0, 0, 0.34]. Reset stops auto rotation. The two plain-text camera controls sit inside the viewer; auto rotation is opt-in and pauses when the document is hidden.

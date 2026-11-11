# PaperS3 virtual firmware implementation plan

> For agentic workers: use subagent-driven-development or executing-plans for these bounded tasks.

**Goal:** Replace the PaperS3 catalog dialog with a dedicated product page that runs real firmware in a virtual PaperS3 and accepts local merged firmware files.

**Architecture:** Reuse zhuzhe1983/esp-online-tester's ESP32-S3 WASM runtime and manufacturer CAD at revision `4932dcd1803381fb64c0dd6252707c0176e8ac9e`. Keep the runtime, Three.js model viewer and catalog UI in separate modules. Firmware framebuffers become the model's screen texture; touch coordinates return to the guest firmware.

**Tech stack:** Static HTML/CSS, native JS modules, existing Three.js bundle, upstream WASM worker, Playwright browser checks.

**Spec:** User requests virtual firmware loading only, reuse PaperS3 or Paper Mono CAD, retain prototype/Pico design language, remove prototype v2's old system preview, and avoid excessive cautionary copy. Original fullscreen/customization task remains required.

## Constraints and review focus

- No physical USB flashing or fake firmware screens.
- Preserve catalog branding: white page, #edf0f2 stage, #171717 text, #646b70 secondary text, existing system typography and pill controls.
- Original upstream ROM/runtime and CAD licenses and provenance accompany assets. Default manufacturer firmware is fetched from its original URL, with pinned hash.
- Local file validation must leave a running device usable after an invalid selection.
- Release touch on pointer cancellation; keep screen interaction separate from model rotation.
- Fullscreen must contain firmware/color controls and work with mobile viewport fallback.
- Tests cover actual boot framebuffer, touch changes, local merged image load, pause/resume/reset, failure recovery, mobile layout, catalog navigation and removed prototype demo.

## Tasks

- [x] Vendor the runtime dependency closure, ROM and WASM; expose `createPaperRuntime({onFrame,onState,onSerial})` with bootDefault/loadFile/start/pause/reset/touch/button/dispose and state.
- [x] Convert the licensed CAD geometry to GLB without photo-derived decals; name Screen mesh for texture binding.
- [x] Build a dedicated PaperS3 page using existing catalog styles, model/firmware modes, local file input, reset/pause, color controls, fullscreen, bilingual labels and optional serial output.
- [x] Verify native fullscreens and touch gestures on existing products; remove prototype v2 reader code and validate retained model interactions.
- [x] Run browser firmware and layout regressions, review source changes and document tested capabilities and upstream limits outside the primary UI.

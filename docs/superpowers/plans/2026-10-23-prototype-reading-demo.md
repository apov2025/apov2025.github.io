# Prototype reading demo

User requests a unified Design appearance / Try the system mode switch in the 3D configurator, using the front device and supporting power-on, touch and physical-button reading. The existing CrossPoint WASM page is button-only; implement a separate static browser demo without changing that page or claiming this is device firmware.

Implementation: native HTML/CSS/JavaScript, the same live 3D model with preserved colors and a smooth transition to a fitted front view, an HTML 684 × 1216 logical screen projected onto the model, two rocker hit areas plus menu key and top power key. Disable orbit/zoom while using the system, restore the saved camera and auto rotation when returning to appearance mode. White/gray e-paper UI, existing sans chrome with serif reading text. Small localized demo label; no unrelated storefront or network functionality.

Flow: power off → short boot → two-book library → paginated reading. Tap left/right or swipe to turn pages; tap center/menu key for font size, library and power off. Power click sleeps/wakes with reading position intact. Keyboard shortcuts apply only within the device. Book positions and font size persist locally; invalid or unavailable storage must not break the demo. English and Chinese follow the product page language; sample prose is original demo content.

Tasks:
1. Add a browser check that fails on missing simulator and exercises boot, touch, buttons, page boundaries, sleep/wake, font reflow, persistence, language, mobile touch and keyboard isolation.
2. Add the isolated reader module and CSS, integrate inside #viewer, and notify it of page language changes.
3. Check actual screen alignment, readable layout, mobile fit and original 3D/catalog regression suite; review integration and fix concrete defects.

No deployment, checkout, actual firmware flashing, radio simulation or EPUB upload is included. Existing firmware-simulator remains unchanged.

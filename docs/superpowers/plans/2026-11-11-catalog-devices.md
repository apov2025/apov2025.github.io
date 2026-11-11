# Catalog device models

Implement the user's three supplied devices in the current static catalog checkout.

- Convert Pico and Metalio STEP geometry to meter-scale GLBs, separating aluminum frame, front/rear glass, controls, and display. Preserve the fine matte frame; Pico rear glossy, Metalio rear matte, both fronts matte.
- Model prototype game from the supplied front image. Reading and simple games; original D-pad and four face buttons, one power/lock key and two volume/page side keys. No shoulders or Start/Select. Thickness is a concept assumption.
- Reuse existing viewer and harmonious random colors with a rear-color channel. Fixed physical finishes for the real devices; do not add firmware simulation.
- Replace the original Pico detail route without duplicating the product. Add Metalio as real retail hardware and game as a concept. Preserve bilingual catalog structure.
- Render matching homepage covers and fallback posters; verify loading, color changes, views, touch-size layout, language, retry, and existing models. Serve locally for user testing; no publication requested.

Work split: main owns STEP conversion, viewer, render/verification; page worker owns HTML/catalog entries; model worker owns game generator/GLB.

## Follow-up refinements from local testing

- Use the supplied pico1–4 and metalio1–5 photos. Pico source -Z is the front, -X is up; USB left/lower, SD right/lower, power right/above center. Recess the display and adjust bezel against the photos.
- Add connector shells, insulators, tongues, contacts, and closed card-slot covers inside existing openings; complete concept ports too.
- Original aluminum/glass is default. Offer a polycarbonate frame/rear-shell variant while preserving front matte glass; random colors preserve this choice.
- Separate physical-key color from each of the three printed capacitive areas on both real devices.
- Refine game keycaps and inherit prototype v2's broad rear shoulder/crown, keeping port lands aligned.
- Replace the game screenshot-derived wordmark alpha rectangle with vector ink glyphs so no source background patch remains.

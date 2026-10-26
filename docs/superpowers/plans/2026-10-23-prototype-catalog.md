# Prototype catalog implementation

Goal: Add “prototype by apov” to the existing static catalog and provide a dedicated, minimal product detail page with specifications, supplied renders, original front design, and interactive/downloadable models.

Design: retain the catalog's Inter typography and white background (#ffffff), black text (#171717), muted text (#646b70), light rules (#e4e7e9), and cool render backgrounds (#edf0f2). A large product render leads the page, paired with a quiet left-aligned title and description. Follow with a three-finish model viewer, an asymmetric render gallery, and a compact specification table. Source dimensions are concept assumptions, not verified production specs.

- [x] Integrate a first-position catalog card using the supplied transparent front artwork. Keep normal navigation for the dedicated detail route and preserve the existing modal routes and language switch.
- [x] Create a responsive static detail page with local media, English/Chinese text, semantic sections, model downloads, front artwork, and honest concept specifications.
- [x] Add a lazy-loaded local Three.js viewer: orbit/zoom, keyboard navigation, finish selection, front/back/side/reset presets, accessible status and failure fallback. Bundle locally from the supplied model project's installed dependency; no runtime CDN.
- [x] Verify navigation, existing modal regression, language, all finishes and views, downloads, mobile overflow, blocked WebGL/model failure, and browser errors. Inspect screenshots.

Files: catalog/assets/prototype-product.js; small integration edits in the existing catalog bundle; catalog/product/prototype/{index.html,style.css,page.js,viewer.js,vendor,media,models}; scripts/prototype-browser-check.mjs.

The older catalog source in website_eink_sg predates the deployed catalog; preserve the current deployed dataset instead of rebuilding from that older source. Work in the current clean checkout. No publishing is requested.

User refinement: keep the product page simple, accurate, and elegant; allow independent color changes; include generated photographic concept views; defer firmware simulator. Implemented three native color controls with custom GLB export, two clearly labeled generated images, and shorter copy.

Verification: browser integration checks passed for original scope, then extended for independent color controls and custom export. Reviewed desktop/mobile screenshots. Independent code review prompted focus restoration and translated accessible labels.

Opening revision: use a deterministic 4 × 6 collage of 24 smaller front/side/rear colorways. Replace hero copy with a single, uniform-size sentence: **prototype** is an e-reader concept by apov. Slim the catalog GLBs from 8.3 mm to 6.2 mm, remove headphone jack geometry, preserve USB-C size, update reference renders, generated photographic concepts, configurations, and displayed specs. Geometry generation verifies a 6.2000003 mm body/glass envelope and a 3.4500000 mm USB-C surround for all three finishes.

Final refinements: rear crown and taper inspired by early iPod touch; 132 mm body height; reduced glass glare; sea-glass default with harmonious random palettes; automatically loaded model starts at a nearly exact side angle tilted to reveal the top key and framed with generous vertical margins. The opening 24-tile grid includes 1800 × 2400 images that expand within the collage area and collapse on click/Escape, restoring keyboard focus. All four Design images use distinct palettes (terracotta/ivory, lilac, navy/gold, sage). Loading retains the poster until the canvas is ready.

Final steering: restore 4 × 6 opening grid and shallow 1.05 mm back crown; use front three-quarter initial view; two initial customization buttons; randomize materials and colors; hidden street-pattern front after 20 randomizations; 8K PNG arrow inside viewer; optional auto rotation; 16 GB fixed storage, EPUB, prototype bookstore, third-party firmware; remove Design and Design files; final five-image community gallery uses generated placeholders including three lifestyle scenes.

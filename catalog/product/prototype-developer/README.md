# prototype developer edition

Separate static product preview at `/catalog/product/prototype-developer/`. Black page; deep neutral-gray frame, panel and back calibrated to the displayed e-ink dark gray. Entry link from the regular prototype page. Uses shared developer model/viewer assets in `../prototype/`.

Only orbit/zoom and three LED layout previews are provided. All LEDs start off; the first Default option clears them. No appearance configurator or system simulator. Front logo removed; original bottom-right speaker retained; rear lettering reads “developer prototype” with light-gray-filled debossing.

Run `scripts/prototype-developer-page-check.mjs` with PLAYWRIGHT_MODULE and optional BASE_URL to check navigation, separate black layout, default-off LEDs, layout changes, front-view reset, localization and mobile fit. Structural model checks: `python3 scripts/check-prototype-developer.py`. Model generation: `scripts/render-prototype-developer.mjs`.

The developer e-ink display reads “develop your own”; the rear inscription remains “developer prototype”. The screen message is non-emissive, separate from the selectable LED key indicators.

The four options are Default (LEDs off), Side page keys, Bottom page keys, and Custom functions (three side-mounted glyphs). Bottom keys are centered symmetrically beneath the display. Speaker perforations are excluded from LED areas.

Developer-page title is centered with no descriptive paragraph. Default and reset camera are exactly frontal at [0, 0, 0.34]. A plain-text reset control sits inside the viewer; automatic rotation is not provided. The Chinese title is “prototype 开发者版本”.

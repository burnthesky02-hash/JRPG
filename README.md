# JRPG Systems Lab

This workspace uses plain HTML, CSS, and JavaScript loaded through ordered script tags, so it runs without any dependency installs.

## Current System
- Modular character domain model
- Character creator UI
- Canvas preview renderer
- Layer extraction lab for separating hair, face, and clothing
- Coliseum campaign prototype with faction choice and rank progression
- Active Time Battle loop (allies up to 4, enemies up to 6)
- Job system with role-specific skills
- Main character plus 5 recruitable mercenaries
- Basic equipment bonuses, bond growth, and inventory tracking
- Save and load for campaign state (localStorage)
- In-memory roster storage
- Female and male base body model support via image assets
- Layer-ready appearance model for hair, face, and clothing

## Why This Stack
- Zero install and cross-platform (any modern browser)
- Robust 2D support through HTML5 Canvas
- Easy system-by-system composition using namespaced files

## Run
Open `index.html` directly in your browser.

## Appearance Layering
- Base body assets are loaded from `assets/BodyType/female.webp` and `assets/BodyType/male.webp`.
- Hair and clothing now load image assets when an `assetPath` (or `assetPathByBodyType` for clothing) is provided in data.
- Face remains procedural for now, so you can add face art later without schema changes.
- If a layer asset is missing, the renderer falls back to procedural drawing for that layer.
- Creator dropdowns for hair, face, and clothing are filtered by selected body type using `compatibleBodyTypes` and `assetPathByBodyType` metadata.

## Extraction Lab
- Use the Layer Extraction Lab section to load a source character image or capture the current preview canvas.
- Select Hair, Face, or Clothing as the active layer and paint a mask directly on the image.
- Use Erase to refine edges, then export the active layer or all layers as transparent PNG files.

## Coliseum Campaign
- Start as an unaligned mercenary and choose one of three nations, each with different political framing and no explicit "good" side.
- Recruit three fighters from the Coliseum and build a party of up to four.
- Change jobs in the roster panel to adjust combat stats and skill options.
- Enter arena matches with an ATB timeline where ally and enemy gauges fill in real time.
- Save or load campaign progress from the campaign controls.

## Overworld Map
- Tile-based movement system with camera-following viewport and collision.
- Move with WASD or Arrow keys.
- Interact with NPCs and objects using E or the Interact button.
- NPCs cycle dialogue lines and objects can be one-time or repeatable interactions.
- Interaction history is written to the log panel.
- Step through contested districts to trigger random skirmishes that launch the ATB system.
- Map interactions set persistent event flags (notice board, captain warning, observer contract unlock).
- Map supply caches can grant credits directly to campaign state.
- Scene transitions are enabled between the District, Free Company Hall, and Training Yard using portal tiles.
- Spawn points place the player at logical entrances when transitioning scenes.
- Day and night phases rotate as you move, and NPC visibility/schedule can change by phase.

## Next Integration Targets
- Nation-specific contract missions triggered by map interactions
- Relationship and loyalty growth from recruiting and battles
- Inventory and gear rewards from map events and contracts
- Story event system with branching consequences

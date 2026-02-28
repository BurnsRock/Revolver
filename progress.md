Original prompt: I have this GDD, I want to make an MVP using Phaser and typescript

- Parsed GDD from c:\Users\Berna\Downloads\Revolver_Roguelike_GDD.pdf.
- Core MVP target: single turn-based combat encounter with revolver cylinder actions (Fire, Rotate, Spin, Reload), bullet effects, and enemy intent.
- Initialized Vite + TypeScript + Phaser project scaffold in repo root.
- Implemented initial playable loop in src/main.ts:
  - Menu + start flow.
  - Turn-based encounter with Fire/Rotate/Spin/Reload.
  - Bullet effects: standard, explosive(+burn), blank(+guard), piercing, echo, cursed(+junk), junk.
  - Enemy intent telegraph and intent resolution each turn.
  - Deck/draw/discard/cylinder management.
  - Win/lose and restart flow.
  - Hooks: window.render_game_to_text and window.advanceTime.
  - Fullscreen toggle on F and exit fullscreen on Esc.
- Added alternate key bindings for automation compatibility:
  - Rotate: `A` in addition to `R`.
  - Spin: `B` in addition to `S`.
  - Reload: `Up` in addition to `L`.
- Playwright loop executed via skill client with scripted actions in `test-actions.json`.
  - Added local helper script `run_playwright.ps1` to run dev server + client + screenshot capture.
  - Installed Playwright runtime for the skill script under `C:\Users\Berna\.codex\skills\develop-web-game\scripts`.
  - Initial screenshots were black in headless mode with WebGL; fixed by switching Phaser renderer to `Phaser.CANVAS`.
  - Current screenshots in `output/web-game/shot-*.png` show correct UI/state progression.
  - `state-*.json` values align with visible HUD and logs.
  - No `errors-*.json` generated (no captured console/runtime errors in the run).
- `npm run build` succeeds after all changes.

TODOs / suggestions:
- Add at least one second enemy archetype and simple run-to-run progression hook (even placeholder unlock flag).
- Add light balancing pass (current default scripted sequence often ends in defeat quickly).
- Add unit-style logic tests for deck/cylinder transitions (fire/rotate/spin/reload edge cases).

- Refactor: consolidated encounter starting stats into one STARTING_STATS config in src/main.ts; both field initialization and startRun() now read from the same source of truth (no duplicated HP literals).
- Validation: npx tsc --noEmit passes after the refactor.
- Validation: ran ./run_playwright.ps1; reviewed output/web-game/shot-0.png..shot-3.png and state-0.json..state-3.json; HUD and render_game_to_text values stayed aligned.

- Refactor: split monolithic src/main.ts into modular files:
  - src/game/types.ts (shared domain types)
  - src/game/constants.ts (stats, labels, intents, deck setup, dimensions)
  - src/game/RevolverScene.ts (all scene/gameplay logic)
  - src/game/bootstrap.ts (Phaser config + scene lookup)
  - src/main.ts now only wires CSS + game bootstrap + window hooks.
- Validation: npx tsc --noEmit passes.
- Validation: npm run build passes.
- Validation: ran ./run_playwright.ps1 and reviewed output/web-game/shot-0.png..shot-3.png plus state-0.json..state-3.json; gameplay flow and render_game_to_text stayed consistent.

- Refactor: replaced the Phaser-owned combat logic with an engine-agnostic core in `src/core/`.
  - Added pure modules for types, seeded RNG, deck handling, cylinder handling, enemy content, bullet content, and `stepCombat(state, action)`.
  - Added enemy roster: Rat Swarm, Riot Droid, Sniper, Drone.
  - Added matchup-specific ammo rules: Birdshot, Buckshot, Slug, Armor Piercing, Flechette, Blank.
- UI rewrite: replaced `RevolverScene` with `CombatScene`.
  - Scene now renders the 6 chambers, highlights the current chamber, shows intent/tags, enemy-specific metrics, deck counts, and combat log.
  - Added encounter hotkeys `1-4` for fast switching between enemy archetypes.
  - Keyboard loop now matches the requested control scheme: `F/R/S/L`.
- Validation prep:
  - Added deterministic tests in `src/core/resolve.test.ts`.
  - Added `vitest` to devDependencies and `npm test` script.
  - Updated `test-actions.json` to drive the new input scheme during Playwright runs.

TODOs / suggestions:
- Run the new Playwright loop and inspect the refreshed screenshots/state dumps against the new combat scene.
- Consider adding a tiny encounter selector overlay or run progression layer if this prototype grows beyond isolated matchup demos.

- Validation:
  - `npm test` passes with 3 deterministic matchup tests in `src/core/resolve.test.ts`.
  - `npm run build` passes after the refactor to the new core + `CombatScene`.
  - Ran `./run_playwright.ps1` against the new scene and reviewed `output/web-game/shot-0.png` plus `state-0.json` through `state-3.json`.
  - The browser booted into `CombatScene`, the automated action burst advanced combat state, and the rendered HUD matched `render_game_to_text`.
  - Restored automation aliases (`Space`, `A`, `B`, `Up`) in addition to the requested `F/R/S/L` controls because the local Playwright client only synthesizes a limited key set.

Remaining note:
- Vite still warns about the Phaser bundle exceeding the chunk-size threshold during production builds; this is only a warning and does not block the prototype.

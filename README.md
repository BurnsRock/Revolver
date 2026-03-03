# Revolver

Phaser + TypeScript prototype for a turn-based roguelike combat system built around a 6-chamber revolver deck.

## Run

```bash
npm install
npm run dev
```

## Gameplay Loop

Each turn the enemy telegraphs its next move. You choose exactly one revolver action, then the enemy resolves.

- `FIRE`: shoot the current chamber.
- `ROTATE`: advance to the next chamber.
- `SPIN`: rotate the cylinder a random 19 to 24 chambers.
- `RELOAD`: dump live rounds, draw 6 fresh bullets, and refill the cylinder.
- Consecutive offensive shots build combo, increasing the next offensive shot by up to `+3`. Blank shots, dry fires, and non-fire actions break the combo.
- Firing 3 or more live rounds back-to-back builds heat: shot 3 burns for 1, shot 4 for 2, shot 5 for 3, and shot 6 overheats the gun hard enough to skip your next turn.
- After each non-final victory you enter a shop, spend credits on accessories, then continue the run.

The pure combat rules live under `src/core/`. Phaser in `src/game/CombatScene.ts` only renders state, logs, and input.

## Controls

- `F`: Fire
- `R`: Rotate
- `S`: Spin
- `L`: Reload
- `1` `2` `3` `4`: Load Rat Swarm / Riot Droid / Sniper / Drone
- `1` `2` `3` in shop: Buy an accessory
- `Enter`: Start from menu, continue after a win/shop, or restart the run after a loss/final clear
- `START` / `CONTINUE` / `RESTART` buttons: touch-friendly menu, shop, death, and final-victory flow
- `X`: Toggle fullscreen
- `Esc`: Exit fullscreen

## Adding Content

Bullets:
- Add the bullet definition to `src/core/content/bullets.ts`.
- Extend the bullet resolution branch in `src/core/resolve.ts`.
- The Phaser scene reads bullet labels from the bullet definitions automatically.

Enemies:
- Add a new enemy state shape to `src/core/types.ts` if it needs custom fields.
- Add its behavior definition in `src/core/content/enemies.ts`.
- Add the new enemy id to `ENEMY_ORDER` so the scene can load it.

Accessories:
- Add the accessory definition to `src/core/content/accessories.ts`.
- Apply its combat effect in `src/core/resolve.ts`.
- The shop reads labels, prices, and descriptions from the accessory definitions automatically.

Tests:
- Deterministic combat tests live in `src/core/resolve.test.ts`.
- Run `npm test` to verify key matchup incentives.

## Simulation Harness

Run the lightweight combat simulator with:

```bash
npm run sim
```

Optional flags:

```bash
npm run sim -- --runs 10000 --seed 42
npm run sim -- --enemy riot_droid
```

The simulator lives in `src/sim/` and uses the pure `stepCombat()` resolver only. It compares baseline bot policies on win rate, average turns, damage taken, reloads, spins, rotates, and dry-fire clicks.

Add a new policy:
- Create a `SimulationPolicy` in `src/sim/policies.ts`.
- Add it to `SIMULATION_POLICIES`.
- Keep the heuristic local to current cylinder and enemy state.

Add a new metric:
- Extend `FightStats` and `AggregatedStats` in `src/sim/metrics.ts`.
- Collect the per-fight value in `runOneFight()` inside `src/sim/simulate.ts`.
- Add a column in `formatComparisonTable()`.

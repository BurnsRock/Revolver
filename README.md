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
- `SPIN`: reshuffle the remaining cylinder order from the current chamber.
- `RELOAD`: dump live rounds, draw 6 fresh bullets, and refill the cylinder.

The pure combat rules live under `src/core/`. Phaser in `src/game/CombatScene.ts` only renders state, logs, and input.

## Controls

- `F`: Fire
- `R`: Rotate
- `S`: Spin
- `L`: Reload
- `1` `2` `3` `4`: Load Rat Swarm / Riot Droid / Sniper / Drone
- `Enter`: Restart the current encounter
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

Tests:
- Deterministic combat tests live in `src/core/resolve.test.ts`.
- Run `npm test` to verify key matchup incentives.

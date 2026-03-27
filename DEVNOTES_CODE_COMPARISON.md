# DEV_NOTES vs Current Code (March 27, 2026)

This file compares `DEV_NOTES.MD` ideas/status markers against what is implemented in the code right now.

## Current Focus checklist

- **Add more mods (or relics)** → **Partially done**: there is a shop with 8 accessories/mods and unlock-based ammo expansion, but no separate relic system abstraction yet.
- **Enemy Variety** → **Done (expanded)**: there are 9 enemy types with encounter pools and boss selection.
- **More acts** → **Not done**: run progression is a single encounter sequence ending in victory/death with no act/chapter system.
- **Shop remake** → **Done/active**: dedicated shop mode, stock generation, purchase logic, and shop UI are implemented.
- **Ammo selection (deckbuilding)** → **Partially done**: loadout composition is generated from unlocked bullet types, but there is no player-driven pre-fight draft/deck edit flow.
- **Better graphics** → **In progress / subjective**: multiple sprite/audio assets are present, but this is not represented as a tracked gameplay system in code.

## Ideas (Unsorted) status

- **Drone enemies** → **Implemented**.
- **Enemy type matchups (robot, animal, supernatural)** → **Implemented** via enemy category tags (`robotic`, `beast`, `supernatural`, etc.) and bullet matchup logic.
- **Blank reduces heat** → **Implemented conditionally** (works against the Tank encounter path).
- **Silver bullet gauge fills on combo** → **Not found**.
- **Enemy that jams cylinder / boss that spins your revolver** → **Not found as explicit mechanics**.
- **Cold bullets / beer heat reduction relic** → **Not found**.

## Relic ideas vs implemented accessories

Implemented accessory/mod catalog includes:
- `spring_ratchet`
- `quickloader_holster`
- `shock_padding`
- `shotgun_mod`
- `rifle_mod`
- `hunter_mod`
- `bioweapon_mod`
- `pyrotechnics_mod`

Several DEV_NOTES relic ideas overlap conceptually (e.g., rifle/shotgun/hunter-style unlocks), but most named relics in notes (Scope, Laser, Beer, Tactical Vest, etc.) are not implemented as-is.

## Bullet ideas vs implemented bullets

Implemented bullets:
- basic, hollow_point, frangible, birdshot, buckshot, slug
- armor_piercing, flechette, blank
- tranq, mark, seed, pork, flare, explosive

From notes, these are implemented: hollow point, seed bullet, pork, tranq darts, signal flare (as flare), high recoil grants block (partially mirrored by defensive interactions but not named as a separate bullet).

Not clearly implemented from notes: frag hollow (as distinct round), full metal jacket (exactly named), ball net/ensnare.

## Mechanics / MVP statements

- **6 chamber cylinder** → Implemented.
- **Heat system (3+ heat damage, 6 overheat)** → Implemented.
- **Actions FIRE/ROTATE/SPIN/RELOAD** → Implemented.
- **MVP done: 4 ammo types / 4 enemies / 1 boss / shop after each fight**:
  - This appears **outdated** vs current code.
  - Current game has many more than 4 ammo and 4 enemies, and includes two boss candidates.
  - Shop flow is implemented between encounters.

## Problems

- **"fights feel repetitive after turn 4"** remains a design note; no explicit anti-repetition system marker is present in code comments/flags.

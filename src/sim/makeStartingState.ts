import { ENEMY_ORDER } from "../core/content/enemies";
import { STARTER_LOADOUT } from "../core/content/bullets";
import { createCombatState } from "../core/resolve";
import type { BulletType, CombatState, EnemyId } from "../core/types";

export interface StartingStateOptions {
  seed: number;
  enemyId?: EnemyId;
  loadout?: readonly BulletType[];
}

export const getEnemyForRun = (runIndex: number): EnemyId =>
  ENEMY_ORDER[runIndex % ENEMY_ORDER.length] ?? ENEMY_ORDER[0];

export const makeStartingState = ({
  seed,
  enemyId = ENEMY_ORDER[0],
  loadout = STARTER_LOADOUT,
}: StartingStateOptions): CombatState => createCombatState(seed, enemyId, loadout);

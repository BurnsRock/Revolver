import { ENEMY_IDS } from "../core/content/enemies";
import { STARTER_LOADOUT } from "../core/content/bullets";
import { createCombatState } from "../core/resolve";
import type { BulletType, CombatState, EnemyId } from "../core/types";

export interface StartingStateOptions {
  seed: number;
  enemyId?: EnemyId;
  loadout?: readonly BulletType[];
}

export const getEnemyForRun = (runIndex: number): EnemyId =>
  ENEMY_IDS[runIndex % ENEMY_IDS.length] ?? ENEMY_IDS[0];

export const makeStartingState = ({
  seed,
  enemyId = ENEMY_IDS[0],
  loadout = STARTER_LOADOUT,
}: StartingStateOptions): CombatState => createCombatState(seed, enemyId, loadout);

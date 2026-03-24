import { getEnemyIntent, getEnemyStateTags } from "../core/content/enemies";
import type { BulletType, CombatState, PlayerAction } from "../core/types";

export interface SimulationPolicy {
  id: string;
  label: string;
  decide: (state: CombatState) => PlayerAction;
}

const EFFECTIVE_SCORE_THRESHOLD = 3;

export const isLiveRound = (state: CombatState, index: number): boolean =>
  state.cylinder.chambers[index] !== null;

export const hasAnyLiveRound = (state: CombatState): boolean =>
  state.cylinder.chambers.some((round) => round !== null);

export const countEmptyChambers = (state: CombatState): number =>
  state.cylinder.chambers.reduce((total, round) => total + (round === null ? 1 : 0), 0);

const countLiveRounds = (state: CombatState): number => state.cylinder.capacity - countEmptyChambers(state);

const getCurrentRound = (state: CombatState): BulletType | null =>
  state.cylinder.chambers[state.cylinder.currentIndex] ?? null;

const scoreBullet = (state: CombatState, bullet: BulletType): number => {
  const intent = getEnemyIntent(state.enemy);
  const tags = new Set([...getEnemyStateTags(state.enemy), ...intent.tags]);
  const incomingDamage = intent.previewDamage ?? 0;

  switch (bullet) {
    case "basic":
      return 3; // Standard damage
    case "hollow_point":
      if (tags.has("exposed")) {
        return 7.5;
      }
      if (tags.has("armored") || tags.has("shielded")) {
        return 1;
      }
      return 3.5;
    case "frangible":
      if (state.enemy.id === "rat_swarm") {
        return 8;
      }
      if (incomingDamage >= 8) {
        return 3;
      }
      return 2.5;
    case "birdshot":
      if (state.enemy.id === "rat_swarm") {
        return 9;
      }
      if (state.enemy.id === "tank" && !tags.has("exposed")) {
        return 6; // Damage tracks
      }
      if (state.enemy.id === "phantom_gunman" && tags.has("repositioning")) {
        return 5; // Modest during repositioning
      }
      if (tags.has("armored") || tags.has("shielded")) {
        return 0.5;
      }
      return 1.5;
    case "buckshot":
      if (state.enemy.id === "rat_swarm") {
        return 3.5;
      }
      if (state.enemy.id === "sniper" && tags.has("aiming")) {
        return 8.5;
      }
      if (tags.has("charging")) {
        return 9;
      }
      if (tags.has("exposed")) {
        return 8;
      }
      if (tags.has("armored") || tags.has("shielded")) {
        return 2;
      }
      return 4;
    case "slug":
      if (state.enemy.id === "rat_swarm") {
        return 1;
      }
      if (state.enemy.id === "tank" && tags.has("fortified")) {
        return 9; // Best against fortified
      }
      if (state.enemy.id === "phantom_gunman" && tags.has("exposed")) {
        return 9; // Best during exposed
      }
      if (tags.has("evasive")) {
        return 0.5;
      }
      if (tags.has("hover") || tags.has("steady")) {
        return 8;
      }
      return 4.5;
    case "armor_piercing":
      if (tags.has("armored") || tags.has("shielded")) {
        return 8;
      }
      return 2.5;
    case "flechette":
      if (state.enemy.id === "rat_swarm") {
        return state.enemy.infestation > 0 ? 3 : 5;
      }
      if (tags.has("armored") || tags.has("shielded")) {
        return 6.5;
      }
      return 2;
    case "blank":
      if (state.enemy.id === "tank" && tags.has("firing")) {
        return 9; // Block cannon
      }
      if (state.enemy.id === "phantom_gunman" && tags.has("aiming")) {
        return 8; // Interrupt aiming
      }
      if (incomingDamage >= 12) {
        return 7;
      }
      if (incomingDamage >= 8) {
        return 4;
      }
      return 0.25;
    default:
      return 1; // Default score for unhandled bullets
  }
};

const isEffectiveBullet = (state: CombatState, bullet: BulletType): boolean =>
  scoreBullet(state, bullet) >= EFFECTIVE_SCORE_THRESHOLD;

const findBestLiveRound = (
  state: CombatState,
): { index: number | null; score: number } => {
  let bestIndex: number | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  state.cylinder.chambers.forEach((round, index) => {
    if (round === null) {
      return;
    }

    const score = scoreBullet(state, round);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return {
    index: bestIndex,
    score: bestIndex === null ? Number.NEGATIVE_INFINITY : bestScore,
  };
};

const fireOnlyPolicy: SimulationPolicy = {
  id: "fire_only",
  label: "FIRE_ONLY",
  decide: (state) => {
    if (getCurrentRound(state) !== null) {
      return "fire";
    }
    return hasAnyLiveRound(state) ? "rotate" : "reload";
  },
};

const greedyMatchupPolicy: SimulationPolicy = {
  id: "greedy_matchup",
  label: "GREEDY_MATCHUP",
  decide: (state) => {
    if (!hasAnyLiveRound(state)) {
      return "reload";
    }

    const currentRound = getCurrentRound(state);
    const bestRound = findBestLiveRound(state);
    const hasEffectiveTarget =
      bestRound.index !== null && bestRound.score >= EFFECTIVE_SCORE_THRESHOLD;

    if (hasEffectiveTarget && bestRound.index !== state.cylinder.currentIndex) {
      return "rotate";
    }

    if (hasEffectiveTarget && currentRound !== null) {
      return "fire";
    }

    if (currentRound !== null) {
      return "fire";
    }

    return "rotate";
  },
};

const spinHappyPolicy: SimulationPolicy = {
  id: "spin_happy",
  label: "SPIN_HAPPY",
  decide: (state) => {
    if (!hasAnyLiveRound(state) || countLiveRounds(state) <= 1 || countEmptyChambers(state) >= 4) {
      return "reload";
    }

    const currentRound = getCurrentRound(state);
    if (currentRound === null) {
      return "spin";
    }

    return isEffectiveBullet(state, currentRound) ? "fire" : "spin";
  },
};

const reloadSpamPolicy: SimulationPolicy = {
  id: "reload_spam",
  label: "RELOAD_SPAM",
  decide: (state) => {
    const currentRound = getCurrentRound(state);
    if (currentRound !== null && isEffectiveBullet(state, currentRound)) {
      return "fire";
    }
    return "reload";
  },
};

export const SIMULATION_POLICIES: readonly SimulationPolicy[] = [
  fireOnlyPolicy,
  greedyMatchupPolicy,
  spinHappyPolicy,
  reloadSpamPolicy,
];

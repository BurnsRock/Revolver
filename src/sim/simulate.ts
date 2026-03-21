import { stepCombat } from "../core/resolve";
import { normalizeSeed } from "../core/rng";
import type { CombatState, EnemyId, PlayerAction } from "../core/types";
import {
  aggregateFightStats,
  formatComparisonTable,
  formatRunSummary,
  type AggregatedStats,
  type FightStats,
} from "./metrics";
import { getEnemyForRun, makeStartingState } from "./makeStartingState";
import { SIMULATION_POLICIES, type SimulationPolicy } from "./policies";

const DEFAULT_RUNS = 5000;
const DEFAULT_BASE_SEED = 1337;
const MAX_TURNS_PER_FIGHT = 200;
const VALID_ENEMIES: readonly EnemyId[] = ["rat_swarm", "riot_droid", "sniper", "drone", "tank", "phantom_gunman"];
const PROCESS_ARGV =
  (globalThis as typeof globalThis & { process?: { argv?: string[] } }).process?.argv ?? [];

interface SimulationOptions {
  runs: number;
  baseSeed: number;
  enemyId?: EnemyId;
}

const parseOptions = (argv: readonly string[]): SimulationOptions => {
  const options: SimulationOptions = {
    runs: DEFAULT_RUNS,
    baseSeed: DEFAULT_BASE_SEED,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if ((arg === "--runs" || arg === "-n") && next) {
      options.runs = Number.parseInt(next, 10);
      index += 1;
      continue;
    }

    if ((arg === "--seed" || arg === "-s") && next) {
      options.baseSeed = Number.parseInt(next, 10);
      index += 1;
      continue;
    }

    if (arg === "--enemy" && next) {
      if (!VALID_ENEMIES.includes(next as EnemyId)) {
        throw new Error(`Unknown enemy '${next}'. Expected one of: ${VALID_ENEMIES.join(", ")}.`);
      }
      options.enemyId = next as EnemyId;
      index += 1;
    }
  }

  if (!Number.isFinite(options.runs) || options.runs <= 0) {
    throw new Error(`Invalid run count '${options.runs}'. Use a positive integer.`);
  }

  if (!Number.isFinite(options.baseSeed)) {
    throw new Error(`Invalid base seed '${options.baseSeed}'. Use an integer.`);
  }

  return {
    runs: Math.floor(options.runs),
    baseSeed: Math.floor(options.baseSeed),
    enemyId: options.enemyId,
  };
};

const deriveSeedForRun = (baseSeed: number, runIndex: number): number =>
  normalizeSeed((baseSeed + Math.imul(runIndex + 1, 0x9e3779b9)) >>> 0);

const countClicks = (action: PlayerAction, state: CombatState): number => {
  if (action !== "fire") {
    return 0;
  }

  return state.cylinder.chambers[state.cylinder.currentIndex] === null ? 1 : 0;
};

export const runOneFight = (
  policy: SimulationPolicy,
  seed: number,
  enemyId: EnemyId,
): FightStats => {
  let state = makeStartingState({ seed, enemyId });
  let turns = 0;
  let reloads = 0;
  let spins = 0;
  let rotates = 0;
  let clicks = 0;

  while (!state.over && turns < MAX_TURNS_PER_FIGHT) {
    const action = policy.decide(state);

    switch (action) {
      case "reload":
        reloads += 1;
        break;
      case "spin":
        spins += 1;
        break;
      case "rotate":
        rotates += 1;
        break;
      default:
        break;
    }

    clicks += countClicks(action, state);
    const result = stepCombat(state, action);
    state = result.state;
    turns += 1;
  }

  return {
    policyId: policy.id,
    policyLabel: policy.label,
    enemyId,
    seed,
    win: state.outcome === "victory",
    turns,
    damageTaken: state.player.maxHp - state.player.hp,
    reloads,
    spins,
    rotates,
    clicks,
  };
};

export const runMany = (
  policy: SimulationPolicy,
  runs: number,
  baseSeed: number,
  enemyId?: EnemyId,
): { aggregate: AggregatedStats; fights: FightStats[] } => {
  const fights: FightStats[] = [];

  for (let runIndex = 0; runIndex < runs; runIndex += 1) {
    const runSeed = deriveSeedForRun(baseSeed, runIndex);
    const runEnemyId = enemyId ?? getEnemyForRun(runIndex);
    fights.push(runOneFight(policy, runSeed, runEnemyId));
  }

  return {
    fights,
    aggregate: aggregateFightStats(policy.id, policy.label, fights),
  };
};

const aggregateSubset = (policy: SimulationPolicy, fights: readonly FightStats[]): AggregatedStats =>
  aggregateFightStats(policy.id, policy.label, fights);

const main = (): void => {
  const options = parseOptions(PROCESS_ARGV.slice(2));
  const results = SIMULATION_POLICIES.map((policy) =>
    runMany(policy, options.runs, options.baseSeed, options.enemyId),
  );

  const lines = [
    formatRunSummary(options.runs, options.baseSeed, options.enemyId),
    "",
    formatComparisonTable(
      "Overall",
      results.map((result) => result.aggregate),
    ),
  ];

  if (!options.enemyId) {
    for (const enemyId of VALID_ENEMIES) {
      const rows = results
        .map((result, index) =>
          aggregateSubset(
            SIMULATION_POLICIES[index],
            result.fights.filter((fight) => fight.enemyId === enemyId),
          ),
        )
        .filter((row) => row.fights > 0);

      lines.push("");
      lines.push(formatComparisonTable(`Enemy: ${enemyId}`, rows));
    }
  }

  console.log(lines.join("\n"));
};

main();

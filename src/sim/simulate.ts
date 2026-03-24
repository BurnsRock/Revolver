import { ACCESSORY_DEFS } from "../core/content/accessories";
import { ENEMY_IDS } from "../core/content/enemies";
import { stepCombat } from "../core/resolve";
import { normalizeSeed } from "../core/rng";
import type { AccessoryId, CombatState, EnemyId, PlayerAction } from "../core/types";
import { CombatSession } from "../game/CombatSession";
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
const MAX_ACTIONS_PER_RUN = 1200;
const VALID_ENEMIES: readonly EnemyId[] = ENEMY_IDS;
const PROCESS_ARGV =
  (globalThis as typeof globalThis & { process?: { argv?: string[] } }).process?.argv ?? [];

interface SimulationOptions {
  runs: number;
  baseSeed: number;
  enemyId?: EnemyId;
}

interface RunStats {
  policyId: string;
  policyLabel: string;
  seed: number;
  win: boolean;
  floorsCleared: number;
  boughtCount: number;
  creditsSpent: number;
  boughtByAccessory: Record<AccessoryId, number>;
  boughtAccessories: AccessoryId[];
}

interface AggregatedRunStats {
  policyLabel: string;
  runs: number;
  winRate: number;
  avgFloorsCleared: number;
  avgBought: number;
  avgCreditsSpent: number;
  boughtByAccessory: Record<AccessoryId, number>;
}

interface ComboAggregate {
  comboKey: string;
  runs: number;
  winRate: number;
  avgFloors: number;
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

const nextRandom = (seed: number): { seed: number; value: number } => {
  const nextSeed = normalizeSeed((Math.imul(seed, 1664525) + 1013904223) >>> 0);
  return {
    seed: nextSeed,
    value: nextSeed / 0xffffffff,
  };
};

const countClicks = (action: PlayerAction, state: CombatState): number => {
  if (action !== "fire") {
    return 0;
  }

  return state.cylinder.chambers[state.cylinder.currentIndex] === null ? 1 : 0;
};

const selectLowestHpTarget = (state: CombatState): number => {
  let bestIndex = 0;
  let bestHp = Number.POSITIVE_INFINITY;

  state.enemies.forEach((enemy, index) => {
    const down = enemy.id === "rat_swarm" ? enemy.stacks <= 0 : enemy.hp <= 0;
    if (down) {
      return;
    }

    if (enemy.hp < bestHp) {
      bestHp = enemy.hp;
      bestIndex = index;
    }
  });

  return bestIndex;
};

const formatRunBalanceTable = (rows: readonly AggregatedRunStats[]): string => {
  const headers = [
    { label: "Policy", width: 16 },
    { label: "Run Win %", width: 10 },
    { label: "Avg Floors", width: 10 },
    { label: "Avg Buys", width: 9 },
    { label: "Avg Spend", width: 10 },
  ] as const;

  const pad = (value: string, width: number): string => value.padEnd(width, " ");
  const divider = headers.map((header) => "-".repeat(header.width)).join(" ");
  const headerLine = headers.map((header) => pad(header.label, header.width)).join(" ");
  const body = rows
    .map((row) =>
      [
        pad(row.policyLabel, headers[0].width),
        pad(row.winRate.toFixed(2), headers[1].width),
        pad(row.avgFloorsCleared.toFixed(2), headers[2].width),
        pad(row.avgBought.toFixed(2), headers[3].width),
        pad(row.avgCreditsSpent.toFixed(2), headers[4].width),
      ].join(" "),
    )
    .join("\n");

  return ["Run progression + random shop buys", headerLine, divider, body].join("\n");
};

const formatAccessoryPurchaseTable = (rows: readonly AggregatedRunStats[]): string => {
  const accessoryIds = Object.keys(ACCESSORY_DEFS) as AccessoryId[];
  const policyWidth = 16;
  const accessoryWidth = 22;

  const header = ["Policy".padEnd(policyWidth, " "), ...accessoryIds.map((id) => ACCESSORY_DEFS[id].label.padEnd(accessoryWidth, " "))].join(" ");
  const divider = "-".repeat(header.length);

  const body = rows
    .map((row) => {
      const perRun = accessoryIds.map((id) => (row.boughtByAccessory[id] / Math.max(1, row.runs)).toFixed(2));
      return [
        row.policyLabel.padEnd(policyWidth, " "),
        ...perRun.map((value) => value.padEnd(accessoryWidth, " ")),
      ].join(" ");
    })
    .join("\n");

  return ["Average purchases per run by accessory", header, divider, body].join("\n");
};

const aggregateRunStats = (policyLabel: string, runs: readonly RunStats[]): AggregatedRunStats => {
  const boughtByAccessory = Object.keys(ACCESSORY_DEFS).reduce(
    (record, accessoryId) => ({
      ...record,
      [accessoryId]: 0,
    }),
    {} as Record<AccessoryId, number>,
  );

  let wins = 0;
  let floorsCleared = 0;
  let boughtCount = 0;
  let creditsSpent = 0;

  runs.forEach((run) => {
    if (run.win) {
      wins += 1;
    }
    floorsCleared += run.floorsCleared;
    boughtCount += run.boughtCount;
    creditsSpent += run.creditsSpent;
    (Object.keys(run.boughtByAccessory) as AccessoryId[]).forEach((accessoryId) => {
      boughtByAccessory[accessoryId] += run.boughtByAccessory[accessoryId];
    });
  });

  const count = Math.max(1, runs.length);
  return {
    policyLabel,
    runs: runs.length,
    winRate: (wins * 100) / count,
    avgFloorsCleared: floorsCleared / count,
    avgBought: boughtCount / count,
    avgCreditsSpent: creditsSpent / count,
    boughtByAccessory,
  };
};

const toComboKey = (accessories: readonly AccessoryId[]): string =>
  accessories.length === 0
    ? "(none)"
    : [...accessories]
        .sort((left, right) => ACCESSORY_DEFS[left].label.localeCompare(ACCESSORY_DEFS[right].label))
        .map((id) => ACCESSORY_DEFS[id].label)
        .join(" + ");

const aggregateComboRows = (
  runs: readonly RunStats[],
  minRuns: number,
  top: number,
): ComboAggregate[] => {
  const byCombo = new Map<string, { runs: number; wins: number; floors: number }>();

  runs.forEach((run) => {
    const uniqueAccessories = Array.from(new Set(run.boughtAccessories));
    const key = toComboKey(uniqueAccessories);
    const existing = byCombo.get(key) ?? { runs: 0, wins: 0, floors: 0 };
    existing.runs += 1;
    existing.wins += run.win ? 1 : 0;
    existing.floors += run.floorsCleared;
    byCombo.set(key, existing);
  });

  return [...byCombo.entries()]
    .filter(([, row]) => row.runs >= minRuns)
    .map(([comboKey, row]) => ({
      comboKey,
      runs: row.runs,
      winRate: (row.wins * 100) / Math.max(1, row.runs),
      avgFloors: row.floors / Math.max(1, row.runs),
    }))
    .sort((left, right) => {
      if (right.winRate !== left.winRate) {
        return right.winRate - left.winRate;
      }
      return right.runs - left.runs;
    })
    .slice(0, top);
};

const formatComboTable = (policyLabel: string, rows: readonly ComboAggregate[]): string => {
  const headers = [
    { label: "Combination", width: 58 },
    { label: "Runs", width: 7 },
    { label: "Win %", width: 8 },
    { label: "Avg Floors", width: 10 },
  ] as const;
  const pad = (value: string, width: number): string => value.padEnd(width, " ");
  const divider = headers.map((header) => "-".repeat(header.width)).join(" ");
  const headerLine = headers.map((header) => pad(header.label, header.width)).join(" ");
  const body = rows.length
    ? rows
        .map((row) =>
          [
            pad(row.comboKey, headers[0].width),
            pad(String(row.runs), headers[1].width),
            pad(row.winRate.toFixed(2), headers[2].width),
            pad(row.avgFloors.toFixed(2), headers[3].width),
          ].join(" "),
        )
        .join("\n")
    : "(no combinations met minimum sample)";

  return [`Top mod combinations (${policyLabel})`, headerLine, divider, body].join("\n");
};

const formatVarietyTable = (policyLabel: string, runs: readonly RunStats[]): string => {
  const buckets = new Map<number, { runs: number; wins: number; floors: number }>();

  runs.forEach((run) => {
    const uniqueCount = new Set(run.boughtAccessories).size;
    const bucket = buckets.get(uniqueCount) ?? { runs: 0, wins: 0, floors: 0 };
    bucket.runs += 1;
    bucket.wins += run.win ? 1 : 0;
    bucket.floors += run.floorsCleared;
    buckets.set(uniqueCount, bucket);
  });

  const rows = [...buckets.entries()].sort(([left], [right]) => left - right);
  const header = "Unique mods bought  Runs   Win %   Avg Floors";
  const divider = "-".repeat(header.length);
  const body = rows
    .map(([uniqueCount, row]) => {
      const runsCount = Math.max(1, row.runs);
      return `${String(uniqueCount).padEnd(19, " ")}${String(row.runs).padEnd(7, " ")}${((row.wins * 100) / runsCount)
        .toFixed(2)
        .padEnd(8, " ")}${(row.floors / runsCount).toFixed(2)}`;
    })
    .join("\n");

  return [`Consistency vs flexibility (${policyLabel})`, header, divider, body].join("\n");
};

const buyRandomShopItem = (session: CombatSession, seed: number): { seed: number; bought: AccessoryId[]; spent: number } => {
  const stock = session.getShopStock();
  const affordable = stock
    .map((accessoryId, index) => ({ accessoryId, index }))
    .filter(({ accessoryId }) => accessoryId !== null)
    .filter(({ accessoryId }) => {
      if (!accessoryId) {
        return false;
      }
      return ACCESSORY_DEFS[accessoryId].price <= session.getMoney();
    }) as Array<{ accessoryId: AccessoryId; index: number }>;

  if (affordable.length === 0) {
    return { seed, bought: [], spent: 0 };
  }

  const roll = nextRandom(seed);
  const chosen = affordable[Math.floor(roll.value * affordable.length)] ?? affordable[0];
  const price = ACCESSORY_DEFS[chosen.accessoryId].price;
  session.buyShopAccessory(chosen.index);

  const buyAgainRoll = nextRandom(roll.seed);
  if (buyAgainRoll.value < 0.35) {
    const secondPass = buyRandomShopItem(session, buyAgainRoll.seed);
    return {
      seed: secondPass.seed,
      bought: [chosen.accessoryId, ...secondPass.bought],
      spent: price + secondPass.spent,
    };
  }

  return {
    seed: buyAgainRoll.seed,
    bought: [chosen.accessoryId],
    spent: price,
  };
};

const runOneRun = (policy: SimulationPolicy, seed: number): RunStats => {
  const session = new CombatSession();
  let randomSeed = seed;
  let boughtCount = 0;
  let creditsSpent = 0;
  const boughtByAccessory = Object.keys(ACCESSORY_DEFS).reduce(
    (record, accessoryId) => ({
      ...record,
      [accessoryId]: 0,
    }),
    {} as Record<AccessoryId, number>,
  );
  const boughtAccessories: AccessoryId[] = [];

  session.startRun();
  let actionsTaken = 0;

  while ((session.getMode() === "combat" || session.getMode() === "shop") && actionsTaken < MAX_ACTIONS_PER_RUN) {
    if (session.getMode() === "shop") {
      const purchase = buyRandomShopItem(session, randomSeed);
      randomSeed = purchase.seed;
      boughtCount += purchase.bought.length;
      creditsSpent += purchase.spent;
      purchase.bought.forEach((accessoryId) => {
        boughtByAccessory[accessoryId] += 1;
        boughtAccessories.push(accessoryId);
      });
      session.leaveShop();
      actionsTaken += 1;
      continue;
    }

    const targetIndex = selectLowestHpTarget(session.getState());
    session.setSelectedEnemy(targetIndex);
    const action = policy.decide(session.getState());
    session.performAction(action);
    actionsTaken += 1;
  }

  const floorsCleared = session.getMode() === "victory" ? 8 : session.getEncounterIndex() + 1;

  return {
    policyId: policy.id,
    policyLabel: policy.label,
    seed,
    win: session.getMode() === "victory",
    floorsCleared,
    boughtCount,
    creditsSpent,
    boughtByAccessory,
    boughtAccessories,
  };
};

const runManyRuns = (
  policy: SimulationPolicy,
  runs: number,
  baseSeed: number,
): { aggregate: AggregatedRunStats; runs: RunStats[] } => {
  const runStats: RunStats[] = [];

  for (let runIndex = 0; runIndex < runs; runIndex += 1) {
    const runSeed = deriveSeedForRun(baseSeed ^ 0x6d2b79f5, runIndex);
    runStats.push(runOneRun(policy, runSeed));
  }

  return {
    aggregate: aggregateRunStats(policy.label, runStats),
    runs: runStats,
  };
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
  const runResults = SIMULATION_POLICIES.map((policy) => runManyRuns(policy, options.runs, options.baseSeed));

  const lines = [
    formatRunSummary(options.runs, options.baseSeed, options.enemyId),
    "",
    formatComparisonTable(
      "Overall",
      results.map((result) => result.aggregate),
    ),
    "",
    formatRunBalanceTable(runResults.map((result) => result.aggregate)),
    "",
    formatAccessoryPurchaseTable(runResults.map((result) => result.aggregate)),
  ];

  runResults.forEach((result, index) => {
    lines.push("");
    lines.push(formatVarietyTable(SIMULATION_POLICIES[index].label, result.runs));
    lines.push("");
    lines.push(formatComboTable(SIMULATION_POLICIES[index].label, aggregateComboRows(result.runs, 8, 10)));
  });

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

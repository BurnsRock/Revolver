import type { EnemyId } from "../core/types";

export interface FightStats {
  policyId: string;
  policyLabel: string;
  enemyId: EnemyId;
  seed: number;
  win: boolean;
  turns: number;
  damageTaken: number;
  reloads: number;
  spins: number;
  rotates: number;
  clicks: number;
}

export interface AggregatedStats {
  policyId: string;
  policyLabel: string;
  fights: number;
  wins: number;
  winRate: number;
  avgTurns: number;
  avgDamageTaken: number;
  avgReloads: number;
  avgSpins: number;
  avgRotates: number;
  avgClicks: number;
}

const average = (total: number, count: number): number => (count === 0 ? 0 : total / count);

const sumBy = (fights: readonly FightStats[], selector: (fight: FightStats) => number): number =>
  fights.reduce((total, fight) => total + selector(fight), 0);

export const aggregateFightStats = (
  policyId: string,
  policyLabel: string,
  fights: readonly FightStats[],
): AggregatedStats => {
  const wins = fights.filter((fight) => fight.win).length;

  return {
    policyId,
    policyLabel,
    fights: fights.length,
    wins,
    winRate: average(wins * 100, fights.length),
    avgTurns: average(sumBy(fights, (fight) => fight.turns), fights.length),
    avgDamageTaken: average(sumBy(fights, (fight) => fight.damageTaken), fights.length),
    avgReloads: average(sumBy(fights, (fight) => fight.reloads), fights.length),
    avgSpins: average(sumBy(fights, (fight) => fight.spins), fights.length),
    avgRotates: average(sumBy(fights, (fight) => fight.rotates), fights.length),
    avgClicks: average(sumBy(fights, (fight) => fight.clicks), fights.length),
  };
};

const formatDecimal = (value: number): string => value.toFixed(2);

const pad = (value: string, width: number): string => value.padEnd(width, " ");

export const formatComparisonTable = (
  title: string,
  rows: readonly AggregatedStats[],
): string => {
  const headers = [
    { label: "Policy", width: 16 },
    { label: "Win %", width: 8 },
    { label: "Avg Turns", width: 11 },
    { label: "Dmg Taken", width: 11 },
    { label: "Reloads", width: 9 },
    { label: "Spins", width: 8 },
    { label: "Rotates", width: 9 },
    { label: "Clicks", width: 8 },
  ] as const;

  const divider = headers.map((header) => "-".repeat(header.width)).join(" ");
  const headerLine = headers.map((header) => pad(header.label, header.width)).join(" ");
  const body = rows
    .map((row) =>
      [
        pad(row.policyLabel, headers[0].width),
        pad(formatDecimal(row.winRate), headers[1].width),
        pad(formatDecimal(row.avgTurns), headers[2].width),
        pad(formatDecimal(row.avgDamageTaken), headers[3].width),
        pad(formatDecimal(row.avgReloads), headers[4].width),
        pad(formatDecimal(row.avgSpins), headers[5].width),
        pad(formatDecimal(row.avgRotates), headers[6].width),
        pad(formatDecimal(row.avgClicks), headers[7].width),
      ].join(" "),
    )
    .join("\n");

  return [title, headerLine, divider, body].join("\n");
};

export const formatRunSummary = (
  runs: number,
  baseSeed: number,
  enemyId?: EnemyId,
): string =>
  [`Runs per policy: ${runs}`, `Base seed: ${baseSeed}`, `Enemy set: ${enemyId ?? "all_enemies_cycle"}`].join(
    " | ",
  );

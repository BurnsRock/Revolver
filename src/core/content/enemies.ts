import type {
  CombatState,
  EnemyDef,
  EnemyId,
  EnemyIntentView,
  EnemyState,
  EnemyTag,
  EventSink,
  RatSwarmState,
  RiotDroidState,
  SniperState,
  DroneState,
} from "../types";

const emitLog = (emit: EventSink, text: string): void => {
  emit({ type: "log", text });
};

const damagePlayer = (
  state: CombatState,
  amount: number,
  source: string,
  emit: EventSink,
): void => {
  const blocked = Math.min(state.player.guard, amount);
  const applied = Math.max(0, amount - blocked);
  state.player.guard -= blocked;
  state.player.hp = Math.max(0, state.player.hp - applied);
  emit({
    type: "player_damaged",
    amount: applied,
    blocked,
    remainingHp: state.player.hp,
    source,
  });
  if (blocked > 0) {
    emitLog(emit, `Guard absorbs ${blocked} from ${source}.`);
  }
  emitLog(emit, `${source} hits for ${applied}.`);
};

const ratSwarmDef: EnemyDef<RatSwarmState> = {
  id: "rat_swarm",
  label: "Rat Swarm",
  description: "A carpet of bodies that snowballs if left alone.",
  createState: () => ({
    id: "rat_swarm",
    label: "Rat Swarm",
    hp: 6,
    maxHp: 6,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
    stacks: 6,
    infestation: 0,
  }),
  getIntent: (enemy) => {
    switch (enemy.cycleIndex % 3) {
      case 0:
        return {
          id: "scurry",
          label: "SCURRY",
          detail: "Nibble for 2.",
          tags: ["swarm"],
          previewDamage: 2,
        };
      case 1:
        return {
          id: "multiply",
          label: "MULTIPLY",
          detail: "Add 2 stacks.",
          tags: ["swarm"],
        };
      default:
        return {
          id: "swarm_attack",
          label: "SWARM_ATTACK",
          detail: `Attack for ${Math.max(4, enemy.stacks + 1)}.`,
          tags: ["swarm"],
          previewDamage: Math.max(4, enemy.stacks + 1),
        };
    }
  },
  getTags: () => ["swarm"],
  onTurnStart: (_state, enemy, emit) => {
    if (enemy.infestation <= 0 || enemy.stacks <= 0) {
      return;
    }

    enemy.infestation -= 1;
    enemy.stacks = Math.max(0, enemy.stacks - 1);
    enemy.hp = enemy.stacks;
    emit({
      type: "status_applied",
      target: "enemy",
      status: "infestation_tick",
      amount: 1,
      total: enemy.infestation,
    });
    emitLog(emit, "Infestation drops 1 swarm stack.");
  },
  act: (state, enemy, emit) => {
    switch (enemy.cycleIndex % 3) {
      case 0:
        damagePlayer(state, 2, "Rat Scurry", emit);
        break;
      case 1:
        enemy.stacks += 2;
        enemy.hp = enemy.stacks;
        enemy.maxHp = Math.max(enemy.maxHp, enemy.stacks);
        emitLog(emit, "The swarm multiplies by 2 stacks.");
        break;
      default:
        damagePlayer(state, Math.max(4, enemy.stacks + 1), "Swarm Attack", emit);
        break;
    }

    enemy.cycleIndex = (enemy.cycleIndex + 1) % 3;
  },
};

const riotDroidDef: EnemyDef<RiotDroidState> = {
  id: "riot_droid",
  label: "Riot Droid",
  description: "Heavy plating, predictable shield cycle, dangerous baton follow-through.",
  createState: () => ({
    id: "riot_droid",
    label: "Riot Droid",
    hp: 30,
    maxHp: 30,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
  }),
  getIntent: (enemy) => {
    switch (enemy.cycleIndex % 4) {
      case 0:
        return {
          id: "shield_up",
          label: "SHIELD_UP",
          detail: "Gain 6 armor.",
          tags: enemy.armor > 0 ? ["armored", "shielded"] : [],
        };
      case 1:
        return {
          id: "advance",
          label: "ADVANCE",
          detail: "Wind up a baton strike.",
          tags: [
            "charging",
            ...(enemy.armor > 0 ? (["armored", "shielded"] as EnemyTag[]) : []),
          ],
        };
      case 2:
        return {
          id: "baton_strike",
          label: "BATON_STRIKE",
          detail: "Hit for 12.",
          tags: enemy.armor > 0 ? ["armored", "shielded"] : [],
          previewDamage: 12,
        };
      default:
        return {
          id: "cooldown",
          label: "COOLDOWN",
          detail: "Expose the core and drop armor.",
          tags: ["exposed", ...(enemy.armor > 0 ? (["armored"] as EnemyTag[]) : [])],
        };
    }
  },
  getTags: (enemy) => {
    const tags: EnemyTag[] = [];
    if (enemy.armor > 0) {
      tags.push("armored", "shielded");
    }
    if (enemy.cycleIndex % 4 === 1) {
      tags.push("charging");
    }
    if (enemy.cycleIndex % 4 === 3) {
      tags.push("exposed");
    }
    return tags;
  },
  act: (state, enemy, emit) => {
    switch (enemy.cycleIndex % 4) {
      case 0:
        enemy.armor += 6;
        emitLog(emit, "Riot Droid raises a 6-point shield.");
        break;
      case 1:
        emitLog(emit, "Riot Droid advances, winding up the baton.");
        break;
      case 2:
        damagePlayer(state, 12, "Baton Strike", emit);
        break;
      default:
        enemy.armor = 0;
        emitLog(emit, "Riot Droid vents heat and drops its armor.");
        break;
    }

    enemy.cycleIndex = (enemy.cycleIndex + 1) % 4;
  },
};

const sniperDef: EnemyDef<SniperState> = {
  id: "sniper",
  label: "Sniper",
  description: "Two turns of aim followed by a lethal shot unless you break the line.",
  createState: () => ({
    id: "sniper",
    label: "Sniper",
    hp: 18,
    maxHp: 18,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
    interrupted: false,
  }),
  getIntent: (enemy) => {
    switch (enemy.cycleIndex % 3) {
      case 0:
        return {
          id: "aim_1",
          label: "AIM",
          detail: "Acquire the target.",
          tags: ["aiming"],
        };
      case 1:
        return {
          id: "aim_2",
          label: "AIM",
          detail: "Hold the sightline.",
          tags: ["aiming"],
        };
      default:
        return {
          id: "headshot",
          label: "HEADSHOT",
          detail: "Deal 14.",
          tags: ["aiming"],
          previewDamage: 14,
        };
    }
  },
  getTags: () => ["aiming"],
  act: (state, enemy, emit) => {
    if (enemy.interrupted) {
      enemy.interrupted = false;
      enemy.cycleIndex = 0;
      emitLog(emit, "Sniper loses the line and must reacquire the shot.");
      return;
    }

    switch (enemy.cycleIndex % 3) {
      case 0:
        emitLog(emit, "Sniper starts lining up the shot.");
        break;
      case 1:
        emitLog(emit, "Sniper settles into a second aim.");
        break;
      default:
        damagePlayer(state, 14, "Headshot", emit);
        break;
    }

    enemy.cycleIndex = (enemy.cycleIndex + 1) % 3;
  },
};

const droneDef: EnemyDef<DroneState> = {
  id: "drone",
  label: "Drone",
  description: "Alternates between a clean hover window and evasive flight before firing.",
  createState: () => ({
    id: "drone",
    label: "Drone",
    hp: 24,
    maxHp: 24,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
  }),
  getIntent: (enemy) => {
    switch (enemy.cycleIndex % 4) {
      case 0:
        return {
          id: "hover",
          label: "HOVER",
          detail: "Stabilize in the open.",
          tags: ["hover", "steady"],
        };
      case 1:
        return {
          id: "evasive",
          label: "EVASIVE",
          detail: "Jink into cover.",
          tags: ["evasive"],
        };
      case 2:
        return {
          id: "laser",
          label: "LASER",
          detail: "Fire for 8.",
          tags: [],
          previewDamage: 8,
        };
      default:
        return {
          id: "recharge",
          label: "RECHARGE",
          detail: "Reset capacitors.",
          tags: ["exposed"],
        };
    }
  },
  getTags: (enemy) => {
    switch (enemy.cycleIndex % 4) {
      case 0:
        return ["hover", "steady"];
      case 1:
        return ["evasive"];
      case 3:
        return ["exposed"];
      default:
        return [];
    }
  },
  act: (state, enemy, emit) => {
    switch (enemy.cycleIndex % 4) {
      case 0:
        emitLog(emit, "Drone hovers in place.");
        break;
      case 1:
        emitLog(emit, "Drone jukes sideways into evasive flight.");
        break;
      case 2:
        damagePlayer(state, 8, "Laser", emit);
        break;
      default:
        emitLog(emit, "Drone recharges and exposes its frame.");
        break;
    }

    enemy.cycleIndex = (enemy.cycleIndex + 1) % 4;
  },
};

export const ENEMY_ORDER: EnemyId[] = [
  "rat_swarm",
  "riot_droid",
  "sniper",
  "drone",
];

export const createEnemyState = (enemyId: EnemyId): EnemyState => {
  switch (enemyId) {
    case "rat_swarm":
      return ratSwarmDef.createState();
    case "riot_droid":
      return riotDroidDef.createState();
    case "sniper":
      return sniperDef.createState();
    case "drone":
      return droneDef.createState();
  }
};

export const getEnemyDef = <TEnemy extends EnemyState>(enemy: TEnemy): EnemyDef<TEnemy> => {
  switch (enemy.id) {
    case "rat_swarm":
      return ratSwarmDef as unknown as EnemyDef<TEnemy>;
    case "riot_droid":
      return riotDroidDef as unknown as EnemyDef<TEnemy>;
    case "sniper":
      return sniperDef as unknown as EnemyDef<TEnemy>;
    case "drone":
      return droneDef as unknown as EnemyDef<TEnemy>;
  }
};

export const getEnemyIntent = (enemy: EnemyState): EnemyIntentView =>
  getEnemyDef(enemy).getIntent(enemy);

export const getEnemyTags = (enemy: EnemyState): EnemyTag[] => getEnemyDef(enemy).getTags(enemy);

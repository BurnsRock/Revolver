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
  TankState,
  PhantomGunmanState,
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
    infestation: 0,    stun: 0,
    marked: false,
    porked: false,
    burn: 0,  }),
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
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
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
    interrupted: false,    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,  }),
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
    cycleIndex: 0,    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,  }),
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

const tankDef: EnemyDef<TankState> = {
  id: "tank",
  label: "A FUCKING TANK",
  description: "A heavily armored tank-like boss with a devastating cannon. Forces strategic ammo use and timing.",
  createState: () => ({
    id: "tank",
    label: "A FUCKING TANK",
    hp: 25,
    maxHp: 25,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
    tracksDamaged: 0,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => {
    switch (enemy.cycleIndex % 4) {
      case 0:
        return {
          id: "fortify",
          label: "FORTIFIED",
          detail: "Heavy armor plating deployed.",
          tags: ["armored", "fortified"],
        };
      case 1:
        return {
          id: "aim_cannon",
          label: "AIMING",
          detail: "Cannon locks onto target.",
          tags: ["aiming"],
        };
      case 2:
        return {
          id: "fire_cannon",
          label: "FIRING",
          detail: "Cannon unleashes devastating blast.",
          tags: ["firing"],
          previewDamage: 10,
        };
      default:
        return {
          id: "exposed",
          label: "EXPOSED",
          detail: "Vents heat, armor retracted.",
          tags: ["exposed"],
        };
    }
  },
  getTags: (enemy) => {
    const tags: EnemyTag[] = [];
    if (enemy.cycleIndex % 4 === 0) {
      tags.push("armored", "fortified");
    }
    if (enemy.cycleIndex % 4 === 1) {
      tags.push("aiming");
    }
    if (enemy.cycleIndex % 4 === 2) {
      tags.push("firing");
    }
    if (enemy.cycleIndex % 4 === 3) {
      tags.push("exposed");
    }
    return tags;
  },
  onTurnStart: (state, enemy, emit) => {
    // Set armor based on state
    if (enemy.cycleIndex % 4 === 0) {
      enemy.armor = 8; // High armor when fortified
      emitLog(emit, enemy.label + enemy.label + " braces behind reinforced armor.");
    } else if (enemy.cycleIndex % 4 === 3) {
      enemy.armor = 0; // No armor when exposed
      emitLog(emit, enemy.label + enemy.label + " is exposed!");
    } else {
      enemy.armor = 4; // Moderate armor otherwise
    }
  },
  act: (state, enemy, emit) => {
    switch (enemy.cycleIndex % 4) {
      case 0:
        emitLog(emit, enemy.label + enemy.label + " reinforces its armor plating.");
        break;
      case 1:
        emitLog(emit, enemy.label + "The cannon locks on.");
        break;
      case 2:
        damagePlayer(state, 10, "Cannon Blast", emit);
        break;
      default:
        emitLog(emit, enemy.label + enemy.label + " vents heat and repositions.");
        enemy.tracksDamaged = Math.max(0, enemy.tracksDamaged - 1); // Tracks heal over time
        break;
    }

    enemy.cycleIndex = (enemy.cycleIndex + 1) % 4;
  },
};

const phantomGunmanDef: EnemyDef<PhantomGunmanState> = {
  id: "phantom_gunman",
  label: "Phantom Gunman",
  description: "A fast duelist that takes cover and strikes from the shadows. Patience and timing are key.",
  createState: () => ({
    id: "phantom_gunman",
    label: "Phantom Gunman",
    hp: 40,
    maxHp: 40,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => {
    switch (enemy.cycleIndex % 5) {
      case 0:
        return {
          id: "hidden",
          label: "HIDDEN",
          detail: "Behind cover, hard to hit.",
          tags: ["hidden"],
        };
      case 1:
        return {
          id: "aiming",
          label: "AIMING",
          detail: "Taking careful aim.",
          tags: ["aiming"],
        };
      case 2:
        return {
          id: "exposed",
          label: "EXPOSED",
          detail: "Peeking out, vulnerable!",
          tags: ["exposed"],
        };
      case 3:
        return {
          id: "firing",
          label: "FIRING",
          detail: "Unleashing a deadly shot.",
          tags: ["firing"],
          previewDamage: 12,
        };
      default:
        return {
          id: "repositioning",
          label: "REPOSITIONING",
          detail: "Moving to new cover.",
          tags: ["repositioning"],
        };
    }
  },
  getTags: (enemy) => {
    const tags: EnemyTag[] = [];
    switch (enemy.cycleIndex % 5) {
      case 0:
        tags.push("hidden");
        break;
      case 1:
        tags.push("aiming");
        break;
      case 2:
        tags.push("exposed");
        break;
      case 3:
        tags.push("firing");
        break;
      case 4:
        tags.push("repositioning");
        break;
    }
    return tags;
  },
  act: (state, enemy, emit) => {
    switch (enemy.cycleIndex % 5) {
      case 0:
        emitLog(emit, "Phantom slips into cover.");
        break;
      case 1:
        emitLog(emit, "Phantom takes aim.");
        break;
      case 2:
        emitLog(emit, "Phantom is exposed!");
        break;
      case 3:
        damagePlayer(state, 12, "Phantom Shot", emit);
        break;
      default:
        emitLog(emit, "Phantom repositions.");
        break;
    }

    enemy.cycleIndex = (enemy.cycleIndex + 1) % 5;
  },
};

const NON_BOSS_ENEMIES: EnemyId[] = ["rat_swarm", "riot_droid", "sniper", "drone"];
const BOSS_ENEMIES: EnemyId[] = ["tank", "phantom_gunman"];

export const ENEMY_ORDER: EnemyId[] = (() => {
  const order = [...NON_BOSS_ENEMIES];
  const boss = BOSS_ENEMIES[(Math.random() * BOSS_ENEMIES.length) | 0] ?? BOSS_ENEMIES[0];

  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = (Math.random() * (i + 1)) | 0;
    [order[i], order[j]] = [order[j], order[i]];
  }

  order.push(boss);
  return order;
})();

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
    case "tank":
      return tankDef.createState();
    case "phantom_gunman":
      return phantomGunmanDef.createState();
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
    case "tank":
      return tankDef as unknown as EnemyDef<TEnemy>;
    case "phantom_gunman":
      return phantomGunmanDef as unknown as EnemyDef<TEnemy>;
  }
};

export const getEnemyIntent = (enemy: EnemyState): EnemyIntentView =>
  getEnemyDef(enemy).getIntent(enemy);

export const getEnemyTags = (enemy: EnemyState): EnemyTag[] => getEnemyDef(enemy).getTags(enemy);

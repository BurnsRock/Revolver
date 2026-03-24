import type {
  CombatState,
  EnemyDef,
  EnemyId,
  EnemyIntentView,
  EnemyState,
  EnemyStateTag,
  EventSink,
  DroneState,
  FieldMedicState,
  HexSlingerState,
  MaulerHoundState,
  PhantomGunmanState,
  RatSwarmState,
  RiotDroidState,
  SniperState,
  TankState,
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

const healEnemy = (enemy: EnemyState, amount: number, emit: EventSink, source: string): void => {
  const healed = Math.max(0, Math.min(amount, enemy.maxHp - enemy.hp));
  enemy.hp += healed;
  emitLog(emit, healed > 0 ? `${source} restores ${healed} HP.` : `${source} finds no wounds to close.`);
};

const stripPlayerGuard = (state: CombatState, amount: number, emit: EventSink, source: string): void => {
  const removed = Math.min(state.player.guard, amount);
  state.player.guard -= removed;
  emitLog(emit, removed > 0 ? `${source} strips ${removed} guard.` : `${source} finds no guard to unravel.`);
};

const ratSwarmDef: EnemyDef<RatSwarmState> = {
  id: "rat_swarm",
  label: "Rat Swarm",
  description: "A carpet of bodies that snowballs if left alone.",
  categoryTags: ["beast"],
  traitTags: ["swarm"],
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
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
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
  getStateTags: () => ["swarm"],
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
  categoryTags: ["robotic"],
  traitTags: ["armor", "charging"],
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
    const armorTags = enemy.armor > 0 ? (["armored", "shielded"] as EnemyStateTag[]) : [];

    switch (enemy.cycleIndex % 4) {
      case 0:
        return {
          id: "shield_up",
          label: "SHIELD_UP",
          detail: "Gain 6 armor.",
          tags: armorTags,
        };
      case 1:
        return {
          id: "advance",
          label: "ADVANCE",
          detail: "Wind up a baton strike.",
          tags: ["charging", ...armorTags],
        };
      case 2:
        return {
          id: "baton_strike",
          label: "BATON_STRIKE",
          detail: "Hit for 12.",
          tags: armorTags,
          previewDamage: 12,
        };
      default:
        return {
          id: "cooldown",
          label: "COOLDOWN",
          detail: "Expose the core and drop armor.",
          tags: ["exposed", ...(enemy.armor > 0 ? (["armored"] as EnemyStateTag[]) : [])],
        };
    }
  },
  getStateTags: (enemy) => {
    const tags: EnemyStateTag[] = [];
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
  categoryTags: ["human"],
  traitTags: ["ranged"],
  createState: () => ({
    id: "sniper",
    label: "Sniper",
    hp: 18,
    maxHp: 18,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
    interrupted: false,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
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
  getStateTags: () => ["aiming"],
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
  categoryTags: ["robotic"],
  traitTags: ["evasive", "ranged"],
  createState: () => ({
    id: "drone",
    label: "Drone",
    hp: 24,
    maxHp: 24,
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
  getStateTags: (enemy) => {
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

const maulerHoundDef: EnemyDef<MaulerHoundState> = {
  id: "mauler_hound",
  label: "Mauler Hound",
  description: "A fast beast that circles wide, then commits to a brutal pounce.",
  categoryTags: ["beast"],
  traitTags: ["charging", "evasive"],
  createState: () => ({
    id: "mauler_hound",
    label: "Mauler Hound",
    hp: 22,
    maxHp: 22,
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
          id: "stalk",
          label: "STALK",
          detail: "Circle just outside a clean shot.",
          tags: ["evasive"],
        };
      case 1:
        return {
          id: "coil",
          label: "COIL",
          detail: "Prepare a lunging strike.",
          tags: ["charging"],
        };
      case 2:
        return {
          id: "pounce",
          label: "POUNCE",
          detail: "Hit for 9.",
          tags: [],
          previewDamage: 9,
        };
      default:
        return {
          id: "overextended",
          label: "OVEREXTENDED",
          detail: "Catch its footing in the open.",
          tags: ["exposed"],
        };
    }
  },
  getStateTags: (enemy) => {
    switch (enemy.cycleIndex % 4) {
      case 0:
        return ["evasive"];
      case 1:
        return ["charging"];
      case 3:
        return ["exposed"];
      default:
        return [];
    }
  },
  act: (state, enemy, emit) => {
    switch (enemy.cycleIndex % 4) {
      case 0:
        emitLog(emit, "Mauler Hound keeps circling.");
        break;
      case 1:
        emitLog(emit, "Mauler Hound bunches its muscles for a leap.");
        break;
      case 2:
        damagePlayer(state, 9, "Pounce", emit);
        break;
      default:
        emitLog(emit, "Mauler Hound skids wide and exposes its flank.");
        break;
    }

    enemy.cycleIndex = (enemy.cycleIndex + 1) % 4;
  },
};

const fieldMedicDef: EnemyDef<FieldMedicState> = {
  id: "field_medic",
  label: "Field Medic",
  description: "Keeps pressure on you while patching wounds and re-establishing a firing lane.",
  categoryTags: ["human"],
  traitTags: ["support", "ranged"],
  createState: () => ({
    id: "field_medic",
    label: "Field Medic",
    hp: 26,
    maxHp: 26,
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
          id: "triage",
          label: "TRIAGE",
          detail: "Recover 3 HP.",
          tags: ["steady"],
        };
      case 1:
        return {
          id: "take_aim",
          label: "TAKE_AIM",
          detail: "Line up a suppressive burst.",
          tags: ["aiming"],
        };
      case 2:
        return {
          id: "suppressive_fire",
          label: "SUPPRESSIVE_FIRE",
          detail: "Fire for 7.",
          tags: ["firing"],
          previewDamage: 7,
        };
      default:
        return {
          id: "relocate",
          label: "RELOCATE",
          detail: "Move to fresh cover.",
          tags: ["exposed", "repositioning"],
        };
    }
  },
  getStateTags: (enemy) => {
    switch (enemy.cycleIndex % 4) {
      case 0:
        return ["steady"];
      case 1:
        return ["aiming"];
      case 2:
        return ["firing"];
      default:
        return ["exposed", "repositioning"];
    }
  },
  act: (state, enemy, emit) => {
    switch (enemy.cycleIndex % 4) {
      case 0:
        healEnemy(enemy, 3, emit, "Field Medic triage");
        break;
      case 1:
        emitLog(emit, "Field Medic settles into a firing stance.");
        break;
      case 2:
        damagePlayer(state, 7, "Suppressive Fire", emit);
        break;
      default:
        emitLog(emit, "Field Medic sprints between cover positions.");
        break;
    }

    enemy.cycleIndex = (enemy.cycleIndex + 1) % 4;
  },
};

const hexSlingerDef: EnemyDef<HexSlingerState> = {
  id: "hex_slinger",
  label: "Hex Slinger",
  description: "A spectral gunslinger that erodes your guard before landing a cursed shot.",
  categoryTags: ["supernatural"],
  traitTags: ["disruptor", "elite", "ranged"],
  createState: () => ({
    id: "hex_slinger",
    label: "Hex Slinger",
    hp: 28,
    maxHp: 28,
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
          id: "veil",
          label: "VEIL",
          detail: "Slip behind a spectral mirage.",
          tags: ["hidden"],
        };
      case 1:
        return {
          id: "sight_hex",
          label: "SIGHT_HEX",
          detail: "Fix a cursed sightline.",
          tags: ["aiming"],
        };
      case 2:
        return {
          id: "hex_bolt",
          label: "HEX_BOLT",
          detail: "Strip guard and deal 5.",
          tags: ["firing"],
          previewDamage: 5,
        };
      case 3:
        return {
          id: "manifest",
          label: "MANIFEST",
          detail: "Solidify in the open.",
          tags: ["exposed"],
        };
      default:
        return {
          id: "drift",
          label: "DRIFT",
          detail: "Glide to a new angle.",
          tags: ["repositioning"],
        };
    }
  },
  getStateTags: (enemy) => {
    switch (enemy.cycleIndex % 5) {
      case 0:
        return ["hidden"];
      case 1:
        return ["aiming"];
      case 2:
        return ["firing"];
      case 3:
        return ["exposed"];
      default:
        return ["repositioning"];
    }
  },
  act: (state, enemy, emit) => {
    switch (enemy.cycleIndex % 5) {
      case 0:
        emitLog(emit, "Hex Slinger fades behind a heat shimmer.");
        break;
      case 1:
        emitLog(emit, "Hex Slinger traces a glowing sightline across your chest.");
        break;
      case 2:
        stripPlayerGuard(state, 4, emit, "Hex Bolt");
        damagePlayer(state, 5, "Hex Bolt", emit);
        break;
      case 3:
        emitLog(emit, "Hex Slinger manifests fully for a heartbeat.");
        break;
      default:
        emitLog(emit, "Hex Slinger drifts to a fresh firing angle.");
        break;
    }

    enemy.cycleIndex = (enemy.cycleIndex + 1) % 5;
  },
};

const tankDef: EnemyDef<TankState> = {
  id: "tank",
  label: "A FUCKING TANK",
  description:
    "A heavily armored tank-like boss with a devastating cannon. Forces strategic ammo use and timing.",
  categoryTags: ["robotic"],
  traitTags: ["boss", "armor", "ranged"],
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
  getStateTags: (enemy) => {
    const tags: EnemyStateTag[] = [];
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
  onTurnStart: (_state, enemy, emit) => {
    if (enemy.cycleIndex % 4 === 0) {
      enemy.armor = 8;
      emitLog(emit, `${enemy.label} braces behind reinforced armor.`);
    } else if (enemy.cycleIndex % 4 === 3) {
      enemy.armor = 0;
      emitLog(emit, `${enemy.label} is exposed.`);
    } else {
      enemy.armor = 4;
    }
  },
  act: (state, enemy, emit) => {
    switch (enemy.cycleIndex % 4) {
      case 0:
        emitLog(emit, `${enemy.label} reinforces its armor plating.`);
        break;
      case 1:
        emitLog(emit, `${enemy.label} locks the cannon on target.`);
        break;
      case 2:
        damagePlayer(state, 10, "Cannon Blast", emit);
        break;
      default:
        emitLog(emit, `${enemy.label} vents heat and repositions.`);
        enemy.tracksDamaged = Math.max(0, enemy.tracksDamaged - 1);
        break;
    }

    enemy.cycleIndex = (enemy.cycleIndex + 1) % 4;
  },
};

const phantomGunmanDef: EnemyDef<PhantomGunmanState> = {
  id: "phantom_gunman",
  label: "Phantom Gunman",
  description: "A fast duelist that takes cover and strikes from the shadows. Patience and timing are key.",
  categoryTags: ["supernatural"],
  traitTags: ["boss", "evasive", "ranged", "elite"],
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
  getStateTags: (enemy) => {
    const tags: EnemyStateTag[] = [];
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
        emitLog(emit, "Phantom is exposed.");
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

const EASY_ENEMIES: EnemyId[] = [
  "rat_swarm",
  "riot_droid",
  "sniper",
  "drone",
];
const HARD_ENEMIES: EnemyId[] = [
  "mauler_hound",
  "field_medic",
  "hex_slinger",
  "riot_droid",
  "drone",
];
const BOSS_ENEMIES: EnemyId[] = ["tank", "phantom_gunman"];
const PRE_BOSS_FLOOR_COUNT = 7;
const EASY_FLOOR_COUNT = 5;

type EnemyDefMap = {
  rat_swarm: EnemyDef<RatSwarmState>;
  riot_droid: EnemyDef<RiotDroidState>;
  sniper: EnemyDef<SniperState>;
  drone: EnemyDef<DroneState>;
  mauler_hound: EnemyDef<MaulerHoundState>;
  field_medic: EnemyDef<FieldMedicState>;
  hex_slinger: EnemyDef<HexSlingerState>;
  tank: EnemyDef<TankState>;
  phantom_gunman: EnemyDef<PhantomGunmanState>;
};

const ENEMY_DEFS: EnemyDefMap = {
  rat_swarm: ratSwarmDef,
  riot_droid: riotDroidDef,
  sniper: sniperDef,
  drone: droneDef,
  mauler_hound: maulerHoundDef,
  field_medic: fieldMedicDef,
  hex_slinger: hexSlingerDef,
  tank: tankDef,
  phantom_gunman: phantomGunmanDef,
};

const ENEMY_HP_SCALE = 0.82;
const SWARM_STACK_SCALE = 0.84;

export const ENEMY_IDS: readonly EnemyId[] = [...new Set([...EASY_ENEMIES, ...HARD_ENEMIES, ...BOSS_ENEMIES])];

const pickFromPool = (pool: readonly EnemyId[]): EnemyId =>
  pool[(Math.random() * pool.length) | 0] ?? pool[0];

export const generateEncounterOrder = (): EnemyId[][] => {
  const encounters: EnemyId[][] = [];

  for (let floor = 0; floor < PRE_BOSS_FLOOR_COUNT; floor += 1) {
    if (floor < EASY_FLOOR_COUNT) {
      encounters.push([pickFromPool(EASY_ENEMIES)]);
      continue;
    }

    const lead = pickFromPool(HARD_ENEMIES);
    const hasSupport = Math.random() < 0.65;
    if (!hasSupport) {
      encounters.push([lead]);
      continue;
    }

    let support = pickFromPool(HARD_ENEMIES);
    if (support === lead) {
      support = pickFromPool(EASY_ENEMIES);
    }
    encounters.push([lead, support]);
  }

  const boss = pickFromPool(BOSS_ENEMIES);
  encounters.push([boss]);
  return encounters;
};

export const createEnemyState = (enemyId: EnemyId): EnemyState => {
  const enemy = ENEMY_DEFS[enemyId].createState();
  if (enemy.id === "rat_swarm") {
    const scaledStacks = Math.max(1, Math.round(enemy.stacks * SWARM_STACK_SCALE));
    enemy.stacks = scaledStacks;
    enemy.hp = scaledStacks;
    enemy.maxHp = scaledStacks;
    return enemy;
  }

  const scaledMaxHp = Math.max(1, Math.round(enemy.maxHp * ENEMY_HP_SCALE));
  enemy.maxHp = scaledMaxHp;
  enemy.hp = Math.min(enemy.hp, scaledMaxHp);
  return enemy;
};

export const getEnemyDef = <TEnemy extends EnemyState>(enemy: TEnemy): EnemyDef<TEnemy> =>
  ENEMY_DEFS[enemy.id] as unknown as EnemyDef<TEnemy>;

export const getEnemyIntent = (enemy: EnemyState): EnemyIntentView => getEnemyDef(enemy).getIntent(enemy);

export const getEnemyStateTags = (enemy: EnemyState): EnemyStateTag[] => getEnemyDef(enemy).getStateTags(enemy);

export const getEnemyCategoryTags = (enemy: EnemyState) => [...getEnemyDef(enemy).categoryTags];

export const getEnemyTraitTags = (enemy: EnemyState) => [...getEnemyDef(enemy).traitTags];

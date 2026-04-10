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
  // Desert Act
  ScorpionSwarmState,
  DesertBanditState,
  SandWormState,
  MirageStalkerState,
  CactusThugState,
  DustDevilState,
  SunBakedMarauderState,
  OasisSerpentState,
  NomadRaiderState,
  PhoenixHatchlingState,
  DesertTitanState,
  // Tundra Act
  FrostWolfState,
  IceGolemState,
  SnowYetiState,
  ArcticFoxState,
  BlizzardElementalState,
  FrozenMarauderState,
  PolarBearState,
  IceCrystalState,
  TundraTrollState,
  AuroraSpiritState,
  FrostGiantState,
  // Industrial Act
  ScrapBotState,
  WeldingDroneState,
  ToxicSludgeState,
  AssemblyLineState,
  SteamGeyserState,
  CircuitBreakerState,
  HazardBotState,
  ConveyorBeltState,
  FurnaceCoreState,
  MaintenanceDroidState,
  FactoryOverlordState,
  // Haunted Act
  GhostPirateState,
  ZombieHordeState,
  ShadowLurkerState,
  BansheeWailState,
  CursedKnightState,
  PoltergeistState,
  WraithStalkerState,
  SpectralHoundState,
  NecromancerState,
  VoidEntityState,
  LichLordState,
} from "../types";
import { ACCESSORY_DEFS } from "./accessories";

const emitLog = (emit: EventSink, text: string): void => {
  emit({ type: "log", text });
};

const hasAccessory = (state: CombatState, accessoryId: string): boolean => state.accessories.includes(accessoryId as never);

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
  if (hasAccessory(state, "safety_goggles")) {
    emitLog(emit, `${ACCESSORY_DEFS.safety_goggles.label} prevents ${source.toLowerCase()} from disrupting you.`);
    return;
  }
  const removed = Math.min(state.player.guard, amount);
  state.player.guard -= removed;
  emitLog(emit, removed > 0 ? `${source} strips ${removed} guard.` : `${source} finds no guard to unravel.`);
};

const ratSwarmDef: EnemyDef<RatSwarmState> = {
  id: "rat_swarm",
  label: "Rat Swarm",
  description: "A carpet of bodies that snowballs if left alone.",
  environment: "desert",
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
  environment: "industrial",
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
  environment: "desert",
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
  environment: "industrial",
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
  environment: "tundra",
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
  environment: "haunted",
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
  environment: "haunted",
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
  environment: "industrial",
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
  environment: "haunted",
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

// ===== DESERT ACT ENEMIES =====

const scorpionSwarmDef: EnemyDef<ScorpionSwarmState> = {
  id: "scorpion_swarm",
  label: "Scorpion Swarm",
  description: "A horde of venomous scorpions that sting repeatedly.",
  environment: "desert",
  categoryTags: ["beast"],
  traitTags: ["swarm"],
  createState: () => ({
    id: "scorpion_swarm",
    label: "Scorpion Swarm",
    hp: 8,
    maxHp: 8,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
    stacks: 8,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => ({
    id: "sting",
    label: "STING",
    detail: `Sting for ${enemy.stacks}.`,
    tags: ["swarm"],
    previewDamage: enemy.stacks,
  }),
  getStateTags: (enemy) => ["swarm"],
  act: (state, enemy, emit) => {
    damagePlayer(state, enemy.stacks, "Scorpion Sting", emit);
    enemy.stacks = Math.min(12, enemy.stacks + 1);
    enemy.hp = enemy.stacks;
    enemy.maxHp = enemy.stacks;
    emitLog(emit, `Swarm grows to ${enemy.stacks} scorpions.`);
  },
};

const desertBanditDef: EnemyDef<DesertBanditState> = {
  id: "desert_bandit",
  label: "Desert Bandit",
  description: "A opportunistic raider with a rusty revolver.",
  environment: "desert",
  categoryTags: ["human"],
  traitTags: ["ranged"],
  createState: () => ({
    id: "desert_bandit",
    label: "Desert Bandit",
    hp: 16,
    maxHp: 16,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => ({
    id: "shoot",
    label: "SHOOT",
    detail: "Fire rusty shot for 4.",
    tags: [],
    previewDamage: 4,
  }),
  getStateTags: (enemy) => [],
  act: (state, enemy, emit) => {
    damagePlayer(state, 4, "Rusty Shot", emit);
  },
};

const sandWormDef: EnemyDef<SandWormState> = {
  id: "sand_worm",
  label: "Sand Worm",
  description: "A massive burrowing predator that erupts from the sand.",
  environment: "desert",
  categoryTags: ["beast"],
  traitTags: ["charging"],
  createState: () => ({
    id: "sand_worm",
    label: "Sand Worm",
    hp: 20,
    maxHp: 20,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
    burrowed: true,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => {
    if (enemy.burrowed) {
      return {
        id: "burrow",
        label: "BURROW",
        detail: "Preparing to erupt.",
        tags: ["hidden"],
      };
    } else {
      return {
        id: "erupt",
        label: "ERUPT",
        detail: "Chomp for 6.",
        tags: ["charging"],
        previewDamage: 6,
      };
    }
  },
  getStateTags: (enemy) => enemy.burrowed ? ["hidden"] : ["charging"],
  act: (state, enemy, emit) => {
    if (enemy.burrowed) {
      enemy.burrowed = false;
      emitLog(emit, "Sand Worm erupts from the ground!");
    } else {
      damagePlayer(state, 6, "Sand Worm Chomp", emit);
      enemy.burrowed = true;
    }
  },
};

const mirageStalkerDef: EnemyDef<MirageStalkerState> = {
  id: "mirage_stalker",
  label: "Mirage Stalker",
  description: "An illusory predator that phases in and out of reality.",
  environment: "desert",
  categoryTags: ["supernatural"],
  traitTags: ["evasive"],
  createState: () => ({
    id: "mirage_stalker",
    label: "Mirage Stalker",
    hp: 14,
    maxHp: 14,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
    visible: false,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => {
    if (enemy.visible) {
      return {
        id: "strike",
        label: "STRIKE",
        detail: "Illusory claw for 3.",
        tags: [],
        previewDamage: 3,
      };
    } else {
      return {
        id: "fade",
        label: "FADE",
        detail: "Becomes intangible.",
        tags: ["evasive"],
      };
    }
  },
  getStateTags: (enemy) => enemy.visible ? [] : ["evasive"],
  act: (state, enemy, emit) => {
    if (enemy.visible) {
      damagePlayer(state, 3, "Illusory Claw", emit);
      enemy.visible = false;
    } else {
      enemy.visible = true;
      emitLog(emit, "Mirage Stalker becomes visible!");
    }
  },
};

const cactusThugDef: EnemyDef<CactusThugState> = {
  id: "cactus_thug",
  label: "Cactus Thug",
  description: "A tough, spiky plant creature that blocks and thorns.",
  environment: "desert",
  categoryTags: ["beast"],
  traitTags: ["armor"],
  createState: () => ({
    id: "cactus_thug",
    label: "Cactus Thug",
    hp: 18,
    maxHp: 18,
    armor: 2,
    shred: 0,
    cycleIndex: 0,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => ({
    id: "thorns",
    label: "THORNS",
    detail: "Thorn barrage for 2.",
    tags: ["armored"],
    previewDamage: 2,
  }),
  getStateTags: (enemy) => ["armored"],
  act: (state, enemy, emit) => {
    damagePlayer(state, 2, "Thorn Barrage", emit);
  },
};

const dustDevilDef: EnemyDef<DustDevilState> = {
  id: "dust_devil",
  label: "Dust Devil",
  description: "A swirling vortex of sand that disrupts and damages.",
  environment: "desert",
  categoryTags: ["supernatural"],
  traitTags: ["disruptor"],
  createState: () => ({
    id: "dust_devil",
    label: "Dust Devil",
    hp: 12,
    maxHp: 12,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => ({
    id: "swirl",
    label: "SWIRL",
    detail: "Sand blast for 2, strip 2 guard.",
    tags: [],
    previewDamage: 2,
  }),
  getStateTags: (enemy) => [],
  act: (state, enemy, emit) => {
    damagePlayer(state, 2, "Sand Blast", emit);
    stripPlayerGuard(state, 2, emit, "Dust Devil");
  },
};

const sunBakedMarauderDef: EnemyDef<SunBakedMarauderState> = {
  id: "sun_baked_marauder",
  label: "Sun-Baked Marauder",
  description: "A heat-crazed survivor driven mad by the desert sun.",
  environment: "desert",
  categoryTags: ["human"],
  traitTags: ["elite"],
  createState: () => ({
    id: "sun_baked_marauder",
    label: "Sun-Baked Marauder",
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
  getIntent: (enemy) => ({
    id: "frenzy",
    label: "FRENZY",
    detail: "Mad swing for 5.",
    tags: [],
    previewDamage: 5,
  }),
  getStateTags: (enemy) => [],
  act: (state, enemy, emit) => {
    damagePlayer(state, 5, "Mad Swing", emit);
  },
};

const oasisSerpentDef: EnemyDef<OasisSerpentState> = {
  id: "oasis_serpent",
  label: "Oasis Serpent",
  description: "A venomous snake that guards desert water sources.",
  environment: "desert",
  categoryTags: ["beast"],
  traitTags: ["evasive"],
  createState: () => ({
    id: "oasis_serpent",
    label: "Oasis Serpent",
    hp: 15,
    maxHp: 15,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => ({
    id: "bite",
    label: "BITE",
    detail: "Venomous bite for 3.",
    tags: ["evasive"],
    previewDamage: 3,
  }),
  getStateTags: (enemy) => ["evasive"],
  act: (state, enemy, emit) => {
    damagePlayer(state, 3, "Venomous Bite", emit);
  },
};

const nomadRaiderDef: EnemyDef<NomadRaiderState> = {
  id: "nomad_raider",
  label: "Nomad Raider",
  description: "A skilled desert warrior with curved blades.",
  environment: "desert",
  categoryTags: ["human"],
  traitTags: ["elite"],
  createState: () => ({
    id: "nomad_raider",
    label: "Nomad Raider",
    hp: 20,
    maxHp: 20,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => ({
    id: "slash",
    label: "SLASH",
    detail: "Curved blade for 4.",
    tags: [],
    previewDamage: 4,
  }),
  getStateTags: (enemy) => [],
  act: (state, enemy, emit) => {
    damagePlayer(state, 4, "Curved Blade", emit);
  },
};

const phoenixHatchlingDef: EnemyDef<PhoenixHatchlingState> = {
  id: "phoenix_hatchling",
  label: "Phoenix Hatchling",
  description: "A fiery young phoenix that bursts into flames.",
  environment: "desert",
  categoryTags: ["beast"],
  traitTags: ["elite"],
  createState: () => ({
    id: "phoenix_hatchling",
    label: "Phoenix Hatchling",
    hp: 16,
    maxHp: 16,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => ({
    id: "flame",
    label: "FLAME",
    detail: "Fire breath for 3, apply burn.",
    tags: [],
    previewDamage: 3,
  }),
  getStateTags: (enemy) => [],
  act: (state, enemy, emit) => {
    damagePlayer(state, 3, "Fire Breath", emit);
    // Apply burn to player (would need player burn mechanics)
    emitLog(emit, "Phoenix Hatchling scorches you!");
  },
};

const desertTitanDef: EnemyDef<DesertTitanState> = {
  id: "desert_titan",
  label: "Desert Titan",
  description: "A massive sandstone golem that crushes everything in its path.",
  environment: "desert",
  categoryTags: ["supernatural"],
  traitTags: ["boss", "armor"],
  createState: () => ({
    id: "desert_titan",
    label: "Desert Titan",
    hp: 35,
    maxHp: 35,
    armor: 3,
    shred: 0,
    cycleIndex: 0,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => ({
    id: "crush",
    label: "CRUSH",
    detail: "Sandstone fist for 8.",
    tags: ["armored"],
    previewDamage: 8,
  }),
  getStateTags: (enemy) => ["armored"],
  act: (state, enemy, emit) => {
    damagePlayer(state, 8, "Sandstone Fist", emit);
  },
};

// ===== TUNDRA ACT ENEMIES =====

const frostWolfDef: EnemyDef<FrostWolfState> = {
  id: "frost_wolf",
  label: "Frost Wolf",
  description: "A pack hunter that freezes its prey before striking.",
  environment: "tundra",
  categoryTags: ["beast"],
  traitTags: ["charging"],
  createState: () => ({
    id: "frost_wolf",
    label: "Frost Wolf",
    hp: 18,
    maxHp: 18,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => ({
    id: "pounce",
    label: "POUNCE",
    detail: "Frozen bite for 4.",
    tags: ["charging"],
    previewDamage: 4,
  }),
  getStateTags: (enemy) => ["charging"],
  act: (state, enemy, emit) => {
    damagePlayer(state, 4, "Frozen Bite", emit);
  },
};

const iceGolemDef: EnemyDef<IceGolemState> = {
  id: "ice_golem",
  label: "Ice Golem",
  description: "A towering construct of enchanted ice.",
  environment: "tundra",
  categoryTags: ["supernatural"],
  traitTags: ["armor"],
  createState: () => ({
    id: "ice_golem",
    label: "Ice Golem",
    hp: 24,
    maxHp: 24,
    armor: 2,
    shred: 0,
    cycleIndex: 0,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => ({
    id: "slam",
    label: "SLAM",
    detail: "Ice fist for 5.",
    tags: ["armored"],
    previewDamage: 5,
  }),
  getStateTags: (enemy) => ["armored"],
  act: (state, enemy, emit) => {
    damagePlayer(state, 5, "Ice Fist", emit);
  },
};

const snowYetiDef: EnemyDef<SnowYetiState> = {
  id: "snow_yeti",
  label: "Snow Yeti",
  description: "A massive, hairy beast that blends with the snow.",
  environment: "tundra",
  categoryTags: ["beast"],
  traitTags: ["evasive", "elite"],
  createState: () => ({
    id: "snow_yeti",
    label: "Snow Yeti",
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
  getIntent: (enemy) => ({
    id: "roar",
    label: "ROAR",
    detail: "Snowy swipe for 6.",
    tags: ["evasive"],
    previewDamage: 6,
  }),
  getStateTags: (enemy) => ["evasive"],
  act: (state, enemy, emit) => {
    damagePlayer(state, 6, "Snowy Swipe", emit);
  },
};

const arcticFoxDef: EnemyDef<ArcticFoxState> = {
  id: "arctic_fox",
  label: "Arctic Fox",
  description: "A clever predator that ambushes from snowdrifts.",
  environment: "tundra",
  categoryTags: ["beast"],
  traitTags: ["evasive"],
  createState: () => ({
    id: "arctic_fox",
    label: "Arctic Fox",
    hp: 14,
    maxHp: 14,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => ({
    id: "ambush",
    label: "AMBUSH",
    detail: "Sneak attack for 3.",
    tags: ["evasive"],
    previewDamage: 3,
  }),
  getStateTags: (enemy) => ["evasive"],
  act: (state, enemy, emit) => {
    damagePlayer(state, 3, "Sneak Attack", emit);
  },
};

const blizzardElementalDef: EnemyDef<BlizzardElementalState> = {
  id: "blizzard_elemental",
  label: "Blizzard Elemental",
  description: "A swirling vortex of snow and ice.",
  environment: "tundra",
  categoryTags: ["supernatural"],
  traitTags: ["disruptor"],
  createState: () => ({
    id: "blizzard_elemental",
    label: "Blizzard Elemental",
    hp: 16,
    maxHp: 16,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => ({
    id: "blizzard",
    label: "BLIZZARD",
    detail: "Ice storm for 2, strip 1 guard.",
    tags: [],
    previewDamage: 2,
  }),
  getStateTags: (enemy) => [],
  act: (state, enemy, emit) => {
    damagePlayer(state, 2, "Ice Storm", emit);
    stripPlayerGuard(state, 1, emit, "Blizzard Elemental");
  },
};

const frozenMarauderDef: EnemyDef<FrozenMarauderState> = {
  id: "frozen_marauder",
  label: "Frozen Marauder",
  description: "A frostbitten survivor turned feral by the cold.",
  environment: "tundra",
  categoryTags: ["human"],
  traitTags: ["elite"],
  createState: () => ({
    id: "frozen_marauder",
    label: "Frozen Marauder",
    hp: 20,
    maxHp: 20,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => ({
    id: "icicle",
    label: "ICICLE",
    detail: "Frozen spear for 4.",
    tags: [],
    previewDamage: 4,
  }),
  getStateTags: (enemy) => [],
  act: (state, enemy, emit) => {
    damagePlayer(state, 4, "Frozen Spear", emit);
  },
};

const polarBearDef: EnemyDef<PolarBearState> = {
  id: "polar_bear",
  label: "Polar Bear",
  description: "A massive white bear that charges through snow.",
  environment: "tundra",
  categoryTags: ["beast"],
  traitTags: ["charging", "elite"],
  createState: () => ({
    id: "polar_bear",
    label: "Polar Bear",
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
  getIntent: (enemy) => ({
    id: "maul",
    label: "MAUL",
    detail: "Bear claw for 7.",
    tags: ["charging"],
    previewDamage: 7,
  }),
  getStateTags: (enemy) => ["charging"],
  act: (state, enemy, emit) => {
    damagePlayer(state, 7, "Bear Claw", emit);
  },
};

const iceCrystalDef: EnemyDef<IceCrystalState> = {
  id: "ice_crystal",
  label: "Ice Crystal",
  description: "A floating crystalline entity that shatters explosively.",
  environment: "tundra",
  categoryTags: ["supernatural"],
  traitTags: ["evasive"],
  createState: () => ({
    id: "ice_crystal",
    label: "Ice Crystal",
    hp: 12,
    maxHp: 12,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => ({
    id: "shatter",
    label: "SHATTER",
    detail: "Crystal shards for 3.",
    tags: ["evasive"],
    previewDamage: 3,
  }),
  getStateTags: (enemy) => ["evasive"],
  act: (state, enemy, emit) => {
    damagePlayer(state, 3, "Crystal Shards", emit);
  },
};

const tundraTrollDef: EnemyDef<TundraTrollState> = {
  id: "tundra_troll",
  label: "Tundra Troll",
  description: "A brutish ice troll with regenerative frost armor.",
  environment: "tundra",
  categoryTags: ["supernatural"],
  traitTags: ["armor", "elite"],
  createState: () => ({
    id: "tundra_troll",
    label: "Tundra Troll",
    hp: 30,
    maxHp: 30,
    armor: 3,
    shred: 0,
    cycleIndex: 0,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => ({
    id: "club",
    label: "CLUB",
    detail: "Ice club for 6.",
    tags: ["armored"],
    previewDamage: 6,
  }),
  getStateTags: (enemy) => ["armored"],
  act: (state, enemy, emit) => {
    damagePlayer(state, 6, "Ice Club", emit);
  },
};

const auroraSpiritDef: EnemyDef<AuroraSpiritState> = {
  id: "aurora_spirit",
  label: "Aurora Spirit",
  description: "A mystical being that manipulates northern lights.",
  environment: "tundra",
  categoryTags: ["supernatural"],
  traitTags: ["support"],
  createState: () => ({
    id: "aurora_spirit",
    label: "Aurora Spirit",
    hp: 18,
    maxHp: 18,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => ({
    id: "lights",
    label: "LIGHTS",
    detail: "Aurora beam for 3.",
    tags: [],
    previewDamage: 3,
  }),
  getStateTags: (enemy) => [],
  act: (state, enemy, emit) => {
    damagePlayer(state, 3, "Aurora Beam", emit);
  },
};

const frostGiantDef: EnemyDef<FrostGiantState> = {
  id: "frost_giant",
  label: "Frost Giant",
  description: "A colossal ice giant that commands the frozen wastes.",
  environment: "tundra",
  categoryTags: ["supernatural"],
  traitTags: ["boss", "armor"],
  createState: () => ({
    id: "frost_giant",
    label: "Frost Giant",
    hp: 40,
    maxHp: 40,
    armor: 4,
    shred: 0,
    cycleIndex: 0,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => ({
    id: "avalanche",
    label: "AVALANCHE",
    detail: "Frozen boulder for 10.",
    tags: ["armored"],
    previewDamage: 10,
  }),
  getStateTags: (enemy) => ["armored"],
  act: (state, enemy, emit) => {
    damagePlayer(state, 10, "Frozen Boulder", emit);
  },
};

// ===== INDUSTRIAL ACT ENEMIES =====

const scrapBotDef: EnemyDef<ScrapBotState> = {
  id: "scrap_bot",
  label: "Scrap Bot",
  description: "A jury-rigged robot made from factory refuse.",
  environment: "industrial",
  categoryTags: ["robotic"],
  traitTags: [],
  createState: () => ({
    id: "scrap_bot",
    label: "Scrap Bot",
    hp: 16,
    maxHp: 16,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => ({
    id: "weld",
    label: "WELD",
    detail: "Sparking attack for 3.",
    tags: [],
    previewDamage: 3,
  }),
  getStateTags: (enemy) => [],
  act: (state, enemy, emit) => {
    damagePlayer(state, 3, "Sparking Attack", emit);
  },
};

const weldingDroneDef: EnemyDef<WeldingDroneState> = {
  id: "welding_drone",
  label: "Welding Drone",
  description: "A hovering repair drone with a plasma torch.",
  environment: "industrial",
  categoryTags: ["robotic"],
  traitTags: ["ranged"],
  createState: () => ({
    id: "welding_drone",
    label: "Welding Drone",
    hp: 14,
    maxHp: 14,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => ({
    id: "torch",
    label: "TORCH",
    detail: "Plasma beam for 3.",
    tags: [],
    previewDamage: 3,
  }),
  getStateTags: (enemy) => [],
  act: (state, enemy, emit) => {
    damagePlayer(state, 3, "Plasma Beam", emit);
  },
};

const toxicSludgeDef: EnemyDef<ToxicSludgeState> = {
  id: "toxic_sludge",
  label: "Toxic Sludge",
  description: "A corrosive ooze that leaks from faulty containers.",
  environment: "industrial",
  categoryTags: ["supernatural"],
  traitTags: ["disruptor"],
  createState: () => ({
    id: "toxic_sludge",
    label: "Toxic Sludge",
    hp: 18,
    maxHp: 18,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => ({
    id: "corrode",
    label: "CORRODE",
    detail: "Acid splash for 2, strip 1 guard.",
    tags: [],
    previewDamage: 2,
  }),
  getStateTags: (enemy) => [],
  act: (state, enemy, emit) => {
    damagePlayer(state, 2, "Acid Splash", emit);
    stripPlayerGuard(state, 1, emit, "Toxic Sludge");
  },
};

const assemblyLineDef: EnemyDef<AssemblyLineState> = {
  id: "assembly_line",
  label: "Assembly Line",
  description: "An automated production line that stamps out threats.",
  environment: "industrial",
  categoryTags: ["robotic"],
  traitTags: ["support"],
  createState: () => ({
    id: "assembly_line",
    label: "Assembly Line",
    hp: 20,
    maxHp: 20,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => ({
    id: "stamp",
    label: "STAMP",
    detail: "Metal press for 4.",
    tags: [],
    previewDamage: 4,
  }),
  getStateTags: (enemy) => [],
  act: (state, enemy, emit) => {
    damagePlayer(state, 4, "Metal Press", emit);
  },
};

const steamGeyserDef: EnemyDef<SteamGeyserState> = {
  id: "steam_geyser",
  label: "Steam Geyser",
  description: "A pressurized steam vent that erupts scalding vapor.",
  environment: "industrial",
  categoryTags: ["supernatural"],
  traitTags: ["disruptor"],
  createState: () => ({
    id: "steam_geyser",
    label: "Steam Geyser",
    hp: 15,
    maxHp: 15,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => ({
    id: "erupt",
    label: "ERUPT",
    detail: "Steam blast for 3.",
    tags: [],
    previewDamage: 3,
  }),
  getStateTags: (enemy) => [],
  act: (state, enemy, emit) => {
    damagePlayer(state, 3, "Steam Blast", emit);
  },
};

const circuitBreakerDef: EnemyDef<CircuitBreakerState> = {
  id: "circuit_breaker",
  label: "Circuit Breaker",
  description: "An electrical hazard that arcs with deadly current.",
  environment: "industrial",
  categoryTags: ["robotic"],
  traitTags: ["disruptor"],
  createState: () => ({
    id: "circuit_breaker",
    label: "Circuit Breaker",
    hp: 12,
    maxHp: 12,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => ({
    id: "arc",
    label: "ARC",
    detail: "Electric shock for 2.",
    tags: [],
    previewDamage: 2,
  }),
  getStateTags: (enemy) => [],
  act: (state, enemy, emit) => {
    damagePlayer(state, 2, "Electric Shock", emit);
  },
};

const hazardBotDef: EnemyDef<HazardBotState> = {
  id: "hazard_bot",
  label: "Hazard Bot",
  description: "A safety robot gone wrong with spinning blades.",
  environment: "industrial",
  categoryTags: ["robotic"],
  traitTags: ["elite"],
  createState: () => ({
    id: "hazard_bot",
    label: "Hazard Bot",
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
  getIntent: (enemy) => ({
    id: "spin",
    label: "SPIN",
    detail: "Blade spin for 5.",
    tags: [],
    previewDamage: 5,
  }),
  getStateTags: (enemy) => [],
  act: (state, enemy, emit) => {
    damagePlayer(state, 5, "Blade Spin", emit);
  },
};

const conveyorBeltDef: EnemyDef<ConveyorBeltState> = {
  id: "conveyor_belt",
  label: "Conveyor Belt",
  description: "A malfunctioning conveyor that crushes and transports.",
  environment: "industrial",
  categoryTags: ["robotic"],
  traitTags: ["support"],
  createState: () => ({
    id: "conveyor_belt",
    label: "Conveyor Belt",
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
  getIntent: (enemy) => ({
    id: "crush",
    label: "CRUSH",
    detail: "Belt crush for 4.",
    tags: [],
    previewDamage: 4,
  }),
  getStateTags: (enemy) => [],
  act: (state, enemy, emit) => {
    damagePlayer(state, 4, "Belt Crush", emit);
  },
};

const furnaceCoreDef: EnemyDef<FurnaceCoreState> = {
  id: "furnace_core",
  label: "Furnace Core",
  description: "The molten heart of a factory furnace.",
  environment: "industrial",
  categoryTags: ["supernatural"],
  traitTags: ["elite"],
  createState: () => ({
    id: "furnace_core",
    label: "Furnace Core",
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
  getIntent: (enemy) => ({
    id: "melt",
    label: "MELT",
    detail: "Lava spray for 6.",
    tags: [],
    previewDamage: 6,
  }),
  getStateTags: (enemy) => [],
  act: (state, enemy, emit) => {
    damagePlayer(state, 6, "Lava Spray", emit);
  },
};

const maintenanceDroidDef: EnemyDef<MaintenanceDroidState> = {
  id: "maintenance_droid",
  label: "Maintenance Droid",
  description: "A helpful robot that now attacks intruders.",
  environment: "industrial",
  categoryTags: ["robotic"],
  traitTags: ["support"],
  createState: () => ({
    id: "maintenance_droid",
    label: "Maintenance Droid",
    hp: 19,
    maxHp: 19,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => ({
    id: "repair",
    label: "REPAIR",
    detail: "Tool strike for 3.",
    tags: [],
    previewDamage: 3,
  }),
  getStateTags: (enemy) => [],
  act: (state, enemy, emit) => {
    damagePlayer(state, 3, "Tool Strike", emit);
  },
};

const factoryOverlordDef: EnemyDef<FactoryOverlordState> = {
  id: "factory_overlord",
  label: "Factory Overlord",
  description: "A massive automated overseer that commands the machines.",
  environment: "industrial",
  categoryTags: ["robotic"],
  traitTags: ["boss", "armor"],
  createState: () => ({
    id: "factory_overlord",
    label: "Factory Overlord",
    hp: 45,
    maxHp: 45,
    armor: 3,
    shred: 0,
    cycleIndex: 0,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => ({
    id: "command",
    label: "COMMAND",
    detail: "Overload blast for 9.",
    tags: ["armored"],
    previewDamage: 9,
  }),
  getStateTags: (enemy) => ["armored"],
  act: (state, enemy, emit) => {
    damagePlayer(state, 9, "Overload Blast", emit);
  },
};

// ===== HAUNTED ACT ENEMIES =====

const ghostPirateDef: EnemyDef<GhostPirateState> = {
  id: "ghost_pirate",
  label: "Ghost Pirate",
  description: "A spectral buccaneer that haunts the seas.",
  environment: "haunted",
  categoryTags: ["supernatural"],
  traitTags: ["evasive"],
  createState: () => ({
    id: "ghost_pirate",
    label: "Ghost Pirate",
    hp: 17,
    maxHp: 17,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => ({
    id: "cutlass",
    label: "CUTLASS",
    detail: "Ghostly blade for 4.",
    tags: ["evasive"],
    previewDamage: 4,
  }),
  getStateTags: (enemy) => ["evasive"],
  act: (state, enemy, emit) => {
    damagePlayer(state, 4, "Ghostly Blade", emit);
  },
};

const zombieHordeDef: EnemyDef<ZombieHordeState> = {
  id: "zombie_horde",
  label: "Zombie Horde",
  description: "A shambling mass of undead that grows as it feeds.",
  environment: "haunted",
  categoryTags: ["supernatural"],
  traitTags: ["swarm"],
  createState: () => ({
    id: "zombie_horde",
    label: "Zombie Horde",
    hp: 10,
    maxHp: 10,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
    stacks: 10,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => ({
    id: "bite",
    label: "BITE",
    detail: `Zombie bites for ${enemy.stacks}.`,
    tags: ["swarm"],
    previewDamage: enemy.stacks,
  }),
  getStateTags: (enemy) => ["swarm"],
  act: (state, enemy, emit) => {
    damagePlayer(state, enemy.stacks, "Zombie Bites", emit);
    enemy.stacks = Math.min(15, enemy.stacks + 1);
    enemy.hp = enemy.stacks;
    enemy.maxHp = enemy.stacks;
    emitLog(emit, `Horde grows to ${enemy.stacks} zombies.`);
  },
};

const shadowLurkerDef: EnemyDef<ShadowLurkerState> = {
  id: "shadow_lurker",
  label: "Shadow Lurker",
  description: "A creature of darkness that strikes from the shadows.",
  environment: "haunted",
  categoryTags: ["supernatural"],
  traitTags: ["evasive"],
  createState: () => ({
    id: "shadow_lurker",
    label: "Shadow Lurker",
    hp: 15,
    maxHp: 15,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
    hidden: true,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => {
    if (enemy.hidden) {
      return {
        id: "lurk",
        label: "LURK",
        detail: "Hiding in shadows.",
        tags: ["hidden"],
      };
    } else {
      return {
        id: "ambush",
        label: "AMBUSH",
        detail: "Shadow strike for 5.",
        tags: [],
        previewDamage: 5,
      };
    }
  },
  getStateTags: (enemy) => enemy.hidden ? ["hidden"] : [],
  act: (state, enemy, emit) => {
    if (enemy.hidden) {
      enemy.hidden = false;
      emitLog(emit, "Shadow Lurker emerges!");
    } else {
      damagePlayer(state, 5, "Shadow Strike", emit);
      enemy.hidden = true;
    }
  },
};

const bansheeWailDef: EnemyDef<BansheeWailState> = {
  id: "banshee_wail",
  label: "Banshee Wail",
  description: "A wailing spirit that disrupts with sonic attacks.",
  environment: "haunted",
  categoryTags: ["supernatural"],
  traitTags: ["disruptor"],
  createState: () => ({
    id: "banshee_wail",
    label: "Banshee Wail",
    hp: 16,
    maxHp: 16,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => ({
    id: "wail",
    label: "WAIL",
    detail: "Sonic scream for 3.",
    tags: [],
    previewDamage: 3,
  }),
  getStateTags: (enemy) => [],
  act: (state, enemy, emit) => {
    damagePlayer(state, 3, "Sonic Scream", emit);
  },
};

const cursedKnightDef: EnemyDef<CursedKnightState> = {
  id: "cursed_knight",
  label: "Cursed Knight",
  description: "An undead warrior bound by dark magic.",
  environment: "haunted",
  categoryTags: ["supernatural"],
  traitTags: ["armor"],
  createState: () => ({
    id: "cursed_knight",
    label: "Cursed Knight",
    hp: 25,
    maxHp: 25,
    armor: 2,
    shred: 0,
    cycleIndex: 0,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => ({
    id: "slash",
    label: "SLASH",
    detail: "Cursed sword for 5.",
    tags: ["armored"],
    previewDamage: 5,
  }),
  getStateTags: (enemy) => ["armored"],
  act: (state, enemy, emit) => {
    damagePlayer(state, 5, "Cursed Sword", emit);
  },
};

const poltergeistDef: EnemyDef<PoltergeistState> = {
  id: "poltergeist",
  label: "Poltergeist",
  description: "A mischievous spirit that throws objects telekinetically.",
  environment: "haunted",
  categoryTags: ["supernatural"],
  traitTags: ["disruptor"],
  createState: () => ({
    id: "poltergeist",
    label: "Poltergeist",
    hp: 14,
    maxHp: 14,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => ({
    id: "throw",
    label: "THROW",
    detail: "Object barrage for 2.",
    tags: [],
    previewDamage: 2,
  }),
  getStateTags: (enemy) => [],
  act: (state, enemy, emit) => {
    damagePlayer(state, 2, "Object Barrage", emit);
  },
};

const wraithStalkerDef: EnemyDef<WraithStalkerState> = {
  id: "wraith_stalker",
  label: "Wraith Stalker",
  description: "A soul-draining phantom that hunts the living.",
  environment: "haunted",
  categoryTags: ["supernatural"],
  traitTags: ["evasive", "elite"],
  createState: () => ({
    id: "wraith_stalker",
    label: "Wraith Stalker",
    hp: 20,
    maxHp: 20,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => ({
    id: "drain",
    label: "DRAIN",
    detail: "Soul drain for 4.",
    tags: ["evasive"],
    previewDamage: 4,
  }),
  getStateTags: (enemy) => ["evasive"],
  act: (state, enemy, emit) => {
    damagePlayer(state, 4, "Soul Drain", emit);
  },
};

const spectralHoundDef: EnemyDef<SpectralHoundState> = {
  id: "spectral_hound",
  label: "Spectral Hound",
  description: "A ghostly dog that hunts with ethereal fangs.",
  environment: "haunted",
  categoryTags: ["supernatural"],
  traitTags: ["evasive"],
  createState: () => ({
    id: "spectral_hound",
    label: "Spectral Hound",
    hp: 18,
    maxHp: 18,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => ({
    id: "bite",
    label: "BITE",
    detail: "Spectral bite for 3.",
    tags: ["evasive"],
    previewDamage: 3,
  }),
  getStateTags: (enemy) => ["evasive"],
  act: (state, enemy, emit) => {
    damagePlayer(state, 3, "Spectral Bite", emit);
  },
};

const necromancerDef: EnemyDef<NecromancerState> = {
  id: "necromancer",
  label: "Necromancer",
  description: "A dark mage who commands the dead.",
  environment: "haunted",
  categoryTags: ["supernatural"],
  traitTags: ["support", "elite"],
  createState: () => ({
    id: "necromancer",
    label: "Necromancer",
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
  getIntent: (enemy) => ({
    id: "curse",
    label: "CURSE",
    detail: "Dark bolt for 4.",
    tags: [],
    previewDamage: 4,
  }),
  getStateTags: (enemy) => [],
  act: (state, enemy, emit) => {
    damagePlayer(state, 4, "Dark Bolt", emit);
  },
};

const voidEntityDef: EnemyDef<VoidEntityState> = {
  id: "void_entity",
  label: "Void Entity",
  description: "A being from the nothingness between worlds.",
  environment: "haunted",
  categoryTags: ["supernatural"],
  traitTags: ["elite"],
  createState: () => ({
    id: "void_entity",
    label: "Void Entity",
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
  getIntent: (enemy) => ({
    id: "void",
    label: "VOID",
    detail: "Void touch for 5.",
    tags: [],
    previewDamage: 5,
  }),
  getStateTags: (enemy) => [],
  act: (state, enemy, emit) => {
    damagePlayer(state, 5, "Void Touch", emit);
  },
};

const lichLordDef: EnemyDef<LichLordState> = {
  id: "lich_lord",
  label: "Lich Lord",
  description: "An ancient undead sorcerer who defies death itself.",
  environment: "haunted",
  categoryTags: ["supernatural"],
  traitTags: ["boss", "elite"],
  createState: () => ({
    id: "lich_lord",
    label: "Lich Lord",
    hp: 38,
    maxHp: 38,
    armor: 0,
    shred: 0,
    cycleIndex: 0,
    stun: 0,
    marked: false,
    porked: false,
    burn: 0,
    infestation: 0,
  }),
  getIntent: (enemy) => ({
    id: "necro",
    label: "NECRO",
    detail: "Death magic for 8.",
    tags: [],
    previewDamage: 8,
  }),
  getStateTags: (enemy) => [],
  act: (state, enemy, emit) => {
    damagePlayer(state, 8, "Death Magic", emit);
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

// ===== ACT-BASED ENEMY POOLS =====

const DESERT_EASY_ENEMIES: EnemyId[] = [
  "scorpion_swarm",
  "mirage_stalker",
  "dust_devil",
];
const DESERT_HARD_ENEMIES: EnemyId[] = [
  "desert_bandit",
  "cactus_thug",
  "sun_baked_marauder",
  "oasis_serpent",
  "nomad_raider",
  "phoenix_hatchling",
];
const DESERT_BOSS_ENEMIES: EnemyId[] = ["desert_titan"];

const TUNDRA_EASY_ENEMIES: EnemyId[] = [
  "ice_crystal",
  "blizzard_elemental",
];
const TUNDRA_HARD_ENEMIES: EnemyId[] = [
  "frost_wolf",
  "arctic_fox",
  "frozen_marauder",
  "polar_bear",
  "snow_yeti",
  "tundra_troll",
  "aurora_spirit",
];
const TUNDRA_BOSS_ENEMIES: EnemyId[] = ["frost_giant"];

const INDUSTRIAL_EASY_ENEMIES: EnemyId[] = [
  "scrap_bot",
  "circuit_breaker",
];
const INDUSTRIAL_HARD_ENEMIES: EnemyId[] = [
  "welding_drone",
  "toxic_sludge",
  "assembly_line",
  "steam_geyser",
  "hazard_bot",
  "conveyor_belt",
  "furnace_core",
  "maintenance_droid",
];
const INDUSTRIAL_BOSS_ENEMIES: EnemyId[] = ["factory_overlord"];

const HAUNTED_EASY_ENEMIES: EnemyId[] = [
  "poltergeist",
  "spectral_hound",
];
const HAUNTED_HARD_ENEMIES: EnemyId[] = [
  "ghost_pirate",
  "zombie_horde",
  "shadow_lurker",
  "banshee_wail",
  "cursed_knight",
  "wraith_stalker",
  "necromancer",
  "void_entity",
];
const HAUNTED_BOSS_ENEMIES: EnemyId[] = ["lich_lord"];

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
  // Desert Act
  scorpion_swarm: EnemyDef<ScorpionSwarmState>;
  desert_bandit: EnemyDef<DesertBanditState>;
  sand_worm: EnemyDef<SandWormState>;
  mirage_stalker: EnemyDef<MirageStalkerState>;
  cactus_thug: EnemyDef<CactusThugState>;
  dust_devil: EnemyDef<DustDevilState>;
  sun_baked_marauder: EnemyDef<SunBakedMarauderState>;
  oasis_serpent: EnemyDef<OasisSerpentState>;
  nomad_raider: EnemyDef<NomadRaiderState>;
  phoenix_hatchling: EnemyDef<PhoenixHatchlingState>;
  desert_titan: EnemyDef<DesertTitanState>;
  // Tundra Act
  frost_wolf: EnemyDef<FrostWolfState>;
  ice_golem: EnemyDef<IceGolemState>;
  snow_yeti: EnemyDef<SnowYetiState>;
  arctic_fox: EnemyDef<ArcticFoxState>;
  blizzard_elemental: EnemyDef<BlizzardElementalState>;
  frozen_marauder: EnemyDef<FrozenMarauderState>;
  polar_bear: EnemyDef<PolarBearState>;
  ice_crystal: EnemyDef<IceCrystalState>;
  tundra_troll: EnemyDef<TundraTrollState>;
  aurora_spirit: EnemyDef<AuroraSpiritState>;
  frost_giant: EnemyDef<FrostGiantState>;
  // Industrial Act
  scrap_bot: EnemyDef<ScrapBotState>;
  welding_drone: EnemyDef<WeldingDroneState>;
  toxic_sludge: EnemyDef<ToxicSludgeState>;
  assembly_line: EnemyDef<AssemblyLineState>;
  steam_geyser: EnemyDef<SteamGeyserState>;
  circuit_breaker: EnemyDef<CircuitBreakerState>;
  hazard_bot: EnemyDef<HazardBotState>;
  conveyor_belt: EnemyDef<ConveyorBeltState>;
  furnace_core: EnemyDef<FurnaceCoreState>;
  maintenance_droid: EnemyDef<MaintenanceDroidState>;
  factory_overlord: EnemyDef<FactoryOverlordState>;
  // Haunted Act
  ghost_pirate: EnemyDef<GhostPirateState>;
  zombie_horde: EnemyDef<ZombieHordeState>;
  shadow_lurker: EnemyDef<ShadowLurkerState>;
  banshee_wail: EnemyDef<BansheeWailState>;
  cursed_knight: EnemyDef<CursedKnightState>;
  poltergeist: EnemyDef<PoltergeistState>;
  wraith_stalker: EnemyDef<WraithStalkerState>;
  spectral_hound: EnemyDef<SpectralHoundState>;
  necromancer: EnemyDef<NecromancerState>;
  void_entity: EnemyDef<VoidEntityState>;
  lich_lord: EnemyDef<LichLordState>;
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
  // Desert Act
  scorpion_swarm: scorpionSwarmDef,
  desert_bandit: desertBanditDef,
  sand_worm: sandWormDef,
  mirage_stalker: mirageStalkerDef,
  cactus_thug: cactusThugDef,
  dust_devil: dustDevilDef,
  sun_baked_marauder: sunBakedMarauderDef,
  oasis_serpent: oasisSerpentDef,
  nomad_raider: nomadRaiderDef,
  phoenix_hatchling: phoenixHatchlingDef,
  desert_titan: desertTitanDef,
  // Tundra Act
  frost_wolf: frostWolfDef,
  ice_golem: iceGolemDef,
  snow_yeti: snowYetiDef,
  arctic_fox: arcticFoxDef,
  blizzard_elemental: blizzardElementalDef,
  frozen_marauder: frozenMarauderDef,
  polar_bear: polarBearDef,
  ice_crystal: iceCrystalDef,
  tundra_troll: tundraTrollDef,
  aurora_spirit: auroraSpiritDef,
  frost_giant: frostGiantDef,
  // Industrial Act
  scrap_bot: scrapBotDef,
  welding_drone: weldingDroneDef,
  toxic_sludge: toxicSludgeDef,
  assembly_line: assemblyLineDef,
  steam_geyser: steamGeyserDef,
  circuit_breaker: circuitBreakerDef,
  hazard_bot: hazardBotDef,
  conveyor_belt: conveyorBeltDef,
  furnace_core: furnaceCoreDef,
  maintenance_droid: maintenanceDroidDef,
  factory_overlord: factoryOverlordDef,
  // Haunted Act
  ghost_pirate: ghostPirateDef,
  zombie_horde: zombieHordeDef,
  shadow_lurker: shadowLurkerDef,
  banshee_wail: bansheeWailDef,
  cursed_knight: cursedKnightDef,
  poltergeist: poltergeistDef,
  wraith_stalker: wraithStalkerDef,
  spectral_hound: spectralHoundDef,
  necromancer: necromancerDef,
  void_entity: voidEntityDef,
  lich_lord: lichLordDef,
};

const ENEMY_HP_SCALE = 0.82;
const SWARM_STACK_SCALE = 0.84;

export const ENEMY_IDS: readonly EnemyId[] = [...new Set([
  ...EASY_ENEMIES, ...HARD_ENEMIES, ...BOSS_ENEMIES,
  ...DESERT_EASY_ENEMIES, ...DESERT_HARD_ENEMIES, ...DESERT_BOSS_ENEMIES,
  ...TUNDRA_EASY_ENEMIES, ...TUNDRA_HARD_ENEMIES, ...TUNDRA_BOSS_ENEMIES,
  ...INDUSTRIAL_EASY_ENEMIES, ...INDUSTRIAL_HARD_ENEMIES, ...INDUSTRIAL_BOSS_ENEMIES,
  ...HAUNTED_EASY_ENEMIES, ...HAUNTED_HARD_ENEMIES, ...HAUNTED_BOSS_ENEMIES,
])];

const pickFromPool = (pool: readonly EnemyId[]): EnemyId =>
  pool[(Math.random() * pool.length) | 0] ?? pool[0];

export const generateEncounterOrder = (): EnemyId[][] => {
  const encounters: EnemyId[][] = [];
  const acts = [
    { easy: DESERT_EASY_ENEMIES, hard: DESERT_HARD_ENEMIES, boss: DESERT_BOSS_ENEMIES },
    { easy: TUNDRA_EASY_ENEMIES, hard: TUNDRA_HARD_ENEMIES, boss: TUNDRA_BOSS_ENEMIES },
    { easy: INDUSTRIAL_EASY_ENEMIES, hard: INDUSTRIAL_HARD_ENEMIES, boss: INDUSTRIAL_BOSS_ENEMIES },
    { easy: HAUNTED_EASY_ENEMIES, hard: HAUNTED_HARD_ENEMIES, boss: HAUNTED_BOSS_ENEMIES },
  ];

  for (let floor = 0; floor < PRE_BOSS_FLOOR_COUNT; floor += 1) {
    const actIndex = Math.floor(floor / 2) % acts.length; // 2 floors per act
    const act = acts[actIndex];

    if (floor < EASY_FLOOR_COUNT) {
      encounters.push([pickFromPool(act.easy)]);
      continue;
    }

    const lead = pickFromPool(act.hard);
    const hasSupport = Math.random() < 0.65;
    if (!hasSupport) {
      encounters.push([lead]);
      continue;
    }

    let support = pickFromPool(act.hard);
    if (support === lead) {
      support = pickFromPool(act.easy);
    }
    encounters.push([lead, support]);
  }

  // Add boss encounters for each act
  for (const act of acts) {
    const boss = pickFromPool(act.boss);
    encounters.push([boss]);
  }

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

import {
  CYLINDER_ROTATION_DIRECTION,
  collectCylinderRounds,
  createEmptyCylinder,
  fireCurrentRound,
  loadCylinder,
  rotateCylinder,
  spinCylinder,
} from "./cylinder";
import { ACCESSORY_DEFS } from "./content/accessories";
import { BULLET_DEFS, STARTER_LOADOUT } from "./content/bullets";
import {
  createEnemyState,
  getEnemyCategoryTags,
  getEnemyDef,
  getEnemyIntent,
  getEnemyStateTags,
  getEnemyTraitTags,
} from "./content/enemies";
import { createDeckState, discardBullets, drawBullets } from "./deck";
import { normalizeSeed } from "./rng";
import type {
  AccessoryId,
  BulletType,
  CombatEvent,
  CombatState,
  CombatStepResult,
  EnemyId,
  EnemyState,
  PlayerAction,
  RatSwarmState,
  RiotDroidState,
  SniperState,
  TankState,
  PhantomGunmanState,
} from "./types";

const PLAYER_MAX_HP = 35;
const BLANK_GUARD = 6;
const MAX_COMBO_BONUS = 3;
const OVERHEAT_THRESHOLD = 6;
const PLAYER_DAMAGE_SCALE = 1.2;
const PLAYER_GUARD_SCALE = 1.35;

const emitLog = (events: CombatEvent[], text: string): void => {
  events.push({ type: "log", text });
};

const cloneEnemy = (enemy: EnemyState): EnemyState => {
  switch (enemy.id) {
    case "rat_swarm":
      return { ...enemy };
    case "riot_droid":
      return { ...enemy };
    case "sniper":
      return { ...enemy };
    case "drone":
      return { ...enemy };
    case "mauler_hound":
      return { ...enemy };
    case "field_medic":
      return { ...enemy };
    case "hex_slinger":
      return { ...enemy };
    case "tank":
      return { ...enemy };
    case "phantom_gunman":
      return { ...enemy };
  }
};

const cloneState = (state: CombatState): CombatState => ({
  seed: state.seed,
  turn: state.turn,
  combo: state.combo,
  heat: state.heat,
  scopePrimed: state.scopePrimed,
  practiceTargetPrimed: state.practiceTargetPrimed,
  player: { ...state.player },
  enemy: cloneEnemy(state.enemy),
  enemies: state.enemies.map((enemy) => cloneEnemy(enemy)),
  selectedEnemyIndex: state.selectedEnemyIndex,
  deck: {
    draw: [...state.deck.draw],
    discard: [...state.deck.discard],
  },
  cylinder: {
    chambers: [...state.cylinder.chambers],
    currentIndex: state.cylinder.currentIndex,
    capacity: state.cylinder.capacity,
  },
  accessories: [...state.accessories],
  over: state.over,
  outcome: state.outcome,
});

const hasAccessory = (state: CombatState, accessoryId: AccessoryId): boolean =>
  state.accessories.includes(accessoryId);

type ShotContext = {
  ignoreArmor: boolean;
  ignoreEvasive: boolean;
  bonusDamage: number;
};

const nextRandom = (seed: number): { seed: number; value: number } => {
  const nextSeed = normalizeSeed((Math.imul(seed, 1664525) + 1013904223) >>> 0);
  return {
    seed: nextSeed,
    value: nextSeed / 0xffffffff,
  };
};

const hasArmor = (enemy: EnemyState): boolean =>
  enemy.armor > 0 || Math.max(0, enemy.armor - enemy.shred) > 0;

const effectiveArmor = (enemy: EnemyState): number => Math.max(0, enemy.armor - enemy.shred);

const getEffectiveEnemyTags = (enemy: EnemyState, context: ShotContext): ReturnType<typeof getEnemyStateTags> =>
  getEnemyStateTags(enemy).filter((tag) => {
    if (context.ignoreArmor && (tag === "armored" || tag === "shielded" || tag === "fortified")) {
      return false;
    }
    if (context.ignoreEvasive && tag === "evasive") {
      return false;
    }
    return true;
  });

const hasEffectiveArmor = (enemy: EnemyState, context: ShotContext): boolean =>
  !context.ignoreArmor && hasArmor(enemy);

const syncRatSwarm = (enemy: RatSwarmState): void => {
  enemy.stacks = Math.max(0, enemy.stacks);
  enemy.hp = enemy.stacks;
  enemy.maxHp = Math.max(enemy.maxHp, enemy.stacks);
};

const isEnemyDefeated = (enemy: EnemyState): boolean => {
  if (enemy.id === "rat_swarm") {
    return enemy.stacks <= 0;
  }
  return enemy.hp <= 0;
};

const isEncounterDefeated = (state: CombatState): boolean =>
  state.enemies.every((enemy) => isEnemyDefeated(enemy));

const getEnemyByIndex = (state: CombatState, index: number): EnemyState => {
  const clamped = Math.max(0, Math.min(index, state.enemies.length - 1));
  const enemy = state.enemies[clamped] ?? state.enemies[0];
  state.selectedEnemyIndex = clamped;
  state.enemy = enemy;
  return enemy;
};

const damageEnemy = (
  state: CombatState,
  amount: number,
  source: string,
  events: CombatEvent[],
  ignoreArmor: boolean = false,
): number => {
  const enemy = state.enemy;
  const scaledAmount = Math.max(0, Math.ceil(amount * PLAYER_DAMAGE_SCALE));
  let extra = 0;
  if (enemy.marked) {
    extra += 2;
    enemy.marked = false;
    emitLog(events, "Marked target takes +2 bonus damage.");
  }
  if (enemy.porked) {
    extra += 1;
    enemy.porked = false;
    emitLog(events, "Porked target is destabilized, taking +1 bonus damage.");
  }

  const effectiveAmount = scaledAmount + extra;
  const blocked = ignoreArmor ? 0 : Math.min(effectiveArmor(enemy), effectiveAmount);
  const applied = Math.max(0, effectiveAmount - blocked);
  enemy.hp = Math.max(0, enemy.hp - applied);
  if (enemy.id === "rat_swarm") {
    enemy.stacks = enemy.hp;
    syncRatSwarm(enemy);
  }
  events.push({
    type: "enemy_damaged",
    amount: applied,
    blocked,
    remainingHp: enemy.hp,
    source,
  });
  if (blocked > 0) {
    emitLog(events, `${enemy.label} blocks ${blocked} with armor.`);
  }
  emitLog(events, `${source} deals ${applied} to ${enemy.label}.`);
  return applied;
};

const removeSwarmStacks = (
  enemy: RatSwarmState,
  amount: number,
  events: CombatEvent[],
  source: string,
): number => {
  const removed = Math.min(enemy.stacks, amount);
  enemy.stacks -= removed;
  syncRatSwarm(enemy);
  events.push({
    type: "enemy_damaged",
    amount: removed,
    blocked: 0,
    remainingHp: enemy.hp,
    source,
  });
  emitLog(events, `${source} clears ${removed} swarm stack${removed === 1 ? "" : "s"}.`);
  return removed;
};

const grantGuard = (
  state: CombatState,
  amount: number,
  events: CombatEvent[],
  source: string,
): void => {
  const scaledAmount = Math.max(1, Math.ceil(amount * PLAYER_GUARD_SCALE));
  state.player.guard += scaledAmount;
  events.push({
    type: "guard_gained",
    amount: scaledAmount,
    total: state.player.guard,
  });
  emitLog(events, `${source} grants ${scaledAmount} guard.`);
};

const grantExactGuard = (
  state: CombatState,
  amount: number,
  events: CombatEvent[],
  source: string,
): void => {
  const exactAmount = Math.max(0, amount);
  state.player.guard += exactAmount;
  events.push({
    type: "guard_gained",
    amount: exactAmount,
    total: state.player.guard,
  });
  emitLog(events, `${source} grants ${exactAmount} guard.`);
};

const damagePlayer = (
  state: CombatState,
  amount: number,
  source: string,
  events: CombatEvent[],
  ignoreGuard: boolean = false,
): void => {
  const blocked = ignoreGuard ? 0 : Math.min(state.player.guard, amount);
  const applied = Math.max(0, amount - blocked);
  state.player.guard -= blocked;
  state.player.hp = Math.max(0, state.player.hp - applied);
  events.push({
    type: "player_damaged",
    amount: applied,
    blocked,
    remainingHp: state.player.hp,
    source,
  });
  if (blocked > 0) {
    emitLog(events, `Guard absorbs ${blocked} from ${source}.`);
  }
  emitLog(events, `${source} hits for ${applied}.`);
};

const resetHeat = (state: CombatState): void => {
  state.heat = 0;
};

const resetCombo = (state: CombatState): void => {
  state.combo = 0;
};

const applyShotHeat = (state: CombatState, events: CombatEvent[]): boolean => {
  state.heat += 1;

  if (state.heat >= OVERHEAT_THRESHOLD) {
    emitLog(events, "The revolver is too hot to hold. You lose the next turn while it cools.");
    return true;
  }

  if (state.heat >= 3) {
    const reducedByGloves = hasAccessory(state, "tactical_gloves") ? 1 : 0;
    const heatDamage = Math.max(0, state.heat - 2 - reducedByGloves);
    if (heatDamage > 0) {
      damagePlayer(state, heatDamage, "Revolver Heat", events, true);
    } else if (reducedByGloves > 0) {
      emitLog(events, `${ACCESSORY_DEFS.tactical_gloves.label} absorbs the heat tick.`);
    }
  }

  return false;
};

const buildCombo = (state: CombatState): void => {
  state.combo = Math.min(MAX_COMBO_BONUS, state.combo + 1);
};

const buildShotContext = (state: CombatState, bullet: BulletType): ShotContext => {
  let bonusDamage = 0;

  if (hasAccessory(state, "laser") && state.combo > 0 && state.enemy.id !== "rat_swarm") {
    bonusDamage += 2;
  }

  if (hasAccessory(state, "practice_target") && state.practiceTargetPrimed) {
    bonusDamage += 2;
  }

  return {
    ignoreArmor: state.scopePrimed,
    ignoreEvasive: state.scopePrimed,
    bonusDamage,
  };
};

const logShotContext = (state: CombatState, context: ShotContext, events: CombatEvent[]): void => {
  if (context.ignoreArmor || context.ignoreEvasive) {
    emitLog(events, `${ACCESSORY_DEFS.scope.label} lines up the next shot.`);
  }
  if (hasAccessory(state, "laser") && state.combo > 0 && state.enemy.id !== "rat_swarm") {
    emitLog(events, `${ACCESSORY_DEFS.laser.label} adds +2 damage to the follow-up shot.`);
  }
  if (hasAccessory(state, "practice_target") && state.practiceTargetPrimed) {
    emitLog(events, `${ACCESSORY_DEFS.practice_target.label} boosts the opening shot by +2.`);
  }
};

const maybePrimeScope = (state: CombatState): void => {
  if (hasAccessory(state, "scope")) {
    state.scopePrimed = true;
  }
};

const maybeApplyTacticalVest = (state: CombatState, events: CombatEvent[]): void => {
  if (!hasAccessory(state, "tactical_vest")) {
    return;
  }

  grantExactGuard(state, 4, events, ACCESSORY_DEFS.tactical_vest.label);
};

const applyBeerHeatReduction = (
  state: CombatState,
  previousTurn: number,
  turnAdvance: number,
  events: CombatEvent[],
): void => {
  if (!hasAccessory(state, "beer") || state.heat <= 0) {
    return;
  }

  let reduction = 0;
  for (let offset = 1; offset <= turnAdvance; offset += 1) {
    if ((previousTurn + offset) % 2 === 0) {
      reduction += 1;
    }
  }

  if (reduction <= 0) {
    return;
  }

  const applied = Math.min(reduction, state.heat);
  state.heat -= applied;
  emitLog(events, `${ACCESSORY_DEFS.beer.label} cools the cylinder by ${applied}.`);
};

const maybeAutoReloadFromCargoPants = (state: CombatState, action: PlayerAction, events: CombatEvent[]): void => {
  if (!hasAccessory(state, "cargo_pants") || action === "reload") {
    return;
  }

  const emptyChambers = state.cylinder.chambers.filter((round) => round === null).length;
  const loadedChambers = state.cylinder.chambers.length - emptyChambers;
  if (emptyChambers <= 0 || loadedChambers <= 0) {
    return;
  }

  const rolled = nextRandom(state.seed);
  state.seed = rolled.seed;
  if (rolled.value >= 0.3) {
    return;
  }

  emitLog(events, `${ACCESSORY_DEFS.cargo_pants.label} spills a speed reload into your hand.`);
  performReload(state, events);
};

const applyBlank = (state: CombatState, events: CombatEvent[]): void => {
  grantGuard(state, BLANK_GUARD, events, "Blank");
  if (hasAccessory(state, "shock_padding")) {
    grantGuard(state, 4, events, ACCESSORY_DEFS.shock_padding.label);
  }

  // For TANK, blank also reduces heat
  if (state.enemy.id === "tank") {
    const heatReduced = Math.min(state.heat, 2);
    state.heat -= heatReduced;
    emitLog(events, `Blank vents heat from the revolver. (-${heatReduced} heat)`);
  }

  // For phantom_gunman, blank interrupts aiming
  if (state.enemy.id === "phantom_gunman") {
    const gunman = state.enemy as PhantomGunmanState;
    if (gunman.cycleIndex % 5 === 1) { // Aiming
      gunman.cycleIndex = 2; // Force to exposed
      emitLog(events, "Blank interrupts the shot! Phantom is forced into exposure.");
    }
  }
};

const applyBasic = (state: CombatState, comboBonus: number, context: ShotContext, events: CombatEvent[]): void => {
  damageEnemy(state, 3 + comboBonus + context.bonusDamage, "Revolver Round", events, context.ignoreArmor);
};

const applyHollowPoint = (state: CombatState, comboBonus: number, context: ShotContext, events: CombatEvent[]): void => {
  const tags = getEffectiveEnemyTags(state.enemy, context);
  if (hasEffectiveArmor(state.enemy, context) || tags.includes("armored") || tags.includes("shielded")) {
    damageEnemy(state, 1 + comboBonus + context.bonusDamage, "Hollow Point", events, context.ignoreArmor);
    emitLog(events, "Hollow Point flattens against armor.");
    return;
  }

  if (tags.includes("exposed")) {
    damageEnemy(state, 5 + comboBonus + context.bonusDamage, "Hollow Point", events, context.ignoreArmor);
    emitLog(events, "Hollow Point tears through the exposed weak point.");
    return;
  }

  damageEnemy(state, 3 + comboBonus + context.bonusDamage, "Hollow Point", events, context.ignoreArmor);
};

const applyFrangible = (state: CombatState, comboBonus: number, context: ShotContext, events: CombatEvent[]): void => {
  if (state.enemy.id === "rat_swarm") {
    removeSwarmStacks(state.enemy, 4 + comboBonus + context.bonusDamage, events, "Frangible");
    grantGuard(state, 2, events, "Frangible");
    emitLog(events, "Frangible bursts through the front ranks and keeps you covered.");
    return;
  }

  damageEnemy(state, 2 + comboBonus + context.bonusDamage, "Frangible", events, context.ignoreArmor);
  grantGuard(state, 2, events, "Frangible");
};

const applyTranq = (state: CombatState, comboBonus: number, context: ShotContext, events: CombatEvent[]): void => {
  damageEnemy(state, 1 + comboBonus + context.bonusDamage, "Tranq Dart", events, context.ignoreArmor);
  state.enemy.stun = (state.enemy.stun ?? 0) + 1;
  events.push({ type: "status_applied", target: "enemy", status: "stun", amount: 1, total: state.enemy.stun });
  emitLog(events, "Tranq Dart puts the enemy off-balance.");
};

const applyMark = (state: CombatState, comboBonus: number, context: ShotContext, events: CombatEvent[]): void => {
  damageEnemy(state, comboBonus + context.bonusDamage, "Marking Dart", events, context.ignoreArmor);
  state.enemy.marked = true;
  events.push({ type: "status_applied", target: "enemy", status: "marked", amount: 1, total: 1 });
  emitLog(events, "Target is marked for bonus damage.");
};

const applySeed = (state: CombatState, comboBonus: number, context: ShotContext, events: CombatEvent[]): void => {
  damageEnemy(state, 1 + comboBonus + context.bonusDamage, "Seed Round", events, context.ignoreArmor);
  state.enemy.infestation = (state.enemy.infestation ?? 0) + 2;
  events.push({ type: "status_applied", target: "enemy", status: "infestation", amount: 2, total: state.enemy.infestation });
  emitLog(events, "Seed implant starts to spread infection.");
};

const applyPork = (state: CombatState, comboBonus: number, context: ShotContext, events: CombatEvent[]): void => {
  damageEnemy(state, 1 + comboBonus + context.bonusDamage, "Pork Round", events, context.ignoreArmor);
  state.enemy.porked = true;
  events.push({ type: "status_applied", target: "enemy", status: "porked", amount: 1, total: 1 });
  emitLog(events, "Pork Round destabilizes the target for follow-up attacks.");
};

const applyFlare = (state: CombatState, comboBonus: number, context: ShotContext, events: CombatEvent[]): void => {
  damageEnemy(state, 2 + comboBonus + context.bonusDamage, "Flare Shot", events, context.ignoreArmor);
  state.enemy.burn = (state.enemy.burn ?? 0) + 2;
  events.push({ type: "status_applied", target: "enemy", status: "burn", amount: 2, total: state.enemy.burn });
  emitLog(events, "Flare Shot ignites the target.");
};

const applyExplosive = (state: CombatState, comboBonus: number, context: ShotContext, events: CombatEvent[]): void => {
  const bonus = state.enemy.burn && state.enemy.burn > 0 ? 2 : 0;
  damageEnemy(state, 4 + comboBonus + bonus + context.bonusDamage, "Explosive Round", events, context.ignoreArmor);
  emitLog(events, "Explosive Round detonates on impact.");
  if (bonus > 0) {
    emitLog(events, "Fire intensifies the explosion.");
  }
};

const applyBirdshot = (state: CombatState, comboBonus: number, context: ShotContext, events: CombatEvent[]): void => {
  const extra = hasAccessory(state, "shotgun_mod") ? 1 : 0;
  if (state.enemy.id === "rat_swarm") {
    removeSwarmStacks(state.enemy, 3 + extra + comboBonus + context.bonusDamage, events, "Birdshot");
    return;
  }

  if (state.enemy.id === "tank") {
    const warden = state.enemy as TankState;
    warden.tracksDamaged += 2 + extra + comboBonus;
    damageEnemy(state, 1 + comboBonus + context.bonusDamage, "Birdshot", events, context.ignoreArmor);
    emitLog(events, `Birdshot damages the tracks! (${warden.tracksDamaged} total damage)`);
    if (warden.tracksDamaged >= 5 && warden.cycleIndex % 4 !== 3) {
      // Force into exposed state
      warden.cycleIndex = 3;
      emitLog(events, "The treads buckle! TANK is forced into exposure.");
    }
    return;
  }

  damageEnemy(state, 2 + extra + comboBonus + context.bonusDamage, "Birdshot", events, context.ignoreArmor);
};

const applyBuckshot = (state: CombatState, comboBonus: number, context: ShotContext, events: CombatEvent[]): void => {
  const tags = getEffectiveEnemyTags(state.enemy, context);
  const bonusDamage = hasAccessory(state, "shotgun_mod") ? 1 : 0;

  if (state.enemy.id === "rat_swarm") {
    removeSwarmStacks(state.enemy, 2 + comboBonus + context.bonusDamage, events, "Buckshot");
    return;
  }

  if (state.enemy.id === "riot_droid" && tags.includes("charging")) {
    damageEnemy(state, 6 + bonusDamage + comboBonus + context.bonusDamage, "Buckshot", events, context.ignoreArmor);
    (state.enemy as RiotDroidState).cycleIndex = 3;
    emitLog(events, "Buckshot staggers the droid into cooldown.");
    return;
  }

  if (state.enemy.id === "sniper") {
    damageEnemy(state, 5 + bonusDamage + comboBonus + context.bonusDamage, "Buckshot", events, context.ignoreArmor);
    (state.enemy as SniperState).interrupted = true;
    emitLog(events, "Buckshot blows the sniper off the sightline.");
    return;
  }

  if (tags.includes("exposed")) {
    damageEnemy(state, 9 + bonusDamage + comboBonus + context.bonusDamage, "Buckshot", events, context.ignoreArmor);
    emitLog(events, "Buckshot cashes in on the exposed window.");
    return;
  }

  damageEnemy(state, 4 + bonusDamage + comboBonus + context.bonusDamage, "Buckshot", events, context.ignoreArmor);
};

const applySlug = (state: CombatState, comboBonus: number, context: ShotContext, events: CombatEvent[]): void => {
  const tags = getEffectiveEnemyTags(state.enemy, context);
  const bonusDamage = hasAccessory(state, "shotgun_mod") ? 1 : 0;

  if (state.enemy.id === "rat_swarm") {
    removeSwarmStacks(state.enemy, 1 + comboBonus + context.bonusDamage, events, "Slug");
    return;
  }

  if (state.enemy.id === "tank") {
    if (tags.includes("fortified")) {
      damageEnemy(state, 8 + bonusDamage + comboBonus + context.bonusDamage, "Slug", events, true);
      emitLog(events, "Slug punches through the fortified armor!");
      return;
    }
    damageEnemy(state, 4 + bonusDamage + comboBonus + context.bonusDamage, "Slug", events, context.ignoreArmor);
    return;
  }

  if (state.enemy.id === "phantom_gunman") {
    let damage = 6 + bonusDamage + comboBonus;
    damage += context.bonusDamage;
    if (tags.includes("exposed")) {
      damageEnemy(state, damage, "Slug", events, context.ignoreArmor);
      emitLog(events, "Slug catches Phantom in the open!");
    } else if (tags.includes("hidden")) {
      damageEnemy(state, Math.floor(damage * 0.2), "Slug", events, context.ignoreArmor);
      emitLog(events, "Slug barely grazes through cover.");
    } else {
      damageEnemy(state, Math.floor(damage * 0.5), "Slug", events, context.ignoreArmor);
      emitLog(events, "Slug hits partial cover.");
    }
    return;
  }

  if (tags.includes("evasive")) {
    damageEnemy(state, 1 + bonusDamage + comboBonus + context.bonusDamage, "Slug", events, context.ignoreArmor);
    emitLog(events, "Slug barely clips the evasive target.");
    return;
  }

  if (tags.includes("hover") || tags.includes("steady")) {
    damageEnemy(state, 10 + bonusDamage + comboBonus + context.bonusDamage, "Slug", events, context.ignoreArmor);
    emitLog(events, "Slug lands squarely on the stable target.");
    return;
  }

  damageEnemy(state, 6 + bonusDamage + comboBonus + context.bonusDamage, "Slug", events, context.ignoreArmor);
};

const applyArmorPiercing = (state: CombatState, comboBonus: number, context: ShotContext, events: CombatEvent[]): void => {
  const armoredBonus = hasAccessory(state, "rifle_mod") && hasEffectiveArmor(state.enemy, context) ? 2 : 0;
  const damage = hasEffectiveArmor(state.enemy, context) ? 6 + armoredBonus + comboBonus : 3 + comboBonus;
  damageEnemy(state, damage + context.bonusDamage, "Armor Piercing", events, true);
};

const applyFlechette = (state: CombatState, comboBonus: number, context: ShotContext, events: CombatEvent[]): void => {
  const extraStatus = hasAccessory(state, "rifle_mod") ? 1 : 0;
  if (state.enemy.id === "rat_swarm") {
    removeSwarmStacks(state.enemy, 1 + comboBonus + context.bonusDamage, events, "Flechette");
    state.enemy.infestation += 3 + extraStatus;
    events.push({
      type: "status_applied",
      target: "enemy",
      status: "infestation",
      amount: 3 + extraStatus,
      total: state.enemy.infestation,
    });
    emitLog(events, `Flechette seeds the swarm with ${3 + extraStatus} infestation.`);
    return;
  }

  if (state.enemy.id === "riot_droid") {
    state.enemy.shred += 2 + extraStatus + comboBonus;
    events.push({
      type: "status_applied",
      target: "enemy",
      status: "shred",
      amount: 2 + extraStatus + comboBonus,
      total: state.enemy.shred,
    });
    damageEnemy(state, 1 + comboBonus + context.bonusDamage, "Flechette", events, true);
    emitLog(events, `Flechette strips ${2 + extraStatus + comboBonus} armor layers from future hits.`);
    return;
  }

  damageEnemy(state, 2 + comboBonus + context.bonusDamage, "Flechette", events, context.ignoreArmor);
};

const resolveBullet = (
  state: CombatState,
  bullet: BulletType,
  comboBonus: number,
  context: ShotContext,
  events: CombatEvent[],
): void => {
  switch (bullet) {
    case "basic":
      applyBasic(state, comboBonus, context, events);
      break;
    case "hollow_point":
      applyHollowPoint(state, comboBonus, context, events);
      break;
    case "frangible":
      applyFrangible(state, comboBonus, context, events);
      break;
    case "birdshot":
      applyBirdshot(state, comboBonus, context, events);
      break;
    case "buckshot":
      applyBuckshot(state, comboBonus, context, events);
      break;
    case "slug":
      applySlug(state, comboBonus, context, events);
      break;
    case "armor_piercing":
      applyArmorPiercing(state, comboBonus, context, events);
      break;
    case "flechette":
      applyFlechette(state, comboBonus, context, events);
      break;
    case "tranq":
      applyTranq(state, comboBonus, context, events);
      break;
    case "mark":
      applyMark(state, comboBonus, context, events);
      break;
    case "seed":
      applySeed(state, comboBonus, context, events);
      break;
    case "pork":
      applyPork(state, comboBonus, context, events);
      break;
    case "flare":
      applyFlare(state, comboBonus, context, events);
      break;
    case "explosive":
      applyExplosive(state, comboBonus, context, events);
      break;
    case "blank":
      applyBlank(state, events);
      break;
    default:
      emitLog(events, `No effect for ${bullet}.`);
      break;
  }
};

const fireCurrentChamber = (state: CombatState, events: CombatEvent[]): boolean => {
  const chamberIndex = state.cylinder.currentIndex;
  const fired = fireCurrentRound(state.cylinder);
  state.cylinder = fired.cylinder;
  events.push({ type: "bullet_fired", bullet: fired.bullet, chamberIndex });
  events.push({
    type: "cylinder_changed",
    action: "rotate",
    currentIndex: state.cylinder.currentIndex,
    rotations: 1,
  });

  if (fired.bullet === null) {
    resetCombo(state);
    resetHeat(state);
    emitLog(events, "Dry fire. The chamber clicks empty.");
    emitLog(
      events,
      `Cylinder auto-rotates ${CYLINDER_ROTATION_DIRECTION} to chamber ${state.cylinder.currentIndex + 1}.`,
    );
    return false;
  }

  state.deck = discardBullets(state.deck, [fired.bullet]);
  emitLog(events, `Fire ${BULLET_DEFS[fired.bullet].label}.`);

  const offensiveBullet = fired.bullet !== "blank";
  if (!offensiveBullet) {
    resetCombo(state);
  }
  const comboBonus = offensiveBullet ? state.combo : 0;
  if (comboBonus > 0) {
    emitLog(events, `Combo +${comboBonus} empowers the shot.`);
  }

  const context = buildShotContext(state, fired.bullet);
  logShotContext(state, context, events);
  state.scopePrimed = false;
  state.practiceTargetPrimed = false;
  resolveBullet(state, fired.bullet, comboBonus, context, events);

  if (offensiveBullet) {
    buildCombo(state);
  }

  emitLog(
    events,
    `Cylinder auto-rotates ${CYLINDER_ROTATION_DIRECTION} to chamber ${state.cylinder.currentIndex + 1}.`,
  );
  return applyShotHeat(state, events);
};

const fireActionShots = (state: CombatState, events: CombatEvent[]): boolean => {
  const shots = hasAccessory(state, "instruction_manual") ? 2 : 1;
  for (let shotIndex = 0; shotIndex < shots; shotIndex += 1) {
    const lostTurnToHeat = fireCurrentChamber(state, events);
    if (lostTurnToHeat) {
      return true;
    }
    if (state.cylinder.chambers.every((bullet) => bullet === null)) {
      break;
    }
  }
  return false;
};

const decayEnemyStatuses = (enemy: EnemyState, events: CombatEvent[]): void => {
  if (enemy.shred > 0) {
    enemy.shred = Math.max(0, enemy.shred - 1);
    emitLog(events, "Shred decays by 1.");
  }
};

const finishEncounter = (
  state: CombatState,
  events: CombatEvent[],
  outcome: "victory" | "defeat",
): CombatStepResult => {
  resetCombo(state);
  resetHeat(state);
  state.over = true;
  state.outcome = outcome;
  events.push({ type: "encounter_end", outcome });
  emitLog(events, outcome === "victory" ? "Encounter won." : "You are down.");
  return { state, events };
};

const performReload = (state: CombatState, events: CombatEvent[]): void => {
  resetCombo(state);
  resetHeat(state);
  state.deck = discardBullets(state.deck, collectCylinderRounds(state.cylinder));
  const drawn = drawBullets(state.deck, state.cylinder.capacity, state.seed);
  state.deck = drawn.deck;
  state.seed = drawn.seed;
  state.cylinder = loadCylinder(createEmptyCylinder(state.cylinder.capacity), drawn.bullets);
  state.practiceTargetPrimed = true;
  events.push({
    type: "cylinder_changed",
    action: "reload",
    currentIndex: state.cylinder.currentIndex,
  });
  emitLog(events, `Reload draws ${drawn.bullets.length} round${drawn.bullets.length === 1 ? "" : "s"}.`);
  if (drawn.reshuffled) {
    emitLog(events, "Discard pile reshuffled into the draw pile.");
  }
  if (hasAccessory(state, "quickloader_holster")) {
    grantGuard(state, 3, events, ACCESSORY_DEFS.quickloader_holster.label);
  }
};

export const createCombatState = (
  seed: number,
  enemyIds: EnemyId | EnemyId[],
  loadout: readonly BulletType[] = STARTER_LOADOUT,
  accessories: readonly AccessoryId[] = [],
): CombatState => {
  const normalizedSeed = normalizeSeed(seed);
  const deckResult = createDeckState(loadout, normalizedSeed);
  const encounterEnemyIds = Array.isArray(enemyIds) ? enemyIds : [enemyIds];
  const enemies = encounterEnemyIds.map((enemyId) => createEnemyState(enemyId));
  const cylinderCapacity = accessories.includes("bigger_barrel") ? 8 : 6;
  const baseState: CombatState = {
    seed: deckResult.seed,
    turn: 1,
    combo: 0,
    heat: 0,
    scopePrimed: false,
    practiceTargetPrimed: true,
    player: {
      hp: PLAYER_MAX_HP,
      maxHp: PLAYER_MAX_HP,
      guard: 0,
    },
    enemy: enemies[0] ?? createEnemyState("rat_swarm"),
    enemies,
    selectedEnemyIndex: 0,
    deck: deckResult.deck,
    cylinder: createEmptyCylinder(cylinderCapacity),
    accessories: [...accessories],
    over: false,
    outcome: null,
  };

  const events: CombatEvent[] = [];
  performReload(baseState, events);
  return baseState;
};

const resolveEnemyTurn = (
  state: CombatState,
  events: CombatEvent[],
): "victory" | "defeat" | null => {
  for (let enemyIndex = 0; enemyIndex < state.enemies.length; enemyIndex += 1) {
    const enemy = getEnemyByIndex(state, enemyIndex);
    if (isEnemyDefeated(enemy)) {
      continue;
    }
    const enemyDef = getEnemyDef(enemy);
    enemyDef.onTurnStart?.(state, enemy as never, (event) => events.push(event));

    if (enemy.burn && enemy.burn > 0) {
      damageEnemy(state, 1, "Burn", events);
      enemy.burn -= 1;
      events.push({ type: "status_applied", target: "enemy", status: "burn", amount: 1, total: enemy.burn });
      emitLog(events, "Burn continues to rack the enemy.");
    }

    if (enemy.id !== "rat_swarm" && enemy.infestation && enemy.infestation > 0) {
      damageEnemy(state, 1, "Infestation", events);
      enemy.infestation -= 1;
      events.push({ type: "status_applied", target: "enemy", status: "infestation", amount: 1, total: enemy.infestation });
      emitLog(events, "Infestation spreads in the enemy flesh.");
    }

    if (enemy.stun && enemy.stun > 0) {
      enemy.stun -= 1;
      emitLog(events, `${enemy.label} is stunned and skips its action.`);
      continue;
    }

    if (isEnemyDefeated(enemy)) {
      continue;
    }

    enemyDef.act(state, enemy as never, (event) => events.push(event));
    decayEnemyStatuses(enemy, events);

    if (state.player.hp <= 0) {
      return "defeat";
    }
  }

  if (isEncounterDefeated(state)) {
    return "victory";
  }

  return null;
};

export const stepCombat = (
  state: CombatState,
  action: PlayerAction,
  targetEnemyIndex: number = state.selectedEnemyIndex,
): CombatStepResult => {
  if (state.over) {
    return { state, events: [{ type: "log", text: "Encounter already resolved." }] };
  }

  const nextState = cloneState(state);
  const selectedEnemyIndex = Math.max(0, Math.min(targetEnemyIndex, nextState.enemies.length - 1));
  getEnemyByIndex(nextState, selectedEnemyIndex);
  const events: CombatEvent[] = [];
  events.push({ type: "player_action", action });
  maybeApplyTacticalVest(nextState, events);
  let lostTurnToHeat = false;

  switch (action) {
    case "fire":
      lostTurnToHeat = fireActionShots(nextState, events);
      break;
    case "rotate":
      resetCombo(nextState);
      resetHeat(nextState);
      nextState.cylinder = rotateCylinder(nextState.cylinder);
      maybePrimeScope(nextState);
      events.push({
        type: "cylinder_changed",
        action: "rotate",
        currentIndex: nextState.cylinder.currentIndex,
        rotations: 1,
      });
      emitLog(
        events,
        `Rotate ${CYLINDER_ROTATION_DIRECTION} to chamber ${nextState.cylinder.currentIndex + 1}.`,
      );
      if (hasAccessory(nextState, "spring_ratchet")) {
        grantGuard(nextState, 5, events, ACCESSORY_DEFS.spring_ratchet.label);
      }
      break;
    case "spin": {
      resetCombo(nextState);
      resetHeat(nextState);
      const spun = spinCylinder(nextState.cylinder, nextState.seed);
      nextState.seed = spun.seed;
      nextState.cylinder = spun.cylinder;
      maybePrimeScope(nextState);
      events.push({
        type: "cylinder_changed",
        action: "spin",
        currentIndex: nextState.cylinder.currentIndex,
        rotations: spun.rotations,
      });
      emitLog(
        events,
        `Spin rotates ${CYLINDER_ROTATION_DIRECTION} for ${spun.rotations} chambers.`,
      );
      if (hasAccessory(nextState, "gambling_die")) {
        emitLog(events, `${ACCESSORY_DEFS.gambling_die.label} fires the chamber it lands on.`);
        lostTurnToHeat = fireActionShots(nextState, events);
      }
      break;
    }
    case "reload":
      performReload(nextState, events);
      break;
  }

  if (isEnemyDefeated(nextState.enemy)) {
    emitLog(events, `${nextState.enemy.label} is down.`);
  }

  if (isEncounterDefeated(nextState)) {
    return finishEncounter(nextState, events, "victory");
  }

  maybeAutoReloadFromCargoPants(nextState, action, events);
  if (isEncounterDefeated(nextState)) {
    return finishEncounter(nextState, events, "victory");
  }

  const previousTurn = nextState.turn;
  let turnAdvance = 1;
  const enemyTurnOutcome = resolveEnemyTurn(nextState, events);
  if (enemyTurnOutcome) {
    return finishEncounter(nextState, events, enemyTurnOutcome);
  }

  if (lostTurnToHeat) {
    resetCombo(nextState);
    resetHeat(nextState);
    turnAdvance += 1;
    emitLog(events, "You lose a turn while the revolver cools.");
    const skippedTurnOutcome = resolveEnemyTurn(nextState, events);
    if (skippedTurnOutcome) {
      return finishEncounter(nextState, events, skippedTurnOutcome);
    }
  }

  applyBeerHeatReduction(nextState, previousTurn, turnAdvance, events);
  nextState.turn += turnAdvance;
  getEnemyByIndex(nextState, selectedEnemyIndex);
  events.push({ type: "enemy_intent", intent: getEnemyIntent(nextState.enemy).label });
  return { state: nextState, events };
};

export const describeEnemyMetrics = (enemy: EnemyState): string[] => {
  const lines = [`HP ${enemy.hp}/${enemy.maxHp}`];

  if (enemy.id === "rat_swarm") {
    lines.push(`Stacks ${enemy.stacks}`);
    lines.push(`Infestation ${enemy.infestation}`);
    return lines;
  }

  lines.push(`Armor ${enemy.armor}`);
  if (enemy.shred > 0) {
    lines.push(`Shred ${enemy.shred}`);
  }
  if (enemy.id === "sniper" && enemy.interrupted) {
    lines.push("Interrupted");
  }
  return lines;
};

export const getCombatSnapshot = (state: CombatState) => ({
  turn: state.turn,
  combo: state.combo,
  heat: state.heat,
  outcome: state.outcome,
  player: {
    hp: state.player.hp,
    guard: state.player.guard,
  },
  accessories: [...state.accessories],
  enemy: {
    id: state.enemy.id,
    label: state.enemy.label,
    intent: getEnemyIntent(state.enemy),
    tags: getEnemyStateTags(state.enemy),
    categoryTags: getEnemyCategoryTags(state.enemy),
    traitTags: getEnemyTraitTags(state.enemy),
    metrics: describeEnemyMetrics(state.enemy),
  },
  enemies: state.enemies.map((enemy, index) => ({
    id: enemy.id,
    label: enemy.label,
    intent: getEnemyIntent(enemy),
    tags: getEnemyStateTags(enemy),
    metrics: describeEnemyMetrics(enemy),
    defeated: isEnemyDefeated(enemy),
    selected: index === state.selectedEnemyIndex,
  })),
  selectedEnemyIndex: state.selectedEnemyIndex,
  cylinder: {
    currentIndex: state.cylinder.currentIndex,
    direction: CYLINDER_ROTATION_DIRECTION,
    chambers: [...state.cylinder.chambers],
  },
  deck: {
    draw: state.deck.draw.length,
    discard: state.deck.discard.length,
  },
});

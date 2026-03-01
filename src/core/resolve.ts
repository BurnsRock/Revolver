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
import { createEnemyState, getEnemyDef, getEnemyIntent, getEnemyTags } from "./content/enemies";
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
} from "./types";

const PLAYER_MAX_HP = 28;
const BLANK_GUARD = 6;

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
  }
};

const cloneState = (state: CombatState): CombatState => ({
  seed: state.seed,
  turn: state.turn,
  player: { ...state.player },
  enemy: cloneEnemy(state.enemy),
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

const hasArmor = (enemy: EnemyState): boolean =>
  enemy.armor > 0 || Math.max(0, enemy.armor - enemy.shred) > 0;

const effectiveArmor = (enemy: EnemyState): number => Math.max(0, enemy.armor - enemy.shred);

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

const damageEnemy = (
  state: CombatState,
  amount: number,
  source: string,
  events: CombatEvent[],
  ignoreArmor: boolean = false,
): number => {
  const enemy = state.enemy;
  const blocked = ignoreArmor ? 0 : Math.min(effectiveArmor(enemy), amount);
  const applied = Math.max(0, amount - blocked);
  enemy.hp = Math.max(0, enemy.hp - applied);
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
  state.player.guard += amount;
  events.push({
    type: "guard_gained",
    amount,
    total: state.player.guard,
  });
  emitLog(events, `${source} grants ${amount} guard.`);
};

const applyBlank = (state: CombatState, events: CombatEvent[]): void => {
  grantGuard(state, BLANK_GUARD, events, "Blank");
  if (hasAccessory(state, "shock_padding")) {
    grantGuard(state, 4, events, ACCESSORY_DEFS.shock_padding.label);
  }
};

const applyBirdshot = (state: CombatState, events: CombatEvent[]): void => {
  const extra = hasAccessory(state, "honed_choke") ? 1 : 0;
  if (state.enemy.id === "rat_swarm") {
    removeSwarmStacks(state.enemy, 3 + extra, events, "Birdshot");
    return;
  }
  damageEnemy(state, 2 + extra, "Birdshot", events);
};

const applyBuckshot = (state: CombatState, events: CombatEvent[]): void => {
  const tags = getEnemyTags(state.enemy);
  const bonusDamage = hasAccessory(state, "rifled_tools") ? 1 : 0;

  if (state.enemy.id === "rat_swarm") {
    removeSwarmStacks(state.enemy, 2, events, "Buckshot");
    return;
  }

  if (state.enemy.id === "riot_droid" && tags.includes("charging")) {
    damageEnemy(state, 6 + bonusDamage, "Buckshot", events);
    (state.enemy as RiotDroidState).cycleIndex = 3;
    emitLog(events, "Buckshot staggers the droid into cooldown.");
    return;
  }

  if (state.enemy.id === "sniper") {
    damageEnemy(state, 5 + bonusDamage, "Buckshot", events);
    (state.enemy as SniperState).interrupted = true;
    emitLog(events, "Buckshot blows the sniper off the sightline.");
    return;
  }

  if (tags.includes("exposed")) {
    damageEnemy(state, 9 + bonusDamage, "Buckshot", events);
    emitLog(events, "Buckshot cashes in on the exposed window.");
    return;
  }

  damageEnemy(state, 4 + bonusDamage, "Buckshot", events);
};

const applySlug = (state: CombatState, events: CombatEvent[]): void => {
  const tags = getEnemyTags(state.enemy);
  const bonusDamage = hasAccessory(state, "rifled_tools") ? 1 : 0;

  if (state.enemy.id === "rat_swarm") {
    removeSwarmStacks(state.enemy, 1, events, "Slug");
    return;
  }

  if (tags.includes("evasive")) {
    damageEnemy(state, 1 + bonusDamage, "Slug", events);
    emitLog(events, "Slug barely clips the evasive target.");
    return;
  }

  if (tags.includes("hover") || tags.includes("steady")) {
    damageEnemy(state, 10 + bonusDamage, "Slug", events);
    emitLog(events, "Slug lands squarely on the stable target.");
    return;
  }

  damageEnemy(state, 6 + bonusDamage, "Slug", events);
};

const applyArmorPiercing = (state: CombatState, events: CombatEvent[]): void => {
  const armoredBonus = hasAccessory(state, "tungsten_core") && hasArmor(state.enemy) ? 2 : 0;
  const damage = hasArmor(state.enemy) ? 6 + armoredBonus : 3;
  damageEnemy(state, damage, "Armor Piercing", events, true);
};

const applyFlechette = (state: CombatState, events: CombatEvent[]): void => {
  const extraStatus = hasAccessory(state, "shredder_tools") ? 1 : 0;
  if (state.enemy.id === "rat_swarm") {
    state.enemy.infestation += 2 + extraStatus;
    events.push({
      type: "status_applied",
      target: "enemy",
      status: "infestation",
      amount: 2 + extraStatus,
      total: state.enemy.infestation,
    });
    emitLog(events, `Flechette seeds the swarm with ${2 + extraStatus} infestation.`);
    return;
  }

  if (state.enemy.id === "riot_droid") {
    state.enemy.shred += 2 + extraStatus;
    events.push({
      type: "status_applied",
      target: "enemy",
      status: "shred",
      amount: 2 + extraStatus,
      total: state.enemy.shred,
    });
    damageEnemy(state, 1, "Flechette", events, true);
    emitLog(events, `Flechette strips ${2 + extraStatus} armor layers from future hits.`);
    return;
  }

  damageEnemy(state, 2, "Flechette", events);
};

const resolveBullet = (
  state: CombatState,
  bullet: BulletType,
  events: CombatEvent[],
): void => {
  switch (bullet) {
    case "birdshot":
      applyBirdshot(state, events);
      break;
    case "buckshot":
      applyBuckshot(state, events);
      break;
    case "slug":
      applySlug(state, events);
      break;
    case "armor_piercing":
      applyArmorPiercing(state, events);
      break;
    case "flechette":
      applyFlechette(state, events);
      break;
    case "blank":
      applyBlank(state, events);
      break;
  }
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
  state.over = true;
  state.outcome = outcome;
  events.push({ type: "encounter_end", outcome });
  emitLog(events, outcome === "victory" ? "Encounter won." : "You are down.");
  return { state, events };
};

const performReload = (state: CombatState, events: CombatEvent[]): void => {
  state.deck = discardBullets(state.deck, collectCylinderRounds(state.cylinder));
  const drawn = drawBullets(state.deck, state.cylinder.capacity, state.seed);
  state.deck = drawn.deck;
  state.seed = drawn.seed;
  state.cylinder = loadCylinder(createEmptyCylinder(state.cylinder.capacity), drawn.bullets);
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
  enemyId: EnemyId,
  loadout: readonly BulletType[] = STARTER_LOADOUT,
  accessories: readonly AccessoryId[] = [],
): CombatState => {
  const normalizedSeed = normalizeSeed(seed);
  const deckResult = createDeckState(loadout, normalizedSeed);
  const baseState: CombatState = {
    seed: deckResult.seed,
    turn: 1,
    player: {
      hp: PLAYER_MAX_HP,
      maxHp: PLAYER_MAX_HP,
      guard: 0,
    },
    enemy: createEnemyState(enemyId),
    deck: deckResult.deck,
    cylinder: createEmptyCylinder(),
    accessories: [...accessories],
    over: false,
    outcome: null,
  };

  const events: CombatEvent[] = [];
  performReload(baseState, events);
  return baseState;
};

export const stepCombat = (
  state: CombatState,
  action: PlayerAction,
): CombatStepResult => {
  if (state.over) {
    return { state, events: [{ type: "log", text: "Encounter already resolved." }] };
  }

  const nextState = cloneState(state);
  const events: CombatEvent[] = [];
  events.push({ type: "player_action", action });

  switch (action) {
    case "fire": {
      const chamberIndex = nextState.cylinder.currentIndex;
      const fired = fireCurrentRound(nextState.cylinder);
      nextState.cylinder = fired.cylinder;
      nextState.deck = discardBullets(nextState.deck, [fired.bullet]);
      events.push({ type: "bullet_fired", bullet: fired.bullet, chamberIndex });
      events.push({
        type: "cylinder_changed",
        action: "rotate",
        currentIndex: nextState.cylinder.currentIndex,
        rotations: 1,
      });
      if (fired.bullet === null) {
        emitLog(events, "Dry fire. The chamber clicks empty.");
      } else {
        emitLog(events, `Fire ${BULLET_DEFS[fired.bullet].label}.`);
        resolveBullet(nextState, fired.bullet, events);
      }
      emitLog(
        events,
        `Cylinder auto-rotates ${CYLINDER_ROTATION_DIRECTION} to chamber ${nextState.cylinder.currentIndex + 1}.`,
      );
      break;
    }
    case "rotate":
      nextState.cylinder = rotateCylinder(nextState.cylinder);
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
        grantGuard(nextState, 1, events, ACCESSORY_DEFS.spring_ratchet.label);
      }
      break;
    case "spin": {
      const spun = spinCylinder(nextState.cylinder, nextState.seed);
      nextState.seed = spun.seed;
      nextState.cylinder = spun.cylinder;
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
      break;
    }
    case "reload":
      performReload(nextState, events);
      break;
  }

  if (isEnemyDefeated(nextState.enemy)) {
    return finishEncounter(nextState, events, "victory");
  }

  const enemyDef = getEnemyDef(nextState.enemy);
  enemyDef.onTurnStart?.(nextState, nextState.enemy as never, (event) => events.push(event));

  if (isEnemyDefeated(nextState.enemy)) {
    return finishEncounter(nextState, events, "victory");
  }

  enemyDef.act(nextState, nextState.enemy as never, (event) => events.push(event));
  decayEnemyStatuses(nextState.enemy, events);

  if (isEnemyDefeated(nextState.enemy)) {
    return finishEncounter(nextState, events, "victory");
  }

  if (nextState.player.hp <= 0) {
    return finishEncounter(nextState, events, "defeat");
  }

  nextState.turn += 1;
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
    tags: getEnemyTags(state.enemy),
    metrics: describeEnemyMetrics(state.enemy),
  },
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

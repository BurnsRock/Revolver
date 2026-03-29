import { describe, expect, it } from "vitest";
import { STARTER_LOADOUT, getLoadout } from "./content/bullets";
import {
  ENEMY_IDS,
  createEnemyState,
  getEnemyCategoryTags,
  getEnemyTraitTags,
} from "./content/enemies";
import {
  createEmptyCylinder,
  fireCurrentRound,
  loadCylinder,
  rotateCylinder,
  rotateCylinderBySteps,
  spinCylinder,
  SPIN_ROTATION_MAX,
  SPIN_ROTATION_MIN,
} from "./cylinder";
import { createCombatState, stepCombat } from "./resolve";
import type { BulletType, CombatState } from "./types";

const withBulletReady = (state: CombatState, bullet: BulletType): CombatState => ({
  ...state,
  cylinder: loadCylinder(createEmptyCylinder(state.cylinder.capacity), [bullet]),
  deck: {
    draw: [],
    discard: [],
  },
});

const withLoadedCylinder = (state: CombatState, bullets: BulletType[]): CombatState => ({
  ...state,
  cylinder: loadCylinder(createEmptyCylinder(state.cylinder.capacity), bullets),
  deck: {
    draw: [],
    discard: [],
  },
});

describe("combat matchups", () => {
  it("birdshot clears multiple rat swarm stacks while slug only clears one", () => {
    const birdshotState = withBulletReady(createCombatState(1, "rat_swarm"), "birdshot");
    const slugState = withBulletReady(createCombatState(1, "rat_swarm"), "slug");

    const birdshotResult = stepCombat(birdshotState, "fire");
    const slugResult = stepCombat(slugState, "fire");

    expect(birdshotResult.state.enemy.id).toBe("rat_swarm");
    expect(slugResult.state.enemy.id).toBe("rat_swarm");
    if (birdshotResult.state.enemy.id !== "rat_swarm") {
      throw new Error("Expected rat swarm result for birdshot.");
    }
    if (slugResult.state.enemy.id !== "rat_swarm") {
      throw new Error("Expected rat swarm result for slug.");
    }
    expect(birdshotResult.state.enemy.stacks).toBe(2);
    expect(slugResult.state.enemy.stacks).toBe(4);
  });

  it("armor piercing outperforms slug by more than 2x against a shielded droid", () => {
    const armoredBase = createCombatState(2, "riot_droid");
    armoredBase.enemy.cycleIndex = 1;
    armoredBase.enemy.armor = 6;

    const apResult = stepCombat(withBulletReady(armoredBase, "armor_piercing"), "fire");
    const slugResult = stepCombat(withBulletReady(armoredBase, "slug"), "fire");

    const apDamage = armoredBase.enemy.hp - apResult.state.enemy.hp;
    const slugDamage = armoredBase.enemy.hp - slugResult.state.enemy.hp;

    expect(apDamage).toBeGreaterThan(slugDamage * 2);
  });

  it("buckshot prevents the sniper headshot from landing", () => {
    const sniperState = createCombatState(3, "sniper");
    sniperState.enemy.cycleIndex = 2;

    const result = stepCombat(withBulletReady(sniperState, "buckshot"), "fire");

    expect(result.state.player.hp).toBe(sniperState.player.hp);
    expect(result.state.enemy.id).toBe("sniper");
    if (result.state.enemy.id !== "sniper") {
      throw new Error("Expected sniper result.");
    }
    expect(result.state.enemy.cycleIndex).toBe(0);
  });

  it("tactical vest grants 4 guard at the start of the turn", () => {
    const state = createCombatState(4, "riot_droid", undefined, ["tactical_vest"]);
    state.player.guard = 0;

    const result = stepCombat(state, "rotate");

    expect(result.state.player.guard).toBe(4);
  });

  it("quickloader holster grants guard on reload", () => {
    const state = createCombatState(40, "riot_droid", undefined, ["quickloader_holster"]);
    state.player.guard = 0;

    const result = stepCombat(state, "reload");

    expect(result.state.player.guard).toBe(5);
  });

  it("spring ratchet grants guard on rotate", () => {
    const state = createCombatState(41, "riot_droid", undefined, ["spring_ratchet"]);
    state.player.guard = 0;

    const result = stepCombat(state, "rotate");

    expect(result.state.player.guard).toBe(7);
  });

  it("shock padding adds extra guard to blank shots", () => {
    const state = withBulletReady(createCombatState(42, "drone", undefined, ["shock_padding"]), "blank");

    const result = stepCombat(state, "fire");

    expect(result.state.player.guard).toBe(14);
  });

  it("basic bullet deals standard damage", () => {
    const droidState = createCombatState(6, "riot_droid");
    const result = stepCombat(withBulletReady(droidState, "basic"), "fire");

    expect(result.state.enemy.id).toBe("riot_droid");
    if (result.state.enemy.id !== "riot_droid") {
      throw new Error("Expected riot droid result.");
    }
    expect(result.state.enemy.hp).toBe(droidState.enemy.hp - 4);
  });

  it("scope primes after rotate and lets the next shot punch through armor", () => {
    let state = withLoadedCylinder(
      createCombatState(60, "riot_droid", undefined, ["scope"]),
      ["basic"],
    );
    state.enemy.armor = 6;
    state.enemy.cycleIndex = 1;

    state = stepCombat(state, "rotate").state;
    const result = stepCombat(state, "fire");

    expect(result.state.enemy.hp).toBe(26);
    expect(result.state.scopePrimed).toBe(false);
  });

  it("laser adds damage to consecutive shots but not against rat swarm", () => {
    let droneState = withLoadedCylinder(createCombatState(61, "drone", undefined, ["laser"]), ["basic", "basic"]);
    droneState = stepCombat(droneState, "fire").state;
    const droneFollowUp = stepCombat(droneState, "fire");

    expect(droneFollowUp.state.enemy.hp).toBe(11);

    let swarmState = withLoadedCylinder(createCombatState(62, "rat_swarm", undefined, ["laser"]), ["basic", "basic"]);
    if (swarmState.enemy.id !== "rat_swarm") {
      throw new Error("Expected rat swarm result.");
    }
    swarmState.enemy.hp = 9;
    swarmState.enemy.stacks = 9;
    swarmState.enemy.maxHp = 9;
    swarmState = stepCombat(swarmState, "fire").state;
    const swarmFollowUp = stepCombat(swarmState, "fire");

    expect(swarmFollowUp.state.enemy.hp).toBe(1);
  });

  it("practice target boosts the first shot of combat and refreshes after reload", () => {
    let state = withLoadedCylinder(
      createCombatState(63, "drone", undefined, ["practice_target"]),
      ["basic", "basic"],
    );

    const opener = stepCombat(state, "fire");
    expect(opener.state.enemy.hp).toBe(18);

    state = opener.state;
    const reload = stepCombat(state, "reload");
    expect(reload.state.practiceTargetPrimed).toBe(true);
  });

  it("bigger barrel increases cylinder capacity to 8", () => {
    const state = createCombatState(64, "drone", undefined, ["bigger_barrel"]);

    expect(state.cylinder.capacity).toBe(8);
    expect(state.cylinder.chambers).toHaveLength(8);
  });

  it("instruction manual fires a second shot on fire actions", () => {
    const state = withLoadedCylinder(
      createCombatState(65, "drone", undefined, ["instruction_manual"]),
      ["basic", "basic"],
    );

    const result = stepCombat(state, "fire");

    expect(result.state.combo).toBe(2);
    expect(result.state.enemy.hp).toBe(11);
  });

  it("rat swarm is defeated when generic damage drops hp to zero", () => {
    const swarmState = createCombatState(19, "rat_swarm");
    if (swarmState.enemy.id !== "rat_swarm") {
      throw new Error("Expected rat swarm state.");
    }

    swarmState.enemy.stacks = 1;
    swarmState.enemy.hp = 1;
    swarmState.enemy.maxHp = 1;

    const result = stepCombat(withBulletReady(swarmState, "basic"), "fire");

    expect(result.state.outcome).toBe("victory");
    expect(result.state.over).toBe(true);
  });

  it("starter loadout includes hollow point and frangible without accessories", () => {
    expect(STARTER_LOADOUT).toContain("hollow_point");
    expect(STARTER_LOADOUT).toContain("frangible");
    expect(getLoadout([])).toEqual(STARTER_LOADOUT);
  });

  it("hollow point spikes exposed targets and underperforms into armor", () => {
    const exposedBase = createCombatState(15, "drone");
    exposedBase.enemy.cycleIndex = 3;

    const hollowExposed = stepCombat(withBulletReady(exposedBase, "hollow_point"), "fire");
    const basicExposed = stepCombat(withBulletReady(exposedBase, "basic"), "fire");

    const exposedHollowDamage = exposedBase.enemy.hp - hollowExposed.state.enemy.hp;
    const exposedBasicDamage = exposedBase.enemy.hp - basicExposed.state.enemy.hp;

    expect(exposedHollowDamage).toBeGreaterThan(exposedBasicDamage);

    const armoredBase = createCombatState(16, "riot_droid");
    armoredBase.enemy.armor = 1;
    armoredBase.enemy.cycleIndex = 1;

    const hollowArmored = stepCombat(withBulletReady(armoredBase, "hollow_point"), "fire");
    const basicArmored = stepCombat(withBulletReady(armoredBase, "basic"), "fire");

    const armoredHollowDamage = armoredBase.enemy.hp - hollowArmored.state.enemy.hp;
    const armoredBasicDamage = armoredBase.enemy.hp - basicArmored.state.enemy.hp;

    expect(armoredHollowDamage).toBeLessThan(armoredBasicDamage);
  });

  it("frangible trades damage for guard and clears swarms efficiently", () => {
    const droneBase = createCombatState(17, "drone");
    const frangibleVsDrone = stepCombat(withBulletReady(droneBase, "frangible"), "fire");
    const basicVsDrone = stepCombat(withBulletReady(droneBase, "basic"), "fire");

    const frangibleDamage = droneBase.enemy.hp - frangibleVsDrone.state.enemy.hp;
    const basicDamage = droneBase.enemy.hp - basicVsDrone.state.enemy.hp;

    expect(frangibleDamage).toBeLessThan(basicDamage);
    expect(frangibleVsDrone.state.player.guard).toBe(3);

    const swarmBase = createCombatState(18, "rat_swarm");
    const frangibleVsSwarm = stepCombat(withBulletReady(swarmBase, "frangible"), "fire");

    expect(frangibleVsSwarm.state.enemy.id).toBe("rat_swarm");
    if (frangibleVsSwarm.state.enemy.id !== "rat_swarm") {
      throw new Error("Expected rat swarm result.");
    }
    expect(frangibleVsSwarm.state.enemy.stacks).toBe(1);
    expect(
      frangibleVsSwarm.events.some(
        (event) => event.type === "guard_gained" && event.amount === 3 && event.total === 3,
      ),
    ).toBe(true);
  });

  it("rifle mod increases flechette shred on riot droid", () => {
    const droidState = createCombatState(6, "riot_droid", undefined, ["rifle_mod"]);
    const result = stepCombat(withBulletReady(droidState, "flechette"), "fire");

    expect(result.state.enemy.id).toBe("riot_droid");
    if (result.state.enemy.id !== "riot_droid") {
      throw new Error("Expected riot droid result.");
    }
    expect(result.state.enemy.shred).toBe(2);
  });

  it("combo bonus increases consecutive offensive shots", () => {
    let state = withLoadedCylinder(createCombatState(7, "drone"), ["armor_piercing", "armor_piercing"]);

    const first = stepCombat(state, "fire");
    expect(first.state.combo).toBe(1);
    expect(first.state.enemy.hp).toBe(16);

    state = first.state;
    const second = stepCombat(state, "fire");

    expect(second.state.combo).toBe(2);
    expect(second.state.enemy.hp).toBe(11);
    expect(second.events.some((event) => event.type === "log" && event.text.includes("Combo +1"))).toBe(true);
  });

  it("blank shots break combo", () => {
    let state = withLoadedCylinder(createCombatState(8, "drone"), ["slug", "blank", "slug"]);

    state = stepCombat(state, "fire").state;
    expect(state.combo).toBe(1);

    const blank = stepCombat(state, "fire");

    expect(blank.state.combo).toBe(0);
  });

  it("flechette clears a stack immediately and seeds heavier infestation on rat swarm", () => {
    const swarmState = createCombatState(9, "rat_swarm");
    const result = stepCombat(withBulletReady(swarmState, "flechette"), "fire");

    expect(result.state.enemy.id).toBe("rat_swarm");
    if (result.state.enemy.id !== "rat_swarm") {
      throw new Error("Expected rat swarm result.");
    }
    expect(result.state.enemy.stacks).toBe(3);
    expect(result.state.enemy.infestation).toBe(2);
  });

  it("heat 3 through 5 deals escalating self-damage on consecutive shots", () => {
    let state = withLoadedCylinder(
      createCombatState(10, "riot_droid"),
      ["blank", "blank", "blank", "blank", "blank", "blank"],
    );
    state.enemy.cycleIndex = 3;
    state.player.guard = 99;

    state = stepCombat(state, "fire").state;
    state = stepCombat(state, "fire").state;
    state = stepCombat(state, "fire").state;
    expect(state.heat).toBe(3);
    expect(state.player.hp).toBe(34);

    state = stepCombat(state, "fire").state;
    expect(state.heat).toBe(4);
    expect(state.player.hp).toBe(32);

    state = stepCombat(state, "fire").state;
    expect(state.heat).toBe(5);
    expect(state.player.hp).toBe(29);
  });

  it("tranq bullet stuns enemy for one turn", () => {
    const base = createCombatState(11, "drone");
    base.enemy.cycleIndex = 2; // would be laser damage if not stunned
    const state = withBulletReady(base, "tranq");
    const result = stepCombat(state, "fire");
    expect(result.state.enemy.stun).toBe(0);
    expect(result.state.player.hp).toBe(35); // stun prevented the hit
  });

  it("mark bullet amplifies next hit", () => {
    let state = withLoadedCylinder(createCombatState(12, "drone"), ["mark", "basic"]);
    state = stepCombat(state, "fire").state;
    const after = stepCombat(state, "fire").state;
    expect(after.enemy.hp).toBe(13); // scaled round damage and mark bonus
  });

  it("gambling die turns spin into a shot", () => {
    const state = withLoadedCylinder(createCombatState(66, "drone", undefined, ["gambling_die"]), ["basic"]);

    const result = stepCombat(state, "spin");

    expect(result.events.some((event) => event.type === "bullet_fired" && event.bullet === "basic")).toBe(true);
    expect(result.state.enemy.hp).toBe(20);
  });

  it("safety goggles prevent disruptive guard stripping", () => {
    const state = createCombatState(67, "hex_slinger", undefined, ["safety_goggles"]);
    state.player.guard = 6;
    state.enemy.cycleIndex = 2;

    const result = stepCombat(state, "rotate");

    expect(result.state.player.guard).toBeGreaterThan(0);
  });

  it("cargo pants can auto reload after creating an empty chamber", () => {
    const state = withLoadedCylinder(createCombatState(68, "drone", undefined, ["cargo_pants"]), ["basic", "basic"]);
    state.seed = 1;

    const result = stepCombat(state, "fire");

    expect(result.events.some((event) => event.type === "cylinder_changed" && event.action === "reload")).toBe(true);
  });

  it("seed bullet applies infestation damage over time", () => {
    let state = withLoadedCylinder(createCombatState(13, "drone"), ["seed", "blank"]);
    state = stepCombat(state, "fire").state;
    expect(state.enemy.infestation).toBe(1);
    const after = stepCombat(state, "rotate").state;
    expect(after.enemy.hp).toBeLessThan(state.enemy.hp);
  });

  it("flare and explosive interact with burn", () => {
    let state = withLoadedCylinder(createCombatState(14, "drone"), ["flare", "explosive"]);
    state = stepCombat(state, "fire").state;
    expect(state.enemy.burn).toBeGreaterThan(0);
    const after = stepCombat(state, "fire").state;
    expect(after.enemy.hp).toBeLessThan(state.enemy.hp - 3);
  });

  it("heat 6 skips the next turn and resets back to 0", () => {
    let state = withLoadedCylinder(
      createCombatState(11, "riot_droid"),
      ["blank", "blank", "blank", "blank", "blank", "blank"],
    );
    state.enemy.cycleIndex = 3;
    state.player.guard = 99;

    for (let i = 0; i < 5; i += 1) {
      state = stepCombat(state, "fire").state;
    }

    const result = stepCombat(state, "fire");

    expect(result.state.heat).toBe(0);
    expect(result.state.turn).toBe(state.turn + 2);
    expect(result.state.enemy.id).toBe("riot_droid");
    if (result.state.enemy.id !== "riot_droid") {
      throw new Error("Expected riot droid result.");
    }
    expect(result.state.enemy.cycleIndex).toBe(2);
    expect(result.events.some((event) => event.type === "log" && event.text.includes("too hot to hold"))).toBe(
      true,
    );
  });

  it("non-fire actions reset heat", () => {
    let state = withLoadedCylinder(createCombatState(12, "riot_droid"), ["blank", "blank", "blank"]);
    state.enemy.cycleIndex = 3;
    state.player.guard = 99;

    state = stepCombat(state, "fire").state;
    state = stepCombat(state, "fire").state;
    expect(state.heat).toBe(2);

    const rotated = stepCombat(state, "rotate");

    expect(rotated.state.heat).toBe(0);
  });

  it("tactical gloves reduce each heat tick by 1", () => {
    let state = withLoadedCylinder(
      createCombatState(69, "riot_droid", undefined, ["tactical_gloves"]),
      ["blank", "blank", "blank"],
    );
    state.enemy.cycleIndex = 3;
    state.player.guard = 99;

    state = stepCombat(state, "fire").state;
    state = stepCombat(state, "fire").state;
    state = stepCombat(state, "fire").state;

    expect(state.heat).toBe(3);
    expect(state.player.hp).toBe(35);
  });
});

describe("enemy roster", () => {
  it("every enemy exposes at least one category tag and one trait tag", () => {
    for (const enemyId of ENEMY_IDS) {
      const enemy = createEnemyState(enemyId);
      expect(getEnemyCategoryTags(enemy).length).toBeGreaterThan(0);
      expect(getEnemyTraitTags(enemy).length).toBeGreaterThan(0);
    }
  });

  it("new enemies expose the intended static tags", () => {
    expect(getEnemyCategoryTags(createEnemyState("mauler_hound"))).toEqual(["beast"]);
    expect(getEnemyTraitTags(createEnemyState("mauler_hound"))).toEqual(["charging", "evasive"]);

    expect(getEnemyCategoryTags(createEnemyState("field_medic"))).toEqual(["human"]);
    expect(getEnemyTraitTags(createEnemyState("field_medic"))).toEqual(["support", "ranged"]);

    expect(getEnemyCategoryTags(createEnemyState("hex_slinger"))).toEqual(["supernatural"]);
    expect(getEnemyTraitTags(createEnemyState("hex_slinger"))).toEqual(["disruptor", "elite", "ranged"]);
  });

  it("field medic heals during triage", () => {
    const state = createCombatState(19, "field_medic");

    state.enemy.hp = 20;
    state.enemy.cycleIndex = 0;

    const result = stepCombat(state, "rotate");

    expect(result.state.enemy.id).toBe("field_medic");
    if (result.state.enemy.id !== "field_medic") {
      throw new Error("Expected field medic result.");
    }
    expect(result.state.enemy.hp).toBe(21);
  });

  it("hex slinger strips guard before the curse lands", () => {
    const state = createCombatState(20, "hex_slinger");

    state.player.guard = 6;
    state.enemy.cycleIndex = 2;

    const result = stepCombat(state, "rotate");

    expect(result.state.enemy.id).toBe("hex_slinger");
    if (result.state.enemy.id !== "hex_slinger") {
      throw new Error("Expected hex slinger result.");
    }
    expect(result.state.player.guard).toBe(0);
    expect(result.state.player.hp).toBe(32);
  });
});

describe("cylinder rotation", () => {
  it("auto-rotates after firing and skips empty chambers", () => {
    const cylinder = {
      chambers: ["birdshot", null, "slug", null, "blank", null] satisfies Array<BulletType | null>,
      currentIndex: 0,
      capacity: 6,
    };

    const fired = fireCurrentRound(cylinder);

    expect(fired.bullet).toBe("birdshot");
    expect(fired.cylinder.currentIndex).toBe(2);
    expect(fired.cylinder.chambers[0]).toBeNull();
  });

  it("manual rotate skips empty chambers clockwise", () => {
    const cylinder = {
      chambers: [null, "birdshot", null, "blank", "slug", null] satisfies Array<BulletType | null>,
      currentIndex: 4,
      capacity: 6,
    };

    expect(rotateCylinder(cylinder).currentIndex).toBe(1);
  });

  it("spin rotates a random number of steps within the configured range", () => {
    const cylinder = {
      chambers: ["birdshot", null, "buckshot", null, "blank", null] satisfies Array<BulletType | null>,
      currentIndex: 0,
      capacity: 6,
    };

    const spun = spinCylinder(cylinder, 12345);

    expect(spun.rotations).toBeGreaterThanOrEqual(SPIN_ROTATION_MIN);
    expect(spun.rotations).toBeLessThanOrEqual(SPIN_ROTATION_MAX);
    expect(spun.cylinder.currentIndex).toBe(
      rotateCylinderBySteps(cylinder, spun.rotations).currentIndex,
    );
  });
});

import { describe, expect, it } from "vitest";
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
  cylinder: loadCylinder(createEmptyCylinder(), [bullet]),
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
    expect(birdshotResult.state.enemy.stacks).toBe(3);
    expect(slugResult.state.enemy.stacks).toBe(5);
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

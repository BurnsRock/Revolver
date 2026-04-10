import { shuffleWithSeed } from "../rng";
import type { AccessoryDef, AccessoryId } from "../types";

export const ACCESSORY_ORDER: AccessoryId[] = [
  "spring_ratchet",
  "quickloader_holster",
  "shock_padding",
  "scope",
  "laser",
  "practice_target",
  "bigger_barrel",
  "gambling_die",
  "beer",
  "instruction_manual",
  "tactical_vest",
  "safety_goggles",
  "cargo_pants",
  "rifle_mod",
  "shotgun_mod",
  "hunter_mod",
  "tactical_gloves",
  "pyrotechnics_mod",
];

const ACCESSORY_RARITY_WEIGHTS: Record<AccessoryDef["rarity"], number> = {
  common: 6,
  uncommon: 3,
  rare: 1,
};

export const ACCESSORY_DEFS: Record<AccessoryId, AccessoryDef> = {
  spring_ratchet: {
    id: "spring_ratchet",
    label: "Spring Ratchet",
    price: 10,
    rarity: "common",
    description: "Rewards setup turns.",
    effect: "Rotate: gain 5 guard.",
  },
  quickloader_holster: {
    id: "quickloader_holster",
    label: "Quickloader Holster",
    price: 12,
    rarity: "common",
    description: "Reload safely.",
    effect: "Reload: gain 3 guard.",
  },
  shock_padding: {
    id: "shock_padding",
    label: "Shock Padding",
    price: 14,
    rarity: "uncommon",
    description: "Blanks give more cover.",
    effect: "Blank: +4 guard.",
  },
  scope: {
    id: "scope",
    label: "Scope",
    price: 14,
    rarity: "uncommon",
    description: "Setup improves one shot.",
    effect: "After Rotate or Spin, next shot ignores armor and evasion.",
  },
  laser: {
    id: "laser",
    label: "Laser",
    price: 13,
    rarity: "common",
    description: "Rewards firing streaks.",
    effect: "Consecutive offensive shots deal +2 damage. No bonus vs. swarms.",
  },
  practice_target: {
    id: "practice_target",
    label: "Practice Target",
    price: 12,
    rarity: "common",
    description: "Boosts opening shots.",
    effect: "First shot each combat and after reload deals +2 damage.",
  },
  bigger_barrel: {
    id: "bigger_barrel",
    label: "Bigger Barrel",
    price: 16,
    rarity: "rare",
    description: "Fits more rounds.",
    effect: "Cylinder size increases from 6 to 8.",
  },
  gambling_die: {
    id: "gambling_die",
    label: "Gambling Die",
    price: 15,
    rarity: "rare",
    description: "Spin becomes a shot.",
    effect: "Spin fires the landed chamber.",
  },
  beer: {
    id: "beer",
    label: "Beer",
    price: 11,
    rarity: "common",
    description: "Cools the barrel.",
    effect: "Every 2 turns, reduce heat by 1.",
  },
  instruction_manual: {
    id: "instruction_manual",
    label: "Instruction Manual",
    price: 18,
    rarity: "rare",
    description: "Teaches reckless speed.",
    effect: "When you fire, fire again immediately.",
  },
  tactical_vest: {
    id: "tactical_vest",
    label: "Tactical Vest",
    price: 15,
    rarity: "uncommon",
    description: "Start each turn braced.",
    effect: "Start each turn with 4 guard.",
  },
  safety_goggles: {
    id: "safety_goggles",
    label: "Safety Goggles",
    price: 12,
    rarity: "uncommon",
    description: "Blocks enemy disruption.",
    effect: "Prevent enemy disruption effects.",
  },
  cargo_pants: {
    id: "cargo_pants",
    label: "Cargo Pants",
    price: 14,
    rarity: "uncommon",
    description: "Sometimes reloads itself.",
    effect: "30% chance to auto-reload if any chamber is empty.",
  },
  rifle_mod: {
    id: "rifle_mod",
    label: "Rifle Mod",
    price: 16,
    rarity: "uncommon",
    description: "Adds rifle rounds.",
    effect: "Unlocks Armor Piercing and Flechette.",
    unlocks: ["armor_piercing", "flechette"],
  },
  shotgun_mod: {
    id: "shotgun_mod",
    label: "Shotgun Mod",
    price: 15,
    rarity: "common",
    description: "Adds shotgun rounds.",
    effect: "Unlocks Birdshot, Buckshot, and Slug.",
    unlocks: ["birdshot", "buckshot", "slug"],
  },
  hunter_mod: {
    id: "hunter_mod",
    label: "Hunter's Mod",
    price: 17,
    rarity: "rare",
    description: "Adds hunting rounds.",
    effect: "Unlocks Tranq Dart, Marking Dart, Seed Round, and Pork Round.",
    unlocks: ["tranq", "mark", "seed", "pork"],
  },
  tactical_gloves: {
    id: "tactical_gloves",
    label: "Tactical Gloves",
    price: 13,
    rarity: "common",
    description: "Reduces heat burn.",
    effect: "Heat deals 1 less damage per tick.",
  },
  pyrotechnics_mod: {
    id: "pyrotechnics_mod",
    label: "Pyrotechnics Mod",
    price: 15,
    rarity: "uncommon",
    description: "Adds explosive rounds.",
    effect: "Unlocks Flare Shot and Explosive Round.",
    unlocks: ["flare", "explosive"],
  },
};

export const createShopStock = (
  seed: number,
  ownedAccessories: readonly AccessoryId[],
  count: number = 3,
): { seed: number; stock: AccessoryId[] } => {
  const available = ACCESSORY_ORDER.filter((accessoryId) => !ownedAccessories.includes(accessoryId));
  const weightedAvailable = available.flatMap((accessoryId) =>
    Array.from(
      { length: ACCESSORY_RARITY_WEIGHTS[ACCESSORY_DEFS[accessoryId].rarity] },
      () => accessoryId,
    ),
  );
  const shuffled = shuffleWithSeed(seed, weightedAvailable);
  const stock: AccessoryId[] = [];
  for (const accessoryId of shuffled.values) {
    if (stock.includes(accessoryId)) {
      continue;
    }
    stock.push(accessoryId);
    if (stock.length >= count) {
      break;
    }
  }
  return {
    seed: shuffled.seed,
    stock,
  };
};

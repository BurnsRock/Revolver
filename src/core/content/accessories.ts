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
    description: "A smoother cylinder hand that rewards setup turns.",
    effect: "Rotate grants 5 guard.",
  },
  quickloader_holster: {
    id: "quickloader_holster",
    label: "Quickloader Holster",
    price: 12,
    rarity: "common",
    description: "A practiced reload that keeps you covered while feeding rounds.",
    effect: "Reload grants 3 guard.",
  },
  shock_padding: {
    id: "shock_padding",
    label: "Shock Padding",
    price: 14,
    rarity: "uncommon",
    description: "Recoil baffles that turn blanks into real protection.",
    effect: "Blank grants +4 extra guard.",
  },
  scope: {
    id: "scope",
    label: "Scope",
    price: 14,
    rarity: "uncommon",
    description: "Rewards setup turns with one surgically accurate shot.",
    effect: "After Rotate or Spin, the next shot ignores armor and evasive penalties.",
  },
  laser: {
    id: "laser",
    label: "Laser",
    price: 13,
    rarity: "common",
    description: "Locks onto a target once you keep firing without breaking rhythm.",
    effect: "Consecutive offensive shots deal +2 damage. No bonus against swarms.",
  },
  practice_target: {
    id: "practice_target",
    label: "Practice Target",
    price: 12,
    rarity: "common",
    description: "Turns your first shot after setup into a cleaner opener.",
    effect: "The first bullet fired each combat, and the first bullet after each reload, deals +2 damage.",
  },
  bigger_barrel: {
    id: "bigger_barrel",
    label: "Bigger Barrel",
    price: 16,
    rarity: "rare",
    description: "A stretched cylinder that packs in more rounds before you need to reload.",
    effect: "Cylinder capacity increases from 6 to 8.",
  },
  gambling_die: {
    id: "gambling_die",
    label: "Gambling Die",
    price: 15,
    rarity: "rare",
    description: "You stop spinning for information and start spinning for blood.",
    effect: "Spin automatically fires the chamber it lands on.",
  },
  beer: {
    id: "beer",
    label: "Beer",
    price: 11,
    rarity: "common",
    description: "A steady sip takes the edge off the barrel heat.",
    effect: "Every 2 turns, reduce heat by 1.",
  },
  instruction_manual: {
    id: "instruction_manual",
    label: "Instruction Manual",
    price: 18,
    rarity: "rare",
    description: "A page on fanning the hammer that should probably stay theoretical.",
    effect: "When you fire, immediately fire a second time.",
  },
  tactical_vest: {
    id: "tactical_vest",
    label: "Tactical Vest",
    price: 15,
    rarity: "uncommon",
    description: "Layered plating that keeps you braced at the start of every exchange.",
    effect: "Gain 4 guard at the start of every turn.",
  },
  safety_goggles: {
    id: "safety_goggles",
    label: "Safety Goggles",
    price: 12,
    rarity: "uncommon",
    description: "Keeps your sight picture stable when enemies try to throw you off.",
    effect: "Enemy disruption effects are prevented.",
  },
  cargo_pants: {
    id: "cargo_pants",
    label: "Cargo Pants",
    price: 14,
    rarity: "uncommon",
    description: "Loose pockets, loose rounds, surprisingly fast reloads.",
    effect: "30% chance to auto-reload when the cylinder has at least 1 empty chamber.",
  },
  rifle_mod: {
    id: "rifle_mod",
    label: "Rifle Mod",
    price: 16,
    rarity: "uncommon",
    description: "Precision rifle modifications for long-range accuracy.",
    effect: "Unlocks Armor Piercing and Flechette ammo.",
    unlocks: ["armor_piercing", "flechette"],
  },
  shotgun_mod: {
    id: "shotgun_mod",
    label: "Shotgun Mod",
    price: 15,
    rarity: "common",
    description: "A versatile shotgun conversion for close-quarters combat.",
    effect: "Unlocks Birdshot, Buckshot, and Slug ammo.",
    unlocks: ["birdshot", "buckshot", "slug"],
  },
  hunter_mod: {
    id: "hunter_mod",
    label: "Hunter's Mod",
    price: 17,
    rarity: "rare",
    description: "Experimental hunting gear that opens up darts, marks, and bio-rounds.",
    effect: "Unlocks Tranq Dart, Marking Dart, Seed Round, and Pork Round ammo.",
    unlocks: ["tranq", "mark", "seed", "pork"],
  },
  tactical_gloves: {
    id: "tactical_gloves",
    label: "Tactical Gloves",
    price: 13,
    rarity: "common",
    description: "Heat-shielded grip tape that takes some of the bite out of recoil burn.",
    effect: "Revolver heat deals 1 less damage each tick.",
  },
  pyrotechnics_mod: {
    id: "pyrotechnics_mod",
    label: "Pyrotechnics Mod",
    price: 15,
    rarity: "uncommon",
    description: "A black-market flare rack and impact detonator assembly.",
    effect: "Unlocks Flare Shot and Explosive Round ammo.",
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

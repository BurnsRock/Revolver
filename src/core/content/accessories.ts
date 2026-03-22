import { shuffleWithSeed } from "../rng";
import type { AccessoryDef, AccessoryId } from "../types";

export const ACCESSORY_ORDER: AccessoryId[] = [
  "spring_ratchet",
  "quickloader_holster",
  "shock_padding",
  "shotgun_mod",
  "rifle_mod",
  "hunter_mod",
  "bioweapon_mod",
  "pyrotechnics_mod",
];

export const ACCESSORY_DEFS: Record<AccessoryId, AccessoryDef> = {
  spring_ratchet: {
    id: "spring_ratchet",
    label: "Spring Ratchet",
    price: 10,
    description: "A smoother cylinder hand that rewards setup turns.",
    effect: "Rotate grants 5 guard.",
  },
  quickloader_holster: {
    id: "quickloader_holster",
    label: "Quickloader Holster",
    price: 12,
    description: "A practiced reload that keeps you covered while feeding rounds.",
    effect: "Reload grants 3 guard.",
  },
  shock_padding: {
    id: "shock_padding",
    label: "Shock Padding",
    price: 14,
    description: "Recoil baffles that turn blanks into real protection.",
    effect: "Blank grants +4 extra guard.",
  },

  shotgun_mod: {
    id: "shotgun_mod",
    label: "Shotgun Mod",
    price: 15,
    description: "A versatile shotgun kit for close-quarters combat.",
    effect: "Shotgun shells deal +1 damage and have improved spread.",
    unlocks: ["birdshot", "buckshot", "slug"],
  },
  rifle_mod: {
    id: "rifle_mod",
    label: "Rifle Mod",
    price: 16,
    description: "Precision rifle modifications for long-range accuracy.",
    effect: "Rifle rounds pierce armor and shred defenses.",
    unlocks: ["armor_piercing", "flechette"],
  },
  hunter_mod: {
    id: "hunter_mod",
    label: "Hunter Mod",
    price: 14,
    description: "Specialized hunting tools for tracking and sedation.",
    effect: "Hunter darts mark targets and sedate enemies.",
    unlocks: ["tranq", "mark"],
  },
  bioweapon_mod: {
    id: "bioweapon_mod",
    label: "Bioweapon Mod",
    price: 17,
    description: "Experimental biological ammunition.",
    effect: "Bioweapons cause infestation and variable damage.",
    unlocks: ["seed", "pork"],
  },
  pyrotechnics_mod: {
    id: "pyrotechnics_mod",
    label: "Pyrotechnics Mod",
    price: 15,
    description: "Fireworks and explosives for dramatic effect.",
    effect: "Pyrotechnic rounds illuminate and detonate on impact.",
    unlocks: ["flare", "explosive"],
  },
};

export const createShopStock = (
  seed: number,
  ownedAccessories: readonly AccessoryId[],
  count: number = 3,
): { seed: number; stock: AccessoryId[] } => {
  const available = ACCESSORY_ORDER.filter((accessoryId) => !ownedAccessories.includes(accessoryId));
  const shuffled = shuffleWithSeed(seed, available);
  return {
    seed: shuffled.seed,
    stock: shuffled.values.slice(0, count),
  };
};

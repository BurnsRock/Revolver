import { shuffleWithSeed } from "../rng";
import type { AccessoryDef, AccessoryId } from "../types";

export const ACCESSORY_ORDER: AccessoryId[] = [
  "spring_ratchet",
  "quickloader_holster",
  "shock_padding",
  "rifled_tools",
  "shredder_tools",
  "tungsten_core",
  "honed_choke",
];

export const ACCESSORY_DEFS: Record<AccessoryId, AccessoryDef> = {
  spring_ratchet: {
    id: "spring_ratchet",
    label: "Spring Ratchet",
    price: 10,
    description: "A smoother cylinder hand that rewards setup turns.",
    effect: "Rotate grants 1 guard.",
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
  rifled_tools: {
    id: "rifled_tools",
    label: "Rifled Tools",
    price: 15,
    description: "A tune-up kit for heavier shells.",
    effect: "Slug and Buckshot deal +1 damage.",
  },
  shredder_tools: {
    id: "shredder_tools",
    label: "Shredder Tools",
    price: 15,
    description: "Barbed inserts that make flechettes cling and tear.",
    effect: "Flechette adds +1 shred or +1 infestation.",
  },
  tungsten_core: {
    id: "tungsten_core",
    label: "Tungsten Core",
    price: 16,
    description: "Dense penetrators tuned for plating and riot shields.",
    effect: "Armor Piercing gains +2 damage against armored targets.",
  },
  honed_choke: {
    id: "honed_choke",
    label: "Honed Choke",
    price: 13,
    description: "A tighter spread for better pellet concentration.",
    effect: "Birdshot clears +1 extra swarm stack or deals +1 damage.",
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

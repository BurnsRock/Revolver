import type { AccessoryId, BulletDef, BulletType } from "../types";
import { ACCESSORY_DEFS } from "./accessories";

export const STARTER_LOADOUT: BulletType[] = [
  "basic",
  "basic",
  "basic",
  "basic",
  "basic",
  "blank",
];

export const getLoadout = (
  ownedAccessories: readonly AccessoryId[],
): BulletType[] => {
  const unlockedBullets = new Set<BulletType>(["basic", "blank"]);
  for (const accessoryId of ownedAccessories) {
    const def = ACCESSORY_DEFS[accessoryId];
    if (def.unlocks) {
      for (const bullet of def.unlocks) {
        unlockedBullets.add(bullet);
      }
    }
  }
  // For each unlocked bullet, add 2 copies, except basic and blank which have more
  const loadout: BulletType[] = [];
  for (const bullet of unlockedBullets) {
    if (bullet === "basic") {
      loadout.push("basic", "basic", "basic", "basic", "basic");
    } else if (bullet === "blank") {
      loadout.push("blank");
    } else {
      loadout.push(bullet, bullet);
    }
  }
  return loadout;
};

export const BULLET_DEFS: Record<BulletType, BulletDef> = {
  basic: {
    id: "basic",
    label: "Revolver Round",
    shortLabel: "BSC",
    description: "Standard issue round. Reliable and consistent.",
    matchup: "No bonuses or penalties.",
  },
  birdshot: {
    id: "birdshot",
    label: "Birdshot",
    shortLabel: "BRD",
    description: "Wide spread. Low single-target damage, brutal into swarms.",
    matchup: "Best into swarms. Weak into armor.",
  },
  buckshot: {
    id: "buckshot",
    label: "Buckshot",
    shortLabel: "BCK",
    description: "Burst shell that staggers exposed or winding-up targets.",
    matchup: "Best into charging or exposed enemies.",
  },
  slug: {
    id: "slug",
    label: "Slug",
    shortLabel: "SLG",
    description: "Single heavy hit. Great against steady targets.",
    matchup: "Best into hover or steady. Reduced by evasive targets.",
  },
  armor_piercing: {
    id: "armor_piercing",
    label: "Armor Piercing",
    shortLabel: "AP",
    description: "Punches straight through shield and armor layers.",
    matchup: "Best into armor. Mediocre when armor is absent.",
  },
  flechette: {
    id: "flechette",
    label: "Flechette",
    shortLabel: "FLC",
    description:
      "Low upfront damage that strips plating or seeds a damage-over-time effect.",
    matchup: "Best as setup into armored or stacked targets.",
  },
  blank: {
    id: "blank",
    label: "Blank",
    shortLabel: "BLK",
    description: "No damage. Converts the turn into guard.",
    matchup: "Best when you know a big hit is coming.",
  },
  tranq: {
    id: "tranq",
    label: "Tranq Dart",
    shortLabel: "TRQ",
    description: "Sedates the target, reducing or skipping its next action.",
    matchup: "Best for control and interrupting dangerous enemies.",
  },
  mark: {
    id: "mark",
    label: "Marking Dart",
    shortLabel: "MRK",
    description: "Marks a target, causing the next hit to deal bonus damage.",
    matchup: "Best used before high-damage shots.",
  },
  seed: {
    id: "seed",
    label: "Seed Round",
    shortLabel: "SED",
    description: "Infects the target, dealing damage over time.",
    matchup: "Best in longer fights or against tanky enemies.",
  },
  pork: {
    id: "pork",
    label: "Pork Round",
    shortLabel: "PRK",
    description:
      "Baits or destabilizes the target, amplifying follow-up effects.",
    matchup: "Best used to spread or amplify effects like infection.",
  },
  flare: {
    id: "flare",
    label: "Flare Shot",
    shortLabel: "FLR",
    description: "Ignites the target, applying burn over time.",
    matchup: "Best for sustained damage and setting up explosions.",
  },
  explosive: {
    id: "explosive",
    label: "Explosive Round",
    shortLabel: "EXP",
    description: "Deals damage on impact and splashes nearby enemies.",
    matchup: "Best against groups or burning targets.",
  },
};

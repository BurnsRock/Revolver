import type { AccessoryId, BulletDef, BulletType } from "../types";
import { ACCESSORY_DEFS } from "./accessories";

const BASE_UNLOCKED_BULLETS: readonly BulletType[] = ["basic", "blank", "hollow_point", "frangible"];
export const MAX_LOADOUT_BULLETS = 8;

const buildLoadout = (unlockedBullets: Iterable<BulletType>): BulletType[] => {
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

export const STARTER_LOADOUT: BulletType[] = buildLoadout(BASE_UNLOCKED_BULLETS);

export const getUnlockedBullets = (
  ownedAccessories: readonly AccessoryId[],
): BulletType[] => {
  const unlockedBullets = new Set<BulletType>(BASE_UNLOCKED_BULLETS);
  for (const accessoryId of ownedAccessories) {
    const def = ACCESSORY_DEFS[accessoryId];
    if (def.unlocks) {
      for (const bullet of def.unlocks) {
        unlockedBullets.add(bullet);
      }
    }
  }
  return [...unlockedBullets];
};

export const getDefaultAmmoLoadout = (
  ownedAccessories: readonly AccessoryId[],
): BulletType[] => getUnlockedBullets(ownedAccessories).slice(0, MAX_LOADOUT_BULLETS);

export const expandAmmoLoadout = (
  selectedBullets: readonly BulletType[],
): BulletType[] => {
  return buildLoadout(selectedBullets);
};

export const normalizeAmmoLoadout = (
  selectedBullets: readonly BulletType[],
  ownedAccessories: readonly AccessoryId[],
): BulletType[] => {
  const unlocked = new Set<BulletType>(getUnlockedBullets(ownedAccessories));
  const filtered: BulletType[] = [];
  for (const bullet of selectedBullets) {
    if (!unlocked.has(bullet) || filtered.includes(bullet)) {
      continue;
    }
    filtered.push(bullet);
    if (filtered.length >= MAX_LOADOUT_BULLETS) {
      break;
    }
  }
  if (filtered.length > 0) {
    return filtered;
  }
  return getDefaultAmmoLoadout(ownedAccessories);
};

export const getLoadout = (
  ownedAccessories: readonly AccessoryId[],
): BulletType[] => {
  return buildLoadout(getUnlockedBullets(ownedAccessories));
};

export const BULLET_DEFS: Record<BulletType, BulletDef> = {
  basic: {
    id: "basic",
    label: "Revolver Round",
    shortLabel: "BSC",
    description: "Standard issue round. Reliable and consistent.",
    matchup: "No bonuses or penalties.",
  },
  hollow_point: {
    id: "hollow_point",
    label: "Hollow Point",
    shortLabel: "HLP",
    description: "Expands hard in soft tissue but crumples against heavy plating.",
    matchup: "Best into exposed targets. Poor into armor.",
  },
  frangible: {
    id: "frangible",
    label: "Frangible",
    shortLabel: "FRG",
    description: "Light composite round that sheds into crowds and leaves you a little safer.",
    matchup: "Best into swarms. Lower direct damage, but grants a bit of guard.",
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

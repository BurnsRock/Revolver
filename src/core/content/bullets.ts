import type { BulletDef, BulletType } from "../types";

export const STARTER_LOADOUT: BulletType[] = [
  "birdshot",
  "birdshot",
  "buckshot",
  "buckshot",
  "slug",
  "slug",
  "armor_piercing",
  "armor_piercing",
  "flechette",
  "flechette",
  "blank",
  "blank",
];

export const BULLET_DEFS: Record<BulletType, BulletDef> = {
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
    description: "Low upfront damage that strips plating or seeds a damage-over-time effect.",
    matchup: "Best as setup into armored or stacked targets.",
  },
  blank: {
    id: "blank",
    label: "Blank",
    shortLabel: "BLK",
    description: "No damage. Converts the turn into guard.",
    matchup: "Best when you know a big hit is coming.",
  },
};

import type { EnvironmentId } from "../types";

export interface EnvironmentDef {
  id: EnvironmentId;
  label: string;
  description: string;
  effects: string[];
}

export const ENVIRONMENT_DEFS: Record<EnvironmentId, EnvironmentDef> = {
  desert: {
    id: "desert",
    label: "Desert",
    description: "Hot climate that builds heat faster and decays slower",
    effects: [
      "Heat builds up 50% faster",
      "Heat decays 50% slower",
      "Encourages restraint and careful timing"
    ]
  },
  tundra: {
    id: "tundra",
    label: "Tundra",
    description: "Cold climate that punishes inaction",
    effects: [
      "Take 2 damage if you don't fire for 3 turns",
      "Heat becomes a survival mechanic",
      "Rewards aggressive playstyles"
    ]
  },
  industrial: {
    id: "industrial",
    label: "Industrial",
    description: "Factory environment with machinery interference",
    effects: [
      "20% chance each turn to randomly shift cylinder",
      "Can add junk rounds to cylinder",
      "Creates chaos for planning-heavy builds"
    ]
  },
  haunted: {
    id: "haunted",
    label: "Haunted Grounds",
    description: "Reality instability causes unpredictable behavior",
    effects: [
      "Enemies may gain random evasive windows",
      "Statuses behave unpredictably",
      "Good fit for supernatural enemies"
    ]
  },
  overgrowth: {
    id: "overgrowth",
    label: "Overgrowth",
    description: "Jungle environment that strengthens DoT effects",
    effects: [
      "Burn and infection damage increased by 50%",
      "Buffs bioweapon and pyro builds",
      "Makes scaling builds more viable"
    ]
  }
};

export const getEnvironmentDef = (id: EnvironmentId): EnvironmentDef => ENVIRONMENT_DEFS[id];
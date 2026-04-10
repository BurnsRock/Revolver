export const CYLINDER_CAPACITY = 6;

export type PlayerAction = "fire" | "rotate" | "spin" | "reload";

export type BulletType =
  | "basic"
  | "hollow_point"
  | "frangible"
  | "birdshot"
  | "buckshot"
  | "slug"
  | "armor_piercing"
  | "flechette"
  | "blank"
  | "tranq"
  | "mark"
  | "seed"
  | "pork"
  | "flare"
  | "explosive"
  ;

export type AccessoryId =
  | "spring_ratchet"
  | "quickloader_holster"
  | "shock_padding"
  | "scope"
  | "laser"
  | "practice_target"
  | "bigger_barrel"
  | "gambling_die"
  | "beer"
  | "instruction_manual"
  | "tactical_vest"
  | "safety_goggles"
  | "cargo_pants"
  | "shotgun_mod"
  | "rifle_mod"
  | "hunter_mod"
  | "tactical_gloves"
  | "pyrotechnics_mod";

export type EnemyId =
  | "rat_swarm"
  | "riot_droid"
  | "sniper"
  | "drone"
  | "mauler_hound"
  | "field_medic"
  | "hex_slinger"
  | "tank"
  | "phantom_gunman"
  // Desert Act enemies
  | "scorpion_swarm"
  | "desert_bandit"
  | "sand_worm"
  | "mirage_stalker"
  | "cactus_thug"
  | "dust_devil"
  | "sun_baked_marauder"
  | "oasis_serpent"
  | "nomad_raider"
  | "phoenix_hatchling"
  | "desert_titan"
  // Tundra Act enemies
  | "frost_wolf"
  | "ice_golem"
  | "snow_yeti"
  | "arctic_fox"
  | "blizzard_elemental"
  | "frozen_marauder"
  | "polar_bear"
  | "ice_crystal"
  | "tundra_troll"
  | "aurora_spirit"
  | "frost_giant"
  // Industrial Act enemies
  | "scrap_bot"
  | "welding_drone"
  | "toxic_sludge"
  | "assembly_line"
  | "steam_geyser"
  | "circuit_breaker"
  | "hazard_bot"
  | "conveyor_belt"
  | "furnace_core"
  | "maintenance_droid"
  | "factory_overlord"
  // Haunted Act enemies
  | "ghost_pirate"
  | "zombie_horde"
  | "shadow_lurker"
  | "banshee_wail"
  | "cursed_knight"
  | "poltergeist"
  | "wraith_stalker"
  | "spectral_hound"
  | "necromancer"
  | "void_entity"
  | "lich_lord";

export type EnvironmentId =
  | "desert"
  | "tundra"
  | "industrial"
  | "haunted"
  | "overgrowth";

export type CategoryTag = "beast" | "robotic" | "human" | "supernatural";

export type TraitTag =
  | "swarm"
  | "armor"
  | "evasive"
  | "ranged"
  | "support"
  | "elite"
  | "boss"
  | "charging"
  | "disruptor";

export type EnemyStateTag =
  | "swarm"
  | "armored"
  | "shielded"
  | "charging"
  | "exposed"
  | "aiming"
  | "hover"
  | "steady"
  | "evasive"
  | "fortified"
  | "firing"
  | "hidden"
  | "repositioning";

export type CombatOutcome = "victory" | "defeat" | null;

export interface BulletDef {
  id: BulletType;
  label: string;
  shortLabel: string;
  description: string;
  matchup: string;
}

export interface AccessoryDef {
  id: AccessoryId;
  label: string;
  price: number;
  rarity: "common" | "uncommon" | "rare";
  description: string;
  effect: string;
  unlocks?: BulletType[];
}

export interface EnemyIntentView {
  id: string;
  label: string;
  detail: string;
  tags: EnemyStateTag[];
  previewDamage?: number;
}

export interface PlayerState {
  hp: number;
  maxHp: number;
  guard: number;
}

export interface DeckState {
  draw: BulletType[];
  discard: BulletType[];
}

export interface CylinderState {
  chambers: Array<BulletType | null>;
  currentIndex: number;
  capacity: number;
}

interface BaseEnemyState {
  id: EnemyId;
  label: string;
  hp: number;
  maxHp: number;
  armor: number;
  shred: number;
  cycleIndex: number;
  stun?: number;
  marked?: boolean;
  porked?: boolean;
  burn?: number;
  infestation?: number;
}

export interface RatSwarmState extends BaseEnemyState {
  id: "rat_swarm";
  stacks: number;
  infestation: number;
}

export interface RiotDroidState extends BaseEnemyState {
  id: "riot_droid";
}

export interface SniperState extends BaseEnemyState {
  id: "sniper";
  interrupted: boolean;
}

export interface DroneState extends BaseEnemyState {
  id: "drone";
}

export interface MaulerHoundState extends BaseEnemyState {
  id: "mauler_hound";
}

export interface FieldMedicState extends BaseEnemyState {
  id: "field_medic";
}

export interface HexSlingerState extends BaseEnemyState {
  id: "hex_slinger";
}

export interface TankState extends BaseEnemyState {
  id: "tank";
  tracksDamaged: number; // For birdshot destabilizing
}

export interface PhantomGunmanState extends BaseEnemyState {
  id: "phantom_gunman";
}

// New Desert Act enemies
export interface ScorpionSwarmState extends BaseEnemyState {
  id: "scorpion_swarm";
  stacks: number;
}

export interface DesertBanditState extends BaseEnemyState {
  id: "desert_bandit";
}

export interface SandWormState extends BaseEnemyState {
  id: "sand_worm";
  burrowed: boolean;
}

export interface MirageStalkerState extends BaseEnemyState {
  id: "mirage_stalker";
  visible: boolean;
}

export interface CactusThugState extends BaseEnemyState {
  id: "cactus_thug";
}

export interface DustDevilState extends BaseEnemyState {
  id: "dust_devil";
}

export interface SunBakedMarauderState extends BaseEnemyState {
  id: "sun_baked_marauder";
}

export interface OasisSerpentState extends BaseEnemyState {
  id: "oasis_serpent";
}

export interface NomadRaiderState extends BaseEnemyState {
  id: "nomad_raider";
}

export interface PhoenixHatchlingState extends BaseEnemyState {
  id: "phoenix_hatchling";
}

export interface DesertTitanState extends BaseEnemyState {
  id: "desert_titan";
}

// New Tundra Act enemies
export interface FrostWolfState extends BaseEnemyState {
  id: "frost_wolf";
}

export interface IceGolemState extends BaseEnemyState {
  id: "ice_golem";
}

export interface SnowYetiState extends BaseEnemyState {
  id: "snow_yeti";
}

export interface ArcticFoxState extends BaseEnemyState {
  id: "arctic_fox";
}

export interface BlizzardElementalState extends BaseEnemyState {
  id: "blizzard_elemental";
}

export interface FrozenMarauderState extends BaseEnemyState {
  id: "frozen_marauder";
}

export interface PolarBearState extends BaseEnemyState {
  id: "polar_bear";
}

export interface IceCrystalState extends BaseEnemyState {
  id: "ice_crystal";
}

export interface TundraTrollState extends BaseEnemyState {
  id: "tundra_troll";
}

export interface AuroraSpiritState extends BaseEnemyState {
  id: "aurora_spirit";
}

export interface FrostGiantState extends BaseEnemyState {
  id: "frost_giant";
}

// New Industrial Act enemies
export interface ScrapBotState extends BaseEnemyState {
  id: "scrap_bot";
}

export interface WeldingDroneState extends BaseEnemyState {
  id: "welding_drone";
}

export interface ToxicSludgeState extends BaseEnemyState {
  id: "toxic_sludge";
}

export interface AssemblyLineState extends BaseEnemyState {
  id: "assembly_line";
}

export interface SteamGeyserState extends BaseEnemyState {
  id: "steam_geyser";
}

export interface CircuitBreakerState extends BaseEnemyState {
  id: "circuit_breaker";
}

export interface HazardBotState extends BaseEnemyState {
  id: "hazard_bot";
}

export interface ConveyorBeltState extends BaseEnemyState {
  id: "conveyor_belt";
}

export interface FurnaceCoreState extends BaseEnemyState {
  id: "furnace_core";
}

export interface MaintenanceDroidState extends BaseEnemyState {
  id: "maintenance_droid";
}

export interface FactoryOverlordState extends BaseEnemyState {
  id: "factory_overlord";
}

// New Haunted Act enemies
export interface GhostPirateState extends BaseEnemyState {
  id: "ghost_pirate";
}

export interface ZombieHordeState extends BaseEnemyState {
  id: "zombie_horde";
  stacks: number;
}

export interface ShadowLurkerState extends BaseEnemyState {
  id: "shadow_lurker";
  hidden: boolean;
}

export interface BansheeWailState extends BaseEnemyState {
  id: "banshee_wail";
}

export interface CursedKnightState extends BaseEnemyState {
  id: "cursed_knight";
}

export interface PoltergeistState extends BaseEnemyState {
  id: "poltergeist";
}

export interface WraithStalkerState extends BaseEnemyState {
  id: "wraith_stalker";
}

export interface SpectralHoundState extends BaseEnemyState {
  id: "spectral_hound";
}

export interface NecromancerState extends BaseEnemyState {
  id: "necromancer";
}

export interface VoidEntityState extends BaseEnemyState {
  id: "void_entity";
}

export interface LichLordState extends BaseEnemyState {
  id: "lich_lord";
}

export type EnemyState =
  | RatSwarmState
  | RiotDroidState
  | SniperState
  | DroneState
  | MaulerHoundState
  | FieldMedicState
  | HexSlingerState
  | TankState
  | PhantomGunmanState
  // Desert Act
  | ScorpionSwarmState
  | DesertBanditState
  | SandWormState
  | MirageStalkerState
  | CactusThugState
  | DustDevilState
  | SunBakedMarauderState
  | OasisSerpentState
  | NomadRaiderState
  | PhoenixHatchlingState
  | DesertTitanState
  // Tundra Act
  | FrostWolfState
  | IceGolemState
  | SnowYetiState
  | ArcticFoxState
  | BlizzardElementalState
  | FrozenMarauderState
  | PolarBearState
  | IceCrystalState
  | TundraTrollState
  | AuroraSpiritState
  | FrostGiantState
  // Industrial Act
  | ScrapBotState
  | WeldingDroneState
  | ToxicSludgeState
  | AssemblyLineState
  | SteamGeyserState
  | CircuitBreakerState
  | HazardBotState
  | ConveyorBeltState
  | FurnaceCoreState
  | MaintenanceDroidState
  | FactoryOverlordState
  // Haunted Act
  | GhostPirateState
  | ZombieHordeState
  | ShadowLurkerState
  | BansheeWailState
  | CursedKnightState
  | PoltergeistState
  | WraithStalkerState
  | SpectralHoundState
  | NecromancerState
  | VoidEntityState
  | LichLordState;

export interface CombatState {
  seed: number;
  turn: number;
  combo: number;
  heat: number;
  scopePrimed: boolean;
  practiceTargetPrimed: boolean;
  player: PlayerState;
  enemy: EnemyState;
  enemies: EnemyState[];
  selectedEnemyIndex: number;
  deck: DeckState;
  cylinder: CylinderState;
  accessories: AccessoryId[];
  environment: EnvironmentId;
  turnsWithoutFiring: number; // For tundra environment
  over: boolean;
  outcome: CombatOutcome;
}

export type CombatEvent =
  | { type: "player_action"; action: PlayerAction }
  | { type: "bullet_fired"; bullet: BulletType | null; chamberIndex: number }
  | {
      type: "cylinder_changed";
      action: "rotate" | "spin" | "reload";
      currentIndex: number;
      rotations?: number;
    }
  | { type: "guard_gained"; amount: number; total: number }
  | { type: "enemy_damaged"; amount: number; blocked: number; remainingHp: number; source: string }
  | { type: "player_damaged"; amount: number; blocked: number; remainingHp: number; source: string }
  | { type: "status_applied"; target: "enemy"; status: string; amount: number; total: number }
  | { type: "enemy_intent"; intent: string }
  | { type: "encounter_end"; outcome: Exclude<CombatOutcome, null> }
  | { type: "log"; text: string };

export type EventSink = (event: CombatEvent) => void;

export interface CombatStepResult {
  state: CombatState;
  events: CombatEvent[];
}

export interface EnemyDef<TEnemy extends EnemyState = EnemyState> {
  id: EnemyId;
  label: string;
  description: string;
  environment: EnvironmentId;
  categoryTags: readonly CategoryTag[];
  traitTags: readonly TraitTag[];
  createState: () => TEnemy;
  getIntent: (enemy: TEnemy) => EnemyIntentView;
  getStateTags: (enemy: TEnemy) => EnemyStateTag[];
  onTurnStart?: (state: CombatState, enemy: TEnemy, emit: EventSink) => void;
  act: (state: CombatState, enemy: TEnemy, emit: EventSink) => void;
}

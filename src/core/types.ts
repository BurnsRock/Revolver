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
  | "shotgun_mod"
  | "rifle_mod"
  | "hunter_mod"
  | "bioweapon_mod"
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
  | "phantom_gunman";

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

export type EnemyState =
  | RatSwarmState
  | RiotDroidState
  | SniperState
  | DroneState
  | MaulerHoundState
  | FieldMedicState
  | HexSlingerState
  | TankState
  | PhantomGunmanState;

export interface CombatState {
  seed: number;
  turn: number;
  combo: number;
  heat: number;
  player: PlayerState;
  enemy: EnemyState;
  deck: DeckState;
  cylinder: CylinderState;
  accessories: AccessoryId[];
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
  categoryTags: readonly CategoryTag[];
  traitTags: readonly TraitTag[];
  createState: () => TEnemy;
  getIntent: (enemy: TEnemy) => EnemyIntentView;
  getStateTags: (enemy: TEnemy) => EnemyStateTag[];
  onTurnStart?: (state: CombatState, enemy: TEnemy, emit: EventSink) => void;
  act: (state: CombatState, enemy: TEnemy, emit: EventSink) => void;
}

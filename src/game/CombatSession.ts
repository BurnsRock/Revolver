import { ACCESSORY_DEFS, createShopStock } from "../core/content/accessories";
import {
  getDefaultAmmoLoadout,
  getUnlockedBullets,
  normalizeAmmoLoadout,
} from "../core/content/bullets";
import { createEnemyState, generateEncounterOrder } from "../core/content/enemies";
import { createCombatState, getCombatSnapshot, stepCombat } from "../core/resolve";
import type { AccessoryId, BulletType, CombatEvent, CombatState, EnemyId, PlayerAction } from "../core/types";

const INITIAL_SEED_BASE = 1337;
const INITIAL_SHOP_SEED = 4001;

const ENEMY_REWARDS: Record<EnemyId, number> = {
  rat_swarm: 15,
  riot_droid: 16,
  sniper: 14,
  drone: 18,
  mauler_hound: 17,
  field_medic: 16,
  hex_slinger: 20,
  tank: 25,
  phantom_gunman: 22,
};

export type ScreenMode = "main_menu" | "combat" | "shop" | "death" | "victory";
export type ShopPurchaseResult =
  | { ok: false; unlockedAmmo: false }
  | { ok: true; unlockedAmmo: boolean };

export class CombatSession {
  private encounterIndex = 0;
  private encounterOrder: EnemyId[][] = [];
  private seedBase = INITIAL_SEED_BASE;
  private shopSeed = INITIAL_SHOP_SEED;
  private mode: ScreenMode = "combat";
  private money = 0;
  private ownedAccessories: AccessoryId[] = [];
  private selectedLoadout: BulletType[] = [];
  private pendingAmmoSelection = false;
  private shopStock: Array<AccessoryId | null> = [];
  private state!: CombatState;
  private logs: string[] = [];

  public getMode(): ScreenMode {
    return this.mode;
  }

  public getMoney(): number {
    return this.money;
  }

  public getOwnedAccessories(): readonly AccessoryId[] {
    return this.ownedAccessories;
  }

  public getUnlockedBullets(): readonly BulletType[] {
    return getUnlockedBullets(this.ownedAccessories);
  }

  public getSelectedLoadout(): readonly BulletType[] {
    return this.selectedLoadout;
  }

  public setSelectedLoadout(loadout: readonly BulletType[]): void {
    this.selectedLoadout = normalizeAmmoLoadout(loadout, this.ownedAccessories);
    this.pendingAmmoSelection = false;
  }

  public shouldPromptAmmoSelection(): boolean {
    return this.pendingAmmoSelection;
  }

  public clearAmmoSelectionPrompt(): void {
    this.pendingAmmoSelection = false;
  }

  public getShopStock(): readonly (AccessoryId | null)[] {
    return this.shopStock;
  }

  public getState(): CombatState {
    return this.state;
  }

  public getLogs(): readonly string[] {
    return this.logs;
  }

  public getEncounterIndex(): number {
    return this.encounterIndex;
  }

  public setSelectedEnemy(index: number): void {
    if (this.mode !== "combat") {
      return;
    }

    if (index < 0 || index >= this.state.enemies.length) {
      return;
    }

    this.state.selectedEnemyIndex = index;
  }

  public hasNextEncounter(): boolean {
    return this.encounterIndex < this.encounterOrder.length - 1;
  }

  public getNextEncounterLabel(): string | null {
    if (!this.hasNextEncounter()) {
      return null;
    }

    const nextEncounter = this.encounterOrder[this.encounterIndex + 1] ?? [];
    if (nextEncounter.length === 0) {
      return null;
    }

    const labels = nextEncounter.map((enemyId) => createEnemyState(enemyId).label);
    return labels.join(" + ");
  }

  public createRenderPayload(lastAdvanceMs: number): string {
    const snapshot = getCombatSnapshot(this.state);
    const { accessories: _combatAccessories, ...snapshotWithoutAccessories } = snapshot;
    return JSON.stringify({
      coordinateSystem:
        "UI-only combat state. Chamber indices run left-to-right, top row then bottom row.",
      mode: this.mode,
      money: this.money,
      accessories: [...this.ownedAccessories],
      shop:
        this.mode === "shop"
          ? {
              stock: [...this.shopStock],
            }
          : null,
      encounter: {
        index: this.encounterIndex + 1,
        total: this.encounterOrder.length,
        next: this.getNextEncounterLabel(),
      },
      lastAdvanceMs,
      logs: this.logs.slice(-6),
      ...snapshotWithoutAccessories,
    });
  }

  public startRun(): void {
    this.mode = "combat";
    this.money = 0;
    this.ownedAccessories = [];
    this.selectedLoadout = getDefaultAmmoLoadout(this.ownedAccessories);
    this.pendingAmmoSelection = false;
    this.shopStock = [];
    this.seedBase = INITIAL_SEED_BASE;
    this.shopSeed = INITIAL_SHOP_SEED;
    this.encounterOrder = generateEncounterOrder();
    this.startEncounter(this.encounterOrder[0] ?? []);
  }

  public openMainMenu(): void {
    this.mode = "main_menu";
  }

  public beginFromMainMenu(): boolean {
    if (this.mode !== "main_menu") {
      return false;
    }

    this.mode = "combat";
    return true;
  }

  public restartFromDeathScreen(): boolean {
    if (this.mode !== "death") {
      return false;
    }

    this.startRun();
    return true;
  }

  public restartFromVictoryScreen(): boolean {
    if (this.mode !== "victory") {
      return false;
    }

    this.startRun();
    return true;
  }

  public leaveShop(): boolean {
    if (this.mode !== "shop") {
      return false;
    }

    const nextEncounter = this.encounterOrder[this.encounterIndex + 1];
    if (!nextEncounter || nextEncounter.length === 0) {
      return false;
    }

    this.startEncounter(nextEncounter);
    return true;
  }

  public startEncounter(encounterEnemyIds: EnemyId[]): void {
    this.encounterIndex = this.encounterOrder.findIndex((encounter) => encounter === encounterEnemyIds);
    if (this.encounterIndex < 0) {
      this.encounterIndex = 0;
    }
    this.seedBase += 97;
    this.mode = "combat";
    const loadout = normalizeAmmoLoadout(this.selectedLoadout, this.ownedAccessories);
    this.selectedLoadout = loadout;
    this.state = createCombatState(this.seedBase, encounterEnemyIds, this.selectedLoadout, this.ownedAccessories);
    const labels = this.state.enemies.map((enemy) => enemy.label).join(" + ");
    this.logs = [`Loaded encounter: ${labels}.`];
  }

  public performAction(action: PlayerAction): CombatEvent[] {
    if (this.mode !== "combat") {
      return [];
    }

    if (this.state.over) {
      this.pushLog("Encounter is over. Press Enter to continue.");
      return [];
    }

    const result = stepCombat(this.state, action, this.state.selectedEnemyIndex);
    this.state = result.state;
    result.events.forEach((event) => this.consumeEvent(event));

    if (!this.state.over) {
      return result.events;
    }

    if (this.state.outcome === "victory") {
      const reward = this.state.enemies.reduce((sum, enemy) => sum + ENEMY_REWARDS[enemy.id], 0);
      this.money += reward;
      this.pushLog(`Collected $${reward}.`);
      if (this.hasNextEncounter()) {
        this.openShop();
      } else {
        this.pushLog("Run clear. Restart from the victory screen.");
        this.mode = "victory";
      }
      return result.events;
    }

    this.pushLog("Defeat. Restart from the death screen.");
    this.mode = "death";
    return result.events;
  }

  public continueWithEnter(): boolean {
    if (this.mode === "main_menu") {
      return this.beginFromMainMenu();
    }

    if (this.mode === "shop") {
      return this.leaveShop();
    }

    if (this.mode === "death") {
      return this.restartFromDeathScreen();
    }

    if (this.mode === "victory") {
      return this.restartFromVictoryScreen();
    }

    if (this.state.over && this.state.outcome === "victory" && this.hasNextEncounter()) {
      this.openShop();
      return false;
    }

    this.startRun();
    return true;
  }

  public buyShopAccessory(index: number): ShopPurchaseResult {
    if (this.mode !== "shop") {
      return { ok: false, unlockedAmmo: false };
    }

    const accessoryId = this.shopStock[index];
    if (!accessoryId) {
      return { ok: false, unlockedAmmo: false };
    }

    const accessory = ACCESSORY_DEFS[accessoryId];
    if (this.ownedAccessories.includes(accessoryId)) {
      this.pushLog(`${accessory.label} is already installed.`);
      return { ok: false, unlockedAmmo: false };
    }

    if (this.money < accessory.price) {
      this.pushLog(`Need $${accessory.price} for ${accessory.label}.`);
      return { ok: false, unlockedAmmo: false };
    }

    this.money -= accessory.price;
    this.ownedAccessories.push(accessoryId);
    this.shopStock[index] = null;
    this.pushLog(`Bought ${accessory.label}.`);
    if (accessory.unlocks && accessory.unlocks.length > 0) {
      this.pendingAmmoSelection = true;
      this.pushLog("New ammo unlocked. Choose a loadout before continuing.");
      this.selectedLoadout = normalizeAmmoLoadout(this.selectedLoadout, this.ownedAccessories);
      return { ok: true, unlockedAmmo: true };
    }
    return { ok: true, unlockedAmmo: false };
  }

  private openShop(): void {
    if (!this.hasNextEncounter()) {
      this.mode = "combat";
      return;
    }

    const stock = createShopStock(this.shopSeed + this.encounterIndex * 97, this.ownedAccessories);
    this.shopSeed = stock.seed;
    this.shopStock = stock.stock.map((accessoryId) => accessoryId);
    this.mode = "shop";
  }

  private consumeEvent(event: CombatEvent): void {
    if (event.type === "log") {
      this.pushLog(event.text);
    }
  }

  private pushLog(text: string): void {
    this.logs.push(text);
    if (this.logs.length > 12) {
      this.logs = this.logs.slice(-12);
    }
  }
}

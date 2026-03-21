import { ACCESSORY_DEFS, createShopStock } from "../core/content/accessories";
import { createEnemyState, ENEMY_ORDER } from "../core/content/enemies";
import { createCombatState, getCombatSnapshot, stepCombat } from "../core/resolve";
import type { AccessoryId, CombatEvent, CombatState, EnemyId, PlayerAction } from "../core/types";

const INITIAL_SEED_BASE = 1337;
const INITIAL_SHOP_SEED = 4001;

const ENEMY_REWARDS: Record<EnemyId, number> = {
  rat_swarm: 15,
  riot_droid: 16,
  sniper: 14,
  drone: 18,
  tank: 25,
  phantom_gunman: 22,
};

export type ScreenMode = "main_menu" | "combat" | "shop" | "death" | "victory";

export class CombatSession {
  private encounterIndex = 0;
  private seedBase = INITIAL_SEED_BASE;
  private shopSeed = INITIAL_SHOP_SEED;
  private mode: ScreenMode = "combat";
  private money = 0;
  private ownedAccessories: AccessoryId[] = [];
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

  public hasNextEncounter(): boolean {
    return this.encounterIndex < ENEMY_ORDER.length - 1;
  }

  public getNextEncounterLabel(): string | null {
    if (!this.hasNextEncounter()) {
      return null;
    }

    return createEnemyState(ENEMY_ORDER[this.encounterIndex + 1]).label;
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
        total: ENEMY_ORDER.length,
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
    this.shopStock = [];
    this.seedBase = INITIAL_SEED_BASE;
    this.shopSeed = INITIAL_SHOP_SEED;
    this.startEncounter(ENEMY_ORDER[0]);
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

    const nextEnemyId = ENEMY_ORDER[this.encounterIndex + 1];
    if (!nextEnemyId) {
      return false;
    }

    this.startEncounter(nextEnemyId);
    return true;
  }

  public startEncounter(enemyId: EnemyId): void {
    this.encounterIndex = ENEMY_ORDER.indexOf(enemyId);
    this.seedBase += 97;
    this.mode = "combat";
    this.state = createCombatState(this.seedBase, enemyId, undefined, this.ownedAccessories);
    this.logs = [`Loaded encounter: ${this.state.enemy.label}.`];
  }

  public performAction(action: PlayerAction): CombatEvent[] {
    if (this.mode !== "combat") {
      return [];
    }

    if (this.state.over) {
      this.pushLog("Encounter is over. Press Enter to continue.");
      return [];
    }

    const result = stepCombat(this.state, action);
    this.state = result.state;
    result.events.forEach((event) => this.consumeEvent(event));

    if (!this.state.over) {
      return result.events;
    }

    if (this.state.outcome === "victory") {
      const reward = ENEMY_REWARDS[this.state.enemy.id];
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

  public buyShopAccessory(index: number): void {
    if (this.mode !== "shop") {
      return;
    }

    const accessoryId = this.shopStock[index];
    if (!accessoryId) {
      return;
    }

    const accessory = ACCESSORY_DEFS[accessoryId];
    if (this.ownedAccessories.includes(accessoryId)) {
      this.pushLog(`${accessory.label} is already installed.`);
      return;
    }

    if (this.money < accessory.price) {
      this.pushLog(`Need $${accessory.price} for ${accessory.label}.`);
      return;
    }

    this.money -= accessory.price;
    this.ownedAccessories.push(accessoryId);
    this.shopStock[index] = null;
    this.pushLog(`Bought ${accessory.label}.`);
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

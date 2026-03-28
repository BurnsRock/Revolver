import Phaser from "phaser";
import { ACCESSORY_DEFS } from "../core/content/accessories";
import { BULLET_DEFS, MAX_LOADOUT_BULLETS } from "../core/content/bullets";
import { CombatSession } from "./CombatSession";
import type { BulletType } from "../core/types";

type ShopSceneInitData = {
  session: CombatSession;
};

type AccessoryCardVisual = {
  box: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  body: Phaser.GameObjects.Text;
};

type BulletToggleVisual = {
  box: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
};

const WIDTH = 1180;
const HEIGHT = 780;

export class ShopScene extends Phaser.Scene {
  public static readonly SCENE_KEY = "ShopScene";

  private session: CombatSession | null = null;
  private readonly accessoryCards: AccessoryCardVisual[] = [];
  private readonly bulletToggles = new Map<BulletType, BulletToggleVisual>();

  private panel!: Phaser.GameObjects.Rectangle;
  private titleText!: Phaser.GameObjects.Text;
  private moneyText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private continueButton!: Phaser.GameObjects.Rectangle;
  private continueLabel!: Phaser.GameObjects.Text;
  private ammoButton!: Phaser.GameObjects.Rectangle;
  private ammoButtonLabel!: Phaser.GameObjects.Text;

  private ammoPanel!: Phaser.GameObjects.Rectangle;
  private ammoTitleText!: Phaser.GameObjects.Text;
  private ammoHintText!: Phaser.GameObjects.Text;
  private ammoDoneButton!: Phaser.GameObjects.Rectangle;
  private ammoDoneLabel!: Phaser.GameObjects.Text;
  private ammoSelectOpen = false;
  private selectedAmmo = new Set<BulletType>();

  constructor() {
    super(ShopScene.SCENE_KEY);
  }

  public init(data: ShopSceneInitData): void {
    this.session = data.session;
  }

  public create(): void {
    this.accessoryCards.length = 0;
    this.bulletToggles.clear();

    this.createBaseUi();
    this.createAmmoUi();
    this.time.delayedCall(100, () => this.refreshUi());

    if (this.session?.shouldPromptAmmoSelection()) {
      this.openAmmoSelection();
    }
  }

  private createBaseUi(): void {
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x05090f, 0.8);

    this.panel = this.add.rectangle(WIDTH / 2, HEIGHT / 2, 940, 560, 0x162230, 0.98);
    this.panel.setStrokeStyle(3, 0xf1c66b, 0.95);

    this.titleText = this.add.text(WIDTH / 2, 116, "SHOP", {
      fontFamily: "Arial",
      fontSize: "40px",
      color: "#f4ddb0",
    }).setOrigin(0.5, 0);

    this.moneyText = this.add.text(WIDTH / 2, 170, "a", {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#d7dee8",
    }).setOrigin(0.5, 0);

    const cardXs = [300, 590, 880];
    cardXs.forEach((x, index) => {
      const box = this.add.rectangle(x, 360, 250, 260, 0x223246, 0.98);
      box.setStrokeStyle(2, 0x6e8298, 0.9);
      box.setInteractive({ useHandCursor: true });
      box.on("pointerdown", () => this.buyAccessory(index));

      const title = this.add.text(x, 250, "", {
        fontFamily: "Arial",
        fontSize: "22px",
        color: "#fff6db",
      }).setOrigin(0.5, 0);

      const body = this.add.text(x, 312, "a", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#d7dee8",
      }).setOrigin(0.5, 0);

      this.accessoryCards.push({ box, title, body });
    });

    this.hintText = this.add.text(WIDTH / 2, 540, "a", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#d7dee8",
    }).setOrigin(0.5, 0);

    this.ammoButton = this.add.rectangle(WIDTH / 2 - 150, 664, 280, 52, 0x31465d, 0.98);
    this.ammoButton.setStrokeStyle(2, 0xf1c66b, 1);
    this.ammoButton.setInteractive({ useHandCursor: true });
    this.ammoButton.on("pointerdown", () => this.openAmmoSelection());

    this.ammoButtonLabel = this.add.text(WIDTH / 2 - 150, 664, "AMMO LOADOUT", {
      fontFamily: "Arial",
      fontSize: "22px",
      color: "#fff6db",
    }).setOrigin(0.5);

    this.continueButton = this.add.rectangle(WIDTH / 2 + 150, 664, 280, 52, 0x8f6422, 0.98);
    this.continueButton.setStrokeStyle(2, 0xf1c66b, 1);
    this.continueButton.setInteractive({ useHandCursor: true });
    this.continueButton.on("pointerdown", () => this.continueToCombat());

    this.continueLabel = this.add.text(WIDTH / 2 + 150, 664, "CONTINUE", {
      fontFamily: "Arial",
      fontSize: "22px",
      color: "#fff6db",
    }).setOrigin(0.5);
  }

  private createAmmoUi(): void {
    this.ammoPanel = this.add.rectangle(WIDTH / 2, HEIGHT / 2, 900, 520, 0x101b28, 0.98);
    this.ammoPanel.setStrokeStyle(3, 0xf1c66b, 0.95);
    this.ammoPanel.setDepth(20);
    this.ammoPanel.setVisible(false);

    this.ammoTitleText = this.add.text(WIDTH / 2, 150, "AMMO LOADOUT", {
      fontFamily: "Arial",
      fontSize: "34px",
      color: "#f4ddb0",
    }).setOrigin(0.5, 0).setDepth(21).setVisible(false);

    this.ammoHintText = this.add.text(WIDTH / 2, 196, "a", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#d7dee8",
    }).setOrigin(0.5, 0).setDepth(21).setVisible(false);

    this.ammoDoneButton = this.add.rectangle(WIDTH / 2, 642, 250, 52, 0x8f6422, 0.98);
    this.ammoDoneButton.setStrokeStyle(2, 0xf1c66b, 1);
    this.ammoDoneButton.setDepth(21);
    this.ammoDoneButton.setVisible(false);
    this.ammoDoneButton.setInteractive({ useHandCursor: true });
    this.ammoDoneButton.on("pointerdown", () => this.applyAmmoSelection());

    this.ammoDoneLabel = this.add.text(WIDTH / 2, 642, "APPLY LOADOUT", {
      fontFamily: "Arial",
      fontSize: "22px",
      color: "#fff6db",
    }).setOrigin(0.5).setDepth(22).setVisible(false);
  }

  private ensureAmmoToggles(): void {
    if (!this.session) {
      return;
    }

    const unlocked = this.session.getUnlockedBullets();
    const rows = Math.ceil(unlocked.length / 4);
    const startY = 280 - (rows - 1) * 44;

    this.bulletToggles.forEach((toggle, bullet) => {
      if (!unlocked.includes(bullet)) {
        toggle.box.destroy();
        toggle.text.destroy();
        this.bulletToggles.delete(bullet);
      }
    });

    unlocked.forEach((bullet, index) => {
      const col = index % 4;
      const row = Math.floor(index / 4);
      const x = 250 + col * 225;
      const y = startY + row * 90;
      const existing = this.bulletToggles.get(bullet);
      if (existing) {
        existing.box.setPosition(x, y);
        existing.text.setPosition(x, y);
        return;
      }

      const box = this.add.rectangle(x, y, 200, 66, 0x223246, 0.98);
      box.setStrokeStyle(2, 0x6e8298, 0.9);
      box.setDepth(21);
      box.setVisible(false);
      box.setInteractive({ useHandCursor: true });
      box.on("pointerdown", () => this.toggleAmmo(bullet));

      const text = this.add.text(x, y, "a", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#d7dee8",
      }).setOrigin(0.5).setDepth(22).setVisible(false);

      this.bulletToggles.set(bullet, { box, text });
    });
  }

  private toggleAmmo(bullet: BulletType): void {
    if (this.selectedAmmo.has(bullet)) {
      this.selectedAmmo.delete(bullet);
      this.refreshAmmoUi();
      return;
    }

    if (this.selectedAmmo.size >= MAX_LOADOUT_BULLETS) {
      return;
    }

    this.selectedAmmo.add(bullet);
    this.refreshAmmoUi();
  }

  private openAmmoSelection(): void {
    if (!this.session) {
      return;
    }
    this.ammoSelectOpen = true;
    this.selectedAmmo = new Set(this.session.getSelectedLoadout());
    this.ensureAmmoToggles();
    this.refreshAmmoUi();
  }

  private applyAmmoSelection(): void {
    if (!this.session) {
      return;
    }
    this.session.setSelectedLoadout([...this.selectedAmmo]);
    this.ammoSelectOpen = false;
    this.refreshUi();
  }

  private safeSetText(textObj: Phaser.GameObjects.Text | null | undefined, text: string): void {
    if (!textObj || !textObj.scene || !textObj.active || !textObj.visible || !this.game.canvas || !textObj.texture) {
      return;
    }

    try {
      textObj.setText(text);
    } catch (err) {
      console.warn("ShopScene safeSetText: failed", text, err);
    }
  }

  private isValidRect(rect: Phaser.GameObjects.Rectangle | null | undefined): rect is Phaser.GameObjects.Rectangle {
    return !!rect && !!rect.scene && !!rect.active;
  }

  private isValidText(textObj: Phaser.GameObjects.Text | null | undefined): textObj is Phaser.GameObjects.Text {
    return !!textObj && !!textObj.scene && !!textObj.active && (!!textObj.texture || !!textObj.resolution);
  }

  private buyAccessory(index: number): void {
    if (!this.session) {
      return;
    }
    const result = this.session.buyShopAccessory(index);
    if (result.ok && result.unlockedAmmo) {
      this.openAmmoSelection();
    }
    this.refreshUi();
  }

  private continueToCombat(): void {
    if (!this.session) {
      return;
    }

    if (this.session.shouldPromptAmmoSelection()) {
      this.openAmmoSelection();
      return;
    }

    this.scene.stop(ShopScene.SCENE_KEY);
    this.game.events.emit("shop:continue");
  }

  private refreshAmmoUi(): void {
    const visible = this.ammoSelectOpen;
    this.ammoPanel.setVisible(visible);
    this.ammoTitleText.setVisible(visible);
    this.ammoHintText.setVisible(visible);
    this.ammoDoneButton.setVisible(visible);
    this.ammoDoneLabel.setVisible(visible);

    this.bulletToggles.forEach((toggle, bullet) => {
      toggle.box.setVisible(visible);
      toggle.text.setVisible(visible);
      if (!visible) {
        return;
      }
      const selected = this.selectedAmmo.has(bullet);
      toggle.box.setFillStyle(selected ? 0x8f6422 : 0x223246, 0.98);
      toggle.box.setStrokeStyle(2, selected ? 0xf1c66b : 0x6e8298, 1);
      this.safeSetText(toggle.text, `${selected ? "✓ " : ""}${BULLET_DEFS[bullet].label}`);
      toggle.text.setColor(selected ? "#fff6db" : "#d7dee8");
    });

    if (!visible) {
      return;
    }

    this.ammoHintText.setText(`Choose up to ${MAX_LOADOUT_BULLETS} bullets for this run. Selected: ${this.selectedAmmo.size}/${MAX_LOADOUT_BULLETS}`);

    const hasSelection = this.selectedAmmo.size > 0;
    this.ammoDoneButton.setAlpha(hasSelection ? 1 : 0.45);
    this.ammoDoneLabel.setAlpha(hasSelection ? 1 : 0.45);
    this.ammoDoneButton.disableInteractive();
    if (hasSelection) {
      this.ammoDoneButton.setInteractive({ useHandCursor: true });
    }
  }

  private refreshUi(): void {
    if (!this.session || !this.scene.isActive()) {
      return;
    }
    const session = this.session;

    this.safeSetText(this.moneyText, `Credits: $${session.getMoney()}`);

    try {
      this.accessoryCards.forEach((card, index) => {
      if (!card || !this.isValidRect(card.box) || !this.isValidText(card.title) || !this.isValidText(card.body)) {
          return;
        }

        const accessoryId = session.getShopStock()[index] ?? null;
        if (!accessoryId) {
          card.box.setFillStyle(0x1a2532, 0.9);
          card.box.setStrokeStyle(2, 0x4e6177, 0.75);
          this.safeSetText(card.title, `${index + 1}. SOLD`);
          card.title.setColor("#9eb0c5");
          this.safeSetText(card.body, "No item here.");
          card.body.setColor("#9eb0c5");
          return;
        }

        const accessory = ACCESSORY_DEFS[accessoryId];
        if (!accessory) {
          this.safeSetText(card.title, "UNKNOWN");
          this.safeSetText(card.body, "Unknown item");
          return;
        }
        const affordable = session.getMoney() >= accessory.price;
        card.box.setFillStyle(affordable ? 0x223246 : 0x2a1d1d, 0.98);
        card.box.setStrokeStyle(2, affordable ? 0xf1c66b : 0xa26d6d, 0.92);
        this.safeSetText(card.title, `${index + 1}. ${accessory.label} - $${accessory.price}`);
        card.title.setColor(affordable ? "#fff6db" : "#f2c7c7");
        this.safeSetText(card.body, `${accessory.effect} ${accessory.description}`);
        card.body.setColor(affordable ? "#d7dee8" : "#d2b6b6");
      });
    } catch (err) {
      console.warn("ShopScene refreshUi accessoryCards error", err);
    }

    this.safeSetText(this.hintText, `Buy accessories to improve your run. Mods that unlock ammo require choosing a new ammo loadout (${MAX_LOADOUT_BULLETS} max).`);

    this.refreshAmmoUi();
  }
}

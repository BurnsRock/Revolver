import Phaser from "phaser";
import { ACCESSORY_DEFS, createShopStock } from "../core/content/accessories";
import { BULLET_DEFS } from "../core/content/bullets";
import {
  CYLINDER_ROTATION_DIRECTION,
  findNextLoadedChamberIndex,
  getCylinderOrder,
} from "../core/cylinder";
import { createEnemyState, ENEMY_ORDER, getEnemyIntent } from "../core/content/enemies";
import { createCombatState, getCombatSnapshot, stepCombat } from "../core/resolve";
import type { AccessoryId, CombatEvent, CombatState, EnemyId, PlayerAction } from "../core/types";
import revolverProtoSpritesheetUrl from "../assets/images/revolver_proto_spritesheet.png";

const GAME_WIDTH = 1180;
const GAME_HEIGHT = 780;
export const REVOLVER_PROTO_SPRITESHEET_KEY = "revolver-proto";
export const REVOLVER_PROTO_IMAGE_KEY = "revolver-proto-image";
const REVOLVER_PROTO_FRAME_SIZE = 128;
const CHAMBER_POSITIONS = [
  { x: 601, y: 123 },
  { x: 503, y: 203 },
  { x: 503, y: 315 },
  { x: 601, y: 395 },
  { x: 699, y: 315 },
  { x: 699, y: 203 },
] as const;

const BULLET_TOOLTIP_LINES = {
  birdshot: {
    damage: "2, or 3 stacks vs swarm",
    effect: "Wide spread clears multiple swarm bodies",
    effectiveVs: "Swarms",
  },
  buckshot: {
    damage: "4, up to 9 on exposed targets",
    effect: "Interrupts charge and sniper aim",
    effectiveVs: "Charging or exposed targets",
  },
  slug: {
    damage: "6, 10 on steady targets",
    effect: "Heavy single-target hit",
    effectiveVs: "Hovering or steady targets",
  },
  armor_piercing: {
    damage: "6 through armor, 3 otherwise",
    effect: "Ignores armor and shields",
    effectiveVs: "Armored targets",
  },
  flechette: {
    damage: "1 direct, or 2 infestation vs swarm",
    effect: "Shreds armor or seeds damage over time",
    effectiveVs: "Armored or stacked targets",
  },
  blank: {
    damage: "0",
    effect: "Gain 6 guard",
    effectiveVs: "Big incoming hits",
  },
} as const;

const ENEMY_REWARDS: Record<EnemyId, number> = {
  rat_swarm: 15,
  riot_droid: 16,
  sniper: 14,
  drone: 18,
};

const ENEMY_PORTRAIT_CROPS: Record<EnemyId, { x: number; y: number; width: number; height: number }> = {
  rat_swarm: { x: 384, y: 256, width: 256, height: 256 },
  riot_droid: { x: 768, y: 256, width: 256, height: 256 },
  sniper: { x: 512, y: 640, width: 256, height: 256 },
  drone: { x: 1024, y: 256, width: 256, height: 256 },
};

const PLAYER_PORTRAIT_CROP = { x: 128, y: 256, width: 256, height: 256 };
const CYLINDER_CROP = { x: 1024, y: 640, width: 256, height: 256 };
const PROTO_FRAME_NAMES = {
  player: "proto-player",
  rat_swarm: "proto-rat-swarm",
  riot_droid: "proto-riot-droid",
  sniper: "proto-sniper",
  drone: "proto-drone",
  cylinder: "proto-cylinder",
} as const;

type ScreenMode = "combat" | "shop";

type ChamberVisual = {
  box: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  index: Phaser.GameObjects.Text;
};

type ActionButton = {
  box: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
};

type ShopOptionVisual = {
  box: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  body: Phaser.GameObjects.Text;
};

type UiSpriteSet = {
  credits: Phaser.GameObjects.Image;
  player: Phaser.GameObjects.Image;
  enemy: Phaser.GameObjects.Image;
  accessories: Phaser.GameObjects.Image;
  log: Phaser.GameObjects.Image;
  shop: Phaser.GameObjects.Image;
  cylinder: Phaser.GameObjects.Image;
};

export class CombatScene extends Phaser.Scene {
  public static readonly SCENE_KEY = "CombatScene";

  private encounterIndex = 0;
  private seedBase = 1337;
  private shopSeed = 4001;
  private mode: ScreenMode = "combat";
  private money = 0;
  private ownedAccessories: AccessoryId[] = [];
  private shopStock: Array<AccessoryId | null> = [];
  private state!: CombatState;
  private lastAdvanceMs = 0;
  private logs: string[] = [];

  private titleText!: Phaser.GameObjects.Text;
  private moneyText!: Phaser.GameObjects.Text;
  private playerText!: Phaser.GameObjects.Text;
  private enemyText!: Phaser.GameObjects.Text;
  private enemyIntentText!: Phaser.GameObjects.Text;
  private enemyIntentDetailText!: Phaser.GameObjects.Text;
  private accessoryHeaderText!: Phaser.GameObjects.Text;
  private deckText!: Phaser.GameObjects.Text;
  private footerText!: Phaser.GameObjects.Text;
  private outcomeText!: Phaser.GameObjects.Text;
  private tooltipBox!: Phaser.GameObjects.Rectangle;
  private tooltipText!: Phaser.GameObjects.Text;
  private uiSprites!: UiSpriteSet;
  private logOverlay!: Phaser.GameObjects.Rectangle;
  private logPanel!: Phaser.GameObjects.Rectangle;
  private logTitleText!: Phaser.GameObjects.Text;
  private logBodyText!: Phaser.GameObjects.Text;
  private logCloseButton!: ActionButton;
  private logToggleButton!: ActionButton;
  private shopOverlay!: Phaser.GameObjects.Rectangle;
  private shopPanel!: Phaser.GameObjects.Rectangle;
  private shopTitleText!: Phaser.GameObjects.Text;
  private shopMoneyText!: Phaser.GameObjects.Text;
  private shopHintText!: Phaser.GameObjects.Text;
  private shopContinueButton!: ActionButton;
  private hasPositionedChambers = false;
  private displayCurrentIndex = 0;
  private rotationAnimationToken = 0;
  private pendingRotationSteps: number | null = null;
  private logOpen = false;

  private readonly chamberVisuals: ChamberVisual[] = [];
  private readonly actionButtons = new Map<PlayerAction, ActionButton>();
  private readonly shopOptionVisuals: ShopOptionVisual[] = [];
  private accessoryNameTexts: Phaser.GameObjects.Text[] = [];

  constructor() {
    super(CombatScene.SCENE_KEY);
  }

  create(): void {
    this.ensureProtoFrames();
    this.createBackground();
    this.createHud();
    this.bindInputs();
    this.startRun();
  }

  preload(): void {
    this.load.image(REVOLVER_PROTO_IMAGE_KEY, revolverProtoSpritesheetUrl);
    this.load.spritesheet(REVOLVER_PROTO_SPRITESHEET_KEY, revolverProtoSpritesheetUrl, {
      frameWidth: REVOLVER_PROTO_FRAME_SIZE,
      frameHeight: REVOLVER_PROTO_FRAME_SIZE,
    });
  }

  public renderGameToText(): string {
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
      lastAdvanceMs: this.lastAdvanceMs,
      logs: this.logs.slice(-6),
      ...snapshotWithoutAccessories,
    });
  }

  public advanceTime(ms: number): void {
    this.lastAdvanceMs = Math.max(0, Math.floor(ms));
    this.refreshUi();
  }

  private ensureProtoFrames(): void {
    const texture = this.textures.get(REVOLVER_PROTO_IMAGE_KEY);
    const frameSpecs: Array<[string, { x: number; y: number; width: number; height: number }]> = [
      [PROTO_FRAME_NAMES.player, PLAYER_PORTRAIT_CROP],
      [PROTO_FRAME_NAMES.rat_swarm, ENEMY_PORTRAIT_CROPS.rat_swarm],
      [PROTO_FRAME_NAMES.riot_droid, ENEMY_PORTRAIT_CROPS.riot_droid],
      [PROTO_FRAME_NAMES.sniper, ENEMY_PORTRAIT_CROPS.sniper],
      [PROTO_FRAME_NAMES.drone, ENEMY_PORTRAIT_CROPS.drone],
      [PROTO_FRAME_NAMES.cylinder, CYLINDER_CROP],
    ];

    frameSpecs.forEach(([name, crop]) => {
      if (!texture.has(name)) {
        texture.add(name, 0, crop.x, crop.y, crop.width, crop.height);
      }
    });
  }

  private createBackground(): void {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x11141a, 0x11141a, 0x1e2631, 0x1e2631, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const halo = this.add.graphics();
    halo.fillStyle(0xc3912a, 0.12);
    halo.fillCircle(860, 250, 220);

    const panel = this.add.graphics();
    panel.fillStyle(0x18202a, 0.92);
    panel.fillRoundedRect(24, 24, GAME_WIDTH - 48, GAME_HEIGHT - 48, 24);
    panel.lineStyle(2, 0xb69042, 0.85);
    panel.strokeRoundedRect(24, 24, GAME_WIDTH - 48, GAME_HEIGHT - 48, 24);

    const inner = this.add.graphics();
    inner.fillStyle(0x202a36, 0.88);
    inner.fillRoundedRect(42, 94, 370, 430, 18);
    inner.fillRoundedRect(430, 94, 336, 430, 18);
    inner.fillRoundedRect(784, 94, 352, 430, 18);
    inner.fillRoundedRect(42, 544, GAME_WIDTH - 84, 188, 18);
  }

  private createHud(): void {
    this.titleText = this.add.text(46, 38, "Revolver Chamber Tactics", {
      fontFamily: "Georgia, serif",
      fontSize: "34px",
      color: "#f4ddb0",
    });

    const creditsIcon = this.add.image(776, 52, REVOLVER_PROTO_SPRITESHEET_KEY, 17);
    creditsIcon.setScale(0.34);

    this.moneyText = this.add.text(938, 40, "", {
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "24px",
      color: "#f4ddb0",
    });
    this.moneyText.setOrigin(1, 0);

    const logButtonBox = this.add.rectangle(1048, 52, 92, 36, 0x223246, 0.95);
    logButtonBox.setStrokeStyle(2, 0xf1c66b, 0.95);
    logButtonBox.setDepth(44);
    logButtonBox.setInteractive({ useHandCursor: true });
    logButtonBox.on("pointerdown", () => this.toggleLogOverlay());

    const logButtonLabel = this.add.text(1048, 52, "LOG", {
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "16px",
      color: "#fff6db",
    });
    logButtonLabel.setOrigin(0.55, 0.5);
    logButtonLabel.setDepth(45);

    const logIcon = this.add.image(1018, 52, REVOLVER_PROTO_SPRITESHEET_KEY, 90);
    logIcon.setScale(0.34);
    logIcon.setDepth(45);

    this.logToggleButton = {
      box: logButtonBox,
      label: logButtonLabel,
    };

    const playerIcon = this.add.image(98, 134, REVOLVER_PROTO_IMAGE_KEY, PROTO_FRAME_NAMES.player);
    playerIcon.setOrigin(0.5);
    playerIcon.setDisplaySize(96, 96);

    this.playerText = this.add.text(46, 144, "", {
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "24px",
      color: "#f4ddb0",
      lineSpacing: 8,
      wordWrap: { width: 330 },
    });

    const enemyIcon = this.add.image(860, 172, REVOLVER_PROTO_IMAGE_KEY, PROTO_FRAME_NAMES.rat_swarm);
    enemyIcon.setOrigin(0.5);
    enemyIcon.setDisplaySize(122, 122);

    this.enemyText = this.add.text(790, 176, "", {
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "24px",
      color: "#f7b87c",
      lineSpacing: 8,
      wordWrap: { width: 300 },
    });

    this.enemyIntentText = this.add.text(790, 294, "", {
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "20px",
      color: "#d7dee8",
    });

    this.enemyIntentDetailText = this.add.text(790, 322, "", {
      fontFamily: "Georgia, serif",
      fontSize: "28px",
      color: "#f7b87c",
      lineSpacing: 4,
      wordWrap: { width: 300 },
    });

    this.outcomeText = this.add.text(430, 104, "", {
      fontFamily: "Georgia, serif",
      fontSize: "24px",
      color: "#f4ddb0",
    });

    const cylinderArt = this.add.image(600, 254, REVOLVER_PROTO_IMAGE_KEY, PROTO_FRAME_NAMES.cylinder);
    cylinderArt.setDisplaySize(184, 184);
    cylinderArt.setAlpha(0.26);

    CHAMBER_POSITIONS.forEach((position, index) => {
      const box = this.add.rectangle(position.x, position.y, 94, 94, 0x263445, 0.95);
      box.setStrokeStyle(3, 0x5b6d82, 1);
      box.setInteractive({ useHandCursor: true });
      box.on("pointerover", () => this.showBulletTooltip(index));
      box.on("pointerout", () => this.hideBulletTooltip());

      const label = this.add.text(position.x, position.y - 6, "", {
        fontFamily: "Courier New, monospace",
        fontSize: "24px",
        color: "#e9edf2",
      });
      label.setOrigin(0.5);

      const chamberIndex = this.add.text(position.x, position.y + 28, `${index + 1}`, {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "16px",
        color: "#9eb0c5",
      });
      chamberIndex.setOrigin(0.5);

      this.chamberVisuals.push({
        box,
        label,
        index: chamberIndex,
      });
    });

    const centerRing = this.add.circle(600, 252, 32, 0x121820, 0.95);
    centerRing.setStrokeStyle(3, 0xb69042, 0.95);

    const accessoryIcon = this.add.image(458, 454, REVOLVER_PROTO_SPRITESHEET_KEY, 90);
    accessoryIcon.setOrigin(0.5);
    accessoryIcon.setScale(0.34);

    this.accessoryHeaderText = this.add.text(480, 442, "", {
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "16px",
      color: "#aeb9c8",
    });
    this.accessoryHeaderText.setAlpha(0.82);

    this.deckText = this.add.text(444, 512, "", {
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "16px",
      color: "#aeb9c8",
      lineSpacing: 5,
      wordWrap: { width: 320 },
    });
    this.deckText.setAlpha(0.82);

    this.footerText = this.add.text(54, 560, "", {
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "20px",
      color: "#d7dee8",
      lineSpacing: 8,
      wordWrap: { width: GAME_WIDTH - 120 },
    });

    this.tooltipBox = this.add.rectangle(0, 0, 250, 94, 0x0f1720, 0.96);
    this.tooltipBox.setStrokeStyle(2, 0xf1c66b, 0.95);
    this.tooltipBox.setVisible(false);
    this.tooltipBox.setDepth(20);

    this.tooltipText = this.add.text(0, 0, "", {
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "16px",
      color: "#fff6db",
      lineSpacing: 5,
      wordWrap: { width: 220 },
    });
    this.tooltipText.setVisible(false);
    this.tooltipText.setDepth(21);

    this.logOverlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x081019, 0.72);
    this.logOverlay.setDepth(50);
    this.logOverlay.setVisible(false);
    this.logOverlay.setInteractive();
    this.logOverlay.on("pointerdown", () => this.setLogOverlayOpen(false));

    this.logPanel = this.add.rectangle(GAME_WIDTH / 2, 360, 520, 520, 0x162230, 0.98);
    this.logPanel.setStrokeStyle(3, 0xf1c66b, 0.95);
    this.logPanel.setDepth(51);
    this.logPanel.setVisible(false);

    this.logTitleText = this.add.text(GAME_WIDTH / 2 - 214, 122, "Combat Log", {
      fontFamily: "Georgia, serif",
      fontSize: "32px",
      color: "#f4ddb0",
    });
    this.logTitleText.setDepth(52);
    this.logTitleText.setVisible(false);

    this.logBodyText = this.add.text(GAME_WIDTH / 2 - 214, 176, "", {
      fontFamily: "Courier New, monospace",
      fontSize: "18px",
      color: "#cbe6c8",
      lineSpacing: 6,
      wordWrap: { width: 428 },
    });
    this.logBodyText.setDepth(52);
    this.logBodyText.setVisible(false);

    const logCloseBox = this.add.rectangle(GAME_WIDTH / 2 + 182, 136, 72, 34, 0x8f6422, 0.95);
    logCloseBox.setStrokeStyle(2, 0xf1c66b, 1);
    logCloseBox.setDepth(52);
    logCloseBox.setVisible(false);
    logCloseBox.setInteractive({ useHandCursor: true });
    logCloseBox.on("pointerdown", () => this.setLogOverlayOpen(false));

    const logCloseLabel = this.add.text(GAME_WIDTH / 2 + 182, 136, "CLOSE", {
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "16px",
      color: "#fff6db",
    });
    logCloseLabel.setOrigin(0.5);
    logCloseLabel.setDepth(53);
    logCloseLabel.setVisible(false);

    this.logCloseButton = {
      box: logCloseBox,
      label: logCloseLabel,
    };

    const buttons: Array<{ action: PlayerAction; x: number; label: string }> = [
      { action: "fire", x: 180, label: "FIRE" },
      { action: "rotate", x: 390, label: "ROTATE" },
      { action: "spin", x: 600, label: "SPIN" },
      { action: "reload", x: 810, label: "RELOAD" },
    ];

    buttons.forEach((button) => {
      const box = this.add.rectangle(button.x, 688, 170, 52, 0x8f6422, 0.95);
      box.setStrokeStyle(2, 0xf1c66b, 1);
      box.setInteractive({ useHandCursor: true });
      box.on("pointerdown", () => this.performAction(button.action));

      const label = this.add.text(button.x, 688, button.label, {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "22px",
        color: "#fff6db",
      });
      label.setOrigin(0.5);

      this.actionButtons.set(button.action, { box, label });
    });

    this.shopOverlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x081019, 0.72);
    this.shopOverlay.setDepth(40);
    this.shopOverlay.setVisible(false);

    this.shopPanel = this.add.rectangle(GAME_WIDTH / 2, 372, 900, 520, 0x162230, 0.98);
    this.shopPanel.setStrokeStyle(3, 0xf1c66b, 0.95);
    this.shopPanel.setDepth(41);
    this.shopPanel.setVisible(false);

    this.shopTitleText = this.add.text(GAME_WIDTH / 2, 132, "", {
      fontFamily: "Georgia, serif",
      fontSize: "36px",
      color: "#f4ddb0",
      align: "center",
    });
    this.shopTitleText.setOrigin(0.5, 0);
    this.shopTitleText.setDepth(42);
    this.shopTitleText.setVisible(false);

    const shopIcon = this.add.image(GAME_WIDTH / 2 - 110, 152, REVOLVER_PROTO_SPRITESHEET_KEY, 20);
    shopIcon.setScale(0.42);
    shopIcon.setDepth(42);
    shopIcon.setVisible(false);

    this.shopMoneyText = this.add.text(GAME_WIDTH / 2, 182, "", {
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "24px",
      color: "#d7dee8",
      align: "center",
    });
    this.shopMoneyText.setOrigin(0.5, 0);
    this.shopMoneyText.setDepth(42);
    this.shopMoneyText.setVisible(false);

    const shopCardXs = [310, 590, 870];
    shopCardXs.forEach((x, index) => {
      const box = this.add.rectangle(x, 360, 230, 250, 0x223246, 0.98);
      box.setStrokeStyle(2, 0x6e8298, 0.9);
      box.setDepth(42);
      box.setVisible(false);
      box.setInteractive({ useHandCursor: true });
      box.on("pointerdown", () => this.buyShopAccessory(index));

      const title = this.add.text(x, 254, "", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "22px",
        color: "#fff6db",
        align: "center",
        wordWrap: { width: 190 },
      });
      title.setOrigin(0.5, 0);
      title.setDepth(43);
      title.setVisible(false);

      const body = this.add.text(x, 312, "", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "18px",
        color: "#d7dee8",
        align: "center",
        lineSpacing: 6,
        wordWrap: { width: 190 },
      });
      body.setOrigin(0.5, 0);
      body.setDepth(43);
      body.setVisible(false);

      this.shopOptionVisuals.push({ box, title, body });
    });

    this.shopHintText = this.add.text(GAME_WIDTH / 2, 598, "", {
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "22px",
      color: "#d7dee8",
      align: "center",
      lineSpacing: 6,
      wordWrap: { width: 760 },
    });
    this.shopHintText.setOrigin(0.5, 0);
    this.shopHintText.setDepth(42);
    this.shopHintText.setVisible(false);

    const continueBox = this.add.rectangle(GAME_WIDTH / 2, 668, 240, 50, 0x8f6422, 0.95);
    continueBox.setStrokeStyle(2, 0xf1c66b, 1);
    continueBox.setDepth(42);
    continueBox.setVisible(false);
    continueBox.setInteractive({ useHandCursor: true });
    continueBox.on("pointerdown", () => this.leaveShop());

    const continueLabel = this.add.text(GAME_WIDTH / 2, 668, "CONTINUE", {
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "22px",
      color: "#fff6db",
    });
    continueLabel.setOrigin(0.5);
    continueLabel.setDepth(43);
    continueLabel.setVisible(false);

    this.shopContinueButton = {
      box: continueBox,
      label: continueLabel,
    };

    this.uiSprites = {
      credits: creditsIcon,
      player: playerIcon,
      enemy: enemyIcon,
      accessories: accessoryIcon,
      log: logIcon,
      shop: shopIcon,
      cylinder: cylinderArt,
    };
  }

  private bindInputs(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      return;
    }

    keyboard.on("keydown-F", () => this.performAction("fire"));
    keyboard.on("keydown-R", () => this.performAction("rotate"));
    keyboard.on("keydown-S", () => this.performAction("spin"));
    keyboard.on("keydown-L", () => this.performAction("reload"));
    keyboard.on("keydown-SPACE", () => this.performAction("fire"));
    keyboard.on("keydown-A", () => this.performAction("rotate"));
    keyboard.on("keydown-B", () => this.performAction("spin"));
    keyboard.on("keydown-UP", () => this.performAction("reload"));

    keyboard.on("keydown-ONE", () => {
      if (this.mode === "shop") {
        this.buyShopAccessory(0);
      } else {
        this.startEncounter("rat_swarm");
      }
    });
    keyboard.on("keydown-TWO", () => {
      if (this.mode === "shop") {
        this.buyShopAccessory(1);
      } else {
        this.startEncounter("riot_droid");
      }
    });
    keyboard.on("keydown-THREE", () => {
      if (this.mode === "shop") {
        this.buyShopAccessory(2);
      } else {
        this.startEncounter("sniper");
      }
    });
    keyboard.on("keydown-FOUR", () => {
      if (this.mode !== "shop") {
        this.startEncounter("drone");
      }
    });

    keyboard.on("keydown-ENTER", () => {
      if (this.mode === "shop") {
        this.leaveShop();
        return;
      }

      if (this.state.over && this.state.outcome === "victory" && this.hasNextEncounter()) {
        this.openShop();
      } else {
        this.startRun();
      }
    });

    keyboard.on("keydown-X", () => this.toggleFullscreen());
    keyboard.on("keydown-ESC", () => {
      if (this.logOpen) {
        this.setLogOverlayOpen(false);
        return;
      }
      if (this.scale.isFullscreen) {
        this.scale.stopFullscreen();
      }
    });
  }

  private startRun(): void {
    this.mode = "combat";
    this.money = 0;
    this.ownedAccessories = [];
    this.shopStock = [];
    this.seedBase = 1337;
    this.shopSeed = 4001;
    this.startEncounter(ENEMY_ORDER[0]);
  }

  private hasNextEncounter(): boolean {
    return this.encounterIndex < ENEMY_ORDER.length - 1;
  }

  private getNextEncounterLabel(): string | null {
    if (!this.hasNextEncounter()) {
      return null;
    }

    return createEnemyState(ENEMY_ORDER[this.encounterIndex + 1]).label;
  }

  private startEncounter(enemyId: EnemyId): void {
    this.encounterIndex = ENEMY_ORDER.indexOf(enemyId);
    this.seedBase += 97;
    this.mode = "combat";
    this.state = createCombatState(this.seedBase, enemyId, undefined, this.ownedAccessories);
    this.logs = [`Loaded encounter: ${this.state.enemy.label}.`];
    this.displayCurrentIndex = this.state.cylinder.currentIndex;
    this.rotationAnimationToken += 1;
    this.pendingRotationSteps = null;
    this.refreshUi();
  }

  private performAction(action: PlayerAction): void {
    if (this.mode !== "combat") {
      return;
    }

    if (this.state.over) {
      this.pushLog("Encounter is over. Press Enter to continue.");
      this.refreshUi();
      return;
    }

    const wasOver = this.state.over;
    const result = stepCombat(this.state, action);
    this.state = result.state;
    result.events.forEach((event) => this.consumeEvent(event));

    if (!wasOver && this.state.over) {
      if (this.state.outcome === "victory") {
        const reward = ENEMY_REWARDS[this.state.enemy.id];
        this.money += reward;
        this.pushLog(`Collected $${reward}.`);
        if (this.hasNextEncounter()) {
          this.openShop();
        } else {
          this.pushLog("Run clear. Press Enter to restart.");
        }
      } else {
        this.pushLog("Defeat. Press Enter to restart from Rat Swarm.");
      }
    }

    this.refreshUi();
  }

  private openShop(): void {
    if (!this.hasNextEncounter()) {
      this.mode = "combat";
      this.refreshUi();
      return;
    }

    const stock = createShopStock(this.shopSeed + this.encounterIndex * 97, this.ownedAccessories);
    this.shopSeed = stock.seed;
    this.shopStock = stock.stock.map((accessoryId) => accessoryId);
    this.mode = "shop";
    this.refreshUi();
  }

  private leaveShop(): void {
    if (this.mode !== "shop") {
      return;
    }

    const nextEnemyId = ENEMY_ORDER[this.encounterIndex + 1];
    if (nextEnemyId) {
      this.startEncounter(nextEnemyId);
    } else {
      this.refreshUi();
    }
  }

  private buyShopAccessory(index: number): void {
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
      this.refreshUi();
      return;
    }
    if (this.money < accessory.price) {
      this.pushLog(`Need $${accessory.price} for ${accessory.label}.`);
      this.refreshUi();
      return;
    }

    this.money -= accessory.price;
    this.ownedAccessories.push(accessoryId);
    this.shopStock[index] = null;
    this.pushLog(`Bought ${accessory.label}.`);
    this.refreshUi();
  }

  private consumeEvent(event: CombatEvent): void {
    switch (event.type) {
      case "log":
        this.pushLog(event.text);
        break;
      case "cylinder_changed":
        if (event.action === "reload") {
          this.rotationAnimationToken += 1;
          this.pendingRotationSteps = null;
          this.displayCurrentIndex = this.state.cylinder.currentIndex;
        } else {
          this.pendingRotationSteps = event.rotations ?? 1;
        }
        break;
    }
  }

  private pushLog(text: string): void {
    this.logs.push(text);
    if (this.logs.length > 12) {
      this.logs = this.logs.slice(-12);
    }
  }

  private toggleFullscreen(): void {
    if (this.scale.isFullscreen) {
      this.scale.stopFullscreen();
    } else {
      this.scale.startFullscreen();
    }
  }

  private toggleLogOverlay(): void {
    this.setLogOverlayOpen(!this.logOpen);
  }

  private setLogOverlayOpen(open: boolean): void {
    this.logOpen = open;
    if (!open) {
      this.hideBulletTooltip();
    }
    this.refreshUi();
  }

  private showBulletTooltip(index: number): void {
    const round = this.state.cylinder.chambers[index];
    const chamber = this.chamberVisuals[index];
    const text = round
      ? [
          BULLET_DEFS[round].label,
          `Damage: ${BULLET_TOOLTIP_LINES[round].damage}`,
          `Effect: ${BULLET_TOOLTIP_LINES[round].effect}`,
          `Effective vs: ${BULLET_TOOLTIP_LINES[round].effectiveVs}`,
        ].join("\n")
      : [
          "Empty Chamber",
          "No round is loaded here.",
          "Fire auto-rotates and rotate skips empties.",
        ].join("\n");
    this.tooltipText.setText(text);

    const textWidth = Math.min(250, Math.ceil(this.tooltipText.width + 26));
    const textHeight = Math.ceil(this.tooltipText.height + 22);
    const x = Phaser.Math.Clamp(chamber.box.x, 430 + textWidth / 2, 760 - textWidth / 2);
    const y = Phaser.Math.Clamp(chamber.box.y - 88, 110 + textHeight / 2, 510 - textHeight / 2);

    this.tooltipBox.setSize(textWidth, textHeight);
    this.tooltipBox.setPosition(x, y);
    this.tooltipText.setPosition(x - textWidth / 2 + 13, y - textHeight / 2 + 11);

    this.tooltipBox.setVisible(true);
    this.tooltipText.setVisible(true);
  }

  private showAccessoryTooltip(accessoryId: AccessoryId, x: number, y: number): void {
    const accessory = ACCESSORY_DEFS[accessoryId];
    this.tooltipText.setText(
      [accessory.label, `Effect: ${accessory.effect}`, accessory.description].join("\n"),
    );

    const textWidth = Math.min(280, Math.ceil(this.tooltipText.width + 26));
    const textHeight = Math.ceil(this.tooltipText.height + 22);
    const clampedX = Phaser.Math.Clamp(x, 430 + textWidth / 2, 760 - textWidth / 2);
    const clampedY = Phaser.Math.Clamp(y, 110 + textHeight / 2, 510 - textHeight / 2);

    this.tooltipBox.setSize(textWidth, textHeight);
    this.tooltipBox.setPosition(clampedX, clampedY);
    this.tooltipText.setPosition(clampedX - textWidth / 2 + 13, clampedY - textHeight / 2 + 11);

    this.tooltipBox.setVisible(true);
    this.tooltipText.setVisible(true);
  }

  private hideBulletTooltip(): void {
    this.tooltipBox.setVisible(false);
    this.tooltipText.setVisible(false);
  }

  private toTitleCase(value: string): string {
    return value
      .toLowerCase()
      .split(/[_\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  private getCompactIntentDetail(intent: ReturnType<typeof getEnemyIntent>): string {
    switch (intent.id) {
      case "shield_up":
        return "+6 Armor";
      case "advance":
        return "Wind up baton strike";
      case "baton_strike":
        return "12 damage";
      case "cooldown":
        return "Drops armor";
      case "scurry":
        return "2 damage";
      case "multiply":
        return "+2 stacks";
      case "swarm_attack":
        return `${intent.previewDamage ?? 0} damage`;
      case "aim_1":
        return "Acquire target";
      case "aim_2":
        return "Hold sightline";
      case "headshot":
        return `${intent.previewDamage ?? 0} damage`;
      case "hover":
        return "Stable target";
      case "evasive":
        return "Reduced slug damage";
      case "laser":
        return `${intent.previewDamage ?? 0} damage`;
      case "recharge":
        return "Exposed";
      default:
        return intent.detail.replace(/\.$/, "");
    }
  }

  private getEnemySummary(): string {
    const lines = [
      this.state.enemy.label.toUpperCase(),
      `HP ${this.state.enemy.hp}/${this.state.enemy.maxHp}`,
    ];
    return lines.join("\n");
  }

  private getAccessorySummary(): string {
    if (this.ownedAccessories.length === 0) {
      return "None";
    }

    return "";
  }

  private renderOwnedAccessories(): void {
    this.accessoryNameTexts.forEach((text) => text.destroy());
    this.accessoryNameTexts = [];

    this.accessoryHeaderText.setText("Accessories");

    if (this.ownedAccessories.length === 0) {
      const emptyText = this.add.text(444, 468, "None", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "16px",
        color: "#7f90a3",
      });
      emptyText.setAlpha(0.82);
      this.accessoryNameTexts.push(emptyText);
      return;
    }

    const startX = 444;
    const startY = 468;
    const maxWidth = 300;
    let cursorX = startX;
    let cursorY = startY;

    this.ownedAccessories.forEach((accessoryId) => {
      const accessory = ACCESSORY_DEFS[accessoryId];
      const label = this.add.text(cursorX, cursorY, accessory.label, {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "16px",
        color: "#dbe7f4",
      });
      label.setAlpha(0.9);
      label.setInteractive({ useHandCursor: true });
      label.on("pointerover", () =>
        this.showAccessoryTooltip(accessoryId, label.x + label.width / 2, label.y - 34),
      );
      label.on("pointerout", () => this.hideBulletTooltip());
      this.accessoryNameTexts.push(label);

      const nextX = cursorX + label.width + 12;
      if (nextX > startX + maxWidth) {
        label.setPosition(startX, cursorY + 24);
        cursorX = startX + label.width + 12;
        cursorY += 24;
      } else {
        cursorX = nextX;
      }
    });
  }

  private refreshShopUi(): void {
    const shopVisible = this.mode === "shop";
    this.shopOverlay.setVisible(shopVisible);
    this.shopPanel.setVisible(shopVisible);
    this.shopTitleText.setVisible(shopVisible);
    this.shopMoneyText.setVisible(shopVisible);
    this.shopHintText.setVisible(shopVisible);
    this.shopContinueButton.box.setVisible(shopVisible);
    this.shopContinueButton.label.setVisible(shopVisible);
    this.uiSprites.shop.setVisible(shopVisible);

    if (!shopVisible) {
      this.shopOptionVisuals.forEach((option) => {
        option.box.setVisible(false);
        option.title.setVisible(false);
        option.body.setVisible(false);
      });
      return;
    }

    this.shopTitleText.setText("SHOP");
    this.shopMoneyText.setText(`Credits: $${this.money}`);
    this.shopHintText.setText("1 / 2 / 3 buy\nEnter or click Continue for the next combat");

    this.shopOptionVisuals.forEach((option, index) => {
      const accessoryId = this.shopStock[index] ?? null;
      option.box.setVisible(true);
      option.title.setVisible(true);
      option.body.setVisible(true);

      if (!accessoryId) {
        option.box.setFillStyle(0x1a2532, 0.9);
        option.box.setStrokeStyle(2, 0x4e6177, 0.75);
        option.title.setText(`${index + 1}. SOLD`);
        option.title.setColor("#9eb0c5");
        option.body.setText("No item here.");
        option.body.setColor("#9eb0c5");
        return;
      }

      const accessory = ACCESSORY_DEFS[accessoryId];
      const affordable = this.money >= accessory.price;
      option.box.setFillStyle(affordable ? 0x223246 : 0x2a1d1d, 0.98);
      option.box.setStrokeStyle(2, affordable ? 0xf1c66b : 0xa26d6d, 0.92);
      option.title.setText(`${index + 1}. ${accessory.label}\n$${accessory.price}`);
      option.title.setColor(affordable ? "#fff6db" : "#f2c7c7");
      option.body.setText(`${accessory.effect}\n\n${accessory.description}`);
      option.body.setColor(affordable ? "#d7dee8" : "#d2b6b6");
    });
  }

  private refreshLogOverlay(): void {
    this.logOverlay.setVisible(this.logOpen);
    this.logPanel.setVisible(this.logOpen);
    this.logTitleText.setVisible(this.logOpen);
    this.logBodyText.setVisible(this.logOpen);
    this.logCloseButton.box.setVisible(this.logOpen);
    this.logCloseButton.label.setVisible(this.logOpen);

    this.logToggleButton.box.setFillStyle(this.logOpen ? 0x8f6422 : 0x223246, 0.95);
    this.logToggleButton.box.setStrokeStyle(2, 0xf1c66b, 0.95);
    this.logToggleButton.label.setColor(this.logOpen ? "#fff6db" : "#d7dee8");
    this.uiSprites.log.setAlpha(this.logOpen ? 1 : 0.88);

    if (!this.logOpen) {
      return;
    }

    this.logBodyText.setText(this.logs.length > 0 ? this.logs.slice(-16).join("\n") : "No events yet.");
  }

  private animateCylinderRotation(rotations: number): void {
    const steps = Math.max(0, rotations);
    const token = ++this.rotationAnimationToken;
    let remaining = steps;
    const stepDelayMs = steps >= 19 ? 40 : 90;

    const advanceOneStep = (): void => {
      if (token !== this.rotationAnimationToken) {
        return;
      }

      remaining -= 1;
      this.displayCurrentIndex = findNextLoadedChamberIndex(
        {
          ...this.state.cylinder,
          currentIndex: this.displayCurrentIndex,
        },
        this.displayCurrentIndex,
      );
      this.renderChambers(true);

      if (remaining > 0) {
        this.time.delayedCall(stepDelayMs, advanceOneStep);
      }
    };

    if (steps <= 0) {
      this.displayCurrentIndex = this.state.cylinder.currentIndex;
      this.renderChambers(false);
      return;
    }

    advanceOneStep();
  }

  private layoutChambers(animated: boolean, currentIndex: number): void {
    const order = getCylinderOrder({
      ...this.state.cylinder,
      currentIndex,
    });

    order.forEach((chamberIndex, slotIndex) => {
      const visual = this.chamberVisuals[chamberIndex];
      const target = CHAMBER_POSITIONS[slotIndex];
      const targets = [
        { object: visual.box, x: target.x, y: target.y },
        { object: visual.label, x: target.x, y: target.y - 6 },
        { object: visual.index, x: target.x, y: target.y + 28 },
      ];

      targets.forEach(({ object, x, y }) => {
        this.tweens.killTweensOf(object);
        if (animated && this.hasPositionedChambers) {
          this.tweens.add({
            targets: object,
            x,
            y,
            duration: 140,
            ease: "Cubic.Out",
          });
        } else {
          object.setPosition(x, y);
        }
      });
    });

    this.hasPositionedChambers = true;
  }

  private renderChambers(animated: boolean): void {
    const order = getCylinderOrder({
      ...this.state.cylinder,
      currentIndex: this.displayCurrentIndex,
    });
    const currentChamber = order[0];
    const nextChamber = order[1];
    const secondNextChamber = order[2];

    this.chamberVisuals.forEach((visual, index) => {
      const round = this.state.cylinder.chambers[index];
      const current = index === currentChamber;
      const next = index === nextChamber;
      const secondNext = index === secondNextChamber;
      const bullet = round ? BULLET_DEFS[round] : null;
      const fillColor = current ? 0x8f6422 : next ? 0x31465d : secondNext ? 0x2b3d52 : 0x263445;
      const fillAlpha = current ? 1 : next ? 0.98 : secondNext ? 0.96 : 0.95;
      const strokeColor = current
        ? 0xf1c66b
        : next
          ? 0xb7c8dc
          : secondNext
            ? 0x7f95ad
            : round
              ? 0x5b6d82
              : 0x3d4d60;
      const strokeWidth = current ? 3 : next ? 3 : secondNext ? 2 : 2;
      const labelColor = current
        ? "#fff6db"
        : next
          ? "#eef4fb"
          : secondNext
            ? "#d7e2ef"
            : bullet
              ? "#e9edf2"
              : "#8fa0b4";
      const indexColor = current ? "#fff6db" : next ? "#dbe7f4" : secondNext ? "#c0cede" : "#9eb0c5";
      const depth = current ? 6 : next ? 5 : secondNext ? 4 : 2;
      const boxScale = current ? 1 : next ? 0.9 : secondNext ? 0.82 : 0.74;
      const textScale = current ? 1 : next ? 0.92 : secondNext ? 0.86 : 0.8;

      visual.box.setFillStyle(fillColor, fillAlpha);
      visual.box.setStrokeStyle(strokeWidth, strokeColor, 1);
      visual.box.setDepth(depth);
      visual.box.setScale(boxScale);
      visual.label.setText(bullet ? bullet.shortLabel : "--");
      visual.label.setColor(labelColor);
      visual.label.setDepth(depth + 1);
      visual.label.setScale(textScale);
      visual.index.setColor(indexColor);
      visual.index.setDepth(depth + 1);
      visual.index.setScale(textScale);
    });
    this.layoutChambers(animated, this.displayCurrentIndex);
  }

  private refreshUi(): void {
    const intent = getEnemyIntent(this.state.enemy);
    const nextLabel = this.getNextEncounterLabel() ?? "next combat";
    const shopVisible = this.mode === "shop";

    this.moneyText.setText(`Credits $${this.money}`);
    this.uiSprites.enemy.setFrame(PROTO_FRAME_NAMES[this.state.enemy.id]);

    this.playerText.setText(
      `PLAYER\nHP ${this.state.player.hp}/${this.state.player.maxHp}\nGuard ${this.state.player.guard}`,
    );

    this.enemyText.setText(this.getEnemySummary());
    this.enemyIntentText.setText("INTENT");
    this.enemyIntentDetailText.setText(
      `${this.toTitleCase(intent.label).toUpperCase()}\n(${this.getCompactIntentDetail(intent).toUpperCase()})`,
    );

    this.outcomeText.setText(
      this.state.over
        ? this.state.outcome === "victory"
          ? this.hasNextEncounter()
            ? "Encounter Clear."
            : "Run Clear."
          : "Defeat."
        : "",
    );

    if (!this.hasPositionedChambers) {
      this.displayCurrentIndex = this.state.cylinder.currentIndex;
    }
    this.renderChambers(!this.hasPositionedChambers);

    if (this.pendingRotationSteps !== null) {
      const rotations = this.pendingRotationSteps;
      this.pendingRotationSteps = null;
      this.animateCylinderRotation(rotations);
    }

    this.renderOwnedAccessories();
    this.deckText.setText(`Hover any chamber for details.`);
    const footerLines = shopVisible
      ? [
          `Spend credits, then press Enter for ${nextLabel}.`,
          "Accessories persist for the rest of the run.",
        ]
      : this.state.over
        ? this.state.outcome === "victory"
          ? this.hasNextEncounter()
            ? [`Encounter clear. Press Enter for shop, then ${nextLabel}.`, "Match ammo to enemy states."]
            : ["Run clear. Press Enter to restart.", "Accessories reset with a new run."]
          : ["Defeat. Press Enter to restart from Rat Swarm.", "Accessories reset with a new run."]
        : [
            "Enemy telegraphs. You choose an action. Then the enemy acts.",
            "Match ammo to enemy states.",
          ];
    this.footerText.setText(footerLines.join("\n"));

    this.actionButtons.forEach((button) => {
      const disabled = this.state.over || shopVisible;
      button.box.setAlpha(disabled ? 0.3 : 0.95);
      button.label.setAlpha(disabled ? 0.45 : 1);
    });

    this.refreshShopUi();
    this.refreshLogOverlay();
    this.hideBulletTooltip();
  }
}

export const GAME_BOUNDS = {
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
};

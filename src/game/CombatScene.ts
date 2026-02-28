import Phaser from "phaser";
import { BULLET_DEFS } from "../core/content/bullets";
import { ENEMY_ORDER, getEnemyIntent, getEnemyTags } from "../core/content/enemies";
import {
  createCombatState,
  describeEnemyMetrics,
  getCombatSnapshot,
  stepCombat,
} from "../core/resolve";
import type { CombatEvent, CombatState, EnemyId, PlayerAction } from "../core/types";

const GAME_WIDTH = 1180;
const GAME_HEIGHT = 780;

type ChamberVisual = {
  box: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  index: Phaser.GameObjects.Text;
};

type ActionButton = {
  box: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
};

export class CombatScene extends Phaser.Scene {
  public static readonly SCENE_KEY = "CombatScene";

  private encounterIndex = 0;
  private seedBase = 1337;
  private state!: CombatState;
  private lastAdvanceMs = 0;
  private logs: string[] = [];

  private titleText!: Phaser.GameObjects.Text;
  private encounterText!: Phaser.GameObjects.Text;
  private playerText!: Phaser.GameObjects.Text;
  private enemyText!: Phaser.GameObjects.Text;
  private enemyIntentText!: Phaser.GameObjects.Text;
  private enemyDetailText!: Phaser.GameObjects.Text;
  private deckText!: Phaser.GameObjects.Text;
  private bulletGuideText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private footerText!: Phaser.GameObjects.Text;
  private outcomeText!: Phaser.GameObjects.Text;

  private readonly chamberVisuals: ChamberVisual[] = [];
  private readonly actionButtons = new Map<PlayerAction, ActionButton>();

  constructor() {
    super(CombatScene.SCENE_KEY);
  }

  create(): void {
    this.createBackground();
    this.createHud();
    this.bindInputs();
    this.startEncounter(ENEMY_ORDER[0]);
  }

  public renderGameToText(): string {
    const snapshot = getCombatSnapshot(this.state);
    return JSON.stringify({
      coordinateSystem:
        "UI-only combat state. Chamber indices run left-to-right, top row then bottom row.",
      lastAdvanceMs: this.lastAdvanceMs,
      logs: this.logs.slice(-6),
      ...snapshot,
    });
  }

  public advanceTime(ms: number): void {
    this.lastAdvanceMs = Math.max(0, Math.floor(ms));
    this.refreshUi();
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

    this.encounterText = this.add.text(46, 98, "", {
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "22px",
      color: "#d7dee8",
      wordWrap: { width: 340 },
    });

    this.playerText = this.add.text(46, 176, "", {
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "24px",
      color: "#f4ddb0",
      lineSpacing: 8,
      wordWrap: { width: 330 },
    });

    this.enemyText = this.add.text(46, 278, "", {
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "24px",
      color: "#f7b87c",
      lineSpacing: 8,
      wordWrap: { width: 330 },
    });

    this.enemyIntentText = this.add.text(46, 394, "", {
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "22px",
      color: "#b8e2ff",
      lineSpacing: 6,
      wordWrap: { width: 330 },
    });

    this.enemyDetailText = this.add.text(46, 472, "", {
      fontFamily: "Courier New, monospace",
      fontSize: "19px",
      color: "#d7dee8",
      lineSpacing: 6,
      wordWrap: { width: 330 },
    });

    this.outcomeText = this.add.text(430, 104, "", {
      fontFamily: "Georgia, serif",
      fontSize: "24px",
      color: "#f4ddb0",
    });

    const positions = [
      { x: 492, y: 182 },
      { x: 604, y: 146 },
      { x: 692, y: 228 },
      { x: 644, y: 340 },
      { x: 532, y: 340 },
      { x: 452, y: 244 },
    ];

    positions.forEach((position, index) => {
      const box = this.add.rectangle(position.x, position.y, 94, 94, 0x263445, 0.95);
      box.setStrokeStyle(3, 0x5b6d82, 1);

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

    const centerRing = this.add.circle(570, 242, 52, 0x121820, 0.95);
    centerRing.setStrokeStyle(3, 0xb69042, 0.95);

    this.deckText = this.add.text(430, 430, "", {
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "22px",
      color: "#d7dee8",
      lineSpacing: 8,
      wordWrap: { width: 320 },
    });

    this.bulletGuideText = this.add.text(790, 108, "", {
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "18px",
      color: "#d7dee8",
      lineSpacing: 7,
      wordWrap: { width: 324 },
    });

    this.logText = this.add.text(790, 372, "", {
      fontFamily: "Courier New, monospace",
      fontSize: "17px",
      color: "#cbe6c8",
      lineSpacing: 6,
      wordWrap: { width: 320 },
    });

    this.footerText = this.add.text(54, 560, "", {
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "20px",
      color: "#d7dee8",
      lineSpacing: 8,
      wordWrap: { width: GAME_WIDTH - 120 },
    });

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

    keyboard.on("keydown-ONE", () => this.startEncounter("rat_swarm"));
    keyboard.on("keydown-TWO", () => this.startEncounter("riot_droid"));
    keyboard.on("keydown-THREE", () => this.startEncounter("sniper"));
    keyboard.on("keydown-FOUR", () => this.startEncounter("drone"));

    keyboard.on("keydown-ENTER", () => {
      this.startEncounter(ENEMY_ORDER[this.encounterIndex]);
    });

    keyboard.on("keydown-X", () => this.toggleFullscreen());
    keyboard.on("keydown-ESC", () => {
      if (this.scale.isFullscreen) {
        this.scale.stopFullscreen();
      }
    });
  }

  private startEncounter(enemyId: EnemyId): void {
    this.encounterIndex = ENEMY_ORDER.indexOf(enemyId);
    this.seedBase += 97;
    this.state = createCombatState(this.seedBase, enemyId);
    this.logs = [`Loaded encounter: ${this.state.enemy.label}.`];
    this.refreshUi();
  }

  private performAction(action: PlayerAction): void {
    if (this.state.over) {
      this.pushLog("Encounter is over. Press Enter or choose another enemy.");
      this.refreshUi();
      return;
    }

    const result = stepCombat(this.state, action);
    this.state = result.state;
    result.events.forEach((event) => this.consumeEvent(event));
    this.refreshUi();
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

  private toggleFullscreen(): void {
    if (this.scale.isFullscreen) {
      this.scale.stopFullscreen();
    } else {
      this.scale.startFullscreen();
    }
  }

  private refreshUi(): void {
    const intent = getEnemyIntent(this.state.enemy);
    const tags = getEnemyTags(this.state.enemy);
    const enemyMetrics = describeEnemyMetrics(this.state.enemy);

    this.encounterText.setText(
      `Encounter ${this.encounterIndex + 1}/4: ${this.state.enemy.label}\n1 Rat Swarm  2 Riot Droid  3 Sniper  4 Drone`,
    );

    this.playerText.setText(
      `Player\nHP ${this.state.player.hp}/${this.state.player.maxHp}\nGuard ${this.state.player.guard}`,
    );

    this.enemyText.setText(`Enemy\n${enemyMetrics.join("\n")}`);

    this.enemyIntentText.setText(
      `Intent\n${intent.label}: ${intent.detail}\nTags: ${tags.length > 0 ? tags.join(", ") : "none"}`,
    );

    this.enemyDetailText.setText(
      [`Turn ${this.state.turn}`, `Outcome ${this.state.outcome ?? "active"}`, `Current chamber ${this.state.cylinder.currentIndex + 1}`].join("\n"),
    );

    this.outcomeText.setText(
      this.state.over
        ? this.state.outcome === "victory"
          ? "Enemy down."
          : "Defeat."
        : "",
    );

    this.chamberVisuals.forEach((visual, index) => {
      const round = this.state.cylinder.chambers[index];
      const current = index === this.state.cylinder.currentIndex;
      const bullet = round ? BULLET_DEFS[round] : null;
      visual.box.setFillStyle(current ? 0x8f6422 : 0x263445, current ? 1 : 0.95);
      visual.box.setStrokeStyle(3, current ? 0xf1c66b : round ? 0x5b6d82 : 0x3d4d60, 1);
      visual.label.setText(bullet ? bullet.shortLabel : "--");
      visual.label.setColor(current ? "#fff6db" : bullet ? "#e9edf2" : "#8fa0b4");
      visual.index.setColor(current ? "#fff6db" : "#9eb0c5");
    });

    this.deckText.setText(
      [
        "Deck",
        `Draw ${this.state.deck.draw.length}`,
        `Discard ${this.state.deck.discard.length}`,
        "Press F fire, R rotate, S spin, L reload.",
      ].join("\n"),
    );

    this.bulletGuideText.setText(
      [
        "Ammo Matchups",
        "BRD clears swarm stacks.",
        "BCK interrupts charge and punishes exposed.",
        "SLG crushes hover, weak into evasive.",
        "AP ignores armor, weak when armor is gone.",
        "FLC adds shred or infestation setup.",
        "BLK converts the turn into guard.",
      ].join("\n"),
    );

    this.logText.setText(["Combat Log", ...this.logs.slice(-6)].join("\n"));

    this.footerText.setText(
      [
        "Loop: enemy telegraphs, you choose one revolver action, then the enemy resolves its turn.",
        "Use rotate and spin to line up the right chamber instead of brute-forcing every shot.",
        "Keys: F fire, R rotate, S spin, L reload. Press Enter to restart, X for fullscreen.",
      ].join("\n"),
    );

    this.actionButtons.forEach((button) => {
      button.box.setAlpha(this.state.over ? 0.65 : 0.95);
      button.label.setAlpha(this.state.over ? 0.75 : 1);
    });
  }
}

export const GAME_BOUNDS = {
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
};

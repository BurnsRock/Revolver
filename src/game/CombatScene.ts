import Phaser from "phaser";
import { BULLET_DEFS } from "../core/content/bullets";
import {
  CYLINDER_ROTATION_DIRECTION,
  findNextLoadedChamberIndex,
  getCylinderOrder,
} from "../core/cylinder";
import { createEnemyState, ENEMY_ORDER, getEnemyIntent } from "../core/content/enemies";
import { createCombatState, getCombatSnapshot, stepCombat } from "../core/resolve";
import type { CombatEvent, CombatState, EnemyId, PlayerAction } from "../core/types";

const GAME_WIDTH = 1180;
const GAME_HEIGHT = 780;
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
  private playerText!: Phaser.GameObjects.Text;
  private enemyText!: Phaser.GameObjects.Text;
  private enemyIntentText!: Phaser.GameObjects.Text;
  private enemyIntentDetailText!: Phaser.GameObjects.Text;
  private deckText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private footerText!: Phaser.GameObjects.Text;
  private outcomeText!: Phaser.GameObjects.Text;
  private tooltipBox!: Phaser.GameObjects.Rectangle;
  private tooltipText!: Phaser.GameObjects.Text;
  private hasPositionedChambers = false;
  private displayCurrentIndex = 0;
  private rotationAnimationToken = 0;
  private pendingRotationSteps: number | null = null;

  private readonly chamberVisuals: ChamberVisual[] = [];
  private readonly actionButtons = new Map<PlayerAction, ActionButton>();

  constructor() {
    super(CombatScene.SCENE_KEY);
  }

  create(): void {
    this.createBackground();
    this.createHud();
    this.bindInputs();
    this.startRun();
  }

  public renderGameToText(): string {
    const snapshot = getCombatSnapshot(this.state);
    return JSON.stringify({
      coordinateSystem:
        "UI-only combat state. Chamber indices run left-to-right, top row then bottom row.",
      encounter: {
        index: this.encounterIndex + 1,
        total: ENEMY_ORDER.length,
        next: this.getNextEncounterLabel(),
      },
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

    this.playerText = this.add.text(46, 98, "", {
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "24px",
      color: "#f4ddb0",
      lineSpacing: 8,
      wordWrap: { width: 330 },
    });

    this.enemyText = this.add.text(46, 332, "", {
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "24px",
      color: "#f7b87c",
      lineSpacing: 8,
      wordWrap: { width: 330 },
    });

    this.enemyIntentText = this.add.text(46, 430, "", {
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "20px",
      color: "#d7dee8",
    });

    this.enemyIntentDetailText = this.add.text(46, 456, "", {
      fontFamily: "Georgia, serif",
      fontSize: "28px",
      color: "#f7b87c",
      lineSpacing: 4,
      wordWrap: { width: 330 },
    });

    this.outcomeText = this.add.text(430, 104, "", {
      fontFamily: "Georgia, serif",
      fontSize: "24px",
      color: "#f4ddb0",
    });

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

    this.deckText = this.add.text(444, 442, "", {
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "16px",
      color: "#aeb9c8",
      lineSpacing: 5,
      wordWrap: { width: 320 },
    });
    this.deckText.setAlpha(0.82);

    this.logText = this.add.text(790, 108, "", {
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
      if (this.state.over && this.state.outcome === "victory" && this.hasNextEncounter()) {
        this.startEncounter(ENEMY_ORDER[this.encounterIndex + 1]);
      } else {
        this.startRun();
      }
    });

    keyboard.on("keydown-X", () => this.toggleFullscreen());
    keyboard.on("keydown-ESC", () => {
      if (this.scale.isFullscreen) {
        this.scale.stopFullscreen();
      }
    });
  }

  private startRun(): void {
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
    this.state = createCombatState(this.seedBase, enemyId);
    this.logs = [`Loaded encounter: ${this.state.enemy.label}.`];
    this.displayCurrentIndex = this.state.cylinder.currentIndex;
    this.rotationAnimationToken += 1;
    this.pendingRotationSteps = null;
    this.refreshUi();
  }

  private performAction(action: PlayerAction): void {
    if (this.state.over) {
      this.pushLog("Encounter is over. Press Enter to continue or restart.");
      this.refreshUi();
      return;
    }

    const wasOver = this.state.over;
    const result = stepCombat(this.state, action);
    this.state = result.state;
    result.events.forEach((event) => this.consumeEvent(event));

    if (!wasOver && this.state.over) {
      if (this.state.outcome === "victory") {
        const nextLabel = this.getNextEncounterLabel();
        this.pushLog(
          nextLabel
            ? `Encounter clear. Press Enter for ${nextLabel}.`
            : "Run clear. Press Enter to restart.",
        );
      } else {
        this.pushLog("Defeat. Press Enter to restart from Rat Swarm.");
      }
    }

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

  private getEnemySummary(intent: ReturnType<typeof getEnemyIntent>): string {
    const lines = [
      this.state.enemy.label.toUpperCase(),
      `HP ${this.state.enemy.hp}/${this.state.enemy.maxHp}`,
    ];
    return lines.join("\n");
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
    const nextLabel = this.getNextEncounterLabel();

    this.playerText.setText(
      `PLAYER\nHP ${this.state.player.hp}/${this.state.player.maxHp}\nGuard ${this.state.player.guard}\n\nVS`,
    );

    this.enemyText.setText(this.getEnemySummary(intent));
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

    this.deckText.setText("Hover any chamber for details.");
    this.logText.setText(["Combat Log", ...this.logs.slice(-12)].join("\n"));

    const footerLines = this.state.over
      ? this.state.outcome === "victory"
        ? this.hasNextEncounter()
          ? [`Encounter clear. Press Enter for ${nextLabel}.`, "Match ammo to enemy states."]
          : ["Run clear. Press Enter to restart.", "Match ammo to enemy states."]
        : ["Defeat. Press Enter to restart from Rat Swarm.", "Match ammo to enemy states."]
      : [
          "Enemy telegraphs. You choose an action. Then the enemy acts.",
          "Match ammo to enemy states.",
        ];
    this.footerText.setText(footerLines.join("\n"));

    this.actionButtons.forEach((button) => {
      button.box.setAlpha(this.state.over ? 0.65 : 0.95);
      button.label.setAlpha(this.state.over ? 0.75 : 1);
    });

    this.hideBulletTooltip();
  }
}

export const GAME_BOUNDS = {
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
};

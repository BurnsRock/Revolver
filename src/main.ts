import Phaser from "phaser";
import "./style.css";

const GAME_WIDTH = 1000;
const GAME_HEIGHT = 700;

type GameMode = "menu" | "playing" | "victory" | "defeat";
type BulletType =
  | "standard"
  | "explosive"
  | "blank"
  | "piercing"
  | "echo"
  | "cursed"
  | "junk";
type PlayerAction = "fire" | "rotate" | "spin" | "reload";

interface Bullet {
  id: number;
  type: BulletType;
}

interface EnemyIntent {
  type: "attack" | "brace";
  value: number;
  label: string;
}

interface ActionButton {
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Rectangle;
}

const BULLET_LABELS: Record<BulletType, string> = {
  standard: "Standard",
  explosive: "Explosive",
  blank: "Blank",
  piercing: "Piercing",
  echo: "Echo",
  cursed: "Cursed",
  junk: "Junk",
};

class RevolverScene extends Phaser.Scene {
  private mode: GameMode = "menu";

  private playerHp = 90;
  private playerGuard = 0;
  private enemyHp = 40;
  private enemyArmor = 0;
  private enemyBurn = 0;

  private turn = 1;
  private drawPile: Bullet[] = [];
  private discardPile: Bullet[] = [];
  private cylinder: Bullet[] = [];
  private enemyIntentIndex = 0;
  private nextBulletId = 1;
  private lastEffectBulletType: BulletType | null = null;
  private logs: string[] = [];
  private lastAdvanceMs = 0;

  private readonly enemyIntents: EnemyIntent[] = [
    { type: "attack", value: 6, label: "Shoot for 6" },
    { type: "brace", value: 4, label: "Brace (+4 armor)" },
    { type: "attack", value: 8, label: "Heavy shot for 8" },
    { type: "attack", value: 5, label: "Quick shot for 5" },
  ];

  private titleText!: Phaser.GameObjects.Text;
  private subtitleText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private playerText!: Phaser.GameObjects.Text;
  private enemyText!: Phaser.GameObjects.Text;
  private intentText!: Phaser.GameObjects.Text;
  private pilesText!: Phaser.GameObjects.Text;
  private cylinderText!: Phaser.GameObjects.Text;
  private logsText!: Phaser.GameObjects.Text;
  private controlsText!: Phaser.GameObjects.Text;

  private readonly actionButtons = new Map<PlayerAction, ActionButton>();

  constructor() {
    super("RevolverScene");
  }

  create(): void {
    this.createBackground();
    this.createHud();
    this.createButtons();
    this.bindInputs();
    this.showMenu();
  }

  public renderGameToText(): string {
    const payload = {
      coordinateSystem:
        "UI-only encounter state. Cylinder order is left-to-right index 0..n-1.",
      mode: this.mode,
      turn: this.turn,
      player: { hp: this.playerHp, guard: this.playerGuard },
      enemy: {
        hp: this.enemyHp,
        armor: this.enemyArmor,
        burn: this.enemyBurn,
        intent: this.getEnemyIntent().label,
      },
      cylinder: {
        next: this.cylinder[0]?.type ?? "empty",
        order: this.cylinder.map((bullet) => bullet.type),
      },
      drawCount: this.drawPile.length,
      discardCount: this.discardPile.length,
      lastAdvanceMs: this.lastAdvanceMs,
      logs: this.logs.slice(-4),
    };
    return JSON.stringify(payload);
  }

  public advanceTime(ms: number): void {
    this.lastAdvanceMs = Math.max(0, Math.floor(ms));
    this.refreshHud();
  }

  private createBackground(): void {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x252020, 0x252020, 0x131415, 0x131415, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const panel = this.add.graphics();
    panel.fillStyle(0x1d2021, 0.95);
    panel.fillRoundedRect(24, 80, GAME_WIDTH - 48, GAME_HEIGHT - 120, 12);
    panel.lineStyle(2, 0x6f5f4a, 0.9);
    panel.strokeRoundedRect(24, 80, GAME_WIDTH - 48, GAME_HEIGHT - 120, 12);
  }

  private createHud(): void {
    this.titleText = this.add
      .text(32, 20, "Revolver Roguelike MVP", {
        fontFamily: "Georgia, serif",
        fontSize: "36px",
        color: "#f5dfb7",
      })
      .setDepth(2);

    this.subtitleText = this.add
      .text(36, 66, "", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "18px",
        color: "#d8d3c9",
      })
      .setDepth(2);

    this.promptText = this.add
      .text(36, 108, "", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "20px",
        color: "#f2e5ce",
      })
      .setDepth(2);

    this.playerText = this.add
      .text(36, 170, "", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "22px",
        color: "#ebd1b1",
      })
      .setDepth(2);

    this.enemyText = this.add
      .text(36, 230, "", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "22px",
        color: "#d3c7b3",
      })
      .setDepth(2);

    this.intentText = this.add
      .text(36, 288, "", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "20px",
        color: "#f6d494",
      })
      .setDepth(2);

    this.pilesText = this.add
      .text(36, 342, "", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "20px",
        color: "#c5c8d3",
      })
      .setDepth(2);

    this.cylinderText = this.add
      .text(36, 390, "", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "19px",
        color: "#e8e6e2",
      })
      .setDepth(2);

    this.logsText = this.add
      .text(36, 450, "", {
        fontFamily: "Courier New, monospace",
        fontSize: "18px",
        color: "#b9d9b4",
        lineSpacing: 4,
      })
      .setDepth(2);

    this.controlsText = this.add
      .text(560, 446, "", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "17px",
        color: "#d1cab9",
        lineSpacing: 6,
      })
      .setDepth(2);
  }

  private createButtons(): void {
    const baseY = 600;
    const buttons: Array<{ action: PlayerAction; x: number; label: string }> = [
      { action: "fire", x: 80, label: "Fire (Space)" },
      { action: "rotate", x: 280, label: "Rotate (R)" },
      { action: "spin", x: 480, label: "Spin (S)" },
      { action: "reload", x: 680, label: "Reload (L)" },
    ];

    for (const button of buttons) {
      const entry = this.createActionButton(
        button.x,
        baseY,
        button.label,
        () => this.performPlayerAction(button.action),
      );
      this.actionButtons.set(button.action, entry);
    }
  }

  private createActionButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
  ): ActionButton {
    const width = 180;
    const height = 52;

    const background = this.add.rectangle(0, 0, width, height, 0x3b3127, 0.95);
    background.setStrokeStyle(2, 0xa58f6f, 0.95);
    const text = this.add.text(0, 0, label, {
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "20px",
      color: "#f4e4cb",
    });
    text.setOrigin(0.5);

    const container = this.add.container(x, y, [background, text]);
    container.setSize(width, height);
    container.setInteractive(
      new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
      Phaser.Geom.Rectangle.Contains,
    );

    container.on("pointerover", () => background.setFillStyle(0x514237, 1));
    container.on("pointerout", () => background.setFillStyle(0x3b3127, 0.95));
    container.on("pointerdown", () => onClick());

    return { container, background };
  }

  private bindInputs(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      return;
    }

    keyboard.on("keydown-ENTER", () => {
      if (this.mode === "menu" || this.mode === "victory" || this.mode === "defeat") {
        this.startRun();
      }
    });

    keyboard.on("keydown-SPACE", () => this.performPlayerAction("fire"));
    keyboard.on("keydown-R", () => this.performPlayerAction("rotate"));
    keyboard.on("keydown-S", () => this.performPlayerAction("spin"));
    keyboard.on("keydown-L", () => this.performPlayerAction("reload"));
    keyboard.on("keydown-A", () => this.performPlayerAction("rotate"));
    keyboard.on("keydown-B", () => this.performPlayerAction("spin"));
    keyboard.on("keydown-UP", () => this.performPlayerAction("reload"));

    keyboard.on("keydown-F", () => this.toggleFullscreen());
    keyboard.on("keydown-ESC", () => {
      if (this.scale.isFullscreen) {
        this.scale.stopFullscreen();
      }
    });
  }

  private showMenu(): void {
    this.mode = "menu";
    this.subtitleText.setText("Turn-based duel built from the GDD revolver loop.");
    this.promptText.setText("Press Enter to start a run.");
    this.logs = [
      "Goal: reduce enemy HP to 0 before your HP reaches 0.",
      "Enemy acts after every action you take.",
    ];
    this.refreshHud();
  }

  private startRun(): void {
    this.mode = "playing";
    this.playerHp = 90;
    this.playerGuard = 0;
    this.enemyHp = 40;
    this.enemyArmor = 0;
    this.enemyBurn = 0;
    this.turn = 1;
    this.drawPile = this.shuffle(this.createStartingDeck());
    this.discardPile = [];
    this.cylinder = [];
    this.enemyIntentIndex = 0;
    this.lastEffectBulletType = null;
    this.logs = [];
    this.drawToCylinder(6);
    this.pushLog("Run started. Enemy telegraphs intent each turn.");
    this.refreshHud();
  }

  private performPlayerAction(action: PlayerAction): void {
    if (this.mode !== "playing") {
      return;
    }

    const acted = this.resolveAction(action);
    if (!acted || this.mode !== "playing") {
      this.refreshHud();
      return;
    }

    if (this.enemyHp <= 0) {
      this.win();
      return;
    }

    this.resolveEnemyTurn();

    if (this.enemyHp <= 0) {
      this.win();
      return;
    }
    if (this.playerHp <= 0) {
      this.lose();
      return;
    }

    this.turn += 1;
    this.refreshHud();
  }

  private resolveAction(action: PlayerAction): boolean {
    switch (action) {
      case "fire": {
        if (this.cylinder.length === 0) {
          this.pushLog("Cylinder is empty. Reload first.");
          return false;
        }
        const bullet = this.cylinder.shift();
        if (!bullet) {
          return false;
        }
        this.pushLog(`Fire -> ${BULLET_LABELS[bullet.type]}`);
        this.resolveBulletEffect(bullet);
        this.discardPile.push(bullet);
        return true;
      }
      case "rotate": {
        if (this.cylinder.length === 0) {
          this.pushLog("Cylinder is empty. Reload first.");
          return false;
        }
        const first = this.cylinder.shift();
        if (first) {
          this.cylinder.push(first);
        }
        this.pushLog("Rotate -> advanced one chamber.");
        return true;
      }
      case "spin": {
        if (this.cylinder.length === 0) {
          this.pushLog("Cylinder is empty. Reload first.");
          return false;
        }
        this.cylinder = this.shuffle(this.cylinder);
        this.pushLog("Spin -> chamber order shuffled.");
        return true;
      }
      case "reload": {
        if (this.cylinder.length > 0) {
          this.discardPile.push(...this.cylinder);
        }
        this.cylinder = [];
        this.drawToCylinder(6);
        this.pushLog("Reload -> drew up to 6 rounds.");
        return true;
      }
      default:
        return false;
    }
  }

  private resolveBulletEffect(bullet: Bullet): void {
    let effectType = bullet.type;
    if (bullet.type === "echo") {
      effectType = this.lastEffectBulletType ?? "standard";
      this.pushLog(`Echo copies ${BULLET_LABELS[effectType]} effect.`);
    }

    if (effectType !== "echo") {
      this.lastEffectBulletType = effectType;
    }

    switch (effectType) {
      case "standard":
        this.damageEnemy(6, false);
        this.pushLog("Enemy takes 6 damage.");
        break;
      case "explosive":
        this.damageEnemy(4, false);
        this.enemyBurn += 2;
        this.pushLog("Enemy takes 4 and gains 2 burn.");
        break;
      case "blank":
        this.playerGuard += 5;
        this.pushLog("Blank fired. You gain 5 guard.");
        break;
      case "piercing":
        this.damageEnemy(5, true);
        this.pushLog("Piercing round ignores armor for 5 damage.");
        break;
      case "cursed":
        this.damageEnemy(10, true);
        this.discardPile.push(this.createBullet("junk"));
        this.pushLog("Cursed shot deals 10 and adds a Junk bullet.");
        break;
      case "junk":
        this.pushLog("Junk round fizzles. No effect.");
        break;
      case "echo":
        break;
    }
  }

  private resolveEnemyTurn(): void {
    if (this.enemyBurn > 0) {
      this.damageEnemy(this.enemyBurn, true);
      this.pushLog(`Burn deals ${this.enemyBurn} damage at enemy turn start.`);
      this.enemyBurn = Math.max(0, this.enemyBurn - 1);
      if (this.enemyHp <= 0) {
        return;
      }
    }

    const intent = this.getEnemyIntent();
    if (intent.type === "attack") {
      this.damagePlayer(intent.value);
      this.pushLog(`Enemy action: ${intent.label}.`);
    } else {
      this.enemyArmor += intent.value;
      this.pushLog(`Enemy action: ${intent.label}.`);
    }

    this.enemyIntentIndex = (this.enemyIntentIndex + 1) % this.enemyIntents.length;
  }

  private getEnemyIntent(): EnemyIntent {
    return this.enemyIntents[this.enemyIntentIndex % this.enemyIntents.length];
  }

  private damageEnemy(amount: number, ignoreArmor: boolean): void {
    if (amount <= 0 || this.enemyHp <= 0) {
      return;
    }

    let applied = amount;
    if (!ignoreArmor && this.enemyArmor > 0) {
      const blocked = Math.min(this.enemyArmor, amount);
      this.enemyArmor -= blocked;
      applied -= blocked;
      if (blocked > 0) {
        this.pushLog(`Enemy armor blocks ${blocked}.`);
      }
    }

    if (applied > 0) {
      this.enemyHp = Math.max(0, this.enemyHp - applied);
    }
  }

  private damagePlayer(amount: number): void {
    let applied = amount;
    if (this.playerGuard > 0) {
      const blocked = Math.min(this.playerGuard, amount);
      this.playerGuard -= blocked;
      applied -= blocked;
      if (blocked > 0) {
        this.pushLog(`Guard blocks ${blocked}.`);
      }
    }
    if (applied > 0) {
      this.playerHp = Math.max(0, this.playerHp - applied);
    }
  }

  private drawToCylinder(count: number): void {
    for (let i = 0; i < count; i += 1) {
      const bullet = this.drawBullet();
      if (!bullet) {
        break;
      }
      this.cylinder.push(bullet);
    }
  }

  private drawBullet(): Bullet | null {
    if (this.drawPile.length === 0) {
      if (this.discardPile.length === 0) {
        return null;
      }
      this.drawPile = this.shuffle(this.discardPile);
      this.discardPile = [];
      this.pushLog("Discard shuffled into draw pile.");
    }

    const bullet = this.drawPile.pop();
    return bullet ?? null;
  }

  private createStartingDeck(): Bullet[] {
    const deck: Bullet[] = [];

    const addBullets = (type: BulletType, count: number): void => {
      for (let i = 0; i < count; i += 1) {
        deck.push(this.createBullet(type));
      }
    };

    addBullets("standard", 5);
    addBullets("explosive", 2);
    addBullets("blank", 2);
    addBullets("piercing", 2);
    addBullets("echo", 1);
    addBullets("cursed", 1);

    return deck;
  }

  private createBullet(type: BulletType): Bullet {
    return { id: this.nextBulletId++, type };
  }

  private shuffle<T>(values: T[]): T[] {
    const arr = [...values];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  private toggleFullscreen(): void {
    if (this.scale.isFullscreen) {
      this.scale.stopFullscreen();
    } else {
      this.scale.startFullscreen();
    }
  }

  private win(): void {
    this.mode = "victory";
    this.subtitleText.setText("Victory.");
    this.promptText.setText("Press Enter to run it again.");
    this.pushLog("Enemy defeated.");
    this.refreshHud();
  }

  private lose(): void {
    this.mode = "defeat";
    this.subtitleText.setText("Defeat.");
    this.promptText.setText("Press Enter to retry.");
    this.pushLog("You were defeated.");
    this.refreshHud();
  }

  private pushLog(line: string): void {
    this.logs.push(line);
    if (this.logs.length > 8) {
      this.logs = this.logs.slice(-8);
    }
  }

  private refreshHud(): void {
    if (this.mode === "playing") {
      this.subtitleText.setText("Encounter in progress.");
      this.promptText.setText(
        `Turn ${this.turn}. Enemy intent: ${this.getEnemyIntent().label}`,
      );
    } else if (this.mode === "menu") {
      this.controlsText.setText(
        [
          "Controls",
          "Enter: start run",
          "F: toggle fullscreen",
          "Esc: exit fullscreen",
        ].join("\n"),
      );
    }

    this.playerText.setText(`Player -> HP ${this.playerHp} | Guard ${this.playerGuard}`);
    this.enemyText.setText(`Enemy -> HP ${this.enemyHp} | Armor ${this.enemyArmor}`);
    this.intentText.setText(
      `Enemy Intent: ${this.getEnemyIntent().label} | Burn: ${this.enemyBurn}`,
    );
    this.pilesText.setText(
      `Draw Pile: ${this.drawPile.length} | Discard: ${this.discardPile.length} | Cylinder: ${this.cylinder.length}`,
    );

    const chamberText =
      this.cylinder.length === 0
        ? "Cylinder: [empty]"
        : this.cylinder
            .map((bullet, index) =>
              index === 0 ? `[${BULLET_LABELS[bullet.type]}]` : BULLET_LABELS[bullet.type],
            )
            .join("  ->  ");
    this.cylinderText.setText(`Cylinder Order: ${chamberText}`);

    this.logsText.setText(this.logs.slice(-6).join("\n"));

    if (this.mode === "playing") {
      this.controlsText.setText(
        [
          "Controls",
          "Space: Fire",
          "R or A: Rotate",
          "S or B: Spin",
          "L or Up: Reload",
          "F: Fullscreen",
        ].join("\n"),
      );
    }

    for (const [action, button] of this.actionButtons.entries()) {
      const enabled = this.mode === "playing";
      button.container.input!.enabled = enabled;
      button.background.setFillStyle(enabled ? 0x3b3127 : 0x2a2725, enabled ? 0.95 : 0.65);
      if (!enabled && action === "fire") {
        button.background.setFillStyle(0x2d2d2d, 0.55);
      }
    }
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: "app",
  backgroundColor: "#121212",
  scene: [RevolverScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

const game = new Phaser.Game(config);

const getScene = (): RevolverScene | null => {
  const scene = game.scene.getScene("RevolverScene");
  return scene instanceof RevolverScene ? scene : null;
};

declare global {
  interface Window {
    render_game_to_text: () => string;
    advanceTime: (ms: number) => void;
  }
}

window.render_game_to_text = () => {
  const scene = getScene();
  return scene ? scene.renderGameToText() : JSON.stringify({ mode: "booting" });
};

window.advanceTime = (ms: number) => {
  const scene = getScene();
  if (scene) {
    scene.advanceTime(ms);
  }
};

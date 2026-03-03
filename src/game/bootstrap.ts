import Phaser from "phaser";
import { CombatScene, GAME_BOUNDS } from "./CombatScene";

export const createGame = (): Phaser.Game => {
  const isAndroid = /Android/i.test(navigator.userAgent);
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.CANVAS,
    width: GAME_BOUNDS.width,
    height: GAME_BOUNDS.height,
    parent: "app",
    backgroundColor: "#11141a",
    scene: [CombatScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      expandParent: true,
      autoRound: true,
      min: {
        width: 960,
        height: 640,
      },
      max: isAndroid
        ? {
            width: GAME_BOUNDS.width,
            height: GAME_BOUNDS.height,
          }
        : undefined,
    },
  };

  return new Phaser.Game(config);
};

export const getCombatScene = (game: Phaser.Game): CombatScene | null => {
  const scene = game.scene.getScene(CombatScene.SCENE_KEY);
  return scene instanceof CombatScene ? scene : null;
};

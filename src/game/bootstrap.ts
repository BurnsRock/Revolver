import Phaser from "phaser";
import { CombatScene, GAME_BOUNDS } from "./CombatScene";

export const createGame = (): Phaser.Game => {
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
    },
  };

  return new Phaser.Game(config);
};

export const getCombatScene = (game: Phaser.Game): CombatScene | null => {
  const scene = game.scene.getScene(CombatScene.SCENE_KEY);
  return scene instanceof CombatScene ? scene : null;
};

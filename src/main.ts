import "./style.css";
import { createGame, getCombatScene } from "./game/bootstrap";

const game = createGame();

declare global {
  interface Window {
    render_game_to_text: () => string;
    advanceTime: (ms: number) => void;
  }
}

window.render_game_to_text = () => {
  const scene = getCombatScene(game);
  return scene ? scene.renderGameToText() : JSON.stringify({ mode: "booting" });
};

window.advanceTime = (ms: number) => {
  const scene = getCombatScene(game);
  if (scene) {
    scene.advanceTime(ms);
  }
};

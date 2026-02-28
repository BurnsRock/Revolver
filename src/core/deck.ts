import type { BulletType, DeckState } from "./types";
import { normalizeSeed, shuffleWithSeed } from "./rng";

export const createDeckState = (
  bullets: readonly BulletType[],
  seed: number,
): { deck: DeckState; seed: number } => {
  const shuffled = shuffleWithSeed(seed, bullets);
  return {
    seed: shuffled.seed,
    deck: {
      draw: shuffled.values,
      discard: [],
    },
  };
};

export const discardBullets = (
  deck: DeckState,
  bullets: readonly (BulletType | null)[],
): DeckState => ({
  draw: [...deck.draw],
  discard: [...deck.discard, ...bullets.filter((bullet): bullet is BulletType => bullet !== null)],
});

export const drawBullets = (
  deck: DeckState,
  count: number,
  seed: number,
): { deck: DeckState; bullets: BulletType[]; seed: number; reshuffled: boolean } => {
  const nextDeck: DeckState = {
    draw: [...deck.draw],
    discard: [...deck.discard],
  };
  const bullets: BulletType[] = [];
  let nextSeed = normalizeSeed(seed);
  let reshuffled = false;

  while (bullets.length < count) {
    if (nextDeck.draw.length === 0) {
      if (nextDeck.discard.length === 0) {
        break;
      }

      const shuffled = shuffleWithSeed(nextSeed, nextDeck.discard);
      nextSeed = shuffled.seed;
      nextDeck.draw = shuffled.values;
      nextDeck.discard = [];
      reshuffled = true;
    }

    const bullet = nextDeck.draw.pop();
    if (!bullet) {
      break;
    }
    bullets.push(bullet);
  }

  return { deck: nextDeck, bullets, seed: nextSeed, reshuffled };
};

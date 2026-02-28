export const normalizeSeed = (seed: number): number => {
  const normalized = Math.floor(seed) >>> 0;
  return normalized === 0 ? 0x6d2b79f5 : normalized;
};

export const nextRandom = (seed: number): { seed: number; value: number } => {
  const nextSeed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return {
    seed: nextSeed,
    value: nextSeed / 0x100000000,
  };
};

export const nextInt = (
  seed: number,
  maxExclusive: number,
): { seed: number; value: number } => {
  if (maxExclusive <= 0) {
    return { seed, value: 0 };
  }

  const next = nextRandom(seed);
  return {
    seed: next.seed,
    value: Math.floor(next.value * maxExclusive),
  };
};

export const shuffleWithSeed = <T>(
  seed: number,
  values: readonly T[],
): { seed: number; values: T[] } => {
  const shuffled = [...values];
  let nextSeed = normalizeSeed(seed);

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const random = nextInt(nextSeed, i + 1);
    nextSeed = random.seed;
    const j = random.value;
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return { seed: nextSeed, values: shuffled };
};

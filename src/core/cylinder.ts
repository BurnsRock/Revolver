import { shuffleWithSeed } from "./rng";
import { CYLINDER_CAPACITY, type BulletType, type CylinderState } from "./types";

export const createEmptyCylinder = (capacity: number = CYLINDER_CAPACITY): CylinderState => ({
  chambers: Array.from({ length: capacity }, () => null),
  currentIndex: 0,
  capacity,
});

export const getCylinderOrder = (cylinder: CylinderState): number[] =>
  Array.from({ length: cylinder.capacity }, (_, offset) => {
    return (cylinder.currentIndex + offset) % cylinder.capacity;
  });

export const collectCylinderRounds = (cylinder: CylinderState): Array<BulletType | null> => [
  ...cylinder.chambers,
];

export const loadCylinder = (
  cylinder: CylinderState,
  rounds: readonly BulletType[],
): CylinderState => {
  const chambers = Array.from({ length: cylinder.capacity }, (_, index) => rounds[index] ?? null);
  return {
    chambers,
    currentIndex: 0,
    capacity: cylinder.capacity,
  };
};

export const fireCurrentRound = (
  cylinder: CylinderState,
): { cylinder: CylinderState; bullet: BulletType | null } => {
  const chambers = [...cylinder.chambers];
  const bullet = chambers[cylinder.currentIndex] ?? null;
  chambers[cylinder.currentIndex] = null;
  return {
    bullet,
    cylinder: {
      chambers,
      currentIndex: cylinder.currentIndex,
      capacity: cylinder.capacity,
    },
  };
};

export const rotateCylinder = (cylinder: CylinderState): CylinderState => ({
  chambers: [...cylinder.chambers],
  currentIndex: (cylinder.currentIndex + 1) % cylinder.capacity,
  capacity: cylinder.capacity,
});

export const spinCylinder = (
  cylinder: CylinderState,
  seed: number,
): { cylinder: CylinderState; seed: number } => {
  const orderedIndices = getCylinderOrder(cylinder);
  const orderedRounds = orderedIndices.map((index) => cylinder.chambers[index]);
  const shuffled = shuffleWithSeed(seed, orderedRounds);
  const chambers = [...cylinder.chambers];

  orderedIndices.forEach((index, offset) => {
    chambers[index] = shuffled.values[offset] ?? null;
  });

  return {
    seed: shuffled.seed,
    cylinder: {
      chambers,
      currentIndex: cylinder.currentIndex,
      capacity: cylinder.capacity,
    },
  };
};

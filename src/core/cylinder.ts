import { shuffleWithSeed } from "./rng";
import { CYLINDER_CAPACITY, type BulletType, type CylinderState } from "./types";

export const CYLINDER_ROTATION_DIRECTION = "clockwise" as const;
export const SPIN_ROTATION_MIN = 19;
export const SPIN_ROTATION_MAX = 24;

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

export const findNextLoadedChamberIndex = (
  cylinder: CylinderState,
  startIndex: number = cylinder.currentIndex,
): number => {
  for (let step = 1; step <= cylinder.capacity; step += 1) {
    const index = (startIndex + step) % cylinder.capacity;
    if (cylinder.chambers[index] !== null) {
      return index;
    }
  }

  return startIndex;
};

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
  const nextIndex = findNextLoadedChamberIndex(
    {
      chambers,
      currentIndex: cylinder.currentIndex,
      capacity: cylinder.capacity,
    },
    cylinder.currentIndex,
  );
  return {
    bullet,
    cylinder: {
      chambers,
      currentIndex: nextIndex,
      capacity: cylinder.capacity,
    },
  };
};

export const rotateCylinder = (cylinder: CylinderState): CylinderState => ({
  chambers: [...cylinder.chambers],
  currentIndex: findNextLoadedChamberIndex(cylinder),
  capacity: cylinder.capacity,
});

export const rotateCylinderBySteps = (
  cylinder: CylinderState,
  steps: number,
): CylinderState => {
  let nextCylinder = {
    chambers: [...cylinder.chambers],
    currentIndex: cylinder.currentIndex,
    capacity: cylinder.capacity,
  };

  for (let i = 0; i < steps; i += 1) {
    nextCylinder = rotateCylinder(nextCylinder);
  }

  return nextCylinder;
};

export const spinCylinder = (
  cylinder: CylinderState,
  seed: number,
): { cylinder: CylinderState; seed: number; rotations: number } => {
  const loadedCount = cylinder.chambers.filter((round) => round !== null).length;
  const shuffled = shuffleWithSeed(
    seed,
    Array.from(
      { length: SPIN_ROTATION_MAX - SPIN_ROTATION_MIN + 1 },
      (_, offset) => SPIN_ROTATION_MIN + offset,
    ),
  );
  const rotations = shuffled.values[0] ?? SPIN_ROTATION_MIN;
  const nextCylinder =
    loadedCount > 0
      ? rotateCylinderBySteps(cylinder, rotations)
      : { ...cylinder, chambers: [...cylinder.chambers] };

  return {
    seed: shuffled.seed,
    rotations,
    cylinder: nextCylinder,
  };
};

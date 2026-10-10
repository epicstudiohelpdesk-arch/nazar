export const motion = {
  duration: {
    instant: 0,
    micro: 100,
    fast: 150,
    standard: 250,
    normal: 250, // backwards-compatibility alias
    emphasis: 350,
    slow: 400,
  },
  spring: {
    damping: 20,
    mass: 1,
    stiffness: 180,
    gentle: {
      damping: 25,
      mass: 1,
      stiffness: 140,
    },
    bouncy: {
      damping: 15,
      mass: 1,
      stiffness: 200,
    },
    stiff: {
      damping: 28,
      mass: 0.8,
      stiffness: 240,
    },
  },
  easing: {
    standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    decelerate: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0.0, 1, 1)',
    emphasized: 'cubic-bezier(0.2, 0.0, 0.0, 1)',
  },
} as const;

export type MotionTokens = typeof motion;

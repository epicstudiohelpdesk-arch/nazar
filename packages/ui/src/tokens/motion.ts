export const motion = {
  duration: {
    instant: 0,
    fast: 150,
    normal: 250,
    slow: 400,
  },
  spring: {
    damping: 20,
    mass: 1,
    stiffness: 180,
  },
  easing: {
    standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    decelerate: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0.0, 1, 1)',
  },
} as const;

export type MotionTokens = typeof motion;

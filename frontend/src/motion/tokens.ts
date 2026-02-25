import { Easing, Transition } from 'framer-motion';

type Bezier = [number, number, number, number];

export const motionEasings = {
  cinematic: [0.22, 1, 0.36, 1] as Bezier,
  smooth: [0.25, 1, 0.4, 1] as Bezier,
  gentle: [0.32, 0.94, 0.6, 1] as Bezier,
  linear: 'linear',
} as const;

export const motionDurations = {
  quick: 0.7,
  base: 0.9,
  slow: 1.05,
  extended: 1.2,
} as const;

const tween = (duration: number, ease: Easing | Easing[]): Transition => ({
  type: 'tween',
  duration,
  ease,
});

export const motionTransitions = {
  pageEnter: tween(motionDurations.extended, motionEasings.cinematic),
  pageExit: tween(motionDurations.slow, motionEasings.smooth),
  fade: tween(motionDurations.base, motionEasings.smooth),
  drift: tween(motionDurations.extended, motionEasings.cinematic),
  reduced: tween(motionDurations.quick, motionEasings.linear),
} as const;

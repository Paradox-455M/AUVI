import { useMemo } from 'react';
import { useReducedMotion, Variants, Transition } from 'framer-motion';

const editorialEase = [0.22, 1, 0.36, 1] as const;

const buildTransition = (duration: number, delay = 0): Transition => ({
  duration,
  delay,
  ease: editorialEase,
});

const buildRevealVariants = (distance: number): Variants => ({
  initial: { opacity: 0, y: distance },
  enter: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: distance * 0.6 },
});

export const useMotion = () => {
  const prefersReducedMotion = useReducedMotion();

  return useMemo(() => {
    if (prefersReducedMotion) {
      return {
        ease: editorialEase,
        transitions: {
          crossfade: { duration: 0.6, ease: 'linear' as const },
          reveal: { duration: 0.6, ease: 'linear' as const },
          hoverIn: { duration: 0.6, ease: 'linear' as const },
          hoverOut: { duration: 0.6, ease: 'linear' as const },
        },
        variants: {
          crossfade: {
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            exit: { opacity: 0 },
          },
          sectionReveal: {
            initial: { opacity: 0, y: 0 },
            enter: { opacity: 1, y: 0 },
            exit: { opacity: 0, y: 0 },
          },
          hoverDrift: {
            rest: { y: 0, x: 0 },
            hover: { y: 0, x: 0 },
          },
        },
      };
    }

    return {
      ease: editorialEase,
      transitions: {
        crossfade: buildTransition(1.2),
        reveal: buildTransition(1.1, 0.08),
        hoverIn: buildTransition(0.9),
        hoverOut: buildTransition(1.2),
      },
      variants: {
        crossfade: {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
        },
        sectionReveal: buildRevealVariants(28),
        hoverDrift: {
          rest: { y: 0, x: 0 },
          hover: { y: -4, x: 3 },
        },
      },
    };
  }, [prefersReducedMotion]);
};

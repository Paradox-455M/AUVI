import { ReactNode } from 'react';
import { HTMLMotionProps, motion, useReducedMotion } from 'framer-motion';
import { motionTransitions } from '../motion/tokens';

interface PageTransitionProps
  extends Omit<HTMLMotionProps<'div'>, 'initial' | 'animate' | 'exit' | 'transition'> {
  children: ReactNode;
  driftY?: number;
}

export const PageTransition = ({
  children,
  className,
  driftY = 24,
  ...rest
}: PageTransitionProps) => {
  const prefersReducedMotion = useReducedMotion();

  const initialY = prefersReducedMotion ? 0 : driftY;
  const exitY = prefersReducedMotion ? 0 : -driftY * 0.35;
  const transition = prefersReducedMotion ? motionTransitions.reduced : motionTransitions.pageEnter;
  const exitTransition = prefersReducedMotion ? motionTransitions.reduced : motionTransitions.pageExit;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: initialY }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: exitY, transition: exitTransition }}
      transition={transition}
      style={{ willChange: 'opacity, transform' }}
      {...rest}
    >
      {children}
    </motion.div>
  );
};

import { ReactNode } from 'react';
import { LayoutGroup, motion } from 'framer-motion';
import { useMotion } from '../hooks/useMotion';

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

interface SectionRevealProps {
  children: ReactNode;
  className?: string;
  amount?: number;
}

interface HoverDriftProps {
  children: ReactNode;
  className?: string;
}

export const PageTransition = ({ children, className }: PageTransitionProps) => {
  const { variants, transitions } = useMotion();

  return (
    <motion.div
      className={className}
      variants={variants.crossfade}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={transitions.crossfade}
    >
      {children}
    </motion.div>
  );
};

export const SectionReveal = ({ children, className, amount = 0.35 }: SectionRevealProps) => {
  const { variants, transitions } = useMotion();

  return (
    <motion.section
      className={className}
      variants={variants.sectionReveal}
      initial="initial"
      whileInView="enter"
      viewport={{ once: true, amount }}
      transition={transitions.reveal}
    >
      {children}
    </motion.section>
  );
};

export const HoverDrift = ({ children, className }: HoverDriftProps) => {
  const { variants, transitions } = useMotion();

  return (
    <motion.div
      className={className}
      variants={variants.hoverDrift}
      initial="rest"
      animate="rest"
      whileHover="hover"
      transition={transitions.hoverIn}
    >
      {children}
    </motion.div>
  );
};

export { LayoutGroup };

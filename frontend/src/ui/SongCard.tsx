import { motion } from 'framer-motion';

const formatDuration = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

const editorialEase = [0.22, 1, 0.36, 1] as const;
const hoverTransition = { duration: 0.6, ease: editorialEase };

interface Props {
  id: string;
  title: string;
  artist: string;
  duration: number;
  onClick: (id: string) => void;
  isSelectedForTransition?: boolean;
  isCurrentInHero?: boolean;
  index: number;
}

export const SongCard = ({ id, title, artist, duration, onClick, isSelectedForTransition, isCurrentInHero, index }: Props) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    exit={
      isSelectedForTransition
        ? { scale: 1.02, opacity: 0, transition: { duration: 0.4, ease: editorialEase } }
        : { opacity: 0, transition: { duration: 0.3 } }
    }
    transition={{ duration: 0.5, ease: editorialEase, delay: index * 0.08 }}
    onClick={() => onClick(id)}
    className={`group relative flex items-center min-h-[100px] py-6 border-b border-[var(--color-border)] cursor-play ${isCurrentInHero ? 'opacity-100' : ''}`}
    whileHover={{
      x: 10,
      scale: 1.015,
      transition: hoverTransition,
    }}
  >
    <div
      className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
      style={{
        background: 'radial-gradient(ellipse 80% 50% at 20% 50%, rgba(255,255,255,0.04) 0%, transparent 70%)',
        transitionTimingFunction: 'var(--ease-editorial)',
      }}
      aria-hidden
    />
    <div className="relative z-10 flex items-center w-full gap-12">
      <div className="flex-1 min-w-0">
        <h3
          className="truncate text-[var(--color-text-primary)]"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px, 2.5vw, 36px)',
            fontWeight: 500,
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          }}
        >
          {title}
        </h3>
        <p
          className="mt-1 truncate text-[var(--color-text-secondary)]"
          style={{ fontSize: 16, opacity: 0.85 }}
        >
          {artist}
        </p>
      </div>
      <span
        className="flex-shrink-0 tabular-nums text-[var(--color-text-secondary)]"
        style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14 }}
      >
        {formatDuration(duration)}
      </span>
    </div>
  </motion.div>
);

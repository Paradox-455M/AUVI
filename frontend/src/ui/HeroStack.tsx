import { useRef } from 'react';
import { motion } from 'framer-motion';
import type { Track } from '../music/types';

// Static fallback artworks (used when a track has no embedded album art)
import fallback01 from '../assets/artwork/101941absdl.jpg';
import fallback02 from '../assets/artwork/102326absdl.jpg';
import fallback03 from '../assets/artwork/104328absdl.jpg';
import fallback04 from '../assets/artwork/104920absdl.jpg';
import fallback05 from '../assets/artwork/106137absdl.jpg';
import fallback06 from '../assets/artwork/107542absdl.jpg';
import fallback07 from '../assets/artwork/911653absdl.jpg';
import fallback08 from '../assets/artwork/911854absdl.jpg';
import fallback09 from '../assets/artwork/adam-kring-EFRD6Cr7skc-unsplash.jpg';
import fallback10 from '../assets/artwork/josep-martins-nAsdr5DC2Ss-unsplash.jpg';
import fallback11 from '../assets/artwork/luca-nicoletti-O8CHmj0zgAg-unsplash.jpg';
import fallback12 from '../assets/artwork/marvin-van-beek-mMyvF0R7e38-unsplash.jpg';
import fallback13 from '../assets/artwork/mayur-deshpande-zZPeoLxLRyM-unsplash.jpg';
import fallback14 from '../assets/artwork/pawel-czerwinski-NTYYL9Eb9y8-unsplash.jpg';
import fallback15 from '../assets/artwork/steve-johnson-RzykwoNjoLw-unsplash.jpg';

const FALLBACK_ARTWORKS = [
  fallback01, fallback02, fallback03, fallback04, fallback05,
  fallback06, fallback07, fallback08, fallback09, fallback10,
  fallback11, fallback12, fallback13, fallback14, fallback15,
];

/** Deterministic pick — same title always maps to the same artwork */
function getFallbackArtwork(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash * 31 + title.charCodeAt(i)) | 0;
  }
  return FALLBACK_ARTWORKS[Math.abs(hash) % FALLBACK_ARTWORKS.length];
}

const CARD_WIDTH = 220;
const CARD_ASPECT = 3 / 4;
const CARD_HEIGHT = CARD_WIDTH * CARD_ASPECT;
const WINDOW_SIZE = 7;
const MAX_ARC_Y = Math.floor(WINDOW_SIZE / 2) * 28;
const MIN_HEIGHT = CARD_HEIGHT + MAX_ARC_Y * 2 + 80;

const editorialEase = [0.22, 1, 0.36, 1] as const;

function CardContent({ track }: { track: Track }) {
  const src = track.artworkUrl ?? getFallbackArtwork(track.title);
  return (
    <img
      src={src}
      alt=""
      className="w-full h-full object-cover"
      draggable={false}
    />
  );
}

interface HeroStackProps {
  tracks: Track[];
  currentIndex: number;
  onSelect: (index: number) => void;
  onEnterPlayer?: (url: string) => void;
}

export const HeroStack = ({ tracks: items, currentIndex, onSelect, onEnterPlayer }: HeroStackProps) => {
  const count = items.length;
  if (count === 0) return null;

  const windowStart = Math.max(
    0,
    Math.min(currentIndex - Math.floor(WINDOW_SIZE / 2), count - WINDOW_SIZE),
  );
  const visibleItems = items.slice(windowStart, windowStart + WINDOW_SIZE);
  const visibleFrontIndex = currentIndex - windowStart;

  const lastWheelTime = useRef(0);
  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const now = Date.now();
    if (now - lastWheelTime.current < 200) return;
    lastWheelTime.current = now;
    const next = e.deltaY > 0
      ? Math.min(currentIndex + 1, count - 1)
      : Math.max(currentIndex - 1, 0);
    onSelect(next);
  };

  return (
    <div
      className="relative flex justify-center items-center w-full max-w-[900px] mx-auto overflow-hidden"
      style={{ minHeight: MIN_HEIGHT }}
      onWheel={handleWheel}
    >
      {visibleItems.map((track, i) => {
        const actualIndex = windowStart + i;
        const isFront = i === visibleFrontIndex;
        const offset = i - visibleFrontIndex;
        const absOffset = Math.abs(offset);
        const scale = isFront ? 1 : 0.9 - absOffset * 0.04;
        const rotate = offset * 6;
        const arcY = absOffset * 28;
        const x = -CARD_WIDTH / 2 + offset * 56;
        const zIndex = WINDOW_SIZE - absOffset;

        const handleClick = () => {
          if (isFront && onEnterPlayer) {
            onEnterPlayer(track.url);
          } else {
            onSelect(actualIndex);
          }
        };

        return (
          <motion.div
            key={track.id}
            className="absolute cursor-pointer origin-bottom overflow-hidden group"
            style={{
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
              zIndex,
              left: '50%',
              top: '50%',
              borderRadius: 8,
              boxShadow: isFront
                ? '0 24px 48px rgba(0,0,0,0.3), 0 8px 16px rgba(0,0,0,0.2)'
                : '0 8px 24px rgba(0,0,0,0.18)',
            }}
            initial={false}
            animate={{
              x,
              y: -CARD_HEIGHT / 2 + arcY,
              scale,
              rotate,
            }}
            whileHover={{
              scale: isFront ? 1.02 : scale + 0.04,
              transition: { duration: 0.4, ease: editorialEase },
            }}
            transition={{ duration: 0.6, ease: editorialEase }}
            onClick={handleClick}
          >
            <CardContent track={track} />

            {/* Tooltip — fades in on hover */}
            <div className="absolute inset-x-0 bottom-0 px-3 py-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
              <p
                className="text-white text-xs tracking-wide truncate"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {track.title}
              </p>
              {track.artist && (
                <p className="text-white/50 text-xs truncate mt-0.5">{track.artist}</p>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

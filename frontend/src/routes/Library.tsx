import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Gallery } from '../components/Gallery';
import { useMusicLibrary } from '../music/useMusicLibrary';
import { getOrderedTagNames, groupTracksByTag } from '../music/tagUtils';
import { HeroStack } from '../ui/HeroStack';

interface LibraryProps {
  onEnterPlayer: (id: string) => void;
  selectedSongId?: string | null;
  activeTag?: string | null;
  onTagsChange?: (tags: string[]) => void;
}

const ease = [0.22, 1, 0.36, 1] as const;

export const Library = ({ onEnterPlayer, activeTag, onTagsChange }: LibraryProps) => {
  const { tracks } = useMusicLibrary();
  const orderedTagNames = useMemo(() => getOrderedTagNames(tracks), [tracks]);
  const groupedTracks = useMemo(() => groupTracksByTag(tracks), [tracks]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const heroTracks = useMemo(() => {
    if (!activeTag) return tracks;
    return groupedTracks[activeTag] ?? tracks;
  }, [tracks, activeTag, groupedTracks]);

  useEffect(() => {
    onTagsChange?.(orderedTagNames);
  }, [orderedTagNames, onTagsChange]);

  useEffect(() => {
    setCurrentIndex(0);
  }, [tracks, activeTag]);

  return (
    <div className="relative flex-1 overflow-hidden" aria-label="Editorial library">
      <div className="grain-overlay" aria-hidden />

      <motion.main
        className="library-scene"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1, ease }}
      >
        {tracks.length > 0 && (
          <div className="hero-arc-section" onWheel={(e) => e.stopPropagation()}>
            <HeroStack
              tracks={heroTracks}
              currentIndex={currentIndex}
              onSelect={setCurrentIndex}
              onEnterPlayer={onEnterPlayer}
            />
          </div>
        )}
        <div className="library-frame">
          <Gallery onTrackSelect={onEnterPlayer} activeTag={activeTag} />
        </div>
      </motion.main>
    </div>
  );
};

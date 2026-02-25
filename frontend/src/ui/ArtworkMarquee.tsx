import { useEffect, useRef, useState } from 'react';
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

const CARD_SIZE = 200;
const CARD_GAP = 24;
const SPEED_PX_PER_S = 80;

interface ArtworkMarqueeProps {
  tracks: Track[];
  onTrackSelect: (url: string) => void;
}

export const ArtworkMarquee = ({ tracks, onTrackSelect }: ArtworkMarqueeProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [animDuration, setAnimDuration] = useState(20);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const update = () => {
      const containerWidth = container.offsetWidth;
      const singlePassWidth = tracks.length * (CARD_SIZE + CARD_GAP);
      const animate = singlePassWidth > containerWidth;
      setShouldAnimate(animate);
      setAnimDuration(singlePassWidth / SPEED_PX_PER_S);
    };

    update();

    const ro = new ResizeObserver(update);
    ro.observe(container);
    return () => ro.disconnect();
  }, [tracks]);

  if (tracks.length === 0) return null;

  const displayTracks = shouldAnimate ? [...tracks, ...tracks] : tracks;

  return (
    <div
      ref={containerRef}
      className="artwork-marquee-container"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className={shouldAnimate ? 'artwork-marquee-track' : 'artwork-marquee-static'}
        style={shouldAnimate ? {
          animationDuration: `${animDuration}s`,
          animationPlayState: paused ? 'paused' : 'running',
        } : undefined}
      >
        {displayTracks.map((track, i) => {
          const src = track.artworkUrl ?? getFallbackArtwork(track.title);
          return (
            <button
              key={`${track.id}-${i}`}
              className="artwork-marquee-card group"
              onClick={() => onTrackSelect(track.url)}
              type="button"
            >
              <img
                src={src}
                alt=""
                className="artwork-marquee-img"
                draggable={false}
              />
              <div className="artwork-marquee-overlay">
                <p className="artwork-marquee-title">{track.title}</p>
                {track.artist && (
                  <p className="artwork-marquee-artist">{track.artist}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

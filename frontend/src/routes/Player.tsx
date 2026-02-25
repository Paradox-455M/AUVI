import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getTrackTitle } from '../data/tracks';
import { VisualizerCanvas } from '../visualizer/VisualizerCanvas';
import { useAudioPlayer } from '../audio/useAudioPlayer';
import { getAccessToken } from '../api/client';
import type { Track } from '../music/types';

interface Props {
  songId: string | null;
  tracks: Track[];
  trackIndex: number;
  onTrackChange: (index: number) => void;
  onBack: () => void;
}

const IDLE_TIMEOUT_MS = 3200;

const formatTimer = (seconds: number): string => {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const looksLikeAudioPath = (value: string): boolean => /\.(mp3|wav|ogg|m4a|aac|flac)(\?.*)?$/i.test(value);

const resolveSongSource = (songId: string | null): string | null => {
  if (!songId) return null;

  const raw = songId.trim();
  if (!raw) return null;

  // Backend stream URL: inject current access token at load time
  if (raw.startsWith('/api/v1/tracks/') && raw.endsWith('/stream')) {
    const token = getAccessToken();
    return token ? `${raw}?t=${encodeURIComponent(token)}` : null;
  }

  if (raw.startsWith('blob:') || raw.startsWith('data:')) return raw;

  try {
    const absolute = new URL(raw);
    if (absolute.protocol === 'http:' || absolute.protocol === 'https:') {
      return absolute.toString();
    }
  } catch {
    // Intentionally ignore parse errors and continue with relative-path checks.
  }

  if (looksLikeAudioPath(raw)) return raw;
  if (raw.startsWith('/') || raw.startsWith('./') || raw.startsWith('../')) return raw;

  return null;
};

const deriveWorkTitle = (songId: string | null, sourceUrl: string | null): string => {
  const catalogTitle = getTrackTitle(songId);
  if (catalogTitle !== 'Work Title') return catalogTitle;

  if (!sourceUrl || sourceUrl.startsWith('blob:')) return 'Uploaded Work';

  try {
    const parsed = new URL(sourceUrl, window.location.origin);
    const filename = parsed.pathname.split('/').filter(Boolean).pop() ?? '';
    const decoded = decodeURIComponent(filename).replace(/\.[a-z0-9]+$/i, '');
    return decoded || 'Uploaded Work';
  } catch {
    return 'Uploaded Work';
  }
};

const useIdleTimer = (timeout: number, onIdle: () => void) => {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(onIdle, timeout);
  }, [onIdle, timeout]);

  useEffect(() => {
    reset();
    window.addEventListener('mousemove', reset);
    window.addEventListener('pointerdown', reset);
    window.addEventListener('keydown', reset);

    return () => {
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener('mousemove', reset);
      window.removeEventListener('pointerdown', reset);
      window.removeEventListener('keydown', reset);
    };
  }, [reset]);
};

export const Player: React.FC<Props> = ({ songId, tracks, trackIndex, onTrackChange, onBack }) => {
  const [idle, setIdle] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const autoPlayRef = useRef(false);
  const { load, play, pause, toggle, seek, setVolume, setMuted, state, analyserNode, audioElement } = useAudioPlayer();

  const sourceUrl = useMemo(() => resolveSongSource(songId), [songId]);
  const currentTrack = tracks[trackIndex] ?? null;
  const workTitle = useMemo(
    () => currentTrack?.title ?? deriveWorkTitle(songId, sourceUrl),
    [currentTrack, songId, sourceUrl],
  );

  const upNextTracks = useMemo(() => {
    if (tracks.length <= 1) return [];
    return Array.from({ length: tracks.length - 1 }, (_, i) => {
      const idx = (trackIndex + 1 + i) % tracks.length;
      return { track: tracks[idx], index: idx };
    });
  }, [tracks, trackIndex]);

  useIdleTimer(IDLE_TIMEOUT_MS, () => {
    if (state.isPlaying) setIdle(true);
  });

  useEffect(() => {
    setIdle(false);
  }, [songId]);

  const handleNext = useCallback(() => {
    if (tracks.length === 0) return;
    autoPlayRef.current = true;
    const next = isShuffle
      ? Math.floor(Math.random() * tracks.length)
      : (trackIndex + 1) % tracks.length;
    onTrackChange(next);
  }, [trackIndex, tracks, isShuffle, onTrackChange]);

  const handlePrev = useCallback(() => {
    if (tracks.length === 0) return;
    autoPlayRef.current = true;
    onTrackChange((trackIndex - 1 + tracks.length) % tracks.length);
  }, [trackIndex, tracks, onTrackChange]);

  useEffect(() => {
    const el = audioElement;
    if (!el) return;
    el.addEventListener('ended', handleNext);
    return () => el.removeEventListener('ended', handleNext);
  }, [audioElement, handleNext]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen();
      return;
    }
    void document.exitFullscreen();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); toggle(); }
      if (e.code === 'KeyM') setMuted(!state.isMuted);
      if (e.code === 'KeyF') toggleFullscreen();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggle, setMuted, state.isMuted, toggleFullscreen]);

  useEffect(() => {
    const loadTrack = async () => {
      if (!sourceUrl) {
        pause();
        return;
      }
      await load(sourceUrl);
      if (autoPlayRef.current) {
        autoPlayRef.current = false;
        void play();
      }
    };

    void loadTrack();
  }, [load, play, pause, sourceUrl]);

  const progress = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

  const unresolvedSource = Boolean(songId && !sourceUrl);

  return (
    <motion.div
      className="relative flex-1 min-h-0 w-full overflow-hidden bg-black"
      initial={{ opacity: 0, scale: 1.01 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.01 }}
      transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      onMouseMove={() => setIdle(false)}
      onPointerDown={() => setIdle(false)}
    >
      <VisualizerCanvas analyserNode={analyserNode} />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/70" />

      {/* Queue panel */}
      <AnimatePresence>
        {isQueueOpen && (
          <motion.div
            className="absolute top-0 right-0 bottom-0 w-72 z-30 bg-black/85 backdrop-blur-sm flex flex-col"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="px-5 pt-6 pb-3 flex items-center justify-between flex-shrink-0">
              <span className="nav-label text-[var(--color-text-primary)]">Queue</span>
              <button
                type="button"
                onClick={() => setIsQueueOpen(false)}
                className="pointer-events-auto nav-label text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                Close
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 pb-8">
              <p className="nav-label text-[var(--color-text-secondary)] mb-2 mt-1">Now Playing</p>
              <div className="py-2 border-l-2 border-white pl-3 mb-4">
                <p className="nav-label text-[var(--color-text-primary)] truncate">
                  {currentTrack?.title ?? 'Unknown'}
                </p>
                {currentTrack?.artist && (
                  <p className="nav-label text-[var(--color-text-secondary)] truncate mt-0.5">
                    {currentTrack.artist}
                  </p>
                )}
              </div>

              {upNextTracks.length > 0 && (
                <>
                  <p className="nav-label text-[var(--color-text-secondary)] mb-2">Up Next</p>
                  {upNextTracks.map(({ track, index }) => (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => {
                        autoPlayRef.current = true;
                        onTrackChange(index);
                        setIsQueueOpen(false);
                      }}
                      className="w-full text-left py-2.5 group"
                    >
                      <p className="nav-label text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors truncate">
                        {track.title}
                      </p>
                      {track.artist && (
                        <p className="nav-label text-[var(--color-text-secondary)] opacity-60 truncate mt-0.5">
                          {track.artist}
                        </p>
                      )}
                    </button>
                  ))}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top bar */}
      <AnimatePresence>
        {!idle && (
          <motion.div
            className="absolute top-6 left-6 right-6 z-20 flex items-start justify-between"
            initial={{ opacity: 0, y: -18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          >
            <button
              type="button"
              onClick={onBack}
              className="pointer-events-auto nav-label text-[var(--color-text-primary)] tracking-[0.18em] hover:opacity-70 transition-opacity"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setIsQueueOpen(o => !o)}
              className="pointer-events-auto nav-label text-[var(--color-text-primary)] tracking-[0.18em] text-center hover:opacity-70 transition-opacity max-w-[40%] truncate"
            >
              {workTitle}
              <span className="ml-1 opacity-50">{isQueueOpen ? '↑' : '↓'}</span>
            </button>
            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={() => setIsShuffle(s => !s)}
                className={`pointer-events-auto nav-label tracking-[0.18em] transition-all ${
                  isShuffle
                    ? 'text-white opacity-100'
                    : 'text-[var(--color-text-secondary)] opacity-50'
                } hover:opacity-80`}
              >
                Shuffle
              </button>
              <button
                type="button"
                onClick={() => setIsQueueOpen(o => !o)}
                className={`pointer-events-auto nav-label tracking-[0.18em] transition-all ${
                  isQueueOpen
                    ? 'text-white opacity-100'
                    : 'text-[var(--color-text-secondary)] opacity-60'
                } hover:opacity-80`}
              >
                Queue
              </button>
              <button
                type="button"
                onClick={toggleFullscreen}
                className="pointer-events-auto nav-label text-[var(--color-text-primary)] tracking-[0.18em] hover:opacity-70 transition-opacity"
              >
                Fullscreen
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {unresolvedSource && (
        <motion.div
          className="absolute inset-0 z-20 flex items-center justify-center px-6 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <div>
            <p className="heading-2 text-[var(--color-text-primary)]">Audio source unavailable</p>
            <p className="mt-3 body-small text-[var(--color-text-secondary)]">
              The selected `songId` does not resolve to a playable audio URL.
            </p>
          </div>
        </motion.div>
      )}

      {!unresolvedSource && (
        <AnimatePresence>
          {!idle && (
            <motion.div
              className="absolute bottom-8 left-6 right-6 z-20"
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 28 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            >
              <div
                className="h-1 bg-white/20 cursor-pointer"
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const ratio = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
                  seek(Math.max(0, Math.min(1, ratio)) * state.duration);
                }}
              >
                <motion.div
                  className="h-full bg-white"
                  animate={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>

              <div className="mt-4 flex items-center justify-between gap-4 text-[var(--color-text-primary)]">
                <span className="timer-mono text-[var(--color-text-secondary)]">{formatTimer(state.currentTime)}</span>
                <div className="flex items-center gap-5">
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="nav-label tracking-[0.2em] text-[var(--color-text-primary)] hover:opacity-70 transition-opacity"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={toggle}
                    className="nav-label tracking-[0.2em] text-[var(--color-text-primary)] hover:opacity-70 transition-opacity"
                  >
                    {state.isPlaying ? 'Pause' : 'Play'}
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="nav-label tracking-[0.2em] text-[var(--color-text-primary)] hover:opacity-70 transition-opacity"
                  >
                    Next
                  </button>
                </div>
                <span className="timer-mono text-[var(--color-text-secondary)]">{formatTimer(state.duration)}</span>
              </div>

              <div className="mt-2 flex items-center justify-between gap-4">
                <span className="nav-label text-[var(--color-text-secondary)] truncate max-w-[40%]">
                  {workTitle}
                </span>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setMuted(!state.isMuted)}
                    className="nav-label tracking-[0.2em] text-[var(--color-text-primary)] hover:opacity-70 transition-opacity"
                  >
                    {state.isMuted ? 'Unmute' : 'Mute'}
                  </button>
                  <label className="nav-label tracking-[0.2em] text-[var(--color-text-secondary)] flex items-center gap-2">
                    Vol
                    <input
                      aria-label="Volume"
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={state.volume}
                      onChange={(e) => setVolume(Number(e.target.value))}
                      className="w-28 accent-white"
                    />
                  </label>
                </div>
              </div>

              {state.error && (
                <p className="mt-3 body-small text-red-300">
                  {state.error}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </motion.div>
  );
};

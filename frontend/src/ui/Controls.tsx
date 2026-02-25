import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { Preset } from '../visualizer/PresetManager';

const formatTimer = (s: number): string => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

interface Props {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isMuted?: boolean;
  onPlayPause: () => void;
  onSeek: (t: number) => void;
  onToggleMute?: () => void;
  presets: Preset[];
  activePresetId: string | null;
  onPresetChange: (id: string) => void;
}

export const Controls = ({
  isPlaying,
  currentTime,
  duration,
  isMuted = false,
  onPlayPause,
  onSeek,
  onToggleMute,
  presets,
  activePresetId,
  onPresetChange,
}: Props) => {
  const progress = duration ? (currentTime / duration) * 100 : 0;

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  return (
    <motion.div
      className="absolute bottom-0 left-0 right-0 p-6 md:p-8"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
    >
      <div className="max-w-3xl mx-auto bg-black/30 backdrop-blur-md rounded-lg p-5 border border-[var(--color-border)]">
        <div
          className="h-0.5 bg-white/10 rounded-full mb-4 cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            onSeek(((e.clientX - rect.left) / rect.width) * duration);
          }}
        >
          <div className="h-full bg-white rounded-full" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="timer-mono text-[var(--color-text-secondary)]">
            {formatTimer(currentTime)}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPlayPause}
              className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center hover:opacity-90 transition-opacity"
            >
              {isPlaying ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            {onToggleMute !== undefined && (
              <button
                type="button"
                onClick={onToggleMute}
                className="w-11 h-11 rounded-full border border-white/20 text-white flex items-center justify-center hover:bg-white/10 transition-colors"
                title={isMuted ? 'Sound on' : 'Sound off'}
              >
                {isMuted ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="w-11 h-11 rounded-full border border-white/20 text-white flex items-center justify-center hover:bg-white/10 transition-colors"
              title="Fullscreen"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          </div>
          <span className="timer-mono text-[var(--color-text-secondary)]">
            {formatTimer(duration)}
          </span>
        </div>
        <div className="mt-3 flex justify-end">
          <select
            value={activePresetId ?? ''}
            onChange={(e) => onPresetChange(e.target.value)}
            className="bg-transparent border border-[var(--color-border)] text-[var(--color-text-secondary)] nav-label py-1 px-2 rounded"
          >
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </motion.div>
  );
};

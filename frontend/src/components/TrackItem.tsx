import { motion } from 'framer-motion'
import type { Track } from '../music/types'

const ease = [0.22, 1, 0.36, 1] as const

export interface TrackItemProps {
  track: Track
  onOpenPlayer: (track: Track) => void
  globalIndex: number
  showArtist?: boolean
  showDuration?: boolean
}

const formatDuration = (duration?: number): string | null => {
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0) {
    return null
  }
  const totalSeconds = Math.floor(duration)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

const formatIndex = (n: number): string => String(n + 1).padStart(3, '0')

export const TrackItem = ({
  track,
  onOpenPlayer,
  globalIndex,
  showArtist = true,
  showDuration = true,
}: TrackItemProps) => {
  const durationLabel = showDuration ? formatDuration(track.duration) : null

  return (
    <motion.button
      type="button"
      className="archive-row"
      onClick={() => onOpenPlayer(track)}
      whileHover={{ x: 4 }}
      transition={{ duration: 0.9, ease }}
      aria-label={`Open track ${track.title}`}
    >
      <span className="archive-index shrink-0" aria-hidden="true">
        {formatIndex(globalIndex)}
      </span>
      <span className="min-w-0 truncate" style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'clamp(18px, 1.6vw, 24px)',
        fontWeight: 400,
        letterSpacing: '0.01em',
        color: 'var(--color-text-primary)',
      }}>
        {track.title}
      </span>
      {showArtist && track.artist ? (
        <span className="shrink-0 truncate" style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '13px',
          letterSpacing: '0.04em',
          color: 'var(--color-text-secondary)',
        }}>
          {track.artist}
        </span>
      ) : <span aria-hidden="true" />}
      {durationLabel ? (
        <span className="shrink-0" style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          letterSpacing: '0.04em',
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--color-text-secondary)',
        }}>
          {durationLabel}
        </span>
      ) : <span aria-hidden="true" />}
    </motion.button>
  )
}

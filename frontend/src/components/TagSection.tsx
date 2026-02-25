import type { Track } from '../music/types'
import { ArtworkMarquee } from '../ui/ArtworkMarquee'

type TagSectionProps = {
  tagName: string
  tracks: Track[]
  sectionIndex: number
  globalStartIndex: number
  onTrackSelect?: (track: Track) => void
}

const UNTAGGED_KEY = 'untagged'

function formatChapterTitle(tagName: string): string {
  if (tagName === UNTAGGED_KEY) return 'Untagged'
  return tagName.charAt(0).toUpperCase() + tagName.slice(1)
}

export function TagSection({ tagName, tracks, sectionIndex, onTrackSelect }: TagSectionProps) {
  return (
    <section
      aria-label={`${formatChapterTitle(tagName)} section`}
      style={{
        width: '100%',
        marginLeft: 0,
        marginTop: sectionIndex === 0 ? '2rem' : '4rem',
      }}
    >
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(42px, 4.5vw, 64px)',
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          color: 'var(--color-text-primary)',
          opacity: 0.96,
          margin: 0,
          marginBottom: '1.5rem',
          textWrap: 'balance',
        }}
      >
        {formatChapterTitle(tagName)}
      </h2>

      <ArtworkMarquee
        tracks={tracks}
        onTrackSelect={(url) => {
          const track = tracks.find(t => t.url === url)
          if (track) onTrackSelect?.(track)
        }}
      />
    </section>
  )
}

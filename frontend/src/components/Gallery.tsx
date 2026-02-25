import { useMemo } from 'react'
import { useMusicLibrary } from '../music/useMusicLibrary'
import { getOrderedTagNames, groupTracksByTag } from '../music/tagUtils'
import type { Track } from '../music/types'
import { TagSection } from './TagSection'
import { UploadTrigger } from './UploadTrigger'

type GalleryProps = {
  onTrackSelect?: (trackId: string) => void
  activeTag?: string | null
}

export function Gallery({ onTrackSelect, activeTag }: GalleryProps) {
  const { tracks, addFiles } = useMusicLibrary()

  const orderedTagNames = useMemo(() => getOrderedTagNames(tracks), [tracks])
  const groupedTracks = useMemo(() => groupTracksByTag(tracks), [tracks])

  const visibleTagNames = useMemo(
    () => {
      if (!activeTag) return orderedTagNames;
      return [activeTag, ...orderedTagNames.filter(t => t !== activeTag)];
    },
    [orderedTagNames, activeTag]
  )

  const globalStartIndexByTag = useMemo(() => {
    const result: Record<string, number> = {}
    let acc = 0
    for (const tag of orderedTagNames) {
      result[tag] = acc
      acc += (groupedTracks[tag]?.length ?? 0)
    }
    return result
  }, [orderedTagNames, groupedTracks])

  const handleUpload = async (files: FileList, tags: string[]) => {
    await addFiles(files, tags)
  }

  const handleTrackSelect = (track: Track) => {
    onTrackSelect?.(track.url)
  }

  return (
    <div
      aria-label="Editorial gallery"
      style={{
        width: '100%',
        minHeight: '88vh',
        paddingBottom: '10rem',
      }}
    >
      <section
        aria-label="Upload tracks"
        style={{
          marginTop: '3rem',
          marginBottom: '3rem',
        }}
      >
        <UploadTrigger onUpload={handleUpload} />
      </section>

      {orderedTagNames.length === 0 ? (
        <section
          aria-label="Empty gallery"
          style={{
            marginTop: '6rem',
            textAlign: 'left',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(42px, 4.5vw, 64px)',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              margin: 0,
              color: 'var(--color-text-primary)',
            }}
          >
            Start an archive
          </h2>
          <p className="body-small" style={{ marginTop: '1rem' }}>
            Upload files to generate tag sections automatically.
          </p>
        </section>
      ) : (
        visibleTagNames.map((tagName, index) => (
          <TagSection
            key={tagName}
            tagName={tagName}
            tracks={groupedTracks[tagName] ?? []}
            sectionIndex={index}
            globalStartIndex={globalStartIndexByTag[tagName] ?? 0}
            onTrackSelect={handleTrackSelect}
          />
        ))
      )}
    </div>
  )
}

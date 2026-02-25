import jsmediatags from 'jsmediatags'

export type ParsedTrackMetadata = {
  title: string
  artist?: string
  duration?: number
}

const FILENAME_SEPARATORS = [' - ', ' – ', ' — ', '-', '–', '—']

const AUDIO_EXTENSIONS_PATTERN = /\.[a-z0-9]+$/i

function normalizePart(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function parseMetadataFromFilename(filename: string): {
  title: string
  artist?: string
} {
  const withoutExtension = filename.replace(AUDIO_EXTENSIONS_PATTERN, '').trim()
  const safeFallbackTitle = withoutExtension || filename || 'Untitled'

  for (const separator of FILENAME_SEPARATORS) {
    const parts = withoutExtension.split(separator).map(normalizePart).filter(Boolean)
    if (parts.length >= 2) {
      const artist = parts[0]
      const title = parts.slice(1).join(' - ')
      if (title) {
        return { title, artist: artist || undefined }
      }
    }
  }

  return { title: safeFallbackTitle }
}

export function extractDurationFromFile(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const audio = new Audio()
    const objectUrl = URL.createObjectURL(file)

    const cleanup = () => {
      audio.removeAttribute('src')
      audio.load()
      URL.revokeObjectURL(objectUrl)
    }

    const finish = (value: number | undefined) => {
      cleanup()
      resolve(value)
    }

    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : undefined
      finish(duration)
    }
    audio.onerror = () => finish(undefined)

    audio.src = objectUrl
  })
}

export function extractArtworkFromFile(file: File): Promise<{ url: string | null; blob: Blob | null }> {
  return new Promise((resolve) => {
    jsmediatags.read(file, {
      onSuccess(result) {
        const pic = result.tags.picture
        if (!pic) { resolve({ url: null, blob: null }); return }
        const blob = new Blob([new Uint8Array(pic.data)], { type: pic.format })
        resolve({ url: URL.createObjectURL(blob), blob })
      },
      onError() { resolve({ url: null, blob: null }) },
    })
  })
}

export async function extractTrackMetadata(file: File): Promise<ParsedTrackMetadata> {
  const { title, artist } = parseMetadataFromFilename(file.name)
  const duration = await extractDurationFromFile(file)

  return {
    title,
    artist,
    duration,
  }
}


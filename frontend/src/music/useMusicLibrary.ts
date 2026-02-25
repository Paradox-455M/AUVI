import { useCallback, useSyncExternalStore } from 'react'
import { extractTrackMetadata, extractArtworkFromFile } from './metadata'
import { apiFetch, getAccessToken, buildStreamPath, ApiError } from '../api/client'
import type { Track } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// IndexedDB helpers (used for local-only tracks when not authenticated)
// ─────────────────────────────────────────────────────────────────────────────

const DB_NAME = 'auvi-library'
const DB_VERSION = 1
const STORE_NAME = 'tracks'

interface PersistedTrack {
  id: string
  file: File
  title: string
  artist?: string
  duration?: number
  tags: string[]
  createdAt: number
  artworkBlob?: Blob | null
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

async function persistTrack(track: Track, artworkBlob?: Blob | null): Promise<void> {
  if (!track.file) return // Skip for backend tracks (no local file)
  try {
    const db = await openDB()
    const persisted: PersistedTrack = {
      id: track.id,
      file: track.file,
      title: track.title,
      artist: track.artist,
      duration: track.duration,
      tags: track.tags,
      createdAt: track.createdAt,
      artworkBlob: artworkBlob ?? null,
    }
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(persisted)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // IndexedDB failures are non-fatal
  }
}

async function deletePersistedTrack(id: string): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // Non-fatal
  }
}

async function clearPersistedTracks(): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // Non-fatal
  }
}

async function loadPersistedTracks(): Promise<{ track: Track; artworkBlob: Blob | null }[]> {
  try {
    const db = await openDB()
    const records = await new Promise<PersistedTrack[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const request = tx.objectStore(STORE_NAME).getAll()
      request.onsuccess = () => resolve(request.result as PersistedTrack[])
      request.onerror = () => reject(request.error)
    })
    return records.map((r) => {
      const url = URL.createObjectURL(r.file)
      const artworkBlob = r.artworkBlob ?? null
      const artworkUrl = artworkBlob ? URL.createObjectURL(artworkBlob) : null
      const track: Track = {
        id: r.id,
        file: r.file,
        url,
        title: r.title,
        artist: r.artist,
        duration: r.duration,
        tags: r.tags,
        createdAt: r.createdAt,
        artworkUrl,
      }
      return { track, artworkBlob }
    })
  } catch {
    return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Backend API types
// ─────────────────────────────────────────────────────────────────────────────

interface BackendTrack {
  id: string
  title: string
  duration_ms: number
  created_at: string | null
}

interface BackendTag {
  id: string
  name: string
}

interface GalleryGroup {
  tagId: string
  tagName: string
  tracks: Array<{ id: string }>
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level state
// ─────────────────────────────────────────────────────────────────────────────

type MusicLibraryActions = {
  addFiles: (files: File[] | FileList, defaultTags?: string[]) => Promise<Track[]>
  setTrackTags: (trackId: string, tags: string[]) => void
  addTrackTag: (trackId: string, tag: string) => void
  removeTrack: (trackId: string) => void
  clearLibrary: () => void
}

export type UseMusicLibraryResult = {
  tracks: Track[]
} & MusicLibraryActions

type Subscriber = () => void

let libraryTracks: Track[] = []
const trackUrlById = new Map<string, string>()
const trackArtworkUrlById = new Map<string, string>()
const trackArtworkBlobById = new Map<string, Blob | null>()
const subscribers = new Set<Subscriber>()

function toFileArray(files: File[] | FileList): File[] {
  return Array.isArray(files) ? files : Array.from(files)
}

function uniqueTags(tags: string[]): string[] {
  const seen = new Set<string>()

  for (const tag of tags) {
    const normalized = tag.trim()
    if (normalized) {
      seen.add(normalized)
    }
  }

  return Array.from(seen)
}

function createTrackId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

function subscribe(callback: Subscriber) {
  subscribers.add(callback)
  return () => { subscribers.delete(callback) }
}

function getSnapshot() {
  return libraryTracks
}

function updateTracks(updater: (previousTracks: Track[]) => Track[]) {
  libraryTracks = updater(libraryTracks)
  for (const sub of subscribers) {
    sub()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level exports (called from AuthContext without needing the hook)
// ─────────────────────────────────────────────────────────────────────────────

export function clearLibrary(): void {
  for (const url of trackUrlById.values()) {
    URL.revokeObjectURL(url)
  }
  trackUrlById.clear()
  for (const artworkUrl of trackArtworkUrlById.values()) {
    URL.revokeObjectURL(artworkUrl)
  }
  trackArtworkUrlById.clear()
  trackArtworkBlobById.clear()

  void clearPersistedTracks()
  updateTracks(() => [])
}

export async function hydrateFromBackend(): Promise<void> {
  const [tracks, gallery] = await Promise.all([
    apiFetch<BackendTrack[]>('/api/v1/tracks?limit=200'),
    apiFetch<GalleryGroup[]>('/api/v1/gallery'),
  ])

  const tagsByTrackId = new Map<string, string[]>()
  for (const group of gallery) {
    for (const t of group.tracks) {
      tagsByTrackId.set(t.id, [...(tagsByTrackId.get(t.id) ?? []), group.tagName])
    }
  }

  const frontendTracks: Track[] = tracks.map(bt => ({
    id: bt.id,
    url: buildStreamPath(bt.id),
    title: bt.title,
    duration: bt.duration_ms / 1000,
    tags: tagsByTrackId.get(bt.id) ?? [],
    createdAt: bt.created_at ? new Date(bt.created_at).getTime() : Date.now(),
    artworkUrl: null,
  }))

  updateTracks(() => frontendTracks)
}

// ─────────────────────────────────────────────────────────────────────────────
// Hydration from IndexedDB (used when not authenticated)
// ─────────────────────────────────────────────────────────────────────────────

export async function hydrateLibrary(): Promise<void> {
  const results = await loadPersistedTracks()
  if (results.length === 0) return

  for (const { track, artworkBlob } of results) {
    trackUrlById.set(track.id, track.url)
    if (track.artworkUrl) {
      trackArtworkUrlById.set(track.id, track.artworkUrl)
    }
    trackArtworkBlobById.set(track.id, artworkBlob)
  }
  updateTracks(() => results.map((r) => r.track))
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useMusicLibrary(): UseMusicLibraryResult {
  const tracks = useSyncExternalStore(subscribe, getSnapshot)

  const addFiles = useCallback<MusicLibraryActions['addFiles']>(
    async (files, defaultTags = []) => {
      const fileList = toFileArray(files)
      if (fileList.length === 0) {
        return []
      }

      const normalizedDefaultTags = uniqueTags(defaultTags)
      const token = getAccessToken()

      if (token) {
        // Backend mode: upload tracks to the server

        // First, resolve tag names → backend UUIDs (idempotent)
        const tagIds: string[] = []
        for (const tagName of normalizedDefaultTags) {
          try {
            const tag = await apiFetch<BackendTag>('/api/v1/tags', {
              method: 'POST',
              body: JSON.stringify({ name: tagName }),
            })
            tagIds.push(tag.id)
          } catch {
            // Non-fatal: skip the tag if creation fails
          }
        }

        const tagsCsv = tagIds.join(',')
        const results: Track[] = []

        for (const file of fileList) {
          const [metadata, artwork] = await Promise.all([
            extractTrackMetadata(file),
            extractArtworkFromFile(file),
          ])

          const formData = new FormData()
          formData.append('file', file)
          if (metadata.title) formData.append('title', metadata.title)
          if (metadata.artist) formData.append('artist', metadata.artist)
          if (tagsCsv) formData.append('tags', tagsCsv)

          try {
            const { track: bt } = await apiFetch<{ track: BackendTrack; tags: BackendTag[] }>(
              '/api/v1/tracks',
              { method: 'POST', body: formData },
            )
            const track: Track = {
              id: bt.id,
              url: buildStreamPath(bt.id),
              title: bt.title || metadata.title,
              artist: metadata.artist,
              duration: bt.duration_ms / 1000,
              tags: normalizedDefaultTags,
              createdAt: bt.created_at ? new Date(bt.created_at).getTime() : Date.now(),
              artworkUrl: artwork.url,
            }
            if (track.artworkUrl) trackArtworkUrlById.set(track.id, track.artworkUrl)
            trackArtworkBlobById.set(track.id, artwork.blob)
            results.push(track)
          } catch (e) {
            if (artwork.url) URL.revokeObjectURL(artwork.url)
            if (e instanceof ApiError && e.status === 409) continue // duplicate — skip silently
            // For all other errors: log and continue so remaining files still upload
            console.error('[Auvi] Failed to upload file:', file.name, e)
          }
        }

        updateTracks((prev) => [...prev, ...results])
        return results
      }

      // Local-only mode (not authenticated)
      const results = await Promise.all(
        fileList.map(async (file) => {
          const url = URL.createObjectURL(file)
          const [metadata, artwork] = await Promise.all([
            extractTrackMetadata(file),
            extractArtworkFromFile(file),
          ])
          const track: Track = {
            id: createTrackId(),
            file,
            url,
            title: metadata.title,
            artist: metadata.artist,
            duration: metadata.duration,
            tags: normalizedDefaultTags,
            createdAt: Date.now(),
            artworkUrl: artwork.url,
          }

          return { track, artworkBlob: artwork.blob }
        }),
      )

      for (const { track, artworkBlob } of results) {
        trackUrlById.set(track.id, track.url)
        if (track.artworkUrl) {
          trackArtworkUrlById.set(track.id, track.artworkUrl)
        }
        trackArtworkBlobById.set(track.id, artworkBlob)
        void persistTrack(track, artworkBlob)
      }
      updateTracks((previousTracks) => [...previousTracks, ...results.map((r) => r.track)])

      return results.map((r) => r.track)
    },
    [],
  )

  const setTrackTags = useCallback<MusicLibraryActions['setTrackTags']>((trackId, tags) => {
    const normalizedTags = uniqueTags(tags)
    updateTracks((previousTracks) => {
      const updated = previousTracks.map((track) =>
        track.id === trackId ? { ...track, tags: normalizedTags } : track,
      )
      const updatedTrack = updated.find((t) => t.id === trackId)
      if (updatedTrack) {
        void persistTrack(updatedTrack, trackArtworkBlobById.get(trackId))
      }
      return updated
    })
  }, [])

  const addTrackTag = useCallback<MusicLibraryActions['addTrackTag']>((trackId, tag) => {
    const normalizedTag = tag.trim()
    if (!normalizedTag) {
      return
    }

    updateTracks((previousTracks) => {
      const updated = previousTracks.map((track) => {
        if (track.id !== trackId) return track
        if (track.tags.includes(normalizedTag)) return track
        return { ...track, tags: [...track.tags, normalizedTag] }
      })
      const updatedTrack = updated.find((t) => t.id === trackId)
      if (updatedTrack) {
        void persistTrack(updatedTrack, trackArtworkBlobById.get(trackId))
      }
      return updated
    })
  }, [])

  const removeTrack = useCallback<MusicLibraryActions['removeTrack']>((trackId) => {
    const url = trackUrlById.get(trackId)
    if (url) {
      if (!url.startsWith('/api/')) URL.revokeObjectURL(url)
      trackUrlById.delete(trackId)
    }
    const artworkUrl = trackArtworkUrlById.get(trackId)
    if (artworkUrl) {
      URL.revokeObjectURL(artworkUrl)
      trackArtworkUrlById.delete(trackId)
    }
    trackArtworkBlobById.delete(trackId)

    // Look up inside the updater so concurrent calls read consistent state
    updateTracks((previousTracks) => {
      const track = previousTracks.find((t) => t.id === trackId)
      if (track?.url.startsWith('/api/v1/')) {
        void apiFetch(`/api/v1/tracks/${trackId}`, { method: 'DELETE' }).catch(() => {})
      } else {
        void deletePersistedTrack(trackId)
      }
      return previousTracks.filter((t) => t.id !== trackId)
    })
  }, [])

  const clearLibraryCallback = useCallback(() => clearLibrary(), [])

  return {
    tracks,
    addFiles,
    setTrackTags,
    addTrackTag,
    removeTrack,
    clearLibrary: clearLibraryCallback,
  }
}

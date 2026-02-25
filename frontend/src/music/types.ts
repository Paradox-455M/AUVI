export interface Track {
  id: string
  file?: File
  url: string
  title: string
  artist?: string
  duration?: number
  tags: string[]
  createdAt: number
  artworkUrl?: string | null
}

export type TrackCreationInput = {
  file: File
  defaultTags?: string[]
}

export type TrackTagUpdate = {
  trackId: string
  tags: string[]
}

export type TrackTagAppendInput = {
  trackId: string
  tag: string
}

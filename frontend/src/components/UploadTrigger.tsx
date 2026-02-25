import { ChangeEvent, KeyboardEvent, useRef, useState } from 'react'

export interface UploadTriggerProps {
  onUpload: (files: FileList, tags: string[]) => void | Promise<void>
  disabled?: boolean
}

function normalizeTag(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function UploadTrigger({ onUpload, disabled = false }: UploadTriggerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [draftTag, setDraftTag] = useState('')
  const [isUploading, setIsUploading] = useState(false)

  const isDisabled = disabled || isUploading

  const commitDraftTag = () => {
    const nextTag = normalizeTag(draftTag)
    if (!nextTag) {
      setDraftTag('')
      return
    }
    setTags((previousTags) => (previousTags.includes(nextTag) ? previousTags : [...previousTags, nextTag]))
    setDraftTag('')
  }

  const removeTag = (tagToRemove: string) => {
    setTags((previousTags) => previousTags.filter((tag) => tag !== tagToRemove))
  }

  const handleUploadClick = () => {
    if (isDisabled) return
    inputRef.current?.click()
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return
    try {
      setIsUploading(true)
      await onUpload(files, tags)
    } finally {
      setIsUploading(false)
      event.target.value = ''
    }
  }

  const handleTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      commitDraftTag()
      return
    }
    if (event.key === 'Backspace' && !draftTag && tags.length > 0) {
      event.preventDefault()
      setTags((previousTags) => previousTags.slice(0, -1))
    }
  }

  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2 text-[var(--color-text-secondary)]">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="audio/*"
        className="sr-only"
        onChange={handleFileChange}
        disabled={isDisabled}
      />

      <button
        type="button"
        onClick={handleUploadClick}
        disabled={isDisabled}
        className="nav-label text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-30"
      >
        {isUploading ? 'Archiving...' : '+ Archive'}
      </button>

      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => removeTag(tag)}
            disabled={isDisabled}
            className="label-subtle text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-30"
            aria-label={`Remove tag ${tag}`}
          >
            #{tag} ×
          </button>
        ))}

        <input
          type="text"
          value={draftTag}
          onChange={(event) => setDraftTag(event.target.value)}
          onKeyDown={handleTagKeyDown}
          onBlur={commitDraftTag}
          disabled={isDisabled}
          placeholder="add tag..."
          className="w-24 bg-transparent label-subtle text-[var(--color-text-secondary)] placeholder:opacity-50 focus:outline-none disabled:opacity-30"
          aria-label="Add upload tag"
        />
      </div>
    </div>
  )
}

export { UploadTrigger }
export default UploadTrigger

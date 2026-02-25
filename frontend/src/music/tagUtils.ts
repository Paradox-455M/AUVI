import type { Track } from './types';

const UNTAGGED_KEY = 'untagged';

const getTrackTags = (track: Track): string[] => {
  const maybeTags = (track as Track & { tags?: unknown }).tags;
  if (!Array.isArray(maybeTags)) return [];

  const normalized = maybeTags
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

  return Array.from(new Set(normalized));
};

const sortTagNames = (
  tagNames: string[],
  groupedTracks: Record<string, Track[]>,
): string[] => {
  return [...tagNames].sort((a, b) => {
    const countDiff = groupedTracks[b].length - groupedTracks[a].length;
    if (countDiff !== 0) return countDiff;
    return a.localeCompare(b);
  });
};

export function getOrderedTagNames(tracks: Track[]): string[] {
  const grouped: Record<string, Track[]> = {};

  for (const track of tracks) {
    const tags = getTrackTags(track);
    if (tags.length === 0) {
      grouped[UNTAGGED_KEY] ??= [];
      grouped[UNTAGGED_KEY].push(track);
      continue;
    }

    for (const tag of tags) {
      grouped[tag] ??= [];
      grouped[tag].push(track);
    }
  }

  const tagNames = Object.keys(grouped).filter((tag) => tag !== UNTAGGED_KEY);
  const orderedTags = sortTagNames(tagNames, grouped);

  if (grouped[UNTAGGED_KEY]?.length) {
    orderedTags.push(UNTAGGED_KEY);
  }

  return orderedTags;
}

export function groupTracksByTag(tracks: Track[]): Record<string, Track[]> {
  const grouped: Record<string, Track[]> = {};
  const orderedTagNames = getOrderedTagNames(tracks);

  for (const tagName of orderedTagNames) {
    grouped[tagName] = [];
  }

  for (const track of tracks) {
    const tags = getTrackTags(track);

    if (tags.length === 0) {
      grouped[UNTAGGED_KEY].push(track);
      continue;
    }

    for (const tag of tags) {
      grouped[tag].push(track);
    }
  }

  return grouped;
}

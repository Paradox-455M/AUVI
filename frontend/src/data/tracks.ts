export interface Track {
  id: string;
  title: string;
  artist: string;
  duration: number;
  artworkUrl?: string | null;
}

export const tracks: Track[] = [
  { id: '1', title: 'Midnight City', artist: 'M83', duration: 243, artworkUrl: null },
  { id: '2', title: 'Time', artist: 'Hans Zimmer', duration: 287, artworkUrl: null },
  { id: '3', title: 'Strobe', artist: 'Deadmau5', duration: 632, artworkUrl: null },
];

export const getTrackTitle = (id: string | null): string => {
  if (!id) return 'Work Title';
  const t = tracks.find((x) => x.id === id);
  return t?.title ?? 'Work Title';
};

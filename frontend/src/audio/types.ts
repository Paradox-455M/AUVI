export interface AudioState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isLoaded: boolean;
  isLoading: boolean;
}

export interface AudioAnalysis {
  waveform: Uint8Array;
  frequencies: Uint8Array;
}

export type AudioEventCallback = (state: AudioState) => void;
export type AudioEndCallback = () => void;

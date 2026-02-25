import { useState, useEffect, useCallback } from 'react';
import { audioEngine } from './AudioEngine';
import { AudioState } from './types';

export const useAudio = () => {
  const [state, setState] = useState<AudioState>(audioEngine.getState());
  useEffect(() => {
    const unsub = audioEngine.subscribe(setState);
    return () => { unsub(); };
  }, []);
  
  return {
    ...state,
    load: useCallback((url: string) => audioEngine.load(url), []),
    play: useCallback(() => audioEngine.play(), []),
    pause: useCallback(() => audioEngine.pause(), []),
    seek: useCallback((t: number) => audioEngine.seek(t), []),
    setVolume: useCallback((v: number) => audioEngine.setVolume(v), []),
    toggleMute: useCallback(() => audioEngine.toggleMute(), []),
  };
};

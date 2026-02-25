import { useCallback, useEffect, useRef, useState } from 'react';

export interface AudioPlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isReady: boolean;
  error: string | null;
}

interface UseAudioPlayerResult {
  load: (url: string) => Promise<void>;
  play: () => Promise<void>;
  pause: () => void;
  toggle: () => void;
  seek: (time: number) => void;
  setVolume: (value: number) => void;
  setMuted: (muted: boolean) => void;
  state: AudioPlayerState;
  analyserNode: AnalyserNode | null;
  audioElement: HTMLAudioElement | null;
}

const DEFAULT_STATE: AudioPlayerState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  isMuted: false,
  isReady: false,
  error: null,
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const useAudioPlayer = (): UseAudioPlayerResult => {
  const [state, setState] = useState<AudioPlayerState>(DEFAULT_STATE);
  const stateRef = useRef(state);

  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  const contextRef = useRef<AudioContext | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const cancelScheduledPause = useCallback(() => {
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = null;
    }
  }, []);

  const getTargetGain = useCallback((nextState: AudioPlayerState): number => {
    if (!nextState.isPlaying || nextState.isMuted) return 0;
    return clamp01(nextState.volume);
  }, []);

  const rampGain = useCallback((target: number, durationSec: number) => {
    const context = contextRef.current;
    const gainNode = gainRef.current;
    if (!context || !gainNode) return;

    const now = context.currentTime;
    const safeDuration = Math.max(0.01, durationSec);
    const current = gainNode.gain.value;

    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(current, now);
    gainNode.gain.linearRampToValueAtTime(target, now + safeDuration);
  }, []);

  // Creates only the HTMLAudioElement and attaches event listeners.
  // Safe to call outside a user gesture — no AudioContext created here.
  const initAudioElement = useCallback(() => {
    if (audioRef.current) return;

    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'metadata';

    audio.addEventListener('timeupdate', () => {
      setState((prev) => ({ ...prev, currentTime: audio.currentTime }));
    });

    audio.addEventListener('durationchange', () => {
      setState((prev) => ({
        ...prev,
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      }));
    });

    audio.addEventListener('canplay', () => {
      setState((prev) => ({ ...prev, isReady: true, error: null }));
    });

    audio.addEventListener('play', () => {
      setState((prev) => ({ ...prev, isPlaying: true, error: null }));
    });

    audio.addEventListener('pause', () => {
      setState((prev) => ({ ...prev, isPlaying: false }));
      rampGain(0, 0.25);
    });

    audio.addEventListener('ended', () => {
      setState((prev) => ({ ...prev, isPlaying: false, currentTime: 0 }));
      rampGain(0, 0.25);
    });

    audio.addEventListener('error', () => {
      const mediaError = audio.error;
      const details = mediaError?.message || 'Unable to load audio source.';
      setState((prev) => ({ ...prev, isPlaying: false, isReady: false, error: details }));
      rampGain(0, 0.12);
    });

    audioRef.current = audio;
  }, [rampGain]);

  // Creates the Web Audio API context and connects the graph.
  // MUST be called from a user gesture so the AudioContext starts running.
  const initAudioGraph = useCallback(() => {
    if (contextRef.current && gainRef.current) return;
    if (!audioRef.current) return;

    const AudioContextCtor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      throw new Error('Web Audio API is not supported in this browser.');
    }

    const context = new AudioContextCtor();
    const audio = audioRef.current;
    const source = context.createMediaElementSource(audio);
    const gain = context.createGain();
    gain.gain.value = 0;

    source.connect(gain);

    let analyser: AnalyserNode | null = null;
    try {
      analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      gain.connect(analyser);
      analyser.connect(context.destination);
    } catch {
      gain.connect(context.destination);
    }

    contextRef.current = context;
    gainRef.current = gain;
    setAnalyserNode(analyser);
  }, []);

  const load = useCallback(async (url: string) => {
    initAudioElement();

    const audio = audioRef.current;
    if (!audio) return;

    cancelScheduledPause();

    setState((prev) => ({
      ...prev,
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      isReady: false,
      error: null,
    }));

    await new Promise<void>((resolve, reject) => {
      const onReady = () => {
        cleanup();
        setState((prev) => ({
          ...prev,
          duration: Number.isFinite(audio.duration) ? audio.duration : prev.duration,
          isReady: true,
          error: null,
        }));
        resolve();
      };

      const onError = () => {
        cleanup();
        reject(new Error('Unable to load audio source.'));
      };

      const cleanup = () => {
        audio.removeEventListener('loadedmetadata', onReady);
        audio.removeEventListener('canplay', onReady);
        audio.removeEventListener('error', onError);
      };

      audio.addEventListener('loadedmetadata', onReady);
      audio.addEventListener('canplay', onReady);
      audio.addEventListener('error', onError);

      audio.pause();
      audio.src = url;
      audio.load();
    }).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'Unable to load audio source.';
      setState((prev) => ({ ...prev, error: message, isReady: false, isPlaying: false }));
    });
  }, [cancelScheduledPause, initAudioElement]);

  const play = useCallback(async () => {
    try {
      // initAudioGraph creates the AudioContext inside this user-gesture call,
      // so the context is never auto-suspended by the browser's autoplay policy.
      initAudioGraph();

      const context = contextRef.current;
      const audio = audioRef.current;
      const gainNode = gainRef.current;
      if (!context || !audio || !gainNode) return;

      cancelScheduledPause();

      if (context.state === 'suspended') {
        await context.resume();
      }

      // Set gain directly to target before play — no scheduled-automation race.
      const targetGain = stateRef.current.isMuted ? 0 : clamp01(stateRef.current.volume);
      gainNode.gain.cancelScheduledValues(context.currentTime);
      gainNode.gain.setValueAtTime(targetGain, context.currentTime);

      await audio.play();
      setState((prev) => ({ ...prev, isPlaying: true, error: null }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Playback failed.';
      setState((prev) => ({ ...prev, isPlaying: false, error: message }));
    }
  }, [cancelScheduledPause, initAudioGraph]);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    cancelScheduledPause();
    rampGain(0, 0.35);
    setState((prev) => ({ ...prev, isPlaying: false }));

    pauseTimeoutRef.current = setTimeout(() => {
      audio.pause();
      pauseTimeoutRef.current = null;
    }, 360);
  }, [cancelScheduledPause, rampGain]);

  const toggle = useCallback(() => {
    if (stateRef.current.isPlaying) {
      pause();
      return;
    }
    void play();
  }, [pause, play]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, time);
    setState((prev) => ({ ...prev, currentTime: audio.currentTime }));
  }, []);

  const setVolume = useCallback((value: number) => {
    const normalized = clamp01(value);
    setState((prev) => {
      const nextState = { ...prev, volume: normalized };
      rampGain(getTargetGain(nextState), 0.22);
      return nextState;
    });
  }, [getTargetGain, rampGain]);

  const setMuted = useCallback((muted: boolean) => {
    setState((prev) => {
      const nextState = { ...prev, isMuted: muted };
      rampGain(getTargetGain(nextState), 0.18);
      return nextState;
    });
  }, [getTargetGain, rampGain]);

  useEffect(() => {
    return () => {
      cancelScheduledPause();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      if (contextRef.current) {
        void contextRef.current.close();
      }
    };
  }, [cancelScheduledPause]);

  return {
    load,
    play,
    pause,
    toggle,
    seek,
    setVolume,
    setMuted,
    state,
    analyserNode,
    audioElement: audioRef.current,
  };
};

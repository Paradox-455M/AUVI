import { AudioState, AudioAnalysis, AudioEventCallback, AudioEndCallback } from './types';

class AudioEngine {
  private static instance: AudioEngine;
  private audioContext: AudioContext | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  
  private currentState: AudioState = {
    isPlaying: false, currentTime: 0, duration: 0, volume: 1, isMuted: false, isLoaded: false, isLoading: false,
  };
  private volumeBeforeMute: number = 1;
  
  private stateCallbacks: Set<AudioEventCallback> = new Set();
  private endCallbacks: Set<AudioEndCallback> = new Set();
  private currentObjectUrl: string | null = null;

  private constructor() {}
  static getInstance(): AudioEngine {
    if (!AudioEngine.instance) AudioEngine.instance = new AudioEngine();
    return AudioEngine.instance;
  }

  private initContext() {
    if (this.audioContext) return;
    this.audioContext = new AudioContext();
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 512;
    this.analyserNode.smoothingTimeConstant = 0.8;
    this.gainNode = this.audioContext.createGain();
    this.analyserNode.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);
  }

  async load(url: string): Promise<void> {
    this.initContext();
    if (this.currentObjectUrl) URL.revokeObjectURL(this.currentObjectUrl);
    if (this.audioElement) { this.audioElement.pause(); this.audioElement.src = ''; }
    
    this.updateState({ isLoading: true, isLoaded: false, isPlaying: false });
    this.audioElement = new Audio(url);
    this.audioElement.crossOrigin = 'anonymous';
    this.currentObjectUrl = url;

    if (this.sourceNode) this.sourceNode.disconnect();
    
    return new Promise((resolve, reject) => {
      if (!this.audioElement || !this.audioContext || !this.analyserNode) return reject(new Error('Init failed'));
      
      this.audioElement.addEventListener('loadedmetadata', () => {
        if (!this.audioElement) return;
        this.sourceNode = this.audioContext!.createMediaElementSource(this.audioElement!);
        this.sourceNode.connect(this.analyserNode!);
        this.updateState({ isLoading: false, isLoaded: true, duration: this.audioElement!.duration, currentTime: 0 });
        resolve();
      });
      this.audioElement.addEventListener('error', () => reject(new Error('Load error')));
      this.audioElement.addEventListener('ended', () => { this.updateState({ isPlaying: false }); this.endCallbacks.forEach(cb => cb()); });
      this.audioElement.addEventListener('timeupdate', () => { if(this.audioElement) this.updateState({ currentTime: this.audioElement!.currentTime }); });
    });
  }

  play(): void {
    if (!this.audioElement || !this.audioContext) return;
    if (this.audioContext.state === 'suspended') this.audioContext.resume();
    this.audioElement.play();
    this.updateState({ isPlaying: true });
  }
  pause(): void { if(this.audioElement) this.audioElement.pause(); this.updateState({ isPlaying: false }); }
  seek(time: number): void { if(this.audioElement) this.audioElement.currentTime = time; }
  setVolume(value: number): void {
    if (this.gainNode) this.gainNode.gain.setValueAtTime(this.currentState.isMuted ? 0 : value, 0);
    this.updateState({ volume: value });
  }
  toggleMute(): void {
    const nextMuted = !this.currentState.isMuted;
    if (nextMuted) {
      this.volumeBeforeMute = this.currentState.volume;
      if (this.gainNode) this.gainNode.gain.setValueAtTime(0, 0);
    } else {
      if (this.gainNode) this.gainNode.gain.setValueAtTime(this.volumeBeforeMute, 0);
    }
    this.updateState({ isMuted: nextMuted });
  }

  getAnalysis(): AudioAnalysis {
    if (!this.analyserNode) return { waveform: new Uint8Array(0), frequencies: new Uint8Array(0) };
    const bufferLength = this.analyserNode.frequencyBinCount;
    const waveform = new Uint8Array(bufferLength);
    const frequencies = new Uint8Array(bufferLength);
    this.analyserNode.getByteTimeDomainData(waveform);
    this.analyserNode.getByteFrequencyData(frequencies);
    return { waveform, frequencies };
  }
  
  getState(): AudioState { return {...this.currentState}; }
  subscribe(cb: AudioEventCallback) { this.stateCallbacks.add(cb); return () => this.stateCallbacks.delete(cb); }
  onEnded(cb: AudioEndCallback) { this.endCallbacks.add(cb); return () => this.endCallbacks.delete(cb); }
  private updateState(partial: Partial<AudioState>) { this.currentState = {...this.currentState, ...partial}; this.stateCallbacks.forEach(cb => cb(this.currentState)); }
  
  destroy() {
    if(this.audioElement) this.audioElement.pause();
    if(this.currentObjectUrl) URL.revokeObjectURL(this.currentObjectUrl);
    if(this.audioContext) this.audioContext.close();
  }
}
export const audioEngine = AudioEngine.getInstance();

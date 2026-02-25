declare module 'butterchurn' {
  export interface Visualizer {
    connectAudio(analyserNode: AnalyserNode): void
    loadPreset(preset: object, blendTime: number): void
    render(): void
    setRendererSize(width: number, height: number): void
  }

  interface ButterchurnStatic {
    createVisualizer(
      audioContext: AudioContext,
      canvas: HTMLCanvasElement,
      options: { width: number; height: number; pixelRatio?: number; textureRatio?: number },
    ): Visualizer
  }

  const butterchurn: ButterchurnStatic
  export default butterchurn
}

declare module 'butterchurn-presets' {
  interface ButterchurnPresetsStatic {
    getPresets(): Record<string, object>
  }

  const butterchurnPresets: ButterchurnPresetsStatic
  export default butterchurnPresets
}

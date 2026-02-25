export class ProjectMEngine {
  private gl: WebGLRenderingContext | null = null;
  private _projectM: any = null;
  private _isInitialized = false;

  async init(canvas: HTMLCanvasElement): Promise<boolean> {
    this.gl = canvas.getContext('webgl');
    if (!this.gl) return false;
    console.log('ProjectM initialized (mock)');
    this._isInitialized = true;
    return true;
  }
  updatePCM(_waveform: Uint8Array) { /* pass data to WASM */ }
  loadPreset(_data: string) { /* pass preset */ }
  renderFrame() {
    void this._projectM; /* draw loop when WASM ready */
  }
  resize(_w: number, _h: number) { /* resize */ }
  destroy() {
    if (this._isInitialized) this._isInitialized = false;
  }
}
export const projectMEngine = new ProjectMEngine();

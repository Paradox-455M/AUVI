const defaultPreset = `
[preset00]
fDecay=0.98
fVideoEchoZoom=1.000000
fVideoEchoAlpha=0.000000
nVideoEchoOrientation=1
nWaveMode=2
fWaveAlpha=0.800000
fWaveScale=0.721283
wave_r=0.5
wave_g=0.5
wave_b=0.5
`;

export interface Preset { id: string; name: string; data: string; }
export const defaultPresets: Preset[] = [
  { id: '1', name: 'Default Milk', data: defaultPreset },
];

export class PresetManager {
  private presets: Map<string, Preset> = new Map();
  private activePresetId: string | null = null;
  constructor(initial: Preset[] = defaultPresets) { initial.forEach(p => this.presets.set(p.id, p)); if(initial.length) this.activePresetId = initial[0].id; }
  getActivePreset(): Preset | null { return this.activePresetId ? this.presets.get(this.activePresetId) || null : null; }
  setActivePreset(id: string) { if(this.presets.has(id)) this.activePresetId = id; }
  getAllPresets(): Preset[] { return Array.from(this.presets.values()); }
}

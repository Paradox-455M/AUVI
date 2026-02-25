import React, { useRef, useEffect } from 'react'
import butterchurn, { type Visualizer } from 'butterchurn'
import butterchurnPresets from 'butterchurn-presets'
import type { PresetManager } from './PresetManager'

const CYCLE_INTERVAL_MS = 20_000
const BLEND_SECONDS = 2.5

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface Props {
  presetManager?: PresetManager   // kept for API compat, unused
  analyserNode?: AnalyserNode | null
}

export const VisualizerCanvas: React.FC<Props> = ({ analyserNode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Handle DPR-aware canvas sizing independently of butterchurn lifecycle
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      canvas.width  = canvas.offsetWidth  * (window.devicePixelRatio || 1)
      canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  // Butterchurn lifecycle — recreated whenever analyserNode changes
  useEffect(() => {
    if (!analyserNode || !canvasRef.current) return

    const canvas = canvasRef.current
    const audioContext = analyserNode.context as AudioContext

    const viz: Visualizer = butterchurn.createVisualizer(audioContext, canvas, {
      width:      canvas.width,
      height:     canvas.height,
      pixelRatio: window.devicePixelRatio || 1,
    })
    viz.connectAudio(analyserNode)

    // Shuffle the full preset library — different random order for every song
    const all = butterchurnPresets.getPresets()
    const playlist = shuffle(Object.keys(all))

    let presetIndex = 0
    const loadPreset = (blend: number) => {
      viz.loadPreset(all[playlist[presetIndex % playlist.length]], blend)
      presetIndex++
    }
    loadPreset(0)   // first preset instant

    const cycleTimer = setInterval(() => loadPreset(BLEND_SECONDS), CYCLE_INTERVAL_MS)

    // Resize butterchurn when canvas dimensions change
    const ro = new ResizeObserver(() => {
      viz.setRendererSize(canvas.width, canvas.height)
    })
    ro.observe(canvas)

    // Render loop
    let rafId = 0
    const loop = () => {
      viz.render()
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafId)
      clearInterval(cycleTimer)
      ro.disconnect()
    }
  }, [analyserNode])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ background: '#0b0b0b' }}
    />
  )
}

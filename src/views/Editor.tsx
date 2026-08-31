import { useEffect, useState } from 'react'
import { invoke, onEvent } from '../lib/api'
import type { Toast } from '../App'

type Clip = { path: string; name: string; duration: number; width: number; height: number; start?: string; end?: string }

function clock(value: number) {
  const total = Math.max(0, Math.round(value))
  const minutes = String(Math.floor(total / 60)).padStart(2, '0')
  return `${minutes}:${String(total % 60).padStart(2, '0')}`
}

export default function Editor({ notify }: { notify: Toast }) {
  const [clips, setClips] = useState<Clip[]>([])
  const [music, setMusic] = useState<string | null>(null)
  const [musicVolume, setMusicVolume] = useState(0.3)
  const [keepOriginalAudio, setKeepOriginalAudio] = useState(true)
  const [resolution, setResolution] = useState<'720p' | '1080p'>('1080p')
  const [percent, setPercent] = useState(0)
  const [rendering, setRendering] = useState(false)
  const [output, setOutput] = useState<string | null>(null)

  useEffect(() => onEvent<{ percent: number }>('editor:progress', (event) => setPercent(event.percent)), [])

  const fail = (error: unknown) => notify(error instanceof Error ? error.message : String(error))

  const addClips = async () => {
    try {
      const picked = await invoke<Clip[]>('editor:pickClips')
      if (picked.length) setClips((current) => [...current, ...picked])
    } catch (error) {
      fail(error)
    }
  }

  const patch = (index: number, change: Partial<Clip>) =>
    setClips((current) => current.map((clip, position) => (position === index ? { ...clip, ...change } : clip)))

  const move = (index: number, offset: number) =>
    setClips((current) => {
      const next = [...current]
      const target = index + offset
      if (target < 0 || target >= next.length) return current
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })

  const render = async () => {
    setRendering(true)
    setPercent(0)
    setOutput(null)
    try {
      const result = await invoke<{ output: string }>('editor:render', {
        clips,
        music,
        musicVolume,
        keepOriginalAudio,
        resolution,
      })
      setOutput(result.output)
      notify('Montage exporte.')
    } catch (error) {
      fail(error)
    } finally {
      setRendering(false)
    }
  }

  const total = clips.reduce((sum, clip) => sum + (clip.duration || 0), 0)

  return (
    <div className="grid" style={{ gap: 16 }}>
      <section className="card">
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button className="btn primary" onClick={addClips}>➕ Ajouter des clips</button>
          <button
            className="btn"
            onClick={async () => {
              try {
                setMusic(await invoke<string | null>('editor:pickMusic'))
              } catch (error) {
                fail(error)
              }
            }}
          >
            🎵 {music ? 'Changer la musique' : 'Ajouter une musique'}
          </button>
          {music && <button className="btn" onClick={() => setMusic(null)}>Retirer la musique</button>}
          <div style={{ flex: 1 }} />
          <select className="field" style={{ width: 120 }} value={resolution} onChange={(event) => setResolution(event.target.value as '720p' | '1080p')}>
            <option value="1080p">1080p</option>
            <option value="720p">720p</option>
          </select>
          <button className="btn primary" disabled={!clips.length || rendering} onClick={render}>
            {rendering ? <span className="spin" /> : '🎬 Exporter'}
          </button>
          {rendering && <button className="btn danger" onClick={() => invoke('editor:cancel')}>Annuler</button>}
        </div>

        {music && (
          <div className="row" style={{ marginTop: 12, gap: 14, flexWrap: 'wrap' }}>
            <span className="muted" style={{ fontSize: 12.5 }}>{music}</span>
            <label className="row" style={{ gap: 6, fontSize: 13 }}>
              Volume musique
              <input type="range" min={0} max={1} step={0.05} value={musicVolume} onChange={(event) => setMusicVolume(Number(event.target.value))} />
              {Math.round(musicVolume * 100)}%
            </label>
            <label className="row" style={{ gap: 6, fontSize: 13 }}>
              <input type="checkbox" checked={keepOriginalAudio} onChange={(event) => setKeepOriginalAudio(event.target.checked)} />
              Garder le son des clips
            </label>
          </div>
        )}

        {(rendering || percent > 0) && (
          <div className="bar" style={{ marginTop: 14 }}>
            <span style={{ width: `${percent}%` }} />
          </div>
        )}

        {output && (
          <div className="row" style={{ marginTop: 12, gap: 8 }}>
            <span className="muted" style={{ fontSize: 12.5, flex: 1 }}>{output}</span>
            <button className="btn" onClick={() => invoke('tools:openPath', output)}>Lire</button>
            <button className="btn" onClick={() => invoke('tools:reveal', output)}>Ouvrir le dossier</button>
          </div>
        )}
      </section>

      <section className="card">
        <h3>Timeline ({clips.length} clips · {clock(total)})</h3>
        {!clips.length && <p className="muted" style={{ fontSize: 13 }}>Ajoute des clips, coupe-les puis exporte : Velora fait le rendu avec ffmpeg, en local.</p>}
        <div className="list">
          {clips.map((clip, index) => (
            <div key={`${clip.path}-${index}`} className="list-item">
              <span className="icon">{index + 1}</span>
              <div className="body">
                <b>{clip.name}</b>
                <span>{clock(clip.duration)} · {clip.width}x{clip.height}</span>
              </div>
              <input
                className="field"
                style={{ width: 96 }}
                value={clip.start ?? ''}
                placeholder="debut"
                onChange={(event) => patch(index, { start: event.target.value })}
              />
              <input
                className="field"
                style={{ width: 96 }}
                value={clip.end ?? ''}
                placeholder="fin"
                onChange={(event) => patch(index, { end: event.target.value })}
              />
              <button className="btn small" onClick={() => move(index, -1)}>↑</button>
              <button className="btn small" onClick={() => move(index, 1)}>↓</button>
              <button className="btn small" onClick={() => setClips((current) => current.filter((_, position) => position !== index))}>✕</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

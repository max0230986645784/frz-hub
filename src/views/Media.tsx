import { useState } from 'react'
import { invoke, bytes, localUrl } from '../lib/api'
import Theater from '../components/Theater'
import { useAsync } from '../lib/hooks'
import type { Toast } from '../App'

type Movie = { id: string; title: string; path: string; poster: string | null; size: number }
type Show = { id: string; show: string; poster: string | null; episodes: { id: string; title: string; path: string; season: number; episode: number }[] }
type Album = { id: string; album: string; poster: string | null; tracks: { id: string; title: string; path: string }[] }
type Library = { movies: Movie[]; series: Show[]; music: Album[]; counts: { movies: number; episodes: number; tracks: number } }
type Folder = { id: string; path: string }

export default function Media({ query, notify }: { query: string; notify: Toast }) {
  const library = useAsync<Library>(() => invoke('media:scan'))
  const folders = useAsync<Folder[]>(() => invoke('media:folders'))
  const [tab, setTab] = useState<'movies' | 'series' | 'music'>('movies')
  const [playing, setPlaying] = useState<{ title: string; path: string; audio: boolean } | null>(null)

  const needle = query.toLowerCase()
  const movies = (library.data?.movies ?? []).filter((item) => item.title.toLowerCase().includes(needle))
  const series = (library.data?.series ?? []).filter((item) => item.show.toLowerCase().includes(needle))
  const music = (library.data?.music ?? []).filter((item) => item.album.toLowerCase().includes(needle))

  const addFolder = async () => {
    try {
      const added = await invoke<Folder[] | null>('media:addFolder')
      if (!added) return
      notify('Dossier ajoute a la mediatheque.')
      folders.reload()
      library.reload()
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 16 }}>
        <div className="tabs" style={{ margin: 0 }}>
          {(['movies', 'series', 'music'] as const).map((key) => (
            <button key={key} className={`tab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
              {key === 'movies' ? `Films (${library.data?.counts.movies ?? 0})` : key === 'series' ? `Series (${series.length})` : `Musique (${library.data?.counts.tracks ?? 0})`}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={() => library.reload()}>↻ Rescanner</button>
        <button className="btn primary" onClick={addFolder}>➕ Dossier media</button>
      </div>

      {folders.data?.length === 0 && (
        <div className="empty">Ajoute un dossier (films, series, musique) pour construire ta mediatheque.</div>
      )}

      {library.loading && <span className="spin" />}

      {tab === 'movies' && (
        <div className="grid cols-4">
          {movies.map((movie) => (
            <button key={movie.id} className="card" style={{ padding: 12, display: 'grid', gap: 10, textAlign: 'left' }}
              onClick={() => setPlaying({ title: movie.title, path: movie.path, audio: false })}>
              <div className="poster">{movie.poster ? <img src={localUrl(movie.poster)} alt="" /> : <span>🎬</span>}</div>
              <div>
                <b style={{ fontSize: 13.5 }}>{movie.title}</b>
                <div className="muted" style={{ fontSize: 11.5 }}>{bytes(movie.size)}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {tab === 'series' && (
        <div className="grid cols-2">
          {series.map((show) => (
            <div key={show.id} className="card">
              <h3>{show.show}</h3>
              <div className="list">
                {show.episodes.slice(0, 8).map((episode) => (
                  <button key={episode.id} className="list-item" onClick={() => setPlaying({ title: episode.title, path: episode.path, audio: false })}>
                    <span className="icon">S{episode.season}</span>
                    <div className="body"><b>{episode.title}</b><span>Episode {episode.episode}</span></div>
                    <span className="pill">▶</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'music' && (
        <div className="grid cols-3">
          {music.map((album) => (
            <div key={album.id} className="card">
              <h3>{album.album}</h3>
              <div className="list">
                {album.tracks.slice(0, 10).map((track) => (
                  <button key={track.id} className="list-item" onClick={() => setPlaying({ title: track.title, path: track.path, audio: true })}>
                    <span className="icon">🎵</span>
                    <div className="body"><b>{track.title}</b></div>
                    <span className="pill">▶</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {playing && !playing.audio && (
        <Theater title={playing.title} path={playing.path} onClose={() => setPlaying(null)} />
      )}

      {playing?.audio && (
        <div className="card" style={{ position: 'sticky', bottom: 0, marginTop: 18 }}>
          <div className="row">
            <b style={{ flex: 1 }}>{playing.title}</b>
            <button className="btn small" onClick={() => setPlaying(null)}>✕</button>
          </div>
          <audio src={localUrl(playing.path)} controls autoPlay style={{ width: '100%', marginTop: 10 }} />
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { invoke, localUrl, playtime, since, type GameEntry } from '../lib/api'
import { useAsync } from '../lib/hooks'
import type { Toast } from '../App'

export default function Games({ query, notify }: { query: string; notify: Toast }) {
  const games = useAsync<GameEntry[]>(() => invoke('games:list'))
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<'all' | 'favorite'>('all')

  const guard = async (action: () => Promise<unknown>, message?: string) => {
    setBusy(true)
    try {
      await action()
      if (message) notify(message)
      games.reload()
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const list = (games.data ?? [])
    .filter((game) => game.name.toLowerCase().includes(query.toLowerCase()))
    .filter((game) => (tab === 'favorite' ? game.favorite : true))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || (b.lastSession ?? 0) - (a.lastSession ?? 0))

  return (
    <div>
      <div className="row" style={{ marginBottom: 16, gap: 10 }}>
        <div className="tabs" style={{ margin: 0 }}>
          <button className={`tab${tab === 'all' ? ' active' : ''}`} onClick={() => setTab('all')}>Tous</button>
          <button className={`tab${tab === 'favorite' ? ' active' : ''}`} onClick={() => setTab('favorite')}>Favoris</button>
        </div>
        <div style={{ flex: 1 }} />
        <button
          className="btn primary"
          onClick={() => guard(async () => {
            const found = await invoke<GameEntry[]>('games:scan')
            notify(`${found.length} jeux trouves (Steam / Epic).`)
          })}
        >
          🔍 Scanner Steam & Epic
        </button>
        {busy && <span className="spin" />}
      </div>

      {list.length === 0 ? (
        <div className="empty">Aucun jeu pour l'instant — lance un scan Steam / Epic.</div>
      ) : (
        <div className="grid cols-4">
          {list.map((game) => (
            <div key={game.id} className="card" style={{ padding: 14, display: 'grid', gap: 10 }}>
              <div className="poster">
                {game.cover ? <img src={localUrl(game.cover)} alt="" /> : <span>{game.icon || '🎮'}</span>}
              </div>
              <div>
                <b style={{ display: 'block' }}>{game.name}</b>
                <span className="muted" style={{ fontSize: 11.5 }}>
                  {game.source} · {playtime(game.playtime)} · {since(game.lastSession)}
                </span>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn small primary" style={{ flex: 1 }} onClick={() => guard(() => invoke('games:launch', game.id), `${game.name} demarre.`)}>
                  ▶ Lancer
                </button>
                <button className="btn small" onClick={() => guard(() => invoke('games:favorite', game.id))}>
                  {game.favorite ? '★' : '☆'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

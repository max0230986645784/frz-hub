import { useState } from 'react'
import { invoke, since } from '../lib/api'
import { useAsync } from '../lib/hooks'
import type { Toast } from '../App'

type Repo = { id: number; name: string; fullName: string; private: boolean; description: string | null; language: string | null; stars: number; url: string; pushedAt: string }
type Event = { id: string; type: string; repo: string; at: string; message: string }
type Notification = { id: string; title: string; type: string; repo: string; reason: string; at: string }
type PullRequest = { id: number; title: string; url: string; repo: string; at: string }

export default function Github({ notify }: { notify: Toast }) {
  const connected = useAsync<boolean>(() => invoke('github:connected'))
  const repos = useAsync<Repo[]>(() => invoke('github:repos', { limit: 30 }))
  const activity = useAsync<Event[]>(() => invoke('github:activity'))
  const notifications = useAsync<Notification[]>(() => invoke('github:notifications'))
  const pulls = useAsync<PullRequest[]>(() => invoke('github:pulls'))
  const [busy, setBusy] = useState<string | null>(null)

  if (connected.data === false) {
    return <div className="empty">Connecte ton compte GitHub depuis les Reglages pour voir tes repos, ton activite et tes PR.</div>
  }

  const clone = async (repo: Repo) => {
    setBusy(repo.fullName)
    try {
      const result = await invoke<{ path: string }>('github:clone', repo.fullName)
      notify(`Clone dans ${result.path}`)
      invoke('github:open', result.path)
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="dash">
      <section>
        <h3 style={{ fontSize: 13, letterSpacing: 1.3, color: 'var(--muted)' }}>MES DEPOTS</h3>
        {repos.error && <div className="empty">{repos.error}</div>}
        <div className="grid cols-2">
          {(repos.data ?? []).map((repo) => (
            <div key={repo.id} className="card">
              <div className="row">
                <b style={{ flex: 1 }}>{repo.name}</b>
                <span className="pill">{repo.private ? 'prive' : 'public'}</span>
              </div>
              <p className="muted" style={{ fontSize: 12, minHeight: 32 }}>{repo.description ?? 'Pas de description.'}</p>
              <div className="row" style={{ gap: 6 }}>
                <span className="pill">{repo.language ?? '—'}</span>
                <span className="pill">★ {repo.stars}</span>
                <div style={{ flex: 1 }} />
                <button className="btn small" onClick={() => invoke('shell:openExternal', repo.url)}>Ouvrir</button>
                <button className="btn small primary" onClick={() => clone(repo)}>
                  {busy === repo.fullName ? <span className="spin" /> : 'Cloner'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <aside className="side">
        <div className="card">
          <h3>Activite</h3>
          <div className="list">
            {(activity.data ?? []).slice(0, 6).map((event) => (
              <div key={event.id} className="list-item">
                <span className="icon">⚡</span>
                <div className="body"><b>{event.type} · {event.repo}</b><span>{event.message || since(new Date(event.at).getTime())}</span></div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3>Pull requests</h3>
          <div className="list">
            {(pulls.data ?? []).map((pull) => (
              <button key={pull.id} className="list-item" onClick={() => invoke('shell:openExternal', pull.url)}>
                <span className="icon">🔀</span>
                <div className="body"><b>{pull.title}</b><span>{pull.repo}</span></div>
              </button>
            ))}
            {!pulls.data?.length && <p className="muted" style={{ fontSize: 12, margin: 0 }}>Aucune PR ouverte.</p>}
          </div>
        </div>
        <div className="card">
          <h3>Notifications</h3>
          <div className="list">
            {(notifications.data ?? []).slice(0, 6).map((entry) => (
              <div key={entry.id} className="list-item">
                <span className="icon">🔔</span>
                <div className="body"><b>{entry.title}</b><span>{entry.repo} · {entry.reason}</span></div>
              </div>
            ))}
            {!notifications.data?.length && <p className="muted" style={{ fontSize: 12, margin: 0 }}>Rien a lire.</p>}
          </div>
        </div>
      </aside>
    </div>
  )
}

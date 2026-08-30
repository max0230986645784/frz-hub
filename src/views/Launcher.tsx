import { useState } from 'react'
import { invoke, since, type AppEntry } from '../lib/api'
import { useAsync } from '../lib/hooks'
import type { Toast } from '../App'

export default function Launcher({ query, notify }: { query: string; notify: Toast }) {
  const apps = useAsync<AppEntry[]>(() => invoke('apps:list'))
  const [busy, setBusy] = useState(false)

  const filtered = (apps.data ?? []).filter((app) => app.name.toLowerCase().includes(query.toLowerCase()))
  const projects = filtered.filter((app) => app.kind === 'project')
  const others = filtered.filter((app) => app.kind !== 'project')

  const guard = async (action: () => Promise<unknown>, message?: string) => {
    setBusy(true)
    try {
      await action()
      if (message) notify(message)
      apps.reload()
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const add = () =>
    guard(async () => {
      const picked = await invoke<string | null>('apps:pick')
      if (!picked) return
      const created = await invoke<AppEntry>('apps:add', { target: picked })
      notify(`${created.name} ajoute au launcher.`)
    })

  const attach = (app: AppEntry) =>
    guard(async () => {
      const picked = await invoke<string | null>('apps:pick')
      if (!picked) return
      await invoke('apps:update', { id: app.id, patch: { target: picked } })
      notify(`${app.name} pointe maintenant sur ${picked}.`)
    })

  const launch = (app: AppEntry) =>
    guard(() => invoke('apps:launch', app.id), `${app.name} est lance.`)

  const section = (title: string, list: AppEntry[]) => (
    <section style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 13, letterSpacing: 1.3, color: 'var(--muted)' }}>{title}</h3>
      {list.length === 0 ? (
        <div className="empty">Rien ici pour le moment.</div>
      ) : (
        <div className="tiles">
          {list.map((app) => (
            <div key={app.id} className="tile">
              <span className="icon">{app.icon}</span>
              <span className="name">{app.name}</span>
              <span className="meta">{app.target ? since(app.lastLaunch) : 'chemin manquant'}</span>
              <div className="row" style={{ gap: 6 }}>
                {app.target ? (
                  <button className="btn small primary" onClick={() => launch(app)}>▶ Lancer</button>
                ) : (
                  <button className="btn small" onClick={() => attach(app)}>📎 Lier</button>
                )}
                <button className="btn small" onClick={() => guard(() => invoke('apps:remove', app.id), `${app.name} retire.`)}>
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )

  return (
    <div>
      <div className="row" style={{ marginBottom: 18, gap: 10 }}>
        <button className="btn primary" onClick={add}>➕ Ajouter un programme</button>
        <button
          className="btn"
          onClick={() =>
            guard(async () => {
              const found = await invoke<AppEntry[]>('apps:scan')
              notify(`${found.length} programmes detectes.`)
            })
          }
        >
          🔍 Scanner le PC
        </button>
        {busy && <span className="spin" />}
      </div>

      {section('MES PROJETS', projects)}
      {section('MES PROGRAMMES', others)}
    </div>
  )
}

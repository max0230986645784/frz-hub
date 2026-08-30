import { useState } from 'react'
import { invoke, since, type StudioProject } from '../lib/api'
import { useAsync } from '../lib/hooks'
import type { Toast } from '../App'

const IDEAS = [
  'un site vitrine pour Velora',
  'un bot Discord de moderation',
  'une API Express pour mes scores',
  'un mini-jeu en canvas',
  'un script Python qui range mes telechargements',
  'un script de sauvegarde de mes documents',
]

export default function Studio({ notify }: { notify: Toast }) {
  const projects = useAsync<StudioProject[]>(() => invoke('studio:list'))
  const catalogue = useAsync<{ id: string; label: string }[]>(() => invoke('studio:catalogue'))
  const [request, setRequest] = useState('')
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState<StudioProject | null>(null)

  const generate = async () => {
    if (!request.trim() || busy) return
    setBusy(true)
    try {
      const project = await invoke<StudioProject>('studio:generate', request)
      setLast(project)
      setRequest('')
      notify(`${project.name} : ${project.files.length} fichiers ecrits.`)
      projects.reload()
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <section className="card">
        <h3>Demande a Velora Studio</h3>
        <div className="composer" style={{ background: 'transparent', border: 'none', padding: 0 }}>
          <textarea
            className="field"
            placeholder="Code-moi un site vitrine pour Velora avec une page contact…"
            value={request}
            onChange={(event) => setRequest(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                generate()
              }
            }}
          />
          <button className="btn primary" onClick={generate}>{busy ? <span className="spin" /> : 'Coder'}</button>
        </div>
        <div className="chips" style={{ marginTop: 12 }}>
          {IDEAS.map((idea) => (
            <button key={idea} className="chip" onClick={() => setRequest(idea)}>{idea}</button>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 11.5, marginBottom: 0 }}>
          Modeles disponibles : {(catalogue.data ?? []).map((entry) => entry.label).join(' · ')}
        </p>
      </section>

      {last && (
        <section className="card">
          <h3>Dernier projet</h3>
          <b>{last.name}</b> <span className="muted">· {last.kindLabel}</span>
          <p className="muted" style={{ fontSize: 12 }}>{last.directory}</p>
          <pre style={{ fontSize: 12, background: 'rgba(0,0,0,.3)', padding: 12, borderRadius: 12, overflowX: 'auto' }}>
            {last.files.join('\n')}
          </pre>
          <div className="row">
            <code style={{ fontSize: 12, flex: 1 }}>{last.run}</code>
            <button className="btn small" onClick={() => invoke('studio:open', last.id)}>📂 Ouvrir</button>
          </div>
        </section>
      )}

      <section>
        <h3 style={{ fontSize: 13, letterSpacing: 1.3, color: 'var(--muted)' }}>PROJETS GENERES</h3>
        {projects.data?.length ? (
          <div className="grid cols-3">
            {projects.data.map((project) => (
              <div key={project.id} className="card">
                <b>{project.name}</b>
                <div className="muted" style={{ fontSize: 11.5 }}>{project.kindLabel} · {since(project.createdAt)}</div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>{project.files.length} fichiers</div>
                <div className="row" style={{ marginTop: 10, gap: 6 }}>
                  <button className="btn small" onClick={() => invoke('studio:open', project.id)}>📂 Ouvrir</button>
                  <button
                    className="btn small danger"
                    onClick={async () => {
                      await invoke('studio:remove', project.id)
                      projects.reload()
                    }}
                  >
                    Oublier
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">Aucun projet genere pour l'instant.</div>
        )}
      </section>
    </div>
  )
}

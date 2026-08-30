import { useState, type ReactNode } from 'react'
import { invoke, bytes } from '../lib/api'
import { useAsync } from '../lib/hooks'
import type { Toast } from '../App'

type Note = { id: string; title: string; body: string; updatedAt: number }
type Clean = { files: number; bytes: number; dryRun: boolean }
type Found = { path: string; size: number }

function Tool({ title, icon, children }: { title: string; icon: string; children: ReactNode }) {
  return (
    <div className="card">
      <h3>{icon} {title}</h3>
      <div className="grid" style={{ gap: 10 }}>{children}</div>
    </div>
  )
}

export default function Tools({ notify }: { notify: Toast }) {
  const notes = useAsync<Note[]>(() => invoke('tools:notes'))
  const [pass, setPass] = useState('')
  const [clean, setClean] = useState<Clean | null>(null)
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<Found[]>([])
  const [note, setNote] = useState<Note | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const guard = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key)
    try {
      await action()
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(null)
    }
  }

  const pickAnd = (key: string, channel: string, extra: Record<string, unknown> = {}) =>
    guard(key, async () => {
      const picked = await invoke<string | null>('tools:pick', {})
      if (!picked) return
      const result = await invoke<{ output: string }>(channel, { input: picked, ...extra })
      notify(`Fichier genere : ${result.output}`)
    })

  return (
    <div className="grid cols-2" style={{ alignItems: 'start' }}>
      <Tool title="Generateur de mot de passe" icon="🔑">
        <div className="row">
          <input className="field" readOnly value={pass} placeholder="Clique sur generer" />
          <button className="btn primary" onClick={() => guard('pass', async () => setPass(await invoke<string>('tools:password', { length: 22 })))}>
            Generer
          </button>
        </div>
        <button className="btn small" disabled={!pass} onClick={() => invoke('clipboard:write', pass).then(() => notify('Copie.'))}>
          Copier
        </button>
      </Tool>

      <Tool title="Nettoyage des fichiers temporaires" icon="🧹">
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={() => guard('scan', async () => setClean(await invoke<Clean>('tools:cleanTemp', { dryRun: true })))}>
            Analyser
          </button>
          <button
            className="btn danger"
            disabled={!clean?.files}
            onClick={() => guard('clean', async () => {
              const result = await invoke<Clean>('tools:cleanTemp', { dryRun: false })
              setClean(result)
              notify(`${result.files} fichiers supprimes (${bytes(result.bytes)}).`)
            })}
          >
            Supprimer
          </button>
          {busy && <span className="spin" />}
        </div>
        {clean && (
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>
            {clean.files} fichiers · {bytes(clean.bytes)} {clean.dryRun ? 'recuperables' : 'liberes'}
          </p>
        )}
      </Tool>

      <Tool title="Convertir / decouper" icon="🎥">
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button className="btn small" onClick={() => pickAnd('mp4', 'tools:convertVideo', { format: 'mp4' })}>Video → MP4</button>
          <button className="btn small" onClick={() => pickAnd('mp3', 'tools:convertAudio', { format: 'mp3' })}>Audio → MP3</button>
          <button className="btn small" onClick={() => pickAnd('png', 'tools:convertImage', { format: 'png' })}>Image → PNG</button>
          <button className="btn small" onClick={() => pickAnd('pdf', 'tools:pdfToImages', {})}>PDF → images</button>
          <button className="btn small" onClick={() => pickAnd('cut', 'tools:cutVideo', { start: '00:00:00', end: '00:00:30' })}>Couper 30 s</button>
        </div>
        <p className="muted" style={{ fontSize: 11.5, margin: 0 }}>Necessite ffmpeg installe sur le PC.</p>
      </Tool>

      <Tool title="Compresser / extraire" icon="📦">
        <div className="row" style={{ gap: 8 }}>
          <button
            className="btn small"
            onClick={() => guard('zip', async () => {
              const picked = await invoke<string[] | null>('tools:pick', { multi: true })
              if (!picked?.length) return
              const result = await invoke<{ output: string }>('tools:compress', { inputs: picked })
              notify(`Archive : ${result.output}`)
            })}
          >
            Compresser
          </button>
          <button
            className="btn small"
            onClick={() => guard('unzip', async () => {
              const picked = await invoke<string | null>('tools:pick', {})
              if (!picked) return
              const result = await invoke<{ output: string }>('tools:extract', { input: picked })
              notify(`Extrait dans ${result.output}`)
            })}
          >
            Extraire
          </button>
        </div>
      </Tool>

      <Tool title="Recherche de fichiers" icon="📁">
        <div className="row">
          <input
            className="field"
            placeholder="facture 2024"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') guard('search', async () => setFound(await invoke<Found[]>('tools:search', { query })))
            }}
          />
          <button className="btn" onClick={() => guard('search', async () => setFound(await invoke<Found[]>('tools:search', { query })))}>
            Chercher
          </button>
        </div>
        <div className="list">
          {found.slice(0, 8).map((item) => (
            <button key={item.path} className="list-item" onClick={() => invoke('tools:reveal', item.path)}>
              <span className="icon">📄</span>
              <div className="body"><b>{item.path.split(/[\\/]/).pop()}</b><span>{item.path}</span></div>
              <span className="pill">{bytes(item.size)}</span>
            </button>
          ))}
        </div>
      </Tool>

      <Tool title="Bloc-notes" icon="📝">
        <div className="row" style={{ gap: 8 }}>
          <input
            className="field"
            placeholder="Titre"
            value={note?.title ?? ''}
            onChange={(event) => setNote({ ...(note ?? { id: '', body: '', updatedAt: 0 }), title: event.target.value } as Note)}
          />
          <button
            className="btn primary"
            onClick={() => guard('note', async () => {
              await invoke('tools:saveNote', { id: note?.id, title: note?.title, body: note?.body })
              setNote(null)
              notes.reload()
              notify('Note enregistree.')
            })}
          >
            Enregistrer
          </button>
        </div>
        <textarea
          className="field"
          rows={4}
          placeholder="Ton texte…"
          value={note?.body ?? ''}
          onChange={(event) => setNote({ ...(note ?? { id: '', title: '', updatedAt: 0 }), body: event.target.value } as Note)}
        />
        <div className="list">
          {(notes.data ?? []).map((entry) => (
            <div key={entry.id} className="list-item">
              <span className="icon">📝</span>
              <button className="body" style={{ textAlign: 'left' }} onClick={() => setNote(entry)}>
                <b>{entry.title || 'Sans titre'}</b>
                <span>{entry.body.slice(0, 48)}</span>
              </button>
              <button className="btn small danger" onClick={() => guard('del', async () => {
                await invoke('tools:deleteNote', entry.id)
                notes.reload()
              })}>✕</button>
            </div>
          ))}
        </div>
      </Tool>
    </div>
  )
}

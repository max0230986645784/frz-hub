import { useEffect, useState } from 'react'
import BrandIcon from '../components/BrandIcon'
import { invoke, onEvent, since, type Bot, type BotLog } from '../lib/api'
import { useAsync } from '../lib/hooks'
import type { Toast } from '../App'

export default function Bots({ notify }: { notify: Toast }) {
  const bots = useAsync<Bot[]>(() => invoke('bots:list'))
  const reload = bots.reload
  const [request, setRequest] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [logs, setLogs] = useState<BotLog[]>([])
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => onEvent<Bot>('bots:status', () => reload()), [reload])

  useEffect(
    () =>
      onEvent<BotLog>('bots:log', (log) => {
        setLogs((current) => (log.id === selected ? [...current, log].slice(-300) : current))
      }),
    [selected],
  )

  useEffect(() => {
    if (!selected) return
    invoke<BotLog[]>('bots:logs', selected).then(setLogs).catch(() => setLogs([]))
  }, [selected])

  const act = async (key: string, action: () => Promise<unknown>, message?: string) => {
    setBusy(key)
    try {
      await action()
      await reload()
      if (message) notify(message)
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(null)
    }
  }

  const create = () =>
    act(
      'create',
      async () => {
        const bot = await invoke<Bot>('bots:create', request)
        setRequest('')
        setSelected(bot.id)
      },
      'Bot genere : installe les dependances puis colle son token.',
    )

  const adopt = () =>
    act('adopt', async () => {
      const directory = await invoke<string | null>('tools:pick', { directory: true })
      if (!directory) return
      await invoke<Bot>('bots:adopt', directory)
    }, 'Bot importe.')

  const current = bots.data?.find((bot) => bot.id === selected) ?? null

  return (
    <div className="grid" style={{ gap: 16 }}>
      <section className="card">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BrandIcon brand="discord" /> Nouveau bot Discord
        </h3>
        <p className="muted" style={{ marginTop: 0, fontSize: 12.5 }}>
          Velora IA ecrit le bot, l'heberge lui-meme et le relance s'il crashe. Aucun serveur externe.
        </p>
        <div className="row">
          <input
            className="field"
            value={request}
            placeholder="ex : un bot de moderation avec une commande !ping"
            onChange={(event) => setRequest(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') create()
            }}
          />
          <button className="btn primary" onClick={create}>
            {busy === 'create' ? <span className="spin" /> : 'Generer'}
          </button>
          <button className="btn" onClick={adopt}>Importer un dossier</button>
        </div>
      </section>

      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <section className="card">
          <h3>Mes bots</h3>
          {!bots.data?.length && <p className="muted" style={{ fontSize: 13 }}>Aucun bot pour l'instant.</p>}
          <div className="list">
            {bots.data?.map((bot) => (
              <button
                key={bot.id}
                className="list-item"
                style={selected === bot.id ? { borderColor: 'var(--violet)' } : undefined}
                onClick={() => setSelected(bot.id)}
              >
                <span className="icon">{bot.status === 'running' ? '🟢' : '⚪'}</span>
                <div className="body" style={{ textAlign: 'left' }}>
                  <b>{bot.name}</b>
                  <span>
                    {bot.status === 'running' ? `en ligne depuis ${since(bot.startedAt ?? 0)}` : 'arrete'}
                    {bot.hasToken ? '' : ' · token manquant'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {current && (
          <section className="card">
            <h3>{current.name}</h3>
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>
              {current.directory} · {current.entry} · {current.runtime}
            </p>

            <div className="row" style={{ marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
              {current.status === 'running' ? (
                <button className="btn" onClick={() => act('stop', () => invoke('bots:stop', current.id))}>Arreter</button>
              ) : (
                <button className="btn primary" onClick={() => act('start', () => invoke('bots:start', current.id))}>Demarrer</button>
              )}
              <button className="btn" onClick={() => act('restart', () => invoke('bots:restart', current.id))}>Redemarrer</button>
              <button className="btn" onClick={() => act('install', () => invoke('bots:install', current.id), 'Dependances installees.')}>
                {busy === 'install' ? <span className="spin" /> : 'Installer les dependances'}
              </button>
              <button className="btn" onClick={() => act('open', () => invoke('bots:open', current.id))}>Ouvrir le dossier</button>
              <button
                className="btn danger"
                onClick={() =>
                  act('remove', async () => {
                    await invoke('bots:remove', current.id)
                    setSelected(null)
                  }, 'Bot retire de Velora.')
                }
              >
                Retirer
              </button>
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              <input
                className="field"
                type="password"
                value={token}
                placeholder="Token du bot Discord (chiffre)"
                onChange={(event) => setToken(event.target.value)}
              />
              <button
                className="btn"
                onClick={() =>
                  act('token', async () => {
                    await invoke('bots:token', { id: current.id, token })
                    setToken('')
                  }, 'Token enregistre.')
                }
              >
                Enregistrer
              </button>
            </div>

            <div className="row" style={{ marginTop: 10, gap: 16 }}>
              <label className="row" style={{ gap: 6, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={current.autostart}
                  onChange={(event) =>
                    act('autostart', () =>
                      invoke('bots:configure', { id: current.id, patch: { autostart: event.target.checked } }),
                    )
                  }
                />
                Demarrer avec Velora
              </label>
              <label className="row" style={{ gap: 6, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={current.restartOnCrash}
                  onChange={(event) =>
                    act('restartOnCrash', () =>
                      invoke('bots:configure', { id: current.id, patch: { restartOnCrash: event.target.checked } }),
                    )
                  }
                />
                Relancer apres un crash
              </label>
            </div>

            <div className="logs">
              {logs.length === 0 && <span className="muted">Pas encore de logs.</span>}
              {logs.map((log, index) => (
                <div key={`${log.at}-${index}`} className={log.stream === 'err' ? 'log err' : 'log'}>
                  {log.line}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

import { invoke, bytes, playtime, since, type AppEntry, type GameEntry, type LaunchHistory, type NetworkStatus, type Snapshot, type Weather } from '../lib/api'
import { useAsync, useClock } from '../lib/hooks'
import type { Toast, ViewId } from '../App'

function Gauge({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="stat">
      <div className="row">
        <span className="muted" style={{ fontSize: 12, flex: 1 }}>{label}</span>
        <span className="muted" style={{ fontSize: 12 }}>{detail}</span>
      </div>
      <div className="value">{value} %</div>
      <div className={`bar${value >= 85 ? ' warn' : ''}`}><span style={{ width: `${Math.min(100, value)}%` }} /></div>
    </div>
  )
}

export default function Dashboard({ go, notify }: { go: (view: ViewId) => void; notify: Toast }) {
  const now = useClock()
  const system = useAsync<Snapshot>(() => invoke('system:snapshot'), [], { interval: 3000 })
  const weather = useAsync<Weather>(() => invoke('weather:current'), [], { interval: 900_000 })
  const network = useAsync<NetworkStatus>(() => invoke('network:status'), [], { interval: 60_000 })
  const apps = useAsync<AppEntry[]>(() => invoke('apps:list'))
  const games = useAsync<GameEntry[]>(() => invoke('games:list'))
  const recent = useAsync<LaunchHistory[]>(() => invoke('apps:recent'))

  const snapshot = system.data
  const gpu = snapshot?.gpus?.[0]
  const disk = snapshot?.disks?.[0]

  const launch = async (id: string, kind: string) => {
    try {
      const result = await invoke<{ name: string }>(kind === 'game' ? 'games:launch' : 'apps:launch', id)
      notify(`${result.name} est lance.`)
      recent.reload()
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <div className="dash">
      <div className="grid" style={{ gap: 18 }}>
        <section className="hero">
          <div className="clock">{now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
          <div className="date">
            {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            {weather.data && ` · ${weather.data.icon} ${weather.data.temperature}° ${weather.data.city}`}
          </div>
          <div className="hero-actions">
            <button className="btn primary" onClick={() => go('ai')}>🧠 Parler a Velora AI</button>
            <button className="btn" onClick={() => go('games')}>🎮 Game Center</button>
            <button className="btn" onClick={() => go('media')}>🎬 Media</button>
          </div>
        </section>

        <div className="grid cols-3">
          <div className="card">
            <h3>Processeur</h3>
            <Gauge label={snapshot?.cpu.model.slice(0, 26) ?? 'CPU'} value={snapshot?.cpu.total ?? 0} detail={`${snapshot?.cpu.cores ?? 0} cœurs`} />
          </div>
          <div className="card">
            <h3>Memoire</h3>
            <Gauge
              label="RAM"
              value={snapshot?.memory.percent ?? 0}
              detail={snapshot ? `${bytes(snapshot.memory.used)} / ${bytes(snapshot.memory.total)}` : '—'}
            />
          </div>
          <div className="card">
            <h3>{gpu ? 'Carte graphique' : 'Stockage'}</h3>
            {gpu ? (
              <Gauge label={gpu.name.slice(0, 26)} value={gpu.usage ?? 0} detail={gpu.temperature ? `${gpu.temperature} °C` : '—'} />
            ) : (
              <Gauge label={disk?.mount ?? 'Disque'} value={disk?.percent ?? 0} detail={disk ? `${bytes(disk.free)} libres` : '—'} />
            )}
          </div>
        </div>

        <section>
          <h3 style={{ margin: '4px 0 12px', fontSize: 13, letterSpacing: 1.3, color: 'var(--muted)' }}>
            TES APPLICATIONS
          </h3>
          <div className="tiles">
            {(apps.data ?? []).slice(0, 10).map((app) => (
              <button key={app.id} className="tile" onClick={() => launch(app.id, 'app')}>
                <span className="icon">{app.icon}</span>
                <span className="name">{app.name}</span>
                <span className="meta">{app.target ? since(app.lastLaunch) : 'chemin a definir'}</span>
              </button>
            ))}
            <button className="tile" onClick={() => go('launcher')}>
              <span className="icon">➕</span>
              <span className="name">Ajouter</span>
              <span className="meta">.exe .bat .py …</span>
            </button>
          </div>
        </section>
      </div>

      <aside className="side">
        <div className="card">
          <h3>Internet</h3>
          <div className="list">
            <div className="list-item">
              <span className="icon">🌐</span>
              <div className="body">
                <b>{network.data?.online ? 'Connecte' : 'Hors ligne'}</b>
                <span>{network.data?.publicIp ?? '—'}</span>
              </div>
              <span className={`pill ${network.data?.online ? 'on' : 'off'}`}>
                {network.data?.ping != null ? `${network.data.ping} ms` : '—'}
              </span>
            </div>
            <button className="btn small" onClick={() => go('network')}>Voir le reseau</button>
          </div>
        </div>

        <div className="card">
          <h3>Meteo</h3>
          {weather.data ? (
            <>
              <div className="row">
                <span style={{ fontSize: 34 }}>{weather.data.icon}</span>
                <div style={{ flex: 1 }}>
                  <b style={{ fontSize: 22 }}>{weather.data.temperature}°</b>
                  <div className="muted" style={{ fontSize: 12 }}>{weather.data.label} · ressenti {weather.data.feelsLike}°</div>
                </div>
              </div>
              <div className="row" style={{ marginTop: 12, gap: 14 }}>
                {weather.data.days.slice(0, 3).map((day) => (
                  <div key={day.date} style={{ fontSize: 12 }} className="muted">
                    {new Date(day.date).toLocaleDateString('fr-FR', { weekday: 'short' })} {day.icon} {day.max}°
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>{weather.error ?? 'Chargement…'}</p>
          )}
        </div>

        <div className="card">
          <h3>Lances recemment</h3>
          <div className="list">
            {(recent.data ?? []).slice(0, 5).map((item) => (
              <button key={`${item.id}-${item.at}`} className="list-item" onClick={() => launch(item.id, item.kind)}>
                <span className="icon">{item.icon || (item.kind === 'game' ? '🎮' : '🚀')}</span>
                <div className="body">
                  <b>{item.name}</b>
                  <span>{since(item.at)}</span>
                </div>
                <span className="pill">▶</span>
              </button>
            ))}
            {!recent.data?.length && <p className="muted" style={{ fontSize: 12, margin: 0 }}>Rien encore lance.</p>}
          </div>
        </div>

        <div className="card">
          <h3>Jeux favoris</h3>
          <div className="list">
            {(games.data ?? []).filter((game) => game.favorite).slice(0, 4).map((game) => (
              <button key={game.id} className="list-item" onClick={() => launch(game.id, 'game')}>
                <span className="icon">{game.icon || '🎮'}</span>
                <div className="body">
                  <b>{game.name}</b>
                  <span>{playtime(game.playtime)}</span>
                </div>
                <span className="pill">▶</span>
              </button>
            ))}
            {!(games.data ?? []).some((game) => game.favorite) && (
              <button className="btn small" onClick={() => go('games')}>Scanner mes jeux</button>
            )}
          </div>
        </div>
      </aside>
    </div>
  )
}

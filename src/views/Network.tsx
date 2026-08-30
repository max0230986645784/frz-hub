import { useState } from 'react'
import { invoke, since, type NetworkStatus } from '../lib/api'
import { useAsync } from '../lib/hooks'
import type { Toast } from '../App'

type Device = { id: string; name: string; address: string; mac: string | null; icon: string; self?: boolean; online: boolean; lastSeen: number | null }
type Speed = { download: number | null; upload: number | null; ping: number | null }

export default function Network({ notify }: { notify: Toast }) {
  const status = useAsync<NetworkStatus>(() => invoke('network:status'), [], { interval: 30_000 })
  const devices = useAsync<Device[]>(() => invoke('network:devices', { deep: true }))
  const [speed, setSpeed] = useState<Speed | null>(null)
  const [busy, setBusy] = useState(false)

  const speedtest = async () => {
    setBusy(true)
    try {
      setSpeed(await invoke<Speed>('network:speedtest'))
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <section className="grid cols-4">
        <div className="card">
          <h3>Internet</h3>
          <b style={{ fontSize: 22 }}>{status.data?.online ? 'En ligne' : 'Hors ligne'}</b>
          <div className="muted" style={{ fontSize: 12 }}>{status.data?.publicIp ?? '—'}</div>
        </div>
        <div className="card">
          <h3>Ping</h3>
          <b style={{ fontSize: 22 }}>{status.data?.ping != null ? `${status.data.ping} ms` : '—'}</b>
          <div className="muted" style={{ fontSize: 12 }}>passerelle {status.data?.gateway ?? '—'}</div>
        </div>
        <div className="card">
          <h3>Download</h3>
          <b style={{ fontSize: 22 }}>{speed?.download != null ? `${speed.download} Mb/s` : '—'}</b>
          <div className="muted" style={{ fontSize: 12 }}>Cloudflare</div>
        </div>
        <div className="card">
          <h3>Upload</h3>
          <b style={{ fontSize: 22 }}>{speed?.upload != null ? `${speed.upload} Mb/s` : '—'}</b>
          <button className="btn small" style={{ marginTop: 8 }} onClick={speedtest} disabled={busy}>
            {busy ? <span className="spin" /> : 'Lancer un test'}
          </button>
        </div>
      </section>

      <section className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0, flex: 1 }}>Appareils du reseau local</h3>
          <button className="btn small" onClick={() => devices.reload()}>↻ Scanner</button>
        </div>
        {devices.loading && <span className="spin" />}
        <div className="list">
          {(devices.data ?? []).map((device) => (
            <div key={device.id} className="list-item">
              <span className="icon">{device.icon}</span>
              <div className="body">
                <b>{device.name}{device.self ? ' (ce PC)' : ''}</b>
                <span>{device.address}{device.mac ? ` · ${device.mac}` : ''} · {since(device.lastSeen)}</span>
              </div>
              <span className={`pill ${device.online ? 'on' : 'off'}`}>{device.online ? 'ONLINE' : 'OFFLINE'}</span>
            </div>
          ))}
          {!devices.loading && !devices.data?.length && <div className="empty">Aucun appareil detecte.</div>}
        </div>
      </section>
    </div>
  )
}

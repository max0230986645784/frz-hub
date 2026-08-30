import { useEffect, useState } from 'react'
import { avatarUrl, invoke, type Account } from '../lib/api'
import { useAsync } from '../lib/hooks'
import type { Toast } from '../App'

type Settings = {
  userName: string
  githubClientId?: string
  discordClientId?: string
  studioPath?: string
  weather: { city: string; latitude: number; longitude: number }
}

type City = { city: string; country: string; latitude: number; longitude: number }

export default function Settings({
  account,
  onAccount,
  notify,
}: {
  account: Account
  onAccount: (account: Account | null) => void
  notify: Toast
}) {
  const stored = useAsync<Settings>(() => invoke('settings:get'))
  const laws = useAsync<string[]>(() => invoke('brain:laws'))
  const learned = useAsync<{ phrase: string; command: string }[]>(() => invoke('brain:learned'))
  const [draft, setDraft] = useState<Settings | null>(null)
  const [city, setCity] = useState('')
  const [cities, setCities] = useState<City[]>([])
  const [token, setToken] = useState('')

  useEffect(() => {
    if (stored.data) setDraft(stored.data)
  }, [stored.data])

  const patch = async (next: Partial<Settings>) => {
    setDraft((current) => (current ? { ...current, ...next } : current))
    await invoke('settings:set', next)
  }

  const searchCity = async () => {
    try {
      setCities(await invoke<City[]>('weather:search', city))
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <div className="grid cols-2" style={{ alignItems: 'start' }}>
      <section className="card">
        <h3>Compte</h3>
        <div className="row">
          {account.avatar ? (
            <img src={avatarUrl(account.avatar)} alt="" style={{ width: 44, height: 44, borderRadius: 14, objectFit: 'cover' }} />
          ) : (
            <span className="icon" style={{ width: 44, height: 44 }}>👤</span>
          )}
          <div style={{ flex: 1 }}>
            <b>{account.name}</b>
            <div className="muted" style={{ fontSize: 12 }}>connecte via {account.provider}</div>
          </div>
          <button
            className="btn small"
            onClick={async () => {
              try {
                const next = await invoke<Account | null>('account:pickAvatar')
                if (!next) return
                onAccount(next)
                notify('Photo de profil mise a jour.')
              } catch (error) {
                notify(error instanceof Error ? error.message : String(error))
              }
            }}
          >
            Changer la photo
          </button>
          <button
            className="btn small danger"
            onClick={async () => {
              await invoke('account:logout')
              onAccount(null)
            }}
          >
            Deconnexion
          </button>
        </div>
      </section>

      <section className="card">
        <h3>Integrations</h3>
        <label className="muted" style={{ fontSize: 12 }}>Client ID GitHub (OAuth App, device flow active)</label>
        <input
          className="field"
          value={draft?.githubClientId ?? ''}
          onChange={(event) => patch({ githubClientId: event.target.value })}
          placeholder="Iv1.xxxxxxxxxxxx"
        />
        <label className="muted" style={{ fontSize: 12, marginTop: 10, display: 'block' }}>Client ID Discord</label>
        <input
          className="field"
          value={draft?.discordClientId ?? ''}
          onChange={(event) => patch({ discordClientId: event.target.value })}
          placeholder="123456789012345678"
        />
        <label className="muted" style={{ fontSize: 12, marginTop: 10, display: 'block' }}>Ou colle un token GitHub</label>
        <div className="row">
          <input className="field" type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="ghp_…" />
          <button
            className="btn"
            onClick={async () => {
              try {
                const next = await invoke<Account>('github:token', token)
                setToken('')
                onAccount(next)
                notify('GitHub connecte.')
              } catch (error) {
                notify(error instanceof Error ? error.message : String(error))
              }
            }}
          >
            Connecter
          </button>
        </div>
      </section>

      <section className="card">
        <h3>Meteo</h3>
        <div className="row">
          <input className="field" value={city} placeholder={draft?.weather.city} onChange={(event) => setCity(event.target.value)} />
          <button className="btn" onClick={searchCity}>Chercher</button>
        </div>
        <div className="list" style={{ marginTop: 10 }}>
          {cities.slice(0, 5).map((entry) => (
            <button
              key={`${entry.city}-${entry.latitude}`}
              className="list-item"
              onClick={() => {
                patch({ weather: { city: entry.city, latitude: entry.latitude, longitude: entry.longitude } })
                setCities([])
                notify(`Meteo reglee sur ${entry.city}.`)
              }}
            >
              <span className="icon">📍</span>
              <div className="body"><b>{entry.city}</b><span>{entry.country}</span></div>
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>Les regles de Velora AI</h3>
        <ul className="muted" style={{ fontSize: 12.5, paddingLeft: 18, margin: 0, lineHeight: 1.7 }}>
          {(laws.data ?? []).map((law) => <li key={law}>{law}</li>)}
        </ul>
        {!!learned.data?.length && (
          <>
            <h3 style={{ marginTop: 16 }}>Commandes apprises</h3>
            <div className="list">
              {learned.data.map((entry) => (
                <div key={entry.phrase} className="list-item">
                  <span className="icon">🧠</span>
                  <div className="body"><b>{entry.phrase}</b><span>{entry.command}</span></div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

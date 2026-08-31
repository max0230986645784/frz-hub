import { useEffect, useState } from 'react'
import logo from '../assets/logo.png'
import BrandIcon from '../components/BrandIcon'
import { invoke, type Account } from '../lib/api'
import type { Toast } from '../App'

type DeviceCode = {
  userCode: string
  verificationUri: string
  qr: string
  deviceCode: string
  interval: number
  expiresIn: number
}
type QrStatus = 'new' | 'scanned' | 'confirmed' | 'expired' | 'utilised'
type QrProvider = 'tiktok' | 'discord'
type QrCode = { status: QrStatus; image: string; url: string; provider: QrProvider; redirectUri?: string }

const QR_LABELS: Record<QrStatus, string> = {
  new: 'Scanne ce QR code avec ton telephone.',
  scanned: 'QR scanne : approuve la connexion sur ton telephone.',
  confirmed: 'Connexion approuvee.',
  expired: 'QR code expire, regenere-le.',
  utilised: 'QR code deja utilise, regenere-le.',
}

type Provider = 'github' | 'discord' | 'tiktok'
type Providers = Record<Provider, boolean>

/** Each provider needs its own app credentials: without them the buttons cannot do anything. */
const SETUP: Record<Provider, { label: string; portal: string; steps: string; secret: boolean }> = {
  github: {
    label: 'Client ID GitHub',
    portal: 'https://github.com/settings/developers',
    steps: "New OAuth App > coche 'Enable Device Flow' > copie le Client ID",
    secret: false,
  },
  discord: {
    label: 'Client ID Discord',
    portal: 'https://discord.com/developers/applications',
    steps: 'New Application > OAuth2 > copie le Client ID',
    secret: false,
  },
  tiktok: {
    label: 'Client Key TikTok',
    portal: 'https://developers.tiktok.com/apps',
    steps: 'Manage apps > ajoute le produit Login Kit > copie le Client Key et le Client Secret',
    secret: true,
  },
}

const QR_HINTS: Record<QrProvider, string> = {
  tiktok: "Scanne avec l'app TikTok, puis approuve la connexion.",
  discord: 'Scanne avec l\u2019appareil photo : Discord s\u2019ouvre sur ton telephone, tu approuves, Velora te connecte (meme Wi-Fi).',
}

export default function Login({ onLogin, notify }: { onLogin: (account: Account) => void; notify: Toast }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [device, setDevice] = useState<DeviceCode | null>(null)
  const [qr, setQr] = useState<QrCode | null>(null)
  const [qrStatus, setQrStatus] = useState<QrStatus>('new')
  const [providers, setProviders] = useState<Providers | null>(null)
  const [setup, setSetup] = useState<Provider | null>(null)
  const [key, setKey] = useState('')
  const [secret, setSecret] = useState('')

  useEffect(() => {
    invoke<Providers>('auth:providers').then(setProviders).catch(() => setProviders(null))
  }, [])

  /** Saves the app credentials, then lets the user press the provider button again. */
  const saveSetup = async (provider: Provider) => {
    try {
      if (provider === 'tiktok') {
        await invoke('tiktok:configure', { clientKey: key.trim(), clientSecret: secret.trim() })
      } else {
        await invoke('settings:set', provider === 'github' ? { githubClientId: key.trim() } : { discordClientId: key.trim() })
      }
      setKey('')
      setSecret('')
      setSetup(null)
      setProviders(await invoke<Providers>('auth:providers'))
      notify('Enregistre : reclique sur le bouton pour te connecter.')
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error))
    }
  }

  const guard = async (key: string, action: () => Promise<Account | null>) => {
    setBusy(key)
    try {
      const account = await action()
      if (account) onLogin(account)
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(null)
    }
  }

  const github = () => {
    if (providers && !providers.github) return setSetup('github')
    return guard('github', async () => {
      const code = await invoke<DeviceCode>('github:deviceStart')
      setDevice(code)
      return invoke<Account>('github:devicePoll', code)
    })
  }

  const startQr = (provider: QrProvider) => async () => {
    if (providers && !providers[provider]) {
      setSetup(provider)
      return
    }
    setBusy(provider)
    try {
      const code = await invoke<QrCode>(provider === 'tiktok' ? 'tiktok:start' : 'discord:qrStart')
      setQr({ ...code, provider })
      setQrStatus('new')
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(null)
    }
  }

  const tiktok = startQr('tiktok')
  const discordQr = startQr('discord')

  /** The phone approves out of band, so the desktop only learns about it by polling. */
  useEffect(() => {
    if (!qr || qrStatus === 'expired' || qrStatus === 'confirmed') return
    const channel = qr.provider === 'tiktok' ? 'tiktok:poll' : 'discord:qrPoll'
    const timer = setInterval(async () => {
      try {
        const next = await invoke<{ status: QrStatus; account?: Account | null }>(channel)
        setQrStatus(next.status)
        if (next.account) onLogin(next.account)
      } catch (error) {
        setQr(null)
        notify(error instanceof Error ? error.message : String(error))
      }
    }, 3000)
    return () => clearInterval(timer)
  }, [qr, qrStatus, notify, onLogin])

  return (
    <div className="login">
      <div className="box">
        <div className="mark"><img src={logo} alt="Velora OS" /></div>
        <div>
          <h2 style={{ margin: 0 }}>Velora OS</h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>Your digital space</p>
        </div>

        <input
          className="field"
          placeholder="Ton pseudo (compte local)"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') guard('local', () => invoke<Account>('account:local', { name }))
          }}
        />
        <button className="btn primary" onClick={() => guard('local', () => invoke<Account>('account:local', { name }))}>
          {busy === 'local' ? <span className="spin" /> : 'Entrer avec un compte local'}
        </button>

        <div className="row" style={{ gap: 10 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--stroke)' }} />
          <span className="muted" style={{ fontSize: 12 }}>ou</span>
          <div style={{ flex: 1, height: 1, background: 'var(--stroke)' }} />
        </div>

        <button className="btn" onClick={github}>
          {busy === 'github' ? <span className="spin" /> : <><BrandIcon brand="github" /> Continuer avec GitHub (QR code)</>}
        </button>
        <button className="btn" onClick={discordQr}>
          {busy === 'discord' ? <span className="spin" /> : <><BrandIcon brand="discord" /> Continuer avec Discord (QR code)</>}
        </button>
        <button className="btn" onClick={tiktok}>
          {busy === 'tiktok' ? <span className="spin" /> : <><BrandIcon brand="tiktok" /> Continuer avec TikTok (QR code)</>}
        </button>
        <button
          className="btn small"
          onClick={() => {
            if (providers && !providers.discord) return setSetup('discord')
            return guard('discord-browser', () => invoke<Account>('account:discord'))
          }}
        >
          {busy === 'discord-browser' ? <span className="spin" /> : 'Discord sur ce PC (sans QR code)'}
        </button>

        {setup && (
          <div className="card" style={{ padding: 14, display: 'grid', gap: 8 }}>
            <b style={{ fontSize: 13 }}>Il manque le {SETUP[setup].label}</b>
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>{SETUP[setup].steps}</p>
            <button className="btn small" onClick={() => invoke('shell:openExternal', SETUP[setup].portal)}>
              Ouvrir le portail {setup}
            </button>
            <input
              className="field"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              placeholder={SETUP[setup].label}
            />
            {SETUP[setup].secret && (
              <input
                className="field"
                type="password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                placeholder="Client Secret (stocke chiffre)"
              />
            )}
            <div className="row" style={{ gap: 8 }}>
              <button className="btn primary small" onClick={() => saveSetup(setup)}>Enregistrer</button>
              <button className="btn small" onClick={() => setSetup(null)}>Annuler</button>
            </div>
          </div>
        )}

        {qr && (
          <div className="card" style={{ padding: 14, display: 'grid', gap: 10, justifyItems: 'center' }}>
            <img src={qr.image} alt={`QR code ${qr.provider}`} style={{ width: 200, height: 200, borderRadius: 12 }} />
            <p className="muted" style={{ margin: 0, fontSize: 12.5, textAlign: 'center' }}>
              {qrStatus === 'new' ? QR_HINTS[qr.provider] : QR_LABELS[qrStatus]}
            </p>
            {qr.redirectUri && (
              <p className="muted" style={{ margin: 0, fontSize: 11.5, textAlign: 'center' }}>
                A ajouter une fois dans les redirects de ton app Discord : <b>{qr.redirectUri}</b>
              </p>
            )}
            <div className="row" style={{ gap: 8 }}>
              <button className="btn small" onClick={startQr(qr.provider)}>Regenerer</button>
              <button className="btn small" onClick={() => setQr(null)}>Annuler</button>
            </div>
          </div>
        )}

        {device && (
          <div className="card" style={{ padding: 14, display: 'grid', gap: 10, justifyItems: 'center' }}>
            <img src={device.qr} alt="QR code GitHub" style={{ width: 200, height: 200, borderRadius: 12 }} />
            <p className="muted" style={{ margin: 0, fontSize: 12.5, textAlign: 'center' }}>
              Scanne le QR code, ou tape ce code sur <b>{device.verificationUri}</b> :
            </p>
            <p style={{ fontSize: 26, letterSpacing: 4, margin: 0, fontWeight: 700 }}>{device.userCode}</p>
          </div>
        )}

        <p className="muted" style={{ fontSize: 11.5, margin: 0 }}>
          Aucun mot de passe n'est stocke : les jetons OAuth sont chiffres par Windows.
        </p>
      </div>
    </div>
  )
}

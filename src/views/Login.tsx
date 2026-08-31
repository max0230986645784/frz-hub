import { useEffect, useState } from 'react'
import logo from '../assets/logo.png'
import BrandIcon from '../components/BrandIcon'
import { invoke, type Account } from '../lib/api'
import type { Toast } from '../App'

type DeviceCode = { userCode: string; verificationUri: string; deviceCode: string; interval: number; expiresIn: number }
type QrStatus = 'new' | 'scanned' | 'confirmed' | 'expired' | 'utilised'
type QrCode = { status: QrStatus; image: string; url: string }

const QR_LABELS: Record<QrStatus, string> = {
  new: "Scanne ce QR code avec l'app TikTok.",
  scanned: 'QR scanne : approuve la connexion sur ton telephone.',
  confirmed: 'Connexion approuvee.',
  expired: 'QR code expire, regenere-le.',
  utilised: 'QR code deja utilise, regenere-le.',
}

export default function Login({ onLogin, notify }: { onLogin: (account: Account) => void; notify: Toast }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [device, setDevice] = useState<DeviceCode | null>(null)
  const [qr, setQr] = useState<QrCode | null>(null)
  const [qrStatus, setQrStatus] = useState<QrStatus>('new')

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

  const github = () =>
    guard('github', async () => {
      const code = await invoke<DeviceCode>('github:deviceStart')
      setDevice(code)
      return invoke<Account>('github:devicePoll', code)
    })

  const tiktok = async () => {
    setBusy('tiktok')
    try {
      const code = await invoke<QrCode>('tiktok:start')
      setQr(code)
      setQrStatus('new')
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(null)
    }
  }

  /** TikTok only tells us the QR was scanned and approved through polling. */
  useEffect(() => {
    if (!qr || qrStatus === 'expired' || qrStatus === 'confirmed') return
    const timer = setInterval(async () => {
      try {
        const next = await invoke<{ status: QrStatus; account?: Account }>('tiktok:poll')
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
          {busy === 'github' ? <span className="spin" /> : <><BrandIcon brand="github" /> Continuer avec GitHub</>}
        </button>
        <button className="btn" onClick={() => guard('discord', () => invoke<Account>('account:discord'))}>
          {busy === 'discord' ? <span className="spin" /> : <><BrandIcon brand="discord" /> Continuer avec Discord</>}
        </button>
        <button className="btn" onClick={tiktok}>
          {busy === 'tiktok' ? <span className="spin" /> : <><BrandIcon brand="tiktok" /> Continuer avec TikTok (QR code)</>}
        </button>

        {qr && (
          <div className="card" style={{ padding: 14, display: 'grid', gap: 10, justifyItems: 'center' }}>
            <img src={qr.image} alt="QR code TikTok" style={{ width: 200, height: 200, borderRadius: 12 }} />
            <p className="muted" style={{ margin: 0, fontSize: 12.5, textAlign: 'center' }}>{QR_LABELS[qrStatus]}</p>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn small" onClick={tiktok}>Regenerer</button>
              <button className="btn small" onClick={() => setQr(null)}>Annuler</button>
            </div>
          </div>
        )}

        {device && (
          <div className="card" style={{ padding: 14 }}>
            <p style={{ margin: 0, fontSize: 13 }}>
              Tape ce code sur <b>{device.verificationUri}</b> :
            </p>
            <p style={{ fontSize: 26, letterSpacing: 4, margin: '8px 0 0', fontWeight: 700 }}>{device.userCode}</p>
          </div>
        )}

        <p className="muted" style={{ fontSize: 11.5, margin: 0 }}>
          Aucun mot de passe n'est stocke : les jetons OAuth sont chiffres par Windows.
        </p>
      </div>
    </div>
  )
}

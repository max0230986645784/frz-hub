import { useCallback, useEffect, useMemo, useState } from 'react'
import logo from './assets/logo.png'
import { invoke, windowControls, type Account } from './lib/api'
import Dashboard from './views/Dashboard'
import Launcher from './views/Launcher'
import Assistant from './views/Assistant'
import Games from './views/Games'
import Media from './views/Media'
import Studio from './views/Studio'
import Tools from './views/Tools'
import Network from './views/Network'
import Github from './views/Github'
import Settings from './views/Settings'
import Login from './views/Login'

export type ViewId =
  | 'dashboard'
  | 'launcher'
  | 'ai'
  | 'games'
  | 'media'
  | 'studio'
  | 'tools'
  | 'network'
  | 'github'
  | 'settings'

type NavEntry = { id: ViewId; icon: string; title: string; subtitle: string }

const NAV: NavEntry[] = [
  { id: 'dashboard', icon: '🏠', title: 'Velora OS', subtitle: 'Your digital space' },
  { id: 'launcher', icon: '🚀', title: 'Launcher', subtitle: 'Tes projets et tes programmes' },
  { id: 'ai', icon: '🧠', title: 'Velora AI', subtitle: 'Le cerveau local de ton PC' },
  { id: 'games', icon: '🎮', title: 'Game Center', subtitle: 'Bibliotheque, temps de jeu, favoris' },
  { id: 'media', icon: '🎬', title: 'Media Center', subtitle: 'Films, series et musique locale' },
  { id: 'studio', icon: '🧩', title: 'Velora Studio', subtitle: "L'agence qui code tes projets" },
  { id: 'tools', icon: '🛠️', title: 'Tools', subtitle: 'La boite a outils du PC' },
  { id: 'network', icon: '🌐', title: 'Network', subtitle: 'Ton reseau local en direct' },
  { id: 'github', icon: '🐙', title: 'GitHub', subtitle: 'Repos, activite, pull requests' },
  { id: 'settings', icon: '⚙️', title: 'Reglages', subtitle: 'Compte, dossiers, integrations' },
]

export type Toast = (message: string) => void

export default function App() {
  const [view, setView] = useState<ViewId>('dashboard')
  const [account, setAccount] = useState<Account | null>(null)
  const [ready, setReady] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    invoke<Account | null>('account:current')
      .then(setAccount)
      .catch(() => setAccount(null))
      .finally(() => setReady(true))
  }, [])

  const notify: Toast = useCallback((message: string) => {
    setToast(message)
    setTimeout(() => setToast((current) => (current === message ? null : current)), 4200)
  }, [])

  const entry = useMemo(() => NAV.find((item) => item.id === view) ?? NAV[0], [view])

  const go = useCallback((next: ViewId) => {
    setView(next)
    setQuery('')
  }, [])

  const chrome = (
    <div className="titlebar">
      <button onClick={() => windowControls.minimize()} title="Reduire">─</button>
      <button onClick={() => windowControls.maximize()} title="Agrandir">▢</button>
      <button className="close" onClick={() => windowControls.close()} title="Fermer">✕</button>
    </div>
  )

  if (!ready) return <div className="login">{chrome}<div className="spin" /></div>

  if (!account) {
    return (
      <>
        {chrome}
        <Login onLogin={setAccount} notify={notify} />
      </>
    )
  }

  return (
    <div className="shell">
      {chrome}
      <nav className="rail">
        <div className="logo" title="Velora OS">
          <img src={logo} alt="Velora OS" />
        </div>
        {NAV.slice(0, -1).map((item) => (
          <button
            key={item.id}
            className={`rail-btn${view === item.id ? ' active' : ''}`}
            title={item.title}
            onClick={() => go(item.id)}
          >
            {item.icon}
          </button>
        ))}
        <div className="spacer" />
        <button
          className={`rail-btn${view === 'settings' ? ' active' : ''}`}
          title="Reglages"
          onClick={() => go('settings')}
        >
          ⚙️
        </button>
      </nav>

      <div className="main">
        <header className="topbar">
          <div>
            <h1>{entry.title}</h1>
            <p className="sub">{entry.subtitle}</p>
          </div>
          <div className="grow" />
          <label className="search">
            <span>🔎</span>
            <input
              value={query}
              placeholder="Chercher une app, un jeu, un film…"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button className="btn" onClick={() => go('ai')}>🧠 Velora AI</button>
          <button className="btn" onClick={() => go('settings')} title={account.name}>
            {account.avatar ? (
              <img src={account.avatar} alt="" style={{ width: 20, height: 20, borderRadius: 99, verticalAlign: -4 }} />
            ) : (
              '👤'
            )}{' '}
            {account.name}
          </button>
        </header>

        <main className="view">
          {view === 'dashboard' && <Dashboard go={go} notify={notify} />}
          {view === 'launcher' && <Launcher query={query} notify={notify} />}
          {view === 'ai' && <Assistant notify={notify} />}
          {view === 'games' && <Games query={query} notify={notify} />}
          {view === 'media' && <Media query={query} notify={notify} />}
          {view === 'studio' && <Studio notify={notify} />}
          {view === 'tools' && <Tools notify={notify} />}
          {view === 'network' && <Network notify={notify} />}
          {view === 'github' && <Github notify={notify} />}
          {view === 'settings' && <Settings account={account} onAccount={setAccount} notify={notify} />}
        </main>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

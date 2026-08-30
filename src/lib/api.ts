export type Snapshot = {
  cpu: { total: number; perCore: number[]; cores: number; model: string; speed: number }
  memory: { total: number; used: number; free: number; percent: number }
  gpus: { name: string; usage: number | null; memory?: { used: number; total: number } | null; temperature: number | null }[]
  disks: { mount: string; total: number; used: number; free: number; percent: number }[]
  battery: { percent: number; charging: boolean } | null
  temperatures: { label: string; celsius: number }[]
  os: { platform: string; release: string; hostname: string; uptime: number }
}

export type LaunchHistory = { id: string; name: string; icon: string; kind: string; at: number }

export type AppEntry = {
  id: string
  name: string
  icon: string
  target: string
  args: string[]
  kind: string
  favorite?: boolean
  lastLaunch?: number | null
  launches?: number
}

export type GameEntry = {
  id: string
  name: string
  icon: string
  target: string
  args: string[]
  source: string
  favorite: boolean
  playtime: number
  lastSession: number | null
  cover?: string | null
}

export type MediaItem = {
  id: string
  title: string
  kind: 'movie' | 'show' | 'music'
  path: string
  poster?: string | null
  size?: number
  episodes?: { id: string; title: string; path: string; season: number; episode: number }[]
  tracks?: { id: string; title: string; path: string }[]
}

export type Weather = {
  city: string
  temperature: number
  feelsLike: number
  humidity: number
  wind: number
  code: number
  label: string
  icon: string
  days: { date: string; min: number; max: number; icon: string; label: string }[]
}

export type NetworkStatus = {
  online: boolean
  ping: number | null
  dns: boolean
  publicIp: string | null
  gateway: string | null
  interfaces: { name: string; address: string; mac: string; netmask: string }[]
}

export type NetworkDevice = {
  id: string
  ip: string
  mac: string | null
  name: string
  online: boolean
  lastSeen: number
  self?: boolean
}

export type BrainCard = { type: string; data: unknown }

export type BrainAnswer = {
  reply: string
  cards: BrainCard[]
  intent: string
  refresh?: string[]
  awaiting?: string | null
}

export type StudioProject = {
  id: string
  name: string
  kind: string
  kindLabel: string
  directory: string
  files: string[]
  run: string
  createdAt: number
}

export type Account = {
  id: string
  name: string
  provider: 'local' | 'discord' | 'github'
  avatar: string | null
  email?: string | null
}

type Frz = {
  platform: string
  invoke: <T = unknown>(channel: string, payload?: unknown) => Promise<T>
  window: { minimize: () => void; maximize: () => void; close: () => void }
  on: (channel: string, listener: (payload: unknown) => void) => () => void
}

const bridge = (globalThis as unknown as { frz?: Frz }).frz

/** Calls the main process; in a plain browser it fails loudly instead of silently. */
export function invoke<T = unknown>(channel: string, payload?: unknown): Promise<T> {
  if (!bridge) return Promise.reject(new Error('Velora OS doit tourner dans son application de bureau.'))
  return bridge.invoke<T>(channel, payload)
}

export const platform = bridge?.platform ?? 'web'
export const isDesktop = Boolean(bridge)
export const windowControls = bridge?.window ?? { minimize: () => {}, maximize: () => {}, close: () => {} }

/** file path -> URL the renderer is allowed to load. */
export function localUrl(target?: string | null): string | undefined {
  if (!target) return undefined
  return `frz-file:///${encodeURI(target.replace(/\\/g, '/').replace(/^\/+/, ''))}`
}

export function bytes(value?: number | null): string {
  if (!value || value <= 0) return '0 o'
  const units = ['o', 'Ko', 'Mo', 'Go', 'To']
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

export function playtime(minutes?: number | null): string {
  if (!minutes) return 'jamais joué'
  if (minutes < 60) return `${Math.round(minutes)} min`
  return `${Math.floor(minutes / 60)} h ${String(Math.round(minutes % 60)).padStart(2, '0')}`
}

export function since(timestamp?: number | null): string {
  if (!timestamp) return '—'
  const delta = Math.max(0, Date.now() - timestamp)
  const minutes = Math.floor(delta / 60000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  return `il y a ${Math.floor(hours / 24)} j`
}

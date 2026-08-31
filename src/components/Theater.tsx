import { useEffect, useRef } from 'react'
import { localUrl } from '../lib/api'

const POSITIONS = 'velora:positions'

/** Remembers where each film was stopped so reopening it resumes. */
function positions(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(POSITIONS) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}

export default function Theater({ title, path, onClose }: { title: string; path: string; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const element = video.current
    if (!element) return
    const resume = positions()[path]
    if (resume && resume > 15) element.currentTime = resume

    const remember = () => {
      const all = positions()
      if (element.duration && element.currentTime > 10 && element.currentTime < element.duration - 30) {
        all[path] = element.currentTime
      } else {
        delete all[path]
      }
      localStorage.setItem(POSITIONS, JSON.stringify(all))
    }

    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') return onClose()
      if (event.key === ' ') {
        event.preventDefault()
        if (element.paused) element.play()
        else element.pause()
      }
      if (event.key === 'ArrowRight') element.currentTime += 10
      if (event.key === 'ArrowLeft') element.currentTime -= 10
      if (event.key === 'ArrowUp') element.volume = Math.min(1, element.volume + 0.1)
      if (event.key === 'ArrowDown') element.volume = Math.max(0, element.volume - 0.1)
      if (event.key.toLowerCase() === 'f') {
        if (document.fullscreenElement) document.exitFullscreen()
        else element.requestFullscreen()
      }
    }

    const timer = setInterval(remember, 5000)
    window.addEventListener('keydown', keys)
    return () => {
      remember()
      clearInterval(timer)
      window.removeEventListener('keydown', keys)
    }
  }, [path, onClose])

  return (
    <div className="theater" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="theater-box">
        <div className="row">
          <b style={{ flex: 1 }}>{title}</b>
          <span className="muted" style={{ fontSize: 11.5 }}>espace : pause · ← → : 10 s · F : plein ecran · Echap : fermer</span>
          <button className="btn small" onClick={onClose}>✕</button>
        </div>
        <video ref={video} src={localUrl(path)} controls autoPlay />
      </div>
    </div>
  )
}

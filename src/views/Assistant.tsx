import { useEffect, useRef, useState } from 'react'
import { invoke, type BrainAnswer } from '../lib/api'
import { useAsync } from '../lib/hooks'
import type { Toast } from '../App'

type Turn = { role: 'user' | 'brain'; text: string }

export default function Assistant({ notify }: { notify: Toast }) {
  const [turns, setTurns] = useState<Turn[]>([
    { role: 'brain', text: "Je suis Velora AI, le cerveau local de ce PC. Dis-moi ce qu'on fait." },
  ])
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const suggestions = useAsync<string[]>(() => invoke('brain:suggestions'))
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [turns, thinking])

  const send = async (text: string) => {
    const message = text.trim()
    if (!message || thinking) return
    setDraft('')
    setTurns((current) => [...current, { role: 'user', text: message }])
    setThinking(true)
    try {
      const answer = await invoke<BrainAnswer>('brain:ask', message)
      setTurns((current) => [...current, { role: 'brain', text: answer.reply }])
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      setTurns((current) => [...current, { role: 'brain', text: `Ca a coince : ${reason}` }])
      notify(reason)
    } finally {
      setThinking(false)
    }
  }

  return (
    <div className="chat">
      <div className="chat-scroll" ref={scroller}>
        {turns.map((turn, index) => (
          <div key={index} className={`bubble ${turn.role}`}>{turn.text}</div>
        ))}
        {thinking && <div className="bubble brain"><span className="spin" /></div>}
      </div>

      <div>
        <div className="chips" style={{ marginBottom: 10 }}>
          {(suggestions.data ?? []).map((suggestion) => (
            <button key={suggestion} className="chip" onClick={() => send(suggestion)}>{suggestion}</button>
          ))}
        </div>
        <div className="composer">
          <textarea
            value={draft}
            placeholder="Lance Minecraft et ouvre Discord…"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                send(draft)
              }
            }}
          />
          <button className="btn primary" onClick={() => send(draft)}>Envoyer</button>
        </div>
      </div>
    </div>
  )
}

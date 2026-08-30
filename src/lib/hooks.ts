import { useCallback, useEffect, useRef, useState } from 'react'

/** Runs a promise, exposes data/loading/error and a manual reload. */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = [], options: { interval?: number } = {}) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const mounted = useRef(true)
  const run = useRef(loader)
  run.current = loader

  const reload = useCallback(async () => {
    try {
      const value = await run.current()
      if (mounted.current) {
        setData(value)
        setError(null)
      }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    setLoading(true)
    reload()
    if (!options.interval) return () => { mounted.current = false }
    const timer = setInterval(reload, options.interval)
    return () => {
      mounted.current = false
      clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, error, loading, reload, setData }
}

export function useClock(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  return now
}

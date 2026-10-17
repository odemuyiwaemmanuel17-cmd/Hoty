import { useEffect, useState } from 'react'

export function useReducedMotion(): boolean {
  const detect = () => {
    // Explicit visitor opt-in/out via URL (?motion=full / ?motion=reduced);
    // the system preference remains the default.
    const param = new URLSearchParams(window.location.search).get('motion')
    if (param === 'full') return false
    if (param === 'reduced') return true
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }
  const [reduced, setReduced] = useState(detect)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(detect())
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

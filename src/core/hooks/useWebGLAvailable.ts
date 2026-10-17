import { useEffect, useState } from 'react'

let cached: boolean | null = null

function detect(): boolean {
  if (cached !== null) return cached
  try {
    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    cached = Boolean(gl)
    // Release the probe context immediately.
    const lose = (gl as WebGLRenderingContext | null)?.getExtension('WEBGL_lose_context')
    lose?.loseContext()
  } catch {
    cached = false
  }
  return cached
}

export function useWebGLAvailable(): boolean {
  const [ok, setOk] = useState<boolean | null>(null)
  useEffect(() => {
    setOk(detect())
  }, [])
  return ok ?? false
}

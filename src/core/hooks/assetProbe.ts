export type AssetKind = 'model' | 'image'

const MODEL_CT = /gltf-binary|model\/gltf|octet-stream/

/**
 * Shared existence probe. Dev/preview servers answer unknown paths with
 * SPA-fallback HTML (status 200), so content-type is checked too.
 */
export async function probeAsset(url: string, kind: AssetKind): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    if (!res.ok) return false
    const ct = res.headers.get('content-type') ?? ''
    if (ct.includes('text/html')) return false
    if (kind === 'model') return ct === '' || MODEL_CT.test(ct)
    return ct === '' || ct.startsWith('image/')
  } catch {
    return false
  }
}

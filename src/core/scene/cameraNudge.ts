import * as THREE from 'three'

/**
 * Shared camera-nudge channel (mutable, non-reactive): scenes write a
 * subtle look-at / dolly override; the CameraDirector eases toward it and
 * relaxes back when cleared. Keeps selection micro-moves out of React state.
 */
export const cameraNudge = {
  look: null as THREE.Vector3 | null,
  dolly: 0, // extra forward push, world units
}

export function clearCameraNudge() {
  cameraNudge.look = null
  cameraNudge.dolly = 0
}

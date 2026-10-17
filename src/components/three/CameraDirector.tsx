import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { resolveCamera } from '../../core/scene/sceneRegistry'
import { cameraNudge } from '../../core/scene/cameraNudge'
import { scrollSignal } from '../../core/stores/useSceneStore'

const _targetLook = new THREE.Vector3()
const _targetPos = new THREE.Vector3()

/**
 * Centralized SceneDirector camera: deterministic keyframe solve for the
 * current master progress plus optional per-frame selection nudge. Eases
 * toward the target with frame-rate independent damping — forward and reverse
 * scroll share one path, so no flicker or teleporting.
 */
export function CameraDirector({ active = true }: { active?: boolean }) {
  const look = useRef(new THREE.Vector3(0, 0.15, 0))

  useFrame(({ camera, size }, dt) => {
    if (!active) return
    const solved = resolveCamera(scrollSignal.progress, size.width / Math.max(size.height, 1))

    _targetPos.copy(solved.position)
    _targetLook.copy(solved.lookAt)

    if (cameraNudge.look) {
      _targetLook.lerp(cameraNudge.look, 0.5)
      _targetPos.lerp(cameraNudge.look, cameraNudge.dolly)
    }

    const ease = 1 - Math.pow(0.0001, dt)
    camera.position.lerp(_targetPos, ease * 0.55)
    look.current.lerp(_targetLook, ease * 0.55)
    camera.lookAt(look.current)

    const p = camera as THREE.PerspectiveCamera
    if (Math.abs(p.fov - solved.fov) > 0.01) {
      p.fov = THREE.MathUtils.lerp(p.fov, solved.fov, ease * 0.5)
      p.updateProjectionMatrix()
    }
  })

  return null
}

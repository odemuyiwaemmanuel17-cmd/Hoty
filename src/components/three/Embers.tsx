import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const VERT = /* glsl */ `
uniform float uTime;
uniform float uPixelRatio;
attribute float aSeed;
attribute float aSize;
varying float vFade;
const float HEIGHT = 7.0;
void main() {
  vec3 p = position;
  float speed = 0.14 + aSeed * 0.22;
  p.y = mod(p.y + uTime * speed, HEIGHT) - 1.2;
  p.x += sin(uTime * 0.4 + aSeed * 12.0) * 0.25;
  p.z += cos(uTime * 0.3 + aSeed * 9.0) * 0.2;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min(aSize * uPixelRatio * (46.0 / -mv.z), 26.0 * uPixelRatio);
  float h = clamp((p.y + 1.2) / HEIGHT, 0.0, 1.0);
  vFade = smoothstep(0.0, 0.15, h) * (1.0 - smoothstep(0.55, 1.0, h));
}
`

const FRAG = /* glsl */ `
varying float vFade;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  float core = smoothstep(0.5, 0.0, d);
  vec3 col = mix(vec3(1.0, 0.42, 0.09), vec3(1.0, 0.75, 0.28), core);
  gl_FragColor = vec4(col, core * vFade * 0.9);
}
`

/** GPU ember particles: one draw call, additive, allocation-free loop. */
export function Embers({ count = 300 }: { count?: number }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    const sizes = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const r = 0.6 + Math.random() * 3.4
      const a = Math.random() * Math.PI * 2
      pos[i * 3] = Math.cos(a) * r
      pos[i * 3 + 1] = Math.random() * 7 - 1.2
      pos[i * 3 + 2] = Math.sin(a) * r * 0.6 - 0.5
      seeds[i] = Math.random()
      sizes[i] = 0.6 + Math.random() * 1.8
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    return geo
  }, [count])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime
  })

  return <points geometry={geometry} material={material} frustumCulled={false} />
}

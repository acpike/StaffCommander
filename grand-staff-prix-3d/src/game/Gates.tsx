import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text3D, Center, Float, Edges, Sparkles, RoundedBox } from '@react-three/drei'
import { RigidBody, CuboidCollider, type IntersectionEnterPayload } from '@react-three/rapier'
import { ActiveCollisionTypes } from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { useGame } from '../state/store'
import { makeNote, type Letter, type Clef } from '../data/notes'
import { noteToStaffTexture } from '../util/staffTexture'
import { carState } from './carState'
import { GATE_DISTANCE, GATE_THICKNESS, GATE_HEIGHT, laneCenters, laneWidth } from './constants'

// A spinning, pulsing crystal that carries the note letter — gives the answer
// blocks real character vs. a static frosted cube.
function HoloBlock({ letter, baseY, index, size }: { letter: Letter; baseY: number; index: number; size: number }) {
  const block = useRef<THREE.Group>(null)
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const halo = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    // gentle oscillating turn (never faces away) so the 3D depth + raised letter read
    if (block.current) block.current.rotation.y = Math.sin(t * 0.8 + index) * 0.34
    if (mat.current) mat.current.emissiveIntensity = 0.32 + Math.sin(t * 3 + index) * 0.18
    if (halo.current) {
      const s = 1 + Math.sin(t * 3 + index) * 0.12
      halo.current.scale.set(s, s, 1)
    }
  })

  return (
    <group>
      <Float speed={1.5 + (index % 3) * 0.3} floatIntensity={0.7} rotationIntensity={0}>
        <group position={[0, baseY, 0]} ref={block}>
          {/* solid 3D block */}
          <RoundedBox args={[size, size, size]} radius={size * 0.07} smoothness={4} castShadow>
            <meshStandardMaterial
              ref={mat}
              color="#16233f"
              emissive="#1f3f72"
              emissiveIntensity={0.32}
              metalness={0.55}
              roughness={0.22}
            />
            <Edges threshold={15} color="#7fd0ff" />
          </RoundedBox>
          {/* genuine extruded 3D letter, embossed proud of the front face */}
          <Suspense fallback={null}>
            <Center disableZ position={[0, 0, size / 2]}>
              <Text3D
                font="/fonts/helvetiker_bold.typeface.json"
                size={size * 0.58}
                height={size * 0.16}
                bevelEnabled
                bevelThickness={size * 0.018}
                bevelSize={size * 0.015}
                bevelSegments={2}
                curveSegments={4}
              >
                {letter}
                <meshStandardMaterial color="#eaf6ff" emissive="#8fd2ff" emissiveIntensity={0.45} metalness={0.3} roughness={0.25} />
              </Text3D>
            </Center>
          </Suspense>
          <Sparkles count={10} scale={size * 1.4} size={3.5} speed={0.45} color="#bfe8ff" />
        </group>
      </Float>
      {/* light halo on the road beneath the block */}
      <mesh ref={halo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[size * 0.46, size * 0.66, 40]} />
        <meshBasicMaterial color="#7fd0ff" transparent opacity={0.4} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

// "Find the note" block: same crystal, but its front face shows a staff with the
// note (for this block's letter) instead of an extruded letter.
function StaffBlock({ letter, octave, clef, baseY, index, size }: { letter: Letter; octave: number; clef: Clef; baseY: number; index: number; size: number }) {
  const block = useRef<THREE.Group>(null)
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const halo = useRef<THREE.Mesh>(null)
  const tex = useMemo(() => noteToStaffTexture(makeNote(`${letter}${octave}`, clef)), [letter, octave, clef])
  // dispose the canvas texture when the block unmounts (each wave) — avoids a GPU leak
  useEffect(() => () => tex.dispose(), [tex])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (block.current) block.current.rotation.y = Math.sin(t * 0.8 + index) * 0.34
    if (mat.current) mat.current.emissiveIntensity = 0.32 + Math.sin(t * 3 + index) * 0.18
    if (halo.current) {
      const s = 1 + Math.sin(t * 3 + index) * 0.12
      halo.current.scale.set(s, s, 1)
    }
  })

  return (
    <group>
      <Float speed={1.5 + (index % 3) * 0.3} floatIntensity={0.7} rotationIntensity={0}>
        <group position={[0, baseY, 0]} ref={block}>
          <RoundedBox args={[size, size, size]} radius={size * 0.07} smoothness={4} castShadow>
            <meshStandardMaterial ref={mat} color="#16233f" emissive="#1f3f72" emissiveIntensity={0.32} metalness={0.55} roughness={0.22} />
            <Edges threshold={15} color="#7fd0ff" />
          </RoundedBox>
          {/* staff card on the front face */}
          <mesh position={[0, 0, size / 2 + 0.012]}>
            <planeGeometry args={[size * 0.84, size * 0.84]} />
            <meshBasicMaterial map={tex} toneMapped={false} />
          </mesh>
          <Sparkles count={10} scale={size * 1.4} size={3.5} speed={0.45} color="#bfe8ff" />
        </group>
      </Float>
      <mesh ref={halo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[size * 0.46, size * 0.66, 40]} />
        <meshBasicMaterial color="#7fd0ff" transparent opacity={0.4} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

interface Gate {
  letter: Letter
  x: number
  width: number
}
interface Wave {
  id: number
  z: number
  gates: Gate[]
  octave: number
  clef: Clef
  mode: 'name' | 'find'
}

export function Gates() {
  const waveId = useGame((s) => s.waveId)
  const screen = useGame((s) => s.screen)
  const [wave, setWave] = useState<Wave | null>(null)
  const answered = useRef(-1)

  useEffect(() => {
    const g = useGame.getState()
    if (waveId <= 0 || !g.note || g.screen !== 'playing') {
      setWave(null)
      return
    }
    const letters = g.gateLetters
    const centers = laneCenters(letters.length)
    const width = laneWidth(letters.length)
    const gates: Gate[] = letters.map((letter, i) => ({ letter, x: centers[i], width }))
    setWave({ id: waveId, z: carState.z - GATE_DISTANCE, gates, octave: g.note.octave, clef: g.note.clef, mode: g.noteMode })
  }, [waveId, screen])

  if (!wave) return null

  // Resolve by the lane the car is actually closest to. The car (1.8 wide) is
  // wider than a lane, so it can overlap two sensors at a boundary — picking the
  // nearest lane centre makes scoring deterministic and fair regardless of which
  // sensor's event fires first.
  const onHit = (payload: IntersectionEnterPayload) => {
    const other = payload.other
    const isCar =
      other.rigidBodyObject?.name === 'car' ||
      (other.rigidBody?.userData as { kind?: string } | undefined)?.kind === 'car'
    if (!isCar) return
    if (answered.current === wave.id) return
    let best = wave.gates[0]
    let bestD = Infinity
    for (const g of wave.gates) {
      const d = Math.abs(carState.x - g.x)
      if (d < bestD) {
        bestD = d
        best = g
      }
    }
    answered.current = wave.id
    useGame.getState().answer(best.letter)
  }

  return (
    <group>
      {wave.gates.map((gate, i) => {
        const halfX = gate.width / 2 - 0.06
        // bigger blocks when there are fewer lanes (beginner), smaller as lanes grow
        const size = Math.max(1.7, Math.min(3.0, gate.width * 0.64))
        // hover each block at its own height (raised by its size so it clears the road)
        const baseY = size / 2 + 0.5 + Math.sin(i * 1.3 + 0.6) * 0.4
        return (
          <group key={`${wave.id}-${i}`} position={[gate.x, 0, wave.z]}>
            {/* full-lane sensor: registers which lane the car is in (invisible) */}
            <RigidBody type="fixed" colliders={false}>
              <CuboidCollider
                args={[halfX, GATE_HEIGHT / 2, GATE_THICKNESS / 2]}
                position={[0, GATE_HEIGHT / 2, 0]}
                sensor
                // the car is a kinematic body; KINEMATIC_FIXED is off by default,
                // so enable all pair types or the sensor never fires for it
                activeCollisionTypes={ActiveCollisionTypes.ALL}
                onIntersectionEnter={onHit}
              />
            </RigidBody>

            {wave.mode === 'find' ? (
              <StaffBlock letter={gate.letter} octave={wave.octave} clef={wave.clef} baseY={baseY} index={i} size={size} />
            ) : (
              <HoloBlock letter={gate.letter} baseY={baseY} index={i} size={size} />
            )}
          </group>
        )
      })}
    </group>
  )
}

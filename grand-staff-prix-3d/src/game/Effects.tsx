import { EffectComposer, Bloom, Vignette, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { isTouchDevice } from '../util/device'

export function Effects() {
  // Lighter multisampling on touch (the rest of the look is unchanged).
  return (
    <EffectComposer multisampling={isTouchDevice ? 2 : 4}>
      <Bloom intensity={0.55} luminanceThreshold={0.6} luminanceSmoothing={0.2} mipmapBlur />
      <Vignette offset={0.3} darkness={0.55} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}

import { EffectComposer, Bloom, Vignette, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { isTouchDevice } from '../util/device'

export function Effects() {
  // Touch devices: keep only tone mapping (needed for correct colors since the
  // Canvas is `flat`) and drop the expensive bloom/vignette/MSAA passes.
  if (isTouchDevice) {
    return (
      <EffectComposer multisampling={0}>
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    )
  }
  return (
    <EffectComposer multisampling={4}>
      <Bloom intensity={0.55} luminanceThreshold={0.6} luminanceSmoothing={0.2} mipmapBlur />
      <Vignette offset={0.3} darkness={0.55} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}

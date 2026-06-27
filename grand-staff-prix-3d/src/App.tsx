import { useEffect, useState } from 'react'
import { useGame } from './state/store'
import { input } from './game/input'
import { ensureMusicFont } from './util/staffTexture'
import { GameScene } from './game/GameScene'
import { Menu } from './ui/Menu'
import { Placement } from './ui/Placement'
import { HUD } from './ui/HUD'
import { Countdown } from './ui/Countdown'
import { GameOver } from './ui/GameOver'
import { Splash } from './ui/Splash'
import { TouchControls } from './ui/TouchControls'

export function App() {
  const screen = useGame((s) => s.screen)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    input.attach()
    void ensureMusicFont()
    void useGame.getState().refreshClass() // pull latest class roster from the cloud
    return () => input.detach()
  }, [])

  // The placement picker/result are menu-like (their own backdrop); only the live
  // placement RUN (countdown/playing) needs the 3D race scene.
  const inGame = screen !== 'menu' && screen !== 'placement'

  if (!started) return <Splash onStart={() => setStarted(true)} />

  return (
    <>
      {inGame && <GameScene />}
      {screen === 'menu' && <Menu />}
      {screen === 'placement' && <Placement />}
      {screen === 'countdown' && <Countdown />}
      {screen === 'playing' && <HUD />}
      {screen === 'playing' && <TouchControls />}
      {screen === 'over' && <GameOver />}
    </>
  )
}

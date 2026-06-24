import { useEffect, useState } from 'react'
import { useGame } from './state/store'
import { input } from './game/input'
import { ensureMusicFont } from './util/staffTexture'
import { GameScene } from './game/GameScene'
import { Menu } from './ui/Menu'
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
    return () => input.detach()
  }, [])

  const inGame = screen !== 'menu'

  if (!started) return <Splash onStart={() => setStarted(true)} />

  return (
    <>
      {inGame && <GameScene />}
      {screen === 'menu' && <Menu />}
      {screen === 'countdown' && <Countdown />}
      {screen === 'playing' && <HUD />}
      {screen === 'playing' && <TouchControls />}
      {screen === 'over' && <GameOver />}
    </>
  )
}

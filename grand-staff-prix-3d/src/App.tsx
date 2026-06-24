import { useEffect, useState } from 'react'
import { useGame } from './state/store'
import { input } from './game/input'
import { ensureMusicFont } from './util/staffTexture'
import { GameScene } from './game/GameScene'
import { Menu } from './ui/Menu'
import { JourneyPlay } from './ui/JourneyPlay'

// Opt-in beta Play screen: add ?journey=1 to the URL. Leaves the current Menu untouched.
const USE_JOURNEY = typeof location !== 'undefined' && new URLSearchParams(location.search).get('journey') === '1'
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

  const inGame = screen !== 'menu'

  if (!started) return <Splash onStart={() => setStarted(true)} />

  return (
    <>
      {inGame && <GameScene />}
      {screen === 'menu' && (USE_JOURNEY ? <JourneyPlay /> : <Menu />)}
      {screen === 'countdown' && <Countdown />}
      {screen === 'playing' && <HUD />}
      {screen === 'playing' && <TouchControls />}
      {screen === 'over' && <GameOver />}
    </>
  )
}

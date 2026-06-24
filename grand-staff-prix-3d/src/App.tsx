import { useEffect, useState } from 'react'
import { useGame } from './state/store'
import { input } from './game/input'
import { ensureMusicFont } from './util/staffTexture'
import { GameScene } from './game/GameScene'
import { Menu } from './ui/Menu'
import { JourneyPlay } from './ui/JourneyPlay'

type PlayView = 'classic' | 'journey'
function initialView(): PlayView {
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('journey') === '1') return 'journey'
  try {
    return (localStorage.getItem('gsp3d.playview') as PlayView) || 'classic'
  } catch {
    return 'classic'
  }
}
import { HUD } from './ui/HUD'
import { Countdown } from './ui/Countdown'
import { GameOver } from './ui/GameOver'
import { Splash } from './ui/Splash'
import { TouchControls } from './ui/TouchControls'

export function App() {
  const screen = useGame((s) => s.screen)
  const [started, setStarted] = useState(false)
  const [playView, setPlayView] = useState<PlayView>(initialView)
  const flip = (v: PlayView) => {
    setPlayView(v)
    try {
      localStorage.setItem('gsp3d.playview', v)
    } catch {
      /* ignore */
    }
  }

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
      {screen === 'menu' && (
        <>
          {playView === 'journey' ? <JourneyPlay /> : <Menu />}
          <div className="viewToggle">
            <button className={playView === 'classic' ? 'on' : ''} onClick={() => flip('classic')}>Classic</button>
            <button className={playView === 'journey' ? 'on' : ''} onClick={() => flip('journey')}>Journey</button>
          </div>
        </>
      )}
      {screen === 'countdown' && <Countdown />}
      {screen === 'playing' && <HUD />}
      {screen === 'playing' && <TouchControls />}
      {screen === 'over' && <GameOver />}
    </>
  )
}

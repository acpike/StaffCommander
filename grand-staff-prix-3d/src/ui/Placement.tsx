import { useGame } from '../state/store'
import { REGIONS } from '../data/notes'
import { MenuBackground } from './MenuBackground'
import { RangePreview } from './RangePreview'
import { Icon } from './icons'

// ───────────────────────── milestone-ladder picker ─────────────────────────
function Picker() {
  const startPlacement = useGame((s) => s.startPlacement)
  const placeNewStudent = useGame((s) => s.placeNewStudent)
  return (
    <div className="sheet placeSheet">
      <div className="topbar">
        <button className="chip ghost" onClick={placeNewStudent}>
          {Icon.back} Skip
        </button>
        <div className="chip head">Find your level</div>
      </div>

      <div className="card sec">
        <div className="secLabel">Brand new?</div>
        <p className="tiny">
          Not sure where you fit yet? Start at the very beginning — we'll grow from there.
        </p>
        <button className="btn" onClick={placeNewStudent} style={{ marginTop: 8 }}>
          {Icon.play} I'm brand new — start at the beginning
        </button>
      </div>

      <div className="card sec">
        <div className="secLabel">Already read some notes?</div>
        <p className="tiny">
          Pick the range you think you can read — we'll give you a quick check and start you in the right place.
        </p>
        <div className="placeGrid">
          {REGIONS.map((r) => (
            <button
              key={r.n}
              className="placeCard"
              onClick={() => (r.n === 1 ? placeNewStudent() : startPlacement(r.n))}
            >
              <div className="placeHead">
                <span className="placeNum">{r.n}</span>
                <span className="placeName">{r.name}</span>
                <span className="placeRange">{r.range}</span>
              </div>
              <div className="placePrev"><RangePreview ladder={r.ladder} /></div>
              <span className="placeGo">{r.n === 1 ? 'Start here' : 'Check this →'}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ───────────────────────── result (pass / step-down / floor) ─────────────────────────
function Result() {
  const placement = useGame((s) => s.placement)
  const startPlacement = useGame((s) => s.startPlacement)
  const placeNewStudent = useGame((s) => s.placeNewStudent)
  const endPlacement = useGame((s) => s.endPlacement)
  if (!placement) return null

  const pct = Math.round(placement.accuracy * 100)
  const region = REGIONS.find((r) => r.n === placement.region)
  const placedRegion = placement.placedStageId
    ? REGIONS.find((r) => placement.placedStageId!.startsWith(`r${r.n}-`))
    : undefined

  // Passed → placed at this region's Find stage.
  if (placement.passed) {
    return (
      <div className="sheet placeSheet">
        <div className="card sec placeResult win">
          <div className="secLabel">Nice reading!</div>
          <div className="placeBig">{pct}%</div>
          <p>
            You placed at <b>{region?.name}</b> — starting on <b>Find</b>. Everything below it is already in
            the bag.
          </p>
          <button className="btn" onClick={endPlacement} style={{ marginTop: 10 }}>
            {Icon.play} Let's race
          </button>
        </div>
      </div>
    )
  }

  // Missed but there's a lower region to try — offer the step-down.
  if (placement.nextRegion != null) {
    const next = REGIONS.find((r) => r.n === placement.nextRegion)
    return (
      <div className="sheet placeSheet">
        <div className="card sec placeResult">
          <div className="secLabel">Let's try a little lower</div>
          <div className="placeBig">{pct}%</div>
          <p>
            <b>{region?.name}</b> was a stretch. Let's check <b>{next?.name}</b> ({next?.range}) instead.
          </p>
          <button className="btn" onClick={() => startPlacement(placement.nextRegion!)} style={{ marginTop: 10 }}>
            {Icon.play} Check {next?.name}
          </button>
          <button className="btn ghost" onClick={placeNewStudent} style={{ marginTop: 8 }}>
            Just start at the beginning
          </button>
        </div>
      </div>
    )
  }

  // Stepped all the way down to the floor — start at the beginning.
  return (
    <div className="sheet placeSheet">
      <div className="card sec placeResult">
        <div className="secLabel">We'll start at the beginning</div>
        <p>
          No problem — everyone starts somewhere. You'll begin at <b>{placedRegion?.name ?? 'Middle C'}</b> and
          build up from there.
        </p>
        <button className="btn" onClick={endPlacement} style={{ marginTop: 10 }}>
          {Icon.play} Let's race
        </button>
      </div>
    </div>
  )
}

/** New-student placement flow (spec §9): the milestone-ladder picker + result. */
export function Placement() {
  const phase = useGame((s) => s.placement?.phase)
  return (
    <div className="overlay">
      <MenuBackground />
      {phase === 'result' ? <Result /> : <Picker />}
    </div>
  )
}

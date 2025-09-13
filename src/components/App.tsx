import { useState } from 'react'
import { Button } from './ui/button'
import presets from '../../configs/sound-presets.json'
import games from '../../configs/game-presets.json'
import { decodeBoardString } from '../chess/compact'
import { AudioAgent, type HarmonicPreset } from '../audio/engine'

type GamePreset = { id: string; boardString: string }

const harmonic = (presets.presets as HarmonicPreset[]).find(
  (p) => p.id === 'harmonic_layers',
)!;
const startPreset = (games.presets as GamePreset[]).find(
  (p) => p.id === 'start_setting',
)!;
const pieces = decodeBoardString(startPreset.boardString)
const agent = new AudioAgent(harmonic)

export default function App() {
  const [tick, setTick] = useState(1)
  const start = () => agent.start(pieces, tick)

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Chessboard Sound</h1>
      <div className="space-y-2">
        <label htmlFor="tick">Tick interval: {tick.toFixed(2)}s</label>
        <input
          id="tick"
          type="range"
          min={0.25}
          max={5}
          step={0.25}
          value={tick}
          onChange={(e) => setTick(parseFloat(e.target.value))}
        />
      </div>
      <Button onClick={start}>Play Start Board</Button>
    </div>
  )
}

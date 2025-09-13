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
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Chessboard Sound</h1>
      <Button onClick={() => agent.playBoard(pieces)}>Play Start Board</Button>
    </div>
  )
}

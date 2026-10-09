import { SoundAgent } from "../audio/SoundAgent";
import { toast } from 'react-hot-toast';

export default function EarconTester({ agent }: { agent: SoundAgent | null }) {
    const reportError = (cause: unknown) => toast.error(cause instanceof Error ? cause.message : 'Could not play this sound.');
    if (!agent) return null
    const voices = agent.listVoiceIds()
    const pieces = agent.listPieceTypes()

    return (
        <div className="rounded-lg border bg-white p-4 space-y-3">
            <h3 className="font-semibold">Earcon & Voice Tester</h3>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <div className="text-sm font-medium mb-2">Piece earcons</div>
                    <div className="flex flex-wrap gap-2">
                        {pieces.map((p) => (
                            <div key={p} className="flex items-center gap-2">
                                <button className="px-2 py-1 text-xs rounded-sm bg-blue-500 text-white hover:bg-blue-600" onClick={() => void agent.auditionEarcon(p, "white").catch(reportError)}>{p} ♔</button>
                                <button className="px-2 py-1 text-xs rounded-sm bg-purple-500 text-white hover:bg-purple-600" onClick={() => void agent.auditionEarcon(p, "black").catch(reportError)}>{p} ♚</button>
                            </div>
                        ))}
                    </div>
                </div>
                <div>
                    <div className="text-sm font-medium mb-2">Voices</div>
                    <div className="flex flex-col gap-2">
                        {voices.map((v) => (
                            <div key={v} className="flex items-center gap-2">
                                <span className="text-xs w-28 truncate" title={v}>{v}</span>
                                <button className="px-2 py-1 text-xs rounded-sm bg-green-500 text-white hover:bg-green-600" onClick={() => void agent.auditionVoice(v, "C4").catch(reportError)}>C4</button>
                                <button className="px-2 py-1 text-xs rounded-sm bg-green-500 text-white hover:bg-green-600" onClick={() => void agent.auditionVoice(v, "E4").catch(reportError)}>E4</button>
                                <button className="px-2 py-1 text-xs rounded-sm bg-green-500 text-white hover:bg-green-600" onClick={() => void agent.auditionVoice(v, "G4").catch(reportError)}>G4</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

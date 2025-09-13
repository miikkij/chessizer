import { useEffect, useState } from "react";
import { SoundAgent } from "../audio/SoundAgent";

export default function EarconTester({ agent }: { agent: SoundAgent | null }) {
    const [voices, setVoices] = useState<string[]>([])
    const [pieces, setPieces] = useState<string[]>([])

    useEffect(() => {
        if (!agent) return
        setVoices(agent.listVoiceIds())
        setPieces(agent.listPieceTypes())
    }, [agent])

    if (!agent) return null

    return (
        <div className="rounded-lg border bg-card p-4 space-y-3">
            <h3 className="font-semibold">Earcon & Voice Tester</h3>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <div className="text-sm font-medium mb-2">Piece earcons</div>
                    <div className="flex flex-wrap gap-2">
                        {pieces.map((p) => (
                            <div key={p} className="flex items-center gap-2">
                                <button className="px-2 py-1 text-xs rounded bg-blue-500 text-white hover:bg-blue-600" onClick={() => agent.playEarcon(p, "white")}>{p} ♔</button>
                                <button className="px-2 py-1 text-xs rounded bg-purple-500 text-white hover:bg-purple-600" onClick={() => agent.playEarcon(p, "black")}>{p} ♚</button>
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
                                <button className="px-2 py-1 text-xs rounded bg-green-500 text-white hover:bg-green-600" onClick={() => agent.playVoice(v, "C4")}>C4</button>
                                <button className="px-2 py-1 text-xs rounded bg-green-500 text-white hover:bg-green-600" onClick={() => agent.playVoice(v, "E4")}>E4</button>
                                <button className="px-2 py-1 text-xs rounded bg-green-500 text-white hover:bg-green-600" onClick={() => agent.playVoice(v, "G4")}>G4</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

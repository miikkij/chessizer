import { useMemo, useState } from "react";
import { SoundAgent } from "../audio/SoundAgent";

const strategies = [
    "rowSequential",
    "columnSequential",
    "spiralFromCenter",
    "ringsFromKing",
    "randomSeeded",
    "customList",
] as const

type Strategy = typeof strategies[number]
type Params =
    | { rowsPerTick?: number }
    | { colsPerTick?: number }
    | { cellsPerTick?: number }
    | { cellsPerTick?: number; side?: "turn" | "white" | "black" }
    | { seed?: number | string; cellsPerTick?: number }
    | { order: string[]; cellsPerTick?: number }

export default function TraversalControls({ agent }: { agent: SoundAgent | null }) {
    const [sourceAgent, setSourceAgent] = useState(agent)
    const [strategy, setStrategy] = useState<Strategy>(() => agent?.getTraversal().strategy as Strategy || "rowSequential")
    const [params, setParams] = useState<Params>(() => agent?.getTraversal().params as Params || {})

    // Keep a local draft until Apply, and reset it when a different agent is loaded.
    if (sourceAgent !== agent) {
        const cfg = agent?.getTraversal()
        setSourceAgent(agent)
        setStrategy(cfg?.strategy as Strategy || "rowSequential")
        setParams(cfg?.params as Params || {})
    }

    const onApply = () => {
        agent?.setTraversal(strategy, params)
    }

    const ParamEditor = useMemo(() => {
        switch (strategy) {
            case "rowSequential":
                return (
                    <div className="grid grid-cols-3 gap-2">
                        <label htmlFor="rowsPerTick" className="text-xs col-span-1">rowsPerTick</label>
                        <input id="rowsPerTick" aria-label="rowsPerTick" title="rowsPerTick" className="col-span-2 border rounded-sm px-2 py-1 text-xs" type="number" value={(params as { rowsPerTick?: number }).rowsPerTick ?? 8}
                            onChange={(e) => setParams(p => ({ ...((p as Record<string, unknown>) || {}), rowsPerTick: Number.parseInt(e.target.value, 10) }) as Params)} />
                    </div>
                )
            case "columnSequential":
                return (
                    <div className="grid grid-cols-3 gap-2">
                        <label htmlFor="colsPerTick" className="text-xs col-span-1">colsPerTick</label>
                        <input id="colsPerTick" aria-label="colsPerTick" title="colsPerTick" className="col-span-2 border rounded-sm px-2 py-1 text-xs" type="number" value={(params as { colsPerTick?: number }).colsPerTick ?? 8}
                            onChange={(e) => setParams(p => ({ ...((p as Record<string, unknown>) || {}), colsPerTick: Number.parseInt(e.target.value, 10) }) as Params)} />
                    </div>
                )
            case "spiralFromCenter":
                return (
                    <div className="grid grid-cols-3 gap-2">
                        <label htmlFor="cellsPerTick1" className="text-xs col-span-1">cellsPerTick</label>
                        <input id="cellsPerTick1" aria-label="cellsPerTick" title="cellsPerTick" className="col-span-2 border rounded-sm px-2 py-1 text-xs" type="number" value={(params as { cellsPerTick?: number }).cellsPerTick ?? 16}
                            onChange={(e) => setParams(p => ({ ...((p as Record<string, unknown>) || {}), cellsPerTick: Number.parseInt(e.target.value, 10) }) as Params)} />
                    </div>
                )
            case "ringsFromKing":
                return (
                    <div className="grid grid-cols-3 gap-2">
                        <label htmlFor="cellsPerTick2" className="text-xs col-span-1">cellsPerTick</label>
                        <input id="cellsPerTick2" aria-label="cellsPerTick" title="cellsPerTick" className="col-span-2 border rounded-sm px-2 py-1 text-xs" type="number" value={(params as { cellsPerTick?: number }).cellsPerTick ?? 64}
                            onChange={(e) => setParams(p => ({ ...((p as Record<string, unknown>) || {}), cellsPerTick: Number.parseInt(e.target.value, 10) }) as Params)} />
                    </div>
                )
            case "randomSeeded":
                return (
                    <div className="grid grid-cols-3 gap-2">
                        <label htmlFor="seed" className="text-xs col-span-1">seed</label>
                        <input id="seed" aria-label="seed" title="seed" className="col-span-2 border rounded-sm px-2 py-1 text-xs" value={String((params as { seed?: string | number }).seed ?? "seed")}
                            onChange={(e) => setParams(p => ({ ...((p as Record<string, unknown>) || {}), seed: e.target.value }) as Params)} />
                    </div>
                )
            case "customList":
                return (
                    <div className="grid grid-cols-3 gap-2">
                        <label htmlFor="order" className="text-xs col-span-1">order (csv)</label>
                        <input id="order" aria-label="order" title="order" className="col-span-2 border rounded-sm px-2 py-1 text-xs" value={((params as { order?: string[] }).order || []).join(",")}
                            onChange={(e) => setParams(p => ({ ...((p as Record<string, unknown>) || {}), order: e.target.value.split(",").map(s => s.trim()) }) as Params)} />
                    </div>
                )
            default:
                return null
        }
    }, [strategy, params])

    return (
        <div className="rounded-lg border bg-white p-4 space-y-3">
            <h3 className="font-semibold">Traversal</h3>
            <div className="flex items-center gap-2">
                <label className="text-sm">Strategy</label>
                <select aria-label="Traversal strategy" title="Traversal strategy" className="border rounded-sm px-2 py-1 text-sm" value={strategy} onChange={(e) => setStrategy(e.target.value as Strategy)}>
                    {strategies.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button className="ml-auto px-3 py-1 text-sm rounded-sm bg-blue-600 text-white hover:bg-blue-700" onClick={onApply}>Apply</button>
            </div>
            {ParamEditor}
        </div>
    )
}

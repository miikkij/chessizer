import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Headphones, Pause, Play, RotateCw, Settings2 } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import { Button } from './ui/button';
import BoardView from './BoardView';
import MoveHistory from './MoveHistory';
import PGNLoader from './PGNLoader';
import { GAME_PRESETS, getPresetPGN } from '../data/gamePresets';
import { parseGame, type GameTimeline } from '../chess/game';
import { calculatePositionMetrics } from '../chess/metrics';
import { useGameState } from '../hooks/useGameState';
import { useAudioSettings } from '../hooks/useAudioSettings';
import { useSoundAgent } from '../hooks/useSoundAgent';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

const ConfigEditor = lazy(() => import('./ConfigEditor'));
const EarconTester = lazy(() => import('./EarconTester'));
const TraversalControls = lazy(() => import('./TraversalControls'));
const WavPlayerControls = lazy(() => import('./WavPlayerControls').then(module => ({ default: module.WavPlayerControls })));

export default function App() {
    const { game, frame, positionIndex, transition, loadGame, goTo, prev, next, first, last } = useGameState();
    const audio = useSoundAgent(frame, transition);
    const { toggle, replaceAgent } = audio;
    const settings = useAudioSettings(audio.agent);
    const playbackSettingsRef = useRef(settings);
    playbackSettingsRef.current = settings;
    const [gamePreset, setGamePreset] = useState('immortal_game');
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [orientation, setOrientation] = useState<'white' | 'black'>('white');
    const metrics = useMemo(() => calculatePositionMetrics(frame.fen), [frame.fen]);
    const lastIndex = game.positions.length - 1;
    const turn = frame.fen.split(' ')[1] === 'w' ? 'White' : 'Black';
    const materialLabel = metrics.materialBalance === 0
        ? 'Material is balanced'
        : `${metrics.materialBalance > 0 ? 'White' : 'Black'} +${Math.abs(metrics.materialBalance)} material`;

    useEffect(() => {
        audio.agent?.setMasterVolume(settings.masterVolume);
    }, [audio.agent, settings.masterVolume]);

    const handlePlay = useCallback(() => {
        void toggle(() => playbackSettingsRef.current);
    }, [toggle]);

    useKeyboardShortcuts({ onPlayToggle: handlePlay, onPrev: prev, onNext: next, onFirst: first, onLast: last });

    const handlePreset = (id: string) => {
        try {
            loadGame(parseGame(id === 'start' ? '*' : getPresetPGN(id)));
            setGamePreset(id);
        } catch (cause) {
            toast.error(cause instanceof Error ? cause.message : 'Could not load game.');
        }
    };

    const handleImport = (imported: GameTimeline) => {
        loadGame(imported);
        setGamePreset('imported');
        toast.success(`Loaded ${imported.positions.length - 1} half-moves`);
    };

    const handleConfig = useCallback((config: unknown, path: string) => {
        if (path !== '/configs/sound-agent-demo.json') return;
        try {
            replaceAgent(config);
            toast.success('Sound configuration applied. Press Listen to play.');
        } catch (cause) {
            toast.error(cause instanceof Error ? cause.message : 'Invalid sound configuration.');
        }
    }, [replaceAgent]);

    return <div className="app-shell">
        <Toaster position="top-right" />
        <header className="app-header">
            <div className="brand-mark" aria-hidden="true"><Headphones size={23} /></div>
            <div><h1>Chessizer</h1><p>Hear the position. Follow the game.</p></div>
            <span className="local-badge">Browser audio</span>
        </header>
        <main className="workspace">
            <section className="source-panel" aria-label="Game source">
                <div className="source-select">
                    <label htmlFor="game-source">Game</label>
                    <select id="game-source" value={gamePreset} onChange={event => handlePreset(event.target.value)}>
                        <option value="start">Starting position</option>
                        {Object.entries(GAME_PRESETS).map(([id, preset]) => <option value={id} key={id}>{preset.name}</option>)}
                        {gamePreset === 'imported' && <option value="imported">Imported game</option>}
                    </select>
                </div>
                <details className="import-panel"><summary>Import PGN</summary><PGNLoader onGameLoaded={handleImport} /></details>
            </section>
            <div className="play-layout">
                <section className="board-panel panel" aria-label="Board and playback">
                    <div className="panel-heading">
                        <div><p className="eyebrow">{positionIndex === 0 ? 'Starting position' : `Last move: ${frame.move?.san ?? ''}`}</p><h2>{game.title}</h2></div>
                        <button className="icon-button" type="button" aria-label="Flip board" title="Flip board" onClick={() => setOrientation(value => value === 'white' ? 'black' : 'white')}><RotateCw size={18} /></button>
                    </div>
                    <BoardView frame={frame} inCheck={metrics.inCheck} orientation={orientation} />
                    <p className={`position-status ${metrics.inCheck ? 'is-check' : ''}`} role="status">
                        <span className={`side-dot ${turn.toLowerCase()}`} aria-hidden="true" />
                        {metrics.isCheckmate ? `Checkmate. ${turn === 'White' ? 'Black' : 'White'} wins.` : `${turn} to move${metrics.inCheck ? ' · Check' : ''}`}
                    </p>
                    <div className="transport" aria-label="Playback controls">
                        <button className="icon-button" type="button" aria-label="First position" title="First position (Home)" disabled={positionIndex === 0} onClick={first}><ChevronFirst size={20} /></button>
                        <button className="icon-button" type="button" aria-label="Previous move" title="Previous move (Left arrow)" disabled={positionIndex === 0} onClick={prev}><ChevronLeft size={22} /></button>
                        <Button className="listen-button" onClick={handlePlay} disabled={!audio.agent || audio.isStarting} aria-pressed={audio.isPlaying}>
                            {audio.isPlaying ? <Pause size={18} /> : <Play size={18} />}
                            {audio.isStarting ? 'Starting audio…' : audio.isPlaying ? 'Pause audio' : 'Listen to position'}
                        </Button>
                        <button className="icon-button" type="button" aria-label="Next move" title="Next move (Right arrow)" disabled={positionIndex === lastIndex} onClick={next}><ChevronRight size={22} /></button>
                        <button className="icon-button" type="button" aria-label="Last position" title="Last position (End)" disabled={positionIndex === lastIndex} onClick={last}><ChevronLast size={20} /></button>
                    </div>
                    {audio.error && <p className="error-message" role="alert">{audio.error}</p>}
                    <div className="timeline-control">
                        <label htmlFor="timeline">Move history <span>{positionIndex} / {lastIndex} half-moves</span></label>
                        <input id="timeline" type="range" min={0} max={lastIndex} value={positionIndex} disabled={lastIndex === 0} onChange={event => goTo(Number(event.target.value))} />
                    </div>
                    <div className="listening-settings">
                        <label htmlFor="tick-interval">Repeat every <span className="setting-value">{(settings.tickMs / 1000).toFixed(2)} s</span><input id="tick-interval" type="range" min={250} max={5000} step={50} value={settings.tickMs} onChange={event => settings.handleTickChange([Number(event.target.value)])} /></label>
                        <label htmlFor="master-volume">Volume <span className="setting-value">{Math.round(settings.masterVolume * 100)}%</span><input id="master-volume" type="range" min={0} max={1} step={0.01} value={settings.masterVolume} onChange={event => settings.handleVolumeChange([Number(event.target.value)])} /></label>
                    </div>
                    <p className="keyboard-hint">Space: listen / pause · Arrow keys: previous / next move</p>
                </section>
                <aside className="position-sidebar">
                    <section className="panel metrics-panel" aria-label="Position summary">
                        <h2>Position at a glance</h2>
                        <div className="material-summary"><div><span>White</span><strong>{metrics.whiteMaterial}</strong></div><p>{materialLabel}</p><div><span>Black</span><strong>{metrics.blackMaterial}</strong></div></div>
                        <p className="metric-note">Material counts pieces, not winning chances.</p>
                        <div className="pressure-label"><span>Activity</span><strong>{Math.round(metrics.intensity * 100)}%</strong></div>
                        <meter className="activity-meter" min={0} max={1} value={metrics.intensity} aria-label="Position activity" />
                        <dl className="position-facts"><div><dt>Available captures</dt><dd>{metrics.legalCaptures}</dd></div><div><dt>Center squares attacked</dt><dd>W {metrics.whiteCenterControl} · B {metrics.blackCenterControl}</dd></div></dl>
                    </section>
                    <section className="panel history-panel">
                        <div className="panel-heading"><h2>Move history</h2><span className="subtle">{lastIndex} half-moves</span></div>
                        <MoveHistory game={game} positionIndex={positionIndex} onSelect={goTo} />
                    </section>
                    <details className="panel notation-panel">
                        <summary>Position and game notation</summary>
                        <label htmlFor="current-fen">Current FEN</label><textarea id="current-fen" readOnly value={frame.fen} rows={3} />
                        <label htmlFor="game-pgn">PGN</label><textarea id="game-pgn" readOnly value={game.pgn} rows={6} />
                    </details>
                </aside>
            </div>
            <section className="advanced-section">
                <button className="advanced-toggle" type="button" aria-expanded={advancedOpen} aria-controls="advanced-settings" onClick={() => setAdvancedOpen(value => !value)}><Settings2 size={17} /> Sound tools and advanced settings</button>
                {advancedOpen && <div id="advanced-settings" className="advanced-grid">
                    <section className="panel">
                        <h2>Listening settings</h2>
                        <p className="metric-note">Repeat and volume are saved in this browser. Reset them to return to a one-second repeat and 70% volume.</p>
                        <Button variant="outline" onClick={settings.resetSettings}>Reset audio settings</Button>
                    </section>
                    <Suspense fallback={<p>Loading sound tools…</p>}>
                        <TraversalControls agent={audio.agent} />
                        <EarconTester agent={audio.agent} />
                        <section className="panel"><h2>Sound configuration</h2><ConfigEditor onConfigChange={handleConfig} /></section>
                        <section className="panel"><h2>WAV playback</h2><p className="metric-note">Optional. Requires the local WAV service.</p><WavPlayerControls currentFen={frame.fen} transition={transition} previousFen={game.positions[positionIndex - 1]?.fen} isEnabled={!audio.isPlaying} /></section>
                    </Suspense>
                </div>}
            </section>
        </main>
    </div>;
}

import { useState, useCallback } from 'react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { WavSoundPlayer, type WavConfig } from '../audio/WavSoundPlayer';
import { Play, Square, Volume2, Settings, Loader2, AlertCircle, RotateCcw, Zap } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface WavPlayerControlsProps {
    currentFen: string;
    isEnabled?: boolean;
}

export function WavPlayerControls({ currentFen, isEnabled = true }: WavPlayerControlsProps) {
    const [showConfig, setShowConfig] = useState(false);
    const [status, setStatus] = useState<'idle' | 'generating' | 'playing' | 'error'>('idle');

    const handleError = useCallback((error: string) => {
        setStatus('error');
        toast.error(`WAV Generation Error: ${error}`);
        console.error('WAV Player Error:', error);
    }, []);

    const handleSuccess = useCallback(() => {
        setStatus('playing');
        toast.success('WAV sound generated and playing');
    }, []);

    const wavPlayer = WavSoundPlayer({
        currentFen,
        isEnabled,
        onError: handleError,
        onSuccess: handleSuccess
    });

    const handlePlay = useCallback(async () => {
        if (wavPlayer.isPlaying) {
            wavPlayer.stopPlayback();
            setStatus('idle');
        } else {
            setStatus('generating');
            await wavPlayer.generateAndPlay();
            if (!wavPlayer.isGenerating && !wavPlayer.isPlaying) {
                setStatus('idle');
            }
        }
    }, [wavPlayer]);

    const getButtonIcon = () => {
        if (wavPlayer.isGenerating) {
            return <Loader2 className="h-4 w-4 animate-spin" />;
        }
        if (wavPlayer.isPlaying) {
            return <Square className="h-4 w-4" />;
        }
        return <Play className="h-4 w-4" />;
    };

    const getButtonText = () => {
        if (wavPlayer.isGenerating) return 'Generating...';
        if (wavPlayer.isPlaying) return 'Stop WAV';
        return 'Play WAV';
    };

    const getStatusColor = () => {
        switch (status) {
            case 'generating': return 'text-blue-600';
            case 'playing': return 'text-green-600';
            case 'error': return 'text-red-600';
            default: return 'text-gray-600';
        }
    };

    return (
        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePlay}
                    disabled={!isEnabled || !currentFen}
                    className="min-w-[120px]"
                >
                    {getButtonIcon()}
                    {getButtonText()}
                </Button>

                <div className="flex items-center gap-1">
                    <Volume2 className="h-4 w-4" />
                    <Slider
                        value={[wavPlayer.volume]}
                        onValueChange={(values) => wavPlayer.setVolume(values[0])}
                        max={1}
                        min={0}
                        step={0.1}
                        className="w-20"
                    />
                </div>

                <div className="flex items-center gap-1">
                    <Button
                        variant={wavPlayer.isLooping ? "default" : "outline"}
                        size="sm"
                        onClick={() => wavPlayer.setLooping(!wavPlayer.isLooping)}
                        title={wavPlayer.isLooping ? "Disable Loop" : "Enable Loop"}
                        className="min-w-[36px]"
                    >
                        <RotateCcw className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex items-center gap-1" title={`Playback Speed: ${wavPlayer.playbackSpeed.toFixed(1)}x`}>
                    <Zap className="h-4 w-4" />
                    <Slider
                        value={[wavPlayer.playbackSpeed]}
                        onValueChange={(values) => wavPlayer.setPlaybackSpeed(values[0])}
                        max={2}
                        min={0.5}
                        step={0.1}
                        className="w-20"
                    />
                    <span className="text-xs min-w-[30px] text-center font-mono">{wavPlayer.playbackSpeed.toFixed(1)}x</span>
                </div>

                <Dialog open={showConfig} onOpenChange={setShowConfig}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                            <Settings className="h-4 w-4" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>WAV Sound Configuration</DialogTitle>
                        </DialogHeader>
                        <WavConfigEditor
                            config={wavPlayer.wavConfig}
                            onChange={wavPlayer.setWavConfig}
                            microserviceUrl={wavPlayer.microserviceUrl}
                            onMicroserviceUrlChange={wavPlayer.setMicroserviceUrl}
                        />
                    </DialogContent>
                </Dialog>
            </div>

            <div className="flex items-center gap-2 text-sm">
                <div className={`flex items-center gap-1 ${getStatusColor()}`}>
                    {status === 'error' && <AlertCircle className="h-3 w-3" />}
                    <span className="capitalize">{status}</span>
                </div>
            </div>

            {/* Hidden audio element for playback */}
            <audio
                ref={wavPlayer.audioRef}
                onEnded={wavPlayer.onAudioEnded}
                className="hidden"
            />
        </div>
    );
}

interface WavConfigEditorProps {
    config: WavConfig;
    onChange: (config: WavConfig) => void;
    microserviceUrl: string;
    onMicroserviceUrlChange: (url: string) => void;
}

function WavConfigEditor({
    config,
    onChange,
    microserviceUrl,
    onMicroserviceUrlChange
}: WavConfigEditorProps) {
    const updateConfig = useCallback((path: string[], value: string | number) => {
        const newConfig = { ...config };
        let current: Record<string, unknown> = newConfig;

        for (let i = 0; i < path.length - 1; i++) {
            current = current[path[i]] as Record<string, unknown>;
        }
        current[path[path.length - 1]] = value;

        onChange(newConfig);
    }, [config, onChange]);

    return (
        <div className="space-y-6">
            {/* Microservice Settings */}
            <div className="space-y-2">
                <label className="text-sm font-medium">Microservice URL</label>
                <input
                    type="text"
                    value={microserviceUrl}
                    onChange={(e) => onMicroserviceUrlChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="http://localhost:8001"
                    title="Python microservice URL"
                    aria-label="Microservice URL"
                />
                <p className="text-xs text-gray-500">
                    Make sure the Python WAV microservice is running
                </p>
            </div>

            {/* Audio Settings */}
            <div className="space-y-3">
                <h3 className="font-medium">Audio Settings</h3>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-sm text-gray-600" htmlFor="audio-length">Length (ms)</label>
                        <input
                            id="audio-length"
                            type="number"
                            value={config.audio.lengthMs}
                            onChange={(e) => updateConfig(['audio', 'lengthMs'], Number(e.target.value))}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            min="1000"
                            max="10000"
                            step="500"
                            title="Audio clip length in milliseconds"
                        />
                    </div>
                    <div>
                        <label className="text-sm text-gray-600" htmlFor="sample-rate">Sample Rate</label>
                        <select
                            id="sample-rate"
                            value={config.audio.sampleRate}
                            onChange={(e) => updateConfig(['audio', 'sampleRate'], Number(e.target.value))}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            title="Audio sample rate"
                        >
                            <option value={22050}>22.05 kHz</option>
                            <option value={44100}>44.1 kHz</option>
                            <option value={48000}>48 kHz</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Groove Settings */}
            <div className="space-y-3">
                <h3 className="font-medium">Groove</h3>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-sm text-gray-600" htmlFor="tempo-bpm">Tempo (BPM)</label>
                        <input
                            id="tempo-bpm"
                            type="number"
                            value={config.groove.tempoBpm}
                            onChange={(e) => updateConfig(['groove', 'tempoBpm'], Number(e.target.value))}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            min="60"
                            max="200"
                            title="Tempo in beats per minute"
                        />
                    </div>
                    <div>
                        <label className="text-sm text-gray-600" htmlFor="groove-bars">Bars</label>
                        <input
                            id="groove-bars"
                            type="number"
                            value={config.groove.bars}
                            onChange={(e) => updateConfig(['groove', 'bars'], Number(e.target.value))}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            min="1"
                            max="8"
                            title="Number of bars in groove pattern"
                        />
                    </div>
                </div>
            </div>

            {/* Traversal Settings */}
            <div className="space-y-3">
                <h3 className="font-medium">Board Traversal</h3>
                <div>
                    <label className="text-sm text-gray-600" htmlFor="tick-duration">Tick Duration (ms)</label>
                    <input
                        id="tick-duration"
                        type="number"
                        value={config.traversal.tickDurationMs}
                        onChange={(e) => updateConfig(['traversal', 'tickDurationMs'], Number(e.target.value))}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        min="100"
                        max="1000"
                        step="50"
                        title="Duration of each board traversal tick"
                    />
                </div>
            </div>

            {/* Limits Settings */}
            <div className="space-y-3">
                <h3 className="font-medium">Voice Limits</h3>
                <div>
                    <label className="text-sm text-gray-600" htmlFor="max-voices">Max Concurrent Voices</label>
                    <input
                        id="max-voices"
                        type="number"
                        value={config.limits.maxConcurrentVoices}
                        onChange={(e) => updateConfig(['limits', 'maxConcurrentVoices'], Number(e.target.value))}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        min="1"
                        max="16"
                        title="Maximum number of simultaneous sound voices"
                    />
                </div>
            </div>

            {/* Preset Buttons */}
            <div className="space-y-3">
                <h3 className="font-medium">Presets</h3>
                <div className="flex gap-2 flex-wrap">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            updateConfig(['groove', 'tempoBpm'], 90);
                            updateConfig(['audio', 'lengthMs'], 6000);
                            updateConfig(['traversal', 'tickDurationMs'], 400);
                        }}
                    >
                        Slow & Atmospheric
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            updateConfig(['groove', 'tempoBpm'], 140);
                            updateConfig(['audio', 'lengthMs'], 3000);
                            updateConfig(['traversal', 'tickDurationMs'], 200);
                        }}
                    >
                        Fast & Energetic
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            updateConfig(['limits', 'maxConcurrentVoices'], 2);
                            updateConfig(['groove', 'tempoBpm'], 100);
                        }}
                    >
                        Minimal
                    </Button>
                </div>
            </div>

            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                <p>💡 Tip: Adjust settings and click "Play WAV" to hear changes.</p>
                <p>Make sure the Python microservice is running: <code>cd soundAgentsv2 && python main.py</code></p>
            </div>
        </div>
    );
}
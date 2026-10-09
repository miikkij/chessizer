import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { toast } from 'react-hot-toast';
import type { SoundAgentConfig } from '../audio/SoundAgent';
import { fetchSoundAgentConfig, parseSoundAgentConfig, SOUND_CONFIG_STORAGE_KEY, SOUND_CONFIG_URL } from '../config/soundAgentConfig';

interface ConfigEditorProps {
    onConfigChange?: (config: SoundAgentConfig, path: string) => void;
}

export default function ConfigEditor({ onConfigChange }: ConfigEditorProps) {
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [applyError, setApplyError] = useState('');
    const [storageNotice, setStorageNotice] = useState('');
    const [status, setStatus] = useState('');
    const requestRef = useRef<AbortController | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const validation = useMemo(() => parseSoundAgentConfig(content), [content]);

    useEffect(() => {
        const controller = new AbortController();
        requestRef.current = controller;
        async function load() {
            let saved: string | null = null;
            let storageError = '';
            try { saved = localStorage.getItem(SOUND_CONFIG_STORAGE_KEY); }
            catch { storageError = 'Browser storage is unavailable. You can edit and apply a configuration, but your draft cannot be saved.'; }
            const text = saved ?? (await fetchSoundAgentConfig(controller.signal)).text;
            return { text, storageError };
        }
        void load().then(({ text, storageError }) => {
            if (controller.signal.aborted) return;
            setContent(text);
            setStorageNotice(storageError);
            setLoading(false);
        }).catch((cause) => {
            if (controller.signal.aborted) return;
            setLoadError(cause instanceof Error ? cause.message : 'Could not load the sound configuration.');
            setLoading(false);
        });
        return () => {
            controller.abort();
            requestRef.current?.abort();
        };
    }, []);

    const updateDraft = (text: string) => {
        setContent(text);
        setStatus('');
        setApplyError('');
        setLoadError('');
        try {
            localStorage.setItem(SOUND_CONFIG_STORAGE_KEY, text);
            setStorageNotice('');
        } catch {
            setStorageNotice('Your draft could not be saved in this browser. Download it to keep a copy.');
        }
    };

    const loadDefaults = async () => {
        requestRef.current?.abort();
        const controller = new AbortController();
        requestRef.current = controller;
        setLoading(true);
        setLoadError('');
        setApplyError('');
        setStatus('');
        try {
            const defaults = await fetchSoundAgentConfig(controller.signal);
            if (controller.signal.aborted) return;
            setContent(defaults.text);
            try {
                localStorage.removeItem(SOUND_CONFIG_STORAGE_KEY);
                setStorageNotice('');
            } catch { setStorageNotice('Defaults were loaded, but the saved browser draft could not be cleared.'); }
            setStatus('Defaults loaded. Choose Apply to use them.');
        } catch (cause) {
            if (!controller.signal.aborted) setLoadError(cause instanceof Error ? cause.message : 'Could not load the default configuration.');
        } finally {
            if (!controller.signal.aborted) setLoading(false);
        }
    };

    const applyConfig = () => {
        if (!validation.valid || !onConfigChange) return;
        setApplyError('');
        try {
            onConfigChange(structuredClone(validation.config), SOUND_CONFIG_URL);
            setStatus('Sound configuration applied. Press Listen to play.');
            toast.success('Sound configuration applied');
        } catch (cause) {
            setStatus('');
            setApplyError(cause instanceof Error ? cause.message : 'The sound configuration could not be applied.');
        }
    };

    const importFile = async (file: File) => {
        requestRef.current?.abort();
        const controller = new AbortController();
        requestRef.current = controller;
        setLoading(true);
        setStatus('');
        try {
            const text = await file.text();
            if (!controller.signal.aborted) updateDraft(text);
        } catch (cause) {
            if (!controller.signal.aborted) setLoadError(`Could not read ${file.name}: ${cause instanceof Error ? cause.message : 'unknown error'}`);
        } finally {
            if (!controller.signal.aborted) setLoading(false);
        }
    };

    const exportDraft = () => {
        const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'sound-agent-demo.json';
        anchor.click();
        URL.revokeObjectURL(url);
    };

    return <Dialog>
        <DialogTrigger asChild><Button variant="outline" className="w-full">Sound configuration editor</Button></DialogTrigger>
        <DialogContent className="flex h-[85vh] w-[92vw] max-w-4xl flex-col bg-white">
            <DialogHeader>
                <DialogTitle>Sound configuration editor</DialogTitle>
                <DialogDescription>Browser sound only. Drafts stay in this browser; valid changes take effect when you choose Apply.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h3 className="font-semibold">Sound Agent Demo</h3><p className="text-xs text-slate-500">{SOUND_CONFIG_URL}</p></div>
                <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" disabled={loading} onClick={() => fileRef.current?.click()}>Import JSON</Button>
                    <Button size="sm" variant="outline" disabled={loading || !content} onClick={exportDraft}>Download draft</Button>
                    <Button size="sm" variant="outline" disabled={loading} onClick={() => void loadDefaults()}>Load defaults</Button>
                </div>
                <input ref={fileRef} type="file" accept=".json,application/json" aria-label="Import sound configuration file" className="hidden" onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) void importFile(file);
                }} />
            </div>
            {loading ? <p role="status">Loading...</p> : <>
                {loadError && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{loadError}</p>}
                <>
                    <label htmlFor="sound-config-json" className="text-sm font-medium">Sound configuration JSON</label>
                    <textarea id="sound-config-json" value={content} onChange={event => updateDraft(event.target.value)} spellCheck={false} aria-invalid={!validation.valid} aria-describedby={!validation.valid && !loadError ? 'sound-config-errors' : undefined} className="min-h-32 flex-1 resize-none rounded-md border border-slate-300 bg-white p-3 font-mono text-xs text-slate-900" />
                    {!validation.valid && !loadError && <div id="sound-config-errors" role="alert" className="max-h-36 overflow-y-auto rounded-md bg-red-50 p-3 text-sm text-red-800">
                        <p className="font-semibold">Fix the configuration before applying it:</p>
                        <ul className="list-inside list-disc">{validation.errors.slice(0, 12).map((error, index) => <li key={index}>{error}</li>)}</ul>
                        {validation.errors.length > 12 && <p>{validation.errors.length - 12} more errors.</p>}
                    </div>}
                </>
            </>}
            {storageNotice && <p role="status" className="text-sm text-amber-800">{storageNotice}</p>}
            {applyError && <p role="alert" className="text-sm text-red-800">{applyError}</p>}
            {status && <p role="status" className="text-sm text-emerald-800">{status}</p>}
            <div className="mt-auto flex items-center justify-between gap-4 border-t pt-3">
                <p className="text-xs text-slate-500">{!loading && validation.valid ? 'Valid draft. Reloading the app starts with the default sound.' : 'Only valid sound configurations can be applied.'}</p>
                <Button onClick={applyConfig} disabled={loading || !!loadError || !validation.valid || !onConfigChange}>Apply</Button>
            </div>
        </DialogContent>
    </Dialog>;
}

import { useState, useEffect, useCallback } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { toast } from "react-hot-toast";
import Ajv from "ajv";

interface ConfigFile {
    name: string;
    path: string;
    schemaPath?: string;
    content: string;
    isValid: boolean;
    errors: string[];
}

const CONFIG_FILES = [
    {
        name: "Sound Agent Demo",
        path: "/configs/sound-agent-demo.json",
        schemaPath: undefined, // No specific schema for this one
    },
    {
        name: "Sound Presets",
        path: "/configs/sound-presets.json",
        schemaPath: "/schemas/sound-preset.schema.json",
    },
    {
        name: "Game Presets",
        path: "/configs/game-presets.json",
        schemaPath: "/schemas/board-config.schema.json",
    }
];

const STORAGE_PREFIX = "chessizer_config_";

export default function ConfigEditor({ onConfigChange }: { onConfigChange?: (config: unknown, type: string) => void }) {
    const [configs, setConfigs] = useState<ConfigFile[]>([]);
    const [activeConfigIndex, setActiveConfigIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [schemas, setSchemas] = useState<Record<string, unknown>>({});

    // Load schemas
    useEffect(() => {
        const loadSchemas = async () => {
            const schemaMap: Record<string, unknown> = {};
            for (const configFile of CONFIG_FILES) {
                if (configFile.schemaPath) {
                    try {
                        const response = await fetch(configFile.schemaPath);
                        const schema = await response.json();
                        schemaMap[configFile.path] = schema;
                    } catch (error) {
                        console.warn(`Failed to load schema for ${configFile.name}:`, error);
                    }
                }
            }
            setSchemas(schemaMap);
        };

        loadSchemas();
    }, []);

    // Load all config files
    const loadConfigs = useCallback(async () => {
        setLoading(true);
        const loadedConfigs: ConfigFile[] = [];

        for (const configFile of CONFIG_FILES) {
            try {
                // First try to load from localStorage
                const storageKey = STORAGE_PREFIX + configFile.path.replace(/[/.]/g, "_");
                let content = localStorage.getItem(storageKey);

                // If not in localStorage, load from server
                if (!content) {
                    const response = await fetch(configFile.path);
                    content = await response.text();
                }

                // Validate JSON syntax
                let isValid = true;
                const errors: string[] = [];
                let parsedContent;

                try {
                    parsedContent = JSON.parse(content);
                } catch (error) {
                    isValid = false;
                    errors.push(`JSON syntax error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }

                // Validate against schema if available
                if (isValid && parsedContent && schemas[configFile.path]) {
                    const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
                    const schema = schemas[configFile.path] as object;
                    const validate = ajv.compile(schema);
                    if (!validate(parsedContent)) {
                        isValid = false;
                        errors.push(...(validate.errors?.map(err =>
                            `${err.instancePath || 'root'}: ${err.message}`
                        ) || []));
                    }
                }

                loadedConfigs.push({
                    name: configFile.name,
                    path: configFile.path,
                    schemaPath: configFile.schemaPath,
                    content,
                    isValid,
                    errors
                });
            } catch (error) {
                loadedConfigs.push({
                    name: configFile.name,
                    path: configFile.path,
                    schemaPath: configFile.schemaPath,
                    content: `// Failed to load: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    isValid: false,
                    errors: [`Failed to load: ${error instanceof Error ? error.message : 'Unknown error'}`]
                });
            }
        }

        setConfigs(loadedConfigs);
        setLoading(false);
    }, [schemas]);

    // Load configs when schemas are loaded
    useEffect(() => {
        if (Object.keys(schemas).length > 0) {
            loadConfigs();
        }
    }, [schemas, loadConfigs]);

    const handleContentChange = (newContent: string) => {
        const updatedConfigs = [...configs];
        const config = updatedConfigs[activeConfigIndex];

        config.content = newContent;

        // Validate JSON syntax
        let isValid = true;
        const errors: string[] = [];
        let parsedContent;

        try {
            parsedContent = JSON.parse(newContent);
        } catch (error) {
            isValid = false;
            errors.push(`JSON syntax error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // Validate against schema if available
        if (isValid && parsedContent && schemas[config.path]) {
            const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
            const schema = schemas[config.path] as object;
            const validate = ajv.compile(schema);
            if (!validate(parsedContent)) {
                isValid = false;
                errors.push(...(validate.errors?.map(err =>
                    `${err.instancePath || 'root'}: ${err.message}`
                ) || []));
            }
        }

        config.isValid = isValid;
        config.errors = errors;

        setConfigs(updatedConfigs);

        // Auto-save to localStorage
        const storageKey = STORAGE_PREFIX + config.path.replace(/[/.]/g, "_");
        localStorage.setItem(storageKey, newContent);

        // Notify parent component if config is valid
        if (isValid && parsedContent && onConfigChange) {
            onConfigChange(parsedContent, config.path);
        }
    };

    const resetConfig = async (index: number) => {
        try {
            const config = configs[index];
            const storageKey = STORAGE_PREFIX + config.path.replace(/[/.]/g, "_");

            // Remove from localStorage
            localStorage.removeItem(storageKey);

            // Reload from server
            const response = await fetch(config.path);
            const content = await response.text();

            const updatedConfigs = [...configs];
            updatedConfigs[index].content = content;

            // Re-validate
            let isValid = true;
            const errors: string[] = [];
            let parsedContent;

            try {
                parsedContent = JSON.parse(content);
            } catch (error) {
                isValid = false;
                errors.push(`JSON syntax error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }

            if (isValid && parsedContent && schemas[config.path]) {
                const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
                const schema = schemas[config.path] as object;
                const validate = ajv.compile(schema);
                if (!validate(parsedContent)) {
                    isValid = false;
                    errors.push(...(validate.errors?.map(err =>
                        `${err.instancePath || 'root'}: ${err.message}`
                    ) || []));
                }
            }

            updatedConfigs[index].isValid = isValid;
            updatedConfigs[index].errors = errors;

            setConfigs(updatedConfigs);
            toast.success(`Reset ${config.name} to default`);

            if (isValid && parsedContent && onConfigChange) {
                onConfigChange(parsedContent, config.path);
            }
        } catch (error) {
            toast.error(`Failed to reset config: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const exportConfig = (index: number) => {
        const config = configs[index];
        const blob = new Blob([config.content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${config.name.toLowerCase().replace(/\s+/g, '-')}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Exported ${config.name}`);
    };

    const importConfig = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const content = e.target?.result as string;
                    handleContentChange(content);
                    const activeConfig = configs[activeConfigIndex];
                    toast.success(`Imported ${activeConfig.name}`);
                };
                reader.readAsText(file);
            }
        };
        input.click();
    };

    const activeConfig = configs[activeConfigIndex];

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white shadow-lg px-4 py-3 font-semibold text-base rounded-lg transition-all transform hover:scale-105">
                    ⚙️ Config Editor
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl w-[90vw] h-[80vh] flex flex-col bg-white border-gray-200">
                <DialogHeader className="border-b border-gray-200 pb-4">
                    <DialogTitle className="text-xl font-bold text-gray-900">Configuration Editor</DialogTitle>
                </DialogHeader>

                {/* Content */}
                <div className="flex flex-1 overflow-hidden min-h-0 bg-white">
                    {/* Sidebar */}
                    <div className="w-64 border-r border-gray-200 p-4 overflow-y-auto bg-gray-50">
                        <h3 className="font-semibold mb-3 text-gray-900">Configuration Files</h3>
                        {loading ? (
                            <div className="text-sm text-gray-500">Loading...</div>
                        ) : (
                            <div className="space-y-2">
                                {configs.map((config, index) => (
                                    <div
                                        key={config.path}
                                        className={`p-2 rounded cursor-pointer text-sm ${index === activeConfigIndex
                                            ? 'bg-blue-100 text-blue-800'
                                            : 'hover:bg-gray-100'
                                            }`}
                                        onClick={() => setActiveConfigIndex(index)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div
                                                className={`w-2 h-2 rounded-full ${config.isValid ? 'bg-green-500' : 'bg-red-500'
                                                    }`}
                                            />
                                            <span className="font-medium">{config.name}</span>
                                        </div>
                                        {config.errors.length > 0 && (
                                            <div className="text-xs text-red-600 mt-1">
                                                {config.errors.length} error{config.errors.length !== 1 ? 's' : ''}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Main Editor */}
                    <div className="flex-1 flex flex-col min-w-0 bg-white">
                        {activeConfig && (
                            <>
                                {/* Toolbar */}
                                <div className="p-4 border-b border-gray-200 flex items-center justify-between shrink-0 bg-white">
                                    <div className="min-w-0">
                                        <h4 className="font-semibold truncate text-gray-900">{activeConfig.name}</h4>
                                        <p className="text-sm text-gray-600 truncate">{activeConfig.path}</p>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <Button
                                            onClick={() => importConfig()}
                                            variant="outline"
                                            size="sm"
                                        >
                                            📁 Import
                                        </Button>
                                        <Button
                                            onClick={() => exportConfig(activeConfigIndex)}
                                            variant="outline"
                                            size="sm"
                                        >
                                            💾 Export
                                        </Button>
                                        <Button
                                            onClick={() => resetConfig(activeConfigIndex)}
                                            variant="outline"
                                            size="sm"
                                        >
                                            🔄 Reset
                                        </Button>
                                    </div>
                                </div>

                                {/* Error Display */}
                                {activeConfig.errors.length > 0 && (
                                    <div className="p-4 bg-red-50 border-b border-red-200 shrink-0">
                                        <h5 className="font-semibold text-red-800 mb-2">Validation Errors:</h5>
                                        <ul className="text-sm text-red-700 space-y-1 max-h-20 overflow-y-auto">
                                            {activeConfig.errors.map((error, index) => (
                                                <li key={index} className="font-mono">• {error}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Editor */}
                                <div className="flex-1 p-4 min-h-0 bg-white">
                                    <textarea
                                        value={activeConfig.content}
                                        onChange={(e) => handleContentChange(e.target.value)}
                                        className="w-full h-full font-mono text-sm border border-gray-300 rounded p-3 resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                                        spellCheck={false}
                                        placeholder="JSON configuration..."
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 bg-gray-50 text-sm text-gray-700 shrink-0">
                    💡 Changes are automatically saved to localStorage. Use Reset to restore defaults.
                    {activeConfig?.isValid && (
                        <span className="ml-4 text-green-600 font-semibold">✅ Configuration is valid</span>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
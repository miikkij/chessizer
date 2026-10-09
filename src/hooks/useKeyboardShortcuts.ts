/**
 * Custom hook for keyboard shortcuts.
 * Space = play/stop, Arrow keys = navigate, Home/End = first/last move.
 */
import { useEffect } from "react";

interface ShortcutActions {
    onPlayToggle: () => void;
    onPrev: () => void;
    onNext: () => void;
    onFirst: () => void;
    onLast: () => void;
}

export function useKeyboardShortcuts(actions: ShortcutActions) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Let interactive controls and dialogs keep their native keyboard behavior.
            const target = e.target instanceof HTMLElement ? e.target : null;
            if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey ||
                target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="slider"]')) return;
            if (e.key === ' ' && target?.closest('button, a, summary')) return;
            if (e.key === ' ' && e.repeat) return;

            switch (e.key) {
                case ' ': // Space = play/stop toggle
                    e.preventDefault();
                    actions.onPlayToggle();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    actions.onPrev();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    actions.onNext();
                    break;
                case 'Home':
                    e.preventDefault();
                    actions.onFirst();
                    break;
                case 'End':
                    e.preventDefault();
                    actions.onLast();
                    break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [actions]);
}

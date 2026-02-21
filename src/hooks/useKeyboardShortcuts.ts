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
            // Don't intercept if user is typing in an input/textarea/select
            const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

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

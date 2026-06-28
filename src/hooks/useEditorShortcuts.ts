'use client';

import { useEffect } from 'react';
import { useCircuitStore } from '@/store/circuitStore';

export function useEditorShortcuts() {
  const { undo, redo, cancelPlacement, setZoom, zoom } = useCircuitStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input field (for future-proofing)
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      // Undo: Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      // Redo: Ctrl+Shift+Z or Cmd+Shift+Z or Ctrl+Y
      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y')
      ) {
        e.preventDefault();
        redo();
      }

      // Escape: Cancel placement
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelPlacement();
      }

      // Ctrl+0 or Cmd+0: Reset Zoom
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        setZoom(100);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, cancelPlacement, setZoom, zoom]);
}

'use client';

import { useRef, useState, useEffect } from 'react';
import { useCircuitStore } from '@/store/circuitStore';
import CircuitGrid from './CircuitGrid';

/**
 * Wrapper for the circuit editing area.
 * Provides scroll/overflow handling and visual container.
 */
export default function CircuitEditor() {
  const { zoom, setZoom } = useCircuitStore();
  const containerRef = useRef<HTMLElement>(null);
  const [isSpaceDown, setIsSpaceDown] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ left: 0, top: 0 });

  // Handle Spacebar state
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' && 
        document.activeElement?.tagName !== 'INPUT' && 
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        setIsSpaceDown(true);
        e.preventDefault(); // Prevent page scroll
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpaceDown(false);
        setIsDragging(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isSpaceDown && containerRef.current) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setScrollStart({
        left: containerRef.current.scrollLeft,
        top: containerRef.current.scrollTop,
      });
      // Capture pointer so we can track outside the container
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging && containerRef.current) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      containerRef.current.scrollLeft = scrollStart.left - dx;
      containerRef.current.scrollTop = scrollStart.top - dy;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.shiftKey) {
      e.preventDefault();
      // Adjust zoom based on scroll direction
      const newZoom = zoom - (e.deltaY > 0 ? 10 : -10);
      setZoom(newZoom);
    }
  };

  return (
    <section
      id="circuit-editor"
      ref={containerRef}
      className={`flex-1 overflow-auto p-6 bg-background ${isSpaceDown ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      // Ensure touch-action allows panning normally unless space is down (mostly for desktop though)
      style={{ touchAction: isSpaceDown ? 'none' : 'auto' }}
    >
      <div 
        className="inline-block min-w-fit origin-top-left transition-transform duration-200"
        style={{ transform: `scale(${zoom / 100})` }}
      >
        <CircuitGrid />
      </div>
    </section>
  );
}

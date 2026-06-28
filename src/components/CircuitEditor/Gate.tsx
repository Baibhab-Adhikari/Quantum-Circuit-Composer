'use client';

import { useCircuitStore } from '@/store/circuitStore';
import type { GateInstance } from '@/types/circuit';
import { GATE_MAP } from '@/constants/gates';
import { useDraggable } from '@dnd-kit/core';

interface GateProps {
  gate: GateInstance;
}

/**
 * Renders a quantum gate placed on the circuit grid.
 * Handles single-qubit gates, measurement, and the target symbol for CNOT.
 * For CNOT (CX), also renders the vertical connecting line.
 */
export default function Gate({ gate }: GateProps) {
  const removeGate = useCircuitStore((s) => s.removeGate);
  const def = GATE_MAP.get(gate.type);

  if (!def) return null;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `grid-gate-${gate.id}`,
    data: {
      source: 'grid',
      gateId: gate.id,
      gateType: gate.type,
    },
  });

  const isTargetSymbol = gate.type === 'CX' || gate.type === 'CCX';

  const hasControls = gate.controls && gate.controls.length > 0;

  // Calculate vertical line connecting min row to max row among all targets and controls
  let cxLineHeight = 0;
  let cxLineTop = 0;
  
  if (hasControls) {
    const allRows = [...gate.targets.map(t => t.row), ...gate.controls.map(c => c.row)];
    const minRow = Math.min(...allRows);
    const maxRow = Math.max(...allRows);
    const diff = maxRow - minRow;
    
    // Each row is 48px + 4px gap = 52px
    cxLineHeight = diff * 52;
    
    // Find the offset of the top-most component relative to this target's position
    // Since this Gate component is rendered at targets[0], its row is targets[0].row.
    // The top of the line should start at (minRow - targets[0].row) * 52
    cxLineTop = (minRow - gate.targets[0].row) * 52 + 24; // +24 centers it vertically in the 48px cell
    cxLineHeight = cxLineHeight; // line height is total distance
  }

  return (
    <>
      {/* Connecting vertical line */}
      {hasControls && (
        <div
          className="absolute w-0.5 bg-foreground pointer-events-none z-0"
          style={{
            height: `${cxLineHeight}px`,
            top: `${cxLineTop}px`,
            left: 'calc(50% - 1px)',
          }}
        />
      )}

      {/* Main Gate Symbol */}
      <button
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        onClick={(e) => {
          e.stopPropagation();
          removeGate(gate.id);
        }}
        className={`group relative z-10 flex items-center justify-center w-9 h-9 rounded shadow-sm border border-transparent transition-transform focus:outline-none ${
          isDragging ? 'opacity-30 cursor-grabbing' : 'hover:scale-110 cursor-grab'
        }`}
        style={{
          backgroundColor: isTargetSymbol ? undefined : `color-mix(in oklch, ${def.color}, transparent 88%)`,
          boxShadow: isTargetSymbol ? undefined : `0 2px 8px color-mix(in oklch, ${def.color}, transparent 80%)`,
          outline: isTargetSymbol ? undefined : `1px solid ${def.color}`,
        }}
        title={`Remove ${def.name}`}
      >
        {isTargetSymbol ? (
          // CX/CCX Target Symbol (⊕)
          <div className="relative flex items-center justify-center w-8 h-8 rounded-full border-[1.5px] border-foreground bg-background">
            <div className="absolute w-full h-[1.5px] bg-foreground" />
            <div className="absolute h-full w-[1.5px] bg-foreground" />
          </div>
        ) : gate.type === 'Measure' ? (
          // Measurement Meter Symbol
          <div
            className="flex items-center justify-center"
            style={{ color: def.color }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 17a9 9 0 0 1 18 0" />
              <path d="M12 17l6-8" />
              <path d="M14 9h4v4" />
            </svg>
          </div>
        ) : (
          // Standard Gate Box
          <span
            className="text-sm font-bold font-mono leading-none"
            style={{ color: def.color }}
          >
            {def.abbreviation}
          </span>
        )}

        {/* Hover overlay for removal */}
        <div className="absolute inset-0 flex items-center justify-center rounded bg-destructive/90 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
      </button>
    </>
  );
}

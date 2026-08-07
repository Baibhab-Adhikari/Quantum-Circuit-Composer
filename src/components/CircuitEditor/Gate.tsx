'use client';

import { useCircuitStore } from '@/store/circuitStore';
import type { GateInstance } from '@/types/circuit';
import { GATE_MAP } from '@/constants/gates';
import { useDraggable } from '@dnd-kit/core';
import { formatAngle } from '@/utils/validation';

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
  const activeActionMenuId = useCircuitStore((s) => s.activeActionMenuId);
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
  const isCUGate = gate.type === 'CU';
  const isBridge = gate.type === 'B1' || gate.type === 'B2';

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
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          // We could use context menu, but for now we'll just allow them to use edit button or similar.
          // Wait, actually, let's use a simple double click or right click to trigger edit.
          // Since it's a drag element, right click is safer.
          if (def.isParameterized || def.isCustomUnitary || def.category === 'multi-qubit' || def.category === 'controlled-unitary') {
            useCircuitStore.getState().editGateParams(gate.id);
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
          const store = useCircuitStore.getState();
          if (store.activeActionMenuId === gate.id) {
            store.setActiveActionMenu(null);
          } else {
            store.setActiveActionMenu(gate.id);
          }
        }}
        className={`group relative z-10 flex flex-col items-center justify-center w-9 h-9 rounded shadow-sm border border-transparent transition-transform focus:outline-none ${
          isDragging ? 'opacity-30 cursor-grabbing' : 'hover:scale-110 cursor-grab'
        }`}
        style={{
          backgroundColor: isTargetSymbol ? undefined : isBridge
            ? `color-mix(in oklch, ${def.color}, transparent 92%)`
            : `color-mix(in oklch, ${def.color}, transparent 88%)`,
          boxShadow: (isTargetSymbol || isBridge) ? undefined : `0 2px 8px color-mix(in oklch, ${def.color}, transparent 80%)`,
          outline: isTargetSymbol ? undefined : isBridge
            ? `1.5px dashed ${def.color}`
            : `1px solid ${def.color}`,
          borderRadius: isBridge ? '4px' : undefined,
        }}
      >
        {isTargetSymbol ? (
          // CX/CCX Target Symbol (⊕)
          <div className="relative flex items-center justify-center w-8 h-8 rounded-full border-[1.5px] border-foreground bg-background">
            <div className="absolute w-full h-[1.5px] bg-foreground" />
            <div className="absolute h-full w-[1.5px] bg-foreground" />
          </div>
        ) : isCUGate ? (
          // CU Target Symbol (⊕ with U badge)
          <div className="relative flex items-center justify-center w-8 h-8 rounded-full border-[1.5px] bg-background" style={{ borderColor: def.color }}>
            <span className="text-xs font-bold font-mono" style={{ color: def.color }}>U</span>
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
        ) : def.isCustomUnitary ? (
          <span
            className="text-sm font-bold font-mono leading-none flex items-center justify-center"
            style={{ color: def.color }}
          >
            U
            <span className="text-[8px] absolute bottom-0.5 right-0.5 opacity-70">
              [ ]
            </span>
          </span>
        ) : isBridge ? (
          // Bridge scheduling placeholder
          <div className="flex flex-col items-center justify-center" style={{ color: def.color }}>
            <span className="text-[10px] font-medium font-mono leading-none italic opacity-80">
              {def.abbreviation}
            </span>
          </div>
        ) : (
          // Standard Gate Box
          <div className="flex flex-col items-center justify-center" style={{ color: def.color }}>
            <span className="text-sm font-bold font-mono leading-none">
              {def.abbreviation}
            </span>
            {def.isParameterized && gate.params?.theta !== undefined && (
              <span className="text-[7px] font-mono mt-0.5 leading-none opacity-80" style={{ transform: 'scale(0.9)' }}>
                {formatAngle(gate.params.theta)}
              </span>
            )}
          </div>
        )}

        {/* Action menu tooltip (Click-to-open) */}
        {activeActionMenuId === gate.id && (
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-1 p-1 rounded bg-popover text-popover-foreground shadow-md transition-opacity z-50 border border-border">
            {!isBridge && (def.isParameterized || def.isCustomUnitary || def.category === 'multi-qubit' || def.category === 'controlled-unitary') && (
              <button
                className="p-1 rounded hover:bg-muted transition-colors"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  useCircuitStore.getState().editGateParams(gate.id);
                  useCircuitStore.getState().setActiveActionMenu(null);
                }}
                title="Edit"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
            )}
            {(def.isCustomUnitary && gate.type === 'U') && (
              <button
                className="p-1 rounded hover:bg-muted transition-colors text-blue-500"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  useCircuitStore.getState().decompose(gate.id);
                  useCircuitStore.getState().setActiveActionMenu(null);
                }}
                title="Decompose (ZYZ)"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>
              </button>
            )}
            {gate.type === 'CU' && (
              <button
                className="p-1 rounded hover:bg-muted transition-colors text-blue-500"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  useCircuitStore.getState().decomposeCU(gate.id);
                  useCircuitStore.getState().setActiveActionMenu(null);
                }}
                title="Decompose (A→CX→B→CX→C)"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>
              </button>
            )}
            <button
              className="p-1 rounded hover:bg-destructive/20 text-destructive transition-colors"
              onPointerDown={(e) => {
                e.stopPropagation();
                removeGate(gate.id);
                useCircuitStore.getState().setActiveActionMenu(null);
              }}
              title="Remove"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </>
  );
}

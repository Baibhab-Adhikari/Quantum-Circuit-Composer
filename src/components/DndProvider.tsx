'use client';

import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  defaultDropAnimationSideEffects,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { useCircuitStore } from '@/store/circuitStore';
import { GATE_MAP } from '@/constants/gates';

const dropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: '0.4',
      },
    },
  }),
};

export default function DndProvider({ children }: { children: React.ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeData, setActiveData] = useState<any>(null);

  // We use PointerSensor to distinguish clicks from drags. 
  // A small activation constraint ensures clicking a gate doesn't start a drag immediately.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setActiveData(event.active.data.current);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    setActiveData(null);

    const { active, over } = event;
    if (!over || !over.data.current) return;

    const dropData = over.data.current as { row: number; col: number };
    const dragData = active.data.current;
    if (!dragData) return;

    const { row, col } = dropData;
    const store = useCircuitStore.getState();

    // Helper to check if a cell is occupied
    const isOccupied = (r: number, c: number, ignoreGateId?: string) => {
      if (
        store.placementSession?.controlsPlaced.some(p => p.row === r && p.col === c) ||
        store.placementSession?.targetsPlaced.some(p => p.row === r && p.col === c)
      ) {
        return true;
      }
      return store.operations.some((op) => {
        if (op.id === ignoreGateId) return false;
        if (op.targets.some(tgt => tgt.row === r && tgt.col === c)) return true;
        if (op.controls.some(ctrl => ctrl.row === r && ctrl.col === c)) return true;
        return false;
      });
    };

    if (dragData.source === 'palette') {
      const gateType = dragData.gateType;
      // Use the generic placement pipeline!
      store.startPlacement(gateType);
      store.handleGridClick(row, col);
    } else if (dragData.source === 'grid') {
      const gateId = dragData.gateId;
      const gate = store.operations.find((o) => o.id === gateId);
      if (!gate) return;

      const rowOffset = row - gate.targets[0].row;
      let isValid = true;

      const newTargets = gate.targets.map(t => ({ row: t.row + rowOffset, col }));
      const newControls = gate.controls.map(c => ({ row: c.row + rowOffset, col }));

      for (const t of newTargets) {
        if (t.row < 0 || t.row >= store.qubits.length) isValid = false;
        if (isOccupied(t.row, t.col, gateId)) isValid = false;
      }
      for (const c of newControls) {
        if (c.row < 0 || c.row >= store.qubits.length) isValid = false;
        if (isOccupied(c.row, c.col, gateId)) isValid = false;
      }

      if (isValid) {
        store.moveGate(gateId, { row, col });
      }
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setActiveData(null);
  };

  // Render the drag overlay based on activeData
  const renderOverlay = () => {
    if (!activeData) return null;
    const def = GATE_MAP.get(activeData.gateType);
    if (!def) return null;

    if (def.type === 'CX' || def.type === 'CCX') {
      return (
        <div className="relative flex items-center justify-center w-5 h-5 rounded-full opacity-80 bg-foreground/20">
          <div className="w-3.5 h-3.5 rounded-full bg-foreground shadow-xl" />
        </div>
      );
    } else if (def.type === 'Measure') {
      return (
        <div
          className="flex items-center justify-center w-9 h-9 rounded shadow-xl bg-card border opacity-80"
          style={{ borderColor: def.color, color: def.color }}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 17a9 9 0 0 1 18 0" />
            <path d="M12 17l6-8" />
            <path d="M14 9h4v4" />
          </svg>
        </div>
      );
    } else {
      return (
        <div
          className="flex items-center justify-center w-9 h-9 rounded shadow-xl opacity-80"
          style={{
            backgroundColor: `color-mix(in oklch, ${def.color}, transparent 88%)`,
            outline: `1px solid ${def.color}`,
          }}
        >
          <span
            className="text-sm font-bold font-mono leading-none"
            style={{ color: def.color }}
          >
            {def.abbreviation}
          </span>
        </div>
      );
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {children}
      <DragOverlay dropAnimation={dropAnimation}>
        {activeId ? renderOverlay() : null}
      </DragOverlay>
    </DndContext>
  );
}

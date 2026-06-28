'use client';

import { useCircuitStore } from '@/store/circuitStore';
import { GATE_MAP } from '@/constants/gates';
import { useDroppable, useDndContext } from '@dnd-kit/core';
import Gate from './Gate';

interface GridCellProps {
  row: number;
  col: number;
}

export default function GridCell({ row, col }: GridCellProps) {
  const {
    operations,
    placementSession,
    handleGridClick,
  } = useCircuitStore();

  const gateInstance = operations.find(
    (g) => g.targets.some(t => t.row === row && t.col === col) || g.controls.some(c => c.row === row && c.col === col)
  );

  const asTarget = gateInstance?.targets.some(t => t.row === row && t.col === col);
  const asControl = gateInstance?.controls.some(c => c.row === row && c.col === col);
  const isPendingControl = placementSession?.controlsPlaced.some(c => c.row === row && c.col === col);
  const isPendingTarget = placementSession?.targetsPlaced.some(t => t.row === row && t.col === col);
  
  const isOccupied = !!gateInstance || isPendingControl || isPendingTarget;

  const { isOver, setNodeRef } = useDroppable({
    id: `cell-${row}-${col}`,
    data: { row, col },
  });

  const { active: activeDrag } = useDndContext();

  const handleClick = () => {
    handleGridClick(row, col);
  };

  return (
    <div
      ref={setNodeRef}
      id={`grid-cell-${row}-${col}`}
      className={`
        relative flex items-center justify-center
        w-12 h-12 border border-border/40
        rounded-md
        transition-colors duration-100
        ${!isOccupied && placementSession && !activeDrag ? 'cursor-pointer hover:bg-accent/50 hover:border-accent-foreground/20' : ''}
        ${isOccupied ? 'cursor-default' : ''}
        ${isOver && !isOccupied ? 'bg-accent/50 border-accent-foreground/30' : ''}
        ${isOver && isOccupied ? 'bg-destructive/20 border-destructive/50' : ''}
      `}
      onClick={handleClick}
      data-row={row}
      data-col={col}
    >
      {/* Wire line passes through the center of each cell */}
      <div className="absolute inset-y-0 left-0 right-0 flex items-center pointer-events-none">
        <div className="w-full h-px bg-muted-foreground/50" />
      </div>

      {/* Hover feedback for placement (only show if not currently dragging) */}
      {!isOccupied && placementSession && !activeDrag && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-30 pointer-events-none transition-opacity">
          {(() => {
            const def = GATE_MAP.get(placementSession.gateType);
            if (!def) return null;
            if (placementSession.controlsPlaced.length < def.numControls) {
              return <div className="w-4 h-4 rounded-full bg-foreground shadow-sm" />;
            } else if (def.type === 'CX') {
              return (
                <div className="relative flex items-center justify-center w-8 h-8 rounded-full border-2 border-foreground bg-background shadow-sm">
                  <div className="absolute w-full h-0.5 bg-foreground" />
                  <div className="absolute h-full w-0.5 bg-foreground" />
                </div>
              );
            } else if (def.type === 'CCX') {
              return (
                <div className="relative flex items-center justify-center w-8 h-8 rounded-full border-2 border-foreground bg-background shadow-sm">
                  <div className="absolute w-full h-0.5 bg-foreground" />
                  <div className="absolute h-full w-0.5 bg-foreground" />
                </div>
              );
            } else if (def.type === 'Measure') {
              return (
                <svg className="w-5 h-5 text-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 17a9 9 0 0 1 18 0" />
                  <path d="M12 17l6-8" />
                  <path d="M14 9h4v4" />
                </svg>
              );
            } else {
              return (
                <span className="text-lg font-bold font-mono text-foreground">
                  {def.abbreviation}
                </span>
              );
            }
          })()}
        </div>
      )}

      {/* Render the placed gate if this cell is the main target */}
      {gateInstance && asTarget && gateInstance.targets[0].row === row && gateInstance.targets[0].col === col && (
        <Gate gate={gateInstance} />
      )}
      
      {/* For CX/CCX Control dots already placed */}
      {asControl && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <div className="w-3 h-3 rounded-full bg-foreground shadow-sm" />
        </div>
      )}

      {/* Pending placement control dot */}
      {isPendingControl && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-3.5 h-3.5 rounded-full bg-foreground shadow-md ring-2 ring-primary ring-offset-1 ring-offset-background animate-pulse" />
        </div>
      )}
    </div>
  );
}

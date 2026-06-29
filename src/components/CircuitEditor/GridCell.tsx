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
    handleGridClick,
  } = useCircuitStore();

  const gateInstance = operations.find(
    (g) => g.targets.some(t => t.row === row && t.col === col) || g.controls.some(c => c.row === row && c.col === col)
  );

  const asTarget = gateInstance?.targets.some(t => t.row === row && t.col === col);
  const asControl = gateInstance?.controls.some(c => c.row === row && c.col === col);
  const isOccupied = !!gateInstance;

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
        ${!isOccupied && !activeDrag ? 'cursor-pointer hover:bg-accent/50 hover:border-accent-foreground/20' : ''}
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

      {/* Removed Hover feedback for placement */}

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


    </div>
  );
}

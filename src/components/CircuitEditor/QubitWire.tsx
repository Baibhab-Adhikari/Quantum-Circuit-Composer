'use client';

import GridCell from './GridCell';

interface QubitWireProps {
  qubitIndex: number;
  qubitLabel: string;
  numColumns: number;
}

/**
 * A single row in the circuit grid — the qubit label + wire cells.
 * Renders one GridCell per column with a label on the left.
 */
export default function QubitWire({ qubitIndex, qubitLabel, numColumns }: QubitWireProps) {
  return (
    <div className="flex items-center gap-0" id={`qubit-wire-${qubitIndex}`}>
      {/* Qubit label */}
      <div className="flex items-center justify-end w-14 pr-3 shrink-0">
        <span className="text-xs font-mono font-medium text-muted-foreground select-none">
          {qubitLabel}
        </span>
        <span className="text-[10px] text-muted-foreground/60 ml-0.5 select-none">
          ⟩
        </span>
      </div>

      {/* Ket label connector */}
      <div className="flex items-center shrink-0 w-3">
        <div className="w-full h-px bg-muted-foreground/50" />
      </div>

      {/* Grid cells */}
      <div className="flex items-center gap-0.5">
        {Array.from({ length: numColumns }, (_, col) => (
          <GridCell key={col} row={qubitIndex} col={col} />
        ))}
      </div>
    </div>
  );
}

'use client';

import { useCircuitStore } from '@/store/circuitStore';
import QubitWire from './QubitWire';

/**
 * The circuit grid — renders rows of qubit wires.
 * Column headers show timestep indices.
 * Reads entirely from the Zustand store.
 */
export default function CircuitGrid() {
  const qubits = useCircuitStore((s) => s.qubits);
  const numColumns = useCircuitStore((s) => s.numColumns);

  return (
    <div id="circuit-grid" className="flex flex-col gap-1">
      {/* Column headers */}
      <div className="flex items-center">
        {/* Spacer for qubit labels */}
        <div className="w-14 shrink-0" />
        <div className="w-3 shrink-0" />

        <div className="flex items-center gap-0.5">
          {Array.from({ length: numColumns }, (_, col) => (
            <div
              key={col}
              className="w-12 flex items-center justify-center"
            >
              <span className="text-[9px] font-mono text-muted-foreground/40 select-none">
                {col}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Qubit wires */}
      {qubits.map((qubit, idx) => (
        <QubitWire
          key={qubit.id}
          qubitIndex={idx}
          qubitLabel={qubit.label}
          numColumns={numColumns}
        />
      ))}
    </div>
  );
}

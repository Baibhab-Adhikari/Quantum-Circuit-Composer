'use client';

import { useCircuitStore } from '@/store/circuitStore';
import { GATE_MAP } from '@/constants/gates';

/**
 * Status bar showing circuit metadata at a glance.
 * Displays qubit count, circuit depth, and selected gate.
 */
export default function StatusBar() {
  const qubits = useCircuitStore((s) => s.qubits);
  const numColumns = useCircuitStore((s) => s.numColumns);
  const selectedGateType = useCircuitStore((s) => s.selectedGateType);

  const selectedGate = selectedGateType ? GATE_MAP.get(selectedGateType) : null;

  return (
    <footer
      id="status-bar"
      className="flex items-center justify-between border-t border-border bg-card px-4 py-1.5 text-xs text-muted-foreground select-none"
    >
      <div className="flex items-center gap-4">
        <span>
          <span className="font-medium text-foreground">{qubits.length}</span>{' '}
          qubit{qubits.length !== 1 ? 's' : ''}
        </span>
        <span className="text-border">|</span>
        <span>
          Depth:{' '}
          <span className="font-medium text-foreground">{numColumns}</span>
        </span>
      </div>

      <div className="flex items-center gap-2">
        {selectedGate ? (
          <>
            <span>Selected:</span>
            <span
              className="font-semibold font-mono"
              style={{ color: selectedGate.color }}
            >
              {selectedGate.name}
            </span>
          </>
        ) : (
          <span className="italic">No gate selected</span>
        )}
      </div>
    </footer>
  );
}

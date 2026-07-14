'use client';

import { useState, useEffect } from 'react';
import { useCircuitStore } from '@/store/circuitStore';
import { Button } from '@/components/ui/button';
import { GATE_MAP } from '@/constants/gates';

export default function MultiQubitDialog() {
  const pendingMultiQubitGate = useCircuitStore(s => s.pendingMultiQubitGate);
  const qubits = useCircuitStore(s => s.qubits);
  
  const [targetRows, setTargetRows] = useState<number[]>([]);
  const [controlRows, setControlRows] = useState<number[]>([]);

  useEffect(() => {
    if (pendingMultiQubitGate?.gate) {
      setTargetRows(pendingMultiQubitGate.gate.targets.map(t => t.row));
      setControlRows(pendingMultiQubitGate.gate.controls.map(c => c.row));
    } else {
      setTargetRows([]);
      setControlRows([]);
    }
  }, [pendingMultiQubitGate]);

  if (!pendingMultiQubitGate) return null;

  const { gate, resolve, reject } = pendingMultiQubitGate;
  const def = GATE_MAP.get(gate.type);
  if (!def) return null;

  // Validation
  const allSelectedRows = [...targetRows, ...controlRows];
  const uniqueRows = new Set(allSelectedRows);
  const isUnique = uniqueRows.size === allSelectedRows.length;
  
  const isValid = isUnique && allSelectedRows.every(r => r >= 0 && r < qubits.length);

  const handleConfirm = () => {
    if (isValid) {
      // Reconstruct the new gate with updated targets and controls
      // Keeping the original column (which is the same for all parts of the gate)
      const col = gate.targets[0].col;
      
      const newGate = {
        ...gate,
        targets: targetRows.map(row => ({ row, col })),
        controls: controlRows.map(row => ({ row, col }))
      };
      resolve(newGate);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="bg-card border border-border shadow-lg rounded-xl w-[320px] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border bg-muted/30">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <span className="text-sm font-bold font-mono px-1.5 py-0.5 rounded border bg-background" style={{ color: def.color, borderColor: def.color }}>
              {def.abbreviation}
            </span>
            Configure Qubits
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {def.description}
          </p>
        </div>
        
        <div className="p-4 space-y-4">
          
          {/* Controls */}
          {controlRows.map((row, idx) => (
            <div key={`ctrl-${idx}`} className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Control {controlRows.length > 1 ? idx + 1 : ''} (Row)
              </label>
              <select
                value={row}
                onChange={(e) => {
                  const newControls = [...controlRows];
                  newControls[idx] = parseInt(e.target.value, 10);
                  setControlRows(newControls);
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {qubits.map((q, i) => (
                  <option key={q.id} value={i}>{q.label} (Row {i})</option>
                ))}
              </select>
            </div>
          ))}

          {/* Targets */}
          {targetRows.map((row, idx) => (
            <div key={`tgt-${idx}`} className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Target {targetRows.length > 1 ? idx + 1 : ''} (Row)
              </label>
              <select
                value={row}
                onChange={(e) => {
                  const newTargets = [...targetRows];
                  newTargets[idx] = parseInt(e.target.value, 10);
                  setTargetRows(newTargets);
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {qubits.map((q, i) => (
                  <option key={q.id} value={i}>{q.label} (Row {i})</option>
                ))}
              </select>
            </div>
          ))}

          {!isUnique && (
            <div className="text-xs text-destructive">
              Error: Controls and targets must be on unique rows.
            </div>
          )}

        </div>
        
        <div className="p-4 border-t border-border flex justify-end gap-2 bg-muted/30">
          <Button variant="outline" onClick={reject}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid}>
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}

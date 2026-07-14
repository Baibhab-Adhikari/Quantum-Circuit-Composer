'use client';

import { useState, useEffect } from 'react';
import { useCircuitStore } from '@/store/circuitStore';
import { Button } from '@/components/ui/button';
import { GATE_MAP } from '@/constants/gates';
import { parseComplexNumber, isUnitary } from '@/utils/validation';
import type { ComplexNumber } from '@/types/circuit';

const PRESETS = [
  { label: 'Identity', matrix: [['1', '0'], ['0', '1']] },
  { label: 'Hadamard', matrix: [['1/sqrt(2)', '1/sqrt(2)'], ['1/sqrt(2)', '-1/sqrt(2)']] },
  { label: 'Pauli-X', matrix: [['0', '1'], ['1', '0']] },
  { label: 'Pauli-Y', matrix: [['0', '-i'], ['i', '0']] },
  { label: 'Pauli-Z', matrix: [['1', '0'], ['0', '-1']] },
];

/**
 * Two-phase dialog for Controlled-U gates:
 * Phase 1: Qubit selection (control + target rows)
 * Phase 2: Matrix input (2×2 unitary)
 */
export default function CUGateDialog() {
  const pendingCUGate = useCircuitStore(s => s.pendingCUGate);
  const qubits = useCircuitStore(s => s.qubits);

  // Phase 1 state
  const [targetRows, setTargetRows] = useState<number[]>([]);
  const [controlRows, setControlRows] = useState<number[]>([]);

  // Phase 2 state
  const [inputs, setInputs] = useState([['', ''], ['', '']]);

  useEffect(() => {
    if (pendingCUGate?.gate) {
      setTargetRows(pendingCUGate.gate.targets.map(t => t.row));
      setControlRows(pendingCUGate.gate.controls.map(c => c.row));
      if (pendingCUGate.gate.matrix) {
        const mat = pendingCUGate.gate.matrix;
        setInputs([
          [formatComplex(mat[0][0]), formatComplex(mat[0][1])],
          [formatComplex(mat[1][0]), formatComplex(mat[1][1])]
        ]);
      } else {
        setInputs([['', ''], ['', '']]);
      }
    } else {
      setTargetRows([]);
      setControlRows([]);
      setInputs([['', ''], ['', '']]);
    }
  }, [pendingCUGate]);

  if (!pendingCUGate) return null;

  const { gate, reject } = pendingCUGate;
  const phase = pendingCUGate.phase;
  const def = GATE_MAP.get(gate.type);
  if (!def) return null;

  function formatComplex(c: ComplexNumber): string {
    if (c.real === 0 && c.imag === 0) return '0';
    if (c.real === 0) return `${c.imag}i`;
    if (c.imag === 0) return `${c.real}`;
    const sign = c.imag < 0 ? '-' : '+';
    return `${c.real}${sign}${Math.abs(c.imag)}i`;
  }

  // --- Phase 1: Qubit Selection ---
  const allSelectedRows = [...targetRows, ...controlRows];
  const uniqueRows = new Set(allSelectedRows);
  const isUniqueRows = uniqueRows.size === allSelectedRows.length;
  const isPhase1Valid = isUniqueRows && allSelectedRows.every(r => r >= 0 && r < qubits.length);

  const handlePhase1Next = () => {
    if (!isPhase1Valid) return;
    const col = gate.targets[0].col;
    const updatedGate = {
      ...gate,
      targets: targetRows.map(row => ({ row, col })),
      controls: controlRows.map(row => ({ row, col })),
    };
    useCircuitStore.getState().confirmCUGateQubits(updatedGate);
  };

  // --- Phase 2: Matrix Input ---
  let parsedMatrix: ComplexNumber[][] = [
    [{ real: 0, imag: 0 }, { real: 0, imag: 0 }],
    [{ real: 0, imag: 0 }, { real: 0, imag: 0 }]
  ];
  let allParsed = true;
  let parsingError = '';

  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const parsed = parseComplexNumber(inputs[r][c]);
      if (parsed === null) {
        allParsed = false;
        if (inputs[r][c].trim() !== '') {
          parsingError = `Invalid complex number at row ${r + 1}, col ${c + 1}`;
        }
      } else {
        parsedMatrix[r][c] = parsed;
      }
    }
  }

  const isUnitaryValid = allParsed && isUnitary(parsedMatrix);

  const handlePhase2Confirm = () => {
    if (isUnitaryValid) {
      useCircuitStore.getState().confirmCUGateMatrix(parsedMatrix);
    }
  };

  const handlePhase2Back = () => {
    // Go back to qubit selection phase
    useCircuitStore.setState({
      pendingCUGate: {
        ...pendingCUGate,
        phase: 'qubit-selection',
      }
    });
  };

  const handleInput = (r: number, c: number, val: string) => {
    const newInputs = [...inputs];
    newInputs[r] = [...newInputs[r]];
    newInputs[r][c] = val;
    setInputs(newInputs);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="bg-card border border-border shadow-lg rounded-xl w-[400px] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border bg-muted/30">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <span className="text-sm font-bold font-mono px-1.5 py-0.5 rounded border bg-background" style={{ color: def.color, borderColor: def.color }}>
              {def.abbreviation}
            </span>
            {phase === 'qubit-selection' ? 'Configure Qubits' : 'Custom Unitary Matrix'}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {phase === 'qubit-selection'
              ? 'Select control and target qubits'
              : 'Enter a 2×2 unitary matrix for the target operation'}
          </p>
          {/* Phase indicator */}
          <div className="flex items-center gap-2 mt-3">
            <div className={`h-1.5 flex-1 rounded-full transition-colors ${phase === 'qubit-selection' ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
            <div className={`h-1.5 flex-1 rounded-full transition-colors ${phase === 'matrix-input' ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
          </div>
        </div>

        {/* Phase 1: Qubit Selection */}
        {phase === 'qubit-selection' && (
          <>
            <div className="p-4 space-y-4">
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

              {!isUniqueRows && (
                <div className="text-xs text-destructive">
                  Error: Controls and targets must be on unique rows.
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border flex justify-end gap-2 bg-muted/30">
              <Button variant="outline" onClick={reject}>Cancel</Button>
              <Button onClick={handlePhase1Next} disabled={!isPhase1Valid}>Next</Button>
            </div>
          </>
        )}

        {/* Phase 2: Matrix Input */}
        {phase === 'matrix-input' && (
          <>
            <div className="p-5 space-y-6">
              <div className="flex flex-col items-center">
                <div className="relative flex items-center p-2">
                  <div className="absolute left-0 top-0 bottom-0 w-3 border-l-2 border-t-2 border-b-2 border-foreground rounded-l-md" />
                  <div className="absolute right-0 top-0 bottom-0 w-3 border-r-2 border-t-2 border-b-2 border-foreground rounded-r-md" />

                  <div className="flex flex-col gap-3 px-4 py-1 z-10">
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={inputs[0][0]}
                        onChange={(e) => handleInput(0, 0, e.target.value)}
                        className={`w-28 text-center font-mono text-sm py-1.5 border-b-2 border-transparent hover:border-border focus:border-primary outline-none bg-transparent transition-colors ${parseComplexNumber(inputs[0][0]) === null && inputs[0][0] !== '' ? 'text-destructive border-b-destructive' : ''}`}
                        placeholder="a"
                      />
                      <input
                        type="text"
                        value={inputs[0][1]}
                        onChange={(e) => handleInput(0, 1, e.target.value)}
                        className={`w-28 text-center font-mono text-sm py-1.5 border-b-2 border-transparent hover:border-border focus:border-primary outline-none bg-transparent transition-colors ${parseComplexNumber(inputs[0][1]) === null && inputs[0][1] !== '' ? 'text-destructive border-b-destructive' : ''}`}
                        placeholder="b"
                      />
                    </div>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={inputs[1][0]}
                        onChange={(e) => handleInput(1, 0, e.target.value)}
                        className={`w-28 text-center font-mono text-sm py-1.5 border-b-2 border-transparent hover:border-border focus:border-primary outline-none bg-transparent transition-colors ${parseComplexNumber(inputs[1][0]) === null && inputs[1][0] !== '' ? 'text-destructive border-b-destructive' : ''}`}
                        placeholder="c"
                      />
                      <input
                        type="text"
                        value={inputs[1][1]}
                        onChange={(e) => handleInput(1, 1, e.target.value)}
                        className={`w-28 text-center font-mono text-sm py-1.5 border-b-2 border-transparent hover:border-border focus:border-primary outline-none bg-transparent transition-colors ${parseComplexNumber(inputs[1][1]) === null && inputs[1][1] !== '' ? 'text-destructive border-b-destructive' : ''}`}
                        placeholder="d"
                      />
                    </div>
                  </div>
                </div>

                <div className="h-6 mt-3 text-sm flex items-center justify-center w-full">
                  {!allParsed ? (
                    <span className="text-destructive text-xs">{parsingError || 'Fill all fields'}</span>
                  ) : isUnitaryValid ? (
                    <span className="text-green-600 dark:text-green-400 text-xs flex items-center gap-1">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      Matrix is unitary
                    </span>
                  ) : (
                    <span className="text-destructive text-xs flex items-center gap-1">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      Matrix is not unitary (U†U ≠ I)
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Presets
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map(preset => (
                    <button
                      key={preset.label}
                      onClick={() => setInputs(preset.matrix)}
                      className="px-2 py-1 text-xs bg-muted hover:bg-accent hover:text-accent-foreground border border-border rounded transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border flex justify-between bg-muted/30">
              <Button variant="outline" onClick={handlePhase2Back}>Back</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={reject}>Cancel</Button>
                <Button onClick={handlePhase2Confirm} disabled={!isUnitaryValid}>Confirm</Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

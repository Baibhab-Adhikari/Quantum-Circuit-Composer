'use client';

import { useCircuitStore } from '@/store/circuitStore';
import { Button } from '@/components/ui/button';
import { CodeViewer } from '@/components/ui/CodeViewer';

export default function Inspector() {
  const {
    isSimulating, simulationResult, runSimulation, operations,
    quaPreviewCode, quaWarnings, quaPlaceholderGates, generateQuaPreview,
  } = useCircuitStore();

  return (
    <div className="w-[450px] border-l border-border bg-card flex flex-col overflow-y-auto shrink-0">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold tracking-tight">Quantum Analysis</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Circuit execution & representations
        </p>
      </div>

      <div className="p-4 space-y-8 flex-1">
        {/* Simulation Action */}
        <div className="space-y-3">
          <Button 
            className="w-full" 
            onClick={runSimulation}
            disabled={isSimulating}
          >
            {isSimulating ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Executing on AerSimulator...
              </>
            ) : (
              'Run Simulation'
            )}
          </Button>
        </div>

        {/* Results Area */}
        {simulationResult && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Status / Errors */}
            {!simulationResult.success ? (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive font-medium">Simulation Failed</p>
                <p className="text-xs text-destructive/80 mt-1">{simulationResult.error_message}</p>
              </div>
            ) : (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-md">
                <p className="text-sm text-green-600 dark:text-green-400 font-medium flex justify-between">
                  <span>Success</span>
                  <span>{simulationResult.execution_time_ms.toFixed(1)} ms</span>
                </p>
              </div>
            )}

            {/* Execution Statistics */}
            {simulationResult.success && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Statistics</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded bg-muted/50 border border-border/50">
                    <p className="text-xs text-muted-foreground">Depth</p>
                    <p className="text-lg font-mono">{simulationResult.depth}</p>
                  </div>
                  <div className="p-3 rounded bg-muted/50 border border-border/50">
                    <p className="text-xs text-muted-foreground">Gate Count</p>
                    <p className="text-lg font-mono">{simulationResult.gate_count}</p>
                  </div>
                </div>
              </section>
            )}

            {/* Dirac Notation */}
            {simulationResult.dirac_notation && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Quantum State</h3>
                <div className="p-4 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center min-h-20">
                  <span className="text-xl font-serif text-primary tracking-wide">
                    |ψ⟩ = {simulationResult.dirac_notation}
                  </span>
                </div>
              </section>
            )}

            {/* Measurement Counts */}
            {simulationResult.counts && (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Measurement Probabilities</h3>
                <div className="space-y-2">
                  {Object.entries(simulationResult.counts).map(([state, count]) => {
                    const percentage = (count / 1024) * 100;
                    return (
                      <div key={state} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-mono">|{state}⟩</span>
                          <span className="text-muted-foreground">{count} ({percentage.toFixed(1)}%)</span>
                        </div>
                        <div className="h-2 w-full bg-muted overflow-hidden rounded-full">
                          <div 
                            className="h-full bg-primary transition-all duration-1000 ease-out" 
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Raw Statevector */}
            {simulationResult.statevector && (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Raw Statevector</h3>
                <div className="p-3 rounded bg-muted/50 border border-border/50 max-h-64 overflow-y-auto custom-scrollbar">
                  <div className="space-y-1.5">
                    {simulationResult.statevector.map((c, i) => {
                      const magnitude = Math.sqrt(c.real * c.real + c.imag * c.imag);
                      if (magnitude < 1e-10) return null;
                      
                      const binState = i.toString(2).padStart(Math.log2(simulationResult.statevector!.length), '0');
                      const sign = c.imag >= 0 ? '+' : '-';
                      const imagAbs = Math.abs(c.imag);
                      const displayNum = `${c.real.toFixed(4)} ${sign} ${imagAbs.toFixed(4)}i`;

                      return (
                        <div key={i} className="flex justify-between items-center text-xs font-mono py-1 border-b border-border/30 last:border-0">
                          <span className="text-primary font-bold">|{binState}⟩</span>
                          <span className="text-muted-foreground">{displayNum}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            {/* Qiskit Code Generation */}
            {simulationResult.qiskit_code && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Qiskit Code</h3>
                <CodeViewer code={simulationResult.qiskit_code} language="python" title="circuit.py" />
              </section>
            )}

            {/* OpenQASM Generation */}
            {simulationResult.openqasm && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">OpenQASM</h3>
                <CodeViewer code={simulationResult.openqasm} language="qasm" title="circuit.qasm" />
              </section>
            )}

            {/* Circuit JSON */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Circuit JSON</h3>
              <CodeViewer 
                code={JSON.stringify(operations, null, 2)} 
                language="json" 
                title="operations.json" 
              />
            </section>
          </div>
        )}

        {/* ─── QUA Code Generation ─── */}
        <div className="border-t border-border pt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">QUA Code</h3>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={generateQuaPreview}
            >
              <svg className="size-3.5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              Generate Preview
            </Button>
          </div>

          {/* QUA Warnings */}
          {quaWarnings.length > 0 && (
            <div className="space-y-1.5">
              {quaWarnings.filter(w => w.type === 'unsupported-multi-qubit').length > 0 && (
                <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-md">
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium">⚠ Custom Calibration Required</p>
                  <ul className="text-xs text-red-500/80 mt-1 space-y-0.5">
                    {quaWarnings.filter(w => w.type === 'unsupported-multi-qubit').map((w, i) => (
                      <li key={i}>• {w.message}</li>
                    ))}
                  </ul>
                </div>
              )}
              {quaWarnings.filter(w => w.type === 'decomposed').length > 0 && (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-md">
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">ℹ Gates Decomposed</p>
                  <ul className="text-xs text-amber-500/80 mt-1 space-y-0.5">
                    {quaWarnings.filter(w => w.type === 'decomposed').map((w, i) => (
                      <li key={i}>• {w.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Placeholder gates summary */}
          {quaPlaceholderGates.length > 0 && (
            <div className="p-2.5 bg-muted/50 border border-border/50 rounded-md">
              <p className="text-xs text-muted-foreground font-medium">Placeholder gates needing macros:</p>
              <ul className="text-xs font-mono text-muted-foreground mt-1 space-y-0.5">
                {quaPlaceholderGates.map((pg, i) => (
                  <li key={i}>• {pg}</li>
                ))}
              </ul>
            </div>
          )}

          {/* QUA code viewer */}
          {quaPreviewCode && (
            <CodeViewer code={quaPreviewCode} language="python" title="qua_circuit.py" />
          )}

          {!quaPreviewCode && (
            <div className="p-6 rounded-md border border-dashed border-border/50 flex flex-col items-center justify-center text-center">
              <svg className="size-8 text-muted-foreground/40 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              <p className="text-xs text-muted-foreground">
                Click &quot;Generate Preview&quot; to compile your circuit into QUA code
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


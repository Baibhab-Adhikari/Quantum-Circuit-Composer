'use client';

import { useCircuitStore } from '@/store/circuitStore';
import { Button } from '@/components/ui/button';

export default function Inspector() {
  const { isSimulating, simulationResult, runSimulation } = useCircuitStore();

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col overflow-y-auto">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold tracking-tight">Analysis</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Circuit execution & results
        </p>
      </div>

      <div className="p-4 space-y-6 flex-1">
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
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
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

            {/* Statistics */}
            {simulationResult.success && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Circuit Statistics</h3>
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
              </div>
            )}

            {/* Measurement Counts */}
            {simulationResult.counts && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Measurement Counts</h3>
                <div className="space-y-2">
                  {Object.entries(simulationResult.counts).map(([state, count]) => {
                    // Calculate percentage assuming 1024 shots
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
              </div>
            )}

            {/* Statevector */}
            {simulationResult.statevector && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Statevector</h3>
                <div className="p-3 rounded bg-muted/50 border border-border/50 max-h-48 overflow-y-auto">
                  <div className="space-y-1">
                    {simulationResult.statevector.map((c, i) => {
                      // Only show non-zero amplitudes for brevity
                      const magnitude = Math.sqrt(c.real * c.real + c.imag * c.imag);
                      if (magnitude < 1e-10) return null;
                      
                      // Format binary state e.g., |00⟩
                      const binState = i.toString(2).padStart(Math.log2(simulationResult.statevector!.length), '0');
                      
                      const sign = c.imag >= 0 ? '+' : '-';
                      const imagAbs = Math.abs(c.imag);
                      const displayNum = `${c.real.toFixed(3)} ${sign} ${imagAbs.toFixed(3)}i`;

                      return (
                        <div key={i} className="flex justify-between text-xs font-mono">
                          <span>|{binState}⟩</span>
                          <span className="text-muted-foreground">{displayNum}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

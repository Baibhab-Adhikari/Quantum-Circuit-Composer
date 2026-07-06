'use client';

import { useState, useEffect } from 'react';
import { useCircuitStore } from '@/store/circuitStore';
import { Button } from '@/components/ui/button';
import { GATE_MAP } from '@/constants/gates';
import { parseAngleInput } from '@/utils/validation';

const PRESETS = [
  { label: '0', value: '0' },
  { label: 'π/4', value: 'pi/4' },
  { label: 'π/2', value: 'pi/2' },
  { label: 'π', value: 'pi' },
  { label: '2π', value: '2*pi' },
  { label: '-π/4', value: '-pi/4' },
  { label: '-π/2', value: '-pi/2' },
  { label: '-π', value: '-pi' },
];

export default function ParameterDialog() {
  const pendingParameterGate = useCircuitStore(s => s.pendingParameterGate);
  const [inputValue, setInputValue] = useState('');
  
  useEffect(() => {
    if (pendingParameterGate?.gate.params?.theta !== undefined) {
      setInputValue(pendingParameterGate.gate.params.theta.toString());
    } else {
      setInputValue('');
    }
  }, [pendingParameterGate]);

  if (!pendingParameterGate) return null;

  const { gate, resolve, reject } = pendingParameterGate;
  const def = GATE_MAP.get(gate.type);
  if (!def) return null;

  const parsedValue = parseAngleInput(inputValue);
  const isValid = parsedValue !== null;

  const handleConfirm = () => {
    if (isValid) {
      resolve({ theta: parsedValue });
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
            Configure Parameter
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {def.description}
          </p>
        </div>
        
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Rotation Angle (θ)
            </label>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="e.g., pi/2, 1.57, -pi"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isValid) handleConfirm();
                if (e.key === 'Escape') reject();
              }}
            />
            {inputValue && (
              <div className="text-xs">
                {isValid ? (
                  <span className="text-green-600 dark:text-green-400">
                    Evaluates to: {parsedValue.toFixed(6)} rad
                  </span>
                ) : (
                  <span className="text-destructive">Invalid expression</span>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Presets
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map(preset => (
                <button
                  key={preset.label}
                  onClick={() => setInputValue(preset.value)}
                  className="px-2 py-1 text-xs font-mono bg-muted hover:bg-accent hover:text-accent-foreground border border-border rounded transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
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

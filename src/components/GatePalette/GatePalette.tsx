'use client';

import { GATE_DEFINITIONS, GATE_CATEGORIES } from '@/constants/gates';
import GateCard from './GateCard';

export default function GatePalette() {
  return (
    <aside
      id="gate-palette"
      className="flex flex-col w-full md:w-[160px] md:min-w-[160px] max-h-[35vh] md:max-h-none border-b md:border-b-0 md:border-r border-border bg-card/50 overflow-y-auto shrink-0"
    >
      <div className="px-3 py-2.5 border-b border-border">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Gates
        </h2>
      </div>

      <div className="flex flex-col gap-4 p-3">
        {GATE_CATEGORIES.map(({ label, category }) => {
          const gates = GATE_DEFINITIONS.filter((g) => g.category === category);
          if (gates.length === 0) return null;

          return (
            <div key={category} className="flex flex-col gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70 px-0.5">
                {label}
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {gates.map((gate) => (
                  <GateCard key={gate.type} gate={gate} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

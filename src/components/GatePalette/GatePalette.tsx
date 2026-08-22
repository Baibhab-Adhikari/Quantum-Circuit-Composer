'use client';

import { useState } from 'react';
import { GATE_DEFINITIONS, GATE_CATEGORIES } from '@/constants/gates';
import GateCard from './GateCard';

export default function GatePalette() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside
      id="gate-palette"
      className={`flex flex-col w-full ${
        isCollapsed ? 'md:w-12 md:min-w-12 max-h-none' : 'md:w-[160px] md:min-w-[160px] max-h-[35vh] md:max-h-none'
      } border-b md:border-b-0 md:border-r border-border bg-card/50 overflow-y-auto shrink-0 transition-[width] duration-200`}
    >
      <div className={`flex items-center border-b border-border ${isCollapsed ? 'justify-center p-2' : 'justify-between px-3 py-2.5'}`}>
        <h2 className={`text-xs font-semibold uppercase tracking-wider text-muted-foreground ${isCollapsed ? 'sr-only' : ''}`}>
          Gates
        </h2>
        <button
          type="button"
          className="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={isCollapsed ? 'Expand gate palette' : 'Collapse gate palette'}
          aria-controls="gate-palette-content"
          aria-expanded={!isCollapsed}
          onClick={() => setIsCollapsed(collapsed => !collapsed)}
        >
          <svg
            className={`size-4 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
      </div>

      {!isCollapsed && (
        <div id="gate-palette-content" className="flex flex-col gap-4 p-3">
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
      )}
    </aside>
  );
}

'use client';

import type { GateDefinition } from '@/types/circuit';
import { useCircuitStore } from '@/store/circuitStore';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { useDraggable } from '@dnd-kit/core';

interface GateCardProps {
  gate: GateDefinition;
}

export default function GateCard({ gate }: GateCardProps) {
  const selectedGateType = useCircuitStore((s) => s.selectedGateType);
  const setSelectedGateType = useCircuitStore((s) => s.setSelectedGateType);

  const isSelected = selectedGateType === gate.type;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-gate-${gate.type}`,
    data: {
      source: 'palette',
      gateType: gate.type,
    },
  });

  return (
    <Tooltip>
      <TooltipTrigger
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        id={`gate-card-${gate.type}`}
        onClick={() => setSelectedGateType(gate.type)}
        className={`
          group relative flex flex-col items-center justify-center gap-1
          w-full rounded-lg border px-2 py-2.5
          transition-all duration-150 ease-out cursor-pointer
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          ${
            isSelected
              ? 'border-transparent shadow-lg scale-[1.02]'
              : 'border-border bg-card hover:bg-accent hover:border-accent-foreground/10'
          }
          ${isDragging ? 'opacity-50' : 'opacity-100'}
        `}
        style={
          isSelected
            ? {
                outline: `2px solid ${gate.color}`,
                outlineOffset: '-1px',
                backgroundColor: `color-mix(in oklch, ${gate.color}, transparent 88%)`,
                boxShadow: `0 4px 16px color-mix(in oklch, ${gate.color}, transparent 70%)`,
              }
            : undefined
        }
      >
        {/* Gate symbol */}
        {gate.type === 'Measure' ? (
          <div
            className="flex items-center justify-center transition-colors pointer-events-none"
            style={{ color: isSelected ? gate.color : undefined }}
          >
            <svg className="w-5 h-5 mb-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 17a9 9 0 0 1 18 0" />
              <path d="M12 17l6-8" />
              <path d="M14 9h4v4" />
            </svg>
          </div>
        ) : (
          <span
            className="text-lg font-bold font-mono leading-none transition-colors pointer-events-none"
            style={{ color: isSelected ? gate.color : undefined }}
          >
            {gate.abbreviation}
          </span>
        )}

        {/* Gate name */}
        <span className="text-[10px] text-muted-foreground leading-tight truncate w-full text-center pointer-events-none">
          {gate.name}
        </span>
      </TooltipTrigger>

      <TooltipContent side="right" sideOffset={15} className="max-w-[250px] pointer-events-none p-3 shadow-xl">
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-sm">{gate.name}</span>
          <span className="text-xs opacity-90 leading-relaxed">{gate.description}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

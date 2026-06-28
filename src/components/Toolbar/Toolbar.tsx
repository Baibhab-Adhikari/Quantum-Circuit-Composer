'use client';

import { useState } from 'react';
import { useCircuitStore } from '@/store/circuitStore';
import { useTheme } from '@/components/ThemeProvider';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';

/** SVG icon components for the toolbar */
function IconPlus({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconMinus({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconUndo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}

function IconRedo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10" />
    </svg>
  );
}

function IconSun({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function IconMoon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function IconRefresh({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function IconMenu({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function IconClose({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function Toolbar() {
  const { qubits, addQubit, removeQubit, resetCircuit, numColumns, setNumColumns, zoom, setZoom, undo, redo, history, historyIndex } = useCircuitStore();
  const { theme, toggleTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header
      id="toolbar"
      className="flex flex-col md:flex-row md:items-center justify-between border-b border-border bg-card px-4 py-2"
    >
      {/* Top bar (always visible) */}
      <div className="flex items-center justify-between w-full md:w-auto">
        {/* Left: Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-8 overflow-hidden select-none">
            <img src="/logo.png" alt="Quantum Icon" className="w-full h-full object-contain dark:invert" />
          </div>
          <h1 className="text-base font-semibold tracking-tight text-foreground">
            Quantum Circuit Composer
          </h1>
        </div>

        {/* Mobile menu toggle */}
        <div className="flex items-center gap-2 md:hidden">
          <Tooltip>
            <TooltipTrigger
              className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
              onClick={toggleTheme}
            >
              {theme === 'dark' ? <IconSun className="size-4" /> : <IconMoon className="size-4" />}
            </TooltipTrigger>
            <TooltipContent>Switch theme</TooltipContent>
          </Tooltip>
          
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <IconClose className="size-4" /> : <IconMenu className="size-4" />}
          </Button>
        </div>
      </div>

      {/* Center Actions */}
      <div 
        className={`flex-wrap md:flex-row items-center gap-2 mt-4 md:mt-0 ${
          isMobileMenuOpen ? 'flex' : 'hidden md:flex'
        }`}
      >
        {/* Qubit controls */}
        <div className="flex items-center gap-1 mr-2 border-r border-border pr-3">
          <span className="text-xs text-muted-foreground mr-1.5 select-none hidden sm:inline">
            Qubits
          </span>
          <Tooltip>
            <TooltipTrigger
              className={buttonVariants({ variant: 'outline', size: 'icon-xs' })}
              onClick={removeQubit}
              disabled={qubits.length <= 1}
            >
              <IconMinus className="size-3" />
            </TooltipTrigger>
            <TooltipContent>Remove qubit</TooltipContent>
          </Tooltip>

          <span className="text-sm font-mono font-medium text-foreground min-w-[1.5rem] text-center tabular-nums">
            {qubits.length}
          </span>

          <Tooltip>
            <TooltipTrigger
              className={buttonVariants({ variant: 'outline', size: 'icon-xs' })}
              onClick={addQubit}
              disabled={qubits.length >= 12}
            >
              <IconPlus className="size-3" />
            </TooltipTrigger>
            <TooltipContent>Add qubit</TooltipContent>
          </Tooltip>
        </div>

        {/* Depth controls */}
        <div className="flex items-center gap-1 mr-2 border-r border-border pr-3">
          <span className="text-xs text-muted-foreground mr-1.5 select-none hidden sm:inline">
            Depth
          </span>
          <Tooltip>
            <TooltipTrigger
              className={buttonVariants({ variant: 'outline', size: 'icon-xs' })}
              onClick={() => setNumColumns(numColumns - 1)}
              disabled={numColumns <= 1}
            >
              <IconMinus className="size-3" />
            </TooltipTrigger>
            <TooltipContent>Decrease depth</TooltipContent>
          </Tooltip>

          <span className="text-sm font-mono font-medium text-foreground min-w-[1.5rem] text-center tabular-nums">
            {numColumns}
          </span>

          <Tooltip>
            <TooltipTrigger
              className={buttonVariants({ variant: 'outline', size: 'icon-xs' })}
              onClick={() => setNumColumns(numColumns + 1)}
              disabled={numColumns >= 50}
            >
              <IconPlus className="size-3" />
            </TooltipTrigger>
            <TooltipContent>Increase depth</TooltipContent>
          </Tooltip>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1 mr-2 border-r border-border pr-3">
          <span className="text-xs text-muted-foreground mr-1.5 select-none hidden sm:inline">
            Zoom
          </span>
          <Tooltip>
            <TooltipTrigger
              className={buttonVariants({ variant: 'outline', size: 'icon-xs' })}
              onClick={() => setZoom(zoom - 10)}
              disabled={zoom <= 50}
            >
              <IconMinus className="size-3" />
            </TooltipTrigger>
            <TooltipContent>Zoom out</TooltipContent>
          </Tooltip>

          <span className="text-sm font-mono font-medium text-foreground min-w-[2.5rem] text-center tabular-nums">
            {zoom}%
          </span>

          <Tooltip>
            <TooltipTrigger
              className={buttonVariants({ variant: 'outline', size: 'icon-xs' })}
              onClick={() => setZoom(zoom + 10)}
              disabled={zoom >= 200}
            >
              <IconPlus className="size-3" />
            </TooltipTrigger>
            <TooltipContent>Zoom in</TooltipContent>
          </Tooltip>
        </div>

        <Tooltip>
          <TooltipTrigger
            className={`${buttonVariants({ variant: 'ghost', size: 'icon-sm' })} ${historyIndex <= 0 ? 'opacity-50 cursor-default hover:bg-transparent' : ''}`}
            aria-disabled={historyIndex <= 0}
            onClick={(e) => {
              if (historyIndex <= 0) { e.preventDefault(); return; }
              undo();
            }}
          >
            <IconUndo className="size-4" />
          </TooltipTrigger>
          <TooltipContent>Undo</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            className={`${buttonVariants({ variant: 'ghost', size: 'icon-sm' })} ${historyIndex >= history.length - 1 ? 'opacity-50 cursor-default hover:bg-transparent' : ''}`}
            aria-disabled={historyIndex >= history.length - 1}
            onClick={(e) => {
              if (historyIndex >= history.length - 1) { e.preventDefault(); return; }
              redo();
            }}
          >
            <IconRedo className="size-4" />
          </TooltipTrigger>
          <TooltipContent>Redo</TooltipContent>
        </Tooltip>

        <div className="w-px h-5 bg-border mx-1" />

        <Tooltip>
          <TooltipTrigger
            className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
            onClick={resetCircuit}
          >
            <IconRefresh className="size-4" />
          </TooltipTrigger>
          <TooltipContent>Reset circuit</TooltipContent>
        </Tooltip>
      </div>

      {/* Right: Theme toggle (desktop) */}
      <div className="hidden md:flex items-center">
        <Tooltip>
          <TooltipTrigger
            className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <IconSun className="size-4" /> : <IconMoon className="size-4" />}
          </TooltipTrigger>
          <TooltipContent>
            Switch to {theme === 'dark' ? 'light' : 'dark'} mode
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}

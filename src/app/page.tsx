'use client';

import Toolbar from "@/components/Toolbar/Toolbar";
import GatePalette from "@/components/GatePalette/GatePalette";
import CircuitEditor from "@/components/CircuitEditor/CircuitEditor";
import Inspector from "@/components/Inspector/Inspector";
import StatusBar from "@/components/StatusBar/StatusBar";
import DndProvider from "@/components/DndProvider";
import { useEditorShortcuts } from "@/hooks/useEditorShortcuts";

export default function Home() {
  useEditorShortcuts();

  return (
    <DndProvider>
      <div className="flex flex-col h-screen overflow-hidden">
      {/* Top toolbar */}
      <Toolbar />

      {/* Main content area: sidebar + editor */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Gate palette sidebar */}
        <GatePalette />

        {/* Circuit editor */}
        <CircuitEditor />

        {/* Inspector panel */}
        <Inspector />
      </div>

      {/* Bottom status bar */}
      <StatusBar />
    </div>
    </DndProvider>
  );
}

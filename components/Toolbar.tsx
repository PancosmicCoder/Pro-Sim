
import React, { useState } from 'react';
import { PRESET_CIRCUITS } from '../constants';
import { CircuitComponent, Wire } from '../types';
import { RotateCw, Play, Pause, RotateCcw, PanelRight, BookOpen, ChevronDown, Undo2, Redo2, LayoutGrid, ZoomIn, ZoomOut, Scan } from 'lucide-react';
import clsx from 'clsx';

interface ToolbarProps {
  simState: 'RUNNING' | 'PAUSED' | 'STOPPED';
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  
  isPanelOpen: boolean;
  onTogglePanel: () => void;
  
  isLibraryOpen: boolean;
  onToggleLibrary: () => void;

  onLoadPreset: (components: CircuitComponent[], wires: Wire[]) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ 
  simState,
  onPlay,
  onPause,
  onReset,
  isPanelOpen,
  onTogglePanel,
  isLibraryOpen,
  onToggleLibrary,
  onLoadPreset,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onZoomIn,
  onZoomOut,
  onResetView
}) => {
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);

  return (
    <div className="h-16 bg-slate-900 border-b border-slate-800 flex items-center px-4 sm:px-6 justify-between shadow-sm z-20 relative shrink-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 mr-2">
            <div className="bg-blue-600 w-8 h-8 rounded flex items-center justify-center shadow-lg shadow-blue-900/50 shrink-0">
                <span className="text-white font-bold text-lg">P</span>
            </div>
            <h1 className="font-bold text-xl text-slate-100 tracking-tight">ProSim <span className="text-blue-500">Circuit</span></h1>
        </div>
        
        <div className="w-px h-6 bg-slate-800 hidden md:block"></div>

        {/* Library Toggle - Desktop Only */}
        <button 
            onClick={onToggleLibrary}
            className={clsx(
                "hidden md:flex items-center gap-2 px-3 py-1.5 rounded transition-colors border",
                isLibraryOpen 
                    ? "bg-slate-800 text-blue-400 border-blue-900/50" 
                    : "text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800"
            )}
            title="Toggle Component Library"
         >
            <LayoutGrid size={18} />
            <span className="font-medium text-sm">Components</span>
         </button>
      </div>
      
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Simulation Controls - Always Visible */}
        <div className="flex items-center bg-slate-800/50 rounded-lg p-1 border border-slate-700/50 backdrop-blur-sm shrink-0">
            <button
                onClick={onPlay}
                className={clsx(
                "p-2 rounded transition-all flex items-center gap-2",
                simState === 'RUNNING'
                    ? "bg-green-600/20 text-green-400 shadow-sm ring-1 ring-green-600/50"
                    : "text-slate-400 hover:text-green-400 hover:bg-slate-700"
                )}
                title="Run Simulation"
            >
                <Play size={20} fill={simState === 'RUNNING' ? "currentColor" : "none"} />
            </button>
            <button
                onClick={onPause}
                className={clsx(
                "p-2 rounded transition-all flex items-center gap-2",
                simState === 'PAUSED'
                    ? "bg-amber-600/20 text-amber-400 shadow-sm ring-1 ring-amber-600/50"
                    : "text-slate-400 hover:text-amber-400 hover:bg-slate-700"
                )}
                title="Pause Simulation"
            >
                <Pause size={20} fill={simState === 'PAUSED' ? "currentColor" : "none"} />
            </button>
            <div className="w-px h-4 bg-slate-700 mx-1"></div>
            <button
                onClick={onReset}
                className={clsx(
                "p-2 rounded transition-all flex items-center gap-2",
                simState === 'STOPPED'
                    ? "text-red-400 bg-slate-800"
                    : "text-slate-400 hover:text-red-400 hover:bg-slate-700"
                )}
                title="Reset / Stop"
            >
                <RotateCcw size={20} />
            </button>
        </div>

        {/* Presets Menu */}
        <div className="relative hidden md:block">
            <button 
                onClick={() => setIsPresetsOpen(!isPresetsOpen)}
                className="flex items-center gap-1 text-slate-400 hover:text-slate-200 text-sm font-medium px-3 py-1.5 rounded hover:bg-slate-800 transition-colors"
            >
                <BookOpen size={16} />
                <span>Presets</span>
                <ChevronDown size={14} />
            </button>
            
            {isPresetsOpen && (
                <>
                    <div className="fixed inset-0 z-30" onClick={() => setIsPresetsOpen(false)}></div>
                    <div className="absolute top-full right-0 mt-1 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-40 overflow-hidden">
                        {PRESET_CIRCUITS.map((preset, idx) => (
                            <button
                                key={idx}
                                onClick={() => { onLoadPreset(preset.components as any, preset.wires); setIsPresetsOpen(false); }}
                                className="w-full text-left px-4 py-3 hover:bg-slate-800 border-b border-slate-800 last:border-0 transition-colors group"
                            >
                                <div className="text-slate-200 font-medium text-sm group-hover:text-blue-400">{preset.name}</div>
                                <div className="text-slate-500 text-xs mt-0.5">{preset.description}</div>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>

        {/* Zoom Controls - Desktop */}
        <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1 border border-slate-700/50 hidden md:flex">
             <button onClick={onZoomOut} className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded transition-colors" title="Zoom Out">
                <ZoomOut size={16} />
             </button>
             <button onClick={onResetView} className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded transition-colors" title="Fit to Screen">
                <Scan size={16} />
             </button>
             <button onClick={onZoomIn} className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded transition-colors" title="Zoom In">
                <ZoomIn size={16} />
             </button>
        </div>

        {/* History Controls - Desktop */}
        <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1 border border-slate-700/50 hidden md:flex">
            <button
                onClick={onUndo}
                disabled={!canUndo}
                className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Undo (Ctrl+Z)"
            >
                <Undo2 size={16} />
            </button>
            <button
                onClick={onRedo}
                disabled={!canRedo}
                className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Redo (Ctrl+Y)"
            >
                <Redo2 size={16} />
            </button>
        </div>

        <div className="w-px h-6 bg-slate-800 hidden md:block"></div>

        <div className="flex items-center gap-1">
            <button className="p-2 text-slate-500 hover:bg-slate-800 rounded transition-colors hidden md:block" title="Rotate (R)">
                <RotateCw size={18}/>
            </button>
            {/* Desktop Properties Toggle */}
            <button 
                onClick={onTogglePanel}
                className={clsx(
                    "hidden md:block p-2 rounded transition-colors border",
                    isPanelOpen 
                        ? "bg-slate-800 text-blue-400 border-blue-900/50" 
                        : "text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800"
                )}
                title={isPanelOpen ? "Hide Properties" : "Show Properties"}
            >
                <PanelRight size={20} />
            </button>
        </div>
      </div>
    </div>
  );
};

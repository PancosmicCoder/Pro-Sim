import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Canvas } from './components/Canvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { Toolbar } from './components/Toolbar';
import { ComponentLibrary } from './components/ComponentLibrary';
import { CircuitComponent, Wire, ComponentType, Position, Port, SimulationResult, SimulationConfig, SimulationMode } from './types';
import { CircuitSolver } from './services/circuitSolver';
import { analyzeCircuit } from './services/geminiService';
import { GRID_SIZE, COMPONENT_WIDTH, COMPONENT_HEIGHT } from './constants';
import { LayoutGrid, Settings2, Scan, Undo2 } from 'lucide-react';
import clsx from 'clsx';

const generateId = () => Math.random().toString(36).substring(2, 11);

interface HistoryState {
    components: CircuitComponent[];
    wires: Wire[];
}

const App: React.FC = () => {
  const [components, setComponents] = useState<CircuitComponent[]>([]);
  const [wires, setWires] = useState<Wire[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const [viewState, setViewState] = useState({ zoom: 1, pan: { x: 0, y: 0 } });

  const [history, setHistory] = useState<HistoryState[]>([]);
  const [future, setFuture] = useState<HistoryState[]>([]);

  const [simConfig, setSimConfig] = useState<SimulationConfig>({
      mode: SimulationMode.INTERACTIVE,
      startFreq: 0,
      stopFreq: 10000,
      points: 20,
      timeStep: 0.001,
      stopTime: 0.1
  });

  const [simState, setSimState] = useState<'RUNNING' | 'PAUSED' | 'STOPPED'>('RUNNING');

  // AI State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  const [isPanelOpen, setIsPanelOpen] = useState(() => window.innerWidth >= 1024);
  const [isLibraryOpen, setIsLibraryOpen] = useState(() => window.innerWidth >= 1024);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const toggleLibrary = () => {
      if (isMobile && !isLibraryOpen) setIsPanelOpen(false);
      setIsLibraryOpen(!isLibraryOpen);
  };

  const togglePanel = () => {
      if (isMobile && !isPanelOpen) setIsLibraryOpen(false);
      setIsPanelOpen(!isPanelOpen);
  };

  const selectedItem = selectedId 
    ? (components.find(c => c.id === selectedId) || wires.find(w => w.id === selectedId) || null) 
    : null;

  const saveHistory = useCallback(() => {
      setHistory(prev => [...prev, { components, wires }]);
      setFuture([]);
  }, [components, wires]);

  const undo = useCallback(() => {
      if (history.length === 0) return;
      const previous = history[history.length - 1];
      const newHistory = history.slice(0, -1);
      
      setFuture(prev => [{ components, wires }, ...prev]);
      setHistory(newHistory);
      
      setComponents(previous.components);
      setWires(previous.wires);
      setSelectedId(null);
  }, [history, components, wires]);

  const redo = useCallback(() => {
      if (future.length === 0) return;
      const next = future[0];
      const newFuture = future.slice(1);
      
      setHistory(prev => [...prev, { components, wires }]);
      setFuture(newFuture);
      
      setComponents(next.components);
      setWires(next.wires);
  }, [future, components, wires]);

  const fitViewToComponents = useCallback((comps: CircuitComponent[]) => {
      if (!canvasContainerRef.current || comps.length === 0) {
          setViewState({ zoom: 1, pan: { x: 0, y: 0 } });
          return;
      }

      const rect = canvasContainerRef.current.getBoundingClientRect();
      const viewW = rect.width;
      const viewH = rect.height;
      const padding = 60; 

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      
      comps.forEach(c => {
          minX = Math.min(minX, c.position.x);
          minY = Math.min(minY, c.position.y);
          maxX = Math.max(maxX, c.position.x + COMPONENT_WIDTH);
          maxY = Math.max(maxY, c.position.y + COMPONENT_HEIGHT);
      });

      if (minX === Infinity) {
           setViewState({ zoom: 1, pan: { x: 0, y: 0 } });
           return;
      }

      const contentW = maxX - minX;
      const contentH = maxY - minY;
      
      const zoomX = (viewW - padding * 2) / contentW;
      const zoomY = (viewH - padding * 2) / contentH;
      let targetZoom = Math.min(zoomX, zoomY);
      
      targetZoom = Math.min(targetZoom, 1.2); 
      targetZoom = Math.max(targetZoom, 0.1); 

      const contentCenterX = minX + contentW / 2;
      const contentCenterY = minY + contentH / 2;

      const panX = (viewW / 2) - (contentCenterX * targetZoom);
      const panY = (viewH / 2) - (contentCenterY * targetZoom);

      setViewState({ zoom: targetZoom, pan: { x: panX, y: panY } });
  }, []);

  const handleZoomIn = () => setViewState(prev => ({ ...prev, zoom: Math.min(prev.zoom * 1.2, 5) }));
  const handleZoomOut = () => setViewState(prev => ({ ...prev, zoom: Math.max(prev.zoom / 1.2, 0.1) }));
  const handleResetView = () => fitViewToComponents(components);

  const handleClearAll = () => {
      if (confirm('Are you sure you want to clear the entire circuit?')) {
          saveHistory();
          setComponents([]);
          setWires([]);
          setSimulationResult(null);
          setSelectedId(null);
          setSimState('STOPPED');
      }
  };

  const handleAddComponent = (type: ComponentType, defaultVal: number, labelPrefix: string, position?: Position) => {
     saveHistory();
     const count = components.filter(c => c.type === type).length + 1;
     
     let pos = position;
     if (!pos) {
        if (canvasContainerRef.current) {
            const rect = canvasContainerRef.current.getBoundingClientRect();
            const cx = (rect.width / 2 - viewState.pan.x) / viewState.zoom;
            const cy = (rect.height / 2 - viewState.pan.y) / viewState.zoom;
            
            const snapX = Math.round(cx / GRID_SIZE) * GRID_SIZE - 40;
            const snapY = Math.round(cy / GRID_SIZE) * GRID_SIZE - 20;

            pos = { x: snapX, y: snapY };
        } else {
            pos = { x: 100, y: 100 };
        }
     }
     
     const maxZ = components.reduce((max, c) => Math.max(max, c.zIndex || 0), 0);

     const newComp: CircuitComponent = {
        id: generateId(),
        type,
        value: defaultVal,
        label: `${labelPrefix}${count}`,
        position: pos, 
        rotation: 0,
        zIndex: maxZ + 1
     };

     if (type === ComponentType.AC_SOURCE) newComp.frequency = 60;
     if (type === ComponentType.OPAMP) newComp.inputImpedance = 10000000;
     if (type === ComponentType.LED) newComp.maxCurrent = 0.03; 
     if ([ComponentType.AND_GATE, ComponentType.OR_GATE, ComponentType.NAND_GATE, ComponentType.NOR_GATE, ComponentType.XOR_GATE].includes(type)) {
         newComp.inputCount = 2;
     }

     setComponents(prev => [...prev, newComp]);
     
     if (window.innerWidth < 768) setIsLibraryOpen(false);
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('componentType') as ComponentType;
      const defaultValStr = e.dataTransfer.getData('defaultVal');
      const label = e.dataTransfer.getData('label');
      
      if (type && canvasContainerRef.current) {
          const rect = canvasContainerRef.current.getBoundingClientRect();
          const clientX = e.clientX - rect.left;
          const clientY = e.clientY - rect.top;
          
          const worldX = (clientX - viewState.pan.x) / viewState.zoom;
          const worldY = (clientY - viewState.pan.y) / viewState.zoom;
          
          const snapX = Math.round(worldX / GRID_SIZE) * GRID_SIZE;
          const snapY = Math.round(worldY / GRID_SIZE) * GRID_SIZE;
          const centeredPos = { x: snapX - 40, y: snapY - 20 };
          
          handleAddComponent(type, parseFloat(defaultValStr), label, centeredPos);
      }
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragStart = () => {
      saveHistory();
  };

  const handleMoveComponent = (id: string, newPos: Position) => {
     setComponents(prev => prev.map(c => c.id === id ? { ...c, position: newPos } : c));
     if (simConfig.mode === SimulationMode.INTERACTIVE && simState === 'PAUSED') {
         setSimState('RUNNING');
     }
  };

  const handleAddWire = (from: Port, to: Port) => {
     if (from.componentId === to.componentId && from.portIndex === to.portIndex) return;
     
     const exists = wires.some(w => 
        (w.from.componentId === from.componentId && w.from.portIndex === from.portIndex && w.to.componentId === to.componentId && w.to.portIndex === to.portIndex) ||
        (w.to.componentId === from.componentId && w.to.portIndex === from.portIndex && w.from.componentId === to.componentId && w.from.portIndex === to.portIndex)
     );
     if (exists) return;
     
     saveHistory();
     const newWire: Wire = {
         id: generateId(),
         from,
         to
     };
     setWires(prev => [...prev, newWire]);
     if (simConfig.mode === SimulationMode.INTERACTIVE && simState === 'PAUSED') {
         setSimState('RUNNING');
     }
  };

  const handleUpdateComponent = (id: string, field: string, value: any) => {
      saveHistory();
      setComponents(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
      if (simConfig.mode === SimulationMode.INTERACTIVE && simState === 'PAUSED') {
         setSimState('RUNNING');
      }
  };

  const handleDelete = (id: string) => {
      saveHistory();
      setComponents(prev => prev.filter(c => c.id !== id));
      setWires(prev => prev.filter(w => w.id !== id && w.from.componentId !== id && w.to.componentId !== id));
      if (selectedId === id) setSelectedId(null);
      if (simConfig.mode === SimulationMode.INTERACTIVE && simState === 'PAUSED') {
         setSimState('RUNNING');
      }
  };

  const handleLoadPreset = (newComponents: CircuitComponent[], newWires: Wire[]) => {
      saveHistory(); 
      const compsWithZ = newComponents.map((c, i) => ({ ...c, zIndex: i }));
      setComponents(compsWithZ);
      setWires(newWires);
      setSimState('STOPPED');
      setSimulationResult(null);
      setSimConfig(prev => ({ ...prev, mode: SimulationMode.INTERACTIVE }));
      
      setTimeout(() => {
         fitViewToComponents(compsWithZ);
      }, 10);
      
      setTimeout(() => setSimState('RUNNING'), 200);
      
      if(isMobile) setIsLibraryOpen(false);
  };

  const handleEditComponent = (id: string) => {
      handleSelect(id);
      if (isMobile) setIsLibraryOpen(false);
      setIsPanelOpen(true);
  };

  const handleSelect = (id: string | null) => {
      setSelectedId(id);
      if (id) {
          setComponents(prev => {
              const maxZ = prev.reduce((max, c) => Math.max(max, c.zIndex || 0), 0);
              const target = prev.find(c => c.id === id);
              if (target && (target.zIndex || 0) < maxZ) {
                  return prev.map(c => c.id === id ? { ...c, zIndex: maxZ + 1 } : c);
              }
              return prev;
          });
      }
  };

  const handleConfigChange = (newConfig: Partial<SimulationConfig>) => {
      setSimConfig(prev => {
          const next = { ...prev, ...newConfig };
          if (prev.mode !== SimulationMode.INTERACTIVE && next.mode === SimulationMode.INTERACTIVE) {
              setSimState('RUNNING');
          }
          return next;
      });
  };

  // Run AI Analysis
  const handleRunAnalysis = async () => {
      setIsAnalyzing(true);
      setAiAnalysis(null);
      const result = await analyzeCircuit(components, wires);
      setAiAnalysis(result);
      setIsAnalyzing(false);
  };

  useEffect(() => {
    if (simState === 'STOPPED' || components.length === 0) {
        if (simState === 'STOPPED') setSimulationResult(null);
        return;
    }

    if (simState === 'PAUSED') return;

    if (simConfig.mode === SimulationMode.INTERACTIVE) {
        const timeout = setTimeout(() => {
            const result = CircuitSolver.solveCircuit(components, wires, simConfig.startFreq);
            setSimulationResult(result);
        }, 50); 
        return () => clearTimeout(timeout);
    } else {
        const timeout = setTimeout(() => {
            let result: SimulationResult;
            if (simConfig.mode === SimulationMode.TRANSIENT) {
                result = CircuitSolver.solveTransient(components, wires, simConfig);
            } else {
                result = CircuitSolver.solveACSweep(components, wires, simConfig);
            }
            setSimulationResult(result);
            setSimState('PAUSED'); 
        }, 100);
        return () => clearTimeout(timeout);
    }
  }, [components, wires, simState, simConfig]);

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
              if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
              handleDelete(selectedId);
          }
          
          if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
              e.preventDefault();
              if (e.shiftKey) {
                  redo();
              } else {
                  undo();
              }
          }
          if ((e.ctrlKey || e.metaKey) && (e.key === 'y')) {
              e.preventDefault();
              redo();
          }
          if (e.key.toLowerCase() === 'b') {
              toggleLibrary();
          }
          // Rotation Hotkey
          if (e.key.toLowerCase() === 'r' && selectedId) {
             const comp = components.find(c => c.id === selectedId);
             if (comp) {
                 handleUpdateComponent(selectedId, 'rotation', ((comp.rotation || 0) + 90) % 360);
             }
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, undo, redo, isLibraryOpen, components]); 

  return (
    <div className="flex flex-col h-screen text-slate-200 font-sans bg-slate-950 overflow-hidden">
      <Toolbar 
        simState={simState}
        onPlay={() => setSimState('RUNNING')}
        onPause={() => setSimState('PAUSED')}
        onReset={() => { setSimState('STOPPED'); handleClearAll(); }} 
        
        isPanelOpen={isPanelOpen}
        onTogglePanel={togglePanel}
        
        isLibraryOpen={isLibraryOpen}
        onToggleLibrary={toggleLibrary}
        
        onLoadPreset={handleLoadPreset}
        onUndo={undo}
        onRedo={redo}
        canUndo={history.length > 0}
        canRedo={future.length > 0}

        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
      />
      
      <div className="flex flex-1 overflow-hidden relative">
        <ComponentLibrary 
            onAddComponent={handleAddComponent}
            onLoadPreset={handleLoadPreset}
            isOpen={isLibraryOpen}
            onClose={() => setIsLibraryOpen(false)}
        />

        <div 
            ref={canvasContainerRef}
            className="flex-1 relative bg-slate-950 min-w-0 flex flex-col"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
        >
           <Canvas 
             components={components}
             wires={wires}
             selectedId={selectedId}
             onSelect={handleSelect}
             onMoveComponent={handleMoveComponent}
             onDragStart={handleDragStart}
             onAddWire={handleAddWire}
             simulationResult={simulationResult}
             onEdit={handleEditComponent}
             viewState={viewState}
             onSetViewState={setViewState}
           />
           
           <div className="absolute bottom-20 left-4 pointer-events-none select-none opacity-50 text-xs text-slate-500 hidden sm:block">
                Drag empty space to Pan • Scroll to Zoom • Click ports to wire • 'R' to Rotate
           </div>

           {simState !== 'RUNNING' && (
               <div className="absolute top-4 right-4 pointer-events-none z-20">
                   <div className={`px-3 py-1 rounded-full text-xs font-bold border shadow-lg backdrop-blur-sm ${
                       simState === 'PAUSED' ? 'bg-amber-500/10 border-amber-500/50 text-amber-500' : 'bg-red-500/10 border-red-500/50 text-red-500'
                   }`}>
                       {simState === 'PAUSED' ? (simConfig.mode === 'INTERACTIVE' ? 'PAUSED' : 'ANALYSIS DONE') : 'STOPPED'}
                   </div>
               </div>
           )}
        </div>
        
        {isPanelOpen && (
          <PropertiesPanel 
              selectedItem={selectedItem}
              onUpdate={handleUpdateComponent}
              onDelete={handleDelete}
              simulationResult={simulationResult}
              
              onRunAnalysis={handleRunAnalysis}
              isAnalyzing={isAnalyzing}
              aiAnalysis={aiAnalysis}

              config={simConfig}
              onConfigChange={handleConfigChange}
              onClose={() => setIsPanelOpen(false)}
          />
        )}
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden h-16 bg-slate-900/90 backdrop-blur-md border-t border-slate-800 flex items-center justify-around px-2 shrink-0 z-50 relative">
          <button 
            onClick={toggleLibrary}
            className={clsx("flex flex-col items-center gap-1 p-2 rounded-lg transition-colors", isLibraryOpen ? "text-blue-400" : "text-slate-400")}
          >
            <LayoutGrid size={20} />
            <span className="text-[10px] font-medium">Library</span>
          </button>

          <button 
            onClick={togglePanel}
            className={clsx("flex flex-col items-center gap-1 p-2 rounded-lg transition-colors", isPanelOpen ? "text-blue-400" : "text-slate-400")}
          >
            <Settings2 size={20} />
            <span className="text-[10px] font-medium">Props</span>
          </button>

          <button 
            onClick={handleResetView}
            className="flex flex-col items-center gap-1 p-2 rounded-lg text-slate-400 active:text-slate-200 transition-colors"
          >
            <Scan size={20} />
            <span className="text-[10px] font-medium">Fit</span>
          </button>
          
          <button 
            onClick={undo}
            disabled={history.length === 0}
            className="flex flex-col items-center gap-1 p-2 rounded-lg text-slate-400 disabled:opacity-30 transition-colors"
          >
            <Undo2 size={20} />
            <span className="text-[10px] font-medium">Undo</span>
          </button>
      </div>
    </div>
  );
};

export default App;
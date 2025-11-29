
import React, { useState } from 'react';
import { INITIAL_COMPONENTS, PRESET_CIRCUITS } from '../constants';
import { ComponentType, CircuitComponent, Wire } from '../types';
import { Search, Plus, Grid, X, BookOpen, Zap } from 'lucide-react';
import clsx from 'clsx';

interface ComponentLibraryProps {
  onAddComponent: (type: ComponentType, defaultVal: number, label: string) => void;
  onLoadPreset: (components: CircuitComponent[], wires: Wire[]) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const ComponentLibrary: React.FC<ComponentLibraryProps> = ({ onAddComponent, onLoadPreset, isOpen, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'components' | 'presets'>('components');

  const filteredComponents = INITIAL_COMPONENTS.filter(c => 
    c.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPresets = PRESET_CIRCUITS.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDragStart = (e: React.DragEvent, comp: typeof INITIAL_COMPONENTS[0]) => {
    e.dataTransfer.setData('componentType', comp.type);
    e.dataTransfer.setData('defaultVal', comp.defaultVal.toString());
    e.dataTransfer.setData('label', comp.label);
    e.dataTransfer.effectAllowed = 'copy';

    // Create a custom drag image
    const dragIcon = document.createElement('div');
    dragIcon.style.width = '80px';
    dragIcon.style.height = '40px';
    dragIcon.style.position = 'absolute';
    dragIcon.style.top = '-1000px';
    dragIcon.innerHTML = `
      <svg width="80" height="40" viewBox="0 0 80 40" xmlns="http://www.w3.org/2000/svg">
         <rect width="80" height="40" fill="transparent" stroke="#3b82f6" stroke-width="2" rx="4" />
         <path d="${comp.iconPath}" stroke="#e2e8f0" fill="none" stroke-width="2" />
         <text x="40" y="-5" text-anchor="middle" fill="#cbd5e1" font-size="10">${comp.label}</text>
      </svg>
    `;
    document.body.appendChild(dragIcon);
    e.dataTransfer.setDragImage(dragIcon, 40, 20);
    setTimeout(() => document.body.removeChild(dragIcon), 0);
  };

  if (!isOpen) return null;

  return (
    <div className={clsx(
        "bg-slate-900 border-slate-800 flex flex-col z-30 shadow-xl transition-all duration-300",
        // Desktop Styles
        "md:w-64 md:h-full md:border-r md:relative",
        // Mobile Styles (Bottom Sheet)
        "fixed bottom-0 left-0 right-0 h-[55vh] rounded-t-2xl border-t w-full"
    )}>
      {/* Mobile Drag Handle */}
      <div className="md:hidden w-full flex justify-center pt-2 pb-1" onClick={onClose}>
          <div className="w-12 h-1.5 bg-slate-700 rounded-full"></div>
      </div>

      {/* Header */}
      <div className="px-4 pt-3 pb-0 shrink-0">
        <div className="flex justify-between items-center mb-3">
             <h2 className="text-slate-100 font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                <Grid size={16} className="text-blue-500"/>
                Library
             </h2>
             <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1">
                 <X size={18} />
             </button>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-slate-800 mb-3">
            <button 
                onClick={() => setActiveTab('components')}
                className={clsx(
                    "flex-1 pb-2 text-sm font-medium transition-colors relative",
                    activeTab === 'components' ? "text-blue-400" : "text-slate-400 hover:text-slate-200"
                )}
            >
                Components
                {activeTab === 'components' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t-full"></div>}
            </button>
            <button 
                onClick={() => setActiveTab('presets')}
                className={clsx(
                    "flex-1 pb-2 text-sm font-medium transition-colors relative",
                    activeTab === 'presets' ? "text-blue-400" : "text-slate-400 hover:text-slate-200"
                )}
            >
                Presets
                {activeTab === 'presets' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t-full"></div>}
            </button>
        </div>

        <div className="relative mb-2">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"/>
          <input 
            type="text" 
            placeholder={activeTab === 'components' ? "Search components..." : "Search presets..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded pl-9 pr-2 py-2 text-sm text-slate-300 focus:border-blue-600 outline-none placeholder:text-slate-600"
          />
        </div>
      </div>
      
      {/* Content List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar pb-20 md:pb-2">
        {activeTab === 'components' ? (
            <>
                {filteredComponents.map((comp, idx) => (
                <div
                    key={idx}
                    draggable
                    onDragStart={(e) => handleDragStart(e, comp)}
                    onClick={() => onAddComponent(comp.type, comp.defaultVal, comp.label)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-all group text-left cursor-grab active:cursor-grabbing select-none touch-manipulation"
                >
                    {/* Preview Thumbnail */}
                    <div className="w-12 h-10 bg-slate-950 rounded border border-slate-800 flex items-center justify-center shrink-0 group-hover:border-blue-500/30 transition-colors pointer-events-none">
                        <svg width="30" height="20" viewBox="0 0 80 40" className="text-slate-400 group-hover:text-blue-400 transition-colors">
                            <path d={comp.iconPath} stroke="currentColor" fill="none" strokeWidth="3" vectorEffect="non-scaling-stroke" />
                        </svg>
                    </div>
                    
                    <div className="min-w-0 flex-1 pointer-events-none">
                        <div className="text-slate-200 font-medium text-sm truncate group-hover:text-blue-200">{comp.fullName}</div>
                        <div className="text-slate-500 text-[10px] truncate uppercase tracking-wider">{comp.label}</div>
                    </div>
                    
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none md:opacity-0 opacity-100">
                        <Plus size={16} className="text-blue-400"/>
                    </div>
                </div>
                ))}
                {filteredComponents.length === 0 && (
                    <div className="text-center text-slate-500 text-sm py-8">No components found.</div>
                )}
            </>
        ) : (
            <>
                {filteredPresets.map((preset, idx) => (
                    <button
                        key={idx}
                        onClick={() => onLoadPreset(preset.components as any, preset.wires)}
                        className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-all group text-left select-none touch-manipulation"
                    >
                         <div className="w-10 h-10 bg-slate-950 rounded-full border border-slate-800 flex items-center justify-center shrink-0 group-hover:border-indigo-500/50 transition-colors mt-1">
                             <Zap size={18} className="text-indigo-500" />
                         </div>
                         <div className="min-w-0 flex-1">
                            <div className="text-slate-200 font-medium text-sm group-hover:text-indigo-300">{preset.name}</div>
                            <div className="text-slate-500 text-xs mt-1 leading-tight">{preset.description}</div>
                         </div>
                         <div className="self-center">
                            <BookOpen size={16} className="text-slate-600 group-hover:text-indigo-400" />
                         </div>
                    </button>
                ))}
                {filteredPresets.length === 0 && (
                    <div className="text-center text-slate-500 text-sm py-8">No presets found.</div>
                )}
            </>
        )}
      </div>
    </div>
  );
};

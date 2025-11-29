import React, { useState, useEffect } from 'react';
import { CircuitComponent, ComponentType, SimulationResult, Wire, SimulationMode, SimulationConfig } from '../types';
import { Trash2, Zap, Activity, Settings2, X, LineChart as LineChartIcon, RotateCw, Unplug } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import clsx from 'clsx';

interface PropertiesPanelProps {
  selectedItem: CircuitComponent | Wire | null;
  onUpdate: (id: string, field: string, value: any) => void;
  onDelete: (id: string) => void;
  simulationResult: SimulationResult | null;
  
  // AI Props Restored
  onRunAnalysis: () => void;
  isAnalyzing: boolean;
  aiAnalysis: string | null;

  config: SimulationConfig;
  onConfigChange: (newConfig: Partial<SimulationConfig>) => void;
  
  onClose: () => void;
}

const PREFIXES = [
    { label: 'p', value: 1e-12 },
    { label: 'n', value: 1e-9 },
    { label: 'µ', value: 1e-6 },
    { label: 'm', value: 1e-3 },
    { label: '', value: 1 },
    { label: 'k', value: 1e3 },
    { label: 'M', value: 1e6 },
    { label: 'G', value: 1e9 },
];

interface UnitInputProps {
    value: number;
    onChange: (val: number) => void;
    unit: string;
}

const UnitInput: React.FC<UnitInputProps> = ({ 
    value, 
    onChange, 
    unit 
}) => {
    const [prefixObj, setPrefixObj] = useState(() => {
        if (value === 0) return PREFIXES.find(p => p.value === 1)!;
        const absVal = Math.abs(value);
        const sorted = [...PREFIXES].sort((a, b) => b.value - a.value);
        const match = sorted.find(p => absVal >= p.value * 0.9) || PREFIXES.find(p => p.value === 1)!;
        return match;
    });
    
    const [localNum, setLocalNum] = useState<string>(
        () => parseFloat((value / prefixObj.value).toPrecision(6)).toString()
    );

    useEffect(() => {
        const currentVal = parseFloat(localNum) * prefixObj.value;
        if (Math.abs(currentVal - value) / (Math.abs(value) || 1) > 0.01) {
             if (value === 0) {
                 setPrefixObj(PREFIXES.find(p => p.value === 1)!);
                 setLocalNum("0");
             } else {
                const sorted = [...PREFIXES].sort((a, b) => b.value - a.value);
                const match = sorted.find(p => Math.abs(value) >= p.value * 0.9) || PREFIXES.find(p => p.value === 1)!;
                setPrefixObj(match);
                setLocalNum(parseFloat((value / match.value).toPrecision(6)).toString());
             }
        }
    }, [value]); 

    const handleNumChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalNum(e.target.value);
        const num = parseFloat(e.target.value);
        if (!isNaN(num)) {
            onChange(num * prefixObj.value);
        }
    };

    const handlePrefixChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newPrefixVal = parseFloat(e.target.value);
        const newPrefix = PREFIXES.find(p => p.value === newPrefixVal)!;
        setPrefixObj(newPrefix);
        const num = parseFloat(localNum);
        if (!isNaN(num)) {
            onChange(num * newPrefixVal);
        }
    };

    return (
        <div className="flex gap-2">
            <input 
                type="number" 
                step="any"
                value={localNum}
                onChange={handleNumChange}
                className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-base text-white outline-none focus:border-blue-500 transition-colors"
            />
            <div className="relative">
                <select 
                    value={prefixObj.value}
                    onChange={handlePrefixChange}
                    className="appearance-none bg-slate-800 border border-slate-700 rounded px-3 py-2 pr-8 text-base text-blue-200 outline-none cursor-pointer hover:bg-slate-700 transition-colors w-20"
                >
                    {PREFIXES.map(p => (
                        <option key={p.label} value={p.value}>{p.label}{unit}</option>
                    ))}
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-xs text-slate-400">
                    ▼
                </div>
            </div>
        </div>
    );
};

const getComponentPropInfo = (type: ComponentType) => {
    switch(type) {
        case ComponentType.RESISTOR: return { label: 'Resistance', unit: 'Ω' };
        case ComponentType.CAPACITOR: return { label: 'Capacitance', unit: 'F' };
        case ComponentType.INDUCTOR: return { label: 'Inductance', unit: 'H' };
        case ComponentType.VOLTAGE_SOURCE: 
        case ComponentType.AC_SOURCE: return { label: 'Amplitude (Peak)', unit: 'V' };
        case ComponentType.DIODE: 
        case ComponentType.LED: return { label: 'Forward Voltage', unit: 'V' };
        case ComponentType.OPAMP: return { label: 'Open Loop Gain', unit: 'A' };
        default: return { label: 'Value', unit: '' };
    }
};

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedItem,
  onUpdate,
  onDelete,
  simulationResult,
  onRunAnalysis,
  isAnalyzing,
  aiAnalysis,
  config,
  onConfigChange,
  onClose
}) => {
  
  const isInteractive = config.mode === SimulationMode.INTERACTIVE;
  
  const barData = simulationResult?.mode === SimulationMode.INTERACTIVE 
    ? simulationResult.nodes.map(n => ({
        name: `N${n.id}`,
        voltage: parseFloat(n.voltage.toFixed(2)),
        phase: n.phase ? parseFloat(n.phase.toFixed(1)) : 0
      })).filter(n => n.name !== 'N0') 
    : [];

  const plotData = simulationResult?.plotData || [];
  const plotKeys = plotData.length > 0 ? Object.keys(plotData[0]).filter(k => k !== 'x') : [];
  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1'];

  const propInfo = selectedItem && 'type' in selectedItem ? getComponentPropInfo(selectedItem.type) : { label: '', unit: '' };

  return (
    <div className={clsx(
        "bg-slate-900 border-slate-800 flex flex-col shadow-xl z-30 transition-all duration-300",
        "md:w-96 md:max-w-full md:h-full md:border-l md:relative",
        "fixed bottom-0 left-0 right-0 h-[55vh] rounded-t-2xl border-t w-full"
    )}>
      <div className="md:hidden w-full flex justify-center pt-2 pb-1" onClick={onClose}>
          <div className="w-12 h-1.5 bg-slate-700 rounded-full"></div>
      </div>

      <div className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
        <h2 className="font-bold text-slate-100 flex items-center gap-2">
            <Activity size={18} className="text-blue-500"/>
            Properties
        </h2>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1 hover:bg-slate-800 rounded">
            <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar pb-24 md:pb-4">
        
        {/* Component Selection */}
        {selectedItem && 'type' in selectedItem && (
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 shadow-sm">
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-blue-400 flex items-center gap-2">
                    Component Settings
                </h3>
                <div className="flex gap-2">
                     <button 
                        onClick={() => onUpdate(selectedItem.id, 'rotation', ((selectedItem.rotation || 0) + 90) % 360)}
                        className="text-slate-400 hover:text-blue-400 transition-colors bg-slate-900/50 p-2 rounded hover:bg-slate-800"
                        title="Rotate Component"
                     >
                         <RotateCw size={16} />
                     </button>
                    <button onClick={() => onDelete(selectedItem.id)} className="text-red-400 hover:text-red-300 transition-colors bg-slate-900/50 p-2 rounded hover:bg-red-900/20">
                        <Trash2 size={16} />
                    </button>
                </div>
             </div>
             
             <div className="space-y-4">
                <div>
                    <label className="text-xs text-slate-400 block mb-1.5 uppercase tracking-wider font-bold">Label</label>
                    <input 
                        type="text" value={selectedItem.label}
                        onChange={(e) => onUpdate(selectedItem.id, 'label', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-base text-white outline-none focus:border-blue-500 transition-colors"
                    />
                </div>
                {selectedItem.type !== ComponentType.GROUND && (
                    <div>
                        <label className="text-xs text-slate-400 block mb-1.5 uppercase tracking-wider font-bold">{propInfo.label}</label>
                        <UnitInput 
                            key={selectedItem.id} 
                            value={selectedItem.value}
                            onChange={(val) => onUpdate(selectedItem.id, 'value', val)}
                            unit={propInfo.unit}
                        />
                    </div>
                )}
                {selectedItem.type === ComponentType.AC_SOURCE && (
                    <>
                        <div>
                            <label className="text-xs text-slate-400 block mb-1.5 uppercase tracking-wider font-bold">Waveform</label>
                            <select 
                                value={selectedItem.waveform || 'SINE'}
                                onChange={(e) => onUpdate(selectedItem.id, 'waveform', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-base text-white outline-none focus:border-blue-500"
                            >
                                <option value="SINE">Sine Wave</option>
                                <option value="SQUARE">Square Wave</option>
                                <option value="TRIANGLE">Triangle Wave</option>
                                <option value="SAWTOOTH">Sawtooth Wave</option>
                                <option value="PULSE">Pulse (0 to Max)</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 block mb-1.5 uppercase tracking-wider font-bold">Frequency</label>
                            <UnitInput 
                                key={`${selectedItem.id}-freq`} 
                                value={selectedItem.frequency || 60}
                                onChange={(val) => onUpdate(selectedItem.id, 'frequency', val)}
                                unit="Hz"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 block mb-1.5 uppercase tracking-wider font-bold">DC Offset (Bias)</label>
                            <UnitInput 
                                key={`${selectedItem.id}-bias`} 
                                value={selectedItem.dcBias || 0}
                                onChange={(val) => onUpdate(selectedItem.id, 'dcBias', val)}
                                unit="V"
                            />
                        </div>
                        {(selectedItem.waveform === 'SQUARE' || selectedItem.waveform === 'PULSE') && (
                             <div>
                                <label className="text-xs text-slate-400 block mb-1.5 uppercase tracking-wider font-bold">Duty Cycle (0-1)</label>
                                <input 
                                    type="number" 
                                    step="0.1" min="0.1" max="0.9"
                                    value={selectedItem.dutyCycle || 0.5}
                                    onChange={(e) => onUpdate(selectedItem.id, 'dutyCycle', parseFloat(e.target.value))}
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-base text-white outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                        )}
                    </>
                )}
                {selectedItem.type === ComponentType.OPAMP && (
                    <div>
                        <label className="text-xs text-slate-400 block mb-1.5 uppercase tracking-wider font-bold">Input Impedance</label>
                        <UnitInput 
                            key={`${selectedItem.id}-zin`} 
                            value={selectedItem.inputImpedance || 10000000}
                            onChange={(val) => onUpdate(selectedItem.id, 'inputImpedance', val)}
                            unit="Ω"
                        />
                    </div>
                )}
                {selectedItem.type === ComponentType.LED && (
                    <div>
                        <label className="text-xs text-slate-400 block mb-1.5 uppercase tracking-wider font-bold">Max Current</label>
                        <UnitInput 
                            key={`${selectedItem.id}-imax`} 
                            value={selectedItem.maxCurrent || 0.03}
                            onChange={(val) => onUpdate(selectedItem.id, 'maxCurrent', val)}
                            unit="A"
                        />
                    </div>
                )}
                {[ComponentType.AND_GATE, ComponentType.OR_GATE, ComponentType.NAND_GATE, ComponentType.NOR_GATE, ComponentType.XOR_GATE].includes(selectedItem.type) && (
                    <div>
                         <label className="text-xs text-slate-400 block mb-1.5 uppercase tracking-wider font-bold">Input Pins</label>
                         <input 
                             type="number" 
                             min="2" max="8" 
                             value={selectedItem.inputCount || 2}
                             onChange={(e) => onUpdate(selectedItem.id, 'inputCount', Math.min(8, Math.max(2, parseInt(e.target.value))))}
                             className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-base text-white outline-none focus:border-blue-500 transition-colors"
                         />
                    </div>
                )}
             </div>
          </div>
        )}

        {/* Wire Selection */}
        {selectedItem && !('type' in selectedItem) && (
            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 shadow-sm">
                 <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-semibold text-blue-400 flex items-center gap-2">
                        <Unplug size={16}/>
                        Wire Connection
                    </h3>
                    <button onClick={() => onDelete(selectedItem.id)} className="text-red-400 hover:text-red-300 transition-colors bg-slate-900/50 p-2 rounded hover:bg-red-900/20">
                        <Trash2 size={16} />
                    </button>
                 </div>
                 <p className="text-xs text-slate-500">ID: {selectedItem.id}</p>
            </div>
        )}

        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
            <h3 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-2">
                <Settings2 size={14}/> Simulation Config
            </h3>
            
            <div className="mb-3">
                <label className="text-xs text-slate-400 block mb-1">Mode</label>
                <select 
                    value={config.mode}
                    onChange={(e) => onConfigChange({ mode: e.target.value as SimulationMode })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-base text-white focus:border-blue-500 outline-none"
                >
                    <option value={SimulationMode.INTERACTIVE}>Interactive (DC/SS)</option>
                    <option value={SimulationMode.TRANSIENT}>Transient (Time)</option>
                    <option value={SimulationMode.AC_SWEEP}>AC Sweep (Freq)</option>
                </select>
            </div>

            {config.mode === SimulationMode.AC_SWEEP && (
                <div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                         <div>
                            <label className="text-xs text-slate-400 block mb-1">Start Freq (Hz)</label>
                            <input 
                                type="number" 
                                min="1"
                                value={config.startFreq}
                                onChange={(e) => onConfigChange({ startFreq: parseFloat(e.target.value) })}
                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-base text-white font-mono"
                            />
                         </div>
                         <div>
                            <label className="text-xs text-slate-400 block mb-1">Stop Freq (Hz)</label>
                            <input 
                                type="number" 
                                min="1"
                                value={config.stopFreq}
                                onChange={(e) => onConfigChange({ stopFreq: parseFloat(e.target.value) })}
                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-base text-white font-mono"
                            />
                         </div>
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">Points (Steps)</label>
                        <input 
                            type="number" 
                            min="2"
                            max="100"
                            value={config.points}
                            onChange={(e) => onConfigChange({ points: parseFloat(e.target.value) })}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-base text-white font-mono"
                        />
                    </div>
                </div>
            )}

            {config.mode === SimulationMode.TRANSIENT && (
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">Stop Time (s)</label>
                        <input 
                            type="number" step="0.001" value={config.stopTime}
                            onChange={(e) => onConfigChange({ stopTime: parseFloat(e.target.value) })}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-base text-white font-mono"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">Step (s)</label>
                        <input 
                            type="number" step="0.0001" value={config.timeStep}
                            onChange={(e) => onConfigChange({ timeStep: parseFloat(e.target.value) })}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-base text-white font-mono"
                        />
                    </div>
                </div>
            )}
        </div>

        <div className="space-y-2 min-h-[200px]">
             <h3 className="text-sm font-semibold text-green-400 flex items-center gap-2">
                {config.mode === SimulationMode.INTERACTIVE ? <Zap size={14}/> : <LineChartIcon size={14} />}
                {config.mode === SimulationMode.INTERACTIVE ? 'Live Measurements' : 'Analysis Plot'}
            </h3>
            
            {simulationResult?.error ? (
                 <div className="p-3 bg-red-900/20 border border-red-900/50 rounded text-red-200 text-xs">
                    {simulationResult.error}
                 </div>
            ) : (
                <div className="h-48 w-full bg-slate-950/50 rounded border border-slate-800 p-2">
                     <ResponsiveContainer width="100%" height="100%">
                        {isInteractive ? (
                            <BarChart data={barData}>
                                <XAxis dataKey="name" tick={{fill: '#94a3b8', fontSize: 10}} axisLine={false} tickLine={false} />
                                <YAxis tick={{fill: '#94a3b8', fontSize: 10}} axisLine={false} tickLine={false} width={30}/>
                                <Tooltip 
                                    contentStyle={{backgroundColor: '#1e293b', borderColor: '#334155', fontSize: '12px'}}
                                    itemStyle={{color: '#e2e8f0'}}
                                    cursor={{fill: '#334155', opacity: 0.4}}
                                />
                                <Bar dataKey="voltage" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        ) : (
                            <LineChart data={plotData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5}/>
                                <XAxis 
                                    dataKey="x" 
                                    tick={{fill: '#94a3b8', fontSize: 10}} 
                                    tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val.toString()}
                                    label={{ value: config.mode === 'AC_SWEEP' ? 'Freq (Hz)' : 'Time (s)', position: 'bottom', fill: '#94a3b8', fontSize: 10 }}
                                    scale={config.mode === 'AC_SWEEP' ? 'log' : 'auto'}
                                    domain={['auto', 'auto']}
                                    type="number"
                                />
                                <YAxis tick={{fill: '#94a3b8', fontSize: 10}} width={30} />
                                <Tooltip 
                                    contentStyle={{backgroundColor: '#1e293b', borderColor: '#334155', fontSize: '12px'}}
                                    itemStyle={{color: '#e2e8f0'}}
                                    labelFormatter={(val) => config.mode === 'AC_SWEEP' ? `Freq: ${val}Hz` : `Time: ${val}s`}
                                    formatter={(val: number) => [val.toFixed(4), 'V']}
                                />
                                <Legend wrapperStyle={{fontSize: '10px'}}/>
                                {plotKeys.map((key, idx) => (
                                    <Line 
                                        key={key} 
                                        type="monotone" 
                                        dataKey={key} 
                                        stroke={colors[idx % colors.length]} 
                                        dot={false} 
                                        strokeWidth={2}
                                    />
                                ))}
                            </LineChart>
                        )}
                     </ResponsiveContainer>
                </div>
            )}
        </div>

        <div className="pt-4 border-t border-slate-800">
            <button 
                onClick={onRunAnalysis}
                disabled={isAnalyzing}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 text-white text-base py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2 mb-4 font-medium shadow-lg shadow-indigo-900/20"
            >
                {isAnalyzing ? <span className="animate-pulse">Analyzing...</span> : <span>✨ AI Circuit Analyst</span>}
            </button>
             {aiAnalysis && (
                <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700 text-sm text-slate-300 leading-relaxed max-h-60 overflow-y-auto">
                    <div className="markdown-prose">
                        {aiAnalysis.split('\n').map((line, i) => (
                            <p key={i} className={line.startsWith('-') || line.startsWith('1.') ? "ml-4 mb-1" : "mb-2"}>
                                {line}
                            </p>
                        ))}
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
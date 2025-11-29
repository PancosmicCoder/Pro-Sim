
export enum ComponentType {
  RESISTOR = 'RESISTOR',
  VOLTAGE_SOURCE = 'VOLTAGE_SOURCE', // DC
  AC_SOURCE = 'AC_SOURCE',
  GROUND = 'GROUND',
  CAPACITOR = 'CAPACITOR',
  INDUCTOR = 'INDUCTOR',
  DIODE = 'DIODE',
  LED = 'LED',
  OPAMP = 'OPAMP',
  AND_GATE = 'AND_GATE',
  OR_GATE = 'OR_GATE',
  NOT_GATE = 'NOT_GATE',
  NAND_GATE = 'NAND_GATE',
  NOR_GATE = 'NOR_GATE',
  XOR_GATE = 'XOR_GATE',
  VOLTMETER = 'VOLTMETER',
  AMMETER = 'AMMETER'
}

export enum SimulationMode {
  INTERACTIVE = 'INTERACTIVE',
  TRANSIENT = 'TRANSIENT',
  AC_SWEEP = 'AC_SWEEP'
}

export type Waveform = 'SINE' | 'SQUARE' | 'TRIANGLE' | 'SAWTOOTH' | 'PULSE';

export interface Position {
  x: number;
  y: number;
}

export interface CircuitComponent {
  id: string;
  type: ComponentType;
  value: number; // Ohms, Volts, Farads, Henrys, or Gain (for OpAmp)
  
  // AC / Signal Gen Properties
  frequency?: number; // Hz 
  waveform?: Waveform;
  dcBias?: number; // DC Offset for AC sources
  dutyCycle?: number; // 0-1 for Pulse/Square

  // OpAmp
  inputImpedance?: number; // Ohms
  
  // Logic
  inputCount?: number; // For Logic Gates (default 2)
  
  // Limits
  maxCurrent?: number; // Amps (For LED/Fuse limits)
  
  position: Position;
  rotation: number; // 0, 90, 180, 270
  label: string;
  zIndex?: number; // Layering order
}

// A connection point on a component
export interface Port {
  componentId: string;
  portIndex: number; // 0, 1, 2...
  position?: Position; // Calculated absolute position
}

export interface Wire {
  id: string;
  from: Port;
  to: Port;
}

export interface SimulationNode {
  id: number; // 0 is always GND
  voltage: number; // DC Voltage or AC Magnitude
  phase?: number;  // AC Phase in degrees
  componentIds: string[];
}

export interface DataPoint {
  x: number; // Time or Frequency
  [key: string]: number; // 'N1', 'N2' voltages/magnitudes
}

export interface SimulationResult {
  nodes: SimulationNode[]; // For Interactive/DC
  nodeVoltages: Map<number, { magnitude: number, phase: number }>;
  componentCurrents: Map<string, number>; // Current magnitude/value through component.
  error?: string;
  frequency: number;
  
  // For Analysis Plots
  plotData?: DataPoint[]; 
  mode: SimulationMode;
}

export interface SimulationConfig {
  mode: SimulationMode;
  // Transient
  timeStep: number;
  stopTime: number;
  // AC Sweep
  startFreq: number;
  stopFreq: number;
  points: number;
}

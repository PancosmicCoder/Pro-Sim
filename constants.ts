

import { ComponentType, CircuitComponent, Wire } from './types';

export const GRID_SIZE = 20;
export const COMPONENT_WIDTH = 80;
export const COMPONENT_HEIGHT = 40;

export const INITIAL_COMPONENTS = [
  {
    type: ComponentType.VOLTAGE_SOURCE,
    label: 'Vdc',
    fullName: 'DC Voltage Source',
    defaultVal: 5,
    unit: 'V',
    iconPath: 'M0,20 L35,20 M45,20 L80,20 M35,5 V35 M45,12 V28 M25,10 V16 M22,13 H28' 
  },
  {
    type: ComponentType.AC_SOURCE,
    label: 'Vac',
    fullName: 'AC Voltage Source',
    defaultVal: 5, // Amplitude (Peak)
    frequency: 60,
    waveform: 'SINE',
    dcBias: 0,
    unit: 'V',
    iconPath: 'M0,20 L25,20 M55,20 L80,20 M40,20 m-15,0 a15,15 0 1,0 30,0 a15,15 0 1,0 -30,0 M30,20 Q35,10 40,20 T50,20'
  },
  {
    type: ComponentType.RESISTOR,
    label: 'R',
    fullName: 'Resistor',
    defaultVal: 1000,
    unit: 'Ω',
    iconPath: 'M0,20 L15,20 L18,10 L24,30 L30,10 L36,30 L42,10 L48,30 L54,10 L60,30 L66,10 L72,30 L75,20 L80,20'
  },
  {
    type: ComponentType.CAPACITOR,
    label: 'C',
    fullName: 'Capacitor',
    defaultVal: 1e-6, // 1uF
    unit: 'F',
    iconPath: 'M0,20 L35,20 M45,20 L80,20 M35,5 V35 M45,5 V35'
  },
  {
    type: ComponentType.INDUCTOR,
    label: 'L',
    fullName: 'Inductor',
    defaultVal: 1e-3, // 1mH
    unit: 'H',
    iconPath: 'M0,20 L15,20 Q23,5 31,20 T47,20 T63,20 L80,20'
  },
  {
    type: ComponentType.OPAMP,
    label: 'Op',
    fullName: 'Op-Amp',
    defaultVal: 100000, // Open Loop Gain
    inputImpedance: 10000000, // 10M Ohm
    unit: 'A',
    iconPath: 'M15,5 L15,35 L65,20 Z M0,12 H15 M0,28 H15 M65,20 H80'
  },
  {
    type: ComponentType.DIODE,
    label: 'D',
    fullName: 'Diode',
    defaultVal: 0, 
    unit: '',
    iconPath: 'M0,20 L30,20 M50,20 L80,20 M30,10 L30,30 L50,20 Z M50,10 V30'
  },
  {
    type: ComponentType.LED,
    label: 'LED',
    fullName: 'Light Emitting Diode',
    defaultVal: 0, 
    maxCurrent: 0.03, // 30mA default limit
    unit: '',
    iconPath: 'M0,20 L30,20 M50,20 L80,20 M30,10 L30,30 L50,20 Z M50,10 V30 M52,10 L60,2 M56,14 L64,6'
  },
  {
    type: ComponentType.GROUND,
    label: 'GND',
    fullName: 'Ground',
    defaultVal: 0,
    unit: '',
    iconPath: 'M40,0 L40,20 M24,20 H56 M30,26 H50 M36,32 H44'
  },
  {
    type: ComponentType.VOLTMETER,
    label: 'V_meter',
    fullName: 'Voltmeter',
    defaultVal: 0,
    unit: '',
    iconPath: 'M0,20 L25,20 M55,20 L80,20 M40,20 m-15,0 a15,15 0 1,0 30,0 a15,15 0 1,0 -30,0 M38,15 L42,25 L46,15'
  },
  {
    type: ComponentType.AMMETER,
    label: 'A_meter',
    fullName: 'Ammeter',
    defaultVal: 0,
    unit: '',
    iconPath: 'M0,20 L25,20 M55,20 L80,20 M40,20 m-15,0 a15,15 0 1,0 30,0 a15,15 0 1,0 -30,0 M36,25 L40,15 L44,25 M38,21 H42'
  },
  {
    type: ComponentType.AND_GATE,
    label: 'AND',
    fullName: 'AND Gate',
    defaultVal: 5, // VCC
    inputCount: 2,
    unit: 'V',
    iconPath: 'M15,5 V35 H35 A15,15 0 0 0 35,5 Z M50,20 H80'
  },
  {
    type: ComponentType.OR_GATE,
    label: 'OR',
    fullName: 'OR Gate',
    defaultVal: 5,
    inputCount: 2,
    unit: 'V',
    iconPath: 'M15,5 Q20,20 15,35 Q45,35 60,20 Q45,5 15,5 M60,20 H80'
  },
  {
    type: ComponentType.NOT_GATE,
    label: 'NOT',
    fullName: 'NOT Gate',
    defaultVal: 5,
    unit: 'V',
    iconPath: 'M15,5 V35 L50,20 Z M50,20 L54,20 A2,2 0 1,0 58,20 A2,2 0 1,0 54,20 M58,20 H80'
  },
  {
    type: ComponentType.NAND_GATE,
    label: 'NAND',
    fullName: 'NAND Gate',
    defaultVal: 5,
    inputCount: 2,
    unit: 'V',
    iconPath: 'M15,5 V35 H35 A15,15 0 0 0 35,5 Z M50,20 L54,20 A2,2 0 1,0 58,20 A2,2 0 1,0 54,20 M58,20 H80'
  },
  {
    type: ComponentType.NOR_GATE,
    label: 'NOR',
    fullName: 'NOR Gate',
    defaultVal: 5,
    inputCount: 2,
    unit: 'V',
    iconPath: 'M15,5 Q20,20 15,35 Q45,35 60,20 Q45,5 15,5 M60,20 L64,20 A2,2 0 1,0 68,20 A2,2 0 1,0 64,20 M68,20 H80'
  },
  {
    type: ComponentType.XOR_GATE,
    label: 'XOR',
    fullName: 'XOR Gate',
    defaultVal: 5,
    inputCount: 2,
    unit: 'V',
    iconPath: 'M10,5 Q15,20 10,35 M15,5 Q20,20 15,35 Q45,35 60,20 Q45,5 15,5 M60,20 H80'
  }
];

export const PRESET_CIRCUITS = [
  {
    name: "Ohm's Law (DC)",
    description: "Simple DC circuit demonstrating V=IR",
    components: [
      { id: "v1", type: ComponentType.VOLTAGE_SOURCE, value: 10, label: "V1", position: {x: 100, y: 100}, rotation: 0 },
      { id: "r1", type: ComponentType.RESISTOR, value: 100, label: "R1", position: {x: 300, y: 100}, rotation: 0 },
      { id: "gnd", type: ComponentType.GROUND, value: 0, label: "GND", position: {x: 300, y: 240}, rotation: 0 }
    ],
    wires: [
      { id: "w1", from: { componentId: "v1", portIndex: 0 }, to: { componentId: "r1", portIndex: 0 } },
      { id: "w2", from: { componentId: "r1", portIndex: 1 }, to: { componentId: "gnd", portIndex: 0 } },
      { id: "w3", from: { componentId: "gnd", portIndex: 0 }, to: { componentId: "v1", portIndex: 1 } }
    ]
  },
  {
    name: "Op-Amp Integrator",
    description: "Active integration using Op-Amp and Capacitor",
    components: [
        { id: "vin", type: ComponentType.AC_SOURCE, value: 2, frequency: 50, waveform: 'SINE', label: "Vin", position: {x: 40, y: 80}, rotation: 0 },
        { id: "r1", type: ComponentType.RESISTOR, value: 1000, label: "R1", position: {x: 160, y: 80}, rotation: 0 },
        { id: "op1", type: ComponentType.OPAMP, value: 100000, inputImpedance: 10000000, label: "Op1", position: {x: 300, y: 100}, rotation: 0 },
        { id: "c1", type: ComponentType.CAPACITOR, value: 10e-6, label: "C1 (Fdbk)", position: {x: 280, y: 20}, rotation: 0 },
        { id: "gnd1", type: ComponentType.GROUND, value: 0, label: "GND", position: {x: 40, y: 180}, rotation: 0 },
        { id: "gnd2", type: ComponentType.GROUND, value: 0, label: "GND", position: {x: 300, y: 180}, rotation: 0 }
    ],
    wires: [
        // Vin to R1
        { id: "w1", from: { componentId: "vin", portIndex: 0 }, to: { componentId: "r1", portIndex: 0 } },
        // R1 to OpAmp Inverting Input (-) [Port 1]
        { id: "w2", from: { componentId: "r1", portIndex: 1 }, to: { componentId: "op1", portIndex: 1 } },
        // Feedback Capacitor C1 connects to OpAmp (-) [Port 1]
        { id: "w3", from: { componentId: "c1", portIndex: 0 }, to: { componentId: "op1", portIndex: 1 } },
        // Feedback Capacitor C1 connects to OpAmp Output [Port 2]
        { id: "w4", from: { componentId: "c1", portIndex: 1 }, to: { componentId: "op1", portIndex: 2 } },
        // OpAmp Non-Inverting (+) [Port 0] to GND
        { id: "w5", from: { componentId: "op1", portIndex: 0 }, to: { componentId: "gnd2", portIndex: 0 } },
        // Vin Ground
        { id: "w6", from: { componentId: "vin", portIndex: 1 }, to: { componentId: "gnd1", portIndex: 0 } }
    ]
  },
  {
    name: "Op-Amp Differentiator",
    description: "Active differentiation using Op-Amp and Resistor",
    components: [
        { id: "vin", type: ComponentType.AC_SOURCE, value: 1, frequency: 10, waveform: 'TRIANGLE', label: "Vin", position: {x: 40, y: 80}, rotation: 0 },
        { id: "c1", type: ComponentType.CAPACITOR, value: 100e-6, label: "C1", position: {x: 160, y: 80}, rotation: 0 },
        { id: "op1", type: ComponentType.OPAMP, value: 100000, inputImpedance: 10000000, label: "Op1", position: {x: 300, y: 100}, rotation: 0 },
        { id: "r1", type: ComponentType.RESISTOR, value: 1000, label: "R1 (Fdbk)", position: {x: 280, y: 20}, rotation: 0 },
        { id: "gnd1", type: ComponentType.GROUND, value: 0, label: "GND", position: {x: 40, y: 180}, rotation: 0 },
        { id: "gnd2", type: ComponentType.GROUND, value: 0, label: "GND", position: {x: 300, y: 180}, rotation: 0 }
    ],
    wires: [
        // Vin to C1
        { id: "w1", from: { componentId: "vin", portIndex: 0 }, to: { componentId: "c1", portIndex: 0 } },
        // C1 to OpAmp Inverting Input (-) [Port 1]
        { id: "w2", from: { componentId: "c1", portIndex: 1 }, to: { componentId: "op1", portIndex: 1 } },
        // Feedback Resistor R1 connects to OpAmp (-) [Port 1]
        { id: "w3", from: { componentId: "r1", portIndex: 0 }, to: { componentId: "op1", portIndex: 1 } },
        // Feedback Resistor R1 connects to OpAmp Output [Port 2]
        { id: "w4", from: { componentId: "r1", portIndex: 1 }, to: { componentId: "op1", portIndex: 2 } },
        // OpAmp Non-Inverting (+) [Port 0] to GND
        { id: "w5", from: { componentId: "op1", portIndex: 0 }, to: { componentId: "gnd2", portIndex: 0 } },
        // Vin Ground
        { id: "w6", from: { componentId: "vin", portIndex: 1 }, to: { componentId: "gnd1", portIndex: 0 } }
    ]
  },
  {
    name: "Logic: AND Gate",
    description: "Digital logic demonstration with current limiting",
    components: [
        { id: "va", type: ComponentType.VOLTAGE_SOURCE, value: 5, label: "Input A", position: {x: 60, y: 80}, rotation: 0 },
        { id: "vb", type: ComponentType.VOLTAGE_SOURCE, value: 5, label: "Input B", position: {x: 60, y: 200}, rotation: 0 },
        { id: "and1", type: ComponentType.AND_GATE, value: 5, inputCount: 2, label: "AND", position: {x: 240, y: 140}, rotation: 0 },
        { id: "r_lim", type: ComponentType.RESISTOR, value: 330, label: "R_lim", position: {x: 360, y: 140}, rotation: 0 },
        { id: "led1", type: ComponentType.LED, value: 0, label: "Out", position: {x: 480, y: 140}, rotation: 0 },
        { id: "gnd", type: ComponentType.GROUND, value: 0, label: "GND", position: {x: 480, y: 240}, rotation: 0 },
        { id: "gnd2", type: ComponentType.GROUND, value: 0, label: "GND", position: {x: 60, y: 300}, rotation: 0 }
    ],
    wires: [
        { id: "w1", from: { componentId: "va", portIndex: 0 }, to: { componentId: "and1", portIndex: 0 } },
        { id: "w2", from: { componentId: "vb", portIndex: 0 }, to: { componentId: "and1", portIndex: 1 } },
        { id: "w3", from: { componentId: "and1", portIndex: 2 }, to: { componentId: "r_lim", portIndex: 0 } },
        { id: "w4", from: { componentId: "r_lim", portIndex: 1 }, to: { componentId: "led1", portIndex: 0 } },
        { id: "w5", from: { componentId: "led1", portIndex: 1 }, to: { componentId: "gnd", portIndex: 0 } },
        { id: "w6", from: { componentId: "va", portIndex: 1 }, to: { componentId: "gnd2", portIndex: 0 } },
        { id: "w7", from: { componentId: "vb", portIndex: 1 }, to: { componentId: "gnd2", portIndex: 0 } }
    ]
  },
  {
    name: "RC Low Pass (AC Sweep)",
    description: "Frequency response of a Capacitor",
    components: [
        { id: "vac", type: ComponentType.AC_SOURCE, value: 5, frequency: 60, waveform: 'SINE', label: "Vin", position: {x: 100, y: 100}, rotation: 0 },
        { id: "r1", type: ComponentType.RESISTOR, value: 1000, label: "R1", position: {x: 240, y: 100}, rotation: 0 },
        { id: "c1", type: ComponentType.CAPACITOR, value: 1e-6, label: "C1", position: {x: 380, y: 100}, rotation: 0 },
        { id: "gnd", type: ComponentType.GROUND, value: 0, label: "GND", position: {x: 380, y: 200}, rotation: 0 }
    ],
    wires: [
        { id: "w1", from: { componentId: "vac", portIndex: 0 }, to: { componentId: "r1", portIndex: 0 } }, 
        { id: "w2", from: { componentId: "r1", portIndex: 1 }, to: { componentId: "c1", portIndex: 0 } },
        { id: "w3", from: { componentId: "c1", portIndex: 1 }, to: { componentId: "gnd", portIndex: 0 } },
        { id: "w4", from: { componentId: "gnd", portIndex: 0 }, to: { componentId: "vac", portIndex: 1 } } 
    ]
  },
  {
    name: "Transient RLC",
    description: "Step response with ringing",
    components: [
        { id: "vs", type: ComponentType.AC_SOURCE, value: 5, frequency: 50, waveform: 'PULSE', dutyCycle: 0.5, label: "Pulse", position: {x: 60, y: 100}, rotation: 0 },
        { id: "r1", type: ComponentType.RESISTOR, value: 10, label: "R1", position: {x: 200, y: 100}, rotation: 0 },
        { id: "l1", type: ComponentType.INDUCTOR, value: 0.05, label: "L1", position: {x: 340, y: 100}, rotation: 0 },
        { id: "c1", type: ComponentType.CAPACITOR, value: 100e-6, label: "C1", position: {x: 480, y: 100}, rotation: 0 },
        { id: "gnd", type: ComponentType.GROUND, value: 0, label: "GND", position: {x: 480, y: 200}, rotation: 0 }
    ],
    wires: [
        { id: "w1", from: { componentId: "vs", portIndex: 0 }, to: { componentId: "r1", portIndex: 0 } }, 
        { id: "w2", from: { componentId: "r1", portIndex: 1 }, to: { componentId: "l1", portIndex: 0 } },
        { id: "w3", from: { componentId: "l1", portIndex: 1 }, to: { componentId: "c1", portIndex: 0 } },
        { id: "w4", from: { componentId: "c1", portIndex: 1 }, to: { componentId: "gnd", portIndex: 0 } },
        { id: "w5", from: { componentId: "gnd", portIndex: 0 }, to: { componentId: "vs", portIndex: 1 } } 
    ]
  },
  {
    name: "LED Circuit (Sim)",
    description: "Current limiting resistor with LED",
    components: [
      { id: "v1", type: ComponentType.VOLTAGE_SOURCE, value: 9, label: "9V Bat", position: {x: 100, y: 100}, rotation: 0 },
      { id: "r1", type: ComponentType.RESISTOR, value: 330, label: "R_limit", position: {x: 300, y: 100}, rotation: 0 },
      { id: "d1", type: ComponentType.LED, value: 0, maxCurrent: 0.03, label: "LED", position: {x: 450, y: 100}, rotation: 0 },
      { id: "gnd", type: ComponentType.GROUND, value: 0, label: "GND", position: {x: 450, y: 240}, rotation: 0 }
    ],
    wires: [
      { id: "w1", from: { componentId: "v1", portIndex: 0 }, to: { componentId: "r1", portIndex: 0 } }, 
      { id: "w2", from: { componentId: "r1", portIndex: 1 }, to: { componentId: "d1", portIndex: 0 } },
      { id: "w3", from: { componentId: "d1", portIndex: 1 }, to: { componentId: "gnd", portIndex: 0 } },
      { id: "w4", from: { componentId: "gnd", portIndex: 0 }, to: { componentId: "v1", portIndex: 1 } } 
    ]
  }
];

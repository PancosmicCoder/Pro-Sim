
import { CircuitComponent, Wire, ComponentType, SimulationResult, Port, SimulationNode, SimulationMode, SimulationConfig, DataPoint } from '../types';

// --- Complex Number Helper ---
class Complex {
  constructor(public real: number, public imag: number) {}

  add(o: Complex): Complex { return new Complex(this.real + o.real, this.imag + o.imag); }
  sub(o: Complex): Complex { return new Complex(this.real - o.real, this.imag - o.imag); }
  mul(o: Complex): Complex { 
    return new Complex(
      this.real * o.real - this.imag * o.imag,
      this.real * o.imag + this.imag * o.real
    ); 
  }
  div(o: Complex): Complex {
    const den = o.real * o.real + o.imag * o.imag;
    if (den === 0) return new Complex(0, 0);
    return new Complex(
      (this.real * o.real + this.imag * o.imag) / den,
      (this.imag * o.real - this.real * o.imag) / den
    );
  }
  get magnitude(): number { return Math.sqrt(this.real ** 2 + this.imag ** 2); }
  get phase(): number { return Math.atan2(this.imag, this.real) * (180 / Math.PI); } // Degrees

  static zero(): Complex { return new Complex(0, 0); }
  static one(): Complex { return new Complex(1, 0); }
}

// --- Matrix Solver for Complex Numbers ---
class ComplexMatrixSolver {
  static solve(A: Complex[][], B: Complex[]): Complex[] {
    const n = A.length;
    const x: Complex[] = new Array(n).fill(Complex.zero());
    const Ac = A.map(row => [...row]); 
    const Bc = [...B];

    for (let i = 0; i < n; i++) {
      let maxRow = i;
      let maxVal = Ac[i][i].magnitude;
      for (let k = i + 1; k < n; k++) {
        if (Ac[k][i].magnitude > maxVal) {
          maxVal = Ac[k][i].magnitude;
          maxRow = k;
        }
      }
      [Ac[i], Ac[maxRow]] = [Ac[maxRow], Ac[i]];
      [Bc[i], Bc[maxRow]] = [Bc[maxRow], Bc[i]];

      if (Ac[i][i].magnitude < 1e-12) continue; // Singular

      for (let k = i + 1; k < n; k++) {
        const factor = Ac[k][i].div(Ac[i][i]);
        Bc[k] = Bc[k].sub(factor.mul(Bc[i]));
        for (let j = i; j < n; j++) {
          Ac[k][j] = Ac[k][j].sub(factor.mul(Ac[i][j]));
        }
      }
    }

    for (let i = n - 1; i >= 0; i--) {
      if (Ac[i][i].magnitude < 1e-12) continue;
      let sum = Complex.zero();
      for (let j = i + 1; j < n; j++) {
        sum = sum.add(Ac[i][j].mul(x[j]));
      }
      x[i] = Bc[i].sub(sum).div(Ac[i][i]);
    }
    return x;
  }
}

// --- Matrix Solver for Real Numbers ---
class MatrixSolver {
    static solve(A: number[][], B: number[]): number[] {
        const n = A.length;
        const x = new Array(n).fill(0);
        const M = A.map(row => [...row]);
        const V = [...B];

        for (let i = 0; i < n; i++) {
            let maxRow = i;
            let maxVal = Math.abs(M[i][i]);
            for (let k = i + 1; k < n; k++) {
                if (Math.abs(M[k][i]) > maxVal) {
                    maxVal = Math.abs(M[k][i]);
                    maxRow = k;
                }
            }
            [M[i], M[maxRow]] = [M[maxRow], M[i]];
            [V[i], V[maxRow]] = [V[maxRow], V[i]];

            if (Math.abs(M[i][i]) < 1e-12) continue;

            for (let k = i + 1; k < n; k++) {
                const factor = M[k][i] / M[i][i];
                V[k] -= factor * V[i];
                for (let j = i; j < n; j++) {
                    M[k][j] -= factor * M[i][j];
                }
            }
        }

        for (let i = n - 1; i >= 0; i--) {
            if (Math.abs(M[i][i]) < 1e-12) continue;
            let sum = 0;
            for (let j = i + 1; j < n; j++) {
                sum += M[i][j] * x[j];
            }
            x[i] = (V[i] - sum) / M[i][i];
        }
        return x;
    }
}

interface Graph {
    portToNode: Map<string, number>;
    numNodes: number;
}

export class CircuitSolver {
  
  private static buildGraph(components: CircuitComponent[], wires: Wire[]): Graph {
    const portToNode = new Map<string, number>();
    let nodeCount = 1; 

    const pk = (p: Port) => `${p.componentId}:${p.portIndex}`;
    const adj = new Map<string, string[]>();
    
    components.forEach(c => {
       adj.set(`${c.id}:0`, []);
       if(c.type !== ComponentType.GROUND && c.type !== ComponentType.NOT_GATE && ![ComponentType.AND_GATE, ComponentType.OR_GATE, ComponentType.NAND_GATE, ComponentType.NOR_GATE, ComponentType.XOR_GATE, ComponentType.OPAMP].includes(c.type)) {
         adj.set(`${c.id}:1`, []);
       }
       // Logic Gates Multi-input
       if ([ComponentType.AND_GATE, ComponentType.OR_GATE, ComponentType.NAND_GATE, ComponentType.NOR_GATE, ComponentType.XOR_GATE].includes(c.type)) {
           const count = c.inputCount || 2;
           for(let i=0; i<count; i++) {
               adj.set(`${c.id}:${i}`, []); // Inputs
           }
           adj.set(`${c.id}:${count}`, []); // Output
       }
       // OpAmp
       if (c.type === ComponentType.OPAMP) {
          adj.set(`${c.id}:1`, []);
          adj.set(`${c.id}:2`, []);
       }
       // Not Gate
       if (c.type === ComponentType.NOT_GATE) {
          adj.set(`${c.id}:1`, []);
       }
    });

    wires.forEach(w => {
      const k1 = pk(w.from);
      const k2 = pk(w.to);
      if (!adj.has(k1)) adj.set(k1, []);
      if (!adj.has(k2)) adj.set(k2, []);
      adj.get(k1)?.push(k2);
      adj.get(k2)?.push(k1);
    });

    const visited = new Set<string>();
    
    for (const portKey of adj.keys()) {
      if (visited.has(portKey)) continue;
      
      const group: string[] = [];
      const queue = [portKey];
      visited.add(portKey);
      let isGround = false;

      while(queue.length > 0) {
        const curr = queue.shift()!;
        group.push(curr);
        const [compId] = curr.split(':');
        const comp = components.find(c => c.id === compId);
        if (comp && comp.type === ComponentType.GROUND) isGround = true;
        
        const neighbors = adj.get(curr) || [];
        for(const n of neighbors) {
          if(!visited.has(n)) {
             visited.add(n);
             queue.push(n);
          }
        }
      }
      
      if (isGround) {
        group.forEach(p => portToNode.set(p, 0));
      } else {
        group.forEach(p => portToNode.set(p, nodeCount));
        nodeCount++;
      }
    }
    return { portToNode, numNodes: nodeCount - 1 };
  }

  // --- Interactive / DC Solver ---
  static solveCircuit(components: CircuitComponent[], wires: Wire[], frequency: number = 0): SimulationResult {
    const { portToNode, numNodes } = this.buildGraph(components, wires);

    if (!Array.from(portToNode.values()).includes(0)) {
        return { nodes: [], nodeVoltages: new Map(), componentCurrents: new Map(), error: "No Ground (GND) found.", frequency, mode: SimulationMode.INTERACTIVE };
    }

    const voltageSources = components.filter(c => c.type === ComponentType.VOLTAGE_SOURCE || c.type === ComponentType.AC_SOURCE);
    const ammeters = components.filter(c => c.type === ComponentType.AMMETER);
    const opamps = components.filter(c => c.type === ComponentType.OPAMP);
    const logicGates = components.filter(c => [
        ComponentType.AND_GATE, ComponentType.OR_GATE, ComponentType.NOT_GATE, 
        ComponentType.NAND_GATE, ComponentType.NOR_GATE, ComponentType.XOR_GATE
    ].includes(c.type));
    
    const numExtra = voltageSources.length + logicGates.length + ammeters.length + opamps.length;
    const size = numNodes + numExtra;
    const getNodeIdx = (nodeId: number) => nodeId - 1;
    
    let iteration = 0;
    const maxIterations = 20; 
    let converged = false;
    let currentVoltages = new Map<number, number>(); 
    for(let i=0; i<=numNodes; i++) currentVoltages.set(i, 0);
    const gateTargets = new Map<string, number>();
    logicGates.forEach(g => gateTargets.set(g.id, 0));
    let finalX: number[] = [];

    while(iteration < maxIterations && !converged) {
        logicGates.forEach(g => {
            const getV = (idx: number) => {
                const n = portToNode.get(`${g.id}:${idx}`);
                return n === undefined || n === 0 ? 0 : currentVoltages.get(n) || 0;
            };
            
            let target = 0;
            const logicHigh = g.value > 0 ? g.value : 5; 
            const threshold = logicHigh / 2;
            
            if (g.type === ComponentType.NOT_GATE) {
                target = (getV(0) > threshold) ? 0 : logicHigh;
            } else {
                const inputs = [];
                const count = g.inputCount || 2;
                for(let k=0; k<count; k++) inputs.push(getV(k));

                if (g.type === ComponentType.AND_GATE) {
                    target = inputs.every(v => v > threshold) ? logicHigh : 0;
                } else if (g.type === ComponentType.OR_GATE) {
                    target = inputs.some(v => v > threshold) ? logicHigh : 0;
                } else if (g.type === ComponentType.NAND_GATE) {
                    target = !inputs.every(v => v > threshold) ? logicHigh : 0;
                } else if (g.type === ComponentType.NOR_GATE) {
                    target = !inputs.some(v => v > threshold) ? logicHigh : 0;
                } else if (g.type === ComponentType.XOR_GATE) {
                    const highCount = inputs.filter(v => v > threshold).length;
                    target = (highCount % 2 !== 0) ? logicHigh : 0; 
                }
            }
            gateTargets.set(g.id, target);
        });

        const G = Array(size).fill(null).map(() => Array(size).fill(0));
        const I_rhs = Array(size).fill(0);

        components.forEach(c => {
            if (['VOLTAGE_SOURCE', 'AC_SOURCE', 'GROUND', 'AND_GATE', 'OR_GATE', 'NOT_GATE', 'NAND_GATE', 'NOR_GATE', 'XOR_GATE', 'AMMETER', 'OPAMP'].includes(c.type)) return;

            const n1 = portToNode.get(`${c.id}:0`);
            const n2 = portToNode.get(`${c.id}:1`);
            if (n1 === undefined || n2 === undefined) return;

            let g_equiv = 0;
            let i_equiv = 0;

            if (c.type === ComponentType.RESISTOR) {
                g_equiv = 1 / Math.max(c.value, 1e-6);
            } else if (c.type === ComponentType.CAPACITOR) {
                g_equiv = 1e-12; 
            } else if (c.type === ComponentType.INDUCTOR) {
                g_equiv = 1e6; 
            } else if (c.type === ComponentType.VOLTMETER) {
                g_equiv = 1e-9; 
            } else if (c.type === ComponentType.DIODE || c.type === ComponentType.LED) {
                const vFwd = c.value > 0 ? c.value : 0.7;
                const vD = (currentVoltages.get(n1) || 0) - (currentVoltages.get(n2) || 0);
                if (vD > vFwd) {
                    g_equiv = 0.1; 
                    i_equiv = g_equiv * vFwd; 
                } else {
                    g_equiv = 1e-9; 
                }
            }

            if (n1 !== 0) {
                G[getNodeIdx(n1)][getNodeIdx(n1)] += g_equiv;
                I_rhs[getNodeIdx(n1)] += i_equiv;
            }
            if (n2 !== 0) {
                G[getNodeIdx(n2)][getNodeIdx(n2)] += g_equiv;
                I_rhs[getNodeIdx(n2)] -= i_equiv;
            }
            if (n1 !== 0 && n2 !== 0) {
                G[getNodeIdx(n1)][getNodeIdx(n2)] -= g_equiv;
                G[getNodeIdx(n2)][getNodeIdx(n1)] -= g_equiv;
            }
        });
        
        opamps.forEach(c => {
            const n1 = portToNode.get(`${c.id}:0`); 
            const n2 = portToNode.get(`${c.id}:1`); 
            if (n1 === undefined || n2 === undefined) return;

            const rIn = c.inputImpedance || 1e7; 
            const g_in = 1 / rIn;
            
            if (n1 !== 0) G[getNodeIdx(n1)][getNodeIdx(n1)] += g_in;
            if (n2 !== 0) G[getNodeIdx(n2)][getNodeIdx(n2)] += g_in;
            if (n1 !== 0 && n2 !== 0) {
                G[getNodeIdx(n1)][getNodeIdx(n2)] -= g_in;
                G[getNodeIdx(n2)][getNodeIdx(n1)] -= g_in;
            }
        });

        voltageSources.forEach((v, i) => {
            const nPos = portToNode.get(`${v.id}:0`);
            const nNeg = portToNode.get(`${v.id}:1`);
            const idxVs = numNodes + i;
            if (nPos !== undefined && nPos !== 0) {
                G[getNodeIdx(nPos)][idxVs] = 1;
                G[idxVs][getNodeIdx(nPos)] = 1;
            }
            if (nNeg !== undefined && nNeg !== 0) {
                G[getNodeIdx(nNeg)][idxVs] = -1;
                G[idxVs][getNodeIdx(nNeg)] = -1;
            }
            // In DC sim, we use the DC offset for AC sources if provided, or 0 if pure AC. 
            // Or standard value for DC sources.
            let val = v.value;
            if (v.type === ComponentType.AC_SOURCE) {
                val = v.dcBias || 0; // In interactive/DC mode, AC source outputs its bias
            }
            I_rhs[idxVs] = val;
        });

        ammeters.forEach((a, i) => {
            const nPos = portToNode.get(`${a.id}:0`);
            const nNeg = portToNode.get(`${a.id}:1`);
            const idxAm = numNodes + voltageSources.length + i; 
            if (nPos !== undefined && nPos !== 0) {
                G[getNodeIdx(nPos)][idxAm] = 1;
                G[idxAm][getNodeIdx(nPos)] = 1;
            }
            if (nNeg !== undefined && nNeg !== 0) {
                G[getNodeIdx(nNeg)][idxAm] = -1;
                G[idxAm][getNodeIdx(nNeg)] = -1;
            }
            I_rhs[idxAm] = 0; 
        });

        opamps.forEach((op, i) => {
            const nPos = portToNode.get(`${op.id}:0`); 
            const nNeg = portToNode.get(`${op.id}:1`); 
            const nOut = portToNode.get(`${op.id}:2`); 
            
            const idxOp = numNodes + voltageSources.length + ammeters.length + i;
            const Gain = op.value > 0 ? op.value : 100000;
            
            const vPosVal = nPos && nPos !== 0 ? currentVoltages.get(nPos) || 0 : 0;
            const vNegVal = nNeg && nNeg !== 0 ? currentVoltages.get(nNeg) || 0 : 0;
            const targetV = Gain * (vPosVal - vNegVal);
            
            const RAIL_POS = 15;
            const RAIL_NEG = -15;
            
            let clampedV = targetV;
            let isSaturated = false;
            if (targetV > RAIL_POS) { clampedV = RAIL_POS; isSaturated = true; }
            if (targetV < RAIL_NEG) { clampedV = RAIL_NEG; isSaturated = true; }

            if (nOut !== undefined && nOut !== 0) {
                G[getNodeIdx(nOut)][idxOp] = 1; 
            }

            if (isSaturated) {
                if (nOut !== undefined && nOut !== 0) G[idxOp][getNodeIdx(nOut)] = 1;
                I_rhs[idxOp] = clampedV;
            } else {
                if (nOut !== undefined && nOut !== 0) G[idxOp][getNodeIdx(nOut)] = 1;
                if (nPos !== undefined && nPos !== 0) G[idxOp][getNodeIdx(nPos)] = -Gain;
                if (nNeg !== undefined && nNeg !== 0) G[idxOp][getNodeIdx(nNeg)] = Gain;
                I_rhs[idxOp] = 0;
            }
        });

        logicGates.forEach((g, i) => {
             const isNot = g.type === ComponentType.NOT_GATE;
             const inputCount = g.inputCount || 2;
             const portOutIdx = isNot ? 1 : inputCount;
             
             const nOut = portToNode.get(`${g.id}:${portOutIdx}`);
             const idxGate = numNodes + voltageSources.length + ammeters.length + opamps.length + i;
             
             if (nOut !== undefined && nOut !== 0) {
                 G[getNodeIdx(nOut)][idxGate] = 1;
                 G[idxGate][getNodeIdx(nOut)] = 1;
             }
             I_rhs[idxGate] = gateTargets.get(g.id) || 0;
             
             const count = isNot ? 1 : inputCount;
             for(let k=0; k<count; k++) {
                 const nIn = portToNode.get(`${g.id}:${k}`);
                 if (nIn !== undefined && nIn !== 0) {
                     G[getNodeIdx(nIn)][getNodeIdx(nIn)] += 1e-12;
                 }
             }
        });

        try {
            finalX = MatrixSolver.solve(G, I_rhs);
        } catch (e) {
            return { nodes: [], nodeVoltages: new Map(), componentCurrents: new Map(), error: "Singular matrix", frequency, mode: SimulationMode.INTERACTIVE };
        }

        let maxDiff = 0;
        for(let n=1; n<=numNodes; n++) {
            const vNew = finalX[getNodeIdx(n)];
            const vOld = currentVoltages.get(n) || 0;
            maxDiff = Math.max(maxDiff, Math.abs(vNew - vOld));
            currentVoltages.set(n, vNew);
        }

        if (maxDiff < 0.01) converged = true;
        iteration++;
    }

    const resultVoltages = new Map<number, { magnitude: number, phase: number }>();
    resultVoltages.set(0, { magnitude: 0, phase: 0 });
    currentVoltages.forEach((v, k) => {
        if(k !== 0) resultVoltages.set(k, { magnitude: v, phase: 0 });
    });

    const componentCurrents = new Map<string, number>();
    
    voltageSources.forEach((v, i) => componentCurrents.set(v.id, finalX[numNodes + i]));
    ammeters.forEach((a, i) => componentCurrents.set(a.id, finalX[numNodes + voltageSources.length + i]));
    opamps.forEach((op, i) => componentCurrents.set(op.id, finalX[numNodes + voltageSources.length + ammeters.length + i]));
    logicGates.forEach((g, i) => componentCurrents.set(g.id, finalX[numNodes + voltageSources.length + ammeters.length + opamps.length + i]));

    components.forEach(c => {
        if (['VOLTAGE_SOURCE', 'AC_SOURCE', 'GROUND', 'AND_GATE', 'OR_GATE', 'NOT_GATE', 'NAND_GATE', 'NOR_GATE', 'XOR_GATE', 'AMMETER', 'OPAMP'].includes(c.type)) return;
        const n1 = portToNode.get(`${c.id}:0`);
        const n2 = portToNode.get(`${c.id}:1`);
        if (n1 === undefined || n2 === undefined) return;
        const v1 = (n1 === 0 ? 0 : finalX[getNodeIdx(n1)]);
        const v2 = (n2 === 0 ? 0 : finalX[getNodeIdx(n2)]);
        const vDiff = v1 - v2;
        let iVal = 0;
        if (c.type === ComponentType.RESISTOR) iVal = vDiff / c.value;
        else if (c.type === ComponentType.VOLTMETER) iVal = vDiff / 1e9; 
        else if (c.type === ComponentType.DIODE || c.type === ComponentType.LED) {
            const vFwd = c.value > 0 ? c.value : 0.7;
            if (vDiff > vFwd) iVal = (vDiff - vFwd) / 10; 
            else iVal = vDiff * 1e-9;
        }
        componentCurrents.set(c.id, iVal);
    });

    const nodeToComponents = new Map<number, string[]>();
    portToNode.forEach((nodeId, portKey) => {
        const compId = portKey.split(':')[0];
        if (!nodeToComponents.has(nodeId)) nodeToComponents.set(nodeId, []);
        if (!nodeToComponents.get(nodeId)?.includes(compId)) nodeToComponents.get(nodeId)?.push(compId);
    });

    const simNodes: SimulationNode[] = [];
    resultVoltages.forEach((v, k) => {
        simNodes.push({
            id: k,
            voltage: v.magnitude,
            phase: v.phase,
            componentIds: nodeToComponents.get(k) || []
        });
    });

    return { nodes: simNodes, nodeVoltages: resultVoltages, componentCurrents, frequency, mode: SimulationMode.INTERACTIVE };
  }

  // --- AC Sweep Solver ---
  static solveACSweep(components: CircuitComponent[], wires: Wire[], config: SimulationConfig): SimulationResult {
      const { portToNode, numNodes } = this.buildGraph(components, wires);
      if (numNodes === 0) return { nodes: [], nodeVoltages: new Map(), componentCurrents: new Map(), frequency: 0, mode: SimulationMode.AC_SWEEP, plotData: [] };

      const voltageSources = components.filter(c => c.type === ComponentType.VOLTAGE_SOURCE || c.type === ComponentType.AC_SOURCE);
      const opamps = components.filter(c => c.type === ComponentType.OPAMP);
      const size = numNodes + voltageSources.length + opamps.length;
      const getNodeIdx = (nodeId: number) => nodeId - 1;
      
      const startFreq = Math.max(1, config.startFreq);
      const stopFreq = config.stopFreq;
      const steps = config.points;
      const plotData: DataPoint[] = [];
      const logStart = Math.log10(startFreq);
      const logStop = Math.log10(stopFreq);
      const stepSize = (logStop - logStart) / (steps - 1);

      for(let i=0; i<steps; i++) {
          const freq = Math.pow(10, logStart + i * stepSize);
          const omega = 2 * Math.PI * freq;
          
          const G = Array(size).fill(null).map(() => Array(size).fill(Complex.zero()));
          const I_rhs = Array(size).fill(Complex.zero());

          components.forEach(c => {
              if (['VOLTAGE_SOURCE', 'AC_SOURCE', 'GROUND', 'VOLTMETER', 'AMMETER'].includes(c.type)) return;
              if (['AND_GATE', 'OR_GATE', 'NOT_GATE', 'NAND_GATE', 'NOR_GATE', 'XOR_GATE'].includes(c.type)) return; // Skip gates in AC
              
              if (c.type === ComponentType.OPAMP) {
                  const n1 = portToNode.get(`${c.id}:0`); // +
                  const n2 = portToNode.get(`${c.id}:1`); // -
                  if (n1 === undefined || n2 === undefined) return;
                  
                  const rIn = c.inputImpedance || 1e7;
                  const Y_in = new Complex(1/rIn, 0);

                  if (n1 !== 0) G[getNodeIdx(n1)][getNodeIdx(n1)] = G[getNodeIdx(n1)][getNodeIdx(n1)].add(Y_in);
                  if (n2 !== 0) G[getNodeIdx(n2)][getNodeIdx(n2)] = G[getNodeIdx(n2)][getNodeIdx(n2)].add(Y_in);
                  if (n1 !== 0 && n2 !== 0) {
                      G[getNodeIdx(n1)][getNodeIdx(n2)] = G[getNodeIdx(n1)][getNodeIdx(n2)].sub(Y_in);
                      G[getNodeIdx(n2)][getNodeIdx(n1)] = G[getNodeIdx(n2)][getNodeIdx(n1)].sub(Y_in);
                  }
                  return; 
              }

              const n1 = portToNode.get(`${c.id}:0`);
              const n2 = portToNode.get(`${c.id}:1`);
              if (n1 === undefined || n2 === undefined) return;

              let Y = Complex.zero();
              if (c.type === ComponentType.RESISTOR) {
                  Y = new Complex(1/c.value, 0);
              } else if (c.type === ComponentType.CAPACITOR) {
                  Y = new Complex(0, omega * c.value);
              } else if (c.type === ComponentType.INDUCTOR) {
                  Y = new Complex(0, -1 / (omega * c.value));
              }

              if (n1 !== 0) G[getNodeIdx(n1)][getNodeIdx(n1)] = G[getNodeIdx(n1)][getNodeIdx(n1)].add(Y);
              if (n2 !== 0) G[getNodeIdx(n2)][getNodeIdx(n2)] = G[getNodeIdx(n2)][getNodeIdx(n2)].add(Y);
              if (n1 !== 0 && n2 !== 0) {
                  G[getNodeIdx(n1)][getNodeIdx(n2)] = G[getNodeIdx(n1)][getNodeIdx(n2)].sub(Y);
                  G[getNodeIdx(n2)][getNodeIdx(n1)] = G[getNodeIdx(n2)][getNodeIdx(n1)].sub(Y);
              }
          });

          voltageSources.forEach((v, idx) => {
              const nPos = portToNode.get(`${v.id}:0`);
              const nNeg = portToNode.get(`${v.id}:1`);
              const idxVs = numNodes + idx;
              if (nPos !== undefined && nPos !== 0) {
                  G[getNodeIdx(nPos)][idxVs] = Complex.one();
                  G[idxVs][getNodeIdx(nPos)] = Complex.one();
              }
              if (nNeg !== undefined && nNeg !== 0) {
                  G[getNodeIdx(nNeg)][idxVs] = new Complex(-1, 0);
                  G[idxVs][getNodeIdx(nNeg)] = new Complex(-1, 0);
              }
              
              // In AC Sweep, AC sources produce signal, DC sources are effectively shorts (superposition) or just 0 mag for AC response
              // For simplicity, we treat DC as 0 mag in AC response unless it has an AC component.
              // Here we assume only AC_SOURCES drive the sweep.
              const val = v.type === ComponentType.AC_SOURCE ? v.value : 0;
              I_rhs[idxVs] = new Complex(val, 0);
          });

          opamps.forEach((op, idx) => {
              const nPos = portToNode.get(`${op.id}:0`);
              const nNeg = portToNode.get(`${op.id}:1`);
              const nOut = portToNode.get(`${op.id}:2`);
              const idxOp = numNodes + voltageSources.length + idx;
              const Gain = op.value > 0 ? op.value : 100000;

              if (nOut !== undefined && nOut !== 0) G[getNodeIdx(nOut)][idxOp] = Complex.one();

              if (nOut !== undefined && nOut !== 0) G[idxOp][getNodeIdx(nOut)] = Complex.one();
              if (nPos !== undefined && nPos !== 0) G[idxOp][getNodeIdx(nPos)] = new Complex(-Gain, 0);
              if (nNeg !== undefined && nNeg !== 0) G[idxOp][getNodeIdx(nNeg)] = new Complex(Gain, 0);
              
              I_rhs[idxOp] = Complex.zero();
          });

          try {
              const sol = ComplexMatrixSolver.solve(G, I_rhs);
              const point: DataPoint = { x: parseFloat(freq.toPrecision(4)) };
              for(let n=1; n<=numNodes; n++) {
                  point[`N${n}`] = parseFloat(sol[getNodeIdx(n)].magnitude.toPrecision(4));
              }
              plotData.push(point);
          } catch(e) { console.error(e); }
      }

      return { nodes: [], nodeVoltages: new Map(), componentCurrents: new Map(), frequency: 0, mode: SimulationMode.AC_SWEEP, plotData };
  }

  // --- Transient Solver (Backward Euler) ---
  static solveTransient(components: CircuitComponent[], wires: Wire[], config: SimulationConfig): SimulationResult {
      const { portToNode, numNodes } = this.buildGraph(components, wires);
      if (numNodes === 0) return { nodes: [], nodeVoltages: new Map(), componentCurrents: new Map(), frequency: 0, mode: SimulationMode.TRANSIENT, plotData: [] };

      const voltageSources = components.filter(c => c.type === ComponentType.VOLTAGE_SOURCE || c.type === ComponentType.AC_SOURCE);
      const opamps = components.filter(c => c.type === ComponentType.OPAMP);
      
      const size = numNodes + voltageSources.length + opamps.length;
      const getNodeIdx = (nodeId: number) => nodeId - 1;

      const dt = config.timeStep;
      const steps = Math.ceil(config.stopTime / dt);
      const plotData: DataPoint[] = [];

      let prevVoltages = new Array(numNodes + 1).fill(0); 
      const inductorCurrents = new Map<string, number>(); 
      components.filter(c => c.type === ComponentType.INDUCTOR).forEach(c => inductorCurrents.set(c.id, 0));
      
      let finalVoltages: number[] = new Array(numNodes).fill(0);

      for (let step = 0; step <= steps; step++) {
          const time = step * dt;
          const G = Array(size).fill(null).map(() => Array(size).fill(0));
          const I_rhs = Array(size).fill(0);

          components.forEach(c => {
              if (['VOLTAGE_SOURCE', 'AC_SOURCE', 'GROUND', 'VOLTMETER', 'AMMETER'].includes(c.type)) return;
              if (['AND_GATE', 'OR_GATE', 'NOT_GATE', 'NAND_GATE', 'NOR_GATE', 'XOR_GATE'].includes(c.type)) return; 

              if (c.type === ComponentType.OPAMP) {
                  const n1 = portToNode.get(`${c.id}:0`);
                  const n2 = portToNode.get(`${c.id}:1`); 
                  if (n1 === undefined || n2 === undefined) return;

                  const rIn = c.inputImpedance || 1e7;
                  const g_in = 1 / rIn;
                  
                  if (n1 !== 0) G[getNodeIdx(n1)][getNodeIdx(n1)] += g_in;
                  if (n2 !== 0) G[getNodeIdx(n2)][getNodeIdx(n2)] += g_in;
                  if (n1 !== 0 && n2 !== 0) {
                      G[getNodeIdx(n1)][getNodeIdx(n2)] -= g_in;
                      G[getNodeIdx(n2)][getNodeIdx(n1)] -= g_in;
                  }
                  return;
              }

              const n1 = portToNode.get(`${c.id}:0`);
              const n2 = portToNode.get(`${c.id}:1`);
              if (n1 === undefined || n2 === undefined) return;

              let g_equiv = 0;
              let i_source = 0; 

              if (c.type === ComponentType.RESISTOR) {
                  g_equiv = 1 / c.value;
              } else if (c.type === ComponentType.CAPACITOR) {
                  g_equiv = c.value / dt;
                  const v_old = prevVoltages[n1] - prevVoltages[n2];
                  i_source = (c.value / dt) * v_old;
              } else if (c.type === ComponentType.INDUCTOR) {
                  g_equiv = dt / c.value;
                  const i_old = inductorCurrents.get(c.id) || 0;
                  i_source = -i_old; 
              }

              if (n1 !== 0) {
                  G[getNodeIdx(n1)][getNodeIdx(n1)] += g_equiv;
                  if (c.type === ComponentType.CAPACITOR) I_rhs[getNodeIdx(n1)] += i_source;
                  if (c.type === ComponentType.INDUCTOR) I_rhs[getNodeIdx(n1)] -= (inductorCurrents.get(c.id) || 0);
              }
              if (n2 !== 0) {
                  G[getNodeIdx(n2)][getNodeIdx(n2)] += g_equiv;
                  if (c.type === ComponentType.CAPACITOR) I_rhs[getNodeIdx(n2)] -= i_source;
                  if (c.type === ComponentType.INDUCTOR) I_rhs[getNodeIdx(n2)] += (inductorCurrents.get(c.id) || 0);
              }
              if (n1 !== 0 && n2 !== 0) {
                  G[getNodeIdx(n1)][getNodeIdx(n2)] -= g_equiv;
                  G[getNodeIdx(n2)][getNodeIdx(n1)] -= g_equiv;
              }
          });

          voltageSources.forEach((v, idx) => {
              const nPos = portToNode.get(`${v.id}:0`);
              const nNeg = portToNode.get(`${v.id}:1`);
              const idxVs = numNodes + idx;
              if (nPos !== undefined && nPos !== 0) {
                  G[getNodeIdx(nPos)][idxVs] = 1;
                  G[idxVs][getNodeIdx(nPos)] = 1;
              }
              if (nNeg !== undefined && nNeg !== 0) {
                  G[getNodeIdx(nNeg)][idxVs] = -1;
                  G[idxVs][getNodeIdx(nNeg)] = -1;
              }
              
              let val = v.value;
              if (v.type === ComponentType.AC_SOURCE) {
                  const freq = v.frequency || 60;
                  const bias = v.dcBias || 0;
                  const waveform = v.waveform || 'SINE';
                  const period = 1 / freq;
                  const tMod = time % period;
                  
                  switch(waveform) {
                      case 'SINE':
                          val = v.value * Math.sin(2 * Math.PI * freq * time) + bias;
                          break;
                      case 'SQUARE':
                          const duty = v.dutyCycle || 0.5;
                          val = (tMod < period * duty ? v.value : -v.value) + bias;
                          break;
                      case 'TRIANGLE':
                          // 4*A/P * |(t - P/4) % P - P/2| - A
                          const triPhase = (tMod / period);
                          if (triPhase < 0.25) val = 4 * v.value * triPhase;
                          else if (triPhase < 0.75) val = v.value * (2 - 4 * triPhase);
                          else val = v.value * (4 * triPhase - 4);
                          val += bias;
                          break;
                      case 'SAWTOOTH':
                          val = 2 * v.value * (tMod / period) - v.value + bias;
                          break;
                      case 'PULSE':
                          // Pulse is typically 0 to Max, not -Max to Max
                          const pDuty = v.dutyCycle || 0.5;
                          val = (tMod < period * pDuty ? v.value : 0) + bias;
                          break;
                  }
              } 
              // DC Sources stay constant at v.value
              
              I_rhs[idxVs] = val;
          });

          opamps.forEach((op, idx) => {
              const nPos = portToNode.get(`${op.id}:0`);
              const nNeg = portToNode.get(`${op.id}:1`);
              const nOut = portToNode.get(`${op.id}:2`);
              const idxOp = numNodes + voltageSources.length + idx;
              const Gain = op.value > 0 ? op.value : 100000;

              if (nOut !== undefined && nOut !== 0) G[getNodeIdx(nOut)][idxOp] = 1;

              if (nOut !== undefined && nOut !== 0) G[idxOp][getNodeIdx(nOut)] = 1;
              if (nPos !== undefined && nPos !== 0) G[idxOp][getNodeIdx(nPos)] = -Gain;
              if (nNeg !== undefined && nNeg !== 0) G[idxOp][getNodeIdx(nNeg)] = Gain;
              
              I_rhs[idxOp] = 0;
          });

          try {
              const sol = MatrixSolver.solve(G, I_rhs);
              const point: DataPoint = { x: parseFloat(time.toPrecision(4)) };
              for(let n=1; n<=numNodes; n++) {
                  point[`N${n}`] = parseFloat(sol[getNodeIdx(n)].toFixed(4));
              }
              plotData.push(point);

              prevVoltages = [0];
              finalVoltages = [];
              for(let n=1; n<=numNodes; n++) {
                  prevVoltages.push(sol[getNodeIdx(n)]);
                  finalVoltages.push(sol[getNodeIdx(n)]);
              }
              
              components.filter(c => c.type === ComponentType.INDUCTOR).forEach(c => {
                  const n1 = portToNode.get(`${c.id}:0`)!;
                  const n2 = portToNode.get(`${c.id}:1`)!;
                  const v1 = prevVoltages[n1];
                  const v2 = prevVoltages[n2];
                  const i_old = inductorCurrents.get(c.id) || 0;
                  const i_new = i_old + (dt / c.value) * (v1 - v2);
                  inductorCurrents.set(c.id, i_new);
              });

          } catch(e) {
              console.error("Transient Solve Failed", e);
              break;
          }
      }

      const nodeToComponents = new Map<number, string[]>();
      portToNode.forEach((nodeId, portKey) => {
          const compId = portKey.split(':')[0];
          if (!nodeToComponents.has(nodeId)) nodeToComponents.set(nodeId, []);
          if (!nodeToComponents.get(nodeId)?.includes(compId)) nodeToComponents.get(nodeId)?.push(compId);
      });
      
      const simNodes: SimulationNode[] = [];
      for(let i=0; i<finalVoltages.length; i++) {
          const nodeId = i + 1;
          simNodes.push({
              id: nodeId,
              voltage: finalVoltages[i],
              phase: 0,
              componentIds: nodeToComponents.get(nodeId) || []
          });
      }

      return {
        nodes: simNodes, 
        nodeVoltages: new Map(),
        componentCurrents: new Map(), 
        frequency: 0, 
        mode: SimulationMode.TRANSIENT,
        plotData
      };
  }
}

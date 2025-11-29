
import React, { useRef, useState, useCallback, useMemo } from 'react';
import { CircuitComponent, Wire, Port, Position, ComponentType, SimulationResult } from '../types';
import { GRID_SIZE, COMPONENT_WIDTH, COMPONENT_HEIGHT } from '../constants';
import clsx from 'clsx';

interface CanvasProps {
  components: CircuitComponent[];
  wires: Wire[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMoveComponent: (id: string, newPos: Position) => void;
  onAddWire: (from: Port, to: Port) => void;
  simulationResult: SimulationResult | null;
  onEdit?: (id: string) => void;
  onDragStart?: () => void;
  
  viewState: { zoom: number; pan: Position };
  onSetViewState: React.Dispatch<React.SetStateAction<{ zoom: number; pan: Position }>>;
}

export const Canvas: React.FC<CanvasProps> = ({
  components,
  wires,
  selectedId,
  onSelect,
  onMoveComponent,
  onAddWire,
  simulationResult,
  onEdit,
  onDragStart,
  viewState,
  onSetViewState
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const contentGroupRef = useRef<SVGGElement>(null);
  
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState<Position>({ x: 0, y: 0 });

  // Touch state for Pinch-to-Zoom
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);

  const [wireStart, setWireStart] = useState<Port | null>(null);
  const [mouseWorldPos, setMouseWorldPos] = useState<Position>({ x: 0, y: 0 });
  const [hoveredNetId, setHoveredNetId] = useState<number | null>(null);

  // Sort components by zIndex to ensure correct rendering order (Painter's Algorithm)
  const sortedComponents = useMemo(() => {
    return [...components].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  }, [components]);

  // Calculate absolute position of a port based on component position AND rotation
  const getPortPosition = useCallback((c: CircuitComponent, portIndex: number): Position => {
    const w = COMPONENT_WIDTH;
    const h = COMPONENT_HEIGHT;
    
    // 1. Calculate local coordinates relative to component top-left (0,0) assuming 0 rotation
    let lx = 0, ly = 0;

    if (c.type === ComponentType.GROUND) {
        lx = w / 2; ly = 0;
    } else if (c.type === ComponentType.NOT_GATE) {
        if (portIndex === 0) { lx = 0; ly = 20; } 
        else { lx = 80; ly = 20; } 
    } else if (c.type === ComponentType.OPAMP) {
        // 0: Non-Inv (+), 1: Inv (-), 2: Out
        if (portIndex === 0) { lx = 0; ly = 28; }  // + Bottom Left
        else if (portIndex === 1) { lx = 0; ly = 12; } // - Top Left
        else { lx = 80; ly = 20; } // Out Right
    } else if ([ComponentType.AND_GATE, ComponentType.OR_GATE, ComponentType.NAND_GATE, ComponentType.NOR_GATE, ComponentType.XOR_GATE].includes(c.type)) {
        const inputs = c.inputCount || 2;
        if (portIndex < inputs) {
            lx = 0;
            const spacing = h / (inputs + 1);
            ly = spacing * (portIndex + 1);
        } else {
            lx = 80; ly = 20;
        }
    } else {
        // 2-port components
        if (portIndex === 0) { lx = 0; ly = h/2; }
        else { lx = w; ly = h/2; }
    }

    // 2. Apply Rotation
    // Rotate around center (w/2, h/2)
    const cx = w / 2;
    const cy = h / 2;
    const angleRad = (c.rotation || 0) * (Math.PI / 180);
    
    // Translate to origin
    const tx = lx - cx;
    const ty = ly - cy;
    
    // Rotate
    const rx = tx * Math.cos(angleRad) - ty * Math.sin(angleRad);
    const ry = tx * Math.sin(angleRad) + ty * Math.cos(angleRad);
    
    // Translate back and add absolute position
    return {
        x: c.position.x + rx + cx,
        y: c.position.y + ry + cy
    };
  }, []);

  // --- Automatic Wire Routing Logic (Manhattan) ---
  const getWirePath = useCallback((start: Position, end: Position, fromC: CircuitComponent | null, fromPortIdx: number, toC?: CircuitComponent | null, toPortIdx?: number): string => {
    
    // Helper to rotate a direction vector
    const rotateDir = (dir: [number, number], angleDeg: number): [number, number] => {
        const rad = angleDeg * (Math.PI / 180);
        const x = dir[0] * Math.cos(rad) - dir[1] * Math.sin(rad);
        const y = dir[0] * Math.sin(rad) + dir[1] * Math.cos(rad);
        // Round to handle float errors (e.g. nearly 0)
        return [Math.round(x), Math.round(y)];
    };

    // Define preferred exit/entry directions based on component type and port (LOCAL SPACE)
    const getLocalPortDirection = (c: CircuitComponent, idx: number): [number, number] => {
        if (c.type === ComponentType.GROUND) return [0, -1]; 
        
        if ([ComponentType.AND_GATE, ComponentType.OR_GATE, ComponentType.NAND_GATE, ComponentType.NOR_GATE, ComponentType.XOR_GATE].includes(c.type)) {
            const inputCount = c.inputCount || 2;
            if (idx < inputCount) return [-1, 0];
            return [1, 0];
        }
        if (c.type === ComponentType.NOT_GATE) {
            if (idx === 0) return [-1, 0];
            return [1, 0];
        }
        if (c.type === ComponentType.OPAMP) {
            if (idx < 2) return [-1, 0];
            return [1, 0]; 
        }
        // Standard 2-port
        if (idx === 0) return [-1, 0];
        return [1, 0];
    };

    const getGlobalPortDirection = (c: CircuitComponent | null, idx: number): [number, number] => {
        if (!c) return [0, 0];
        const localDir = getLocalPortDirection(c, idx);
        return rotateDir(localDir, c.rotation || 0);
    };

    const startDir = getGlobalPortDirection(fromC, fromPortIdx);
    const endDir = toC && toPortIdx !== undefined ? getGlobalPortDirection(toC, toPortIdx) : [0, 0];

    if (endDir[0] === 0 && endDir[1] === 0) {
        if (Math.abs(end.x - start.x) > Math.abs(end.y - start.y)) {
            endDir[0] = start.x < end.x ? -1 : 1;
        } else {
            endDir[1] = start.y < end.y ? -1 : 1;
        }
    }

    const GAP = 20;
    const cp1 = { x: start.x + startDir[0] * GAP, y: start.y + startDir[1] * GAP };
    const cp2 = { x: end.x + endDir[0] * GAP, y: end.y + endDir[1] * GAP };

    let path = `M ${start.x} ${start.y} L ${cp1.x} ${cp1.y}`;

    // Simple Manhattan routing
    const dx = cp2.x - cp1.x;
    const dy = cp2.y - cp1.y;
    
    // If we align well horizontally
    if (Math.abs(dx) > Math.abs(dy)) {
         const midX = (cp1.x + cp2.x) / 2;
         path += ` L ${midX} ${cp1.y} L ${midX} ${cp2.y} L ${cp2.x} ${cp2.y}`;
    } else {
         const midY = (cp1.y + cp2.y) / 2;
         path += ` L ${cp1.x} ${midY} L ${cp2.x} ${midY} L ${cp2.x} ${cp2.y}`;
    }
    
    path += ` L ${end.x} ${end.y}`;
    return path;
  }, []);

  const findNodeIdForElement = (id: string) => {
      if (!simulationResult) return null;
      const node = simulationResult.nodes.find(n => n.componentIds.includes(id));
      return node ? node.id : null;
  };

  const findNodeIdForWire = (w: Wire) => {
      if (!simulationResult) return null;
      const node = simulationResult.nodes.find(n => 
          n.componentIds.includes(w.from.componentId) || n.componentIds.includes(w.to.componentId)
      );
      return node ? node.id : null;
  };

  const handlePointerDown = (e: React.PointerEvent, id: string | null) => {
    // Only handle primary pointer (first finger or mouse) for simple drags
    // Multi-touch pinch handled via visual viewport logic implicitly or manually below
    if (!e.isPrimary && e.pointerType === 'touch') return;
    
    e.preventDefault(); 
    e.stopPropagation();
    
    // If it's a touch event and there are 2 touches, don't start dragging components
    // but we can't easily detect 2 touches in pointerdown.
    // Instead we rely on 'isPrimary' check above.
    
    if (id) {
        if (wireStart) return; 
        const group = contentGroupRef.current;
        const svg = svgRef.current;
        if (!group || !svg) return;

        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const worldP = pt.matrixTransform(group.getScreenCTM()?.inverse());
        
        const comp = components.find(c => c.id === id);
        if (comp) {
            if (onDragStart) onDragStart();
            setDraggingId(id);
            setDragOffset({
                x: worldP.x - comp.position.x,
                y: worldP.y - comp.position.y
            });
            onSelect(id);
            (e.target as Element).setPointerCapture(e.pointerId);
        }
    } else {
        setIsPanning(true);
        setLastMousePos({ x: e.clientX, y: e.clientY });
        onSelect(null);
        setWireStart(null);
        (e.target as Element).setPointerCapture(e.pointerId);
    }
  };

  const getDistance = (p1: React.Touch, p2: React.Touch) => {
      const dx = p1.clientX - p2.clientX;
      const dy = p1.clientY - p2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
  };

  // Dedicated Touch Move Handler for Pinch Zoom
  const handleTouchMove = (e: React.TouchEvent) => {
      // If 2 fingers, handle zoom
      if (e.touches.length === 2) {
          const dist = getDistance(e.touches[0], e.touches[1]);
          
          if (lastTouchDistance !== null) {
              const delta = dist - lastTouchDistance;
              // Dampen the zoom speed for smoothness
              const zoomFactor = delta * 0.005; 
              
              onSetViewState(prev => {
                  let newZoom = prev.zoom + zoomFactor;
                  newZoom = Math.max(0.1, Math.min(newZoom, 5));
                  
                  // Also pan to center of pinch to make it feel natural
                  // This is simplified; true pinch-zoom-to-point requires matrix math
                  return { ...prev, zoom: newZoom };
              });
          }
          setLastTouchDistance(dist);
          return;
      }
  };
  
  const handleTouchEnd = () => {
      setLastTouchDistance(null);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    // If not primary, ignore for single-finger logic
    if (!e.isPrimary) return; 

    e.preventDefault();
    const svg = svgRef.current;
    const group = contentGroupRef.current;
    if (!svg || !group) return;

    // Standard Mouse/Single Touch Logic
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const worldP = pt.matrixTransform(group.getScreenCTM()?.inverse());
    setMouseWorldPos({ x: worldP.x, y: worldP.y });

    if (isPanning) {
        // Smooth out panning by checking delta threshold? 
        // For now, raw delta is usually fine unless hardware is noisy.
        const dx = e.clientX - lastMousePos.x;
        const dy = e.clientY - lastMousePos.y;
        
        onSetViewState(prev => ({
            ...prev,
            pan: { x: prev.pan.x + dx, y: prev.pan.y + dy }
        }));
        setLastMousePos({ x: e.clientX, y: e.clientY });
        return;
    }

    if (draggingId) {
        const newX = Math.round((worldP.x - dragOffset.x) / GRID_SIZE) * GRID_SIZE;
        const newY = Math.round((worldP.y - dragOffset.y) / GRID_SIZE) * GRID_SIZE;
        onMoveComponent(draggingId, { x: newX, y: newY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    if (draggingId) {
        (e.target as Element).releasePointerCapture(e.pointerId);
        setDraggingId(null);
    }
    if (isPanning) {
        (e.target as Element).releasePointerCapture(e.pointerId);
        setIsPanning(false);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
      // Prevent browser zoom if ctrl is pressed
      if (e.ctrlKey) e.preventDefault();
      
      const scaleFactor = 1.05;
      const delta = -Math.sign(e.deltaY);
      let newZoom = viewState.zoom;
      
      if (delta > 0) newZoom *= scaleFactor;
      else newZoom /= scaleFactor;

      newZoom = Math.max(0.1, Math.min(newZoom, 5));
      onSetViewState(prev => ({ ...prev, zoom: newZoom }));
  };

  const handlePortClick = (e: React.MouseEvent, c: CircuitComponent, idx: number) => {
    e.stopPropagation();
    const port: Port = { componentId: c.id, portIndex: idx, position: getPortPosition(c, idx) };
    
    if (!wireStart) {
        setWireStart(port);
    } else {
        if (wireStart.componentId !== port.componentId || wireStart.portIndex !== port.portIndex) {
            onAddWire(wireStart, port);
        }
        setWireStart(null);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (onEdit) onEdit(id);
  };

  const renderGrid = () => (
    <defs>
      <pattern id="grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
        <path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke="#1e293b" strokeWidth="1"/>
      </pattern>
    </defs>
  );

  const isPartOfHoveredNet = (compId: string) => {
      if (hoveredNetId === null || !simulationResult) return false;
      const node = simulationResult.nodes.find(n => n.componentIds.includes(compId));
      return node ? node.componentIds.includes(compId) : false;
  };

  const isWireInHoveredNet = (w: Wire) => {
      if (hoveredNetId === null || !simulationResult) return false;
      const nodeId = findNodeIdForWire(w);
      return nodeId === hoveredNetId;
  };

  return (
    <svg
      ref={svgRef}
      className={clsx("w-full h-full bg-slate-950 select-none touch-none", isPanning ? "cursor-grabbing" : "cursor-grab")}
      // Pointer events for single-touch / mouse
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerDown={(e) => handlePointerDown(e, null)}
      // Native touch events for multi-touch pinch
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      
      onWheel={handleWheel}
    >
      {renderGrid()}
      
      <g 
        ref={contentGroupRef}
        transform={`translate(${viewState.pan.x}, ${viewState.pan.y}) scale(${viewState.zoom})`}
      >
        <rect x="-100000" y="-100000" width="200000" height="200000" fill="url(#grid)" />

        {wires.map(w => {
            const c1 = components.find(c => c.id === w.from.componentId);
            const c2 = components.find(c => c.id === w.to.componentId);
            if (!c1 || !c2) return null;

            const startPos = getPortPosition(c1, w.from.portIndex);
            const endPos = getPortPosition(c2, w.to.portIndex);
            
            const pathD = getWirePath(startPos, endPos, c1, w.from.portIndex, c2, w.to.portIndex);
            
            const animation = getWireAnimation(w, simulationResult);
            const isNetHovered = isWireInHoveredNet(w);

            return (
            <g key={w.id} 
                onClick={(e) => { e.stopPropagation(); onSelect(w.id); }}
                onPointerEnter={() => setHoveredNetId(findNodeIdForWire(w))}
                onPointerLeave={() => setHoveredNetId(null)}
            >
                <path d={pathD} stroke="transparent" strokeWidth="12" fill="none" className="cursor-pointer"/>
                <path
                    d={pathD}
                    stroke={selectedId === w.id ? "#3b82f6" : (isNetHovered ? "#60a5fa" : "#64748b")}
                    strokeWidth={selectedId === w.id ? 4 : 2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    className="transition-colors"
                />
                {isNetHovered && hoveredNetId !== null && (
                    <g transform={`translate(${(startPos.x + endPos.x)/2}, ${(startPos.y + endPos.y)/2 - 10})`}>
                        <rect x="-20" y="-12" width="40" height="16" rx="4" fill="#1e293b" stroke="#60a5fa" strokeWidth="1"/>
                        <text y="0" textAnchor="middle" fill="#60a5fa" fontSize="10" fontWeight="bold" dy="3">
                            Node {hoveredNetId}
                        </text>
                    </g>
                )}
                {animation && (
                    <path
                        d={pathD}
                        stroke="#fbbf24"
                        strokeWidth="2"
                        strokeDasharray="4,6"
                        fill="none"
                        className={animation.direction === 'normal' ? 'wire-flow' : 'wire-flow-reverse'}
                        style={{ animationDuration: `${animation.duration}s`, opacity: 0.8 }}
                    />
                )}
            </g>
            );
        })}

        {wireStart && wireStart.position && (
            <path
                d={getWirePath(
                    wireStart.position, 
                    mouseWorldPos, 
                    components.find(c => c.id === wireStart.componentId) || null, 
                    wireStart.portIndex, 
                    null, 
                    undefined
                )}
                stroke="#3b82f6"
                strokeWidth="2"
                strokeDasharray="5,5"
                fill="none"
                className="pointer-events-none"
            />
        )}

        {sortedComponents.map(c => {
            const isSelected = selectedId === c.id;
            const isNetHigh = isPartOfHoveredNet(c.id);
            
            const isLed = c.type === ComponentType.LED;
            const isMeter = c.type === ComponentType.VOLTMETER || c.type === ComponentType.AMMETER;
            let ledFill = "none";
            let isBlown = false;
            let ledStyle = {};
            let meterValue = "0.00";

            if (isLed) {
                const current = simulationResult?.componentCurrents.get(c.id) || 0;
                const absI = Math.abs(current);
                const MAX_CURRENT = c.maxCurrent || 0.03; 
                isBlown = absI > MAX_CURRENT;

                if (isBlown) {
                    ledFill = "#334155"; 
                } else if (absI > 0.001) {
                    const brightness = Math.min((absI - 0.001) / 0.02, 1.5);
                    ledFill = "#ef4444";
                    ledStyle = {
                        filter: `drop-shadow(0 0 ${brightness * 15}px rgba(239,68,68, ${0.6 + brightness * 0.4}))`,
                    };
                }
            }
            
            if (isMeter && simulationResult) {
                if (c.type === ComponentType.VOLTMETER) {
                    const iComp = simulationResult.componentCurrents.get(c.id) || 0;
                    const vDrop = iComp * 1e9; 
                    meterValue = Math.abs(vDrop).toFixed(2) + "V";
                } else {
                    const iComp = simulationResult.componentCurrents.get(c.id) || 0;
                    const absI = Math.abs(iComp);
                    if (absI < 1) meterValue = (absI * 1000).toFixed(1) + "mA";
                    else meterValue = absI.toFixed(2) + "A";
                }
            }

            // Apply Rotation
            const rotation = c.rotation || 0;
            // Transform origin is center of component
            const cx = COMPONENT_WIDTH / 2;
            const cy = COMPONENT_HEIGHT / 2;

            return (
            <g
                key={c.id}
                transform={`translate(${c.position.x}, ${c.position.y}) rotate(${rotation}, ${cx}, ${cy})`}
                onPointerDown={(e) => handlePointerDown(e, c.id)}
                onDoubleClick={(e) => handleDoubleClick(e, c.id)}
                onPointerEnter={() => {
                    const nid = findNodeIdForElement(c.id);
                    if (nid !== null) setHoveredNetId(nid);
                }}
                onPointerLeave={() => setHoveredNetId(null)}
                className={clsx("cursor-move group", isSelected ? "opacity-100" : "opacity-90 hover:opacity-100", isBlown && "shake-anim")}
            >
                <rect
                    width={COMPONENT_WIDTH} height={COMPONENT_HEIGHT}
                    fill="transparent"
                    stroke={isSelected ? "#3b82f6" : (isNetHigh ? "#60a5fa" : "transparent")}
                    strokeWidth={isSelected ? 2 : 1}
                    strokeDasharray={isNetHigh && !isSelected ? "4,2" : ""}
                    rx="4"
                />
                
                <g transform={`rotate(${-rotation}, ${cx}, -12)`}>
                    <text x={COMPONENT_WIDTH/2} y={-12} textAnchor="middle" fill={isNetHigh ? "#60a5fa" : "#cbd5e1"} fontSize="10" className="pointer-events-none select-none font-bold">
                        {c.label}
                    </text>
                </g>

                <g transform={`scale(${COMPONENT_WIDTH/80}, ${COMPONENT_HEIGHT/40})`}>
                    <path
                        d={getComponentPath(c.type)}
                        fill={isLed ? ledFill : "none"} 
                        stroke={getComponentColor(c.type)}
                        strokeWidth="2"
                        style={ledStyle}
                        className="transition-all duration-200"
                        vectorEffect="non-scaling-stroke"
                    />
                    {c.type === ComponentType.OPAMP && (
                        <>
                            <text x="20" y="16" fill="#64748b" fontSize="10" fontWeight="bold">-</text>
                            <text x="20" y="31" fill="#64748b" fontSize="10" fontWeight="bold">+</text>
                        </>
                    )}
                    {isBlown && (
                        <g transform="translate(40, 20)">
                            <circle r="20" className="blast-anim" fill="#ef4444" />
                            <text y="35" textAnchor="middle" fill="#ef4444" fontSize="10" fontWeight="bold">OVERLOAD!</text>
                        </g>
                    )}
                </g>
                
                {isMeter && (
                    <g transform={`translate(${COMPONENT_WIDTH/2}, ${COMPONENT_HEIGHT + 16}) rotate(${-rotation})`}>
                        <rect x="-24" y="-10" width="48" height="16" rx="2" fill="#0f172a" stroke="#334155" strokeWidth="1"/>
                        <text y="2" textAnchor="middle" fill="#38bdf8" fontSize="10" fontFamily="monospace" fontWeight="bold">
                            {meterValue}
                        </text>
                    </g>
                )}

                {!isMeter && ![ComponentType.GROUND, ComponentType.DIODE, ComponentType.LED, ComponentType.AND_GATE, ComponentType.OR_GATE, ComponentType.NOT_GATE, ComponentType.NAND_GATE, ComponentType.NOR_GATE, ComponentType.XOR_GATE, ComponentType.OPAMP].includes(c.type) && (
                    <g transform={`rotate(${-rotation}, ${cx}, ${COMPONENT_HEIGHT + 15})`}>
                         <text x={COMPONENT_WIDTH/2} y={COMPONENT_HEIGHT + 15} textAnchor="middle" fill="#64748b" fontSize="9" className="pointer-events-none select-none">
                            {formatValue(c.value, c.type)}
                        </text>
                    </g>
                )}
                
                {renderPorts(c, handlePortClick)}
            </g>
            );
        })}
      </g>
    </svg>
  );
};

// ... [Keep getWireAnimation, renderPorts, getComponentColor, formatValue, getComponentPath same as before] ...
function getWireAnimation(w: Wire, result: SimulationResult | null) {
    if (!result || result.mode !== 'INTERACTIVE') return null;
    const compId = w.from.componentId;
    const portIdx = w.from.portIndex;
    const iComp = result.componentCurrents.get(compId) || 0;
    if (Math.abs(iComp) < 1e-6) return null;
    const iEnteringWire = portIdx === 0 ? -iComp : iComp;
    const direction = iEnteringWire > 0 ? 'normal' : 'reverse';
    const mag = Math.abs(iEnteringWire);
    let duration = 1 / (mag * 5); 
    if (duration > 2) duration = 2;
    if (duration < 0.2) duration = 0.2;
    return { direction, duration };
}

function renderPorts(c: CircuitComponent, onClick: (e: React.MouseEvent, c: CircuitComponent, idx: number) => void) {
    const PortCircle: React.FC<{ cx: number; cy: number; idx: number }> = ({ cx, cy, idx }) => (
        <circle
            key={idx}
            cx={cx} cy={cy} r={6}
            fill="#1e293b"
            stroke="#94a3b8"
            strokeWidth="1"
            className="hover:fill-blue-500 hover:stroke-blue-300 cursor-pointer transition-colors"
            onClick={(e) => onClick(e, c, idx)}
            onPointerDown={(e) => e.stopPropagation()}
        />
    );

    if (c.type === ComponentType.GROUND) {
        return <PortCircle cx={40} cy={0} idx={0} />;
    } else if (c.type === ComponentType.NOT_GATE) {
        return (
            <>
                <PortCircle cx={0} cy={20} idx={0} />
                <PortCircle cx={80} cy={20} idx={1} />
            </>
        );
    } else if (c.type === ComponentType.OPAMP) {
        return (
            <>
                <PortCircle cx={0} cy={28} idx={0} /> {/* + */}
                <PortCircle cx={0} cy={12} idx={1} /> {/* - */}
                <PortCircle cx={80} cy={20} idx={2} /> {/* Out */}
            </>
        );
    } else if ([ComponentType.AND_GATE, ComponentType.OR_GATE, ComponentType.NAND_GATE, ComponentType.NOR_GATE, ComponentType.XOR_GATE].includes(c.type)) {
        const inputs = c.inputCount || 2;
        const ports = [];
        const spacing = 40 / (inputs + 1);
        for (let i = 0; i < inputs; i++) {
            ports.push(<PortCircle key={i} cx={0} cy={spacing * (i + 1)} idx={i} />);
        }
        ports.push(<PortCircle key={inputs} cx={80} cy={20} idx={inputs} />);
        return <>{ports}</>;
    } else {
        return (
            <>
                <PortCircle cx={0} cy={20} idx={0} />
                <PortCircle cx={80} cy={20} idx={1} />
            </>
        );
    }
}

function getComponentColor(type: ComponentType): string {
    switch (type) {
        case ComponentType.VOLTAGE_SOURCE: return "#ef4444"; 
        case ComponentType.AC_SOURCE: return "#f59e0b";
        case ComponentType.GROUND: return "#22c55e";
        case ComponentType.CAPACITOR: return "#3b82f6";
        case ComponentType.INDUCTOR: return "#8b5cf6";
        case ComponentType.LED: return "#f43f5e";
        case ComponentType.VOLTMETER: return "#14b8a6";
        case ComponentType.AMMETER: return "#f97316";
        case ComponentType.OPAMP: return "#06b6d4";
        case ComponentType.AND_GATE:
        case ComponentType.OR_GATE:
        case ComponentType.NOT_GATE:
        case ComponentType.NAND_GATE:
        case ComponentType.NOR_GATE:
        case ComponentType.XOR_GATE:
            return "#eab308"; 
        default: return "#e2e8f0"; 
    }
}

function formatValue(val: number, type: ComponentType): string {
    if (type === ComponentType.RESISTOR) return `${val}Ω`;
    if (type === ComponentType.CAPACITOR) return `${val}F`;
    if (type === ComponentType.INDUCTOR) return `${val}H`;
    return `${val}V`;
}

function getComponentPath(type: ComponentType): string {
    switch (type) {
        case ComponentType.RESISTOR:
            return "M0,20 L15,20 L18,10 L24,30 L30,10 L36,30 L42,10 L48,30 L54,10 L60,30 L66,10 L72,30 L75,20 L80,20";
        case ComponentType.VOLTAGE_SOURCE:
            return "M0,20 L35,20 M45,20 L80,20 M35,5 V35 M45,12 V28 M25,10 V16 M22,13 H28";
        case ComponentType.AC_SOURCE:
            return "M0,20 L25,20 M55,20 L80,20 M40,20 m-15,0 a15,15 0 1,0 30,0 a15,15 0 1,0 -30,0 M30,20 Q35,10 40,20 T50,20";
        case ComponentType.GROUND:
            return "M40,0 L40,20 M24,20 H56 M30,26 H50 M36,32 H44";
        case ComponentType.CAPACITOR:
            return "M0,20 L35,20 M45,20 L80,20 M35,5 V35 M45,5 V35";
        case ComponentType.INDUCTOR:
            return "M0,20 L15,20 Q23,5 31,20 T47,20 T63,20 L80,20";
        case ComponentType.DIODE:
            return "M0,20 L30,20 M50,20 L80,20 M30,10 L30,30 L50,20 Z M50,10 V30";
        case ComponentType.LED:
            return "M0,20 L30,20 M50,20 L80,20 M30,10 L30,30 L50,20 Z M50,10 V30 M52,10 L60,2 M56,14 L64,6";
        case ComponentType.OPAMP:
             return "M15,5 L15,35 L65,20 Z M0,12 H15 M0,28 H15 M65,20 H80";
        case ComponentType.VOLTMETER:
            return "M0,20 L25,20 M55,20 L80,20 M40,20 m-15,0 a15,15 0 1,0 30,0 a15,15 0 1,0 -30,0 M38,15 L42,25 L46,15";
        case ComponentType.AMMETER:
            return "M0,20 L25,20 M55,20 L80,20 M40,20 m-15,0 a15,15 0 1,0 30,0 a15,15 0 1,0 -30,0 M36,25 L40,15 L44,25 M38,21 H42";
        case ComponentType.AND_GATE:
            return "M15,5 V35 H35 A15,15 0 0 0 35,5 Z M50,20 H80";
        case ComponentType.OR_GATE:
            return "M15,5 Q20,20 15,35 Q45,35 60,20 Q45,5 15,5 M60,20 H80";
        case ComponentType.NOT_GATE:
            return "M15,5 V35 L50,20 Z M50,20 L54,20 A2,2 0 1,0 58,20 A2,2 0 1,0 54,20 M58,20 H80";
        case ComponentType.NAND_GATE:
            return "M15,5 V35 H35 A15,15 0 0 0 35,5 Z M50,20 L54,20 A2,2 0 1,0 58,20 A2,2 0 1,0 54,20 M58,20 H80";
        case ComponentType.NOR_GATE:
            return "M15,5 Q20,20 15,35 Q45,35 60,20 Q45,5 15,5 M60,20 L64,20 A2,2 0 1,0 68,20 A2,2 0 1,0 64,20 M68,20 H80";
        case ComponentType.XOR_GATE:
            return "M10,5 Q15,20 10,35 M15,5 Q20,20 15,35 Q45,35 60,20 Q45,5 15,5 M60,20 H80";
        default: return "";
    }
}

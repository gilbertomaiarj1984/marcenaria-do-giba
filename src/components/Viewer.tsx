import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Edges, OrbitControls } from '@react-three/drei';
import type { BuildResult, CellType, Panel, PartKind, ShelfConfig } from '../model/types';

const S = 0.001; // mm -> metros na cena

const COLORS: Partial<Record<PartKind, string>> = {
  fundo: '#b9a58a',
  porta: '#e9e2d6',
  'frente-gaveta': '#e9e2d6',
  'gaveta-lateral': '#d8c9ae',
  'gaveta-frente-traseira': '#d8c9ae',
  'gaveta-fundo': '#b9a58a',
};
const BODY = '#c8a27a';

const FRONTS: PartKind[] = ['porta', 'frente-gaveta'];

interface Props {
  config: ShelfConfig;
  result: BuildResult;
  showFronts: boolean;
  onCellClick: (col: number, row: number) => void;
}

export function Viewer({ config, result, showFronts, onCellClick }: Props) {
  const [hover, setHover] = useState<string | null>(null);
  const maxDim = Math.max(config.width, config.height) * S;
  const cx = (config.width / 2) * S;
  const cy = (config.height / 2) * S;
  return (
    <Canvas
      shadows
      camera={{ position: [cx + maxDim * 0.6, cy + maxDim * 0.3, maxDim * 1.6], fov: 45 }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 3, 3]} intensity={1.2} castShadow />
      <directionalLight position={[-2, 1, 2]} intensity={0.4} />
      <group>
        {result.panels.map((p) => {
          const front = FRONTS.includes(p.kind);
          if (front && !showFronts) return null;
          return <PanelMesh key={p.id} p={p} transparent={false} />;
        })}
        {result.cells.map((cell) => (
          <mesh
            key={`hit-${cell.col}-${cell.row}`}
            position={[(cell.x + cell.w / 2) * S, (cell.y + cell.h / 2) * S, (config.depth + config.thickness + 2) * S]}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHover(`${cell.col}-${cell.row}`);
              document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
              setHover(null);
              document.body.style.cursor = '';
            }}
            onClick={(e) => {
              e.stopPropagation();
              onCellClick(cell.col, cell.row);
            }}
          >
            <planeGeometry args={[cell.w * S, cell.h * S]} />
            <meshBasicMaterial
              color={cellColor(cell.type)}
              transparent
              opacity={hover === `${cell.col}-${cell.row}` ? 0.3 : 0}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.001, 0.2]} receiveShadow>
        <planeGeometry args={[6, 6]} />
        <shadowMaterial opacity={0.15} />
      </mesh>
      <OrbitControls target={[cx, cy, (config.depth / 2) * S]} makeDefault />
    </Canvas>
  );
}

function cellColor(t: CellType) {
  return t === 'porta' ? '#2b6cb0' : t === 'gaveta' ? '#2f855a' : '#c05621';
}

function PanelMesh({ p, transparent }: { p: Panel; transparent: boolean }) {
  return (
    <mesh
      position={[(p.x + p.sx / 2) * S, (p.y + p.sy / 2) * S, (p.z + p.sz / 2) * S]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[p.sx * S, p.sy * S, p.sz * S]} />
      <meshStandardMaterial
        color={COLORS[p.kind] ?? BODY}
        roughness={0.8}
        transparent={transparent}
        opacity={transparent ? 0.4 : 1}
      />
      <Edges color="#5a4632" threshold={15} />
    </mesh>
  );
}

import { useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Edges, OrbitControls } from '@react-three/drei';
import type { Group } from 'three';
import { DOOR_OPEN_ANGLE } from '../model/build';
import type { BuildResult, Motion, Panel, PartKind, ShelfConfig } from '../model/types';

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
const SELECTED = '#2b6cb0';

const FRONTS: PartKind[] = ['porta', 'frente-gaveta'];

interface Props {
  config: ShelfConfig;
  result: BuildResult;
  showFronts: boolean;
  open: boolean;
  selected: number | null;
  onRegionClick: (index: number) => void;
}

export function Viewer({ config, result, showFronts, open, selected, onRegionClick }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const maxDim = Math.max(config.width, config.height) * S;
  const cx = (config.width / 2) * S;
  const cy = (config.height / 2) * S;
  return (
    <Canvas shadows camera={{ position: [cx + maxDim * 0.6, cy + maxDim * 0.3, maxDim * 1.6], fov: 45 }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 3, 3]} intensity={1.2} castShadow />
      <directionalLight position={[-2, 1, 2]} intensity={0.4} />
      <group>
        {result.panels.map((p) => {
          if (FRONTS.includes(p.kind) && !showFronts) return null;
          const mesh = <PanelMesh key={p.id} p={p} />;
          return p.motion ? (
            <Moving key={p.id} motion={p.motion} open={open}>
              {mesh}
            </Moving>
          ) : (
            mesh
          );
        })}
        {result.regions.map((box) => {
          const active = hover === box.index || selected === box.index;
          return (
            <mesh
              key={`hit-${box.index}`}
              position={[(box.x + box.w / 2) * S, (box.y + box.h / 2) * S, (config.depth + config.thickness + 2) * S]}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHover(box.index);
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                setHover(null);
                document.body.style.cursor = '';
              }}
              onClick={(e) => {
                e.stopPropagation();
                onRegionClick(box.index);
              }}
            >
              <planeGeometry args={[box.w * S, box.h * S]} />
              <meshBasicMaterial
                color={SELECTED}
                transparent
                opacity={active ? (selected === box.index ? 0.25 : 0.15) : 0}
                depthWrite={false}
              />
            </mesh>
          );
        })}
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.001, 0.2]} receiveShadow>
        <planeGeometry args={[6, 6]} />
        <shadowMaterial opacity={0.15} />
      </mesh>
      <OrbitControls target={[cx, cy, (config.depth / 2) * S]} makeDefault />
    </Canvas>
  );
}

/** Abre a porta girando na dobradiça, ou puxa a gaveta pela corrediça. */
function Moving({ motion, open, children }: { motion: Motion; open: boolean; children: ReactNode }) {
  const pivot = useRef<Group>(null);
  const progress = useRef(open ? 1 : 0);
  const apply = () => {
    const g = pivot.current;
    if (!g) return;
    const k = progress.current;
    if (motion.type === 'hinge') g.rotation.y = motion.dir * (DOOR_OPEN_ANGLE * Math.PI / 180) * k;
    else g.position.z = motion.distance * S * k;
  };
  useFrame((_, dt) => {
    const target = open ? 1 : 0;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const step = reduce ? 1 : dt * 2.5;
    const d = target - progress.current;
    if (d === 0) return;
    progress.current = Math.abs(d) <= step ? target : progress.current + Math.sign(d) * step;
    apply();
  });

  if (motion.type === 'hinge') {
    // Leva o eixo da dobradiça para a origem do grupo, gira, e devolve.
    const ax = motion.axisX * S;
    const az = motion.axisZ * S;
    return (
      <group position={[ax, 0, az]}>
        <group ref={pivot} onUpdate={apply}>
          <group position={[-ax, 0, -az]}>{children}</group>
        </group>
      </group>
    );
  }
  return (
    <group ref={pivot} onUpdate={apply}>
      {children}
    </group>
  );
}

function PanelMesh({ p }: { p: Panel }) {
  return (
    <mesh position={[(p.x + p.sx / 2) * S, (p.y + p.sy / 2) * S, (p.z + p.sz / 2) * S]} castShadow receiveShadow>
      <boxGeometry args={[p.sx * S, p.sy * S, p.sz * S]} />
      <meshStandardMaterial color={COLORS[p.kind] ?? BODY} roughness={0.8} />
      <Edges color="#5a4632" threshold={15} />
    </mesh>
  );
}

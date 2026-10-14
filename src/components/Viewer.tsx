import { useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Edges, Html, Line, OrbitControls } from '@react-three/drei';
import type { Group } from 'three';
import { DOOR_OPEN_ANGLE } from '../model/build';
import type { Measure } from '../model/measures';
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
  selection: number[];
  measures: { external: boolean; internal: boolean; selection: boolean };
  measure: Measure | null;
  onRegionClick: (index: number, additive: boolean) => void;
}

export function Viewer({ config, result, showFronts, open, selection, measures, measure, onRegionClick }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const maxDim = Math.max(config.width, config.height) * S;
  const cx = (config.width / 2) * S;
  const cy = (config.height / 2) * S;
  return (
    <Canvas shadows camera={{ position: [cx + maxDim * 0.6, cy + maxDim * 0.25, maxDim * 1.85], fov: 45 }}>
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
          const isSel = selection.includes(box.index);
          const active = hover === box.index || isSel;
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
                const n = e.nativeEvent;
                onRegionClick(box.index, n.shiftKey || n.ctrlKey || n.metaKey);
              }}
            >
              <planeGeometry args={[box.w * S, box.h * S]} />
              <meshBasicMaterial
                color={SELECTED}
                transparent
                opacity={active ? (isSel ? 0.25 : 0.15) : 0}
                depthWrite={false}
              />
            </mesh>
          );
        })}
      </group>
      {measures.external && <ExternalDims config={config} />}
      {measures.internal &&
        nicheBoxes(result, config).map((b) => (
          <Label key={`in-${b.key}`} at={[b.x + b.w / 2, b.y + b.h / 2, config.depth + config.thickness + 6]}>
            {fmt(b.w)} × {fmt(b.h)}
          </Label>
        ))}
      {measures.selection && measure && <SelectionDims m={measure} z={config.depth + config.thickness + 4} />}
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

const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');
const DIM = '#1f5f99';

function Label({ at, children }: { at: [number, number, number]; children: ReactNode }) {
  return (
    <Html position={[at[0] * S, at[1] * S, at[2] * S]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
      <span className="dim-label">{children}</span>
    </Html>
  );
}

type P3 = [number, number, number];

/** Linha de cota com traços nas pontas e o valor no meio. */
function Dim({ a, b, tick, label }: { a: P3; b: P3; tick: P3; label: ReactNode }) {
  const m = (p: P3) => p.map((v) => v * S) as P3;
  const end = (p: P3) => [m([p[0] - tick[0], p[1] - tick[1], p[2] - tick[2]]), m([p[0] + tick[0], p[1] + tick[1], p[2] + tick[2]])];
  return (
    <group>
      <Line points={[m(a), m(b)]} color={DIM} lineWidth={1.5} />
      <Line points={end(a)} color={DIM} lineWidth={1.5} />
      <Line points={end(b)} color={DIM} lineWidth={1.5} />
      <Label at={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]}>{label}</Label>
    </group>
  );
}

function ExternalDims({ config: c }: { config: ShelfConfig }) {
  const off = 60;
  const zf = c.depth;
  return (
    <group>
      <Dim a={[0, c.height + off, zf]} b={[c.width, c.height + off, zf]} tick={[0, 20, 0]} label={`Largura ${fmt(c.width)}`} />
      <Dim a={[-off, 0, zf]} b={[-off, c.height, zf]} tick={[20, 0, 0]} label={`Altura ${fmt(c.height)}`} />
      <Dim
        a={[c.width + off, c.height, 0]}
        b={[c.width + off, c.height, c.depth]}
        tick={[20, 0, 0]}
        label={`Prof. ${fmt(c.depth)}`}
      />
      {c.plinthHeight > 0 && (
        <Dim
          a={[c.width + off, 0, zf]}
          b={[c.width + off, c.plinthHeight, zf]}
          tick={[20, 0, 0]}
          label={`Rodapé ${fmt(c.plinthHeight)}`}
        />
      )}
    </group>
  );
}

function SelectionDims({ m, z }: { m: Measure; z: number }) {
  const y = m.y0 + Math.min(40, (m.y1 - m.y0) / 4);
  const x = m.x0 + Math.min(40, (m.x1 - m.x0) / 4);
  return (
    <group>
      <Dim
        a={[m.x0, y, z]}
        b={[m.x1, y, z]}
        tick={[0, 15, 0]}
        label={`${fmt(m.freeWidth)} livre · ${fmt(m.outerWidth)} por fora`}
      />
      <Dim
        a={[x, m.y0, z]}
        b={[x, m.y1, z]}
        tick={[15, 0, 0]}
        label={`${fmt(m.freeHeight)} livre · ${fmt(m.outerHeight)} por fora`}
      />
    </group>
  );
}

/** Vãos livres de verdade: uma porta que mantém as prateleiras por dentro mostra cada nicho dela. */
function nicheBoxes(result: BuildResult, c: ShelfConfig) {
  const t = c.thickness;
  return result.regions.flatMap((box) => {
    const r = box.region;
    if (!(r.type === 'porta' && r.keepInside)) return [{ key: `${box.index}`, x: box.x, y: box.y, w: box.w, h: box.h }];
    const out = [];
    for (let i = 0; i < r.colSpan; i++)
      for (let j = 0; j < r.rowSpan; j++)
        out.push({
          key: `${box.index}-${i}-${j}`,
          x: box.x + i * (result.columnWidth + t),
          y: box.y + j * (result.rowHeight + t),
          w: result.columnWidth,
          h: result.rowHeight,
        });
    return out;
  });
}

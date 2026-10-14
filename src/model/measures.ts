import type { BuildResult } from './types';

export interface Measure {
  /** Limites do vão livre (faces internas das chapas em volta), em mm. */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** Vão livre entre as chapas em volta. */
  freeWidth: number;
  freeHeight: number;
  /** Por fora, contando as chapas em volta. */
  outerWidth: number;
  outerHeight: number;
  /** Quantos nichos da grade a seleção cobre. */
  niches: number;
}

/** Medidas de um ou mais vãos juntos: do primeiro ao último, por dentro e por fora. */
export function measureSelection(result: BuildResult, thickness: number, indices: number[]): Measure | null {
  const boxes = indices.map((i) => result.regions[i]).filter(Boolean);
  if (!boxes.length) return null;
  const x0 = Math.min(...boxes.map((b) => b.x));
  const x1 = Math.max(...boxes.map((b) => b.x + b.w));
  const y0 = Math.min(...boxes.map((b) => b.y));
  const y1 = Math.max(...boxes.map((b) => b.y + b.h));
  const cols = new Set<number>();
  const rows = new Set<number>();
  for (const b of boxes) {
    for (let c = b.region.col; c < b.region.col + b.region.colSpan; c++) cols.add(c);
    for (let r = b.region.row; r < b.region.row + b.region.rowSpan; r++) rows.add(r);
  }
  const c = [...cols];
  const r = [...rows];
  const niches = (Math.max(...c) - Math.min(...c) + 1) * (Math.max(...r) - Math.min(...r) + 1);
  return {
    x0,
    x1,
    y0,
    y1,
    freeWidth: round(x1 - x0),
    freeHeight: round(y1 - y0),
    outerWidth: round(x1 - x0 + 2 * thickness),
    outerHeight: round(y1 - y0 + 2 * thickness),
    niches,
  };
}

const round = (n: number) => Math.round(n * 10) / 10;

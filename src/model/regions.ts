import type { CellType, Region } from './types';

export type Direction = 'esquerda' | 'direita' | 'cima' | 'baixo';

export function cell(col: number, row: number, type: CellType = 'nicho'): Region {
  return { col, row, colSpan: 1, rowSpan: 1, type, drawers: 1 };
}

/** Uma área por nicho, todas do mesmo tipo. */
export function gridRegions(columns: number, rows: number, type: CellType = 'nicho'): Region[] {
  const out: Region[] = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) out.push(cell(col, row, type));
  return out;
}

/** owner[col][row] = índice da área que ocupa aquele nicho (-1 se nenhuma). */
export function ownerGrid(regions: Region[], columns: number, rows: number): number[][] {
  const g = Array.from({ length: columns }, () => Array<number>(rows).fill(-1));
  regions.forEach((r, i) => {
    for (let c = r.col; c < r.col + r.colSpan; c++)
      for (let w = r.row; w < r.row + r.rowSpan; w++) if (c < columns && w < rows) g[c][w] = i;
  });
  return g;
}

/** Mantém as áreas que ainda cabem e completa o resto com nichos simples. */
export function resizeRegions(regions: Region[], columns: number, rows: number): Region[] {
  const kept = regions.filter((r) => r.col + r.colSpan <= columns && r.row + r.rowSpan <= rows);
  const g = ownerGrid(kept, columns, rows);
  const out = [...kept];
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < columns; col++) if (g[col][row] === -1) out.push(cell(col, row));
  return sortRegions(out);
}

function sortRegions(regions: Region[]): Region[] {
  return [...regions].sort((a, b) => a.row - b.row || a.col - b.col);
}

/**
 * Tira a divisória (ou prateleira) do lado indicado da área, juntando-a com o vizinho.
 * Se o vizinho for maior, a área cresce até formar um retângulo.
 * Retorna as novas áreas e o índice da área resultante.
 */
export function mergeRegion(
  regions: Region[],
  index: number,
  dir: Direction,
  columns: number,
  rows: number,
): { regions: Region[]; index: number } {
  const r = regions[index];
  let c0 = r.col;
  let r0 = r.row;
  let c1 = r.col + r.colSpan; // exclusivo
  let r1 = r.row + r.rowSpan;
  if (dir === 'esquerda') c0--;
  if (dir === 'direita') c1++;
  if (dir === 'baixo') r0--;
  if (dir === 'cima') r1++;
  if (c0 < 0 || r0 < 0 || c1 > columns || r1 > rows) return { regions, index };

  // Cresce até não cortar nenhuma área ao meio.
  let changed = true;
  const inside = new Set<number>();
  while (changed) {
    changed = false;
    regions.forEach((x, i) => {
      if (inside.has(i)) return;
      const hit = x.col < c1 && x.col + x.colSpan > c0 && x.row < r1 && x.row + x.rowSpan > r0;
      if (!hit) return;
      inside.add(i);
      const nc0 = Math.min(c0, x.col);
      const nr0 = Math.min(r0, x.row);
      const nc1 = Math.max(c1, x.col + x.colSpan);
      const nr1 = Math.max(r1, x.row + x.rowSpan);
      if (nc0 !== c0 || nr0 !== r0 || nc1 !== c1 || nr1 !== r1) changed = true;
      [c0, r0, c1, r1] = [nc0, nr0, nc1, nr1];
    });
  }

  const merged: Region = { ...r, col: c0, row: r0, colSpan: c1 - c0, rowSpan: r1 - r0 };
  const out = sortRegions([...regions.filter((_, i) => !inside.has(i)), merged]);
  return { regions: out, index: out.indexOf(merged) };
}

/** Recoloca todas as divisórias e prateleiras dentro da área. */
export function splitRegion(regions: Region[], index: number): Region[] {
  const r = regions[index];
  const parts: Region[] = [];
  for (let row = r.row; row < r.row + r.rowSpan; row++)
    for (let col = r.col; col < r.col + r.colSpan; col++) parts.push({ ...cell(col, row), type: r.type });
  return sortRegions([...regions.filter((_, i) => i !== index), ...parts]);
}

export function regionAt(regions: Region[], col: number, row: number): number {
  return regions.findIndex(
    (r) => col >= r.col && col < r.col + r.colSpan && row >= r.row && row < r.row + r.rowSpan,
  );
}

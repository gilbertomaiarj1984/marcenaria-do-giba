import type {
  BuildResult,
  CellBox,
  CellType,
  Hardware,
  Panel,
  PartKind,
  PartLine,
  ShelfConfig,
} from './types';

/** Folga entre portas/frentes vizinhas (mm). Cada frente perde metade em cada lado. */
export const FRONT_GAP = 3;
/** Espaço lateral exigido pela corrediça telescópica, por lado (mm). */
export const SLIDE_SIDE_CLEARANCE = 12.5;
/** Comprimentos comerciais de corrediça telescópica (mm). */
export const SLIDE_LENGTHS = [250, 300, 350, 400, 450, 500, 550];
/** Folga entre a caixa da gaveta e a altura do vão (mm). */
export const DRAWER_TOP_CLEARANCE = 40;

export const SHEET_THICKNESSES = [15, 18, 25];

export function hingesForDoor(doorHeight: number): number {
  if (doorHeight <= 900) return 2;
  if (doorHeight <= 1600) return 3;
  if (doorHeight <= 2000) return 4;
  return 5;
}

export function slideLengthFor(interiorDepth: number): number | null {
  const fit = SLIDE_LENGTHS.filter((l) => l <= interiorDepth - 10);
  return fit.length ? fit[fit.length - 1] : null;
}

export function resizeCells(cells: CellType[][], columns: number, rows: number): CellType[][] {
  return Array.from({ length: columns }, (_, c) =>
    Array.from({ length: rows }, (_, r) => cells[c]?.[r] ?? 'nicho'),
  );
}

export function columnWidth(c: ShelfConfig): number {
  const wi = c.width - 2 * c.thickness;
  return (wi - (c.columns - 1) * c.thickness) / c.columns;
}

export function rowHeight(c: ShelfConfig): number {
  const hi = c.height - c.plinthHeight - 2 * c.thickness;
  return (hi - (c.rows - 1) * c.thickness) / c.rows;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function buildShelf(c: ShelfConfig): BuildResult {
  const t = c.thickness;
  const bt = c.backThickness;
  const mdf = `MDF ${t}mm`;
  const hdf = `HDF ${bt}mm`;
  const dc = c.depth - bt; // profundidade do corpo (sem o fundo)
  const z0 = bt;
  const wi = c.width - 2 * t;
  const hi = c.height - c.plinthHeight - 2 * t;
  const colW = columnWidth(c);
  const rowH = rowHeight(c);
  const yInterior = c.plinthHeight + t;

  const panels: Panel[] = [];
  let n = 0;
  const add = (
    kind: PartKind,
    name: string,
    pos: [number, number, number],
    size: [number, number, number],
    thickness: number,
    material: string,
    cell?: { col: number; row: number },
  ) => {
    // A medida de corte são as duas dimensões que não são a espessura.
    const dims = [...size];
    const ti = dims.findIndex((d) => Math.abs(d - thickness) < 1e-6);
    dims.splice(ti >= 0 ? ti : 0, 1);
    const [a, b] = dims.map(round1).sort((p, q) => q - p);
    panels.push({
      id: `${kind}-${n++}`,
      kind,
      name,
      x: pos[0],
      y: pos[1],
      z: pos[2],
      sx: size[0],
      sy: size[1],
      sz: size[2],
      length: a,
      width: b,
      thickness,
      material,
      cell,
    });
  };

  // Corpo
  add('lateral', 'Lateral', [0, 0, z0], [t, c.height, dc], t, mdf);
  add('lateral', 'Lateral', [c.width - t, 0, z0], [t, c.height, dc], t, mdf);
  add('base', 'Base', [t, c.plinthHeight, z0], [wi, t, dc], t, mdf);
  add('tampo', 'Tampo', [t, c.height - t, z0], [wi, t, dc], t, mdf);
  if (c.plinthHeight > 0) {
    add('rodape', 'Rodapé', [t, 0, c.depth - t], [wi, c.plinthHeight, t], t, mdf);
  }
  add('fundo', 'Fundo', [0, c.plinthHeight, 0], [c.width, c.height - c.plinthHeight, bt], bt, hdf);

  for (let i = 1; i < c.columns; i++) {
    const x = t + i * colW + (i - 1) * t;
    add('divisoria', 'Divisória', [x, yInterior, z0], [t, hi, dc], t, mdf);
  }

  const cells: CellBox[] = [];
  for (let col = 0; col < c.columns; col++) {
    const x = t + col * (colW + t);
    for (let row = 1; row < c.rows; row++) {
      const y = yInterior + row * rowH + (row - 1) * t;
      add('prateleira', 'Prateleira', [x, y, z0], [colW, t, dc], t, mdf, { col, row });
    }
    for (let row = 0; row < c.rows; row++) {
      const y = yInterior + row * (rowH + t);
      cells.push({ col, row, x, y, w: colW, h: rowH, type: c.cells[col]?.[row] ?? 'nicho' });
    }
  }

  // Frentes (sobrepostas): cobrem o vão + metade da chapa em volta, menos a folga.
  let hinges = 0;
  let drawers = 0;
  const slide = slideLengthFor(dc);
  for (const cell of cells) {
    if (cell.type === 'nicho') continue;
    const fw = cell.w + t - FRONT_GAP;
    const fh = cell.h + t - FRONT_GAP;
    const fx = cell.x - t / 2 + FRONT_GAP / 2;
    const fy = cell.y - t / 2 + FRONT_GAP / 2;
    const at = { col: cell.col, row: cell.row };
    if (cell.type === 'porta') {
      add('porta', 'Porta', [fx, fy, c.depth], [fw, fh, t], t, mdf, at);
      hinges += hingesForDoor(fh);
      continue;
    }
    drawers++;
    add('frente-gaveta', 'Frente de gaveta', [fx, fy, c.depth], [fw, fh, t], t, mdf, at);
    if (!slide) continue;
    const boxW = cell.w - 2 * SLIDE_SIDE_CLEARANCE;
    const boxH = Math.max(cell.h - DRAWER_TOP_CLEARANCE, 60);
    const bx = cell.x + SLIDE_SIDE_CLEARANCE;
    const by = cell.y + 15;
    const bz = c.depth - slide;
    add('gaveta-lateral', 'Lateral de gaveta', [bx, by, bz], [t, boxH, slide], t, mdf, at);
    add('gaveta-lateral', 'Lateral de gaveta', [bx + boxW - t, by, bz], [t, boxH, slide], t, mdf, at);
    add('gaveta-frente-traseira', 'Frente/traseira interna', [bx + t, by, c.depth - t], [boxW - 2 * t, boxH, t], t, mdf, at);
    add('gaveta-frente-traseira', 'Frente/traseira interna', [bx + t, by, bz], [boxW - 2 * t, boxH, t], t, mdf, at);
    add('gaveta-fundo', 'Fundo de gaveta', [bx, by - bt, bz], [boxW, bt, slide], bt, hdf, at);
  }

  const hardware: Hardware[] = [];
  if (hinges) {
    hardware.push({
      name: `Dobradiça caneco 35mm ${c.hinge}`,
      quantity: hinges,
      detail: 'com amortecedor, sobreposição conforme a posição da porta',
    });
    hardware.push({ name: 'Puxador de porta', quantity: cells.filter((x) => x.type === 'porta').length });
  }
  if (drawers) {
    hardware.push({
      name: slide ? `Corrediça telescópica ${slide}mm (par)` : 'Corrediça telescópica (profundidade insuficiente)',
      quantity: drawers,
    });
    hardware.push({ name: 'Puxador de gaveta', quantity: drawers });
  }
  hardware.push({ name: 'Parafuso 4,0 x 40mm (corpo)', quantity: estimateScrews(c) });

  return { panels, hardware, cells, interiorDepth: dc, columnWidth: colW, rowHeight: rowH };
}

function estimateScrews(c: ShelfConfig): number {
  // 2 por ponta de cada peça horizontal/vertical interna, 3 por ponta de base/tampo.
  const shelves = c.columns * (c.rows - 1);
  return 4 * 3 + (c.columns - 1) * 2 * 2 + shelves * 2 * 2;
}

/** Agrupa peças iguais na lista de corte. */
export function partsList(panels: Panel[]): PartLine[] {
  const map = new Map<string, PartLine>();
  for (const p of panels) {
    const key = [p.name, p.length, p.width, p.thickness, p.material].join('|');
    const line = map.get(key);
    if (line) line.quantity++;
    else
      map.set(key, {
        name: p.name,
        quantity: 1,
        length: p.length,
        width: p.width,
        thickness: p.thickness,
        material: p.material,
      });
  }
  return [...map.values()];
}

export function defaultConfig(): ShelfConfig {
  const columns = 4;
  const rows = 4;
  const cells = resizeCells([], columns, rows);
  cells[0][0] = 'porta';
  cells[1][0] = 'porta';
  cells[2][0] = 'gaveta';
  cells[3][0] = 'gaveta';
  return {
    width: 1470,
    height: 1550,
    depth: 400,
    thickness: 18,
    backThickness: 6,
    plinthHeight: 80,
    columns,
    rows,
    cells,
    hinge: 'curva',
  };
}

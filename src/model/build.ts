import { gridRegions, ownerGrid } from './regions';
import type {
  BuildResult,
  Hardware,
  Motion,
  Panel,
  PartKind,
  PartLine,
  RegionBox,
  ShelfConfig,
} from './types';

/** Folga entre portas/frentes vizinhas (mm). Cada frente perde metade em cada lado. */
export const FRONT_GAP = 3;
/** Espaço lateral exigido pela corrediça telescópica, por lado (mm). */
export const SLIDE_SIDE_CLEARANCE = 12.5;
/** Acima desta largura a área com porta leva duas portas (mm). */
export const MAX_DOOR_WIDTH = 600;
/** Ângulo de abertura das portas na visualização (graus). */
export const DOOR_OPEN_ANGLE = 100;
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
    region?: number,
    motion?: Motion,
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
      region,
      motion,
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

  const g = ownerGrid(c.regions, c.columns, c.rows);
  const colX = (col: number) => t + col * (colW + t);
  const rowY = (row: number) => yInterior + row * (rowH + t);
  // Existe divisória na linha vertical i (entre as colunas i-1 e i) na altura da linha r?
  const vSeg = (i: number, r: number) => i <= 0 || i >= c.columns || g[i - 1][r] !== g[i][r];
  // Existe prateleira na linha horizontal j (entre as linhas j-1 e j) na coluna col?
  const hSeg = (col: number, j: number) => g[col][j - 1] !== g[col][j];
  // A divisória atravessa a linha j no ponto i? Nesse caso a prateleira para nela.
  const crosses = (i: number, j: number) => vSeg(i, j - 1) && vSeg(i, j);

  // Divisórias: trechos contínuos em cada linha vertical.
  for (let i = 1; i < c.columns; i++) {
    let r = 0;
    while (r < c.rows) {
      if (!vSeg(i, r)) {
        r++;
        continue;
      }
      const a = r;
      while (r + 1 < c.rows && vSeg(i, r + 1)) r++;
      const h = (r - a + 1) * rowH + (r - a) * t;
      add('divisoria', 'Divisória', [colX(i) - t, rowY(a), z0], [t, h, dc], t, mdf);
      r++;
    }
  }

  // Prateleiras: trechos contínuos em cada linha horizontal, cortados onde a divisória atravessa.
  // Onde uma divisória termina, a prateleira passa por cima dela.
  for (let j = 1; j < c.rows; j++) {
    let col = 0;
    while (col < c.columns) {
      if (!hSeg(col, j)) {
        col++;
        continue;
      }
      const a = col;
      while (col + 1 < c.columns && hSeg(col + 1, j) && !crosses(col + 1, j)) col++;
      let x0 = colX(a);
      let x1 = colX(col) + colW;
      if (a > 0 && !crosses(a, j)) x0 -= t;
      if (col + 1 < c.columns && !crosses(col + 1, j)) x1 += t;
      add('prateleira', 'Prateleira', [x0, rowY(j) - t, z0], [x1 - x0, t, dc], t, mdf);
      col++;
    }
  }

  const regions: RegionBox[] = c.regions.map((region, index) => ({
    index,
    region,
    x: colX(region.col),
    y: rowY(region.row),
    w: region.colSpan * colW + (region.colSpan - 1) * t,
    h: region.rowSpan * rowH + (region.rowSpan - 1) * t,
  }));

  // Frentes (sobrepostas): cobrem o vão + metade da chapa em volta, menos a folga.
  let hinges = 0;
  let doors = 0;
  let drawers = 0;
  const slide = slideLengthFor(dc);
  for (const box of regions) {
    const { region } = box;
    if (region.type === 'nicho') continue;
    const fw = box.w + t - FRONT_GAP;
    const fh = box.h + t - FRONT_GAP;
    const fx = box.x - t / 2 + FRONT_GAP / 2;
    const fy = box.y - t / 2 + FRONT_GAP / 2;
    const ri = box.index;
    if (region.type === 'porta') {
      const leaves = fw > MAX_DOOR_WIDTH ? 2 : 1;
      const lw = (fw - (leaves - 1) * FRONT_GAP) / leaves;
      for (let k = 0; k < leaves; k++) {
        const lx = fx + k * (lw + FRONT_GAP);
        // Uma porta só abre para o lado de fora do móvel; duas portas abrem do meio.
        const left = leaves === 2 ? k === 0 : box.x + box.w / 2 < c.width / 2;
        const motion: Motion = { type: 'hinge', axisX: left ? lx : lx + lw, axisZ: c.depth, dir: left ? -1 : 1 };
        add('porta', 'Porta', [lx, fy, c.depth], [lw, fh, t], t, mdf, ri, motion);
        hinges += hingesForDoor(fh);
        doors++;
      }
      continue;
    }
    const count = Math.max(1, Math.round(region.drawers));
    const frontH = (fh - (count - 1) * FRONT_GAP) / count;
    const slotH = box.h / count;
    for (let k = 0; k < count; k++) {
      drawers++;
      const motion: Motion = { type: 'slide', distance: (slide ?? dc) * 0.85 };
      add('frente-gaveta', 'Frente de gaveta', [fx, fy + k * (frontH + FRONT_GAP), c.depth], [fw, frontH, t], t, mdf, ri, motion);
      if (!slide) continue;
      const boxW = box.w - 2 * SLIDE_SIDE_CLEARANCE;
      const boxH = Math.max(slotH - DRAWER_TOP_CLEARANCE, 60);
      const bx = box.x + SLIDE_SIDE_CLEARANCE;
      const by = box.y + k * slotH + 15;
      const bz = c.depth - slide;
      add('gaveta-lateral', 'Lateral de gaveta', [bx, by, bz], [t, boxH, slide], t, mdf, ri, motion);
      add('gaveta-lateral', 'Lateral de gaveta', [bx + boxW - t, by, bz], [t, boxH, slide], t, mdf, ri, motion);
      add('gaveta-frente-traseira', 'Frente/traseira interna', [bx + t, by, c.depth - t], [boxW - 2 * t, boxH, t], t, mdf, ri, motion);
      add('gaveta-frente-traseira', 'Frente/traseira interna', [bx + t, by, bz], [boxW - 2 * t, boxH, t], t, mdf, ri, motion);
      add('gaveta-fundo', 'Fundo de gaveta', [bx, by - bt, bz], [boxW, bt, slide], bt, hdf, ri, motion);
    }
  }

  const hardware: Hardware[] = [];
  if (hinges) {
    hardware.push({
      name: `Dobradiça caneco 35mm ${c.hinge}`,
      quantity: hinges,
      detail: 'com amortecedor, sobreposição conforme a posição da porta',
    });
    hardware.push({ name: 'Puxador de porta', quantity: doors });
  }
  if (drawers) {
    hardware.push({
      name: slide ? `Corrediça telescópica ${slide}mm (par)` : 'Corrediça telescópica (profundidade insuficiente)',
      quantity: drawers,
    });
    hardware.push({ name: 'Puxador de gaveta', quantity: drawers });
  }
  hardware.push({ name: 'Parafuso 4,0 x 40mm (corpo)', quantity: estimateScrews(panels) });

  return { panels, hardware, regions, interiorDepth: dc, columnWidth: colW, rowHeight: rowH };
}

function estimateScrews(panels: Panel[]): number {
  // 3 por ponta de base e tampo, 2 por ponta de divisória e prateleira.
  let n = 0;
  for (const p of panels) {
    if (p.kind === 'base' || p.kind === 'tampo') n += 6;
    if (p.kind === 'divisoria' || p.kind === 'prateleira') n += 4;
  }
  return n;
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
  const regions = gridRegions(columns, rows);
  regions[0].type = 'porta';
  regions[1].type = 'porta';
  regions[2] = { ...regions[2], type: 'gaveta', drawers: 2 };
  regions[3] = { ...regions[3], type: 'gaveta', drawers: 2 };
  return {
    width: 1470,
    height: 1550,
    depth: 400,
    thickness: 18,
    backThickness: 6,
    plinthHeight: 80,
    columns,
    rows,
    regions,
    hinge: 'curva',
  };
}

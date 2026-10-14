import type { Panel } from './types';

/** Opções do corte. Medidas em mm. */
export interface CutSettings {
  sheetLength: number; // comprimento da chapa (sentido do veio)
  sheetWidth: number; // largura da chapa
  kerf: number; // espessura da serra
  trim: number; // refilo em cada borda da chapa
  /** Respeitar o veio: o comprimento da peça segue o comprimento da chapa (não gira). */
  grain: boolean;
}

export const DEFAULT_CUT: CutSettings = {
  sheetLength: 2750,
  sheetWidth: 1850,
  kerf: 4,
  trim: 10,
  grain: false,
};

/** Uma peça a cortar, com o código que aparece no desenho e na lista. */
export interface Piece {
  code: string;
  name: string;
  length: number;
  width: number;
  material: string;
  thickness: number;
}

export interface Placement {
  piece: Piece;
  /** Posição na chapa: x ao longo do comprimento, y ao longo da largura. */
  x: number;
  y: number;
  /** Tamanho ocupado na chapa (já girado, se for o caso). */
  w: number;
  h: number;
  rotated: boolean;
}

export interface Sheet {
  material: string;
  thickness: number;
  placements: Placement[];
  /** Fração da chapa inteira ocupada por peças (0 a 1). */
  usage: number;
}

export interface CutPlan {
  settings: CutSettings;
  sheets: Sheet[];
  /** Peças que não cabem numa chapa inteira. */
  tooBig: Piece[];
  /** Códigos por tipo de peça, para a legenda. */
  legend: { code: string; name: string; length: number; width: number; material: string; quantity: number }[];
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Transforma as peças do móvel em peças a cortar, com um código por tipo (A, B, C...). */
export function piecesFromPanels(panels: Panel[]): { pieces: Piece[]; legend: CutPlan['legend'] } {
  const codes = new Map<string, string>();
  const legend: CutPlan['legend'] = [];
  const pieces: Piece[] = [];
  for (const p of panels) {
    const key = [p.name, p.length, p.width, p.material].join('|');
    let code = codes.get(key);
    if (!code) {
      code = codeFor(codes.size);
      codes.set(key, code);
      legend.push({ code, name: p.name, length: p.length, width: p.width, material: p.material, quantity: 0 });
    }
    legend.find((l) => l.code === code)!.quantity++;
    pieces.push({ code, name: p.name, length: p.length, width: p.width, material: p.material, thickness: p.thickness });
  }
  return { pieces, legend };
}

function codeFor(i: number): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return i < 26 ? letters[i] : letters[Math.floor(i / 26) - 1] + letters[i % 26];
}

type Sorter = (a: Piece, b: Piece) => number;
const SORTS: Sorter[] = [
  (a, b) => b.length * b.width - a.length * a.width,
  (a, b) => b.length - a.length || b.width - a.width,
  (a, b) => b.width - a.width || b.length - a.length,
  (a, b) => Math.max(b.length, b.width) - Math.max(a.length, a.width),
];
type Split = 'curto' | 'longo';

/** Plano de corte em guilhotina (cortes de ponta a ponta, como na seccionadora). */
export function planCuts(panels: Panel[], settings: CutSettings): CutPlan {
  const { pieces, legend } = piecesFromPanels(panels);
  const byMaterial = new Map<string, Piece[]>();
  for (const p of pieces) byMaterial.set(p.material, [...(byMaterial.get(p.material) ?? []), p]);

  const usableL = settings.sheetLength - 2 * settings.trim;
  const usableW = settings.sheetWidth - 2 * settings.trim;
  const sheets: Sheet[] = [];
  const tooBig: Piece[] = [];

  for (const [material, list] of byMaterial) {
    const fits = (p: Piece) =>
      (p.length <= usableL && p.width <= usableW) ||
      (!settings.grain && p.width <= usableL && p.length <= usableW);
    tooBig.push(...list.filter((p) => !fits(p)));
    const ok = list.filter(fits);
    if (!ok.length) continue;

    let best: Sheet[] | null = null;
    for (const sort of SORTS)
      for (const split of ['curto', 'longo'] as Split[]) {
        const attempt = pack([...ok].sort(sort), usableL, usableW, settings, split, material);
        if (!best || better(attempt, best)) best = attempt;
      }
    sheets.push(...best!);
  }

  return { settings, sheets, tooBig, legend };
}

function better(a: Sheet[], b: Sheet[]): boolean {
  if (a.length !== b.length) return a.length < b.length;
  // Mesmo número de chapas: prefere sobra maior e inteira na última chapa.
  return a[a.length - 1].usage < b[b.length - 1].usage;
}

function pack(
  pieces: Piece[],
  usableL: number,
  usableW: number,
  s: CutSettings,
  split: Split,
  material: string,
): Sheet[] {
  const sheets: { free: Rect[]; placements: Placement[] }[] = [];
  const area = s.sheetLength * s.sheetWidth;

  for (const piece of pieces) {
    let placed = false;
    for (const sheet of sheets) {
      if (place(sheet, piece, s, split)) {
        placed = true;
        break;
      }
    }
    if (!placed) {
      const sheet = { free: [{ x: s.trim, y: s.trim, w: usableL, h: usableW }], placements: [] as Placement[] };
      sheets.push(sheet);
      place(sheet, piece, s, split);
    }
  }

  return sheets.map((sh) => ({
    material,
    thickness: pieces[0].thickness,
    placements: sh.placements,
    usage: sh.placements.reduce((t, p) => t + p.w * p.h, 0) / area,
  }));
}

function place(
  sheet: { free: Rect[]; placements: Placement[] },
  piece: Piece,
  s: CutSettings,
  split: Split,
): boolean {
  const options: { w: number; h: number; rotated: boolean }[] = [{ w: piece.length, h: piece.width, rotated: false }];
  if (!s.grain && piece.length !== piece.width) options.push({ w: piece.width, h: piece.length, rotated: true });

  // Melhor encaixe pelo lado mais curto que sobra.
  let bestScore = Infinity;
  let choice: { ri: number; w: number; h: number; rotated: boolean } | null = null;
  sheet.free.forEach((r, ri) => {
    for (const o of options) {
      if (o.w > r.w || o.h > r.h) continue;
      const score = Math.min(r.w - o.w, r.h - o.h);
      if (score < bestScore) {
        bestScore = score;
        choice = { ri, ...o };
      }
    }
  });
  if (!choice) return false;
  const { ri, w, h, rotated } = choice as { ri: number; w: number; h: number; rotated: boolean };
  const r = sheet.free[ri];
  sheet.placements.push({ piece, x: r.x, y: r.y, w, h, rotated });

  const restW = r.w - w - s.kerf; // sobra à direita
  const restH = r.h - h - s.kerf; // sobra acima
  // Corte de guilhotina: escolhe se o primeiro corte é no comprimento ou na largura.
  const horizontalFirst = split === 'curto' ? restW < restH : restW >= restH;
  const right: Rect = { x: r.x + w + s.kerf, y: r.y, w: restW, h: horizontalFirst ? h : r.h };
  const top: Rect = { x: r.x, y: r.y + h + s.kerf, w: horizontalFirst ? r.w : w, h: restH };
  sheet.free.splice(ri, 1);
  for (const f of [right, top]) if (f.w > 0 && f.h > 0) sheet.free.push(f);
  return true;
}

export function sheetsByMaterial(plan: CutPlan): { material: string; count: number; usage: number }[] {
  const m = new Map<string, { count: number; used: number }>();
  for (const s of plan.sheets) {
    const e = m.get(s.material) ?? { count: 0, used: 0 };
    e.count++;
    e.used += s.usage;
    m.set(s.material, e);
  }
  return [...m].map(([material, e]) => ({ material, count: e.count, usage: e.used / e.count }));
}

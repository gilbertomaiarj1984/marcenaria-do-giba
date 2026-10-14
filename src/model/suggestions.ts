import { buildShelf, columnWidth, rowHeight, slideLengthFor } from './build';
import { resizeRegions } from './regions';
import type { Panel, ShelfConfig, Suggestion } from './types';

/** Capa de LP: 315 x 315 mm. Com folga para tirar e guardar o disco. */
export const LP_MIN = 325;
/** Medida confortável de nicho para LP. */
export const LP_IDEAL = 340;

/**
 * Vão livre máximo recomendado para prateleira de MDF cheia de discos
 * (cerca de 18 kg a cada 30 cm). Valores conservadores, aproximados.
 */
export const MAX_SPAN: Record<number, number> = { 15: 500, 18: 700, 25: 900 };

export function maxSpanFor(thickness: number): number {
  const keys = Object.keys(MAX_SPAN).map(Number).sort((a, b) => a - b);
  let span = MAX_SPAN[keys[0]];
  for (const k of keys) if (thickness >= k) span = MAX_SPAN[k];
  return span;
}

/** Quantas colunas cabem em uma largura mantendo nichos perto do ideal para LP. */
export function idealColumns(c: ShelfConfig): number {
  const wi = c.width - 2 * c.thickness;
  return Math.max(1, Math.floor((wi + c.thickness) / (LP_IDEAL + c.thickness)));
}

export function idealRows(c: ShelfConfig): number {
  const hi = c.height - c.plinthHeight - 2 * c.thickness;
  return Math.max(1, Math.floor((hi + c.thickness) / (LP_IDEAL + c.thickness)));
}

const mm = (n: number) => `${Math.round(n)} mm`;

export function suggest(c: ShelfConfig): Suggestion[] {
  const out: Suggestion[] = [];
  const colW = columnWidth(c);
  const rowH = rowHeight(c);
  const dc = c.depth - c.backThickness;
  const types = c.regions.map((r) => r.type);
  const built = buildShelf(c);

  if (colW <= 0 || rowH <= 0) {
    out.push({ level: 'erro', message: 'As medidas não comportam tantas colunas ou linhas.' });
    return out;
  }

  const hasNiche = types.includes('nicho');
  const niches = built.regions.filter((b) => b.region.type === 'nicho');
  if (niches.some((b) => b.w < LP_MIN || b.h < LP_MIN)) {
    const cols = idealColumns(c);
    const rows = idealRows(c);
    out.push({
      level: 'aviso',
      message: `Há nichos de ${mm(colW)} x ${mm(rowH)}. Para LP o mínimo é ${LP_MIN} mm em cada lado.`,
      fix:
        cols !== c.columns || rows !== c.rows
          ? {
              label: `Usar ${cols} colunas x ${rows} linhas`,
              apply: (x) => ({ ...x, columns: cols, rows, regions: resizeRegions(x.regions, cols, rows) }),
            }
          : undefined,
    });
  }
  if (hasNiche && dc < LP_MIN) {
    out.push({
      level: 'aviso',
      message: `A profundidade interna é ${mm(dc)}. O LP precisa de pelo menos ${LP_MIN} mm.`,
      fix: { label: 'Usar 350 mm', apply: (x) => ({ ...x, depth: 350 + x.backThickness }) },
    });
  }

  const wide = niches.filter((b) => b.w > LP_IDEAL + 120 && b.h >= LP_MIN);
  if (wide.length) {
    const w = Math.max(...wide.map((b) => b.w));
    out.push({
      level: 'dica',
      message: `Nichos de ${mm(w)} de largura deixam os discos tombarem. Use um aparador de livros ou recoloque a divisória.`,
    });
  }

  const span = maxSpanFor(c.thickness);
  const free = freeSpan(built.panels, c.thickness);
  if (free > span) {
    const thicker = [18, 25].find((t) => t > c.thickness && maxSpanFor(t) >= free);
    out.push({
      level: 'aviso',
      message: `Há prateleira com ${mm(free)} sem apoio em chapa de ${c.thickness} mm. Pode empenar com o peso dos discos (recomendado até ${mm(span)}).`,
      fix: thicker
        ? { label: `Usar chapa de ${thicker} mm`, apply: (x) => ({ ...x, thickness: thicker }) }
        : undefined,
    });
  }

  if (types.includes('gaveta')) {
    if (!slideLengthFor(dc)) {
      out.push({ level: 'erro', message: 'Profundidade insuficiente para corrediça (mínimo 260 mm interno).' });
    }
    const low = built.regions.filter((b) => b.region.type === 'gaveta' && b.h / b.region.drawers < 100);
    if (low.length) {
      out.push({
        level: 'erro',
        message: 'Há gavetas com menos de 100 mm de altura. Diminua a quantidade de gavetas ou junte com o nicho de cima.',
      });
    }
  }

  if (types.includes('porta') && c.hinge !== 'curva') {
    out.push({
      level: 'dica',
      message:
        'As portas cobrem metade da espessura da chapa (meia sobreposição). Para isso a dobradiça indicada é a curva.',
      fix: { label: 'Usar dobradiça curva', apply: (x) => ({ ...x, hinge: 'curva' }) },
    });
  }

  if (c.height > 1600) {
    out.push({
      level: 'dica',
      message: 'Estante com mais de 1,6 m cheia de discos deve ser fixada na parede com cantoneira.',
    });
  }

  if (c.thickness === 15 && c.height > 1200) {
    out.push({
      level: 'dica',
      message: 'Para estante alta de discos, chapa de 18 mm dá mais rigidez ao corpo.',
      fix: { label: 'Usar chapa de 18 mm', apply: (x) => ({ ...x, thickness: 18 }) },
    });
  }

  return out;
}

/**
 * Maior trecho de prateleira sem divisória ou lateral embaixo apoiando.
 * Divisória que começa em cima da prateleira não apoia: ela pesa sobre a prateleira.
 */
export function freeSpan(panels: Panel[], thickness: number): number {
  const supports = panels.filter((p) => p.kind === 'divisoria' || p.kind === 'lateral');
  let max = 0;
  for (const s of panels.filter((p) => p.kind === 'prateleira')) {
    const touching = supports
      .filter((d) => d.y < s.y - 0.5 && d.y + d.sy >= s.y - 0.5)
      .filter((d) => d.x + d.sx > s.x - 0.5 && d.x < s.x + s.sx + 0.5)
      .map((d) => [d.x, d.x + d.sx] as const)
      .sort((a, b) => a[0] - b[0]);
    const edges = [[s.x - thickness, s.x] as const, ...touching, [s.x + s.sx, s.x + s.sx + thickness] as const];
    for (let i = 1; i < edges.length; i++) max = Math.max(max, edges[i][0] - edges[i - 1][1]);
  }
  return Math.round(max);
}

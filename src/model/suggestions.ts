import { columnWidth, resizeCells, rowHeight, slideLengthFor } from './build';
import type { ShelfConfig, Suggestion } from './types';

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
  const types = c.cells.flat();

  if (colW <= 0 || rowH <= 0) {
    out.push({ level: 'erro', message: 'As medidas não comportam tantas colunas ou linhas.' });
    return out;
  }

  const hasNiche = types.includes('nicho');
  if (hasNiche && (colW < LP_MIN || rowH < LP_MIN)) {
    const cols = idealColumns(c);
    const rows = idealRows(c);
    out.push({
      level: 'aviso',
      message: `Os nichos têm ${mm(colW)} x ${mm(rowH)}. Para LP o mínimo é ${LP_MIN} mm em cada lado.`,
      fix:
        cols !== c.columns || rows !== c.rows
          ? {
              label: `Usar ${cols} colunas x ${rows} linhas`,
              apply: (x) => ({ ...x, columns: cols, rows, cells: resizeCells(x.cells, cols, rows) }),
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

  if (hasNiche && colW > LP_IDEAL + 120 && rowH >= LP_MIN) {
    const cols = idealColumns(c);
    out.push({
      level: 'dica',
      message: `Nichos de ${mm(colW)} de largura deixam os discos tombarem. Mais colunas seguram melhor.`,
      fix: {
        label: `Usar ${cols} colunas`,
        apply: (x) => ({ ...x, columns: cols, cells: resizeCells(x.cells, cols, x.rows) }),
      },
    });
  }

  const span = maxSpanFor(c.thickness);
  if (colW > span) {
    const thicker = [18, 25].find((t) => t > c.thickness && maxSpanFor(t) >= colW);
    out.push({
      level: 'aviso',
      message: `Prateleiras de ${mm(colW)} em chapa de ${c.thickness} mm podem empenar com o peso dos discos (recomendado até ${mm(span)}).`,
      fix: thicker
        ? { label: `Usar chapa de ${thicker} mm`, apply: (x) => ({ ...x, thickness: thicker }) }
        : undefined,
    });
  }

  if (types.includes('gaveta')) {
    if (!slideLengthFor(dc)) {
      out.push({ level: 'erro', message: 'Profundidade insuficiente para corrediça (mínimo 260 mm interno).' });
    }
    if (rowH < 100) {
      out.push({ level: 'erro', message: `Vão de ${mm(rowH)} é baixo demais para gaveta (mínimo 100 mm).` });
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

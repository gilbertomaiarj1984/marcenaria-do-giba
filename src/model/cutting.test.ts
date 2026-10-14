import { describe, expect, it } from 'vitest';
import { buildShelf, defaultConfig } from './build';
import { DEFAULT_CUT, planCuts, sheetsByMaterial, type Placement } from './cutting';
import type { Panel } from './types';

const panel = (length: number, width: number, material = 'MDF 18mm'): Panel => ({
  id: `${length}x${width}-${Math.random()}`,
  kind: 'prateleira',
  name: 'Peça',
  x: 0, y: 0, z: 0, sx: length, sy: 18, sz: width,
  length, width, thickness: 18, material,
});

const overlaps = (a: Placement, b: Placement, kerf: number) =>
  a.x < b.x + b.w + kerf - 0.01 && b.x < a.x + a.w + kerf - 0.01 && a.y < b.y + b.h + kerf - 0.01 && b.y < a.y + a.h + kerf - 0.01;

describe('planCuts', () => {
  it('põe peças que cabem numa chapa só', () => {
    const plan = planCuts([panel(1000, 500), panel(1000, 500), panel(700, 800)], DEFAULT_CUT);
    expect(plan.sheets).toHaveLength(1);
  });

  it('respeita refilo, serra e não sobrepõe peças', () => {
    const plan = planCuts(buildShelf(defaultConfig()).panels, DEFAULT_CUT);
    const s = DEFAULT_CUT;
    for (const sheet of plan.sheets) {
      for (const p of sheet.placements) {
        expect(p.x).toBeGreaterThanOrEqual(s.trim);
        expect(p.y).toBeGreaterThanOrEqual(s.trim);
        expect(p.x + p.w).toBeLessThanOrEqual(s.sheetLength - s.trim);
        expect(p.y + p.h).toBeLessThanOrEqual(s.sheetWidth - s.trim);
      }
      sheet.placements.forEach((a, i) =>
        sheet.placements.slice(i + 1).forEach((b) => expect(overlaps(a, b, s.kerf)).toBe(false)),
      );
    }
  });

  it('corta todas as peças da estante', () => {
    const panels = buildShelf(defaultConfig()).panels;
    const plan = planCuts(panels, DEFAULT_CUT);
    expect(plan.sheets.reduce((n, s) => n + s.placements.length, 0)).toBe(panels.length);
    expect(plan.tooBig).toEqual([]);
    const summary = sheetsByMaterial(plan);
    expect(summary.find((m) => m.material === 'MDF 18mm')!.count).toBe(2);
    expect(summary.find((m) => m.material === 'HDF 6mm')!.count).toBe(1);
  });

  it('com veio, não gira as peças', () => {
    const plan = planCuts(buildShelf(defaultConfig()).panels, { ...DEFAULT_CUT, grain: true });
    expect(plan.sheets.every((s) => s.placements.every((p) => !p.rotated))).toBe(true);
  });

  it('avisa peça maior que a chapa', () => {
    const plan = planCuts([panel(3000, 400)], DEFAULT_CUT);
    expect(plan.tooBig).toHaveLength(1);
    expect(plan.sheets).toHaveLength(0);
  });
});

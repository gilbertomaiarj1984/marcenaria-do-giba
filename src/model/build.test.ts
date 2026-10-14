import { describe, expect, it } from 'vitest';
import { buildShelf, defaultConfig, hingesForDoor, partsList } from './build';
import { gridRegions, mergeRegion, regionAt, resizeRegions, splitRegion } from './regions';
import { freeSpan, suggest } from './suggestions';
import type { ShelfConfig } from './types';

const plain = (over: Partial<ShelfConfig> = {}): ShelfConfig => {
  const base = { ...defaultConfig(), ...over };
  return { ...base, regions: over.regions ?? gridRegions(base.columns, base.rows) };
};

describe('buildShelf', () => {
  it('gera nichos de 345 mm na estante padrão', () => {
    const r = buildShelf(defaultConfig());
    expect(r.columnWidth).toBeCloseTo(345);
    expect(r.rowHeight).toBeCloseTo(345);
  });

  it('gera o corpo com as medidas certas', () => {
    const parts = partsList(buildShelf(plain()).panels);
    const find = (name: string) => parts.find((p) => p.name === name)!;
    expect(find('Lateral')).toMatchObject({ quantity: 2, length: 1550, width: 394 });
    expect(find('Base')).toMatchObject({ quantity: 1, length: 1434, width: 394 });
    expect(find('Divisória')).toMatchObject({ quantity: 3, length: 1434, width: 394 });
    expect(find('Prateleira')).toMatchObject({ quantity: 12, length: 394, width: 345 });
    expect(find('Fundo')).toMatchObject({ quantity: 1, length: 1470, width: 1470, material: 'HDF 6mm' });
    expect(parts.find((p) => p.name === 'Porta')).toBeUndefined();
  });

  it('calcula porta sobreposta e dobradiças', () => {
    const r = buildShelf(defaultConfig());
    const doors = r.panels.filter((p) => p.kind === 'porta');
    expect(doors).toHaveLength(2);
    expect(doors[0].length).toBe(360); // 345 + 18 - 3
    expect(doors[0].width).toBe(360);
    expect(r.hardware.find((h) => h.name.startsWith('Dobradiça'))?.quantity).toBe(4);
  });

  it('abre a porta para o lado de fora do móvel', () => {
    const doors = buildShelf(defaultConfig()).panels.filter((p) => p.kind === 'porta');
    expect(doors[0].motion).toMatchObject({ type: 'hinge', dir: -1, axisX: doors[0].x });
  });

  it('empilha a quantidade de gavetas pedida na área', () => {
    const c = defaultConfig();
    const merged = mergeRegion(c.regions, 2, 'direita', 4, 4).regions;
    const r = buildShelf({ ...c, regions: merged });
    const fronts = r.panels.filter((p) => p.kind === 'frente-gaveta');
    expect(fronts).toHaveLength(2);
    // Área de 2 colunas: 345*2 + 18 = 708 de vão; frente 708 + 18 - 3 = 723
    expect(fronts[0].length).toBe(723);
    expect(fronts[0].width).toBe(178.5); // (360 - 3) / 2
    expect(r.hardware.find((h) => h.name.startsWith('Corrediça'))).toMatchObject({ quantity: 2 });
    expect(r.panels.filter((p) => p.kind === 'gaveta-lateral')).toHaveLength(4);
    const side = r.panels.find((p) => p.kind === 'gaveta-lateral')!;
    expect(side).toMatchObject({ length: 350, width: 132.5 }); // 345/2 - 40
  });

  it('muda as peças quando a espessura muda', () => {
    const r = buildShelf({ ...defaultConfig(), thickness: 25 });
    expect(r.panels.find((p) => p.kind === 'base')!.length).toBe(1420);
    expect(r.panels.every((p) => p.thickness === 25 || p.thickness === 6)).toBe(true);
  });
});

describe('tirar divisória e prateleira', () => {
  it('sem a divisória entre dois nichos, a prateleira passa direto', () => {
    const c = plain();
    const { regions } = mergeRegion(c.regions, regionAt(c.regions, 0, 3), 'direita', 4, 4);
    const r = buildShelf({ ...c, regions });
    const dividers = r.panels.filter((p) => p.kind === 'divisoria' && Math.abs(p.x - 363) < 1);
    // A primeira divisória fica com 3 nichos de altura (2 prateleiras atravessadas), não 4.
    expect(dividers).toHaveLength(1);
    expect(dividers[0].sy).toBe(345 * 3 + 18 * 2);
    // A prateleira de baixo da área nova vai de uma coluna à outra passando sobre a divisória.
    const shelf = r.panels.find((p) => p.kind === 'prateleira' && p.y === dividers[0].y + dividers[0].sy)!;
    expect(shelf.sx).toBe(345 * 2 + 18);
  });

  it('sem a prateleira, a área fica com dois nichos de altura', () => {
    const c = plain();
    const { regions, index } = mergeRegion(c.regions, regionAt(c.regions, 1, 1), 'cima', 4, 4);
    expect(regions[index]).toMatchObject({ col: 1, row: 1, colSpan: 1, rowSpan: 2 });
    const r = buildShelf({ ...c, regions });
    expect(r.panels.filter((p) => p.kind === 'prateleira')).toHaveLength(11);
  });

  it('cresce até formar um retângulo', () => {
    let regions = gridRegions(3, 3);
    regions = mergeRegion(regions, regionAt(regions, 1, 0), 'cima', 3, 3).regions; // coluna 1, linhas 0-1
    const res = mergeRegion(regions, regionAt(regions, 0, 1), 'direita', 3, 3);
    expect(res.regions[res.index]).toMatchObject({ col: 0, row: 0, colSpan: 2, rowSpan: 2 });
  });

  it('recoloca as divisórias', () => {
    const c = plain();
    const m = mergeRegion(c.regions, 0, 'direita', 4, 4);
    expect(splitRegion(m.regions, m.index)).toHaveLength(16);
  });

  it('mantém as áreas que cabem ao mudar a grade', () => {
    const c = defaultConfig();
    const regions = mergeRegion(c.regions, 2, 'direita', 4, 4).regions;
    expect(resizeRegions(regions, 3, 4).find((r) => r.type === 'gaveta')).toBeUndefined();
    expect(resizeRegions(regions, 5, 4).find((r) => r.type === 'gaveta')).toMatchObject({ colSpan: 2 });
  });
});

describe('hingesForDoor', () => {
  it('aumenta com a altura', () => {
    expect(hingesForDoor(700)).toBe(2);
    expect(hingesForDoor(1200)).toBe(3);
    expect(hingesForDoor(1900)).toBe(4);
  });
});

describe('suggest', () => {
  it('não reclama da estante padrão', () => {
    expect(suggest(defaultConfig()).filter((s) => s.level !== 'dica')).toEqual([]);
  });

  it('avisa nicho pequeno para LP e sugere menos colunas', () => {
    const c = plain({ columns: 5 });
    const s = suggest(c).find((x) => x.message.includes('LP'))!;
    expect(s.level).toBe('aviso');
    expect(s.fix!.apply(c).columns).toBe(4);
  });

  it('avisa prateleira sem apoio quando a divisória sai', () => {
    const c = plain();
    const { regions } = mergeRegion(c.regions, regionAt(c.regions, 1, 2), 'direita', 4, 4);
    const cfg = { ...c, regions };
    expect(freeSpan(buildShelf(cfg).panels, 18)).toBe(345 * 2 + 18);
    const s = suggest(cfg).find((x) => x.message.includes('empenar'));
    expect(s?.fix?.apply(cfg).thickness).toBe(25);
  });

  it('avisa gaveta baixa demais', () => {
    const c = defaultConfig();
    const regions = c.regions.map((r) => (r.type === 'gaveta' ? { ...r, drawers: 4 } : r));
    expect(suggest({ ...c, regions }).some((s) => s.level === 'erro')).toBe(true);
  });
});

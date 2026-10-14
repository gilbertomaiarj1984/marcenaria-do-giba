import { describe, expect, it } from 'vitest';
import { buildShelf, defaultConfig, hingesForDoor, partsList, resizeCells } from './build';
import { suggest } from './suggestions';

describe('buildShelf', () => {
  it('gera nichos de 345 mm na estante padrão', () => {
    const r = buildShelf(defaultConfig());
    expect(r.columnWidth).toBeCloseTo(345);
    expect(r.rowHeight).toBeCloseTo(345);
  });

  it('gera o corpo com as medidas certas', () => {
    const c = { ...defaultConfig(), cells: resizeCells([], 4, 4) };
    const parts = partsList(buildShelf(c).panels);
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

  it('dimensiona a gaveta para a corrediça', () => {
    const r = buildShelf(defaultConfig());
    expect(r.hardware.find((h) => h.name.startsWith('Corrediça'))?.name).toContain('350mm');
    const sides = r.panels.filter((p) => p.kind === 'gaveta-lateral');
    expect(sides).toHaveLength(4);
    expect(sides[0]).toMatchObject({ length: 350, width: 305 });
    const inner = r.panels.find((p) => p.kind === 'gaveta-frente-traseira')!;
    expect(inner.length).toBe(305);
    expect(inner.width).toBe(284); // 345 - 25 - 36
  });

  it('muda as peças quando a espessura muda', () => {
    const r = buildShelf({ ...defaultConfig(), thickness: 25 });
    expect(r.panels.find((p) => p.kind === 'base')!.length).toBe(1420);
    expect(r.panels.every((p) => p.thickness === 25 || p.thickness === 6)).toBe(true);
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
    const c = { ...defaultConfig(), columns: 5, cells: resizeCells([], 5, 4) };
    const s = suggest(c).find((x) => x.message.includes('LP'))!;
    expect(s.level).toBe('aviso');
    expect(s.fix!.apply(c).columns).toBe(4);
  });

  it('avisa prateleira longa demais para a espessura', () => {
    const c = { ...defaultConfig(), width: 1600, columns: 2, cells: resizeCells([], 2, 4) };
    const s = suggest(c).find((x) => x.message.includes('empenar'));
    expect(s).toBeDefined();
    expect(s!.fix!.apply(c).thickness).toBe(25);
  });
});

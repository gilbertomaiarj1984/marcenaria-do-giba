// Todas as medidas em milímetros.

export type CellType = 'nicho' | 'porta' | 'gaveta';

export type HingeType = 'reta' | 'curva' | 'supercurva';

export interface ShelfConfig {
  width: number; // largura total
  height: number; // altura total
  depth: number; // profundidade total, incluindo o fundo
  thickness: number; // espessura da chapa do corpo (MDF)
  backThickness: number; // espessura do fundo (HDF)
  plinthHeight: number; // altura do rodapé (0 = sem rodapé)
  columns: number;
  rows: number;
  /** cells[coluna][linha], linha 0 = embaixo */
  cells: CellType[][];
  hinge: HingeType;
}

export type PartKind =
  | 'lateral'
  | 'base'
  | 'tampo'
  | 'divisoria'
  | 'prateleira'
  | 'rodape'
  | 'fundo'
  | 'porta'
  | 'frente-gaveta'
  | 'gaveta-lateral'
  | 'gaveta-frente-traseira'
  | 'gaveta-fundo';

/** Uma peça posicionada no espaço (canto mínimo + tamanho) e com a medida de corte. */
export interface Panel {
  id: string;
  kind: PartKind;
  name: string;
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  /** Medidas de corte: comprimento >= largura */
  length: number;
  width: number;
  thickness: number;
  material: string;
  cell?: { col: number; row: number };
}

export interface Hardware {
  name: string;
  quantity: number;
  detail?: string;
}

export interface CellBox {
  col: number;
  row: number;
  x: number;
  y: number;
  w: number;
  h: number;
  type: CellType;
}

export interface BuildResult {
  panels: Panel[];
  hardware: Hardware[];
  cells: CellBox[];
  interiorDepth: number;
  columnWidth: number;
  rowHeight: number;
}

export interface PartLine {
  name: string;
  quantity: number;
  length: number;
  width: number;
  thickness: number;
  material: string;
}

export type SuggestionLevel = 'erro' | 'aviso' | 'dica';

export interface Suggestion {
  level: SuggestionLevel;
  message: string;
  fix?: { label: string; apply: (c: ShelfConfig) => ShelfConfig };
}

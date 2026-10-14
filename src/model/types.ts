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
  /** Áreas retangulares que cobrem a grade. Linha 0 = embaixo. */
  regions: Region[];
  hinge: HingeType;
}

/** Uma área da estante: um nicho ou vários nichos juntos, sem divisória entre eles. */
export interface Region {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  type: CellType;
  /** Quantidade de gavetas empilhadas, quando type = 'gaveta'. */
  drawers: number;
  /** Lado da dobradiça, quando type = 'porta'. 'auto' escolhe pelo tamanho e posição. */
  side?: DoorSide;
  /**
   * Porta sobre vários nichos mantendo as divisórias e prateleiras por dentro.
   * Só vale quando type = 'porta'.
   */
  keepInside?: boolean;
}

export type DoorSide = 'auto' | 'esquerda' | 'direita' | 'dupla';

/** Como a peça se move quando o móvel é mostrado aberto. */
export type Motion =
  | { type: 'hinge'; axisX: number; axisZ: number; dir: 1 | -1 }
  | { type: 'slide'; distance: number };

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
  region?: number;
  motion?: Motion;
}

export interface Hardware {
  name: string;
  quantity: number;
  detail?: string;
}

export interface RegionBox {
  index: number;
  region: Region;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BuildResult {
  panels: Panel[];
  hardware: Hardware[];
  regions: RegionBox[];
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

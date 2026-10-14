import { useEffect, useMemo, useState } from 'react';
import { Viewer } from './components/Viewer';
import { NumberField } from './components/NumberField';
import { buildShelf, defaultConfig, partsList, resizeCells, SHEET_THICKNESSES } from './model/build';
import { suggest } from './model/suggestions';
import type { CellType, HingeType, ShelfConfig } from './model/types';

const STORAGE_KEY = 'marcenaria-do-giba:estante';
const CYCLE: CellType[] = ['nicho', 'porta', 'gaveta'];
const CELL_LABEL: Record<CellType, string> = { nicho: 'Nicho', porta: 'Porta', gaveta: 'Gaveta' };

function loadConfig(): ShelfConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultConfig(), ...JSON.parse(raw) };
  } catch {
    // sem armazenamento: começa do padrão
  }
  return defaultConfig();
}

export default function App() {
  const [config, setConfig] = useState<ShelfConfig>(loadConfig);
  const [showFronts, setShowFronts] = useState(true);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // ignora
    }
  }, [config]);

  const result = useMemo(() => buildShelf(config), [config]);
  const parts = useMemo(() => partsList(result.panels), [result]);
  const suggestions = useMemo(() => suggest(config), [config]);

  const set = <K extends keyof ShelfConfig>(key: K, value: ShelfConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));

  const setGrid = (columns: number, rows: number) =>
    setConfig((c) => ({ ...c, columns, rows, cells: resizeCells(c.cells, columns, rows) }));

  const cycleCell = (col: number, row: number) => {
    setConfig((c) => {
      const cells = c.cells.map((column) => [...column]);
      const cur = cells[col][row];
      cells[col][row] = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length];
      return { ...c, cells };
    });
  };

  const fillAll = (type: CellType) =>
    setConfig((c) => ({ ...c, cells: c.cells.map((col) => col.map(() => type)) }));

  return (
    <div className="app">
      <aside className="sidebar">
        <header>
          <h1>Marcenaria do Giba</h1>
          <p className="muted">Estante para discos de vinil</p>
        </header>

        <section>
          <h2>Medidas (mm)</h2>
          <div className="grid2">
            <NumberField label="Largura" value={config.width} min={300} max={3000} onChange={(v) => set('width', v)} />
            <NumberField label="Altura" value={config.height} min={300} max={2700} onChange={(v) => set('height', v)} />
            <NumberField label="Profundidade" value={config.depth} min={200} max={800} onChange={(v) => set('depth', v)} />
            <NumberField label="Rodapé" value={config.plinthHeight} min={0} max={200} onChange={(v) => set('plinthHeight', v)} />
          </div>
        </section>

        <section>
          <h2>Chapa</h2>
          <div className="segmented" role="radiogroup" aria-label="Espessura da chapa">
            {SHEET_THICKNESSES.map((t) => (
              <button
                key={t}
                role="radio"
                aria-checked={config.thickness === t}
                className={config.thickness === t ? 'on' : ''}
                onClick={() => set('thickness', t)}
              >
                {t} mm
              </button>
            ))}
          </div>
          <p className="muted small">Corpo, portas e gavetas em MDF. Fundo em HDF de {config.backThickness} mm.</p>
        </section>

        <section>
          <h2>Divisões</h2>
          <div className="grid2">
            <NumberField label="Colunas" value={config.columns} min={1} max={10} onChange={(v) => setGrid(v, config.rows)} />
            <NumberField label="Linhas" value={config.rows} min={1} max={10} onChange={(v) => setGrid(config.columns, v)} />
          </div>
          <p className="muted small">
            Vão livre de cada nicho: {Math.round(result.columnWidth)} x {Math.round(result.rowHeight)} mm,
            profundidade {Math.round(result.interiorDepth)} mm.
          </p>
        </section>

        <section>
          <h2>Vãos</h2>
          <p className="muted small">Clique num vão (aqui ou no desenho) para trocar entre nicho, porta e gaveta.</p>
          <div className="cells" style={{ gridTemplateColumns: `repeat(${config.columns}, 1fr)` }}>
            {Array.from({ length: config.rows }, (_, i) => config.rows - 1 - i).map((row) =>
              Array.from({ length: config.columns }, (_, col) => {
                const type = config.cells[col][row];
                return (
                  <button
                    key={`${col}-${row}`}
                    className={`cell cell-${type}`}
                    onClick={() => cycleCell(col, row)}
                    title={`Coluna ${col + 1}, linha ${row + 1}`}
                  >
                    {CELL_LABEL[type]}
                  </button>
                );
              }),
            )}
          </div>
          <div className="row">
            {CYCLE.map((t) => (
              <button key={t} className="link" onClick={() => fillAll(t)}>
                Tudo {CELL_LABEL[t].toLowerCase()}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2>Ferragens</h2>
          <label className="field">
            <span>Dobradiça das portas</span>
            <select value={config.hinge} onChange={(e) => set('hinge', e.target.value as HingeType)}>
              <option value="reta">Caneco 35mm reta (sobreposição total)</option>
              <option value="curva">Caneco 35mm curva (meia sobreposição)</option>
              <option value="supercurva">Caneco 35mm supercurva (porta embutida)</option>
            </select>
          </label>
          <p className="muted small">Gavetas com corrediça telescópica, medida escolhida pela profundidade.</p>
          <ul className="hardware">
            {result.hardware.map((h) => (
              <li key={h.name}>
                <strong>{h.quantity}x</strong> {h.name}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2>Sugestões</h2>
          {suggestions.length === 0 ? (
            <p className="muted small">Tudo certo com o projeto.</p>
          ) : (
            <ul className="suggestions">
              {suggestions.map((s) => (
                <li key={s.message} className={`sug sug-${s.level}`}>
                  <span>{s.message}</span>
                  {s.fix && (
                    <button onClick={() => setConfig((c) => s.fix!.apply(c))}>{s.fix.label}</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2>Lista de peças</h2>
          <table className="parts">
            <thead>
              <tr>
                <th>Qtd</th>
                <th>Peça</th>
                <th>Medida (mm)</th>
                <th>Chapa</th>
              </tr>
            </thead>
            <tbody>
              {parts.map((p) => (
                <tr key={`${p.name}-${p.length}-${p.width}-${p.material}`}>
                  <td>{p.quantity}</td>
                  <td>{p.name}</td>
                  <td>
                    {p.length} x {p.width}
                  </td>
                  <td>{p.material}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">O plano de corte das chapas vem no próximo passo.</p>
        </section>

        <button className="link" onClick={() => setConfig(defaultConfig())}>
          Voltar ao modelo padrão
        </button>
      </aside>

      <main className="stage">
        <div className="toolbar">
          <label>
            <input type="checkbox" checked={showFronts} onChange={(e) => setShowFronts(e.target.checked)} /> Mostrar portas e
            frentes
          </label>
          <span className="muted small">Arraste para girar, role para aproximar.</span>
        </div>
        <Viewer
          config={config}
          result={result}
          showFronts={showFronts}
          onCellClick={cycleCell}
        />
      </main>
    </div>
  );
}

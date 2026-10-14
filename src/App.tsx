import { useEffect, useMemo, useState } from 'react';
import { Viewer } from './components/Viewer';
import { NumberField } from './components/NumberField';
import { buildShelf, defaultConfig, MAX_DOOR_WIDTH, partsList, SHEET_THICKNESSES } from './model/build';
import { measureSelection } from './model/measures';
import { doorOverSelection, mergeRegion, mergeSelection, resizeRegions, splitRegion, type Direction } from './model/regions';
import { suggest } from './model/suggestions';
import type { CellType, DoorSide, HingeType, Region, ShelfConfig } from './model/types';

const STORAGE_KEY = 'marcenaria-do-giba:estante';
const CYCLE: CellType[] = ['nicho', 'porta', 'gaveta'];
const CELL_LABEL: Record<CellType, string> = { nicho: 'Nicho', porta: 'Porta', gaveta: 'Gaveta' };
const SIDE_LABEL: Record<DoorSide, string> = { auto: '', esquerda: '◧', direita: '◨', dupla: 'dupla' };

function loadConfig(): ShelfConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) : null;
    if (saved && Array.isArray(saved.regions)) return { ...defaultConfig(), ...saved };
  } catch {
    // sem armazenamento: começa do padrão
  }
  return defaultConfig();
}

export default function App() {
  const [config, setConfig] = useState<ShelfConfig>(loadConfig);
  const [showFronts, setShowFronts] = useState(true);
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<number[]>([]);
  const [multi, setMulti] = useState(false);
  const [measures, setMeasures] = useState({ external: true, internal: false, selection: true });
  const selected = selection.length === 1 ? selection[0] : null;
  const setSelected = (i: number | null) => setSelection(i === null ? [] : [i]);

  const pick = (i: number, additive: boolean) =>
    setSelection((cur) => {
      if (additive || multi) return cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i];
      return cur.length === 1 && cur[0] === i ? [] : [i];
    });

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

  const setGrid = (columns: number, rows: number) => {
    setSelected(null);
    setConfig((c) => ({ ...c, columns, rows, regions: resizeRegions(c.regions, columns, rows) }));
  };

  const updateRegion = (patch: Partial<Region>) =>
    setConfig((c) => ({
      ...c,
      regions: c.regions.map((r, i) => (selection.includes(i) ? { ...r, ...patch } : r)),
    }));

  const mergeSelected = (keepInside = false) => {
    const res = keepInside ? doorOverSelection(config.regions, selection) : mergeSelection(config.regions, selection);
    setConfig({ ...config, regions: res.regions });
    setSelected(res.index);
    setMulti(false);
  };

  const merge = (dir: Direction) => {
    if (selected === null) return;
    const res = mergeRegion(config.regions, selected, dir, config.columns, config.rows);
    setConfig({ ...config, regions: res.regions });
    setSelected(res.index);
  };

  const split = () => {
    if (selected === null) return;
    setConfig({ ...config, regions: splitRegion(config.regions, selected) });
    setSelected(null);
  };

  const fillAll = (type: CellType) =>
    setConfig((c) => ({ ...c, regions: c.regions.map((r) => ({ ...r, type })) }));

  const measure = useMemo(() => measureSelection(result, config.thickness, selection), [result, config.thickness, selection]);
  const sel = selected !== null ? config.regions[selected] : null;
  const selBox = selected !== null ? result.regions[selected] : null;
  const canMerge = (dir: Direction) => {
    if (!sel) return false;
    if (dir === 'esquerda') return sel.col > 0;
    if (dir === 'direita') return sel.col + sel.colSpan < config.columns;
    if (dir === 'baixo') return sel.row > 0;
    return sel.row + sel.rowSpan < config.rows;
  };

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
          <p className="muted small">
            Clique num vão, aqui ou no desenho, para escolher o que ele vai ser. Para medir ou juntar vários, segure Shift
            ou ligue "Selecionar vários".
          </p>
          <label className="check small">
            <input
              type="checkbox"
              checked={multi}
              onChange={(e) => {
                setMulti(e.target.checked);
                if (!e.target.checked) setSelection((cur) => cur.slice(-1));
              }}
            />{' '}
            Selecionar vários
          </label>
          <div
            className="cells"
            style={{
              gridTemplateColumns: `repeat(${config.columns}, 1fr)`,
              gridTemplateRows: `repeat(${config.rows}, 40px)`,
            }}
          >
            {config.regions.map((r, i) => (
              <button
                key={`${r.col}-${r.row}`}
                className={`cell cell-${r.type}${selection.includes(i) ? ' selected' : ''}`}
                style={{
                  gridColumn: `${r.col + 1} / span ${r.colSpan}`,
                  gridRow: `${config.rows - r.row - r.rowSpan + 1} / span ${r.rowSpan}`,
                }}
                aria-pressed={selection.includes(i)}
                onClick={(e) => pick(i, e.shiftKey || e.ctrlKey || e.metaKey)}
              >
                {CELL_LABEL[r.type]}
                {r.type === 'gaveta' && r.drawers > 1 ? ` x${r.drawers}` : ''}
                {r.type === 'porta' && r.side && r.side !== 'auto' ? ` (${SIDE_LABEL[r.side]})` : ''}
              </button>
            ))}
          </div>

          {sel && selBox ? (
            <div className="editor">
              <p className="small">
                <strong>Vão selecionado:</strong> {Math.round(selBox.w)} x {Math.round(selBox.h)} mm livre,{' '}
                {Math.round(selBox.w + 2 * config.thickness)} x {Math.round(selBox.h + 2 * config.thickness)} mm por fora
              </p>
              <div className="segmented" role="radiogroup" aria-label="Tipo do vão">
                {CYCLE.map((t) => (
                  <button
                    key={t}
                    role="radio"
                    aria-checked={sel.type === t}
                    className={sel.type === t ? 'on' : ''}
                    onClick={() => updateRegion({ type: t })}
                  >
                    {CELL_LABEL[t]}
                  </button>
                ))}
              </div>
              {sel.type === 'gaveta' && (
                <NumberField
                  label="Quantidade de gavetas"
                  value={sel.drawers}
                  min={1}
                  max={6}
                  onChange={(v) => updateRegion({ drawers: v })}
                />
              )}
              {sel.type === 'porta' && (
                <>
                  <label className="field">
                    <span>Lado da dobradiça</span>
                    <select
                      value={sel.side ?? 'auto'}
                      onChange={(e) => updateRegion({ side: e.target.value as DoorSide })}
                    >
                      <option value="auto">
                        Automático ({selBox.w + config.thickness > MAX_DOOR_WIDTH ? 'porta dupla' : 'abre para fora do móvel'})
                      </option>
                      <option value="esquerda">Dobradiça na esquerda</option>
                      <option value="direita">Dobradiça na direita</option>
                      <option value="dupla">Porta dupla, abre do meio</option>
                    </select>
                  </label>
                  {(sel.colSpan > 1 || sel.rowSpan > 1) && (
                    <label className="check small">
                      <input
                        type="checkbox"
                        checked={!!sel.keepInside}
                        onChange={(e) => updateRegion({ keepInside: e.target.checked })}
                      />{' '}
                      Manter divisórias e prateleiras atrás da porta
                    </label>
                  )}
                </>
              )}
              <div className="merge">
                <span className="small">Tirar divisória</span>
                <button disabled={!canMerge('esquerda')} onClick={() => merge('esquerda')}>
                  ← Esquerda
                </button>
                <button disabled={!canMerge('direita')} onClick={() => merge('direita')}>
                  Direita →
                </button>
                <span className="small">Tirar prateleira</span>
                <button disabled={!canMerge('cima')} onClick={() => merge('cima')}>
                  ↑ De cima
                </button>
                <button disabled={!canMerge('baixo')} onClick={() => merge('baixo')}>
                  ↓ De baixo
                </button>
              </div>
              {(sel.colSpan > 1 || sel.rowSpan > 1) && (
                <button className="link" onClick={split}>
                  Recolocar divisórias e prateleiras deste vão
                </button>
              )}
            </div>
          ) : selection.length > 1 && measure ? (
            <div className="editor">
              <p className="small">
                <strong>{selection.length} vãos selecionados</strong>, cobrindo {measure.niches} nichos
              </p>
              <table className="measure small">
                <tbody>
                  <tr>
                    <th></th>
                    <th>Largura</th>
                    <th>Altura</th>
                  </tr>
                  <tr>
                    <td>Vão livre</td>
                    <td>{measure.freeWidth} mm</td>
                    <td>{measure.freeHeight} mm</td>
                  </tr>
                  <tr>
                    <td>Por fora das chapas</td>
                    <td>{measure.outerWidth} mm</td>
                    <td>{measure.outerHeight} mm</td>
                  </tr>
                </tbody>
              </table>
              <p className="muted small">
                Vão livre é de face interna a face interna, do primeiro ao último vão. Profundidade interna{' '}
                {Math.round(result.interiorDepth)} mm.
              </p>
              <div className="segmented" role="radiogroup" aria-label="Tipo dos vãos selecionados">
                {CYCLE.map((t) => (
                  <button key={t} role="radio" aria-checked={false} onClick={() => updateRegion({ type: t })}>
                    Todos {CELL_LABEL[t].toLowerCase()}
                  </button>
                ))}
              </div>
              <button className="primary" onClick={() => mergeSelected(true)}>
                Uma porta só na frente (mantém divisórias e prateleiras)
              </button>
              <button className="secondary" onClick={() => mergeSelected(false)}>
                Juntar num vão só (tira divisórias e prateleiras entre eles)
              </button>
              <button className="link" onClick={() => setSelection([])}>
                Limpar seleção
              </button>
            </div>
          ) : (
            <div className="row">
              {CYCLE.map((t) => (
                <button key={t} className="link" onClick={() => fillAll(t)}>
                  Tudo {CELL_LABEL[t].toLowerCase()}
                </button>
              ))}
            </div>
          )}
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

        <button
          className="link"
          onClick={() => {
            setSelected(null);
            setConfig(defaultConfig());
          }}
        >
          Voltar ao modelo padrão
        </button>
      </aside>

      <main className="stage">
        <div className="toolbar">
          <label>
            <input type="checkbox" checked={showFronts} onChange={(e) => setShowFronts(e.target.checked)} /> Mostrar portas e
            frentes
          </label>
          <button className="toggle" aria-pressed={open} onClick={() => setOpen((o) => !o)}>
            {open ? 'Fechar portas e gavetas' : 'Abrir portas e gavetas'}
          </button>
          <div className="measures" role="group" aria-label="Medidas no desenho">
            <span className="small">Medidas:</span>
            {(
              [
                ['external', 'Externas'],
                ['internal', 'Dos nichos'],
                ['selection', 'Da seleção'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                className="toggle"
                aria-pressed={measures[k]}
                onClick={() => setMeasures((m) => ({ ...m, [k]: !m[k] }))}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="muted small hint">Arraste para girar, role para aproximar.</span>
        </div>
        <Viewer
          config={config}
          result={result}
          showFronts={showFronts}
          open={open}
          selection={selection}
          measures={measures}
          measure={measure}
          onRegionClick={pick}
        />
      </main>
    </div>
  );
}

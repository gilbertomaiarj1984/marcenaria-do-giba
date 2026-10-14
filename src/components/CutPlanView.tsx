import { useState } from 'react';
import type { CutPlan, CutSettings, Sheet } from '../model/cutting';
import { sheetsByMaterial } from '../model/cutting';
import { NumberField } from './NumberField';

interface Props {
  plan: CutPlan;
  settings: CutSettings;
  onSettings: (s: CutSettings) => void;
  onPdf: () => Promise<string>;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function CutPlanView({ plan, settings, onSettings, onPdf }: Props) {
  const [status, setStatus] = useState('');
  const set = <K extends keyof CutSettings>(k: K, v: CutSettings[K]) => onSettings({ ...settings, [k]: v });
  const summary = sheetsByMaterial(plan);

  return (
    <div className="cutplan">
      <section className="cut-summary">
        <div>
          <h2>Chapas para comprar</h2>
          <ul className="buy">
            {summary.map((m) => (
              <li key={m.material}>
                <strong>
                  {m.count} {m.count === 1 ? 'chapa' : 'chapas'}
                </strong>{' '}
                de {m.material} ({settings.sheetLength} x {settings.sheetWidth} mm)
                <span className="muted small"> · aproveitamento médio {pct(m.usage)}</span>
              </li>
            ))}
          </ul>
          {plan.tooBig.length > 0 && (
            <p className="sug sug-erro small">
              {plan.tooBig.length} peça(s) não cabem na chapa: {plan.tooBig.map((p) => `${p.name} ${p.length} x ${p.width}`).join(', ')}.
              Use uma chapa maior ou diminua o móvel.
            </p>
          )}
        </div>
        <button
          className="primary"
          onClick={async () => {
            setStatus('Gerando PDF...');
            setStatus(await onPdf());
          }}
        >
          Baixar plano em PDF
        </button>
        {status && <p className="small muted">{status}</p>}
      </section>

      <section className="cut-settings">
        <h2>Chapa e corte (mm)</h2>
        <div className="grid4">
          <NumberField label="Comprimento" value={settings.sheetLength} min={1000} max={3700} onChange={(v) => set('sheetLength', v)} />
          <NumberField label="Largura" value={settings.sheetWidth} min={600} max={2200} onChange={(v) => set('sheetWidth', v)} />
          <NumberField label="Serra" value={settings.kerf} min={0} max={10} onChange={(v) => set('kerf', v)} />
          <NumberField label="Refilo" value={settings.trim} min={0} max={30} onChange={(v) => set('trim', v)} />
        </div>
        <label className="check small">
          <input type="checkbox" checked={settings.grain} onChange={(e) => set('grain', e.target.checked)} /> Respeitar o veio
          (chapa amadeirada: as peças não giram)
        </label>
      </section>

      {plan.sheets.map((sheet, i) => (
        <SheetDrawing key={i} sheet={sheet} index={i + 1} total={plan.sheets.length} settings={settings} />
      ))}

      <section>
        <h2>Legenda das peças</h2>
        <div className="table-wrap">
          <table className="parts">
            <thead>
              <tr>
                <th>Código</th>
                <th>Peça</th>
                <th>Qtd</th>
                <th>Medida (mm)</th>
                <th>Chapa</th>
              </tr>
            </thead>
            <tbody>
              {plan.legend.map((l) => (
                <tr key={l.code}>
                  <td>
                    <strong>{l.code}</strong>
                  </td>
                  <td>{l.name}</td>
                  <td>{l.quantity}</td>
                  <td>
                    {l.length} x {l.width}
                  </td>
                  <td>{l.material}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SheetDrawing({ sheet, index, total, settings }: { sheet: Sheet; index: number; total: number; settings: CutSettings }) {
  const L = settings.sheetLength;
  const W = settings.sheetWidth;
  return (
    <section className="sheet">
      <h3>
        Chapa {index} de {total} · {sheet.material} · {sheet.placements.length} peças · aproveitamento {pct(sheet.usage)}
      </h3>
      <div className="sheet-wrap">
        <svg viewBox={`-40 -40 ${L + 80} ${W + 80}`} role="img" aria-label={`Chapa ${index}`}>
          <rect x={0} y={0} width={L} height={W} className="sheet-bg" />
          <rect
            x={settings.trim}
            y={settings.trim}
            width={L - 2 * settings.trim}
            height={W - 2 * settings.trim}
            className="sheet-usable"
          />
          {sheet.placements.map((p, i) => {
            const small = Math.min(p.w, p.h);
            const fs = Math.max(18, Math.min(60, small / 4));
            return (
              <g key={i}>
                <rect x={p.x} y={p.y} width={p.w} height={p.h} className="piece" />
                <text x={p.x + p.w / 2} y={p.y + p.h / 2} className="piece-code" fontSize={fs * 1.3} textAnchor="middle" dominantBaseline="middle">
                  {p.piece.code}
                </text>
                {small > 120 && (
                  <text x={p.x + p.w / 2} y={p.y + p.h / 2 + fs * 1.4} className="piece-dim" fontSize={fs} textAnchor="middle" dominantBaseline="middle">
                    {p.w} x {p.h}
                  </text>
                )}
              </g>
            );
          })}
          <text x={L / 2} y={-12} className="sheet-dim" textAnchor="middle" fontSize={34}>
            {L}
          </text>
          <text x={-12} y={W / 2} className="sheet-dim" textAnchor="middle" fontSize={34} transform={`rotate(-90 -12 ${W / 2})`}>
            {W}
          </text>
        </svg>
      </div>
    </section>
  );
}

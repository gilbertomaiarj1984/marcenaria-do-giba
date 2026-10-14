import { jsPDF } from 'jspdf';
import { sheetsByMaterial, type CutPlan } from './model/cutting';
import type { Hardware, ShelfConfig } from './model/types';

/** Gera o PDF com o resumo do projeto e uma página por chapa. */
export function buildPdf(config: ShelfConfig, plan: CutPlan, hardware: Hardware[]): Blob {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = 297;
  const pageH = 210;
  const m = 12;
  const s = plan.settings;

  // Página 1: resumo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Marcenaria do Giba - Plano de corte', m, m + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(
    `Estante ${config.width} x ${config.height} x ${config.depth} mm · chapa ${config.thickness} mm · ` +
      `${config.columns} colunas x ${config.rows} linhas`,
    m,
    m + 13,
  );
  doc.text(
    `Chapa ${s.sheetLength} x ${s.sheetWidth} mm · serra ${s.kerf} mm · refilo ${s.trim} mm · ` +
      (s.grain ? 'respeitando o veio' : 'peças podem girar'),
    m,
    m + 18,
  );

  let y = m + 28;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Chapas para comprar', m, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  for (const x of sheetsByMaterial(plan)) {
    y += 6;
    doc.text(`${x.count} x ${x.material}  (aproveitamento médio ${Math.round(x.usage * 100)}%)`, m + 2, y);
  }

  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Ferragens', m, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  for (const h of hardware) {
    y += 6;
    doc.text(`${h.quantity} x ${h.name}`, m + 2, y);
  }

  // Legenda em coluna à direita
  const lx = 150;
  let ly = m + 28;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Peças', lx, ly);
  doc.setFontSize(9);
  ly += 6;
  doc.text('Cód.', lx, ly);
  doc.text('Peça', lx + 12, ly);
  doc.text('Qtd', lx + 62, ly);
  doc.text('Medida (mm)', lx + 74, ly);
  doc.text('Chapa', lx + 104, ly);
  doc.setFont('helvetica', 'normal');
  for (const l of plan.legend) {
    ly += 5;
    if (ly > pageH - m) {
      doc.addPage();
      ly = m + 6;
    }
    doc.text(l.code, lx, ly);
    doc.text(l.name, lx + 12, ly);
    doc.text(String(l.quantity), lx + 62, ly);
    doc.text(`${l.length} x ${l.width}`, lx + 74, ly);
    doc.text(l.material, lx + 104, ly);
  }

  // Uma página por chapa
  plan.sheets.forEach((sheet, i) => {
    doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(
      `Chapa ${i + 1} de ${plan.sheets.length} - ${sheet.material} - ${sheet.placements.length} peças - ` +
        `aproveitamento ${Math.round(sheet.usage * 100)}%`,
      m,
      m + 4,
    );
    const top = m + 12;
    const scale = Math.min((pageW - 2 * m) / s.sheetLength, (pageH - top - m) / s.sheetWidth);
    const X = (v: number) => m + v * scale;
    const Y = (v: number) => top + v * scale;
    doc.setDrawColor(90, 70, 50);
    doc.setFillColor(240, 232, 220);
    doc.rect(X(0), Y(0), s.sheetLength * scale, s.sheetWidth * scale, 'FD');
    doc.setFont('helvetica', 'normal');
    for (const p of sheet.placements) {
      // doc.text muda a cor de preenchimento; volta para a cor da peça a cada retângulo.
      doc.setFillColor(214, 185, 150);
      doc.rect(X(p.x), Y(p.y), p.w * scale, p.h * scale, 'FD');
      const cx = X(p.x + p.w / 2);
      const cy = Y(p.y + p.h / 2);
      const small = Math.min(p.w, p.h) * scale;
      doc.setFontSize(Math.max(6, Math.min(14, small * 1.2)));
      doc.text(p.piece.code, cx, cy, { align: 'center', baseline: 'middle' });
      if (small > 14) {
        doc.setFontSize(Math.max(5, Math.min(8, small * 0.6)));
        doc.text(`${p.w} x ${p.h}`, cx, cy + Math.min(5, small / 3), { align: 'center', baseline: 'middle' });
      }
    }
    doc.setFontSize(8);
    doc.text(`${s.sheetLength} mm`, X(s.sheetLength / 2), Y(s.sheetWidth) + 5, { align: 'center' });
  });

  return doc.output('blob');
}

/** Salva o arquivo: pelo Claude quando a página roda lá, senão como download normal. */
export async function savePdf(blob: Blob, filename: string): Promise<string> {
  const w = window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } };
  if (w.claude?.use) {
    const downloads = (await w.claude.use('downloads')) as
      | { save: (r: { filename: string; data: Blob }) => Promise<unknown> }
      | null;
    if (downloads) {
      try {
        await downloads.save({ filename, data: blob });
        return 'PDF salvo.';
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code === 'declined') return 'Download cancelado.';
        if (code === 'rate_limited') return 'Aguarde um instante e tente de novo.';
        return 'Não foi possível salvar o PDF aqui.';
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'PDF gerado.';
}

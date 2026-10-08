/**
 * Exportação de relatórios em CSV, Excel (.xlsx) e PDF.
 *
 * Os relatórios dos módulos LIRAa/LIA e Vacinação Antirrábica usam MODELOS
 * CONFIGURÁVEIS: não reproduzem formulário oficial (BCL, boletins estaduais) e
 * trazem essa ressalva no rodapé, até haver layout validado pela SES-GO.
 * As bibliotecas de Excel e PDF são carregadas só no momento da exportação.
 */

export type ColumnType = 'text' | 'number' | 'percent' | 'date';

export interface ReportColumn {
  key: string;
  label: string;
  type?: ColumnType;
}

export interface ReportTable {
  title: string;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
}

export interface ReportDocument {
  title: string;
  /** município/UF, levantamento, campanha... */
  subtitle?: string;
  generatedBy?: string;
  tables: ReportTable[];
  notes?: string[];
}

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export const MODEL_DISCLAIMER =
  'Modelo configurável do Endemias GOV para conferência. Não substitui formulário ou sistema oficial; layout pendente de validação pela Vigilância estadual.';

function formatCell(value: unknown, type: ColumnType = 'text'): string {
  if (value === null || value === undefined || value === '') return '';
  if (type === 'percent' && typeof value === 'number') return value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (type === 'number' && typeof value === 'number') return value.toLocaleString('pt-BR');
  if (type === 'date' && typeof value === 'string') {
    const d = value.length <= 10 ? new Date(`${value}T12:00:00`) : new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('pt-BR');
  }
  return String(value);
}

/** CSV com separador ";" e BOM (abre corretamente no Excel em português). */
export function toCsv(doc: ReportDocument): string {
  const esc = (s: string) => (/[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines: string[] = [esc(doc.title)];
  if (doc.subtitle) lines.push(esc(doc.subtitle));
  lines.push(`Gerado em;${new Date().toLocaleString('pt-BR')}`);
  for (const t of doc.tables) {
    lines.push('');
    if (doc.tables.length > 1) lines.push(esc(t.title));
    lines.push(t.columns.map((c) => esc(c.label)).join(';'));
    for (const r of t.rows) lines.push(t.columns.map((c) => esc(formatCell(r[c.key], c.type))).join(';'));
  }
  for (const n of [...(doc.notes || []), MODEL_DISCLAIMER]) lines.push('', esc(n));
  return '\uFEFF' + lines.join('\r\n');
}

function sheetName(title: string, used: Set<string>): string {
  let base = title.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 28) || 'Planilha';
  let name = base;
  let i = 2;
  while (used.has(name)) name = `${base.slice(0, 26)} ${i++}`;
  used.add(name);
  return name;
}

export async function toXlsxBlob(doc: ReportDocument): Promise<Blob> {
  const { default: writeXlsxFile } = await import('write-excel-file/universal');
  const used = new Set<string>();
  const sheets = doc.tables.map((t) => {
    const header = t.columns.map((c) => ({ value: c.label, fontWeight: 'bold' as const }));
    const body = t.rows.map((r) =>
      t.columns.map((c) => {
        const v = r[c.key];
        if (v === null || v === undefined || v === '') return null;
        if ((c.type === 'number' || c.type === 'percent') && typeof v === 'number') return { value: v, type: Number };
        return { value: formatCell(v, c.type), type: String };
      })
    );
    const footer = [[null], [{ value: doc.title, type: String }], [{ value: MODEL_DISCLAIMER, type: String }]];
    return {
      data: [header, ...body, ...footer] as any,
      sheet: sheetName(t.title, used),
      columns: t.columns.map((c) => ({ width: Math.min(45, Math.max(10, c.label.length + 4)) })),
    };
  });
  return (writeXlsxFile as any)(sheets).toBlob();
}

export async function toPdfBlob(doc: ReportDocument): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  let y = 40;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text(doc.title, 40, y);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  if (doc.subtitle) pdf.text(doc.subtitle, 40, (y += 16));
  pdf.text(`Gerado em ${new Date().toLocaleString('pt-BR')}${doc.generatedBy ? ` por ${doc.generatedBy}` : ''}`, 40, (y += 13));
  y += 10;
  for (const t of doc.tables) {
    if (doc.tables.length > 1) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text(t.title, 40, (y += 14));
      y += 4;
    }
    autoTable(pdf, {
      startY: y,
      head: [t.columns.map((c) => c.label)],
      body: t.rows.length ? t.rows.map((r) => t.columns.map((c) => formatCell(r[c.key], c.type))) : [[{ content: 'Sem registros', colSpan: t.columns.length }]],
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [3, 72, 122] },
      margin: { left: 40, right: 40 },
    });
    y = (pdf as any).lastAutoTable.finalY + 12;
  }
  pdf.setFontSize(7.5);
  for (const n of [...(doc.notes || []), MODEL_DISCLAIMER]) {
    const lines = pdf.splitTextToSize(n, pageWidth - 80);
    if (y + lines.length * 10 > pdf.internal.pageSize.getHeight() - 30) {
      pdf.addPage();
      y = 40;
    }
    pdf.text(lines, 40, (y += 10));
    y += (lines.length - 1) * 10;
  }
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7.5);
    pdf.text(`Endemias GOV · página ${i} de ${pages}`, pageWidth - 40, pdf.internal.pageSize.getHeight() - 16, { align: 'right' });
  }
  return pdf.output('blob');
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function slugifyFileName(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 80);
}

export async function exportReport(format: ExportFormat, doc: ReportDocument): Promise<void> {
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `${slugifyFileName(doc.title)}-${stamp}`;
  if (format === 'csv') return downloadBlob(new Blob([toCsv(doc)], { type: 'text/csv;charset=utf-8' }), `${base}.csv`);
  if (format === 'xlsx') return downloadBlob(await toXlsxBlob(doc), `${base}.xlsx`);
  return downloadBlob(await toPdfBlob(doc), `${base}.pdf`);
}

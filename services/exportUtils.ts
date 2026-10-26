// ============================================================
//  Utilidades de exportación (CSV e impresión / PDF)
//  Sin dependencias externas: los datos no salen del navegador.
// ============================================================

export type CsvValue = string | number | boolean | null | undefined;

const csvCell = (value: CsvValue): string => {
  const text = value === null || value === undefined ? '' : String(value);
  // Escapamos comillas y separamos con punto y coma (Excel en español).
  return `"${text.replace(/"/g, '""')}"`;
};

export const rowsToCsv = (rows: CsvValue[][]): string =>
  rows.map(row => row.map(csvCell).join(';')).join('\r\n');

export const downloadCsv = (filename: string, rows: CsvValue[][]): void => {
  // BOM para que Excel reconozca UTF-8 (acentos, ñ, €).
  const csv = `\uFEFF${rowsToCsv(rows)}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

/**
 * Abre el diálogo de impresión del navegador con un documento A4.
 * El usuario puede guardarlo como PDF. No se envía nada a terceros.
 */
export const printHtmlDocument = (html: string, title = 'Documento'): void => {
  const iframe = document.createElement('iframe');
  iframe.title = title;
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }
  doc.open();
  doc.write(html);
  doc.close();
  iframe.contentWindow?.focus();
  setTimeout(() => iframe.contentWindow?.print(), 300);
  // Damos margen al diálogo de impresión antes de retirar el iframe.
  setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 60000);
};

export const dateStamp = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

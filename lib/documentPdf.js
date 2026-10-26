import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// ============================================================
//  Generador de PDF documental
//  Se usa tanto en el navegador (vista previa/descarga) como en
//  las funciones serverless (archivo definitivo firmado).
//  El PDF se genera SIEMPRE desde el snapshot inmutable del
//  documento, no desde la plantilla viva.
// ============================================================

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 52;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const sanitizeText = (value) => String(value ?? '')
  .replace(/☑/g, '[X]')
  .replace(/☐/g, '[ ]')
  .replace(/[“”]/g, '"')
  .replace(/[‘’]/g, "'")
  .replace(/[–—]/g, '-')
  .replace(/…/g, '...')
  .replace(/•/g, '-')
  .replace(/→/g, '->')
  .replace(/[^\x00-\xFF\u20AC]/g, '?');

const cleanMarkdown = (line) => sanitizeText(line)
  .replace(/^#{1,6}\s+/, '')
  .replace(/\*\*(.*?)\*\*/g, '$1')
  .replace(/__(.*?)__/g, '$1')
  .replace(/^\s*-\s+\[x\]\s+/i, '[X] ')
  .replace(/^\s*-\s+\[\s*\]\s+/, '[ ] ')
  .replace(/^\s*-\s+/, '- ');

const wrapText = (text, font, size, maxWidth) => {
  const paragraphs = String(text).split('\n');
  const lines = [];
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push('');
      continue;
    }
    const words = paragraph.split(/\s+/);
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        if (font.widthOfTextAtSize(word, size) > maxWidth) {
          let fragment = '';
          for (const char of word) {
            if (font.widthOfTextAtSize(fragment + char, size) > maxWidth) {
              lines.push(fragment);
              fragment = char;
            } else {
              fragment += char;
            }
          }
          current = fragment;
        } else {
          current = word;
        }
      }
    }
    if (current) lines.push(current);
  }
  return lines;
};

export async function generateDocumentPdf(input) {
  const document = input?.document || input;
  if (!document) throw new Error('No hay documento para generar el PDF.');

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const safeTitle = sanitizeText(document.title || document.templateName || 'Documento');
  pdf.setTitle(safeTitle);
  pdf.setAuthor('Sinestesya');
  pdf.setSubject('Documentación sanitaria y consentimientos');
  pdf.setCreator('Sinestesya · módulo documental');
  pdf.setProducer('Sinestesya');
  pdf.setCreationDate(document.signedAt ? new Date(document.signedAt) : new Date(document.createdAt || Date.now()));

  let page = null;
  let cursorY = 0;
  let pageNumber = 0;

  const addPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pageNumber += 1;
    cursorY = PAGE_HEIGHT - MARGIN;

    // Cabecera discreta
    page.drawText('SINESTESYA · SALUD INTEGRAL', {
      x: MARGIN, y: PAGE_HEIGHT - 30, size: 7, font: bold, color: rgb(0.42, 0.39, 0.36),
    });
    page.drawText('Documento sanitario y de consentimientos', {
      x: MARGIN, y: PAGE_HEIGHT - 40, size: 6.5, font, color: rgb(0.55, 0.52, 0.48),
    });
    page.drawLine({
      start: { x: MARGIN, y: PAGE_HEIGHT - 47 },
      end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 47 },
      thickness: 0.5, color: rgb(0.85, 0.83, 0.79),
    });
  };

  const ensureSpace = (height) => {
    if (!page) addPage();
    if (cursorY - height < 66) {
      addPage();
    }
  };

  const drawLine = (text, options = {}) => {
    const size = options.size || 9.5;
    const usedFont = options.bold ? bold : font;
    const color = options.color || rgb(0.16, 0.15, 0.14);
    const indent = options.indent || 0;
    const maxWidth = CONTENT_WIDTH - indent;
    const lines = wrapText(cleanMarkdown(text), usedFont, size, maxWidth);
    const lineHeight = size * 1.45;
    for (const line of lines) {
      ensureSpace(lineHeight);
      if (!line) {
        cursorY -= size * 0.7;
        continue;
      }
      page.drawText(line, { x: MARGIN + indent, y: cursorY, size, font: usedFont, color });
      cursorY -= lineHeight;
    }
  };

  const drawDivider = () => {
    ensureSpace(16);
    page.drawLine({
      start: { x: MARGIN, y: cursorY },
      end: { x: PAGE_WIDTH - MARGIN, y: cursorY },
      thickness: 0.5, color: rgb(0.82, 0.8, 0.76),
    });
    cursorY -= 14;
  };

  // Título del documento
  addPage();
  cursorY -= 16;
  drawLine(safeTitle, { size: 17, bold: true });
  drawLine(`Versión del documento: ${document.version || 1} · Plantilla: ${document.templateName || 'Sin plantilla'} v${document.templateVersion || 1}`, { size: 8, color: rgb(0.42, 0.39, 0.36) });
  drawLine(`ID: ${document.id || 'Sin identificador'}`, { size: 7.5, color: rgb(0.55, 0.52, 0.48) });
  drawDivider();

  const body = String(document.renderedText || '').split('\n');
  for (const rawLine of body) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      if (cursorY < PAGE_HEIGHT - MARGIN - 10) cursorY -= 5;
      continue;
    }
    if (/^-{3,}$/.test(line.trim())) {
      drawDivider();
    } else if (/^##\s+/.test(line)) {
      ensureSpace(20);
      cursorY -= 4;
      drawLine(line.replace(/^##\s+/, ''), { size: 12, bold: true });
      cursorY -= 2;
    } else if (/^###\s+/.test(line)) {
      ensureSpace(18);
      cursorY -= 2;
      drawLine(line.replace(/^###\s+/, ''), { size: 10, bold: true });
    } else if (/^\s*-\s+/.test(line)) {
      drawLine(line.replace(/^\s*-\s+/, '- '), { indent: 10 });
    } else {
      drawLine(line);
    }
  }

  // Evidencias de firma
  const evidence = input?.evidence || document.evidence || null;
  const signatures = Array.isArray(evidence?.signatures) ? evidence.signatures : [];
  if (document.signedAt || signatures.length) {
    cursorY -= 8;
    drawDivider();
    drawLine('EVIDENCIA DE FIRMA ELECTRÓNICA', { size: 12, bold: true });
    drawLine('Este anexo forma parte del documento archivado. No modifica el contenido firmado.', { size: 8, color: rgb(0.42, 0.39, 0.36) });
    const rows = [
      ['Documento', document.title || ''],
      ['ID del documento', document.id || ''],
      ['Paciente (ID)', document.patientId || ''],
      ['Tipo y especialidad', `${document.category || ''} · ${document.specialty || 'transversal'}`],
      ['Versión de plantilla', `${document.templateName || ''} v${document.templateVersion || 1}`],
      ['Huella del contenido (SHA-256)', evidence?.sha256 || document.contentSha256 || ''],
      ['Estado', document.status || ''],
      ['Nivel de firma', document.signatureAssurance || evidence?.assurance || ''],
      ['Proveedor / método', document.signatureProvider || evidence?.provider || evidence?.verificationMethod || ''],
      ['Fecha y hora de archivo', document.signedAt || evidence?.signedAt || ''],
    ];
    for (const [label, value] of rows) {
      drawLine(`${label}: ${value || 'No consta'}`, { size: 8.2 });
    }
    if (signatures.length) {
      drawLine('Firmas recogidas', { size: 9, bold: true });
      signatures.forEach((sig, index) => {
        drawLine(`${index + 1}. ${sig.name || 'Firmante'} · ${sig.conditionLabel || sig.condition || ''}`, { size: 8.4, bold: true });
        drawLine(`Fecha: ${sig.signedAt || 'No consta'} · Método: ${sig.verificationMethod || 'No consta'} · Garantía: ${sig.assurance || 'No consta'}`, { size: 7.8 });
        drawLine(`Referencia de solicitud: ${sig.requestId || 'No consta'}`, { size: 7.5, color: rgb(0.42, 0.39, 0.36) });
        if (sig.certificateInfo) {
          drawLine(`Certificado: ${JSON.stringify(sig.certificateInfo).slice(0, 700)}`, { size: 7.2, color: rgb(0.42, 0.39, 0.36) });
        }
      });
    }
    drawLine(`Huella del PDF firmado (SHA-256): ${document.signedPdfSha256 || 'Se calcula al archivar'}`, { size: 8 });
    drawLine('Documento conservado como registro final. Cualquier corrección requiere una nueva versión.', { size: 8, color: rgb(0.42, 0.39, 0.36) });
  }

  // Pie de página en todas las páginas
  const pages = pdf.getPages();
  pages.forEach((p, index) => {
    p.drawLine({
      start: { x: MARGIN, y: 42 },
      end: { x: PAGE_WIDTH - MARGIN, y: 42 },
      thickness: 0.5, color: rgb(0.85, 0.83, 0.79),
    });
    p.drawText(`Sinestesya · ${safeTitle.slice(0, 58)}`, {
      x: MARGIN, y: 30, size: 6.5, font, color: rgb(0.5, 0.47, 0.43),
    });
    p.drawText(`Página ${index + 1} de ${pages.length}`, {
      x: PAGE_WIDTH - MARGIN - 62, y: 30, size: 6.5, font, color: rgb(0.5, 0.47, 0.43),
    });
    p.drawText(document.contentSha256 ? `SHA-256 contenido: ${String(document.contentSha256).slice(0, 32)}...` : '', {
      x: MARGIN, y: 22, size: 5.8, font, color: rgb(0.62, 0.59, 0.54),
    });
  });

  return pdf.save();
}

export const bytesToBase64 = (bytes) => {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
};

export const base64ToBytes = (base64) => {
  if (typeof Buffer !== 'undefined') return Uint8Array.from(Buffer.from(base64, 'base64'));
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

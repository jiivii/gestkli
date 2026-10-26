export interface PdfDocumentInput {
  document: any;
  evidence?: any;
}

export function generateDocumentPdf(input: PdfDocumentInput | any): Promise<Uint8Array>;
export function bytesToBase64(bytes: Uint8Array): string;
export function base64ToBytes(base64: string): Uint8Array;

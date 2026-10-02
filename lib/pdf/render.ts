import { renderToBuffer } from "@react-pdf/renderer";
import type { DocumentData } from "@/lib/documents";
import { DocumentPdf } from "@/lib/pdf/DocumentPdf";

/** The finished A4 PDF for one quotation or invoice. */
export function renderDocumentPdf(data: DocumentData): Promise<Buffer> {
  return renderToBuffer(DocumentPdf({ data }));
}

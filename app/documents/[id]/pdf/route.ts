import { requireStaff } from "@/lib/context";
import { loadDocument, parseKind } from "@/lib/documents";
import { renderDocumentPdf } from "@/lib/pdf/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /documents/:id/pdf?type=invoice|quotation[&download=1]
 * The issued document as a PDF — the same file staff print, download and send.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const staff = await requireStaff();
  const url = new URL(request.url);
  const data = await loadDocument(params.id, parseKind(url.searchParams.get("type")), staff);
  if (!data) return new Response("Not found", { status: 404 });

  const pdf = await renderDocumentPdf(data);
  const filename = `${data.number} - ${data.client.full_name}.pdf`.replace(/[^\w .-]/g, "");
  const disposition = url.searchParams.get("download") ? "attachment" : "inline";

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

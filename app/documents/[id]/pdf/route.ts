import { requireStaff } from "@/lib/context";
import { loadDocument, parseKind } from "@/lib/documents";
import { renderDocumentPdf } from "@/lib/pdf/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /documents/:id/pdf?type=invoice|quotation[&download=1]
 * The issued document as a PDF — the same file staff print, download and send.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const staff = await requireStaff();
  const url = new URL(request.url);
  const data = await loadDocument(
    params.id,
    parseKind(url.searchParams.get("type")),
    staff,
  );
  if (!data) return new Response("Not found", { status: 404 });

  let pdf: Buffer;
  try {
    pdf = await renderDocumentPdf(data);
  } catch (error) {
    // Shown on the document page, and in the server logs.
    console.error("PDF render failed", params.id, error);
    return new Response(
      `PDF render failed: ${(error as Error)?.message ?? String(error)}`,
      {
        status: 500,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      },
    );
  }
  const filename = `${data.number} - ${data.client.full_name}.pdf`.replace(
    /[^\w .-]/g,
    "",
  );
  const disposition = url.searchParams.get("download")
    ? "attachment"
    : "inline";

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

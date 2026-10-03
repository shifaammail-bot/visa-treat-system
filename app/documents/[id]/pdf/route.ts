import { requireStaff } from "@/lib/context";
import { loadDocument, parseKind } from "@/lib/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The first PDF after a cold start loads fonts and the layout engine.
export const maxDuration = 30;

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
    // Loaded here, not at the top, so a failure while loading the PDF library
    // or its fonts is caught and reported instead of crashing the function.
    const { renderDocumentPdf } = await import("@/lib/pdf/render");
    pdf = await renderDocumentPdf(data);
  } catch (error) {
    // Shown on the document page, and in the server logs.
    console.error("PDF render failed", params.id, error);
    const e = error as Error;
    const stack = (e?.stack ?? "").split("\n").slice(0, 6).join("\n");
    return new Response(
      `PDF render failed: ${e?.message ?? String(error)}\n\n${stack}`,
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

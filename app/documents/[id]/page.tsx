import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, ExternalLink, FileText } from "lucide-react";
import { requireStaff } from "@/lib/context";
import { loadDocument, parseKind } from "@/lib/documents";
import { Breadcrumbs } from "@/components/PageHeader";
import { buttonClass, secondaryButtonClass } from "@/components/ui";
import { PdfViewer } from "./PdfViewer";

export const dynamic = "force-dynamic";

/**
 * The issued quotation or invoice. What's shown is the generated PDF itself,
 * so what staff see is exactly what they download, print and send.
 */
export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { type?: string; new?: string };
}) {
  const staff = await requireStaff();
  const kind = parseKind(searchParams.type);
  const doc = await loadDocument(params.id, kind, staff);
  if (!doc) notFound();

  const pdf = `/documents/${params.id}/pdf?type=${kind}`;

  return (
    <div className="flex min-h-screen flex-col bg-[#F6F7F9]">
      <div className="border-b border-navy/10 bg-white px-4 py-3 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumbs
            trail={[
              { label: "Dashboard", href: "/" },
              kind === "invoice"
                ? { label: "Invoices", href: "/invoices" }
                : { label: "Quotations", href: "/quotations" },
            ]}
            current={doc.number}
          />
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/applications/${params.id}`}
              className={secondaryButtonClass}
            >
              <FileText className="h-4 w-4" />
              Open sale
            </Link>
            <a
              href={pdf}
              target="_blank"
              rel="noopener"
              className={secondaryButtonClass}
            >
              <ExternalLink className="h-4 w-4" />
              Open / print
            </a>
            <a href={`${pdf}&download=1`} className={buttonClass}>
              <Download className="h-4 w-4" />
              Download PDF
            </a>
          </div>
        </div>
        {searchParams.new && (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
            {kind === "invoice" ? "Invoice" : "Quotation"}{" "}
            <strong>{doc.number}</strong> issued.{" "}
            <Link
              href={`/applications/${params.id}`}
              className="font-bold underline"
            >
              Open the sale
            </Link>{" "}
            to record payments or update its status.
          </p>
        )}
      </div>

      <PdfViewer src={pdf} />
    </div>
  );
}

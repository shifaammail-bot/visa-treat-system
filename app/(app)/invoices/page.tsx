import { ComingSoon, PageHeader } from "@/components/PageHeader";

export default function Page() {
  return (
    <>
      <PageHeader title="Invoices" description="Tax invoices and invoices by brand" />
      <ComingSoon step={5} what="One-click invoice from a quotation, with the document view." />
    </>
  );
}

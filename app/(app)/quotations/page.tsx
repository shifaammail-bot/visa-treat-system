import { ComingSoon, PageHeader } from "@/components/PageHeader";

export default function Page() {
  return (
    <>
      <PageHeader title="Quotations" description="Quotes sent to clients" />
      <ComingSoon step={4} what="Quote form with issuer, visa product, fees and the VAT split." />
    </>
  );
}

import { ComingSoon, PageHeader } from "@/components/PageHeader";

export default function Page() {
  return (
    <>
      <PageHeader title="Reports" description="Performance by brand and consultant" />
      <ComingSoon step={7} what="Income by brand and consultant, conversion, receivables and visa mix." />
    </>
  );
}

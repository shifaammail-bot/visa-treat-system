import { ComingSoon, PageHeader } from "@/components/PageHeader";

export default function Page() {
  return (
    <>
      <PageHeader title="Clients" description="Everyone who has applied" />
      <ComingSoon step={3} what="Client records, created from the lead form." />
    </>
  );
}

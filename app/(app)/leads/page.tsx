import { ComingSoon, PageHeader } from "@/components/PageHeader";

export default function Page() {
  return (
    <>
      <PageHeader title="Leads" description="New enquiries and where they came from" />
      <ComingSoon step={3} what="Lead form: client details, destination, travel dates, source channel and assigned consultant." />
    </>
  );
}

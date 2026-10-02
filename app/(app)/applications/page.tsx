import { ComingSoon, PageHeader } from "@/components/PageHeader";

export default function Page() {
  return (
    <>
      <PageHeader title="Applications" description="Every visa application and its status" />
      <ComingSoon step={4} what="Application list with status from enquiry through to approved." />
    </>
  );
}

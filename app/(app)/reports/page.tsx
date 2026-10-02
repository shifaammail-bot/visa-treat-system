import { notFound } from "next/navigation";
import { getContext, getStaffList } from "@/lib/context";
import { ALL_BRANDS } from "@/lib/issuers";
import { can } from "@/lib/permissions";
import { buildReport, thisMonth, type Period } from "@/lib/reports";
import { PageHeader } from "@/components/PageHeader";
import { ReportView } from "@/components/ReportView";
import { inputClass, secondaryButtonClass } from "@/components/ui";

const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

export default async function ReportsPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const ctx = await getContext();
  if (!can.seeReports(ctx.staff.role)) notFound();

  const fallback = thisMonth();
  let period: Period = {
    from: isDate(searchParams.from) ? searchParams.from! : fallback.from,
    to: isDate(searchParams.to) ? searchParams.to! : fallback.to,
  };
  if (period.to < period.from) period = { from: period.to, to: period.from };

  const [report, staffList] = await Promise.all([buildReport(ctx, period), getStaffList()]);
  const brand = ctx.issuers.find((i) => i.id === ctx.brand);

  return (
    <>
      <PageHeader
        title="Reports"
        description={ctx.brand === ALL_BRANDS ? "All brands" : brand?.trade_name}
      >
        <form className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-semibold">
            From
            <input name="from" type="date" defaultValue={period.from} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-xs font-semibold">
            To
            <input name="to" type="date" defaultValue={period.to} className={`${inputClass} mt-1`} />
          </label>
          <button type="submit" className={secondaryButtonClass}>
            Apply
          </button>
        </form>
      </PageHeader>
      <div className="px-4 py-6 md:px-8">
        <ReportView report={report} ctx={ctx} staffList={staffList} detailed />
      </div>
    </>
  );
}

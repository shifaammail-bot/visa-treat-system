import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";

export type Crumb = { label: string; href: string };

type Props = {
  title: string;
  description?: React.ReactNode;
  /**
   * The pages above this one, after Dashboard (which is always first).
   * The last one is where Back goes. Omit on the dashboard itself with `home`.
   */
  crumbs?: Crumb[];
  home?: boolean;
  /** Shown next to the title, e.g. a status badge. */
  meta?: React.ReactNode;
  /** Actions on the right. */
  children?: React.ReactNode;
};

export function Breadcrumbs({ trail, current }: { trail: Crumb[]; current: string }) {
  const parent = trail[trail.length - 1];
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href={parent.href}
        className="inline-flex items-center gap-1.5 rounded-lg border border-navy/10 bg-white px-2.5 py-1 text-xs font-bold text-navy/70 hover:border-navy/20 hover:text-navy"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </Link>
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1 text-xs font-semibold text-navy/50">
          {trail.map((crumb) => (
            <li key={crumb.href} className="flex items-center gap-1">
              <Link href={crumb.href} className="hover:text-navy hover:underline">
                {crumb.label}
              </Link>
              <ChevronRight className="h-3 w-3 text-navy/30" />
            </li>
          ))}
          <li aria-current="page" className="text-navy">
            {current}
          </li>
        </ol>
      </nav>
    </div>
  );
}

export function PageHeader({ title, description, crumbs = [], home, meta, children }: Props) {
  const trail: Crumb[] = [{ label: "Dashboard", href: "/" }, ...crumbs];

  return (
    <header className="border-b border-navy/10 bg-white px-4 pb-5 pt-4 md:px-8">
      {!home && <Breadcrumbs trail={trail} current={title} />}
      <div className={`flex flex-wrap items-end justify-between gap-4 ${home ? "pt-2" : "pt-4"}`}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
            {meta}
          </div>
          {description && <div className="mt-1 text-sm text-navy/60">{description}</div>}
        </div>
        {children}
      </div>
    </header>
  );
}

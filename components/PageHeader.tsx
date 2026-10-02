type Props = {
  title: string;
  description?: string;
  children?: React.ReactNode;
};

export function PageHeader({ title, description, children }: Props) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-navy/10 px-4 py-6 md:px-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-navy/60">{description}</p>}
      </div>
      {children}
    </header>
  );
}

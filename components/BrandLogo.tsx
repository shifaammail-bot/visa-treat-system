/* eslint-disable @next/next/no-img-element */

type Props = {
  slug: string;
  tradeName: string;
  accentColour: string;
  /** "dark" for the navy sidebar, "light" for white pages and documents. */
  on?: "dark" | "light";
  className?: string;
};

/**
 * Real logo files, per issuer slug. To swap a wordmark for a real logo, drop
 * the files in public/logos and add one line here.
 */
const LOGOS: Record<string, { dark: string; light: string }> = {
  visatreat: { dark: "/logos/visatreat-on-dark.svg", light: "/logos/visatreat-on-light.svg" },
};

export function BrandLogo({ slug, tradeName, accentColour, on = "light", className = "h-7" }: Props) {
  const logo = LOGOS[slug];
  if (logo) {
    return <img src={logo[on]} alt={tradeName} className={`w-auto ${className}`} />;
  }

  // Placeholder wordmark until the real logo arrives: first word in ink,
  // the rest in the brand's accent colour.
  const [first, ...rest] = tradeName.split(" ");
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap text-lg font-extrabold tracking-tight ${
        on === "dark" ? "text-white" : "text-navy"
      }`}
    >
      {first}
      {rest.length > 0 && (
        <span className="ml-1" style={{ color: accentColour }}>
          {rest.join(" ")}
        </span>
      )}
    </span>
  );
}

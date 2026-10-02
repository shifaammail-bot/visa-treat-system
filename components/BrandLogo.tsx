/* eslint-disable @next/next/no-img-element */
import { BRANDS, logoUrl } from "@/lib/brands";

type Props = {
  slug: string;
  tradeName: string;
  accentColour: string;
  /** "dark" for the navy sidebar, "light" for white pages and documents. */
  on?: "dark" | "light";
  className?: string;
};

/**
 * The Visa Treat logo, drawn inline from public/logos/Visa treat/*.svg so the
 * wordmark uses the app's Manrope instead of the file's DejaVu Sans, which
 * most Windows machines don't have.
 */
function VisaTreatLogo({ on, className }: { on: "dark" | "light"; className: string }) {
  return (
    <svg viewBox="0 0 560 150" className={`w-auto ${className}`} role="img" aria-label="Visa Treat">
      <path
        d="M34 46 L66 106 L98 46"
        fill="none"
        stroke="#2FE0C2"
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x="122"
        y="100"
        fontSize="68"
        fontWeight="800"
        letterSpacing="-2"
        style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif" }}
      >
        <tspan fill={on === "dark" ? "#FFFFFF" : "#0B0C10"}>Visa</tspan>
        <tspan fill="#2FE0C2">Treat</tspan>
      </text>
    </svg>
  );
}

export function BrandLogo({ slug, tradeName, accentColour, on = "light", className = "h-7" }: Props) {
  if (slug === "visatreat") return <VisaTreatLogo on={on} className={className} />;

  // Real logo files live in lib/brands.ts (one line per company).
  const logo = BRANDS[slug]?.logo;
  if (logo) {
    return <img src={logoUrl(logo)} alt={tradeName} className={`w-auto object-contain ${className}`} />;
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

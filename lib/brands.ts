/**
 * How each issuing company looks: its logo and the two colours taken from it.
 *
 * - `primary` is dark enough for text: headings, the document title, rules.
 * - `accent` is the logo's second colour, used sparingly (thin bars).
 * - `tint` is a very light wash of the primary for table headers.
 *
 * To add or change a logo, put the file in public/logos and change one line.
 * Logos are sized by width (mm on A4), never by height, so wide marks like
 * TourMate and Arabiers keep their proportions.
 */
export type BrandTheme = {
  /** Path under public/, or null to draw the Visa Treat mark in code. */
  logo: string | null;
  /** Logo width on the A4 document, in millimetres. */
  logoWidthMm: number;
  /** Natural width / height of the logo file. */
  logoAspect: number;
  primary: string;
  accent: string;
  tint: string;
};

export const BRANDS: Record<string, BrandTheme> = {
  arabiers: {
    logo: "/logos/Arabiers/Arabiers_Holidays_UAE_Logo_Transparent.png",
    logoWidthMm: 60,
    logoAspect: 2047 / 375,
    primary: "#178A8E",
    accent: "#CFC425",
    tint: "#EAF6F6",
  },
  tourmate: {
    logo: "/logos/Tour mate/TourMate_Logo_Transparent.png",
    logoWidthMm: 52,
    logoAspect: 2048 / 564,
    primary: "#226B5E",
    accent: "#F5B634",
    tint: "#EBF3F1",
  },
  visatreat: {
    logo: null,
    logoWidthMm: 48,
    logoAspect: 560 / 150,
    primary: "#0B0C10",
    accent: "#2FE0C2",
    tint: "#EDFBF8",
  },
};

/** A company without its own entry: neutral navy with its stored accent colour. */
export function brandFor(slug: string, accentColour?: string | null): BrandTheme {
  return (
    BRANDS[slug] ?? {
      logo: null,
      logoWidthMm: 48,
      logoAspect: 4,
      primary: "#0B0C10",
      accent: accentColour || "#2FE0C2",
      tint: "#F3F4F6",
    }
  );
}

/** A public/ path as a URL (the TourMate folder name has a space). */
export const logoUrl = (path: string) => encodeURI(path);

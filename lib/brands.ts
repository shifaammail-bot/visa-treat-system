/**
 * Each issuing company's logo. Documents are black and white for every
 * company; the logo, printed in its own colours, is the only thing that
 * differs (with the legal details).
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
};

export const BRANDS: Record<string, BrandTheme> = {
  arabiers: {
    logo: "/logos/Arabiers/Arabiers_Holidays_UAE_Logo_Transparent.png",
    logoWidthMm: 58,
    logoAspect: 2047 / 375,
  },
  tourmate: {
    logo: "/logos/Tour mate/TourMate_Logo_Transparent.png",
    logoWidthMm: 50,
    logoAspect: 2048 / 564,
  },
  visatreat: {
    logo: null,
    logoWidthMm: 46,
    logoAspect: 560 / 150,
  },
};

/** A company without its own entry gets its trade name as a text heading. */
export function brandFor(slug: string): BrandTheme {
  return BRANDS[slug] ?? { logo: null, logoWidthMm: 46, logoAspect: 4 };
}

/** A public/ path as a URL (the TourMate folder name has a space). */
export const logoUrl = (path: string) => encodeURI(path);

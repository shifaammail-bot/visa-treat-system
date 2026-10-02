/* eslint-disable jsx-a11y/alt-text -- react-pdf's <Image> is not an HTML img */
import fs from "node:fs";
import path from "node:path";
import { Document, Font, Image, Page, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { brandFor, type BrandTheme } from "@/lib/brands";
import type { DocumentData } from "@/lib/documents";
import { formatDate, num } from "@/lib/format";
import { balance, money } from "@/lib/vat";

/*
 * The quotation / invoice as a real A4 PDF.
 *
 * One black-and-white template for every company: black text on white, grey
 * hairline rules, no fills. The only colour on the page is the company's own
 * logo, printed as-is. Only the logo and the legal details change per brand.
 *
 * Units are points (1 mm = 2.835 pt). Sized so a normal visa invoice fits on
 * one page.
 */

const FONT_DIR = path.join(process.cwd(), "lib", "pdf", "fonts");
Font.register({
  family: "Manrope",
  fonts: [
    { src: path.join(FONT_DIR, "manrope-latin-400-normal.woff"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "manrope-latin-500-normal.woff"), fontWeight: 500 },
    { src: path.join(FONT_DIR, "manrope-latin-700-normal.woff"), fontWeight: 700 },
    { src: path.join(FONT_DIR, "manrope-latin-800-normal.woff"), fontWeight: 800 },
  ],
});
// Don't hyphenate names, addresses or visa descriptions.
Font.registerHyphenationCallback((word) => [word]);

const MM = 2.835;
const BLACK = "#000000";
const TEXT = "#111111";
const MUTED = "#555555";
const HAIRLINE = "#9A9A9A";
/** Rule weights: strong separates sections, hair separates rows. */
const STRONG = 0.75;
const HAIR = 0.5;
const MARGIN = 15 * MM;

const s = StyleSheet.create({
  // No lineHeight on the page or any container: react-pdf then drops the
  // page-number render callback. Line spacing is set on text styles instead.
  page: {
    fontFamily: "Manrope",
    fontSize: 9,
    color: TEXT,
    paddingTop: 13 * MM,
    paddingBottom: 20 * MM,
    paddingHorizontal: MARGIN,
  },
  row: { flexDirection: "row" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  small: { fontSize: 8, lineHeight: 1.45 },
  muted: { color: MUTED },
  bold: { fontWeight: 700 },
  right: { textAlign: "right" },
  heading: { fontSize: 7, fontWeight: 700, letterSpacing: 0.9, textTransform: "uppercase", color: BLACK },
  th: { fontSize: 7, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: BLACK },
  cell: { paddingVertical: 6, paddingHorizontal: 4 },
});

/** Items table columns (must add up to 100%). */
const COLS = { no: "6%", desc: "52%", guests: "10%", unit: "16%", amount: "16%" } as const;

const logoCache = new Map<string, Buffer>();
/** Logo bytes from public/, read once per server process. */
function readLogo(publicPath: string): Buffer {
  let bytes = logoCache.get(publicPath);
  if (!bytes) {
    bytes = fs.readFileSync(path.join(process.cwd(), "public", ...publicPath.split("/").filter(Boolean)));
    logoCache.set(publicPath, bytes);
  }
  return bytes;
}

/** The company's logo in its real colours — the only colour on the page. */
function Logo({ brand, issuer }: { brand: BrandTheme; issuer: DocumentData["issuer"] }) {
  const width = brand.logoWidthMm * MM;
  const height = width / brand.logoAspect;

  if (brand.logo) {
    return (
      <Image src={{ data: readLogo(brand.logo), format: "png" }} style={{ width, height, objectFit: "contain" }} />
    );
  }

  if (issuer.slug === "visatreat") {
    // The Visa Treat mark as vector: mint V, "Visa" in ink, "Treat" in mint.
    return (
      <View style={{ flexDirection: "row", alignItems: "center", width, height }}>
        <Svg viewBox="22 34 88 84" style={{ width: height * 0.62, height: height * 0.6 }}>
          <Path
            d="M34 46 L66 106 L98 46"
            fill="none"
            stroke="#2FE0C2"
            strokeWidth={18}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
        <Text style={{ fontSize: height * 0.56, fontWeight: 800, letterSpacing: -0.6, marginLeft: height * 0.12, color: "#0B0C10" }}>
          Visa<Text style={{ color: "#2FE0C2" }}>Treat</Text>
        </Text>
      </View>
    );
  }

  return <Text style={{ fontSize: 16, fontWeight: 800, color: BLACK }}>{issuer.trade_name}</Text>;
}

function Rule({ weight = STRONG, color = BLACK, space = 0 }: { weight?: number; color?: string; space?: number }) {
  return <View style={{ borderTopWidth: weight, borderTopColor: color, marginVertical: space }} />;
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={[s.between, { paddingVertical: 1.5 }]}>
      <Text style={[s.small, s.muted]}>{label}</Text>
      <Text style={[s.small, s.bold, { marginLeft: 16 }]}>{value}</Text>
    </View>
  );
}

function TotalRow({ label, value, grand }: { label: string; value: string; grand?: boolean }) {
  return (
    <View
      style={[
        s.between,
        grand
          ? { paddingVertical: 6, borderTopWidth: STRONG * 1.5, borderTopColor: BLACK, borderBottomWidth: STRONG, borderBottomColor: BLACK, marginTop: 2 }
          : { paddingVertical: 3.5 },
      ]}
    >
      <Text style={grand ? { fontSize: 11, fontWeight: 800 } : [s.small, s.muted]}>{label}</Text>
      <Text style={grand ? { fontSize: 11, fontWeight: 800 } : [s.small, s.bold]}>{value}</Text>
    </View>
  );
}

export function DocumentPdf({ data }: { data: DocumentData }) {
  const { kind, number, date, issuer, app, client, countryName, payments } = data;
  const brand = brandFor(issuer.slug);

  // The rule the whole system turns on: no TRN, no VAT line, no "Tax".
  const taxInvoice = issuer.vat_registered && issuer.trn !== null;
  const title = kind === "quotation" ? "Quotation" : taxInvoice ? "Tax Invoice" : "Invoice";

  const guests = app.quantity;
  const total = num(app.grand_total);
  const vat = taxInvoice ? num(app.vat_amount) : 0;
  const serviceTotal = num(app.service_charge) * guests;
  const owed = balance(total, payments.map((p) => ({ amount: num(p.amount) })));
  const paid = Math.round((total - owed) * 100) / 100;

  const terms = (app.terms ?? "")
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);
  const bank = kind === "invoice" && issuer.bank_iban;
  const contact = [issuer.email, issuer.phone, issuer.website].filter(Boolean).join("  ·  ");

  return (
    <Document title={`${title} ${number}`} author={issuer.legal_name} subject={`${title} ${number} — ${client.full_name}`}>
      <Page size="A4" style={s.page}>
        {/* 1. Logo (left) · legal details (right) */}
        <View style={[s.between, { alignItems: "flex-start" }]}>
          <Logo brand={brand} issuer={issuer} />
          <View style={{ width: "60%", alignItems: "flex-end" }}>
            <Text style={{ fontSize: 9.5, fontWeight: 700, textAlign: "right" }}>{issuer.legal_name}</Text>
            {issuer.trade_name !== issuer.legal_name && (
              <Text style={[s.small, s.muted, s.right]}>Trading as {issuer.trade_name}</Text>
            )}
            {taxInvoice && <Text style={[s.small, s.right]}>TRN {issuer.trn}</Text>}
            {issuer.licence_no ? <Text style={[s.small, s.muted, s.right]}>Licence no. {issuer.licence_no}</Text> : null}
            {issuer.address ? <Text style={[s.small, s.muted, s.right]}>{issuer.address}</Text> : null}
            {contact ? <Text style={[s.small, s.muted, s.right]}>{contact}</Text> : null}
          </View>
        </View>

        <Rule space={9} />

        {/* 2. Document type and number */}
        <View style={[s.between, { alignItems: "flex-start" }]}>
          <Text style={{ fontSize: 18, fontWeight: 800, letterSpacing: 1, color: BLACK, marginTop: -2 }}>
            {title.toUpperCase()}
          </Text>
          <View style={{ width: "40%" }}>
            <MetaRow label={kind === "invoice" ? "Invoice no." : "Quotation no."} value={number} />
            <MetaRow label="Date" value={formatDate(date)} />
            <MetaRow label="Our reference" value={app.ref} />
            {kind === "invoice" && app.quotation_number ? <MetaRow label="Quotation" value={app.quotation_number} /> : null}
          </View>
        </View>

        <Rule weight={HAIR} color={HAIRLINE} space={9} />

        {/* 3. Client */}
        <View style={s.row} wrap={false}>
          <View style={{ width: "60%", paddingRight: 12 }}>
            <Text style={s.heading}>{kind === "quotation" ? "Prepared for" : "Bill to"}</Text>
            <Text style={{ fontSize: 10.5, fontWeight: 700, marginTop: 3 }}>{client.full_name}</Text>
            {client.nationality ? <Text style={[s.small, s.muted]}>{client.nationality}</Text> : null}
            {client.phone || client.email ? (
              <Text style={[s.small, s.muted]}>{[client.phone, client.email].filter(Boolean).join("  ·  ")}</Text>
            ) : null}
            {client.client_ref ? <Text style={[s.small, s.muted]}>Your reference {client.client_ref}</Text> : null}
          </View>
          <View style={{ width: "40%" }}>
            <Text style={s.heading}>Destination</Text>
            <Text style={{ fontSize: 10.5, fontWeight: 700, marginTop: 3 }}>{countryName}</Text>
          </View>
        </View>

        {/* 4. Line items */}
        <View style={{ marginTop: 14 }}>
          <View style={[s.row, { borderTopWidth: STRONG, borderTopColor: BLACK, borderBottomWidth: STRONG, borderBottomColor: BLACK }]} fixed>
            <Text style={[s.cell, s.th, { width: COLS.no }]}>#</Text>
            <Text style={[s.cell, s.th, { width: COLS.desc }]}>Description</Text>
            <Text style={[s.cell, s.th, s.right, { width: COLS.guests }]}>Guests</Text>
            <Text style={[s.cell, s.th, s.right, { width: COLS.unit }]}>Unit price</Text>
            <Text style={[s.cell, s.th, s.right, { width: COLS.amount }]}>Amount</Text>
          </View>
          <View style={[s.row, { borderBottomWidth: HAIR, borderBottomColor: HAIRLINE }]} wrap={false}>
            <Text style={[s.cell, s.muted, { width: COLS.no }]}>1</Text>
            <View style={[s.cell, { width: COLS.desc }]}>
              <Text style={{ fontWeight: 500 }}>{app.product_name}</Text>
              <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 1.5 }}>{countryName}</Text>
            </View>
            <Text style={[s.cell, s.right, { width: COLS.guests }]}>{guests}</Text>
            <Text style={[s.cell, s.right, { width: COLS.unit }]}>{money(app.selling_price)}</Text>
            <Text style={[s.cell, s.right, { width: COLS.amount }]}>{money(total)}</Text>
          </View>
        </View>

        {/* 5. VAT breakdown and total — bottom right, set apart from the items */}
        <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 16 }} wrap={false}>
          <View style={{ width: "46%" }}>
            {taxInvoice && (
              <>
                <TotalRow label="Subtotal (excl. VAT)" value={money(total - vat)} />
                <TotalRow label={`VAT 5% on service fees of ${money(serviceTotal)}`} value={money(vat)} />
              </>
            )}
            <TotalRow label={taxInvoice ? "Total incl. VAT (AED)" : "Total (AED)"} value={money(total)} grand />
            {kind === "invoice" && (
              <View style={{ marginTop: 3 }}>
                <TotalRow label="Paid" value={money(paid)} />
                <View style={[s.between, { paddingVertical: 3.5 }]}>
                  <Text style={{ fontSize: 9, fontWeight: 700 }}>Balance due</Text>
                  <Text style={{ fontSize: 9, fontWeight: 700 }}>{money(owed)}</Text>
                </View>
              </View>
            )}
            {taxInvoice && (
              <Text style={{ fontSize: 6.5, color: MUTED, textAlign: "right", marginTop: 4, lineHeight: 1.4 }}>
                Taxable amount {money(app.taxable_amount)}. VAT is included in the service fee, not added on top.
              </Text>
            )}
          </View>
        </View>

        {/* 6. Payment and terms */}
        {(bank || terms.length > 0) && (
          <View style={{ marginTop: 16 }}>
            <Rule weight={HAIR} color={HAIRLINE} />
            <View style={[s.row, { marginTop: 9 }]}>
              {bank && (
                <View style={{ width: "40%", paddingRight: 14 }} wrap={false}>
                  <Text style={s.heading}>Payment by bank transfer</Text>
                  <Text style={[s.small, s.bold, { marginTop: 3 }]}>{issuer.bank_account_name}</Text>
                  {issuer.bank_name ? <Text style={s.small}>{issuer.bank_name}</Text> : null}
                  <Text style={s.small}>IBAN {issuer.bank_iban}</Text>
                  {issuer.bank_swift ? <Text style={s.small}>SWIFT {issuer.bank_swift}</Text> : null}
                  <Text style={[s.small, s.muted]}>Please quote {number}.</Text>
                </View>
              )}
              {terms.length > 0 && (
                <View style={{ flex: 1 }}>
                  <Text style={s.heading}>Terms and conditions</Text>
                  {terms.map((t, i) => (
                    <View key={i} style={[s.row, { marginTop: 2 }]} wrap={false}>
                      <Text style={{ width: 8, fontSize: 7, color: MUTED }}>–</Text>
                      <Text style={{ flex: 1, fontSize: 7, color: MUTED, lineHeight: 1.4 }}>{t}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* 7. Footer, on every page */}
        <View
          fixed
          style={{
            position: "absolute",
            left: MARGIN,
            right: MARGIN,
            bottom: 9 * MM,
            flexDirection: "row",
            justifyContent: "space-between",
            borderTopWidth: HAIR,
            borderTopColor: HAIRLINE,
            paddingTop: 4,
          }}
        >
          <Text style={{ fontSize: 6.5, color: MUTED, width: "72%" }}>
            {issuer.legal_name}
            {taxInvoice ? `  ·  TRN ${issuer.trn}` : issuer.licence_no ? `  ·  Licence ${issuer.licence_no}` : ""}
            {"  ·  "}Computer-generated document; no signature required.
          </Text>
          <Text
            style={{ fontSize: 6.5, color: MUTED, width: "28%", textAlign: "right" }}
            render={({ pageNumber, totalPages }) => `${number}  ·  Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

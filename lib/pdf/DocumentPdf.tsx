/* eslint-disable jsx-a11y/alt-text -- react-pdf's <Image> is not an HTML img */
import fs from "node:fs";
import path from "node:path";
import {
  Document,
  Font,
  Image,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import { brandFor, type BrandTheme } from "@/lib/brands";
import type { DocumentData } from "@/lib/documents";
import { formatDate, num } from "@/lib/format";
import { balance, money } from "@/lib/vat";

/*
 * The quotation / invoice as a real A4 PDF.
 *
 * Everything is in points (1 mm = 2.835 pt). Rules are 0.75 pt so they stay
 * visible in Adobe Reader and on paper; nothing relies on hairlines or on the
 * viewer's print settings.
 */

const FONT_DIR = path.join(process.cwd(), "lib", "pdf", "fonts");
Font.register({
  family: "Manrope",
  fonts: [
    {
      src: path.join(FONT_DIR, "manrope-latin-400-normal.woff"),
      fontWeight: 400,
    },
    {
      src: path.join(FONT_DIR, "manrope-latin-500-normal.woff"),
      fontWeight: 500,
    },
    {
      src: path.join(FONT_DIR, "manrope-latin-700-normal.woff"),
      fontWeight: 700,
    },
    {
      src: path.join(FONT_DIR, "manrope-latin-800-normal.woff"),
      fontWeight: 800,
    },
  ],
});
// Don't hyphenate names, addresses or visa descriptions.
Font.registerHyphenationCallback((word) => [word]);

const MM = 2.835;
const RULE = 0.75;
const INK = "#0B0C10";
const MUTED = "#5B6170";
const LINE = "#B4BBC6";

const s = StyleSheet.create({
  page: {
    fontFamily: "Manrope",
    fontSize: 9,
    color: INK,
    paddingTop: 16 * MM,
    paddingBottom: 24 * MM,
    paddingHorizontal: 16 * MM,
    // No lineHeight on the page or any container: react-pdf then drops the
    // page-number render callback. Line spacing is set on text styles instead.
  },
  row: { flexDirection: "row" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  label: {
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  muted: { color: MUTED },
  small: { fontSize: 8, lineHeight: 1.45 },
  bold: { fontWeight: 700 },
  num: { textAlign: "right" },
  cell: { paddingVertical: 6, paddingHorizontal: 7 },
});

/** Column widths for the items table (must add up to 100%). */
const COLS = {
  no: "6%",
  desc: "52%",
  guests: "10%",
  unit: "16%",
  amount: "16%",
} as const;

const logoCache = new Map<string, Buffer>();
/** Logo bytes from public/, read once per server process. */
function readLogo(publicPath: string): Buffer {
  let bytes = logoCache.get(publicPath);
  if (!bytes) {
    bytes = fs.readFileSync(
      path.join(
        process.cwd(),
        "public",
        ...publicPath.split("/").filter(Boolean),
      ),
    );
    logoCache.set(publicPath, bytes);
  }
  return bytes;
}

function Logo({
  brand,
  issuer,
}: {
  brand: BrandTheme;
  issuer: DocumentData["issuer"];
}) {
  const width = brand.logoWidthMm * MM;

  if (brand.logo) {
    return (
      <Image
        src={{ data: readLogo(brand.logo), format: "png" }}
        style={{
          width,
          height: width / brand.logoAspect,
          objectFit: "contain",
        }}
      />
    );
  }

  if (issuer.slug === "visatreat") {
    // The Visa Treat mark: mint V + "Visa" in ink, "Treat" in mint.
    const h = width / brand.logoAspect;
    return (
      <View
        style={{ flexDirection: "row", alignItems: "center", width, height: h }}
      >
        <Svg viewBox="22 34 88 84" style={{ width: h * 0.62, height: h * 0.6 }}>
          <Path
            d="M34 46 L66 106 L98 46"
            fill="none"
            stroke="#2FE0C2"
            strokeWidth={18}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
        <Text
          style={{
            fontSize: h * 0.56,
            fontWeight: 800,
            letterSpacing: -0.6,
            marginLeft: h * 0.12,
          }}
        >
          Visa<Text style={{ color: "#2FE0C2" }}>Treat</Text>
        </Text>
      </View>
    );
  }

  return (
    <Text style={{ fontSize: 18, fontWeight: 800, color: brand.primary }}>
      {issuer.trade_name}
    </Text>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={[s.between, { paddingVertical: 2.5 }]}>
      <Text style={[s.small, s.muted]}>{label}</Text>
      <Text style={[s.small, s.bold, { marginLeft: 12 }]}>{value}</Text>
    </View>
  );
}

function TotalRow({
  label,
  value,
  brand,
  strong,
  last,
}: {
  label: string;
  value: string;
  brand: BrandTheme;
  strong?: boolean;
  last?: boolean;
}) {
  return (
    <View
      style={[
        s.between,
        {
          paddingVertical: strong ? 7 : 5,
          paddingHorizontal: 8,
          borderBottomWidth: last ? 0 : RULE,
          borderBottomColor: LINE,
          backgroundColor: strong ? brand.tint : undefined,
        },
      ]}
    >
      <Text
        style={
          strong
            ? { fontSize: 10, fontWeight: 800, color: brand.primary }
            : [s.small, s.muted]
        }
      >
        {label}
      </Text>
      <Text
        style={
          strong
            ? { fontSize: 10, fontWeight: 800, color: brand.primary }
            : [s.small, s.bold]
        }
      >
        {value}
      </Text>
    </View>
  );
}

export function DocumentPdf({ data }: { data: DocumentData }) {
  const { kind, number, date, issuer, app, client, countryName, payments } =
    data;
  const brand = brandFor(issuer.slug, issuer.accent_colour);

  // The rule the whole system turns on: no TRN, no VAT line, no "Tax".
  const taxInvoice = issuer.vat_registered && issuer.trn !== null;
  const title =
    kind === "quotation" ? "Quotation" : taxInvoice ? "Tax Invoice" : "Invoice";

  const guests = app.quantity;
  const total = num(app.grand_total);
  const vat = taxInvoice ? num(app.vat_amount) : 0;
  const serviceTotal = num(app.service_charge) * guests;
  const owed = balance(
    total,
    payments.map((p) => ({ amount: num(p.amount) })),
  );
  const paid = Math.round((total - owed) * 100) / 100;

  const terms = (app.terms ?? "")
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);

  const bank = kind === "invoice" && issuer.bank_iban;

  return (
    <Document
      title={`${title} ${number}`}
      author={issuer.legal_name}
      subject={`${title} ${number} — ${client.full_name}`}
    >
      <Page size="A4" style={s.page}>
        {/* Thin brand bar across the very top */}
        <View
          fixed
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            backgroundColor: brand.accent,
          }}
        />

        {/* 1. Logo + company · title + numbers */}
        <View style={[s.between, { alignItems: "flex-start" }]}>
          <View style={{ maxWidth: "58%" }}>
            <Logo brand={brand} issuer={issuer} />
            <View style={{ marginTop: 10 }}>
              <Text style={{ fontSize: 10, fontWeight: 700 }}>
                {issuer.legal_name}
              </Text>
              {issuer.trade_name !== issuer.legal_name && (
                <Text style={[s.small, s.muted]}>
                  Trading as {issuer.trade_name}
                </Text>
              )}
              <Text style={[s.small, { marginTop: 3 }]}>
                {taxInvoice ? (
                  <>
                    <Text style={s.bold}>TRN </Text>
                    {issuer.trn}
                  </>
                ) : issuer.licence_no ? (
                  <>
                    <Text style={s.bold}>Licence no. </Text>
                    {issuer.licence_no}
                  </>
                ) : null}
              </Text>
              {issuer.address ? (
                <Text style={[s.small, s.muted]}>{issuer.address}</Text>
              ) : null}
              <Text style={[s.small, s.muted]}>
                {[issuer.email, issuer.phone, issuer.website]
                  .filter(Boolean)
                  .join("  ·  ")}
              </Text>
            </View>
          </View>

          <View style={{ width: "36%", alignItems: "flex-end" }}>
            <Text
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: brand.primary,
                letterSpacing: 0.5,
                lineHeight: 1.2,
              }}
            >
              {title.toUpperCase()}
            </Text>
            <View
              style={{
                marginTop: 10,
                width: "100%",
                borderTopWidth: 2,
                borderTopColor: brand.primary,
                backgroundColor: brand.tint,
                paddingHorizontal: 8,
                paddingVertical: 5,
              }}
            >
              <Meta
                label={kind === "invoice" ? "Invoice no." : "Quotation no."}
                value={number}
              />
              <Meta label="Date" value={formatDate(date)} />
              <Meta label="Our reference" value={app.ref} />
              {kind === "invoice" && app.quotation_number ? (
                <Meta label="Quotation" value={app.quotation_number} />
              ) : null}
            </View>
          </View>
        </View>

        <View
          style={{
            marginTop: 16,
            borderTopWidth: RULE,
            borderTopColor: brand.primary,
          }}
        />

        {/* 2. Customer · travel */}
        <View style={[s.row, { marginTop: 12 }]} wrap={false}>
          <View style={{ width: "58%", paddingRight: 12 }}>
            <Text style={[s.label, { color: brand.primary }]}>
              {kind === "quotation" ? "Prepared for" : "Bill to"}
            </Text>
            <Text style={{ fontSize: 11, fontWeight: 700, marginTop: 4 }}>
              {client.full_name}
            </Text>
            {client.nationality ? (
              <Text style={[s.small, s.muted, { marginTop: 1 }]}>
                {client.nationality}
              </Text>
            ) : null}
            <Text style={[s.small, s.muted]}>
              {[client.phone, client.email].filter(Boolean).join("  ·  ")}
            </Text>
            {client.client_ref ? (
              <Text style={[s.small, s.muted]}>
                Your reference {client.client_ref}
              </Text>
            ) : null}
          </View>
          <View style={{ width: "42%" }}>
            <Text style={[s.label, { color: brand.primary }]}>Destination</Text>
            <Text style={{ fontSize: 10, fontWeight: 700, marginTop: 4 }}>
              {countryName}
            </Text>
          </View>
        </View>

        {/* 3. Items */}
        <View style={{ marginTop: 16, borderWidth: RULE, borderColor: LINE }}>
          <View
            style={[
              s.row,
              {
                backgroundColor: brand.tint,
                borderBottomWidth: RULE,
                borderBottomColor: brand.primary,
              },
            ]}
            fixed
          >
            <Text
              style={[
                s.cell,
                s.label,
                { width: COLS.no, color: brand.primary },
              ]}
            >
              #
            </Text>
            <Text
              style={[
                s.cell,
                s.label,
                { width: COLS.desc, color: brand.primary },
              ]}
            >
              Description
            </Text>
            <Text
              style={[
                s.cell,
                s.label,
                s.num,
                { width: COLS.guests, color: brand.primary },
              ]}
            >
              Guests
            </Text>
            <Text
              style={[
                s.cell,
                s.label,
                s.num,
                { width: COLS.unit, color: brand.primary },
              ]}
            >
              Unit price
            </Text>
            <Text
              style={[
                s.cell,
                s.label,
                s.num,
                { width: COLS.amount, color: brand.primary },
              ]}
            >
              Amount
            </Text>
          </View>
          <View style={s.row} wrap={false}>
            <Text style={[s.cell, { width: COLS.no, color: MUTED }]}>1</Text>
            <View style={[s.cell, { width: COLS.desc }]}>
              <Text style={s.bold}>{app.product_name}</Text>
              <Text style={[s.small, s.muted, { marginTop: 1 }]}>
                {countryName}
              </Text>
            </View>
            <Text style={[s.cell, s.num, { width: COLS.guests }]}>
              {guests}
            </Text>
            <Text style={[s.cell, s.num, { width: COLS.unit }]}>
              {money(app.selling_price)}
            </Text>
            <Text style={[s.cell, s.num, s.bold, { width: COLS.amount }]}>
              {money(total)}
            </Text>
          </View>
        </View>

        {/* 4. Totals */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "flex-end",
            marginTop: 10,
          }}
          wrap={false}
        >
          <View style={{ width: "48%", borderWidth: RULE, borderColor: LINE }}>
            {taxInvoice && (
              <>
                <TotalRow
                  label="Subtotal (excl. VAT)"
                  value={money(total - vat)}
                  brand={brand}
                />
                <TotalRow
                  label={`VAT 5% on service fees of ${money(serviceTotal)}`}
                  value={money(vat)}
                  brand={brand}
                />
              </>
            )}
            <TotalRow
              label={taxInvoice ? "Total incl. VAT (AED)" : "Total (AED)"}
              value={money(total)}
              brand={brand}
              strong
              last={kind !== "invoice"}
            />
            {kind === "invoice" && (
              <>
                <TotalRow label="Paid" value={money(paid)} brand={brand} />
                <TotalRow
                  label="Balance due"
                  value={money(owed)}
                  brand={brand}
                  last
                />
              </>
            )}
          </View>
        </View>
        {taxInvoice && (
          <Text
            style={[
              { fontSize: 7, color: MUTED, textAlign: "right", marginTop: 4 },
            ]}
          >
            Taxable amount {money(app.taxable_amount)}. VAT is included in the
            service fee and is not added on top.
          </Text>
        )}

        {/* 5. Payment · notes */}
        {(bank || terms.length > 0) && (
          <View style={{ marginTop: 18 }}>
            {bank && (
              <View style={{ marginBottom: 12 }} wrap={false}>
                <Text style={[s.label, { color: brand.primary }]}>
                  Payment by bank transfer
                </Text>
                <View
                  style={{
                    marginTop: 4,
                    borderLeftWidth: 2,
                    borderLeftColor: brand.accent,
                    paddingLeft: 8,
                  }}
                >
                  <Text style={s.small}>
                    <Text style={s.bold}>{issuer.bank_account_name}</Text>
                    {issuer.bank_name ? `  ·  ${issuer.bank_name}` : ""}
                  </Text>
                  <Text style={s.small}>
                    IBAN {issuer.bank_iban}
                    {issuer.bank_swift ? `  ·  SWIFT ${issuer.bank_swift}` : ""}
                  </Text>
                  <Text style={[s.small, s.muted]}>
                    Please quote {number} with your payment.
                  </Text>
                </View>
              </View>
            )}
            {terms.length > 0 && (
              <View>
                <Text style={[s.label, { color: brand.primary }]}>
                  Terms and conditions
                </Text>
                {terms.map((t, i) => (
                  <View key={i} style={[s.row, { marginTop: 3 }]} wrap={false}>
                    <Text
                      style={{ width: 10, fontSize: 7.5, color: brand.primary }}
                    >
                      •
                    </Text>
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 7.5,
                        color: MUTED,
                        lineHeight: 1.4,
                      }}
                    >
                      {t}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* 6. Footer, on every page */}
        <View
          fixed
          style={{
            position: "absolute",
            left: 16 * MM,
            right: 16 * MM,
            bottom: 14 * MM,
            height: 0,
            borderTopWidth: RULE,
            borderTopColor: brand.primary,
          }}
        />
        <View
          fixed
          style={{
            position: "absolute",
            left: 16 * MM,
            right: 16 * MM,
            bottom: 8 * MM,
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ fontSize: 7, color: MUTED, width: "72%" }}>
            {issuer.legal_name}
            {taxInvoice
              ? `  ·  TRN ${issuer.trn}`
              : issuer.licence_no
                ? `  ·  Licence ${issuer.licence_no}`
                : ""}
            {"  ·  "}Computer-generated document; no signature required.
          </Text>
          <Text
            style={{
              fontSize: 7,
              color: MUTED,
              width: "28%",
              textAlign: "right",
            }}
            render={({ pageNumber, totalPages }) =>
              `${number}  ·  Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

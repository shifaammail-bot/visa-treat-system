export type Status = "enquiry" | "quoted" | "submitted" | "approved" | "rejected" | "cancelled";
export type Source = "google_ads" | "organic" | "whatsapp" | "social" | "agent" | "other" | "direct";
export type VisaType = "tourist" | "visit" | "transit" | "business" | "student" | "work" | "other";
export type PaymentMethod = "cash" | "card" | "bank transfer" | "link" | "cheque";

export type Client = {
  id: string;
  created_at: string;
  created_by: string | null;
  full_name: string;
  nationality: string;
  phone: string | null;
  email: string | null;
  passport_no: string | null;
  client_ref: string | null;
  notes: string | null;
};

export type Country = { code: string; name: string };

export type VisaProduct = {
  id: string;
  country_code: string;
  name: string;
  visa_type: VisaType;
  entries: "single" | "multiple";
  duration_days: number;
  processing_days_min: number;
  processing_days_max: number;
  government_fee: number;
  default_service_charge: number;
  default_selling_price: number;
  default_issuer_id: string | null;
  terms: string | null;
  placeholder: boolean;
};

export type Payment = {
  id: string;
  application_id: string;
  paid_at: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  receipt_number: string | null;
  received_by: string | null;
  note: string | null;
};

export type Application = {
  id: string;
  ref: string;
  created_at: string;
  created_by: string | null;
  consultant: string;
  client_id: string;
  country_code: string;
  product_id: string | null;
  product_name: string;
  issued_by: string | null;
  quantity: number;
  government_fee: number;
  service_charge: number;
  selling_price: number;
  cost_price: number;
  taxable_amount: number;
  vat_amount: number;
  grand_total: number;
  status: Status;
  submitted_at: string | null;
  decided_at: string | null;
  invoice_date: string;
  invoice_number: string | null;
  quotation_number: string | null;
  quotation_date: string | null;
  terms: string | null;
  notes: string | null;
  source: Source | null;
  visa_type: VisaType | null;
  travel_from: string | null;
  travel_to: string | null;
};

/** An application as list pages fetch it: with its client, destination and payments. */
export type ApplicationRow = Application & {
  client: Pick<Client, "id" | "full_name" | "nationality" | "phone" | "email"> | null;
  country: Pick<Country, "name"> | null;
  payments: Pick<Payment, "amount">[];
};

export const APPLICATION_ROW_SELECT =
  "*, client:clients(id, full_name, nationality, phone, email), country:countries(name), payments(amount)";
